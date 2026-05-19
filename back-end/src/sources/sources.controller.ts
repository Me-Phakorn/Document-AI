import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateWebsiteSourceDto } from './dto/create-website-source.dto';
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
  create(@Body() dto: CreateWebsiteSourceDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.sources.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post(':sourceId/scans')
  @ApiOperation({ summary: 'Trigger a real BOT FIPCS crawler scan for this source' })
  @ApiOkResponse({ description: 'Crawler process trigger result.' })
  triggerScan(@Param('sourceId') sourceId: string, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.sources.triggerScan(sourceId, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}