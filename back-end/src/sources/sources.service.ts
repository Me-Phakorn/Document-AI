import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BotFipcsCrawlerService } from '../crawler/bot-fipcs-crawler.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebsiteSourceDto } from './dto/create-website-source.dto';
import { ImportSelectedLinksDto } from './dto/import-selected-links.dto';
import { PreviewSourceQueryDto } from './dto/preview-source-query.dto';

interface SourceContext {
  actorId?: string;
  correlationId: string;
}

interface WebsiteScanConfig {
  strategy: 'bot-fipcs';
  startPage: number;
  endPage: number | null;
  maxPages: number | null;
  maxDocuments: number | null;
}

@Injectable()
export class SourcesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(BotFipcsCrawlerService) private readonly crawler: BotFipcsCrawlerService,
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
    const scanConfig = this.buildScanConfig(dto);
    const source = await this.prisma.websiteSource.create({
      data: {
        name: dto.name,
        baseUrl: dto.baseUrl,
        domain: dto.domain,
        isActive: dto.isActive ?? true,
        scanConfig: this.toJsonScanConfig(scanConfig),
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

  async previewSource(sourceId: string, query: PreviewSourceQueryDto) {
    const source = await this.prisma.websiteSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new NotFoundException({ code: 'WEBSITE_SOURCE_NOT_FOUND', message: 'Website source was not found.' });
    }

    const links = await this.crawler.previewLinks(source.baseUrl, {
      startPage: query.startPage ?? 1,
      endPage: query.endPage,
      maxDocuments: query.maxDocuments ?? 50,
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      baseUrl: source.baseUrl,
      total: links.length,
      links,
    };
  }

  async importSelected(sourceId: string, dto: ImportSelectedLinksDto, context: SourceContext) {
    const source = await this.prisma.websiteSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new NotFoundException({ code: 'WEBSITE_SOURCE_NOT_FOUND', message: 'Website source was not found.' });
    }
    if (!source.isActive) {
      throw new BadRequestException({ code: 'WEBSITE_SOURCE_INACTIVE', message: 'Inactive sources cannot be imported.' });
    }

    // Write selected links to a temp file so the import script can read them directly
    const tmpDir = await mkdtemp(join(tmpdir(), 'docai-import-'));
    const linksFilePath = join(tmpDir, 'links.json');
    await writeFile(linksFilePath, JSON.stringify(dto.links), 'utf8');

    const args = [
      '--filter',
      '@docai/back-end',
      'crawler:bot-fipcs',
      '--',
      `--source-id=${source.id}`,
      `--source-url=${source.baseUrl}`,
      `--links-file=${linksFilePath}`,
    ];

    const child = spawn('pnpm', args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, X_CORRELATION_ID: context.correlationId },
    });
    child.unref();

    // Clean up temp dir after a short delay (script should have read the file by then)
    setTimeout(() => {
      rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }, 30_000);

    await this.audit.record({
      actorId: context.actorId,
      action: 'WEBSITE_SOURCE_SELECTED_IMPORT_TRIGGERED',
      entityType: 'WebsiteSource',
      entityId: source.id,
      nextState: { pid: child.pid ?? null, selectedCount: dto.links.length, sourceId: source.id },
      correlationId: context.correlationId,
    });

    return { sourceId: source.id, status: 'TRIGGERED', pid: child.pid ?? null, selectedCount: dto.links.length };
  }

  async triggerScan(sourceId: string, context: SourceContext) {
    const source = await this.prisma.websiteSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      throw new NotFoundException({ code: 'WEBSITE_SOURCE_NOT_FOUND', message: 'Website source was not found.' });
    }
    if (!source.isActive) {
      throw new BadRequestException({ code: 'WEBSITE_SOURCE_INACTIVE', message: 'Inactive sources cannot be scanned.' });
    }

    const config = this.normalizeScanConfig(source.scanConfig);
    const args = [
      '--filter',
      '@docai/back-end',
      'crawler:bot-fipcs',
      '--',
      `--source-id=${source.id}`,
      `--source-url=${source.baseUrl}`,
      `--start-page=${config.startPage}`,
      `--max-pages-cap=${this.getCrawlerPageCap()}`,
    ];
    if (config.endPage) args.push(`--end-page=${config.endPage}`);
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
      nextState: { pid: child.pid ?? null, args, baseUrl: source.baseUrl, scanConfig: this.toJsonScanConfig(config) },
      correlationId: context.correlationId,
    });

    return { sourceId: source.id, status: 'TRIGGERED', pid: child.pid ?? null };
  }

  private buildScanConfig(dto: CreateWebsiteSourceDto): WebsiteScanConfig {
    const startPage = dto.startPage ?? 1;
    const endPage = dto.endPage ?? (dto.maxPages ? startPage + dto.maxPages - 1 : null);
    const maxDocuments = dto.maxDocuments ?? null;
    return this.validateScanConfig({
      strategy: 'bot-fipcs',
      startPage,
      endPage,
      maxPages: endPage ? endPage - startPage + 1 : null,
      maxDocuments,
    });
  }

  private normalizeScanConfig(scanConfig: unknown): WebsiteScanConfig {
    const rawConfig = (scanConfig ?? {}) as Partial<WebsiteScanConfig>;
    const startPage = this.parsePositiveInteger(rawConfig.startPage) ?? 1;
    const legacyMaxPages = this.parsePositiveInteger(rawConfig.maxPages);
    const endPage = this.parsePositiveInteger(rawConfig.endPage) ?? (legacyMaxPages ? startPage + legacyMaxPages - 1 : null);

    return this.validateScanConfig({
      strategy: 'bot-fipcs',
      startPage,
      endPage,
      maxPages: endPage ? endPage - startPage + 1 : null,
      maxDocuments: this.parsePositiveInteger(rawConfig.maxDocuments) ?? null,
    });
  }

  private validateScanConfig(scanConfig: WebsiteScanConfig) {
    const pageCap = this.getCrawlerPageCap();
    if (scanConfig.endPage && scanConfig.endPage < scanConfig.startPage) {
      throw new BadRequestException({ code: 'INVALID_CRAWLER_PAGE_RANGE', message: 'Crawler end page must be greater than or equal to the start page.' });
    }
    if (scanConfig.startPage > pageCap || (scanConfig.endPage && scanConfig.endPage > pageCap)) {
      throw new BadRequestException({ code: 'CRAWLER_PAGE_RANGE_EXCEEDS_CAP', message: `Crawler pages must be within the configured page cap of ${pageCap}.` });
    }
    return scanConfig;
  }

  private toJsonScanConfig(scanConfig: WebsiteScanConfig): Prisma.InputJsonObject {
    return {
      strategy: scanConfig.strategy,
      startPage: scanConfig.startPage,
      endPage: scanConfig.endPage,
      maxPages: scanConfig.maxPages,
      maxDocuments: scanConfig.maxDocuments,
    };
  }

  private getCrawlerPageCap() {
    return this.parsePositiveInteger(this.config.get<string>('CRAWLER_MAX_PAGES_CAP')) ?? 500;
  }

  private parsePositiveInteger(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
}