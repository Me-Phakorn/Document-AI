import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RulebookStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

interface RulebookContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class RulebookService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.masterRulebook.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
        include: { versions: { orderBy: { versionNumber: 'desc' }, include: { rules: { orderBy: { ruleCode: 'asc' } } } } },
      }),
      this.prisma.masterRulebook.count(),
    ]);

    return { items, total, limit, offset };
  }

  async getVersion(rulebookVersionId: string) {
    const version = await this.prisma.masterRulebookVersion.findUnique({
      where: { id: rulebookVersionId },
      include: { masterRulebook: true, rules: { orderBy: { ruleCode: 'asc' } }, reports: { orderBy: { createdAt: 'desc' } } },
    });
    if (!version) {
      throw new NotFoundException({ code: 'RULEBOOK_VERSION_NOT_FOUND', message: 'Rulebook version was not found.' });
    }
    return version;
  }

  async publish(rulebookVersionId: string, context: RulebookContext) {
    const version = await this.prisma.masterRulebookVersion.findUnique({ where: { id: rulebookVersionId }, include: { rules: true } });
    if (!version) {
      throw new NotFoundException({ code: 'RULEBOOK_VERSION_NOT_FOUND', message: 'Rulebook version was not found.' });
    }
    if (!version.rules.length) {
      throw new BadRequestException({ code: 'RULEBOOK_VERSION_HAS_NO_RULES', message: 'A rulebook version must contain at least one rule before publishing.' });
    }
    if (version.status !== RulebookStatus.APPROVED && version.status !== RulebookStatus.PUBLISHED) {
      throw new BadRequestException({ code: 'RULEBOOK_VERSION_NOT_APPROVED', message: 'Only approved rulebook versions can be published.' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.masterRulebookVersion.updateMany({
        where: { masterRulebookId: version.masterRulebookId, status: RulebookStatus.PUBLISHED, id: { not: rulebookVersionId } },
        data: { status: RulebookStatus.SUPERSEDED },
      });
      const published = await tx.masterRulebookVersion.update({
        where: { id: rulebookVersionId },
        data: { status: RulebookStatus.PUBLISHED, publishedById: context.actorId, publishedAt: new Date() },
        include: { masterRulebook: true, rules: { orderBy: { ruleCode: 'asc' } } },
      });
      await this.audit.record(
        {
          actorId: context.actorId,
          action: 'RULEBOOK_VERSION_PUBLISHED',
          entityType: 'MasterRulebookVersion',
          entityId: published.id,
          previousState: { status: version.status },
          nextState: { status: published.status, publishedAt: published.publishedAt },
          correlationId: context.correlationId,
        },
        tx,
      );
      return published;
    });
  }
}