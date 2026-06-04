/**
 * Standalone OCR retry script — re-processes documents that previously failed OCR.
 *
 * Usage:
 *   pnpm --filter @docai/back-end ocr:retry-failed
 *   pnpm --filter @docai/back-end ocr:retry-failed -- --document-version-id=<uuid>
 *   pnpm --filter @docai/back-end ocr:retry-failed -- --force
 *
 * Environment variables (read from .env or inherited):
 *   DATABASE_URL, MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
 *   MINIO_USE_SSL, MINIO_BUCKET_DOCUMENTS, MINIO_BUCKET_OCR,
 *   OCR_ENGINE        (tesseract | paddleocr | google-vision — default: tesseract)
 *   OCR_LANGUAGES     (default: tha+eng)
 *   OCR_TIMEOUT_MS    (default: 180000)
 *   PADDLEOCR_URL     (required when OCR_ENGINE=paddleocr)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentStatus, OcrStatus, PrismaClient, StoredObjectLifecycleStatus } from '@prisma/client';
import { Client as MinioClient } from 'minio';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { CloudVisionAdapter } from '../adapters/cloud-vision.adapter';
import { PaddleOcrAdapter } from '../adapters/paddleocr.adapter';
import { TesseractAdapter } from '../adapters/tesseract.adapter';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

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
  documents: process.env['MINIO_BUCKET_DOCUMENTS'] || 'documents',
  ocr: process.env['MINIO_BUCKET_OCR'] || 'ocr',
};

// ── CLI options ───────────────────────────────────────────────────────────────

interface RetryOptions {
  documentVersionId?: string;
  force: boolean;
  engine: string;
  languages: string[];
  timeoutMs: number;
}

function parseOptions(): RetryOptions {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const get = (key: string) => {
    const prefix = `--${key}=`;
    const entry = args.find((a) => a.startsWith(prefix));
    return entry?.slice(prefix.length);
  };
  const has = (key: string) => args.includes(`--${key}`);
  return {
    documentVersionId: get('document-version-id'),
    force: has('force'),
    engine: get('engine') ?? process.env['OCR_ENGINE'] ?? 'tesseract',
    languages: (get('languages') ?? process.env['OCR_LANGUAGES'] ?? 'tha+eng').split('+'),
    timeoutMs: readIntegerEnv('OCR_TIMEOUT_MS', 180_000),
  };
}

// ── Adapter factory (no NestJS DI needed) ────────────────────────────────────

// Minimal ConfigService shim — adapters read env via this interface.
const configShim = {
  get: <T = string>(key: string, fallback?: T): T =>
    ((process.env[key] as unknown as T) ?? fallback) as T,
};

function buildAdapter(engine: string) {
  switch (engine) {
    case 'paddleocr':
      return new PaddleOcrAdapter(configShim as never);
    case 'google-vision':
      return new CloudVisionAdapter(configShim as never);
    case 'tesseract':
    default:
      return new TesseractAdapter();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseOptions();
  const adapter = buildAdapter(options.engine);
  const engineLabel = `${adapter.engineId}@${options.languages.join('+')}`;
  const correlationId = process.env['X_CORRELATION_ID'] ?? randomUUID();

  console.log(`[ocr:retry-failed] engine=${engineLabel}, force=${options.force}, correlationId=${correlationId}`);

  let targets: Array<{ id: string; documentId: string; ocrStatus: OcrStatus; status: DocumentStatus }>;

  if (options.documentVersionId) {
    const dv = await prisma.documentVersion.findUnique({
      where: { id: options.documentVersionId },
      select: { id: true, documentId: true, ocrStatus: true, status: true },
    });
    if (!dv) {
      console.error(`[ocr:retry-failed] Document version ${options.documentVersionId} not found.`);
      process.exit(1);
    }
    targets = [dv];
  } else {
    targets = await prisma.documentVersion.findMany({
      where: { isLatest: true, ocrStatus: OcrStatus.FAILED },
      select: { id: true, documentId: true, ocrStatus: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`[ocr:retry-failed] Found ${targets.length} OCR_FAILED documents.`);
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const wasProcessed = await retryOne(target, adapter, engineLabel, options, correlationId);
      if (wasProcessed) {
        processed += 1;
        console.log(`[ocr:retry-failed] ✓ ${target.id}`);
      } else {
        skipped += 1;
        console.log(`[ocr:retry-failed] ~ skipped ${target.id} (already completed, pass --force to override)`);
      }
    } catch (err) {
      failed += 1;
      console.error(`[ocr:retry-failed] ✗ ${target.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[ocr:retry-failed] done — processed=${processed}, skipped=${skipped}, failed=${failed}`);
}

async function retryOne(
  target: { id: string; documentId: string; ocrStatus: OcrStatus; status: DocumentStatus },
  adapter: TesseractAdapter | PaddleOcrAdapter | CloudVisionAdapter,
  engineLabel: string,
  options: RetryOptions,
  correlationId: string,
): Promise<boolean> {
  // Idempotency: skip if a non-pdf-parse COMPLETED artifact already exists.
  if (!options.force) {
    const existing = await prisma.ocrArtifact.findFirst({
      where: {
        documentVersionId: target.id,
        status: OcrStatus.COMPLETED,
        engine: { not: { startsWith: 'pdf-parse' } },
      },
    });
    if (existing) return false;
  }

  // Find original PDF stored object.
  const originalObject = await prisma.storedObject.findFirst({
    where: { ownerType: 'DocumentVersion', ownerId: target.id, contentType: 'application/pdf' },
    orderBy: { createdAt: 'asc' },
  });
  if (!originalObject) {
    throw new Error(`Original PDF StoredObject not found for documentVersionId=${target.id}`);
  }

  // Download PDF from MinIO.
  const pdfBuffer = await getObjectBuffer(originalObject.bucket, originalObject.objectKey);

  // Run OCR.
  const result = await adapter.run(pdfBuffer, { languages: options.languages, timeoutMs: options.timeoutMs });

  const ocrStatus = result.text
    ? result.warnings.length
      ? OcrStatus.PARTIAL
      : OcrStatus.COMPLETED
    : OcrStatus.FAILED;

  const documentStatus: DocumentStatus =
    ocrStatus === OcrStatus.COMPLETED
      ? DocumentStatus.OCR_COMPLETED
      : ocrStatus === OcrStatus.PARTIAL
      ? DocumentStatus.OCR_PARTIAL
      : DocumentStatus.OCR_FAILED;

  // Upload text artifact.
  const ocrArtifactId = randomUUID();
  const textBuffer = Buffer.from(result.text, 'utf8');
  const textSha256 = sha256Buffer(textBuffer);
  const textObjectKey = `ocr/${ocrArtifactId}/text/ocr.txt`;

  await ensureBucket(buckets.ocr);
  await minio.putObject(buckets.ocr, textObjectKey, textBuffer, textBuffer.byteLength, {
    'Content-Type': 'text/plain; charset=utf-8',
    'x-amz-meta-sha256': textSha256,
  });

  // Upload searchable PDF artifact if produced.
  let searchablePdfObjectKey: string | undefined;
  let searchablePdfSha256: string | undefined;
  if (result.searchablePdfBuffer?.length) {
    searchablePdfObjectKey = `ocr/${ocrArtifactId}/searchable/ocr.pdf`;
    searchablePdfSha256 = sha256Buffer(result.searchablePdfBuffer);
    await minio.putObject(
      buckets.ocr,
      searchablePdfObjectKey,
      result.searchablePdfBuffer,
      result.searchablePdfBuffer.byteLength,
      { 'Content-Type': 'application/pdf', 'x-amz-meta-sha256': searchablePdfSha256 },
    );
  }

  // Persist artifacts and update document state in a transaction.
  await prisma.$transaction(async (tx) => {
    const textObject = await tx.storedObject.create({
      data: {
        bucket: buckets.ocr,
        objectKey: textObjectKey,
        fileName: `${target.id}.txt`,
        contentType: 'text/plain; charset=utf-8',
        byteSize: BigInt(textBuffer.byteLength),
        sha256: textSha256,
        ownerType: 'OcrArtifact',
        ownerId: ocrArtifactId,
        lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
        metadata: {
          extractionMode: engineLabel,
          sourceObjectId: originalObject.id,
          pageCount: result.pageCount,
        },
      },
    });

    let searchableObjectId: string | undefined;
    if (searchablePdfObjectKey && result.searchablePdfBuffer && searchablePdfSha256) {
      const searchableObject = await tx.storedObject.create({
        data: {
          bucket: buckets.ocr,
          objectKey: searchablePdfObjectKey,
          fileName: `${target.id}-searchable.pdf`,
          contentType: 'application/pdf',
          byteSize: BigInt(result.searchablePdfBuffer.byteLength),
          sha256: searchablePdfSha256,
          ownerType: 'OcrArtifact',
          ownerId: ocrArtifactId,
          lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
          metadata: { extractionMode: engineLabel, sourceObjectId: originalObject.id },
        },
      });
      searchableObjectId = searchableObject.id;
    }

    await tx.ocrArtifact.create({
      data: {
        id: ocrArtifactId,
        documentVersionId: target.id,
        engine: engineLabel,
        status: ocrStatus,
        aggregateConfidence: result.confidence,
        minPageConfidence: result.confidence,
        pageCount: result.pageCount,
        failedPages: [],
        warnings: result.warnings,
        textObjectId: textObject.id,
        searchableObjectId: searchableObjectId ?? null,
      },
    });

    await tx.documentVersion.update({
      where: { id: target.id },
      data: { ocrStatus, status: documentStatus },
    });

    await tx.document.update({
      where: { id: target.documentId },
      data: { status: documentStatus },
    });

    await tx.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'DOCUMENT_OCR_RETRIGGERED',
        entityType: 'DocumentVersion',
        entityId: target.id,
        previousState: { ocrStatus: target.ocrStatus, status: target.status },
        nextState: { ocrStatus, status: documentStatus, ocrArtifactId, engine: engineLabel },
        correlationId,
        requestMetadata: { script: 'ocr:retry-failed', engine: engineLabel },
      },
    });
  });

  return true;
}

// ── MinIO helpers ─────────────────────────────────────────────────────────────

async function ensureBucket(bucket: string) {
  const exists = await minio.bucketExists(bucket).catch(() => false);
  if (!exists) await minio.makeBucket(bucket);
}

async function getObjectBuffer(bucket: string, objectKey: string): Promise<Buffer> {
  const stream = await minio.getObject(bucket, objectKey);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    (stream as Readable).on('data', (chunk: Buffer) => chunks.push(chunk));
    (stream as Readable).on('error', reject);
    (stream as Readable).on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

// ── Env helpers (matches import-bot-fipcs.ts pattern) ────────────────────────

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

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function readIntegerEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

// ── Entry point ───────────────────────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ocr:retry-failed] Fatal error:', err);
    process.exit(1);
  });
