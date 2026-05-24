import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateWebsiteSourceDto } from './dto/create-website-source.dto';
import { ImportSelectedLinksDto } from './dto/import-selected-links.dto';
import { PreviewSourceQueryDto } from './dto/preview-source-query.dto';
import { SourcesService } from './sources.service';

@ApiTags('sources')
@Controller('sources')
export class SourcesController {
  constructor(@Inject(SourcesService) private readonly sources: SourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List website sources and recent scans' })
  @ApiOkResponse({ description: 'Paginated website source list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.sources.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a website source for URL/PDF discovery' })
  @ApiCreatedResponse({ description: 'Created website source.' })
  create(@Body() dto: CreateWebsiteSourceDto, @CurrentUser('id') actorId: string, @Query('correlationId') correlationId: string | undefined) {
    return this.sources.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Get(':sourceId/preview')
  @ApiOperation({ summary: 'Preview PDF links discoverable at a website source (no import)' })
  @ApiOkResponse({ description: 'List of PDF links found at the source URL without importing.' })
  previewSource(@Param('sourceId') sourceId: string, @Query() query: PreviewSourceQueryDto) {
    return this.sources.previewSource(sourceId, query);
  }

  @Post(':sourceId/scans')
  @ApiOperation({ summary: 'Trigger a real BOT FIPCS crawler scan for this source' })
  @ApiOkResponse({ description: 'Crawler process trigger result.' })
  triggerScan(@Param('sourceId') sourceId: string, @CurrentUser('id') actorId: string, @Query('correlationId') correlationId: string | undefined) {
    return this.sources.triggerScan(sourceId, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post(':sourceId/import-selected')
  @ApiOperation({ summary: 'Import a specific set of pre-crawled PDF links from a website source' })
  @ApiCreatedResponse({ description: 'Selected-link import triggered.' })
  importSelected(@Param('sourceId') sourceId: string, @Body() dto: ImportSelectedLinksDto, @CurrentUser('id') actorId: string, @Query('correlationId') correlationId: string | undefined) {
    return this.sources.importSelected(sourceId, dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}