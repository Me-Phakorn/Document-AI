import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CloudVisionAdapter } from './adapters/cloud-vision.adapter';
import { PaddleOcrAdapter } from './adapters/paddleocr.adapter';
import { TesseractAdapter } from './adapters/tesseract.adapter';
import { OcrEngineRegistry } from './ocr-engine.registry';
import { OcrService } from './ocr.service';

@Module({
  imports: [PrismaModule, StorageModule, AuditModule],
  providers: [TesseractAdapter, PaddleOcrAdapter, CloudVisionAdapter, OcrEngineRegistry, OcrService],
  exports: [OcrService],
})
export class OcrModule {}
