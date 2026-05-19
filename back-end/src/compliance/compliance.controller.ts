import { Body, Controller, Get, Headers, Inject, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Post('checks')
  @ApiOperation({ summary: 'Check submitted content against an approved or published rulebook version' })
  @ApiCreatedResponse({ description: 'Persisted compliance check and first result version.' })
  create(@Body() dto: CreateComplianceCheckDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.compliance.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}