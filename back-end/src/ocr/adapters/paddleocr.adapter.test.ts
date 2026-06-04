/**
 * Unit tests for PaddleOcrAdapter.
 *
 * All network calls are intercepted by mocking the global `fetch`.
 * ConfigService is replaced with a lightweight shim so there is no NestJS DI overhead.
 */
import { describe, expect, it, vi } from 'vitest';
import { PaddleOcrAdapter } from './paddleocr.adapter';

// Minimal ConfigService shim
function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (overrides[key] as T) ?? (fallback as T),
  } as import('@nestjs/config').ConfigService;
}

const PDF_BUFFER = Buffer.from('%PDF-1.4 dummy');

describe('PaddleOcrAdapter', () => {
  it('returns OCR result on 200 response', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: 'ประกาศธนาคาร',
          page_count: 2,
          confidence: 0.87,
          warnings: [],
        }),
      }),
    );

    const result = await adapter.run(PDF_BUFFER, { languages: ['tha', 'eng'] });

    expect(result.text).toBe('ประกาศธนาคาร');
    expect(result.pageCount).toBe(2);
    expect(result.confidence).toBe(0.87);
    expect(result.warnings).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  it('sends base64 PDF and language list in request body', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '', page_count: 0, confidence: 0, warnings: [] }),
    });
    vi.stubGlobal('fetch', spy);

    await adapter.run(PDF_BUFFER, { languages: ['tha'] });

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/ocr');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.pdf_base64).toBe(PDF_BUFFER.toString('base64'));
    expect(body.languages).toEqual(['tha']);

    vi.unstubAllGlobals();
  });

  it('uses PADDLEOCR_URL from config', async () => {
    const adapter = new PaddleOcrAdapter(
      makeConfig({ PADDLEOCR_URL: 'http://custom-sidecar:9000' }),
    );
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '', page_count: 0, confidence: 0, warnings: [] }),
    });
    vi.stubGlobal('fetch', spy);

    await adapter.run(PDF_BUFFER, { languages: [] });

    const [url] = spy.mock.calls[0] as [string];
    expect(url).toBe('http://custom-sidecar:9000/ocr');

    vi.unstubAllGlobals();
  });

  it('returns warning + empty result on non-2xx HTTP response', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      }),
    );

    const result = await adapter.run(PDF_BUFFER, { languages: ['tha'] });

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toContain('HTTP 503');

    vi.unstubAllGlobals();
  });

  it('returns warning + empty result when fetch rejects (network error)', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    const result = await adapter.run(PDF_BUFFER, { languages: [] });

    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.warnings[0]).toContain('ECONNREFUSED');

    vi.unstubAllGlobals();
  });

  it('clamps confidence to [0, 1] for out-of-range sidecar values', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());

    for (const raw of [1.5, -0.2]) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ text: 'x', page_count: 1, confidence: raw, warnings: [] }),
        }),
      );
      const result = await adapter.run(PDF_BUFFER, { languages: [] });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      vi.unstubAllGlobals();
    }
  });

  it('falls back to default languages when options.languages is empty', async () => {
    const adapter = new PaddleOcrAdapter(makeConfig());
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '', page_count: 0, confidence: 0, warnings: [] }),
    });
    vi.stubGlobal('fetch', spy);

    await adapter.run(PDF_BUFFER, { languages: [] });

    const body = JSON.parse((spy.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(body.languages).toEqual(['tha', 'eng']);

    vi.unstubAllGlobals();
  });
});
