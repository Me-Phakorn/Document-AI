import { Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AiConfigService } from './ai-config.service';
import { AnalysisService } from './analysis.service';
import { AiProviderConfigDto } from './dto/ai-provider-config.dto';

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
  getAiConfig(): AiProviderConfigDto {
    return this.aiConfig.getPublicSummary();
  }

  @Get('results')
  @ApiOperation({ summary: 'List AI analysis results and review state' })
  @ApiOkResponse({ description: 'Paginated AI analysis result list.' })
  listResults(@Query() query: PaginationQueryDto) {
    return this.analysis.listResults(query.limit, query.offset);
  }

  @Post('document-versions/:documentVersionId/run')
  @ApiOperation({ summary: 'Run AI rule extraction for a document version with OCR text' })
  @ApiOkResponse({ description: 'AI analysis result persisted for review.' })
  analyzeDocumentVersion(
    @Param('documentVersionId') documentVersionId: string,
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
  ) {
    return this.analysis.analyzeDocumentVersion(documentVersionId, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}