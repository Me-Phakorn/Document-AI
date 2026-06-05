import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OcrModule } from '../ocr/ocr.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuditModule, StorageModule, OcrModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}