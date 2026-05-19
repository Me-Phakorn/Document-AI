import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'List audit log records' })
  @ApiOkResponse({ description: 'Paginated audit log list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.audit.list(query);
  }
}