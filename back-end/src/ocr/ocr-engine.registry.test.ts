/**
 * Unit tests for OcrEngineRegistry.
 *
 * We construct the registry with lightweight adapter stubs and a ConfigService
 * shim — no NestJS application context is needed.
 */
import { describe, expect, it } from 'vitest';
import { CloudVisionAdapter } from './adapters/cloud-vision.adapter';
import type { IOcrEngineAdapter, OcrEngineResult, OcrJobOptions } from './adapters/ocr-engine.adapter';
import { PaddleOcrAdapter } from './adapters/paddleocr.adapter';
import { TesseractAdapter } from './adapters/tesseract.adapter';
import { OcrEngineRegistry } from './ocr-engine.registry';

// Minimal ConfigService shim
function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (overrides[key] as T) ?? (fallback as T),
  } as import('@nestjs/config').ConfigService;
}

// Minimal adapter stub — we only need the engineId property for registry tests.
function makeAdapter(engineId: string): IOcrEngineAdapter {
  return {
    engineId,
    run: async (_buf: Buffer, _opts: OcrJobOptions): Promise<OcrEngineResult> => ({
      text: '',
      pageCount: 0,
      confidence: 0,
      warnings: [],
    }),
  };
}

const stubTesseract = makeAdapter('ocrmypdf-tesseract') as TesseractAdapter;
const stubPaddle = makeAdapter('paddleocr') as PaddleOcrAdapter;
const stubVision = makeAdapter('google-cloud-vision') as CloudVisionAdapter;

describe('OcrEngineRegistry', () => {
  describe('getAdapter()', () => {
    it('returns TesseractAdapter by default (no OCR_ENGINE set)', () => {
      const registry = new OcrEngineRegistry(makeConfig(), stubTesseract, stubPaddle, stubVision);
      expect(registry.getAdapter()).toBe(stubTesseract);
    });

    it('returns TesseractAdapter when OCR_ENGINE=tesseract', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'tesseract' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getAdapter()).toBe(stubTesseract);
    });

    it('returns PaddleOcrAdapter when OCR_ENGINE=paddleocr', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'paddleocr' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getAdapter()).toBe(stubPaddle);
    });

    it('returns CloudVisionAdapter when OCR_ENGINE=google-vision', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'google-vision' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getAdapter()).toBe(stubVision);
    });

    it('falls back to TesseractAdapter for unknown OCR_ENGINE values', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'unknown-engine' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getAdapter()).toBe(stubTesseract);
    });
  });

  describe('getEngineLabel()', () => {
    it('includes engineId and languages separated by @', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'tesseract', OCR_LANGUAGES: 'tha+eng' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getEngineLabel()).toBe('ocrmypdf-tesseract@tha+eng');
    });

    it('defaults OCR_LANGUAGES to tha+eng when not set', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'tesseract' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getEngineLabel()).toBe('ocrmypdf-tesseract@tha+eng');
    });

    it('uses custom OCR_LANGUAGES when set', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'paddleocr', OCR_LANGUAGES: 'tha' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getEngineLabel()).toBe('paddleocr@tha');
    });

    it('reflects engine switch from tesseract to google-vision', () => {
      const registry = new OcrEngineRegistry(
        makeConfig({ OCR_ENGINE: 'google-vision', OCR_LANGUAGES: 'tha+eng' }),
        stubTesseract, stubPaddle, stubVision,
      );
      expect(registry.getEngineLabel()).toBe('google-cloud-vision@tha+eng');
    });
  });
});
