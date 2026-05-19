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

    const promptTemplateVersion = await this.ensureDefaultPromptTemplateVersion(context.actorId);
    const renderedPrompt = this.renderRuleExtractionPrompt(documentVersion.title, ocrText);
    const renderedPromptHash = this.sha256(renderedPrompt);
    const promptInstance = await this.prisma.promptInstance.create({
      data: {
        promptTemplateVersionId: promptTemplateVersion.id,
        documentVersionId,
        renderedPromptHash,
        variables: { documentTitle: documentVersion.title, textLength: ocrText.length },
        provider: this.aiConfig.provider,
        model: this.aiConfig.model,
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
            requestMetadata: { documentVersionId, promptInstanceId: promptInstance.id, provider: completion.provider, model: completion.model },
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
            templateText: 'Extract regulatory rules from {{documentTitle}} and {{ocrText}}. Return JSON with outcome, summary, confidence, rules, and notRelevantReason.',
          },
        },
      },
      include: { versions: true },
    });

    return promptTemplate.versions[0];
  }

  private renderRuleExtractionPrompt(title: string, ocrText: string) {
    const trimmedText = ocrText.slice(0, 80_000);
    return `Document title: ${title}\n\nExtract compliance rules, prohibitions, conditions, citations, and risk levels from this source document. If the document is not relevant to compliance rule extraction, return outcome NOT_RELEVANT and explain why. Use this JSON shape exactly: {"outcome":"RULES_FOUND|NO_RULES_FOUND|NOT_RELEVANT","summary":"...","confidence":0.0,"rules":[{"ruleCode":"R-001","title":"...","description":"...","condition":"...","prohibition":"...","riskLevel":"HIGH|MEDIUM|LOW|INFO","sourceReferences":[{"page":1,"quote":"..."}]}],"notRelevantReason":"..."}.\n\nOCR text:\n${trimmedText}`;
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