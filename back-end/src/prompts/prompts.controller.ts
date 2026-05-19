import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { PromptsService } from './prompts.service';

@ApiTags('prompts')
@Controller('prompts')
export class PromptsController {
  constructor(@Inject(PromptsService) private readonly prompts: PromptsService) {}

  @Get()
  @ApiOperation({ summary: 'List prompt templates and immutable versions' })
  @ApiOkResponse({ description: 'Paginated prompt template list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.prompts.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a prompt template with draft version 1' })
  @ApiCreatedResponse({ description: 'Created prompt template.' })
  create(@Body() dto: CreatePromptTemplateDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.prompts.create(dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post(':promptTemplateId/versions')
  @ApiOperation({ summary: 'Create a new immutable draft version for a prompt template' })
  @ApiCreatedResponse({ description: 'Created prompt template version.' })
  createVersion(@Param('promptTemplateId') promptTemplateId: string, @Body() dto: CreatePromptVersionDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.prompts.createVersion(promptTemplateId, dto, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('versions/:promptTemplateVersionId/activate')
  @ApiOperation({ summary: 'Activate a prompt version and deprecate previous active versions' })
  @ApiOkResponse({ description: 'Activated prompt template version.' })
  activateVersion(@Param('promptTemplateVersionId') promptTemplateVersionId: string, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.prompts.activateVersion(promptTemplateVersionId, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}