---
name: docai-security-audit
description: "Review DocAI security and audit posture. Use for RBAC, audit logs, PII/document access, object storage permissions, external AI data handling, crawler behavior, export access, secrets, tenancy, and compliance-sensitive workflows."
argument-hint: "Security area or workflow to review"
---
# DocAI Security Audit

## When To Use

- A task asks for a security review, auditability review, access-control review, privacy review, or risk analysis of DocAI workflows.
- A feature handles sensitive documents, user permissions, AI provider calls, object storage, exports, notifications, or crawler behavior.

## Procedure

1. Identify assets and actors: source documents, OCR artifacts, AI prompts/results, rulebooks, compliance checks, exports, audit logs, users, reviewers, admins, workers, and external services.
2. Review authorization at backend boundaries first. Frontend role checks are UX only.
3. Confirm state-changing operations write audit logs with actor, action, entity type, entity ID, previous state, next state, timestamp, correlation ID, and request metadata.
4. Check that human review gates protect AI-generated rulebooks, high-risk compliance decisions, and notification-triggering outputs.
5. Verify object storage access: private buckets, short-lived signed URLs, metadata records, no permanent public links, and no secret leakage in logs.
6. Review AI data handling: provider abstraction, configurable provider/model, prompt/result traceability, data retention policy hooks, and no accidental hardcoding of external provider assumptions.
7. Review crawler behavior: allowed domains, rate limits, timeouts, robots/policy considerations where applicable, deduplication, and safe error handling.
8. Review exports and reports for authorization, redaction, traceability, short-lived download access, and audit events.
9. Review secrets and configuration for environment-variable usage, example placeholders, and no committed credentials.
10. Produce findings ordered by severity with file references, impact, recommendation, and tests or checks to add.

## Finding Categories

- Critical: unauthorized access, data leak, destructive state change, secret exposure, missing review gate for high-risk output.
- High: missing backend authorization, incomplete audit trail, permanent public export access, non-idempotent notification workflow.
- Medium: insufficient logging, weak validation, missing rate limits, unclear retention behavior.
- Low: documentation gaps, minor hardening opportunities, missing non-sensitive metadata.
