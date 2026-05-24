import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ComplianceService } from './compliance.service';
import { CreateComplianceCheckDto } from './dto/create-compliance-check.dto';

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(@Inject(ComplianceService) private readonly compliance: ComplianceService) {}

  @Get('checks')
  @ApiOperation({ summary: 'List compliance checks and latest result' })
  @ApiOkResponse({ description: 'Paginated compliance check list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.compliance.list(query);
  }

  @Get('checks/:id')
  @ApiOperation({ summary: 'Get a single compliance check with all results' })
  @ApiOkResponse({ description: 'Compliance check detail.' })
  findOne(@Param('id') id: string) {
    return this.compliance.findOne(id);
  }

  @Get('checks/:id/detail')
  @ApiOperation({ summary: 'Get a compliance check with all results and the full list of rules that were checked' })
  @ApiOkResponse({ description: 'Compliance check detail including rulesChecked array.' })
  findOneDetail(@Param('id') id: string) {
    return this.compliance.findOneDetail(id);
  }

  @Get('checks/:id/image')
  @ApiOperation({ summary: 'Stream the source image that was submitted for this compliance check' })
  async getImage(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { buffer, contentType } = await this.compliance.getInputImage(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  }

  @Post('checks')
  @ApiOperation({ summary: 'Check submitted content against an approved or published rulebook version' })
  @ApiCreatedResponse({ description: 'Persisted compliance check and first result version.' })
  create(@Body() dto: CreateComplianceCheckDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.compliance.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}