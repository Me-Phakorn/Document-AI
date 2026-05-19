import { Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RulebookService } from './rulebook.service';

@ApiTags('rulebook')
@Controller('rulebooks')
export class RulebookController {
  constructor(@Inject(RulebookService) private readonly rulebook: RulebookService) {}

  @Get()
  @ApiOperation({ summary: 'List master rulebooks with immutable versions and rules' })
  @ApiOkResponse({ description: 'Paginated master rulebook list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.rulebook.list(query);
  }

  @Get('versions/:rulebookVersionId')
  @ApiOperation({ summary: 'Get a rulebook version with rules and reports' })
  @ApiOkResponse({ description: 'Rulebook version detail.' })
  getVersion(@Param('rulebookVersionId') rulebookVersionId: string) {
    return this.rulebook.getVersion(rulebookVersionId);
  }

  @Post('versions/:rulebookVersionId/publish')
  @ApiOperation({ summary: 'Publish an approved rulebook version and supersede older published versions' })
  @ApiOkResponse({ description: 'Published rulebook version.' })
  publish(@Param('rulebookVersionId') rulebookVersionId: string, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.rulebook.publish(rulebookVersionId, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}