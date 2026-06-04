/**
 * Unit tests for TesseractAdapter.
 *
 * Process-spawning paths (ocrmypdf / pdftotext) require the real binaries and
 * are covered by integration tests on the container.  Here we test:
 *
 *   • engineId value
 *   • cleanOcrText()       — post-processing for Thai OCR artifacts
 *   • estimateConfidence() — confidence heuristic
 *   • countPages()         — page count from form-feed separators
 *   • QUALITY_THRESHOLD    — static threshold value
 */
import { describe, expect, it } from 'vitest';
import { TesseractAdapter } from './tesseract.adapter';

describe('TesseractAdapter', () => {
  const adapter = new TesseractAdapter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = adapter as any;

  it('exposes the correct engineId', () => {
    expect(adapter.engineId).toBe('ocrmypdf-tesseract');
  });

  it('QUALITY_THRESHOLD is 0.3', () => {
    expect(TesseractAdapter['QUALITY_THRESHOLD']).toBe(0.3);
  });

  // ── cleanOcrText ──────────────────────────────────────────────────────────

  describe('cleanOcrText()', () => {
    it('removes null bytes (\\u0000)', () => {
      expect(a.cleanOcrText('สวัสดี\u0000โลก')).toBe('สวัสดีโลก');
    });

    it('removes replacement characters (\\uFFFD)', () => {
      expect(a.cleanOcrText('hello\uFFFDworld')).toBe('helloworld');
    });

    it('removes soft hyphens (\\u00AD)', () => {
      expect(a.cleanOcrText('บาง\u00ADกอก')).toBe('บางกอก');
    });

    it('removes zero-width spaces (\\u200B) — common OCR artifact in Thai', () => {
      expect(a.cleanOcrText('ก\u200Bข\u200Bค')).toBe('กขค');
    });

    it('collapses multiple spaces and tabs to a single space', () => {
      expect(a.cleanOcrText('hello   \t world')).toBe('hello world');
    });

    it('collapses 3+ consecutive newlines to 2', () => {
      expect(a.cleanOcrText('a\n\n\n\nb')).toBe('a\n\nb');
    });

    it('applies NFC normalisation to decomposed Thai vowels', () => {
      // Thai sara-a (U+0E32) composed vs decomposed sara-aa components
      // NFC should not change already-composed Thai; just verify it runs.
      const composed = 'กา'; // NFC form
      expect(a.cleanOcrText(composed)).toBe('กา');
    });

    it('trims leading/trailing whitespace', () => {
      expect(a.cleanOcrText('  ประกาศ  ')).toBe('ประกาศ');
    });

    it('returns empty string for empty input', () => {
      expect(a.cleanOcrText('')).toBe('');
    });

    it('collapses spaces between consecutive Thai characters (Tesseract artifact)', () => {
      // Tesseract output without preserve_interword_spaces still emits spaces
      // between Thai glyphs sometimes — must be collapsed
      expect(a.cleanOcrText('ป ร ะ ก า ศ')).toBe('ประกาศ');
    });

    it('collapses long Thai runs in one pass (lookahead test)', () => {
      expect(a.cleanOcrText('ก ข ค ง จ ฉ ช')).toBe('กขคงจฉช');
    });

    it('preserves space between Thai and ASCII (mixed-script word boundary)', () => {
      expect(a.cleanOcrText('ครั้งที 16')).toBe('ครั้งที 16');
    });

    it('tightens space before a dot when preceded by Thai or digit', () => {
      // Each pass tightens one boundary: "พ . ศ . 2566" → "พ. ศ. 2566".
      // We deliberately do NOT collapse "พ. ศ." → "พ.ศ." because that would
      // also collapse legitimate sentence-spacing elsewhere.
      expect(a.cleanOcrText('พ . ศ . 2566')).toBe('พ. ศ. 2566');
      expect(a.cleanOcrText('ข้อ 1 .')).toBe('ข้อ 1.');
    });

    it('removes space after opening paren / before closing paren around Thai', () => {
      expect(a.cleanOcrText('( ฉบับที่ 2 )')).toBe('(ฉบับที่ 2)');
    });

    it('handles real-world Tesseract output sample', () => {
      const raw = 'เร ื อ ง ก า ร จ ํ า ห น ่ า ย พ ั น ธ บ ั ต ร ร ั ฐ บ า ล';
      const cleaned = a.cleanOcrText(raw);
      // No space between any two Thai chars
      expect(cleaned).not.toMatch(/[\u0E00-\u0E7F] [\u0E00-\u0E7F]/);
      // Still recognisably Thai
      expect((cleaned.match(/[ก-๙]/g) ?? []).length).toBeGreaterThan(15);
    });
  });

  // ── estimateConfidence ────────────────────────────────────────────────────

  describe('estimateConfidence()', () => {
    it('returns 0 for empty string', () => {
      expect(a.estimateConfidence('')).toBe(0);
    });

    it('returns 0 for whitespace-only text', () => {
      expect(a.estimateConfidence('   \n\t  ')).toBe(0);
    });

    it('returns 0 for ASCII-only text — treated same as garbled (no Thai found)', () => {
      // Without Thai characters, the adapter cannot distinguish real English
      // content from garbled custom-encoded Thai glyphs, so it conservatively
      // returns 0 to trigger --force-ocr on the visual PDF.
      const score = a.estimateConfidence('hello world regulatory text');
      expect(score).toBe(0);
    });

    it('returns ≈ 1.0 for fully-Thai text', () => {
      const score = a.estimateConfidence('กฎหมายระเบียบข้อกำหนดธนาคาร');
      expect(score).toBeGreaterThanOrEqual(0.99);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('returns a score between 0.4 and 1.0 for mixed Thai+ASCII text', () => {
      const score = a.estimateConfidence('Section 1 กฎระเบียบ article');
      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('never exceeds 1.0 even for dense Thai content', () => {
      const longThai = 'ก'.repeat(1000);
      expect(a.estimateConfidence(longThai)).toBeLessThanOrEqual(1.0);
    });

    it('is a monotonically-increasing function of Thai char ratio', () => {
      const low  = a.estimateConfidence('Section กก abc');   // mostly ASCII, tiny Thai
      const high = a.estimateConfidence('กขคงจฉช abcd');     // mostly Thai
      expect(high).toBeGreaterThan(low);
      expect(low).toBeGreaterThan(0); // has some Thai so > 0
    });

    it('garbled Latin-only text scores < QUALITY_THRESHOLD (triggers --force-ocr)', () => {
      // Simulates the "alien language" output from a custom-encoded Thai PDF
      const garbled = '¡¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ';
      expect(a.estimateConfidence(garbled)).toBeLessThan(TesseractAdapter['QUALITY_THRESHOLD']);
    });

    it('empty string scores 0 (triggers --force-ocr for image-only PDFs)', () => {
      expect(a.estimateConfidence('')).toBe(0);
    });
  });

  // ── countPages ────────────────────────────────────────────────────────────

  describe('countPages()', () => {
    it('returns 0 for empty string', () => {
      expect(a.countPages('')).toBe(0);
    });

    it('returns 1 for single-page text (no form-feed)', () => {
      expect(a.countPages('hello world')).toBe(1);
    });

    it('returns 2 for two non-empty pages', () => {
      expect(a.countPages('page one\fpage two')).toBe(2);
    });

    it('returns 3 for three non-empty pages', () => {
      expect(a.countPages('p1\fp2\fp3')).toBe(3);
    });

    it('ignores trailing form-feed / empty segments', () => {
      expect(a.countPages('page one\f')).toBe(1);
      expect(a.countPages('\fpage one\f')).toBe(1);
    });

    it('ignores consecutive empty form-feed segments', () => {
      expect(a.countPages('\f\fpage\f\f')).toBe(1);
    });

    it('falls back to 1 when all segments are whitespace but text exists', () => {
      // The adapter guards: || 1 at the end of countPages
      expect(a.countPages('   ')).toBe(1);
    });
  });
});


