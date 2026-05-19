import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ComplianceCheckStatus, Prisma, ReviewStatus, ReviewType, RulebookStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplianceCheckDto } from './dto/create-compliance-check.dto';

interface ComplianceContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.complianceCheck.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { selectedRulebookVersion: { include: { masterRulebook: true } }, results: { orderBy: { versionNumber: 'desc' }, take: 1 }, reviews: { orderBy: { createdAt: 'desc' }, take: 3 } },
      }),
      this.prisma.complianceCheck.count(),
    ]);

    return { items, total, limit, offset };
  }

  async create(dto: CreateComplianceCheckDto, context: ComplianceContext) {
    const selectedRulebookVersion = await this.resolveRulebookVersion(dto.selectedRulebookVersionId);
    if (!selectedRulebookVersion.rules.length) {
      throw new BadRequestException({ code: 'NO_RULES_AVAILABLE', message: 'No approved or published rulebook rules are available for compliance checking.' });
    }

    const inputHash = this.sha256(dto.content);
    const matches = this.matchRules(dto.content, selectedRulebookVersion.rules);
    const status = matches.length ? ComplianceCheckStatus.POTENTIAL_VIOLATION : ComplianceCheckStatus.COMPLIANT;
    const summary = matches.length
      ? `${matches.length} rule(s) matched submitted content and require reviewer confirmation.`
      : 'No rule text matched the submitted content.';

    return this.prisma.$transaction(async (tx) => {
      const check = await tx.complianceCheck.create({
        data: {
          inputType: dto.inputType,
          status,
          selectedRulebookVersionId: selectedRulebookVersion.id,
          selectedReportId: dto.selectedReportId,
          createdById: context.actorId,
          inputHash,
          extractedContentHash: inputHash,
          metadata: { title: dto.title ?? null, contentLength: dto.content.length },
          results: {
            create: {
              versionNumber: 1,
              status,
              summary,
              matchedRules: matches,
              ambiguousPoints: [],
              recommendedAction: matches.length ? 'Send to reviewer before final decision or notification.' : 'Record as compliant for this rulebook version.',
            },
          },
        },
        include: { results: true, selectedRulebookVersion: { include: { masterRulebook: true } } },
      });

      if (status !== ComplianceCheckStatus.COMPLIANT) {
        await tx.reviewItem.create({ data: { reviewType: ReviewType.COMPLIANCE_CHECK, status: ReviewStatus.PENDING, complianceCheckId: check.id, comment: summary } });
      }

      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'COMPLIANCE_CHECK_CREATED',
          entityType: 'ComplianceCheck',
          entityId: check.id,
          nextState: { status, selectedRulebookVersionId: selectedRulebookVersion.id, matchedRules: matches.length },
          correlationId: context.correlationId,
          requestMetadata: { inputType: dto.inputType, title: dto.title ?? null },
        },
        tx,
      );

      return check;
    });
  }

  private async resolveRulebookVersion(rulebookVersionId?: string) {
    const version = rulebookVersionId
      ? await this.prisma.masterRulebookVersion.findUnique({ where: { id: rulebookVersionId }, include: { masterRulebook: true, rules: { orderBy: { ruleCode: 'asc' } } } })
      : await this.prisma.masterRulebookVersion.findFirst({
          where: { status: { in: [RulebookStatus.PUBLISHED, RulebookStatus.APPROVED] } },
          orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
          include: { masterRulebook: true, rules: { orderBy: { ruleCode: 'asc' } } },
        });
    if (!version) {
      throw new NotFoundException({ code: 'RULEBOOK_VERSION_NOT_FOUND', message: 'Select or publish an approved rulebook version before checking compliance.' });
    }
    return version;
  }

  private matchRules(content: string, rules: Array<{ id: string; ruleCode: string; title: string; description: string; condition: string | null; prohibition: string | null; riskLevel: string; sourceReferences: Prisma.JsonValue }>) {
    const normalizedContent = this.normalize(content);
    return rules.flatMap((rule) => {
      const terms = this.extractTerms(`${rule.title} ${rule.description} ${rule.condition ?? ''} ${rule.prohibition ?? ''}`);
      const matchedTerms = terms.filter((term) => normalizedContent.includes(term)).slice(0, 8);
      if (!matchedTerms.length) return [];

      return [
        {
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          title: rule.title,
          riskLevel: rule.riskLevel,
          matchedTerms,
          sourceReferences: rule.sourceReferences,
        },
      ];
    });
  }

  private extractTerms(value: string) {
    const normalized = this.normalize(value);
    const tokens = normalized.match(/[a-z0-9ก-๙]{5,}/gi) ?? [];
    return Array.from(new Set(tokens.map((token) => token.toLowerCase()))).slice(0, 60);
  }

  private normalize(value: string) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}