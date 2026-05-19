import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebsiteSourceDto } from './dto/create-website-source.dto';

interface SourceContext {
  actorId?: string;
  correlationId: string;
}

@Injectable()
export class SourcesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.websiteSource.findMany({ orderBy: { createdAt: 'desc' }, skip: offset, take: limit, include: { scans: { orderBy: { createdAt: 'desc' }, take: 5 } } }),
      this.prisma.websiteSource.count(),
    ]);
    return { items, total, limit, offset };
  }

  async create(dto: CreateWebsiteSourceDto, context: SourceContext) {
    const source = await this.prisma.websiteSource.create({
      data: {
        name: dto.name,
        baseUrl: dto.baseUrl,
        domain: dto.domain,
        isActive: dto.isActive ?? true,
        scanConfig: { strategy: 'bot-fipcs', maxPages: dto.maxPages ?? 2, maxDocuments: dto.maxDocuments ?? null },
      },
    });
    await this.audit.record({
      actorId: context.actorId,
      action: 'WEBSITE_SOURCE_CREATED',
      entityType: 'WebsiteSource',
      entityId: source.id,
      nextState: { id: source.id, baseUrl: source.baseUrl, scanConfig: source.scanConfig },
      correlationId: context.correlationId,
    });
    return source;
  }

  async triggerScan(sourceId: string, context: SourceContext) {
    const source = await this.prisma.websiteSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new NotFoundException({ code: 'WEBSITE_SOURCE_NOT_FOUND', message: 'Website source was not found.' });
    }
    if (!source.isActive) {
      throw new BadRequestException({ code: 'WEBSITE_SOURCE_INACTIVE', message: 'Inactive sources cannot be scanned.' });
    }

    const config = (source.scanConfig ?? {}) as { maxPages?: number; maxDocuments?: number | null };
    const args = ['--filter', '@docai/back-end', 'crawler:bot-fipcs', '--', `--source-id=${source.id}`, `--source-url=${source.baseUrl}`, `--pages=${config.maxPages ?? 2}`];
    if (config.maxDocuments) args.push(`--max-documents=${config.maxDocuments}`);

    const child = spawn('pnpm', args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, X_CORRELATION_ID: context.correlationId },
    });
    child.unref();

    await this.audit.record({
      actorId: context.actorId,
      action: 'WEBSITE_SOURCE_SCAN_TRIGGERED',
      entityType: 'WebsiteSource',
      entityId: source.id,
      nextState: { pid: child.pid, args, baseUrl: source.baseUrl },
      correlationId: context.correlationId,
    });

    return { sourceId: source.id, status: 'TRIGGERED', pid: child.pid ?? null };
  }
}