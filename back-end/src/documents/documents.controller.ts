import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { DocumentsListQueryDto } from './dto/documents-list-query.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List document versions with import and processing status' })
  @ApiOkResponse({ description: 'Paginated document version list.' })
  listDocuments(@Query() query: DocumentsListQueryDto) {
    return this.documentsService.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get document pipeline summary metrics' })
  @ApiOkResponse({ description: 'Document, OCR, AI, review, and latest website scan summary.' })
  getDocumentSummary() {
    return this.documentsService.getSummary();
  }

  @Get(':documentVersionId')
  @ApiOperation({ summary: 'Get document version detail with artifact metadata' })
  @ApiParam({ name: 'documentVersionId', type: String })
  @ApiOkResponse({ description: 'Document version detail, OCR artifacts, and stored object metadata.' })
  getDocumentDetail(@Param('documentVersionId') documentVersionId: string) {
    return this.documentsService.getDetail(documentVersionId);
  }

  @Get(':documentVersionId/ocr-text')
  @ApiOperation({ summary: 'Get extracted OCR/native PDF text for a document version' })
  @ApiParam({ name: 'documentVersionId', type: String })
  @ApiOkResponse({ description: 'Latest OCR/native text artifact content and metadata.' })
  getOcrText(@Param('documentVersionId') documentVersionId: string) {
    return this.documentsService.getOcrText(documentVersionId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register an imported document and apply URL/file/content deduplication' })
  @ApiCreatedResponse({ description: 'Document registration result, including duplicate or new version details.' })
  registerDocument(
    @Body() dto: RegisterDocumentDto,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.documentsService.register(dto, {
      actorId,
      correlationId: correlationId ?? randomUUID(),
    });
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a PDF, store source/OCR artifacts, and create document records' })
  @ApiCreatedResponse({ description: 'Document upload result with deduplication outcome and artifact metadata.' })
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.documentsService.upload(dto, {
      actorId,
      correlationId: correlationId ?? randomUUID(),
    });
  }

  @Post(':documentVersionId/reupload')
  @ApiOperation({ summary: 'Upload a replacement PDF as a new immutable version of an existing document' })
  @ApiParam({ name: 'documentVersionId', type: String })
  @ApiCreatedResponse({ description: 'New document version created from an admin re-upload.' })
  reuploadDocumentVersion(
    @Param('documentVersionId') documentVersionId: string,
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.documentsService.reupload(documentVersionId, dto, {
      actorId,
      correlationId: correlationId ?? randomUUID(),
    });
  }

  @Post(':documentVersionId/refetch-source')
  @ApiOperation({ summary: 'Download the original source URL again and store it as a new document version' })
  @ApiParam({ name: 'documentVersionId', type: String })
  @ApiCreatedResponse({ description: 'New document version created from the stored source URL.' })
  refetchSourceDocument(
    @Param('documentVersionId') documentVersionId: string,
    @CurrentUser('id') actorId: string,
    @Query('correlationId') correlationId: string | undefined,
  ) {
    return this.documentsService.refetchSource(documentVersionId, {
      actorId,
      correlationId: correlationId ?? randomUUID(),
    });
  }
}