---
description: "Use when designing or modifying DocAI Prisma schema, migrations, seed data, and database access. Covers immutable versions, workflow enums, audit schema, indexes, deduplication, and transaction safety."
applyTo:
  - "back-end/prisma/**/*"
  - "back-end/src/**/*.seed.ts"
  - "back-end/src/**/prisma/**/*.ts"
---
# DocAI Prisma And Database Instructions

## Schema Design

- Model versioned business artifacts with immutable version tables. Core examples include DocumentVersion, PromptTemplateVersion, PromptInstance, AIAnalysisResult, MasterRulebookVersion, RuleVersion or RuleVariant, ComplianceCheckVersion, and ExportArtifact.
- Use Prisma enums for workflow states instead of unbounded strings when the state set is controlled by the application.
- Keep source objects, extracted text, OCR artifacts, AI results, review decisions, and published rulebooks linked with stable IDs for audit traceability.
- Store binary files and large generated artifacts in MinIO-compatible object storage; store metadata and references in PostgreSQL.

## Constraints And Indexes

- Encode deduplication constraints for source URL, file hash, and content hash where the business rule is stable.
- Add indexes for common filters and queues: status, createdAt, updatedAt, ownerId, documentId, documentVersionId, documentGroupId, promptTemplateVersionId, rulebookVersionId, reviewStatus, and job type/status fields.
- Use composite indexes when screens or workers consistently query by tenant or organization, status, and createdAt after multi-tenancy is decided.
- Avoid nullable fields for required workflow invariants. Use nullable fields only for genuinely optional lifecycle data.

## Migrations And Safety

- Name migrations descriptively, such as `add_document_version_audit_fields` or `create_prompt_template_versions`.
- Do not drop columns, tables, enums, or constraints in the same change that removes application usage unless the user explicitly asks for a destructive migration plan.
- Prefer additive migrations and backfill steps for production-sensitive changes.
- Use Prisma transactions for multi-record state transitions and pair them with audit log writes.
- Avoid raw SQL unless Prisma cannot express the operation safely. If raw SQL is necessary, isolate it in a service/helper and document the reason in the surrounding code or migration notes.

## Seed Data

- Seed only stable bootstrap data, such as baseline roles, permissions, workflow statuses if modeled as rows, and initial system settings.
- Do not seed domain-specific Thai rules as code fixtures. Domain rules belong in imported documents, prompt outputs, reviewed rulebooks, or environment-specific seed packs.
