# DocAI Project Instructions

DocAI is a production-grade document intelligence and compliance platform. Treat [Docs/Project Design Document.md](../Docs/Project%20Design%20Document.md) as the source of truth for product scope, workflow intent, and architecture decisions.

## Project Scope

- Build the complete project, not an MVP-limited version, unless the user explicitly asks to preserve or edit older wording in documentation.
- Use the fixed monorepo layout: `front-end` for the Next.js application and `back-end` for the NestJS API, workers, Prisma schema, and integrations.
- Keep the product `Thailand-first` and `domain-agnostic`: Thai regulatory documents are the baseline, but code must support multiple compliance domains through configuration, prompts, rulebooks, and data models.
- Prefer document-first traceability. Important code, schema, workflow, and UI decisions should map back to the design document or be documented as new decisions.

## Architecture

- Use PostgreSQL for relational metadata, workflow state, review decisions, prompt metadata, audit logs, and compliance records.
- Use Prisma in `back-end` as the schema source of truth, migration layer, and primary data access layer.
- Use MinIO-compatible object storage for source documents, OCR artifacts, crawler downloads, exports, screenshots, and derived files.
- Use NestJS module boundaries for backend domains such as documents, sources, crawler, OCR, analysis, prompts, review, rulebook, compliance, reports, users, audit, storage, and workers.
- Use queue-backed async processing for crawler, OCR, AI analysis, export, and notification workflows. BullMQ with Redis is the planned default, but isolate queue concepts behind services where practical.
- Use Tailwind CSS as the frontend styling system for `front-end`. Component library choices can still be decided later, but styling should remain Tailwind-first.
- Keep AI providers, OCR engines, crawler strategies, storage buckets, auth providers, and deployment-specific values config-driven. Do not hardcode provider names, model names, bucket names, retention durations, or environment-specific URLs.

## Data And Workflow Rules

- Preserve immutable versioning for documents, prompt templates, prompt instances, AI results, master rulebooks, rule variants, compliance checks, and published exports where history matters.
- Use human review gates before AI-generated analysis becomes a trusted rulebook, before high-risk compliance decisions are finalized, and before notification workflows depend on AI output.
- State-changing operations must be auditable. Record actor, action, entity type, entity ID, previous state, next state, timestamp, correlation ID, and relevant request metadata.
- Use transactional state transitions for workflows that combine database writes with review, publishing, queueing, or audit records.
- Make worker operations idempotent. Re-running a job must not duplicate documents, OCR results, prompt instances, analysis records, exports, or notifications.
- Apply deduplication in this order when importing external documents: source URL, binary file hash, then extracted content hash. If a known URL points to changed content, create a new document version.

## Implementation Style

- Keep changes scoped to the current feature area and preserve existing user changes.
- Add abstractions only when they protect a real boundary, such as AI provider adapters, OCR engine adapters, crawler source strategies, storage adapters, queue services, or audit helpers.
- Prefer typed contracts between frontend and backend. Backend OpenAPI definitions should drive frontend API clients once the apps exist.
- Do not create or keep `e2e` test files or directories. Use unit, integration, contract, fixture-based, and focused workflow tests instead unless the user explicitly changes this policy.
- Update documentation when product behavior, workflow states, data ownership, review gates, or operational assumptions change.
- Before finishing implementation work, run the narrowest useful validation available for the touched area and report any validation that could not be run.
