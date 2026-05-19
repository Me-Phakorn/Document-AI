---
name: docai-api-contract
description: "Design DocAI NestJS API contracts. Use for controllers, DTOs, OpenAPI metadata, typed frontend client impact, RBAC, audit requirements, pagination, filtering, structured errors, and idempotent state-changing endpoints."
argument-hint: "API resource or workflow"
---
# DocAI API Contract

## When To Use

- A feature needs new or changed NestJS endpoints, DTOs, OpenAPI documentation, frontend client types, or authorization rules.
- An endpoint starts workflows such as import, crawl, OCR, AI analysis, review, publish, compliance check, export, or notification.

## Procedure

1. Identify the resource and workflow stage the API represents. Keep routes under `/api/v1` unless a later project decision changes the API prefix.
2. Define request DTOs with validation for body, query, pagination, filters, sorting, and state transition commands.
3. Define response DTOs that expose stable IDs, workflow status, version numbers, audit-sensitive timestamps, and next available actions.
4. Add OpenAPI metadata for operation, request body, success response, error responses, auth requirements, and examples where useful.
5. Define RBAC requirements and confirm the backend enforces them with guards/decorators.
6. For state-changing endpoints, define audit event shape and transaction boundaries.
7. Make enqueue, retry, publish, export, and notification-triggering endpoints idempotent with request keys or persisted operation checks.
8. Return structured errors with stable error codes, messages, correlation IDs, and safe metadata.
9. Update or plan updates for frontend typed API clients generated from the OpenAPI contract.
10. Add tests for validation, authorization, successful behavior, idempotency, and expected error codes.

## Output Shape

- Endpoint list with method, path, auth, request DTO, response DTO, and workflow effect.
- Audit and transaction notes.
- Frontend client impact.
- Test cases and documentation updates.
