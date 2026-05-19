import { PrismaPg } from '@prisma/adapter-pg';
import {
  DocumentStatus,
  OcrStatus,
  PrismaClient,
  SourceType,
  StoredObjectLifecycleStatus,
  UserRole,
  WebsiteScanStatus,
} from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { PDFParse } from 'pdf-parse';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

interface BotDocumentLink {
  listPage: number;
  packId: string;
  pdfUrl: string;
  title: string;
}

interface CrawlOptions {
  sourceId?: string;
  maxPages: number;
  maxDocuments?: number;
  sourceUrl: string;
}

interface PageState {
  cookies: Map<string, string>;
  hiddenFields: Map<string, string>;
  html: string;
}

loadEnvFiles();

const databaseUrl = requiredEnv('DATABASE_URL');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const minio = new MinioClient({
  endPoint: requiredEnv('MINIO_ENDPOINT'),
  port: readIntegerEnv('MINIO_PORT', 9000),
  accessKey: requiredEnv('MINIO_ACCESS_KEY'),
  secretKey: requiredEnv('MINIO_SECRET_KEY'),
  useSSL: readBooleanEnv('MINIO_USE_SSL', false),
});

const buckets = {
  documents: requiredEnv('MINIO_BUCKET_DOCUMENTS'),
  ocr: requiredEnv('MINIO_BUCKET_OCR'),
};

async function main() {
  const options = parseOptions();
  const actor = await prisma.user.findFirst({ where: { role: UserRole.ANALYST }, orderBy: { createdAt: 'asc' } });
  const correlationId = randomUUID();

  await ensureBucket(buckets.documents);
  await ensureBucket(buckets.ocr);

  const websiteSource = await resolveWebsiteSource(options.sourceId, options.sourceUrl);
  const websiteScan = await prisma.websiteScan.create({
    data: {
      websiteSourceId: websiteSource.id,
      status: WebsiteScanStatus.SCANNING,
      startedAt: new Date(),
      metadata: { maxPages: options.maxPages, maxDocuments: options.maxDocuments ?? null },
    },
  });

  let importedCount = 0;
  let duplicateCount = 0;
  let discoveredCount = 0;

  try {
    const links = await crawlBotFipcsLinks(options);
    discoveredCount = links.length;

    for (const link of links) {
      const result = await importPdfLink(link, websiteSource.id, websiteScan.id, actor?.id, correlationId);
      if (result === 'IMPORTED') importedCount += 1;
      if (result === 'DUPLICATE') duplicateCount += 1;
      await delay(200);
    }

    await prisma.websiteScan.update({
      where: { id: websiteScan.id },
      data: {
        status: WebsiteScanStatus.COMPLETED,
        finishedAt: new Date(),
        discoveredCount,
        importedCount,
        duplicateCount,
      },
    });

    printSummary({ discoveredCount, duplicateCount, importedCount, websiteScanId: websiteScan.id });
  } catch (error) {
    await prisma.websiteScan.update({
      where: { id: websiteScan.id },
      data: {
        status: importedCount > 0 ? WebsiteScanStatus.PARTIAL_FAILED : WebsiteScanStatus.FAILED,
        finishedAt: new Date(),
        discoveredCount,
        importedCount,
        duplicateCount,
        failureReason: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function crawlBotFipcsLinks(options: CrawlOptions) {
  const state = await fetchInitialPage(options.sourceUrl);
  const links: BotDocumentLink[] = [];

  for (let page = 1; page <= options.maxPages; page += 1) {
    links.push(...extractPdfLinks(state.html, page));
    if (page === options.maxPages) break;

    const nextTarget = extractNextPostbackTarget(state.html);
    if (!nextTarget) break;

    const nextState = await fetchPostbackPage(options.sourceUrl, state, nextTarget);
    state.html = nextState.html;
    state.hiddenFields = nextState.hiddenFields;
    mergeCookies(state.cookies, nextState.cookies);
  }

  const uniqueLinks = dedupeLinks(links);
  return options.maxDocuments ? uniqueLinks.slice(0, options.maxDocuments) : uniqueLinks;
}

async function importPdfLink(
  link: BotDocumentLink,
  websiteSourceId: string,
  websiteScanId: string,
  actorId: string | undefined,
  correlationId: string,
) {
  const sourceUrlHash = sha256(link.pdfUrl);
  const existingByUrl = await prisma.documentVersion.findFirst({ where: { sourceUrlHash, isLatest: true } });
  const pdfBuffer = await downloadPdf(link.pdfUrl);
  const fileSha256 = sha256Buffer(pdfBuffer);

  if (existingByUrl?.fileSha256 === fileSha256) {
    return 'DUPLICATE' as const;
  }

  const extracted = await extractPdfText(pdfBuffer);
  const normalizedText = normalizeText(extracted.text);
  const contentSha256 = normalizedText ? sha256(normalizedText) : undefined;
  const existingByFile = await prisma.documentVersion.findFirst({ where: { fileSha256 } });
  const existingByContent = contentSha256 ? await prisma.documentVersion.findFirst({ where: { contentSha256 } }) : null;

  if (!existingByUrl && (existingByFile || existingByContent)) {
    return 'DUPLICATE' as const;
  }

  const documentId = existingByUrl?.documentId ?? randomUUID();
  const documentVersionId = randomUUID();
  const ocrArtifactId = randomUUID();
  const originalObjectKey = `documents/${documentId}/versions/${documentVersionId}/original.pdf`;
  const textObjectKey = `ocr/${ocrArtifactId}/text/ocr.txt`;
  const textBuffer = Buffer.from(normalizedText || '', 'utf8');
  const pageCount = extracted.pageCount;
  const ocrStatus = normalizedText ? OcrStatus.COMPLETED : OcrStatus.FAILED;
  const documentStatus = normalizedText ? DocumentStatus.OCR_COMPLETED : DocumentStatus.OCR_FAILED;

  await minio.putObject(buckets.documents, originalObjectKey, pdfBuffer, pdfBuffer.byteLength, {
    'Content-Type': 'application/pdf',
    'x-amz-meta-sha256': fileSha256,
  });
  await minio.putObject(buckets.ocr, textObjectKey, textBuffer, textBuffer.byteLength, {
    'Content-Type': 'text/plain; charset=utf-8',
    'x-amz-meta-sha256': sha256Buffer(textBuffer),
  });

  await prisma.$transaction(async (tx) => {
    let versionNumber = 1;
    let previousVersionId: string | undefined;

    if (existingByUrl) {
      versionNumber = existingByUrl.versionNumber + 1;
      previousVersionId = existingByUrl.id;
      await tx.documentVersion.update({ where: { id: existingByUrl.id }, data: { isLatest: false } });
      await tx.document.update({ where: { id: existingByUrl.documentId }, data: { title: link.title, status: documentStatus } });
    } else {
      await tx.document.create({
        data: {
          id: documentId,
          title: link.title,
          domain: 'banking-regulation',
          sourceType: SourceType.WEBSITE_SCAN,
          status: documentStatus,
          ownerId: actorId,
        },
      });
    }

    await tx.documentVersion.create({
      data: {
        id: documentVersionId,
        documentId,
        versionNumber,
        title: link.title,
        sourceUrl: link.pdfUrl,
        sourceUrlHash,
        fileName: basename(new URL(link.pdfUrl).pathname),
        mimeType: 'application/pdf',
        byteSize: BigInt(pdfBuffer.byteLength),
        fileSha256,
        contentSha256,
        status: documentStatus,
        ocrStatus,
        previousVersionId,
      },
    });

    const originalObject = await tx.storedObject.create({
      data: {
        bucket: buckets.documents,
        objectKey: originalObjectKey,
        fileName: basename(new URL(link.pdfUrl).pathname),
        contentType: 'application/pdf',
        byteSize: BigInt(pdfBuffer.byteLength),
        sha256: fileSha256,
        ownerType: 'DocumentVersion',
        ownerId: documentVersionId,
        lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
        metadata: { pdfUrl: link.pdfUrl, listPage: link.listPage, packId: link.packId, websiteSourceId, websiteScanId },
      },
    });

    const textObject = await tx.storedObject.create({
      data: {
        bucket: buckets.ocr,
        objectKey: textObjectKey,
        fileName: `${link.packId || documentVersionId}.txt`,
        contentType: 'text/plain; charset=utf-8',
        byteSize: BigInt(textBuffer.byteLength),
        sha256: sha256Buffer(textBuffer),
        ownerType: 'OcrArtifact',
        ownerId: ocrArtifactId,
        lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
        metadata: { extractionMode: 'native_pdf_text', sourceObjectId: originalObject.id, pageCount },
      },
    });

    await tx.ocrArtifact.create({
      data: {
        id: ocrArtifactId,
        documentVersionId,
        engine: 'pdf-parse-native-text',
        status: ocrStatus,
        aggregateConfidence: normalizedText ? estimateTextQuality(normalizedText) : 0,
        minPageConfidence: normalizedText ? estimateTextQuality(normalizedText) : 0,
        pageCount,
        failedPages: normalizedText ? [] : Array.from({ length: pageCount }, (_, index) => index + 1),
        warnings: normalizedText ? [] : ['No extractable text found; OCR engine required for scanned PDF.'],
        textObjectId: textObject.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: existingByUrl ? 'BOT_FIPCS_DOCUMENT_VERSION_IMPORTED' : 'BOT_FIPCS_DOCUMENT_IMPORTED',
        entityType: 'DocumentVersion',
        entityId: documentVersionId,
        previousState: existingByUrl ? { documentVersionId: existingByUrl.id, fileSha256: existingByUrl.fileSha256 } : undefined,
        nextState: {
          documentId,
          documentVersionId,
          status: documentStatus,
          ocrStatus,
          originalObjectId: originalObject.id,
          textObjectId: textObject.id,
        },
        correlationId,
        requestMetadata: { websiteSourceId, websiteScanId, sourceUrl: link.pdfUrl, listPage: link.listPage, packId: link.packId },
      },
    });
  });

  return 'IMPORTED' as const;
}

async function fetchInitialPage(sourceUrl: string): Promise<PageState> {
  const cookies = new Map<string, string>();
  const response = await fetch(sourceUrl, {
    headers: crawlerHeaders(),
  });
  mergeSetCookieHeaders(cookies, response.headers);
  const html = await response.text();

  return { cookies, hiddenFields: extractHiddenFields(html), html };
}

async function fetchPostbackPage(sourceUrl: string, state: PageState, eventTarget: string): Promise<PageState> {
  const form = new URLSearchParams();
  for (const [name, value] of state.hiddenFields) {
    form.set(name, value);
  }
  form.set('__EVENTTARGET', eventTarget);
  form.set('__EVENTARGUMENT', '');

  const cookies = new Map<string, string>();
  const response = await fetch(sourceUrl, {
    method: 'POST',
    headers: {
      ...crawlerHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: renderCookieHeader(state.cookies),
      Referer: sourceUrl,
    },
    body: form,
  });
  mergeSetCookieHeaders(cookies, response.headers);
  const html = await response.text();

  return { cookies, hiddenFields: extractHiddenFields(html), html };
}

function extractPdfLinks(html: string, listPage: number): BotDocumentLink[] {
  const decoded = decodeHtml(html);
  const links: BotDocumentLink[] = [];
  const pdfPattern = /href\s*=\s*['"]([^'"]+\.pdf(?:\?[^'"]*)?)['"]/gi;
  let match: RegExpExecArray | null;

  while ((match = pdfPattern.exec(decoded))) {
    const pdfUrl = absoluteUrl(match[1]);
    const packId = extractPackId(pdfUrl);
    links.push({
      listPage,
      packId,
      pdfUrl,
      title: `BOT FIPCS ${packId || basename(new URL(pdfUrl).pathname, extname(new URL(pdfUrl).pathname))}`,
    });
  }

  return links;
}

function extractNextPostbackTarget(html: string) {
  const decoded = decodeHtml(html);
  const match = decoded.match(/__doPostBack\('([^']*btnNext[^']*)',''\)/);
  return match?.[1];
}

function extractHiddenFields(html: string) {
  const fields = new Map<string, string>();
  const inputPattern = /<input\b[^>]*type=["']hidden["'][^>]*>/gi;
  let inputMatch: RegExpExecArray | null;

  while ((inputMatch = inputPattern.exec(html))) {
    const input = inputMatch[0];
    const name = extractAttribute(input, 'name');
    if (!name) continue;
    fields.set(decodeHtml(name), decodeHtml(extractAttribute(input, 'value') ?? ''));
  }

  return fields;
}

function extractAttribute(input: string, attribute: string) {
  const pattern = new RegExp(`${attribute}=["']([^"']*)["']`, 'i');
  return input.match(pattern)?.[1];
}

async function downloadPdf(pdfUrl: string) {
  const response = await fetch(pdfUrl, { headers: crawlerHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to download PDF ${pdfUrl}: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { pageCount: result.total || result.pages?.length || 0, text: result.text || '' };
  } finally {
    await parser.destroy();
  }
}

async function ensureBucket(bucket: string) {
  const exists = await minio.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await minio.makeBucket(bucket);
  }
}

async function resolveWebsiteSource(sourceId: string | undefined, sourceUrl: string) {
  if (sourceId) {
    const existingById = await prisma.websiteSource.findUnique({ where: { id: sourceId } });
    if (existingById) return existingById;
  }

  const existing = await prisma.websiteSource.findFirst({ where: { baseUrl: sourceUrl } });
  if (existing) return existing;

  return prisma.websiteSource.create({
    data: {
      name: 'BOT FIPCS Thai Notices',
      baseUrl: sourceUrl,
      domain: 'banking-regulation',
      scanConfig: { strategy: 'bot-fipcs', maxDepth: 1, allowedHost: 'app.bot.or.th' },
    },
  });
}

function parseOptions(): CrawlOptions {
  const sourceId = readArg('--source-id');
  const sourceUrl = readArg('--source-url') ?? 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx';
  const maxPages = readIntegerArg('--pages', 2);
  const maxDocuments = readOptionalIntegerArg('--max-documents');

  return { sourceId, maxPages, maxDocuments, sourceUrl };
}

function readArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readIntegerArg(name: string, fallback: number) {
  const value = readArg(name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readOptionalIntegerArg(name: string) {
  const value = readArg(name);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function loadEnvFiles() {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function requiredEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function readIntegerEnv(key: string, fallback: number) {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(key: string, fallback: boolean) {
  const value = process.env[key];
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function crawlerHeaders() {
  return {
    Accept: 'text/html,application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'th,en;q=0.8',
    'User-Agent': 'DocAI local crawler/0.1 (+https://localhost)',
  };
}

function mergeSetCookieHeaders(cookies: Map<string, string>, headers: Headers) {
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : splitSetCookieHeader(headers.get('set-cookie'));
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';');
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
  }
}

function splitSetCookieHeader(value: string | null) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,]+=)/g);
}

function mergeCookies(target: Map<string, string>, source: Map<string, string>) {
  for (const [name, value] of source) {
    target.set(name, value);
  }
}

function renderCookieHeader(cookies: Map<string, string>) {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function dedupeLinks(links: BotDocumentLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.pdfUrl)) return false;
    seen.add(link.pdfUrl);
    return true;
  });
}

function absoluteUrl(value: string) {
  return new URL(value, 'https://app.bot.or.th/FIPCS/Thai/').toString();
}

function extractPackId(pdfUrl: string) {
  const fileName = basename(new URL(pdfUrl).pathname);
  return fileName.replace(/\.pdf$/i, '');
}

function decodeHtml(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function estimateTextQuality(text: string) {
  const thaiCharacters = text.match(/[ก-๙]/g)?.length ?? 0;
  const quality = Math.min(0.99, Math.max(0.25, (text.length > 500 ? 0.82 : 0.55) + Math.min(0.12, thaiCharacters / Math.max(text.length, 1))));
  return Number(quality.toFixed(2));
}

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function sha256Buffer(input: Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

function printSummary(summary: { discoveredCount: number; duplicateCount: number; importedCount: number; websiteScanId: string }) {
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });