---
name: docai-ocr-pipeline
description: "Implement or evaluate DocAI OCR workflows. Use for Tesseract, OCRmyPDF, Poppler, PaddleOCR, PDF classification, Thai OCR quality scoring, artifact storage, extraction comparison, retries, and failure handling."
argument-hint: "OCR feature or document type"
---
# DocAI OCR Pipeline

## When To Use

- A task creates, changes, evaluates, or debugs PDF text extraction or OCR behavior.
- Work involves Tesseract, OCRmyPDF, Poppler, PaddleOCR, Thai text quality, artifact storage, or OCR worker jobs.

## Procedure

1. Classify the input: text-based PDF, scan/image-based PDF, mixed PDF, table-heavy PDF, image file, low-quality scan, or unsupported file.
2. Try native text extraction when the PDF already has usable text. Use OCR only when extracted text quality is insufficient.
3. Use the baseline OCR toolchain from the design document: Tesseract, OCRmyPDF, and Poppler. Add PaddleOCR support through an engine adapter when the feature requires higher-quality comparison.
4. Store all generated artifacts in object storage: normalized text, page text, OCR PDF, page images if produced, quality reports, and engine logs where appropriate.
5. Record OCR metadata in PostgreSQL: engine, version, language settings, confidence/quality score, page count, artifact IDs, status, failure reason, and timings.
6. Compare OCR results using deterministic quality signals such as text length, Thai character ratio, confidence, page coverage, table preservation, and extraction errors.
7. Make OCR worker jobs idempotent. Reuse successful results for the same document version and OCR configuration.
8. Handle partial page failures explicitly and preserve enough artifact detail for human inspection.
9. Route low-confidence results to review or manual inspection when they affect AI analysis or compliance decisions.
10. Add fixture-based tests for text PDFs, scan PDFs, Thai text, mixed pages, table-heavy pages, and engine failures.

## Guardrails

- Do not hardcode OCR binaries or language packs outside configuration/runtime setup.
- Do not mark OCR complete before artifacts and metadata are persisted.
- Do not overwrite artifacts for an immutable document version and OCR configuration.
