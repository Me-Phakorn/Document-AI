---
description: "Use when creating or modifying DocAI worker, queue, crawler, OCR, AI analysis, export, and notification processor code. Covers idempotency, retries, FIFO, partial failures, heartbeat, logs, and adapters."
applyTo:
  - "back-end/src/**/workers/**/*.ts"
  - "back-end/src/**/worker/**/*.ts"
  - "back-end/src/**/queues/**/*.ts"
  - "back-end/src/**/queue/**/*.ts"
  - "back-end/src/**/crawler/**/*.ts"
  - "back-end/src/**/ocr/**/*.ts"
  - "back-end/src/**/analysis/**/*.ts"
  - "back-end/src/**/exports/**/*.ts"
  - "back-end/src/**/notifications/**/*.ts"
---
# DocAI Worker And Pipeline Instructions

## Queue Rules

- Make jobs idempotent. Check existing database records and object artifacts before doing work that can be retried.
- Use deterministic deduplication keys for import, crawler, OCR, AI analysis, export, and notification jobs where the business operation should run once.
- Preserve FIFO processing inside a Document Group when the group workflow requires ordered AI analysis.
- Allow partial failures. A failed document should not automatically fail the whole group when remaining documents can continue safely.
- Record retry count, failure reason, next retry time, terminal failure state, and recoverable/non-recoverable classification.

## Worker Behavior

- Emit structured logs for job start, progress, retry, completion, failure, cancellation, and skipped duplicate work.
- Include jobId, queueName, documentId, documentVersionId, documentGroupId, sourceId, promptInstanceId, correlationId, and error details when available.
- Update heartbeat or health indicators so the admin dashboard can distinguish idle, busy, stuck, and failed workers.
- Keep external side effects late in the workflow and guard them with persisted state so retries do not duplicate notifications or exports.

## Adapters

- Implement AI providers, OCR engines, crawler strategies, object storage, and notification channels behind interfaces or service boundaries.
- Do not hardcode provider/model choices. Select providers and operational limits through typed configuration.
- Keep crawler source logic source-specific, but keep deduplication, storage, job status, and audit behavior shared.
- Store generated artifacts before marking jobs complete, and store artifact metadata in PostgreSQL.
