---
name: docai-prisma-schema-design
description: "Design DocAI Prisma schema, migrations, indexes, seed data, and transactional data flows. Use for documents, prompt versions, AI results, review, rulebooks, compliance checks, audit logs, queues, and storage metadata."
argument-hint: "Data model or workflow to design"
---
# DocAI Prisma Schema Design

## When To Use

- A feature needs new or changed Prisma models, enums, relations, indexes, migrations, seed data, or transaction behavior.
- A workflow involves immutable versioning, audit logs, deduplication, queue state, object storage metadata, or human review gates.

## Procedure

1. Map the workflow to business entities and decide which records are mutable workflow state and which require immutable versions.
2. Prefer explicit version tables for artifacts whose history matters: documents, prompt templates, prompt instances, AI analysis results, master rulebooks, rule variants, compliance checks, and exports.
3. Define Prisma enums for controlled workflow states and document the allowed state transitions in code or docs.
4. Add audit fields and relations needed to record actor, action, entity type, entity ID, previous state, next state, timestamp, correlation ID, and metadata.
5. Add object storage metadata models instead of storing binary or large generated artifacts in PostgreSQL.
6. Design deduplication rules in order: source URL, binary file hash, extracted content hash. If a known URL points to changed content, model it as a new document version.
7. Add indexes for list filters, queue polling, review queues, and common joins. Prefer composite indexes when query shape is known.
8. Plan migrations additively. Avoid destructive migration steps unless the user explicitly asks for a production migration plan.
9. Identify transaction boundaries for state transitions that combine database writes, review decisions, version creation, queueing, and audit records.
10. Define seed data only for stable bootstrap concepts such as roles, permissions, and system settings.

## Review Checklist

- Versioning is immutable where history matters.
- Workflow states are explicit and indexed where queried.
- Audit writes can be performed in the same transaction as state changes.
- Large artifacts live in object storage with metadata records.
- Deduplication constraints match the import workflow.
- Migration names describe the business change.
