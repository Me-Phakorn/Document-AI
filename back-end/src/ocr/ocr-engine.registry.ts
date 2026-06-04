import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudVisionAdapter } from './adapters/cloud-vision.adapter';
import type { IOcrEngineAdapter } from './adapters/ocr-engine.adapter';
import { PaddleOcrAdapter } from './adapters/paddleocr.adapter';
import { TesseractAdapter } from './adapters/tesseract.adapter';

/**
 * Selects the active OCR adapter based on the `OCR_ENGINE` environment variable.
 *
 * Supported values:
 *   - `tesseract`    (default) — `ocrmypdf` + Tesseract; requires OCR tools in container
 *   - `paddleocr`              — PaddleOCR Python sidecar; requires `PADDLEOCR_URL`
 *   - `google-vision`          — Google Cloud Vision API; requires service-account credentials
 */
@Injectable()
export class OcrEngineRegistry {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TesseractAdapter) private readonly tesseract: TesseractAdapter,
    @Inject(PaddleOcrAdapter) private readonly paddleOcr: PaddleOcrAdapter,
    @Inject(CloudVisionAdapter) private readonly cloudVision: CloudVisionAdapter,
  ) {}

  getAdapter(): IOcrEngineAdapter {
    const engine = this.config.get<string>('OCR_ENGINE', 'tesseract');
    switch (engine) {
      case 'paddleocr':
        return this.paddleOcr;
      case 'google-vision':
        return this.cloudVision;
      case 'tesseract':
      default:
        return this.tesseract;
    }
  }

  /** Stable engine label string suitable for storing in OcrArtifact.engine */
  getEngineLabel(): string {
    const adapter = this.getAdapter();
    const languages = this.config.get<string>('OCR_LANGUAGES', 'tha+eng');
    return `${adapter.engineId}@${languages}`;
  }
}
