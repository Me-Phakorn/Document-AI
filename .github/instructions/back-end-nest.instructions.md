---
description: "Use when creating or modifying DocAI NestJS backend files in back-end/src. Covers module boundaries, DTO validation, OpenAPI, RBAC, audit logging, errors, config, and transactions."
applyTo:
  - "back-end/src/**/*.ts"
---
# DocAI Backend Instructions

## NestJS Structure

- Build backend features as NestJS modules with clear ownership. Prefer modules such as documents, sources, crawler, OCR, analysis, prompts, review, rulebook, compliance, reports, users, audit, storage, and workers.
- Keep controllers thin. Put workflow decisions in services and persistence details behind Prisma-focused repository/service methods.
- Use DTOs with validation for all request bodies, query filters, pagination inputs, and state transition actions.
- Add OpenAPI metadata for public API surfaces: operation summary, request body, response shape, error responses, auth requirements, and pagination/filtering behavior.

## State And Audit

- Treat document processing, review, rulebook publishing, compliance decisions, export generation, and notification dispatch as auditable state machines.
- Use transactions for state changes that also write audit logs, create versions, enqueue jobs, or update related aggregate counters.
- Prefer reusable helpers for audited transitions so before/after state and correlation IDs are recorded consistently.
- Never finalize AI-derived decisions without the review gates required by the design document.

## Security And Configuration

- Enforce RBAC in guards/decorators on backend endpoints. Frontend role checks are only UX hints.
- Keep auth strategy configurable until the project chooses local auth, OAuth/OIDC, SSO, or hybrid auth.
- Load integration settings from typed configuration. Do not hardcode AI providers, model names, MinIO buckets, Redis keys, external base URLs, or retention durations.
- Return structured errors with stable error codes, human-readable messages, correlation IDs, and safe metadata. Do not leak secrets, credentials, raw tokens, or internal stack traces.

## API Behavior

- Use predictable resource-oriented routes under `/api/v1` unless a later architecture decision changes the prefix.
- Support pagination and filtering for lists that can grow: documents, website sources, crawler runs, AI jobs, review items, rulebooks, compliance checks, audit logs, exports, and users.
- Preserve idempotency for import, enqueue, retry, publish, export, and notification-triggering endpoints.
- Keep API responses explicit about workflow status and next available actions.
