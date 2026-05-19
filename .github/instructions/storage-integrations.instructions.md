---
description: "Use when creating or modifying DocAI storage, MinIO, document artifact, crawler download, OCR artifact, export, and integration code. Covers object keys, hashing, metadata, retention hooks, and configuration."
applyTo:
  - "back-end/src/**/storage/**/*.ts"
  - "back-end/src/**/integrations/**/*.ts"
  - "back-end/src/**/minio/**/*.ts"
  - "back-end/src/**/documents/**/*.ts"
  - "back-end/src/**/crawler/**/*.ts"
  - "back-end/src/**/ocr/**/*.ts"
  - "back-end/src/**/exports/**/*.ts"
---
# DocAI Storage And Integration Instructions

## Object Storage

- Use MinIO-compatible object storage for source PDFs, OCR outputs, extracted text artifacts, crawler downloads, screenshots, generated reports, and export bundles.
- Keep bucket names, endpoints, credentials, regions, retention settings, and public access policy in typed configuration.
- Do not put large binary artifacts, full OCR payloads, or generated export files directly in PostgreSQL.
- Store object metadata in PostgreSQL with stable object keys, content type, byte size, checksum, source entity, lifecycle status, and createdAt.

## Keys And Hashes

- Design object keys to be deterministic enough for traceability but not dependent on user-controlled filenames alone.
- Compute binary file hashes before import deduplication and content hashes after text extraction or OCR normalization.
- Keep original filenames as metadata, not as the only object identity.
- Never overwrite immutable source artifacts. New content should create a new object record and usually a new document version.

## Integrations

- Wrap storage clients, crawler HTTP clients, OCR binaries, AI SDKs, email/webhook clients, and export generators in dedicated services.
- Add timeouts, retry limits, rate limits, and structured errors for external calls.
- Redact secrets and signed URLs in logs unless the log is explicitly designed as a short-lived secure audit record.
