---
name: docai-reporting-export
description: "Design or implement DocAI reporting and export workflows. Use for review reports, compliance reports, rulebook exports, async export jobs, filters, access control, downloadable artifacts, storage metadata, and traceable source references."
argument-hint: "Report or export workflow"
---
# DocAI Reporting And Export

## When To Use

- A task creates or modifies reports, dashboards, downloadable exports, rulebook exports, compliance evidence packs, or audit-oriented summaries.

## Procedure

1. Identify report audience: analyst, reviewer, compliance officer, auditor, admin, or operator.
2. Define report scope, filters, date ranges, domains, statuses, users, document groups, source systems, rulebook versions, and compliance check IDs.
3. Use async export jobs for heavy reports or files. Return job status immediately and provide a download artifact when complete.
4. Store generated exports in object storage and export metadata in PostgreSQL.
5. Include traceable references back to source documents, document versions, OCR artifacts, prompt instances, AI results, review decisions, rulebook versions, and compliance checks.
6. Enforce access control for report generation and download. Signed URLs or download tokens must be short-lived and auditable.
7. Make export jobs idempotent when rerunning the same requested export should not create duplicate artifacts.
8. Redact sensitive fields according to role and export type.
9. Audit export request, generation, download, failure, retry, and deletion/expiration events.
10. Test filters, authorization, export job states, artifact persistence, trace references, and download behavior.

## Guardrails

- Do not generate large export files synchronously inside request handlers.
- Do not expose object storage internals or permanent public URLs to frontend clients.
- Do not export unreviewed AI decisions as final compliance findings.
