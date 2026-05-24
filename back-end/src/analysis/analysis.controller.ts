import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AiConfigService } from './ai-config.service';
import { AnalysisService } from './analysis.service';
import { AiProviderConfigDto } from './dto/ai-provider-config.dto';
import { BatchQueueDto } from './dto/batch-queue.dto';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(
    @Inject(AiConfigService) private readonly aiConfig: AiConfigService,
    @Inject(AnalysisService) private readonly analysis: AnalysisService,
  ) {}

  @Get('ai-config')
  @ApiOperation({ summary: 'Get sanitized AI provider configuration' })
  @ApiOkResponse({ type: AiProviderConfigDto })
  getAiConfig(): Promise<AiProviderConfigDto> {
    return this.aiConfig.getPublicSummary();
  }

  @Get('results')
  @ApiOperation({ summary: 'List AI analysis results and review state' })
  @ApiOkResponse({ description: 'Paginated AI analysis result list.' })
  listResults(@Query() query: PaginationQueryDto) {
    return this.analysis.listResults(query.limit, query.offset);
  }

  @Post('batch-queue')
  @ApiOperation({ summary: 'Queue multiple document versions for AI analysis (non-blocking)' })
  @ApiCreatedResponse({ description: 'Count of documents queued and skipped (already processing).' })
  batchQueue(
    @Body() dto: BatchQueueDto,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.analysis.batchQueue(dto.documentVersionIds, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('document-versions/:documentVersionId/run')
  @ApiOperation({ summary: 'Run AI rule extraction for a document version with OCR text' })
  @ApiOkResponse({ description: 'AI analysis result persisted for review.' })
  analyzeDocumentVersion(
    @Param('documentVersionId') documentVersionId: string,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.analysis.analyzeDocumentVersion(documentVersionId, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}