import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IOcrEngineAdapter, OcrEngineResult, OcrJobOptions } from './ocr-engine.adapter';

/**
 * OCR adapter that uses the Google Cloud Vision API (document text detection).
 *
 * Requires:
 *   - `@google-cloud/vision` package installed (`pnpm add @google-cloud/vision`)
 *   - `GOOGLE_APPLICATION_CREDENTIALS` env pointing to a service-account JSON file
 *     OR the default Application Default Credentials chain configured.
 *
 * Set `OCR_ENGINE=google-vision` to activate this adapter.
 *
 * NOTE: `batchAnnotateFiles` supports up to 100 pages per synchronous request.
 * For documents exceeding 100 pages, consider upgrading to `asyncBatchAnnotateFiles`.
 */
@Injectable()
export class CloudVisionAdapter implements IOcrEngineAdapter {
  readonly engineId = 'google-cloud-vision';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async run(pdfBuffer: Buffer, options: OcrJobOptions): Promise<OcrEngineResult> {
    // Lazy import so the server starts even when the package is not installed.
    let ImageAnnotatorClient: new (opts?: Record<string, unknown>) => GoogleVisionClient;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — optional peer dep; lazy-loaded only when OCR_ENGINE=google-vision
      const mod = await import('@google-cloud/vision');
      ImageAnnotatorClient = (mod as unknown as { ImageAnnotatorClient: typeof ImageAnnotatorClient }).ImageAnnotatorClient;
    } catch {
      return {
        text: '',
        pageCount: 0,
        confidence: 0,
        warnings: ['@google-cloud/vision is not installed — run: pnpm add @google-cloud/vision'],
      };
    }

    const keyFilePath = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    const client: GoogleVisionClient = keyFilePath
      ? new ImageAnnotatorClient({ keyFilename: keyFilePath })
      : new ImageAnnotatorClient();

    const inputContent = pdfBuffer.toString('base64');
    const languageHints = options.languages.map((lang) => (lang === 'tha' ? 'th' : lang));

    let response: GoogleBatchAnnotateFilesResponse;
    try {
      [response] = await (client as any).batchAnnotateFiles({
        requests: [
          {
            inputConfig: { content: inputContent, mimeType: 'application/pdf' },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: languageHints.length ? { languageHints } : undefined,
            pages: [],
          },
        ],
      });
    } catch (err) {
      return {
        text: '',
        pageCount: 0,
        confidence: 0,
        warnings: [`Cloud Vision API call failed: ${errorMessage(err)}`],
      };
    }

    const pages = response?.responses?.[0]?.responses ?? [];
    const textParts: string[] = [];
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const page of pages) {
      const pageText = page?.fullTextAnnotation?.text ?? '';
      textParts.push(pageText);
      const pageConf = page?.fullTextAnnotation?.pages?.[0]?.confidence;
      if (typeof pageConf === 'number') {
        confidenceSum += pageConf;
        confidenceCount++;
      }
    }

    const text = textParts.join('\n').trim();
    const confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : text ? 0.5 : 0;

    return {
      text,
      pageCount: pages.length,
      confidence: Math.min(1, Math.max(0, confidence)),
      warnings: [],
    };
  }
}

// Minimal structural types — avoids importing the full @google-cloud/vision at the module level.
interface GoogleVisionClient {
  batchAnnotateFiles(request: unknown): Promise<[GoogleBatchAnnotateFilesResponse]>;
}
interface GoogleBatchAnnotateFilesResponse {
  responses?: Array<{
    responses?: Array<{
      fullTextAnnotation?: {
        text?: string;
        pages?: Array<{ confidence?: number }>;
      };
    }>;
  }>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
