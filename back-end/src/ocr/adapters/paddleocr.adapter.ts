import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IOcrEngineAdapter, OcrEngineResult, OcrJobOptions } from './ocr-engine.adapter';

/**
 * OCR adapter that delegates to the PaddleOCR sidecar service.
 *
 * The sidecar is a Python FastAPI process (see `paddleocr-service/`) that accepts
 * a JSON body with a base64-encoded PDF and returns extracted text with confidence.
 *
 * Set `OCR_ENGINE=paddleocr` and `PADDLEOCR_URL=http://paddleocr-sidecar:8000`
 * to activate this adapter.
 */
@Injectable()
export class PaddleOcrAdapter implements IOcrEngineAdapter {
  readonly engineId = 'paddleocr';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async run(pdfBuffer: Buffer, options: OcrJobOptions): Promise<OcrEngineResult> {
    const baseUrl = this.config.get<string>('PADDLEOCR_URL', 'http://paddleocr-sidecar:8000');
    const timeoutMs = options.timeoutMs ?? 180_000;

    const body = JSON.stringify({
      pdf_base64: pdfBuffer.toString('base64'),
      languages: options.languages.length ? options.languages : ['tha', 'eng'],
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      return {
        text: '',
        pageCount: 0,
        confidence: 0,
        warnings: [`PaddleOCR sidecar request failed: ${errorMessage(err)}`],
      };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        text: '',
        pageCount: 0,
        confidence: 0,
        warnings: [`PaddleOCR sidecar returned HTTP ${response.status}: ${detail}`],
      };
    }

    const data = (await response.json()) as PaddleOcrResponse;
    return {
      text: data.text ?? '',
      pageCount: data.page_count ?? 0,
      confidence: typeof data.confidence === 'number' ? Math.min(1, Math.max(0, data.confidence)) : 0,
      warnings: data.warnings ?? [],
    };
  }
}

interface PaddleOcrResponse {
  text?: string;
  page_count?: number;
  confidence?: number;
  warnings?: string[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
