import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { IOcrEngineAdapter, OcrEngineResult, OcrJobOptions } from './ocr-engine.adapter';

const execFileAsync = promisify(execFile);

/**
 * OCR adapter that wraps `ocrmypdf` (which orchestrates Tesseract internally).
 *
 * Requires the following CLI tools to be installed in the container:
 *   - ocrmypdf        (Debian: `apt-get install ocrmypdf`)
 *   - tesseract-ocr   (pulled in by ocrmypdf)
 *   - tesseract-ocr-tha + tesseract-ocr-eng  (language packs)
 *   - poppler-utils   (provides pdftotext)
 *   - ghostscript
 *
 * Set `OCR_ENGINE=tesseract` (default) to use this adapter.
 *
 * ## Smart OCR strategy
 * 1. Pre-scan the original PDF with `pdftotext` (fast, < 1 s).
 * 2. If the pre-scan already contains readable Thai text (quality ≥ 0.3) → return
 *    the pre-scan result immediately without running ocrmypdf at all.
 * 3. If the pre-scan is empty or garbled (custom-encoded Thai glyphs, alien
 *    characters, encoding mismatch) → run `ocrmypdf --force-ocr` which ignores
 *    any broken embedded text layer and re-OCRs every page visually from scratch.
 * 4. If ocrmypdf fails → fall back to returning the pre-scanned text (even if
 *    low quality) with a warning, so no document is left completely empty.
 */
@Injectable()
export class TesseractAdapter implements IOcrEngineAdapter {
  readonly engineId = 'ocrmypdf-tesseract';

  /**
   * Thai char ratio threshold above which existing embedded text is considered
   * readable and full re-OCR is skipped.
   */
  private static readonly QUALITY_THRESHOLD = 0.3;

  async run(pdfBuffer: Buffer, options: OcrJobOptions): Promise<OcrEngineResult> {
    const languages = options.languages.length ? options.languages.join('+') : 'tha+eng';
    const timeoutMs = options.timeoutMs ?? 180_000;

    const tmpDir = await mkdtemp(join(tmpdir(), 'docai-ocr-'));
    const inputPath = join(tmpDir, 'input.pdf');
    const outputPath = join(tmpDir, 'output.pdf');

    try {
      await writeFile(inputPath, pdfBuffer);

      // ── Step 1: Pre-scan the original PDF ──────────────────────────────
      // pdftotext without -layout works better for Thai: Thai documents
      // often have complex formatting that -layout misinterprets as columns.
      // -enc UTF-8 ensures the output is always valid UTF-8.
      const preScanText = await this.runPdfToText(inputPath);
      const preScanQuality = this.estimateConfidence(preScanText);

      if (preScanQuality >= TesseractAdapter.QUALITY_THRESHOLD) {
        // The PDF already has a good Thai text layer — no need to run OCR.
        return {
          text: preScanText,
          pageCount: this.countPages(preScanText),
          confidence: preScanQuality,
          warnings: [],
        };
      }

      // ── Step 2: Full visual OCR ─────────────────────────────────────────
      // Use --force-ocr so Tesseract ignores any garbled/custom-encoded text
      // layer and re-OCRs every page visually from pixel data.
      // --rotate-pages: auto-correct portrait/landscape page rotation.
      // --deskew:       straighten pages that are slightly tilted when scanned.
      // --clean:        remove background noise from scanned images before OCR.
      // --optimize 1:   lossless compression optimisation on output images.
      // --image-dpi 300: assume 300 DPI when PDF does not declare an image DPI.
      //                 Low DPI is the #1 cause of garbled Thai OCR output.
      //
      // Note: we deliberately do NOT pass `preserve_interword_spaces=1`.
      // That Tesseract option preserves micro-gaps between glyphs, which is
      // useful for Latin scripts but disastrous for Thai (which has no inter-
      // character spacing). With it enabled, output looks like
      //   "ป ร ะ ก า ศ" instead of "ประกาศ".
      await execFileAsync(
        'ocrmypdf',
        [
          '--language', languages,
          '--output-type', 'pdf',
          '--force-ocr',
          '--rotate-pages',
          '--deskew',
          '--clean',
          '--optimize', '1',
          '--image-dpi', '300',
          inputPath,
          outputPath,
        ],
        { timeout: timeoutMs },
      );

      const ocrText = await this.runPdfToText(outputPath);
      const searchablePdfBuffer = await readFile(outputPath);
      const text = ocrText || preScanText; // prefer fresh OCR; fall back to pre-scan
      const warnings: string[] = [];

      if (!ocrText && preScanText) {
        warnings.push('ocrmypdf produced no text — using pre-scanned text as fallback');
      }

      return {
        text,
        pageCount: this.countPages(text),
        confidence: this.estimateConfidence(text),
        searchablePdfBuffer,
        warnings,
      };
    } catch (ocrError) {
      // ocrmypdf failed (e.g. ghostscript error, PDF is corrupt).
      // Re-attempt pdftotext on the original so we still return something.
      const fallbackText = await this.runPdfToText(inputPath).catch(() => '');
      if (fallbackText) {
        return {
          text: fallbackText,
          pageCount: this.countPages(fallbackText),
          confidence: this.estimateConfidence(fallbackText),
          warnings: [`ocrmypdf failed — using pdftotext on original: ${errorMessage(ocrError)}`],
        };
      }
      return {
        text: '',
        pageCount: 0,
        confidence: 0,
        warnings: [
          `OCR failed completely: ${errorMessage(ocrError)}`,
          'pdftotext on original also returned empty output',
        ],
      };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Run pdftotext and return the text content.
   * Does NOT use `-layout` because Thai documents are not columnar in the same
   * way as English — `-layout` often merges or splits Thai lines incorrectly.
   * `-enc UTF-8` guarantees valid UTF-8 output regardless of host locale.
   * `-nopgbrk` is NOT set so we keep form-feed separators for page counting.
   */
  private async runPdfToText(pdfPath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'pdftotext',
        ['-enc', 'UTF-8', pdfPath, '-'],
        { timeout: 30_000, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
      );
      return this.cleanOcrText(stdout.trim());
    } catch {
      return '';
    }
  }

  /**
   * Post-process raw OCR / pdftotext output for Thai.
   *
   * Tesseract and pdftotext can introduce a set of well-known artifacts:
   *   \u0000  null bytes       — appear in some PDF streams
   *   \uFFFD  replacement char — encoding fallback when byte sequence is invalid
   *   \u200B  zero-width space — sometimes inserted by OCR between Thai chars
   *   \u00AD  soft hyphen      — appears in some PDF text layers
   *
   * Unicode NFC normalisation fixes decomposed Thai vowel stacks that some OCR
   * engines produce (e.g. sara-a + thanthakat as separate code points instead of
   * the composed form), which show as garbled or duplicated vowels in display.
   */
  private cleanOcrText(text: string): string {
    return text
      .normalize('NFC')                          // fix decomposed Thai vowels
      .replace(/[\u0000\uFFFD\u00AD]/g, '')      // null, replacement char, soft hyphen
      .replace(/\u200B+/g, '')                   // zero-width spaces
      // Collapse spaces between consecutive Thai characters. Tesseract often
      // inserts a single space between every Thai glyph because Thai has no
      // word boundaries. Using a lookahead lets one global pass handle long
      // runs like "ก ข ค ง" → "กขคง". Applied twice for safety on tabs and
      // mixed whitespace runs.
      .replace(/([\u0E00-\u0E7F])[ \t]+(?=[\u0E00-\u0E7F])/g, '$1')
      .replace(/([\u0E00-\u0E7F])[ \t]+(?=[\u0E00-\u0E7F])/g, '$1')
      // Tighten punctuation that Tesseract tokenises with surrounding spaces
      // in Thai context. Common cases: "พ . ศ . 2566" → "พ.ศ. 2566";
      // "ข้อ 1 ." → "ข้อ 1.". We only collapse the space BEFORE a dot/comma
      // when the dot is followed by another non-space char or end-of-line.
      .replace(/([\u0E00-\u0E7F\d])\s+([.,])/g, '$1$2')
      // Remove space after opening paren / before closing paren when the inner
      // content starts/ends with Thai or a digit. Covers "( ฉบับที่ 2 )" → "(ฉบับที่ 2)".
      .replace(/\(\s+(?=[\u0E00-\u0E7F\d])/g, '(')
      .replace(/([\u0E00-\u0E7F\d])\s+\)/g, '$1)')
      .replace(/[ \t]+/g, ' ')                   // collapse horizontal whitespace
      .replace(/\n{3,}/g, '\n\n')                // max two consecutive blank lines
      .trim();
  }

  /**
   * Estimate text quality as a confidence score [0, 1].
   *
   * For Thai regulatory documents, any meaningful output should contain Thai
   * characters.  Zero Thai characters means the text is either:
   *   - empty (image-only PDF — needs OCR)
   *   - garbled (custom-encoded Thai glyphs mapped to wrong codepoints — needs
   *     --force-ocr to bypass the broken embedded text layer)
   *
   * Score formula:
   *   - 0 when text is empty, whitespace-only, or has no Thai characters at all
   *   - 0.4 + ratio × 0.6 when Thai characters are present (max 1.0)
   *     where ratio = thaiCount / totalNonWhitespace
   */
  private estimateConfidence(text: string): number {
    if (!text) return 0;
    const meaningful = text.replace(/\s+/g, '');
    if (!meaningful) return 0;
    const thaiCount = (text.match(/[ก-๙]/g) ?? []).length;
    if (thaiCount === 0) return 0; // no Thai → garbled or image-only
    const ratio = thaiCount / meaningful.length;
    return Math.min(1, 0.4 + ratio * 0.6);
  }

  /** Count pages by form-feed separators that pdftotext inserts between pages. */
  private countPages(text: string): number {
    if (!text) return 0;
    return text.split('\f').filter((page) => page.trim().length > 0).length || 1;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

