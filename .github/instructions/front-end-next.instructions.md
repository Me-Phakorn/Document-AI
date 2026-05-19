---
description: "Use when creating or modifying DocAI Next.js frontend files in front-end. Covers App Router admin workspace, role-aware UI, typed API usage, review/compliance workflows, and accessibility."
applyTo:
  - "front-end/**/*"
---
# DocAI Frontend Instructions

## Scope

- Build `front-end` as a Next.js admin application for repeated operational work, not a marketing site.
- Prioritize dense, scannable, predictable screens for analysts, reviewers, admins, and auditors.
- Keep UI behavior aligned with the workflow definitions in `Docs/Project Design Document.md`.
- Use `Docs/Frontend Dashboard Design References.md` as the frontend visual direction reference before inventing new dashboard layouts.

## Application Patterns

- Use the Next.js App Router unless the user chooses a different architecture before scaffolding.
- Use Tailwind CSS as the frontend styling system. Keep `globals.css` focused on Tailwind directives, CSS variables, theme tokens, and minimal base styles.
- Keep route groups and page boundaries aligned with product areas: dashboard, documents, website sources, AI analysis, prompt library, review center, rulebook, compliance checker, reports, users, audit, and settings.
- Fetch data through typed API clients generated from or aligned with the NestJS OpenAPI contract. Do not duplicate backend DTO shapes by hand when a generated type exists.
- Represent long-running crawler, OCR, AI analysis, review, export, and notification jobs with explicit loading, queued, running, partial failure, failed, canceled, and completed states.
- Use polling or realtime updates for queue-heavy screens; never leave users guessing after enqueueing a batch job.

## Workflow UI

- Document import screens must show duplicate warnings and enough metadata for users to understand whether a URL, file hash, or content hash matched existing records.
- Document group and batch analysis screens must expose total documents, current item, queue position, progress, failure reasons, and retry/cancel actions where supported.
- Review screens should support side-by-side inspection of source metadata, extracted text/OCR output, AI result, citations, reviewer comments, previous rounds, and approval/rejection actions.
- Prompt, rulebook, and rule variant screens must show version numbers and publishing status. Edits to published artifacts should create new draft versions instead of mutating published records.
- Compliance checker screens must make risk level, matched rules, citations, reviewer gate status, and final decision easy to scan.

## Access And UX Quality

- All sensitive views must be role-aware. Hide unavailable actions, but still rely on backend authorization for enforcement.
- Prefer Tailwind utility classes, shared design tokens, and small reusable components over page-specific CSS files.
- Prefer accessible controls, visible focus states, keyboard support for review workflows, and readable Thai text rendering.
- Use the chosen component library consistently after it is selected, but keep Tailwind CSS as the styling foundation. Until then, avoid hardcoding assumptions about shadcn/ui, MUI, Ant Design, or another library.
- Use concise interface text. Do not add in-app explanatory copy that describes obvious features or implementation details.
