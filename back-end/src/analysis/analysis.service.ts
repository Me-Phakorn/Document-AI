import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  AiAnalysisOutcome,
  AiAnalysisStatus,
  DocumentStatus,
  Prisma,
  PromptStatus,
  ReviewStatus,
  ReviewType,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MinioStorageService } from '../storage/minio-storage.service';
import { AiCompletionService } from './ai-completion.service';
import { AiConfigService } from './ai-config.service';

interface AnalysisContext {
  actorId?: string;
  correlationId: string;
  /** Reviewer comment from a rejected round — injected as a prefix in the AI prompt */
  reviewerComment?: string;
  /** Explicit round number for the new ReviewItem (defaults to 1 on first analysis) */
  roundNumber?: number;
}

interface ParsedAnalysisResult {
  outcome?: string;
  summary?: string;
  confidence?: number;
  rules?: Array<{
    ruleCode?: string;
    title?: string;
    description?: string;
    condition?: string;
    prohibition?: string;
    riskLevel?: string;
    sourceReferences?: unknown;
  }>;
  notRelevantReason?: string;
}

@Injectable()
export class AnalysisService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(MinioStorageService)
    private readonly storage: MinioStorageService,
    @Inject(AiCompletionService)
    private readonly aiCompletion: AiCompletionService,
    @Inject(AiConfigService)
    private readonly aiConfig: AiConfigService,
    @Inject(AuditService)
    private readonly audit: AuditService,
  ) {}

  async analyzeDocumentVersion(documentVersionId: string, context: AnalysisContext) {
    const documentVersion = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: { document: true, ocrArtifacts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!documentVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    const ocrArtifact = documentVersion.ocrArtifacts.find((artifact) => artifact.textObjectId);
    if (!ocrArtifact?.textObjectId) {
      throw new NotFoundException({ code: 'OCR_TEXT_NOT_FOUND', message: 'OCR text is required before AI analysis.' });
    }

    const textObject = await this.prisma.storedObject.findUnique({ where: { id: ocrArtifact.textObjectId } });
    if (!textObject) {
      throw new NotFoundException({ code: 'OCR_TEXT_OBJECT_NOT_FOUND', message: 'OCR text object metadata was not found.' });
    }

    const ocrText = await this.storage.readTextObject(textObject.bucket, textObject.objectKey);
    if (!ocrText.trim()) {
      throw new ServiceUnavailableException({ code: 'OCR_TEXT_EMPTY', message: 'OCR text is empty and cannot be analyzed.' });
    }

    const promptTemplateVersion = await this.getActivePromptTemplateVersion(context.actorId);
    const selectedModel = promptTemplateVersion.aiModel ?? this.aiConfig.model;
    const reviewerPrefix = context.reviewerComment
      ? `[RE-ANALYSIS — Round ${context.roundNumber ?? '?'}]\n\nPrevious round reviewer feedback:\n"${context.reviewerComment}"\n\nPlease re-analyse the document taking this feedback into account. The previous extraction was rejected for the reason above.\n\n---\n\n`
      : '';
    const renderedPrompt = reviewerPrefix + this.renderPromptTemplate(promptTemplateVersion.templateText, documentVersion.title, ocrText);
    const renderedPromptHash = this.sha256(renderedPrompt);
    const promptInstance = await this.prisma.promptInstance.create({
      data: {
        promptTemplateVersionId: promptTemplateVersion.id,
        documentVersionId,
        renderedPromptHash,
        variables: { documentTitle: documentVersion.title, textLength: ocrText.length },
        provider: this.aiConfig.provider,
        model: selectedModel,
      },
    });

    const aiResult = await this.prisma.aiAnalysisResult.create({
      data: {
        documentVersionId,
        promptInstanceId: promptInstance.id,
        status: AiAnalysisStatus.PROCESSING,
      },
    });

    await this.prisma.documentVersion.update({ where: { id: documentVersionId }, data: { status: DocumentStatus.AI_PROCESSING } });
    await this.prisma.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.AI_PROCESSING } });

    try {
      const startedAt = Date.now();
      const completion = await this.aiCompletion.createChatCompletion({
        correlationId: context.correlationId,
        model: selectedModel,
        responseFormatJson: true,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You extract Thai regulatory rules for compliance review. Return valid JSON only.' },
          { role: 'user', content: renderedPrompt },
        ],
      });
      const parsed = this.parseAnalysis(completion.content);
      const outcome = this.mapOutcome(parsed);
      const reviewType = outcome === AiAnalysisOutcome.NOT_RELEVANT ? ReviewType.NOT_RELEVANT : ReviewType.SOURCE_AI_RESULT;
      const resultPayload = this.buildResultPayload(parsed, completion.content, documentVersion, ocrArtifact.id);
      const updatedAiResult = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.aiAnalysisResult.update({
          where: { id: aiResult.id },
          data: {
            status: AiAnalysisStatus.COMPLETED,
            outcome,
            confidence: parsed.confidence ?? null,
            result: resultPayload,
            tokenUsage: completion.totalTokens,
            latencyMs: Date.now() - startedAt,
          },
        });

        await tx.reviewItem.create({
          data: {
            reviewType,
            status: ReviewStatus.PENDING,
            aiAnalysisResultId: saved.id,
            roundNumber: context.roundNumber ?? 1,
            comment: outcome === AiAnalysisOutcome.NOT_RELEVANT ? parsed.notRelevantReason ?? parsed.summary ?? 'AI marked this document as not relevant.' : null,
          },
        });

        await tx.documentVersion.update({ where: { id: documentVersionId }, data: { status: DocumentStatus.PENDING_REVIEW } });
        await tx.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.PENDING_REVIEW } });
        await this.audit.record(
          {
            actorId: context.actorId,
            action: 'DOCUMENT_AI_ANALYZED',
            entityType: 'AiAnalysisResult',
            entityId: saved.id,
            previousState: { status: AiAnalysisStatus.PROCESSING },
            nextState: { status: AiAnalysisStatus.COMPLETED, outcome, reviewType },
            correlationId: context.correlationId,
            requestMetadata: { documentVersionId, promptTemplateVersionId: promptTemplateVersion.id, promptInstanceId: promptInstance.id, provider: completion.provider, requestedModel: selectedModel, model: completion.model },
          },
          tx,
        );

        return saved;
      });

      return this.serializeAiResult(updatedAiResult);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      const failed = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.aiAnalysisResult.update({
          where: { id: aiResult.id },
          data: {
            status: AiAnalysisStatus.FAILED,
            outcome: AiAnalysisOutcome.FAILED,
            result: { failureReason },
          },
        });
        await tx.documentVersion.update({ where: { id: documentVersionId }, data: { status: DocumentStatus.FAILED } });
        await tx.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.FAILED } });
        await this.audit.record(
          {
            actorId: context.actorId,
            action: 'DOCUMENT_AI_ANALYSIS_FAILED',
            entityType: 'AiAnalysisResult',
            entityId: saved.id,
            previousState: { status: AiAnalysisStatus.PROCESSING },
            nextState: { status: AiAnalysisStatus.FAILED, failureReason },
            correlationId: context.correlationId,
            requestMetadata: { documentVersionId, promptInstanceId: promptInstance.id },
          },
          tx,
        );
        return saved;
      });

      return this.serializeAiResult(failed);
    }
  }

  /**
   * Validate that the document version has OCR, mark it AI_PENDING immediately, then
   * fire a re-analysis in the background with the reviewer comment injected into the prompt.
   * Returns immediately so the HTTP call does not block on the AI response.
   */
  async reReviewDocumentVersion(
    documentVersionId: string,
    reviewerComment: string,
    roundNumber: number,
    context: AnalysisContext,
  ): Promise<{ queued: true; documentVersionId: string; round: number }> {
    const documentVersion = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: { document: true, ocrArtifacts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!documentVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    const hasOcr = documentVersion.ocrArtifacts.some((a) => a.textObjectId);
    if (!hasOcr) {
      throw new NotFoundException({ code: 'OCR_TEXT_NOT_FOUND', message: 'OCR text is required before re-analysis.' });
    }

    // Mark as pending immediately so the UI reflects the state change right away
    await this.prisma.$transaction([
      this.prisma.documentVersion.update({ where: { id: documentVersionId }, data: { status: DocumentStatus.AI_PENDING } }),
      this.prisma.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.AI_PENDING } }),
    ]);

    // Fire the full analysis pipeline in the background
    void this.analyzeDocumentVersion(documentVersionId, {
      ...context,
      reviewerComment,
      roundNumber,
    }).catch((err: unknown) => {
      console.error(
        `[reReview] round ${roundNumber} failed for ${documentVersionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return { queued: true, documentVersionId, round: roundNumber };
  }

  async batchQueue(documentVersionIds: string[], context: AnalysisContext): Promise<{ queued: number; skipped: number }> {
    const versions = await this.prisma.documentVersion.findMany({
      where: {
        id: { in: documentVersionIds },
        status: { notIn: [DocumentStatus.AI_PROCESSING, DocumentStatus.AI_PENDING] },
      },
      select: { id: true, documentId: true },
    });

    if (versions.length === 0) {
      return { queued: 0, skipped: documentVersionIds.length };
    }

    // Mark all eligible documents as AI_PENDING immediately so the frontend sees state change
    await this.prisma.$transaction([
      this.prisma.documentVersion.updateMany({
        where: { id: { in: versions.map((v) => v.id) } },
        data: { status: DocumentStatus.AI_PENDING },
      }),
      this.prisma.document.updateMany({
        where: { id: { in: versions.map((v) => v.documentId) } },
        data: { status: DocumentStatus.AI_PENDING },
      }),
    ]);

    // Fire analysis for each in the background — intentionally not awaited
    const correlationId = context.correlationId;
    void Promise.allSettled(
      versions.map((v) =>
        this.analyzeDocumentVersion(v.id, { actorId: context.actorId, correlationId }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[batchQueue] analysis failed for ${v.id}: ${message}`);
        }),
      ),
    );

    return { queued: versions.length, skipped: documentVersionIds.length - versions.length };
  }

  async listResults(limit = 25, offset = 0) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiAnalysisResult.findMany({
        orderBy: { createdAt: 'desc' },
        skip: safeOffset,
        take: safeLimit,
        include: { documentVersion: { include: { document: true } }, reviews: { orderBy: { createdAt: 'desc' } } },
      }),
      this.prisma.aiAnalysisResult.count(),
    ]);

    return { items: items.map((item) => this.serializeAiResult(item)), total, limit: safeLimit, offset: safeOffset };
  }

  private async getActivePromptTemplateVersion(actorId?: string) {
    const activeVersions = await this.prisma.promptTemplateVersion.findMany({
      where: { status: PromptStatus.ACTIVE },
      include: { promptTemplate: true },
    });

    if (activeVersions.length) {
      return activeVersions.sort((left, right) => right.promptTemplate.updatedAt.getTime() - left.promptTemplate.updatedAt.getTime())[0];
    }

    return this.ensureDefaultPromptTemplateVersion(actorId);
  }

  private async ensureDefaultPromptTemplateVersion(actorId?: string) {
    const existing = await this.prisma.promptTemplateVersion.findFirst({
      where: { promptTemplate: { name: 'Default Regulatory Rule Extraction' }, status: PromptStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    const promptTemplate = await this.prisma.promptTemplate.create({
      data: {
        name: 'Default Regulatory Rule Extraction',
        domain: 'general-compliance',
        tags: ['rule-extraction', 'thai-regulation'],
        status: PromptStatus.ACTIVE,
        createdById: actorId,
        versions: {
          create: {
            versionNumber: 1,
            status: PromptStatus.ACTIVE,
            createdById: actorId,
            variables: ['documentTitle', 'ocrText'],
            aiProvider: this.aiConfig.provider,
            aiModel: this.aiConfig.model,
            templateText: 'Document title: {{documentTitle}}\n\nExtract compliance rules, prohibitions, conditions, citations, and risk levels from this source document. If the document is not relevant to compliance rule extraction, return outcome NOT_RELEVANT and explain why. Use this JSON shape exactly: {"outcome":"RULES_FOUND|NO_RULES_FOUND|NOT_RELEVANT","summary":"...","confidence":0.0,"rules":[{"ruleCode":"R-001","title":"...","description":"...","condition":"...","prohibition":"...","riskLevel":"HIGH|MEDIUM|LOW|INFO","sourceReferences":[{"page":1,"quote":"..."}]}],"notRelevantReason":"..."}.\n\nOCR text:\n{{ocrText}}',
          },
        },
      },
      include: { versions: true },
    });

    return promptTemplate.versions[0];
  }

  private renderPromptTemplate(templateText: string, title: string, ocrText: string) {
    const trimmedText = ocrText.slice(0, 80_000);
    const values: Record<string, string> = {
      documentTitle: title,
      ocrText: trimmedText,
      textLength: String(ocrText.length),
    };

    return templateText.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => values[key] ?? match);
  }

  private parseAnalysis(content: string): ParsedAnalysisResult {
    const trimmed = content.trim();
    const jsonText = trimmed.startsWith('```') ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim() : trimmed;
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('AI response JSON must be an object.');
      }

      return parsed as ParsedAnalysisResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      throw new Error(`AI response was not valid structured JSON: ${message}`);
    }
  }

  private mapOutcome(parsed: ParsedAnalysisResult) {
    const outcome = parsed.outcome?.toUpperCase();
    if (outcome === 'NOT_RELEVANT') return AiAnalysisOutcome.NOT_RELEVANT;
    if (outcome === 'NO_RULES_FOUND') return AiAnalysisOutcome.NO_RULES_FOUND;
    return parsed.rules?.length ? AiAnalysisOutcome.RULES_FOUND : AiAnalysisOutcome.NO_RULES_FOUND;
  }

  private buildResultPayload(parsed: ParsedAnalysisResult, rawContent: string, documentVersion: { id: string; title: string }, ocrArtifactId: string): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify({
      outcome: parsed.outcome ?? null,
      summary: parsed.summary ?? null,
      confidence: parsed.confidence ?? null,
      rules: parsed.rules ?? [],
      notRelevantReason: parsed.notRelevantReason ?? null,
      rawContent,
      source: { documentVersionId: documentVersion.id, title: documentVersion.title, ocrArtifactId },
    })) as Prisma.InputJsonValue;
  }

  private serializeAiResult<T extends { estimatedCost: Prisma.Decimal | null }>(item: T) {
    return JSON.parse(
      JSON.stringify(
        { ...item, estimatedCost: item.estimatedCost?.toString() ?? null },
        (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value),
      ),
    ) as T;
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}