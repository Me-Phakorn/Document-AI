import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, Prisma, ReviewOutcome, ReviewStatus, ReviewType, RiskLevel, RulebookStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AnalysisService } from '../analysis/analysis.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

interface ReviewContext {
  actorId?: string;
  correlationId: string;
}

interface ExtractedRule {
  ruleCode?: string;
  title?: string;
  description?: string;
  condition?: string;
  prohibition?: string;
  riskLevel?: string;
  sourceReferences?: unknown;
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AnalysisService) private readonly analysisService: AnalysisService,
  ) {}

  async list(query: PaginationQueryDto, documentId?: string) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 500);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const where: Prisma.ReviewItemWhereInput = documentId
      ? { aiAnalysisResult: { documentVersion: { documentId } } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reviewItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          aiAnalysisResult: { include: { documentVersion: { include: { document: true } } } },
          complianceCheck: { include: { results: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        },
      }),
      this.prisma.reviewItem.count({ where }),
    ]);

    return { items: items.map((item) => this.serializeReviewItem(item)), total, limit, offset };
  }

  async approve(reviewItemId: string, comment: string | undefined, context: ReviewContext) {
    const reviewItem = await this.getReviewItem(reviewItemId);
    if (!reviewItem.aiAnalysisResult?.documentVersion) {
      throw new BadRequestException({ code: 'REVIEW_ITEM_NOT_RULE_EXTRACTION', message: 'Only AI rule extraction review items can be approved into a rulebook.' });
    }

    const aiAnalysisResult = reviewItem.aiAnalysisResult;
    const documentVersion = aiAnalysisResult.documentVersion;
    const document = documentVersion.document;
    if (reviewItem.reviewType === ReviewType.NOT_RELEVANT) {
      return this.confirmNotRelevant(reviewItemId, comment, context);
    }

    const rules = this.extractRules(reviewItem.aiAnalysisResult.result);
    if (!rules.length) {
      throw new BadRequestException({ code: 'NO_RULES_TO_APPROVE', message: 'The AI result does not contain extracted rules.' });
    }

    const domain = document.domain ?? 'general-compliance';
    return this.prisma.$transaction(async (tx) => {
      const rulebook =
        (await tx.masterRulebook.findFirst({ where: { domain }, orderBy: { createdAt: 'asc' } })) ??
        (await tx.masterRulebook.create({ data: { title: `${domain} Master Rulebook`, domain, ownerId: context.actorId } }));
      const latestVersion = await tx.masterRulebookVersion.findFirst({ where: { masterRulebookId: rulebook.id }, orderBy: { versionNumber: 'desc' } });
      const rulebookVersion = await tx.masterRulebookVersion.create({
        data: {
          masterRulebookId: rulebook.id,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          status: RulebookStatus.APPROVED,
          approvedById: context.actorId,
          approvedAt: new Date(),
          rules: {
            create: rules.map((rule, index) => ({
              ruleCode: this.cleanRuleCode(rule.ruleCode, index),
              title: rule.title?.slice(0, 300) || `Extracted rule ${index + 1}`,
              description: rule.description || rule.title || 'Rule extracted from approved AI analysis.',
              condition: rule.condition,
              prohibition: rule.prohibition,
              riskLevel: this.toRiskLevel(rule.riskLevel),
              sourceReferences: [
                  { documentVersionId: documentVersion.id, aiAnalysisResultId: aiAnalysisResult.id, documentTitle: document.title, documentId: document.id },
                  ...(Array.isArray(rule.sourceReferences) ? (rule.sourceReferences as Prisma.InputJsonValue[]) : []),
                ],
            })),
          },
        },
        include: { rules: true, masterRulebook: true },
      });

      await tx.reviewItem.update({
        where: { id: reviewItemId },
        data: { status: ReviewStatus.APPROVED, outcome: ReviewOutcome.APPROVED, comment, reviewerId: context.actorId, decidedAt: new Date() },
      });
      await tx.documentVersion.update({ where: { id: documentVersion.id }, data: { status: DocumentStatus.APPROVED } });
      await tx.document.update({ where: { id: document.id }, data: { status: DocumentStatus.APPROVED } });
      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'AI_RESULT_APPROVED_RULEBOOK_VERSION_CREATED',
          entityType: 'MasterRulebookVersion',
          entityId: rulebookVersion.id,
          previousState: { reviewItemId, aiAnalysisResultId: aiAnalysisResult.id },
          nextState: { masterRulebookId: rulebook.id, rulebookVersionId: rulebookVersion.id, rules: rulebookVersion.rules.length, status: rulebookVersion.status },
          correlationId: context.correlationId,
          reason: comment,
        },
        tx,
      );

      return rulebookVersion;
    });
  }

  async reReviewFromRejected(reviewItemId: string, context: ReviewContext) {
    const reviewItem = await this.getReviewItem(reviewItemId);

    if (reviewItem.status !== ReviewStatus.REQUEST_CHANGES) {
      throw new BadRequestException({
        code: 'REVIEW_ITEM_NOT_REJECTED',
        message: 'Only review items with status REQUEST_CHANGES can be re-reviewed.',
      });
    }

    const documentVersion = reviewItem.aiAnalysisResult?.documentVersion;
    if (!documentVersion) {
      throw new BadRequestException({
        code: 'REVIEW_ITEM_NO_DOCUMENT',
        message: 'Review item is not linked to a document version.',
      });
    }

    if (!reviewItem.comment?.trim()) {
      throw new BadRequestException({
        code: 'REVIEWER_COMMENT_REQUIRED',
        message: 'A reviewer comment must exist on the rejected review item before re-review can be triggered.',
      });
    }

    // Mark old review item as superseded so it leaves the "request changes" queue
    await this.prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: { status: ReviewStatus.REJECTED },
    });

    return this.analysisService.reReviewDocumentVersion(
      documentVersion.id,
      reviewItem.comment,
      reviewItem.roundNumber + 1,
      { actorId: context.actorId, correlationId: context.correlationId },
    );
  }

  async requestChanges(reviewItemId: string, comment: string | undefined, context: ReviewContext) {
    if (!comment?.trim()) {
      throw new BadRequestException({ code: 'COMMENT_REQUIRED', message: 'A reviewer comment is required when requesting changes.' });
    }
    const reviewItem = await this.getReviewItem(reviewItemId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reviewItem.update({
        where: { id: reviewItemId },
        data: { status: ReviewStatus.REQUEST_CHANGES, outcome: ReviewOutcome.CHANGES_REQUESTED, comment, reviewerId: context.actorId, decidedAt: new Date() },
      });
      const documentVersion = reviewItem.aiAnalysisResult?.documentVersion;
      if (documentVersion) {
        await tx.documentVersion.update({ where: { id: documentVersion.id }, data: { status: DocumentStatus.REJECTED } });
        await tx.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.REJECTED } });
      }
      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'REVIEW_CHANGES_REQUESTED',
          entityType: 'ReviewItem',
          entityId: updated.id,
          previousState: { status: reviewItem.status },
          nextState: { status: updated.status, outcome: updated.outcome },
          correlationId: context.correlationId,
          reason: comment,
        },
        tx,
      );
      return updated;
    });
  }

  async confirmNotRelevant(reviewItemId: string, comment: string | undefined, context: ReviewContext) {
    const reviewItem = await this.getReviewItem(reviewItemId);
    const documentVersion = reviewItem.aiAnalysisResult?.documentVersion;
    if (!documentVersion) {
      throw new BadRequestException({ code: 'REVIEW_ITEM_HAS_NO_DOCUMENT', message: 'Review item is not linked to a document version.' });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reviewItem.update({
        where: { id: reviewItemId },
        data: { status: ReviewStatus.APPROVED, outcome: ReviewOutcome.CONFIRMED_NOT_RELEVANT, comment, reviewerId: context.actorId, decidedAt: new Date() },
      });
      await tx.documentVersion.update({ where: { id: documentVersion.id }, data: { status: DocumentStatus.NOT_RELEVANT } });
      await tx.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.NOT_RELEVANT } });
      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'DOCUMENT_CONFIRMED_NOT_RELEVANT',
          entityType: 'DocumentVersion',
          entityId: documentVersion.id,
          previousState: { reviewItemId, status: documentVersion.status },
          nextState: { status: DocumentStatus.NOT_RELEVANT },
          correlationId: context.correlationId,
          reason: comment,
        },
        tx,
      );
      return updated;
    });
  }

  async markDocumentVersionNotRelevant(documentVersionId: string, comment: string | undefined, context: ReviewContext) {
    const documentVersion = await this.prisma.documentVersion.findUnique({ where: { id: documentVersionId } });
    if (!documentVersion) {
      throw new NotFoundException({ code: 'DOCUMENT_VERSION_NOT_FOUND', message: 'Document version was not found.' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.update({ where: { id: documentVersionId }, data: { status: DocumentStatus.NOT_RELEVANT } });
      await tx.document.update({ where: { id: documentVersion.documentId }, data: { status: DocumentStatus.NOT_RELEVANT } });
      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'DOCUMENT_MARKED_NOT_RELEVANT_WITHOUT_AI',
          entityType: 'DocumentVersion',
          entityId: documentVersionId,
          previousState: { status: documentVersion.status },
          nextState: { status: DocumentStatus.NOT_RELEVANT },
          correlationId: context.correlationId,
          reason: comment,
        },
        tx,
      );
      return { documentVersionId, status: DocumentStatus.NOT_RELEVANT };
    });
  }

  private async getReviewItem(reviewItemId: string) {
    const reviewItem = await this.prisma.reviewItem.findUnique({
      where: { id: reviewItemId },
      include: { aiAnalysisResult: { include: { documentVersion: { include: { document: true } } } } },
    });
    if (!reviewItem) {
      throw new NotFoundException({ code: 'REVIEW_ITEM_NOT_FOUND', message: 'Review item was not found.' });
    }
    return reviewItem;
  }

  private extractRules(result: Prisma.JsonValue): ExtractedRule[] {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
    const rules = (result as { rules?: unknown }).rules;
    return Array.isArray(rules) ? (rules.filter((rule) => rule && typeof rule === 'object') as ExtractedRule[]) : [];
  }

  private toRiskLevel(value: string | undefined) {
    const normalized = value?.toUpperCase();
    return normalized && normalized in RiskLevel ? RiskLevel[normalized as keyof typeof RiskLevel] : RiskLevel.INFO;
  }

  private cleanRuleCode(value: string | undefined, index: number) {
    const code = value?.trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    return code || `R-${String(index + 1).padStart(3, '0')}`;
  }

  private toJson(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
    return value === undefined ? fallback : (value as Prisma.InputJsonValue);
  }

  private serializeReviewItem<T>(item: T) {
    return JSON.parse(
      JSON.stringify(item, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value)),
    ) as T;
  }
}