---
description: "Use when creating or modifying DocAI tests and quality checks across frontend, backend, Prisma, workers, crawler, OCR, API contracts, and workflow validation."
applyTo:
  - "front-end/**/*.{spec,test}.{ts,tsx}"
  - "back-end/**/*.{spec,test}.ts"
  - "back-end/test/**/*"
  - "back-end/src/**/__tests__/**/*"
---
# DocAI Testing And Quality Instructions

## Coverage Priorities

- Do not create or keep `e2e` test files or directories, including `front-end/e2e`, `back-end/e2e`, `*.e2e.ts`, or `*.e2e.tsx`, unless the user explicitly reverses this project policy.
- Focus tests on workflow risk: imports, deduplication, document versions, queue idempotency, OCR quality decisions, AI prompt versioning, human review gates, rulebook publishing, compliance decisions, export access, and audit logs.
- Add unit tests for pure transformation logic, DTO validation, state transition helpers, prompt rendering, rule classification, and object key generation.
- Add integration tests for Prisma transactions, NestJS controllers/services, queue processors, storage metadata writes, and API authorization.
- Add frontend workflow tests for role-aware navigation, document import, batch progress, review decisions, prompt version screens, rulebook publishing, compliance checks, and report downloads.

## Fixtures

- Use deterministic crawler fixtures for source-specific parsers such as BOT FIPCS pagination, detail pages, related document links, and PDF discovery.
- Use small representative PDF/OCR fixtures for text-based PDFs, scan-based PDFs, Thai text, tables, and low-quality pages.
- Do not commit large real regulatory documents unless the repo policy allows them. Prefer minimal fixtures or generated samples.

## Assertions

- Assert audit log writes for state-changing operations.
- Assert idempotent retry behavior for workers and endpoints that enqueue or execute background jobs.
- Assert that high-risk or ambiguous AI/compliance outcomes remain gated until a reviewer decision is recorded.
- Assert API error codes and correlation IDs for expected failures.
- When tests cannot run because the app is not scaffolded yet, document the intended validation command in the implementation summary.
