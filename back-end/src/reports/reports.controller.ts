import { Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List generated reports and export status' })
  @ApiOkResponse({ description: 'Paginated report list backed by PostgreSQL.' })
  listReports(@Query() query: PaginationQueryDto) {
    return this.reports.list(query);
  }

  @Post('rulebook-versions/:rulebookVersionId/generate')
  @ApiOperation({ summary: 'Generate a rule extraction report and JSON export for a rulebook version' })
  @ApiOkResponse({ description: 'Generated report with completed JSON export.' })
  generateRulebookReport(@Param('rulebookVersionId') rulebookVersionId: string, @CurrentUser('id') actorId: string, @Query('correlationId') correlationId: string | undefined) {
    return this.reports.generateRulebookReport(rulebookVersionId, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('compliance-checks/:complianceCheckId/generate')
  @ApiOperation({ summary: 'Generate a compliance usage report and JSON export for a compliance check' })
  @ApiOkResponse({ description: 'Generated compliance report with completed JSON export.' })
  generateComplianceReport(@Param('complianceCheckId') complianceCheckId: string, @CurrentUser('id') actorId: string, @Query('correlationId') correlationId: string | undefined) {
    return this.reports.generateComplianceReport(complianceCheckId, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Get('exports/:reportExportId')
  @ApiOperation({ summary: 'Read a generated report export from object storage' })
  @ApiOkResponse({ description: 'Report export metadata and JSON content.' })
  getExport(@Param('reportExportId') reportExportId: string) {
    return this.reports.getExport(reportExportId);
  }
}