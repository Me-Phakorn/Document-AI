import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus, OcrStatus, StoredObjectLifecycleStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import { ObjectKeyService } from '../storage/object-key.service';
import { OcrEngineRegistry } from './ocr-engine.registry';

export interface OcrContext {
  actorId?: string;
  correlationId: string;
}

export interface RetriggerOcrResult {
  documentVersionId: string;
  ocrArtifactId: string;
  engine: string;
  status: OcrStatus;
  confidence: number;
  pageCount: number;
  textLength: number;
  warnings: string[];
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MinioStorageService) private readonly storage: MinioStorageService,
    @Inject(ObjectKeyService) private readonly objectKeys: ObjectKeyService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OcrEngineRegistry) private readonly registry: OcrEngineRegistry,
  ) {}

  /**
   * Run (or re-run) OCR for a document version using the configured engine.
   *
   * Idempotency: if the document version already has a COMPLETED OcrArtifact
   * from a non-pdf-parse engine AND `force` is false, this call is skipped.
   *
   * @throws NotFoundException  when the document version or its original PDF are not found.
   * @throws UnprocessableEntityException when OCR is not needed (e.g. already COMPLETED).
   */
  async retriggerOcr(
    documentVersionId: string,
    context: OcrContext,
    force = false,
  ): Promise<RetriggerOcrResult> {
    const docVersion = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: { document: true },
    });
    if (!docVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    if (!force) {
      const existingCompleted = await this.prisma.ocrArtifact.findFirst({
        where: {
          documentVersionId,
          status: OcrStatus.COMPLETED,
          engine: { not: { startsWith: 'pdf-parse' } },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingCompleted) {
        throw new UnprocessableEntityException({
          code: 'OCR_ALREADY_COMPLETED',
          message: 'A completed OCR artifact already exists. Pass force=true to override.',
          ocrArtifactId: existingCompleted.id,
        });
      }
    }

    // Locate the original PDF in object storage.
    const originalObject = await this.prisma.storedObject.findFirst({
      where: { ownerType: 'DocumentVersion', ownerId: documentVersionId, contentType: 'application/pdf' },
      orderBy: { createdAt: 'asc' },
    });
    if (!originalObject) {
      throw new NotFoundException({ code: 'ORIGINAL_PDF_NOT_FOUND', message: 'Original PDF object was not found in storage.' });
    }

    const pdfBuffer = await this.storage.getObjectBuffer(originalObject.bucket, originalObject.objectKey);

    const adapter = this.registry.getAdapter();
    const languages = this.config.get<string>('OCR_LANGUAGES', 'tha+eng').split('+');
    const timeoutMs = Number(this.config.get<string>('OCR_TIMEOUT_MS', '180000'));
    const engineLabel = this.registry.getEngineLabel();

    this.logger.log(`Starting OCR for ${documentVersionId} using ${engineLabel}`);

    const result = await adapter.run(pdfBuffer, { languages, timeoutMs });

    const ocrStatus = result.text
      ? result.warnings.length
        ? OcrStatus.PARTIAL
        : OcrStatus.COMPLETED
      : OcrStatus.FAILED;

    const documentStatus = ocrStatus === OcrStatus.COMPLETED
      ? DocumentStatus.OCR_COMPLETED
      : ocrStatus === OcrStatus.PARTIAL
      ? DocumentStatus.OCR_PARTIAL
      : DocumentStatus.OCR_FAILED;

    const ocrBucket = this.config.get<string>('MINIO_BUCKET_OCR', 'ocr');
    const ocrArtifactId = randomUUID();

    // Upload text artifact.
    const textBuffer = Buffer.from(result.text, 'utf8');
    const textSha256 = sha256Buffer(textBuffer);
    const textObjectKey = this.objectKeys.ocrText(ocrArtifactId);

    await this.storage.putObject({
      bucket: ocrBucket,
      objectKey: textObjectKey,
      content: textBuffer,
      contentType: 'text/plain; charset=utf-8',
      metadata: { 'x-amz-meta-sha256': textSha256 },
    });

    // Upload searchable PDF if produced.
    let searchablePdfObjectKey: string | undefined;
    let searchablePdfSha256: string | undefined;
    if (result.searchablePdfBuffer?.length) {
      searchablePdfObjectKey = this.objectKeys.ocrSearchablePdf(ocrArtifactId);
      searchablePdfSha256 = sha256Buffer(result.searchablePdfBuffer);
      await this.storage.putObject({
        bucket: ocrBucket,
        objectKey: searchablePdfObjectKey,
        content: result.searchablePdfBuffer,
        contentType: 'application/pdf',
        metadata: { 'x-amz-meta-sha256': searchablePdfSha256 },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const textObject = await tx.storedObject.create({
        data: {
          bucket: ocrBucket,
          objectKey: textObjectKey,
          fileName: `${documentVersionId}.txt`,
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
            bucket: ocrBucket,
            objectKey: searchablePdfObjectKey,
            fileName: `${documentVersionId}-searchable.pdf`,
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
          documentVersionId,
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
        where: { id: documentVersionId },
        data: { ocrStatus, status: documentStatus },
      });

      await tx.document.update({
        where: { id: docVersion.documentId },
        data: { status: documentStatus },
      });

      await this.audit.record(
        {
          actorId: context.actorId,
          actorType: context.actorId ? 'USER' : 'SYSTEM',
          action: 'DOCUMENT_OCR_RETRIGGERED',
          entityType: 'DocumentVersion',
          entityId: documentVersionId,
          previousState: { ocrStatus: docVersion.ocrStatus, status: docVersion.status },
          nextState: { ocrStatus, status: documentStatus, ocrArtifactId, engine: engineLabel },
          correlationId: context.correlationId,
        },
        tx,
      );
    });

    this.logger.log(
      `OCR complete for ${documentVersionId}: status=${ocrStatus}, confidence=${result.confidence.toFixed(3)}, textLength=${result.text.length}`,
    );

    return {
      documentVersionId,
      ocrArtifactId,
      engine: engineLabel,
      status: ocrStatus,
      confidence: result.confidence,
      pageCount: result.pageCount,
      textLength: result.text.length,
      warnings: result.warnings,
    };
  }
}

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
