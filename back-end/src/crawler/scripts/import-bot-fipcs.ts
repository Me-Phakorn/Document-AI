import { PrismaPg } from '@prisma/adapter-pg';
import {
  DocumentStatus,
  OcrStatus,
  Prisma,
  PrismaClient,
  SourceType,
  StoredObjectLifecycleStatus,
  UserRole,
  WebsiteScanStatus,
} from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { PDFParse } from 'pdf-parse';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { extractBotFipcsPdfLinks, type BotFipcsDocumentLink } from '../bot-fipcs-parser';

const execFileAsync = promisify(execFile);

interface CrawlOptions {
  sourceId?: string;
  startPage: number;
  endPage?: number;
  maxPagesCap: number;
  maxDocuments?: number;
  sourceUrl: string;
  /** Path to a JSON file containing pre-crawled BotFipcsDocumentLink[] to import directly. */
  linksFile?: string;
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

  const websiteSource = await resolveWebsiteSource(options);
  const websiteScan = await prisma.websiteScan.create({
    data: {
      websiteSourceId: websiteSource.id,
      status: WebsiteScanStatus.SCANNING,
      startedAt: new Date(),
      metadata: {
        startPage: options.startPage,
        endPage: options.endPage ?? null,
        maxPagesCap: options.maxPagesCap,
        maxDocuments: options.maxDocuments ?? null,
        linksFile: options.linksFile ?? null,
      },
    },
  });

  let importedCount = 0;
  let duplicateCount = 0;
  let discoveredCount = 0;

  try {
    let links: BotFipcsDocumentLink[];
    if (options.linksFile) {
      const raw = readFileSync(options.linksFile, 'utf8');
      const parsed = JSON.parse(raw) as Array<{
        pdfUrl: string; title: string; listPage?: number; packId?: string;
        documentType?: string; sourceDocumentDateText?: string; sourceDocumentDate?: string;
        statusText?: string; language?: string; relatedDocumentUrl?: string;
      }>;
      links = parsed.map((item) => ({
        pdfUrl: item.pdfUrl,
        title: item.title,
        listPage: item.listPage ?? 1,
        packId: item.packId ?? '',
        documentType: item.documentType ?? null,
        sourceDocumentDate: item.sourceDocumentDate ? new Date(item.sourceDocumentDate) : null,
        sourceDocumentDateText: item.sourceDocumentDateText ?? null,
        statusText: item.statusText ?? null,
        language: item.language ?? null,
        relatedDocumentUrl: item.relatedDocumentUrl ?? null,
      }));
    } else {
      links = await crawlBotFipcsLinks(options);
    }
    discoveredCount = links.length;

    const duplicates: DuplicateInfo[] = [];
    for (const link of links) {
      const result = await importPdfLink(link, websiteSource.id, websiteScan.id, websiteSource.domain ?? 'banking-regulation', actor?.id, correlationId);
      if (result === 'IMPORTED') {
        importedCount += 1;
      } else {
        duplicateCount += 1;
        duplicates.push(result);
      }
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
        metadata: {
          startPage: options.startPage,
          endPage: options.endPage ?? null,
          maxPagesCap: options.maxPagesCap,
          maxDocuments: options.maxDocuments ?? null,
          linksFile: options.linksFile ?? null,
          duplicates: JSON.parse(JSON.stringify(duplicates.slice(0, 500))),
        },
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
  const links: BotFipcsDocumentLink[] = [];
  const maxDocuments = options.maxDocuments;

  for (let page = 1; page <= options.maxPagesCap; page += 1) {
    if (page >= options.startPage && (!options.endPage || page <= options.endPage)) {
      links.push(...extractBotFipcsPdfLinks(state.html, page));
    }
    if (maxDocuments && dedupeLinks(links).length >= maxDocuments) break;
    if (options.endPage && page >= options.endPage) break;

    const nextTarget = extractNextPostbackTarget(state.html);
    if (!nextTarget) break;

    const nextState = await fetchPostbackPage(options.sourceUrl, state, nextTarget);
    state.html = nextState.html;
    state.hiddenFields = nextState.hiddenFields;
    mergeCookies(state.cookies, nextState.cookies);
  }

  const uniqueLinks = dedupeLinks(links);
  return maxDocuments ? uniqueLinks.slice(0, maxDocuments) : uniqueLinks;
}

interface DuplicateInfo {
  title: string;
  pdfUrl: string;
  existingDocumentId: string;
  existingDocumentVersionId: string;
  existingDocumentTitle: string;
  reason: 'url_match' | 'file_hash' | 'content_hash';
}

async function importPdfLink(
  link: BotFipcsDocumentLink,
  websiteSourceId: string,
  websiteScanId: string,
  domain: string,
  actorId: string | undefined,
  correlationId: string,
) {
  const sourceUrlHash = sha256(link.pdfUrl);
  const existingByUrl = await prisma.documentVersion.findFirst({ where: { sourceUrlHash, isLatest: true } });
  const pdfBuffer = await downloadPdf(link.pdfUrl);
  const fileSha256 = sha256Buffer(pdfBuffer);

  if (existingByUrl?.fileSha256 === fileSha256) {
    await refreshDuplicateMetadata(existingByUrl, link, websiteSourceId, websiteScanId, actorId, correlationId);
    return { title: link.title, pdfUrl: link.pdfUrl, existingDocumentId: existingByUrl.documentId, existingDocumentVersionId: existingByUrl.id, existingDocumentTitle: existingByUrl.title || '', reason: 'url_match' as const };
  }

  const extracted = await extractPdfText(pdfBuffer);
  const normalizedText = normalizeText(extracted.text);
  // Only hash text that contains real Thai content. Image-based PDFs produce
  // degenerate page-marker text ("-- 1 of 3 --") with no Thai characters, which
  // is identical across many documents and causes false-positive deduplication.
  const thaiCharCount = (normalizedText.match(/[ก-๙]/g) ?? []).length;
  const hasUsableText = thaiCharCount >= 50;
  const contentSha256 = hasUsableText ? sha256(normalizedText) : undefined;
  // OCR is considered failed only when the extracted text is empty or consists
  // solely of pdf-parse page-marker patterns like "-- 1 of 3 --". English-only
  // PDFs (e.g. coupon rate announcements) have real content and must be COMPLETED.
  const isDegenerateText = !normalizedText || /^(--\s*\d+\s*of\s*\d+\s*--\s*)*$/.test(normalizedText.trim());
  const existingByFile = await prisma.documentVersion.findFirst({ where: { fileSha256 } });
  const existingByContent = contentSha256 ? await prisma.documentVersion.findFirst({ where: { contentSha256 } }) : null;

  if (!existingByUrl && (existingByFile || existingByContent)) {
    const existingVersion = existingByFile ?? existingByContent!;
    const reason = existingByFile ? 'file_hash' as const : 'content_hash' as const;
    return { title: link.title, pdfUrl: link.pdfUrl, existingDocumentId: existingVersion.documentId, existingDocumentVersionId: existingVersion.id, existingDocumentTitle: existingVersion.title || '', reason };
  }

  const documentId = existingByUrl?.documentId ?? randomUUID();
  const documentVersionId = randomUUID();
  const ocrArtifactId = randomUUID();
  const originalObjectKey = `documents/${documentId}/versions/${documentVersionId}/original.pdf`;
  const textObjectKey = `ocr/${ocrArtifactId}/text/ocr.txt`;
  const pageCount = extracted.pageCount;

  // For image-only / scanned PDFs (no native Thai text), run Tesseract OCR inline
  // so documents are not permanently stuck at OCR_FAILED.
  let finalText = normalizedText;
  let ocrEngine = 'pdf-parse-native-text';
  let ocrStatus: OcrStatus;
  let documentStatus: DocumentStatus;

  if (isDegenerateText) {
    const languages = process.env.OCR_LANGUAGES ?? 'tha+eng';
    const timeoutMs = Number(process.env.OCR_TIMEOUT_MS ?? '180000');
    try {
      console.log(`[OCR] Running Tesseract on ${link.pdfUrl}`);
      const ocrResult = await runTesseractOcr(pdfBuffer, languages, timeoutMs);
      finalText = normalizeText(ocrResult.text);
      ocrStatus = ocrResult.ocrStatus;
      ocrEngine = `ocrmypdf-tesseract@${languages}`;
      console.log(`[OCR] Tesseract done: status=${ocrStatus} textLen=${finalText.length}`);
    } catch (err) {
      console.warn(`[OCR] Tesseract failed for ${link.pdfUrl}:`, err instanceof Error ? err.message : String(err));
      ocrStatus = OcrStatus.FAILED;
    }
  } else {
    ocrStatus = OcrStatus.COMPLETED;
  }

  documentStatus = ocrStatus === OcrStatus.COMPLETED
    ? DocumentStatus.OCR_COMPLETED
    : ocrStatus === OcrStatus.PARTIAL
    ? DocumentStatus.OCR_PARTIAL
    : DocumentStatus.OCR_FAILED;

  const textBuffer = Buffer.from(finalText || '', 'utf8');

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
          domain,
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
        sourceDocumentDate: link.sourceDocumentDate ?? undefined,
        sourceDocumentDateText: link.sourceDocumentDateText,
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
        metadata: {
          pdfUrl: link.pdfUrl,
          listPage: link.listPage,
          packId: link.packId,
          websiteSourceId,
          websiteScanId,
          documentType: link.documentType,
          sourceDocumentDate: link.sourceDocumentDate?.toISOString() ?? null,
          sourceDocumentDateText: link.sourceDocumentDateText,
          statusText: link.statusText,
          language: link.language,
          relatedDocumentUrl: link.relatedDocumentUrl,
        },
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
        engine: ocrEngine,
        status: ocrStatus,
        aggregateConfidence: finalText ? estimateTextQuality(finalText) : 0,
        minPageConfidence: finalText ? estimateTextQuality(finalText) : 0,
        pageCount,
        failedPages: finalText ? [] : Array.from({ length: pageCount }, (_, index) => index + 1),
        warnings: finalText ? [] : ['No extractable text found; image PDF could not be OCR\'d.'],
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
          sourceDocumentDate: link.sourceDocumentDate?.toISOString() ?? null,
          sourceDocumentDateText: link.sourceDocumentDateText,
        },
        correlationId,
        requestMetadata: {
          websiteSourceId,
          websiteScanId,
          sourceUrl: link.pdfUrl,
          listPage: link.listPage,
          packId: link.packId,
          documentType: link.documentType,
          sourceDocumentDate: link.sourceDocumentDate?.toISOString() ?? null,
          sourceDocumentDateText: link.sourceDocumentDateText,
        },
      },
    });
  });

  return 'IMPORTED' as const;
}

async function refreshDuplicateMetadata(
  existing: { id: string; documentId: string; title: string; sourceDocumentDate: Date | null; sourceDocumentDateText: string | null },
  link: BotFipcsDocumentLink,
  websiteSourceId: string,
  websiteScanId: string,
  actorId: string | undefined,
  correlationId: string,
) {
  const documentVersionUpdate: Prisma.DocumentVersionUpdateInput = {};
  if (isFallbackTitle(existing.title) && !isFallbackTitle(link.title)) {
    documentVersionUpdate.title = link.title;
  }
  if (!existing.sourceDocumentDate && link.sourceDocumentDate) {
    documentVersionUpdate.sourceDocumentDate = link.sourceDocumentDate;
  }
  if (!existing.sourceDocumentDateText && link.sourceDocumentDateText) {
    documentVersionUpdate.sourceDocumentDateText = link.sourceDocumentDateText;
  }

  const hasDocumentVersionUpdate = Object.keys(documentVersionUpdate).length > 0;
  if (!hasDocumentVersionUpdate) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentVersion.update({ where: { id: existing.id }, data: documentVersionUpdate });

    if (documentVersionUpdate.title) {
      await tx.document.update({ where: { id: existing.documentId }, data: { title: link.title } });
    }

    const originalObject = await tx.storedObject.findFirst({ where: { ownerType: 'DocumentVersion', ownerId: existing.id } });
    if (originalObject) {
      await tx.storedObject.update({
        where: { id: originalObject.id },
        data: {
          metadata: mergeCrawlerObjectMetadata(originalObject.metadata, link, websiteSourceId, websiteScanId),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'BOT_FIPCS_DOCUMENT_METADATA_REFRESHED',
        entityType: 'DocumentVersion',
        entityId: existing.id,
        previousState: {
          title: existing.title,
          sourceDocumentDate: existing.sourceDocumentDate?.toISOString() ?? null,
          sourceDocumentDateText: existing.sourceDocumentDateText,
        },
        nextState: {
          title: typeof documentVersionUpdate.title === 'string' ? documentVersionUpdate.title : existing.title,
          sourceDocumentDate: link.sourceDocumentDate?.toISOString() ?? existing.sourceDocumentDate?.toISOString() ?? null,
          sourceDocumentDateText: link.sourceDocumentDateText ?? existing.sourceDocumentDateText,
        },
        correlationId,
        requestMetadata: {
          websiteSourceId,
          websiteScanId,
          sourceUrl: link.pdfUrl,
          listPage: link.listPage,
          packId: link.packId,
          refreshReason: 'duplicate_source_metadata',
        },
      },
    });
  });
}

function mergeCrawlerObjectMetadata(metadata: unknown, link: BotFipcsDocumentLink, websiteSourceId: string, websiteScanId: string): Prisma.InputJsonObject {
  const currentMetadata = toInputJsonObject(metadata);
  return {
    ...currentMetadata,
    pdfUrl: link.pdfUrl,
    listPage: link.listPage,
    packId: link.packId,
    websiteSourceId,
    websiteScanId,
    documentType: link.documentType,
    sourceDocumentDate: link.sourceDocumentDate?.toISOString() ?? null,
    sourceDocumentDateText: link.sourceDocumentDateText,
    statusText: link.statusText,
    language: link.language,
    relatedDocumentUrl: link.relatedDocumentUrl,
  };
}

function toInputJsonObject(value: unknown): Prisma.InputJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Prisma.InputJsonObject;
}

function isFallbackTitle(value: string) {
  return /^BOT FIPCS \d+$/i.test(value.trim());
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

async function resolveWebsiteSource(options: CrawlOptions) {
  if (options.sourceId) {
    const existingById = await prisma.websiteSource.findUnique({ where: { id: options.sourceId } });
    if (existingById) return existingById;
  }

  const existing = await prisma.websiteSource.findFirst({ where: { baseUrl: options.sourceUrl } });
  if (existing) return existing;

  return prisma.websiteSource.create({
    data: {
      name: 'BOT FIPCS Thai Notices',
      baseUrl: options.sourceUrl,
      domain: 'banking-regulation',
      scanConfig: {
        strategy: 'bot-fipcs',
        startPage: options.startPage,
        endPage: options.endPage ?? null,
        maxPages: options.endPage ? options.endPage - options.startPage + 1 : null,
        maxPagesCap: options.maxPagesCap,
        maxDocuments: options.maxDocuments ?? null,
      },
    },
  });
}

function parseOptions(): CrawlOptions {
  const sourceId = readArg('--source-id');
  const sourceUrl = readArg('--source-url') ?? 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx';
  const linksFile = readArg('--links-file');
  const startPage = readIntegerArg('--start-page', 1);
  const legacyMaxPages = readOptionalIntegerArg('--pages');
  const explicitEndPage = readOptionalIntegerArg('--end-page');
  const endPage = explicitEndPage ?? (legacyMaxPages ? startPage + legacyMaxPages - 1 : undefined);
  const maxPagesCap = readIntegerArg('--max-pages-cap', readIntegerEnv('CRAWLER_MAX_PAGES_CAP', 500));
  const maxDocuments = readOptionalIntegerArg('--max-documents');

  if (!linksFile) {
    if (endPage && endPage < startPage) {
      throw new Error('Crawler end page must be greater than or equal to the start page.');
    }
    if (startPage > maxPagesCap || (endPage && endPage > maxPagesCap)) {
      throw new Error(`Crawler page range exceeds the configured page cap of ${maxPagesCap}.`);
    }
  }

  return { sourceId, startPage, endPage, maxPagesCap, maxDocuments, sourceUrl, linksFile };
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

function dedupeLinks(links: BotFipcsDocumentLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.pdfUrl)) return false;
    seen.add(link.pdfUrl);
    return true;
  });
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

/**
 * Run Tesseract OCR (via ocrmypdf) on a PDF buffer.
 * Mirrors TesseractAdapter logic without requiring the NestJS DI container.
 * Returns the extracted text and the resulting OcrStatus.
 */
async function runTesseractOcr(
  pdfBuffer: Buffer,
  languages: string,
  timeoutMs: number,
): Promise<{ text: string; ocrStatus: OcrStatus }> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'docai-ocr-'));
  const inputPath = join(tmpDir, 'input.pdf');
  const outputPath = join(tmpDir, 'output.pdf');

  async function pdfToText(filePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'pdftotext',
        ['-enc', 'UTF-8', filePath, '-'],
        { timeout: 30_000, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
      );
      return stdout.replace(/\f/g, '\n').replace(/\u0000/g, '').replace(/[\uFFFD\u00AD]/g, '').normalize('NFC').trim();
    } catch {
      return '';
    }
  }

  try {
    await writeFile(inputPath, pdfBuffer);

    // Pre-scan: if the PDF already has readable Thai text, skip full OCR.
    const preScan = await pdfToText(inputPath);
    const thaiRatio = (preScan.match(/[ก-๙]/g) ?? []).length / Math.max(preScan.length, 1);
    if (thaiRatio >= 0.3 && preScan.trim()) {
      return { text: preScan, ocrStatus: OcrStatus.COMPLETED };
    }

    // Full visual OCR — force-ocr ignores any garbled embedded text layer.
    await execFileAsync(
      'ocrmypdf',
      [
        '--language', languages,
        '--output-type', 'pdf',
        '--force-ocr',
        '--rotate-pages',
        '--deskew',
        '--clean',
        '--optimize', '1',
        '--image-dpi', '300',
        inputPath,
        outputPath,
      ],
      { timeout: timeoutMs },
    );

    const ocrText = await pdfToText(outputPath);
    if (ocrText.trim()) {
      return { text: ocrText, ocrStatus: OcrStatus.COMPLETED };
    }
    // ocrmypdf succeeded but pdftotext found nothing; fall back to pre-scan.
    if (preScan.trim()) {
      return { text: preScan, ocrStatus: OcrStatus.PARTIAL };
    }
    return { text: '', ocrStatus: OcrStatus.FAILED };
  } catch {
    // ocrmypdf failed — fall back to whatever pdftotext got from the original.
    const fallback = await pdfToText(inputPath).catch(() => '');
    if (fallback.trim()) {
      return { text: fallback, ocrStatus: OcrStatus.PARTIAL };
    }
    return { text: '', ocrStatus: OcrStatus.FAILED };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
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