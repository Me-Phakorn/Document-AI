export interface OcrJobOptions {
  /** Language codes passed to the OCR engine, e.g. ['tha', 'eng'] */
  languages: string[];
  /** Maximum milliseconds the adapter may run before aborting. Default: 180 000 */
  timeoutMs?: number;
}

export interface OcrEngineResult {
  /** Full extracted text, UTF-8 */
  text: string;
  /** Total number of pages processed */
  pageCount: number;
  /** Aggregate confidence in [0, 1]. Use engine-native value when available, or a heuristic. */
  confidence: number;
  /** Searchable PDF produced by the OCR run (optional — not all engines produce one). */
  searchablePdfBuffer?: Buffer;
  /** Non-fatal warnings from the engine */
  warnings: string[];
}

export interface IOcrEngineAdapter {
  /** Stable engine identifier stored in OcrArtifact.engine — e.g. 'ocrmypdf-tesseract' */
  readonly engineId: string;
  /** Run OCR on the supplied PDF buffer and return extracted content. */
  run(pdfBuffer: Buffer, options: OcrJobOptions): Promise<OcrEngineResult>;
}
