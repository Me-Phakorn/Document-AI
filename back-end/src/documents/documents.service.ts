import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisStatus, DocumentStatus, OcrStatus, Prisma, StoredObjectLifecycleStatus } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import { ObjectKeyService } from '../storage/object-key.service';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

interface RegisterContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(ObjectKeyService)
    private readonly objectKeys: ObjectKeyService,
    @Inject(MinioStorageService)
    private readonly storage: MinioStorageService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.documentVersion.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { document: true },
      }),
      this.prisma.documentVersion.count(),
    ]);

    return { items: items.map((item) => this.serializeDocumentVersion(item)), total, limit, offset };
  }

  async getSummary() {
    const [totalDocuments, totalVersions, latestVersions, versionsByStatus, versionsByOcrStatus, aiResultsByStatus, latestScan] =
      await this.prisma.$transaction([
        this.prisma.document.count(),
        this.prisma.documentVersion.count(),
        this.prisma.documentVersion.count({ where: { isLatest: true } }),
        this.prisma.documentVersion.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: true }),
        this.prisma.documentVersion.groupBy({ by: ['ocrStatus'], orderBy: { ocrStatus: 'asc' }, _count: true }),
        this.prisma.aiAnalysisResult.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: true }),
        this.prisma.websiteScan.findFirst({ orderBy: { createdAt: 'desc' } }),
      ]);

    const statusCounts = Object.fromEntries(versionsByStatus.map((item) => [item.status, item._count]));
    const ocrCounts = Object.fromEntries(versionsByOcrStatus.map((item) => [item.ocrStatus, item._count]));
    const aiCounts = Object.fromEntries(aiResultsByStatus.map((item) => [item.status, item._count]));

    return {
      documents: {
        totalDocuments,
        totalVersions,
        latestVersions,
        uploaded: statusCounts[DocumentStatus.UPLOADED] ?? 0,
        ocrCompleted: statusCounts[DocumentStatus.OCR_COMPLETED] ?? 0,
        ocrFailed: statusCounts[DocumentStatus.OCR_FAILED] ?? 0,
        pendingReview: statusCounts[DocumentStatus.PENDING_REVIEW] ?? 0,
        approved: statusCounts[DocumentStatus.APPROVED] ?? 0,
        notRelevant: statusCounts[DocumentStatus.NOT_RELEVANT] ?? 0,
      },
      ocr: {
        completed: ocrCounts[OcrStatus.COMPLETED] ?? 0,
        partial: ocrCounts[OcrStatus.PARTIAL] ?? 0,
        failed: ocrCounts[OcrStatus.FAILED] ?? 0,
        pending: ocrCounts[OcrStatus.PENDING] ?? 0,
      },
      ai: {
        pending: aiCounts[AiAnalysisStatus.PENDING] ?? 0,
        processing: aiCounts[AiAnalysisStatus.PROCESSING] ?? 0,
        completed: aiCounts[AiAnalysisStatus.COMPLETED] ?? 0,
        failed: aiCounts[AiAnalysisStatus.FAILED] ?? 0,
      },
      latestScan,
    };
  }

  async getDetail(documentVersionId: string) {
    const documentVersion = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: {
        document: true,
        ocrArtifacts: { orderBy: { createdAt: 'desc' } },
        aiResults: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!documentVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    const ocrArtifactIds = documentVersion.ocrArtifacts.map((artifact) => artifact.id);
    const storedObjects = await this.prisma.storedObject.findMany({
      where: {
        OR: [
          { ownerType: 'DocumentVersion', ownerId: documentVersion.id },
          ...(ocrArtifactIds.length ? [{ ownerType: 'OcrArtifact', ownerId: { in: ocrArtifactIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      documentVersion: this.serializeDocumentVersion(documentVersion),
      storedObjects: storedObjects.map((item) => this.serializeStoredObject(item)),
    };
  }

  async getOcrText(documentVersionId: string) {
    const documentVersion = await this.prisma.documentVersion.findUnique({ where: { id: documentVersionId } });
    if (!documentVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    const ocrArtifact = await this.prisma.ocrArtifact.findFirst({
      where: { documentVersionId, textObjectId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    if (!ocrArtifact?.textObjectId) {
      throw new NotFoundException({ code: 'OCR_TEXT_NOT_FOUND', message: 'No OCR text artifact exists for this document version.' });
    }

    const textObject = await this.prisma.storedObject.findUnique({ where: { id: ocrArtifact.textObjectId } });
    if (!textObject) {
      throw new NotFoundException({ code: 'OCR_TEXT_OBJECT_NOT_FOUND', message: 'OCR text metadata was not found.' });
    }

    const text = await this.storage.readTextObject(textObject.bucket, textObject.objectKey);

    return {
      documentVersionId,
      ocrArtifact,
      textObject: this.serializeStoredObject(textObject),
      text,
      textLength: text.length,
    };
  }

  async register(dto: RegisterDocumentDto, context: RegisterContext) {
    const normalizedFileHash = dto.fileSha256.toLowerCase();
    const normalizedContentHash = dto.contentSha256?.toLowerCase();
    const sourceUrlHash = dto.sourceUrl ? this.sha256(dto.sourceUrl.trim()) : undefined;

    const duplicate = await this.findDuplicate(sourceUrlHash, normalizedFileHash, normalizedContentHash);
    if (duplicate && duplicate.fileSha256 === normalizedFileHash && duplicate.contentSha256 === normalizedContentHash) {
      return {
        outcome: 'DUPLICATE',
        reason: 'URL, file hash, or content hash already exists with the same content.',
        documentId: duplicate.documentId,
        documentVersionId: duplicate.id,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const existingLatestForUrl = sourceUrlHash
        ? await tx.documentVersion.findFirst({
            where: { sourceUrlHash, isLatest: true },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      if (existingLatestForUrl) {
        await tx.documentVersion.update({
          where: { id: existingLatestForUrl.id },
          data: { isLatest: false },
        });

        const nextVersion = await tx.documentVersion.create({
          data: {
            documentId: existingLatestForUrl.documentId,
            versionNumber: existingLatestForUrl.versionNumber + 1,
            title: dto.title,
            sourceUrl: dto.sourceUrl,
            sourceUrlHash,
            fileName: dto.fileName,
            mimeType: dto.mimeType,
            byteSize: dto.byteSize ? BigInt(dto.byteSize) : undefined,
            fileSha256: normalizedFileHash,
            contentSha256: normalizedContentHash,
            status: DocumentStatus.UPLOADED,
            previousVersionId: existingLatestForUrl.id,
          },
        });

        await tx.document.update({
          where: { id: existingLatestForUrl.documentId },
          data: { title: dto.title, domain: dto.domain, status: DocumentStatus.UPLOADED },
        });

        await this.audit.record(
          {
            actorId: context.actorId,
            action: 'DOCUMENT_VERSION_CREATED_FROM_CHANGED_SOURCE_URL',
            entityType: 'DocumentVersion',
            entityId: nextVersion.id,
            previousState: { documentVersionId: existingLatestForUrl.id, fileSha256: existingLatestForUrl.fileSha256 },
            nextState: { documentVersionId: nextVersion.id, fileSha256: normalizedFileHash },
            correlationId: context.correlationId,
          },
          tx,
        );

        return {
          outcome: 'NEW_VERSION',
          documentId: nextVersion.documentId,
          documentVersionId: nextVersion.id,
          objectKey: this.objectKeys.documentOriginal({
            documentId: nextVersion.documentId,
            documentVersionId: nextVersion.id,
          }),
        };
      }

      const document = await tx.document.create({
        data: {
          title: dto.title,
          domain: dto.domain,
          sourceType: dto.sourceType,
          status: DocumentStatus.UPLOADED,
          ownerId: context.actorId,
        },
      });

      const documentVersion = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          title: dto.title,
          sourceUrl: dto.sourceUrl,
          sourceUrlHash,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          byteSize: dto.byteSize ? BigInt(dto.byteSize) : undefined,
          fileSha256: normalizedFileHash,
          contentSha256: normalizedContentHash,
          status: DocumentStatus.UPLOADED,
        },
      });

      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'DOCUMENT_REGISTERED',
          entityType: 'Document',
          entityId: document.id,
          nextState: { documentId: document.id, documentVersionId: documentVersion.id, status: DocumentStatus.UPLOADED },
          correlationId: context.correlationId,
        },
        tx,
      );

      return {
        outcome: 'CREATED',
        documentId: document.id,
        documentVersionId: documentVersion.id,
        objectKey: this.objectKeys.documentOriginal({
          documentId: document.id,
          documentVersionId: documentVersion.id,
        }),
      };
    });
  }

  async upload(dto: UploadDocumentDto, context: RegisterContext) {
    const pdfBuffer = this.decodeBase64(dto.contentBase64);
    if (!pdfBuffer.length) {
      throw new BadRequestException({ code: 'EMPTY_UPLOAD', message: 'Uploaded PDF content is empty.' });
    }

    const mimeType = dto.mimeType ?? 'application/pdf';
    if (mimeType !== 'application/pdf' && !dto.fileName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException({ code: 'UNSUPPORTED_DOCUMENT_TYPE', message: 'Only PDF uploads are currently accepted.' });
    }

    const fileSha256 = this.sha256Buffer(pdfBuffer);
    const extracted = await this.extractPdfText(pdfBuffer);
    const normalizedText = this.normalizeText(extracted.text);
    const textBuffer = Buffer.from(normalizedText, 'utf8');
    const contentSha256 = normalizedText ? this.sha256(normalizedText) : undefined;
    const sourceUrlHash = dto.sourceUrl ? this.sha256(dto.sourceUrl.trim()) : undefined;
    const existingByUrl = sourceUrlHash ? await this.prisma.documentVersion.findFirst({ where: { sourceUrlHash, isLatest: true } }) : null;

    if (existingByUrl?.fileSha256 === fileSha256) {
      return { outcome: 'DUPLICATE', reason: 'The source URL already points to the same PDF content.', documentId: existingByUrl.documentId, documentVersionId: existingByUrl.id };
    }

    const existingByFile = await this.prisma.documentVersion.findFirst({ where: { fileSha256 } });
    const existingByContent = contentSha256 ? await this.prisma.documentVersion.findFirst({ where: { contentSha256 } }) : null;
    if (!existingByUrl && (existingByFile || existingByContent)) {
      const duplicate = existingByFile ?? existingByContent;
      return { outcome: 'DUPLICATE', reason: 'A PDF with the same binary or extracted content hash already exists.', documentId: duplicate?.documentId, documentVersionId: duplicate?.id };
    }

    const documentId = existingByUrl?.documentId ?? randomUUID();
    const documentVersionId = randomUUID();
    const ocrArtifactId = randomUUID();
    const extension = extname(dto.fileName).replace(/^\./, '') || 'pdf';
    const originalObjectKey = this.objectKeys.documentOriginal({ documentId, documentVersionId, extension });
    const textObjectKey = this.objectKeys.ocrText(ocrArtifactId);
    const documentsBucket = this.config.get<string>('MINIO_BUCKET_DOCUMENTS', 'documents');
    const ocrBucket = this.config.get<string>('MINIO_BUCKET_OCR', 'ocr');
    const textSha256 = this.sha256Buffer(textBuffer);
    const ocrStatus = normalizedText ? OcrStatus.COMPLETED : OcrStatus.FAILED;
    const documentStatus = normalizedText ? DocumentStatus.OCR_COMPLETED : DocumentStatus.OCR_FAILED;

    await this.storage.putObject({
      bucket: documentsBucket,
      objectKey: originalObjectKey,
      content: pdfBuffer,
      contentType: 'application/pdf',
      metadata: { 'x-amz-meta-sha256': fileSha256 },
    });
    await this.storage.putObject({
      bucket: ocrBucket,
      objectKey: textObjectKey,
      content: textBuffer,
      contentType: 'text/plain; charset=utf-8',
      metadata: { 'x-amz-meta-sha256': textSha256 },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      let versionNumber = 1;
      let previousVersionId: string | undefined;

      if (existingByUrl) {
        versionNumber = existingByUrl.versionNumber + 1;
        previousVersionId = existingByUrl.id;
        await tx.documentVersion.update({ where: { id: existingByUrl.id }, data: { isLatest: false } });
        await tx.document.update({ where: { id: existingByUrl.documentId }, data: { title: dto.title, domain: dto.domain, status: documentStatus } });
      } else {
        await tx.document.create({
          data: {
            id: documentId,
            title: dto.title,
            domain: dto.domain,
            sourceType: dto.sourceType,
            status: documentStatus,
            ownerId: context.actorId,
          },
        });
      }

      const documentVersion = await tx.documentVersion.create({
        data: {
          id: documentVersionId,
          documentId,
          versionNumber,
          title: dto.title,
          sourceUrl: dto.sourceUrl,
          sourceUrlHash,
          fileName: basename(dto.fileName),
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
          bucket: documentsBucket,
          objectKey: originalObjectKey,
          fileName: basename(dto.fileName),
          contentType: 'application/pdf',
          byteSize: BigInt(pdfBuffer.byteLength),
          sha256: fileSha256,
          ownerType: 'DocumentVersion',
          ownerId: documentVersionId,
          lifecycleStatus: StoredObjectLifecycleStatus.CURRENT,
          metadata: { sourceUrl: dto.sourceUrl ?? null, uploadMode: 'admin_base64_pdf' },
        },
      });

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
          metadata: { extractionMode: 'native_pdf_text', sourceObjectId: originalObject.id, pageCount: extracted.pageCount },
        },
      });

      const ocrArtifact = await tx.ocrArtifact.create({
        data: {
          id: ocrArtifactId,
          documentVersionId,
          engine: this.config.get<string>('OCR_ENGINE', 'pdf-parse-native-text'),
          status: ocrStatus,
          aggregateConfidence: normalizedText ? this.estimateTextQuality(normalizedText) : 0,
          minPageConfidence: normalizedText ? this.estimateTextQuality(normalizedText) : 0,
          pageCount: extracted.pageCount,
          failedPages: normalizedText ? [] : Array.from({ length: extracted.pageCount }, (_, index) => index + 1),
          warnings: normalizedText ? [] : ['No extractable text found; image OCR engine is required for scanned PDF.'],
          textObjectId: textObject.id,
        },
      });

      await this.audit.record(
        {
          actorId: context.actorId,
          action: existingByUrl ? 'DOCUMENT_VERSION_UPLOADED_FROM_CHANGED_SOURCE_URL' : 'DOCUMENT_UPLOADED',
          entityType: 'DocumentVersion',
          entityId: documentVersion.id,
          previousState: existingByUrl ? { documentVersionId: existingByUrl.id, fileSha256: existingByUrl.fileSha256 } : undefined,
          nextState: { documentId, documentVersionId, status: documentStatus, ocrStatus, originalObjectId: originalObject.id, textObjectId: textObject.id },
          correlationId: context.correlationId,
          requestMetadata: { sourceUrl: dto.sourceUrl ?? null, fileName: dto.fileName },
        },
        tx,
      );

      return { documentVersion, originalObject, textObject, ocrArtifact };
    });

    return {
      outcome: existingByUrl ? 'NEW_VERSION' : 'CREATED',
      documentId,
      documentVersionId,
      status: documentStatus,
      ocrStatus,
      documentVersion: this.serializeDocumentVersion(result.documentVersion),
      storedObjects: [this.serializeStoredObject(result.originalObject), this.serializeStoredObject(result.textObject)],
      ocrArtifact: result.ocrArtifact,
    };
  }

  private async findDuplicate(sourceUrlHash?: string, fileSha256?: string, contentSha256?: string) {
    const filters: Prisma.DocumentVersionWhereInput[] = [];
    if (sourceUrlHash) filters.push({ sourceUrlHash });
    if (fileSha256) filters.push({ fileSha256 });
    if (contentSha256) filters.push({ contentSha256 });
    if (!filters.length) return null;

    return this.prisma.documentVersion.findFirst({
      where: { OR: filters },
      orderBy: { createdAt: 'desc' },
    });
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }

  private sha256Buffer(input: Buffer) {
    return createHash('sha256').update(input).digest('hex');
  }

  private decodeBase64(value: string) {
    const normalized = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
    return Buffer.from(normalized, 'base64');
  }

  private async extractPdfText(buffer: Buffer) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { pageCount: result.total || result.pages?.length || 0, text: result.text || '' };
    } finally {
      await parser.destroy();
    }
  }

  private normalizeText(value: string) {
    return value.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private estimateTextQuality(text: string) {
    const thaiCharacters = text.match(/[ก-๙]/g)?.length ?? 0;
    const quality = Math.min(0.99, Math.max(0.25, (text.length > 500 ? 0.82 : 0.55) + Math.min(0.12, thaiCharacters / Math.max(text.length, 1))));
    return Number(quality.toFixed(2));
  }

  private serializeDocumentVersion<T extends { byteSize: bigint | null }>(item: T) {
    return {
      ...item,
      byteSize: item.byteSize?.toString() ?? null,
    };
  }

  private serializeStoredObject<T extends { byteSize: bigint }>(item: T) {
    return {
      ...item,
      byteSize: item.byteSize.toString(),
    };
  }
}