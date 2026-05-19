---
name: docai-ai-analysis-queue
description: "Design or implement DocAI AI analysis queues. Use for document groups, FIFO batch processing, prompt instances, provider adapters, cached AI results, retry/partial failure handling, review routing, and auditability."
argument-hint: "AI analysis or batch workflow"
---
# DocAI AI Analysis Queue

## When To Use

- A task creates or modifies AI analysis orchestration, document group processing, prompt rendering, provider adapters, queue jobs, review routing, or AI result persistence.

## Procedure

1. Identify the analysis input: document version, document group, OCR result, extracted text, selected prompt template version, domain, and user-provided instructions.
2. Create a PromptInstance for each analysis run. Store rendered prompt metadata, prompt template version, provider configuration reference, input document version, and correlation ID.
3. Enqueue jobs with deterministic deduplication keys so retries or repeated clicks do not duplicate AI analysis for the same intended operation.
4. Preserve FIFO processing inside a Document Group when the group workflow requires ordered processing.
5. Use AI provider adapters. Do not hardcode provider or model names in analysis services or workers.
6. Cache or reuse AI results when document version, prompt template version, analysis configuration, and provider policy allow it.
7. Persist AI outputs with citations, extracted obligations, risks, confidence, source page references, raw provider metadata where allowed, and normalized result fields.
8. Route outputs requiring human approval to the Review Center before they can become trusted rulebook or compliance decisions.
9. Handle partial failures at document level and roll up group status as queued, running, partial failed, failed, canceled, or completed.
10. Audit enqueue, start, completion, failure, retry, cancellation, review routing, and result approval events.

## Verification

- Test prompt instance creation, idempotent enqueueing, provider adapter selection, retry behavior, partial group failure, result persistence, and review gate routing.
