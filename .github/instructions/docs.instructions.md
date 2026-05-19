---
description: "Use when creating or modifying DocAI Markdown documentation in Docs. Covers bilingual Thai/English writing, decision traceability, architecture updates, and product documentation structure."
applyTo:
  - "Docs/**/*.md"
---
# DocAI Documentation Instructions

## Writing Style

- Keep documentation clear enough for product, engineering, compliance, and audit readers.
- Thai is appropriate for product intent, regulatory context, and user workflows. English is appropriate for technical identifiers, schema names, service names, and implementation terms.
- Use consistent Markdown headings, short paragraphs, tables when they improve scanning, and fenced code blocks for structured examples.
- Preserve exact technical names such as DocumentVersion, PromptTemplateVersion, MasterRulebookVersion, MinIO, Prisma, NestJS, Next.js, Redis, and BullMQ.

## Content Rules

- Treat `Docs/Project Design Document.md` as the main product and architecture reference unless a later document supersedes it.
- When adding decisions, explain the reason, affected components, data implications, review gates, and operational impact.
- Keep product requirements separate from implementation notes when possible. Do not bury major product decisions only in code comments.
- Avoid MVP framing for new work unless the document is explicitly discussing a historical or staged delivery note.

## Traceability

- Link workflows to data models, API surfaces, UI screens, worker jobs, audit logs, and storage artifacts when the connection matters.
- Document unresolved decisions as open questions with owner, impact, and recommended default.
- Update documentation when implementation changes workflow states, review gates, supported sources, OCR strategy, AI analysis behavior, rulebook governance, compliance decisions, or reporting/export behavior.
