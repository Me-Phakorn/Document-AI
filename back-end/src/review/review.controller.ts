import { Body, Controller, Get, Headers, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { ReviewService } from './review.service';

@ApiTags('review')
@Controller('review')
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  @Get('items')
  @ApiOperation({ summary: 'List review items with linked AI/compliance context' })
  @ApiOkResponse({ description: 'Paginated review item list.' })
  list(@Query() query: PaginationQueryDto) {
    return this.review.list(query);
  }

  @Post('items/:reviewItemId/approve')
  @ApiOperation({ summary: 'Approve an AI review item and create a rulebook version' })
  approve(@Param('reviewItemId') reviewItemId: string, @Body() dto: ReviewDecisionDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.review.approve(reviewItemId, dto.comment, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('items/:reviewItemId/request-changes')
  @ApiOperation({ summary: 'Request AI result changes with reviewer comment' })
  requestChanges(@Param('reviewItemId') reviewItemId: string, @Body() dto: ReviewDecisionDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.review.requestChanges(reviewItemId, dto.comment, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('items/:reviewItemId/confirm-not-relevant')
  @ApiOperation({ summary: 'Confirm a not-relevant AI review result' })
  confirmNotRelevant(@Param('reviewItemId') reviewItemId: string, @Body() dto: ReviewDecisionDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.review.confirmNotRelevant(reviewItemId, dto.comment, { actorId, correlationId: correlationId ?? randomUUID() });
  }

  @Post('document-versions/:documentVersionId/not-relevant')
  @ApiOperation({ summary: 'Mark an OCR-ready document version as not relevant without AI' })
  markDocumentVersionNotRelevant(@Param('documentVersionId') documentVersionId: string, @Body() dto: ReviewDecisionDto, @Headers('x-actor-id') actorId: string | undefined, @Headers('x-correlation-id') correlationId: string | undefined) {
    return this.review.markDocumentVersionNotRelevant(documentVersionId, dto.comment, { actorId, correlationId: correlationId ?? randomUUID() });
  }
}