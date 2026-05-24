import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PromptStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AiConfigService } from '../analysis/ai-config.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';

interface PromptContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class PromptsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AiConfigService) private readonly aiConfig: AiConfigService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promptTemplate.findMany({ orderBy: { updatedAt: 'desc' }, skip: offset, take: limit, include: { versions: { orderBy: { versionNumber: 'desc' } } } }),
      this.prisma.promptTemplate.count(),
    ]);
    return { items, total, limit, offset };
  }

  async create(dto: CreatePromptTemplateDto, context: PromptContext) {
    const promptTemplateId = randomUUID();
    const promptVersionId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.promptTemplate.create({
        data: {
          id: promptTemplateId,
          name: dto.name,
          domain: dto.domain,
          tags: dto.tags ?? [],
          status: PromptStatus.DRAFT,
          createdById: context.actorId,
          versions: {
            create: {
              id: promptVersionId,
              versionNumber: 1,
              status: PromptStatus.DRAFT,
              templateText: dto.templateText,
              variables: dto.variables ?? [],
              aiProvider: this.aiConfig.provider,
              aiModel: this.normalizeModel(dto.aiModel),
              createdById: context.actorId,
            },
          },
        },
        include: { versions: true },
      });
      await this.audit.record({
        actorId: context.actorId,
        action: 'PROMPT_TEMPLATE_CREATED',
        entityType: 'PromptTemplate',
        entityId: prompt.id,
        nextState: prompt as unknown as Prisma.InputJsonValue,
        correlationId: context.correlationId,
      }, tx);
      return prompt;
    });
  }

  async createVersion(promptTemplateId: string, dto: CreatePromptVersionDto, context: PromptContext) {
    const existing = await this.prisma.promptTemplate.findUnique({ where: { id: promptTemplateId }, include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } } });
    if (!existing) {
      throw new NotFoundException({ code: 'PROMPT_TEMPLATE_NOT_FOUND', message: 'Prompt template was not found.' });
    }
    const nextVersionNumber = (existing.versions[0]?.versionNumber ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.promptTemplateVersion.create({
        data: {
          promptTemplateId,
          versionNumber: nextVersionNumber,
          status: PromptStatus.DRAFT,
          templateText: dto.templateText,
          variables: dto.variables ?? [],
          aiProvider: this.aiConfig.provider,
          aiModel: this.normalizeModel(dto.aiModel),
          createdById: context.actorId,
        },
      });
      await tx.promptTemplate.update({ where: { id: promptTemplateId }, data: { status: PromptStatus.DRAFT } });
      await this.audit.record({
        actorId: context.actorId,
        action: 'PROMPT_TEMPLATE_VERSION_CREATED',
        entityType: 'PromptTemplateVersion',
        entityId: version.id,
        previousState: { promptTemplateId, latestVersionNumber: existing.versions[0]?.versionNumber ?? null },
        nextState: version as unknown as Prisma.InputJsonValue,
        correlationId: context.correlationId,
      }, tx);
      return version;
    });
  }

  async activateVersion(promptTemplateVersionId: string, context: PromptContext) {
    const version = await this.prisma.promptTemplateVersion.findUnique({ where: { id: promptTemplateVersionId } });
    if (!version) {
      throw new NotFoundException({ code: 'PROMPT_VERSION_NOT_FOUND', message: 'Prompt version was not found.' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.promptTemplateVersion.updateMany({ where: { promptTemplateId: version.promptTemplateId, status: PromptStatus.ACTIVE }, data: { status: PromptStatus.DEPRECATED } });
      const activated = await tx.promptTemplateVersion.update({ where: { id: promptTemplateVersionId }, data: { status: PromptStatus.ACTIVE } });
      await tx.promptTemplate.update({ where: { id: version.promptTemplateId }, data: { status: PromptStatus.ACTIVE } });
      await this.audit.record({
        actorId: context.actorId,
        action: 'PROMPT_TEMPLATE_VERSION_ACTIVATED',
        entityType: 'PromptTemplateVersion',
        entityId: activated.id,
        previousState: version as unknown as Prisma.InputJsonValue,
        nextState: activated as unknown as Prisma.InputJsonValue,
        correlationId: context.correlationId,
      }, tx);
      return activated;
    });
  }

  private normalizeModel(value: string | undefined) {
    return value?.trim() || this.aiConfig.model;
  }
}