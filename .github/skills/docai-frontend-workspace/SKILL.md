---
name: docai-frontend-workspace
description: "Build or review DocAI Next.js admin workspace screens. Use for dashboard, document management, website sources, AI analysis, prompt library, review center, rulebook, compliance checker, reports, settings, and role-aware navigation."
argument-hint: "Frontend screen or workflow"
---
# DocAI Frontend Workspace

## When To Use

- A task creates, changes, or reviews frontend screens in `front-end`.
- A workflow needs role-aware navigation, operational tables, review UX, queue progress, or compliance decision UI.

## Procedure

1. Identify the target user role and primary job: analyst, reviewer, admin, auditor, or operator.
2. Map the screen to a DocAI workflow from the design document and identify backend APIs, state transitions, and audit-sensitive actions. Check `Docs/Frontend Dashboard Design References.md` for the preferred dashboard reference direction before designing new layouts.
3. Use a work-focused layout with dense but readable tables, filters, tabs, split panes, detail panels, and action menus as appropriate. Style screens with Tailwind CSS utilities and shared design tokens.
4. Show explicit states for queued, processing, partial failed, failed, canceled, completed, pending review, approved, rejected, draft, published, and deprecated records.
5. For review workflows, keep source metadata, extracted text or OCR result, AI output, citations, comments, previous rounds, and reviewer actions visible without context loss.
6. For prompt and rulebook workflows, show version number, status, source references, reviewer decisions, and publish actions clearly.
7. Use typed API client types. Avoid duplicating DTO shapes by hand when generated or shared types exist.
8. Implement role-aware UI while relying on backend RBAC for security enforcement.
9. Check accessibility: keyboard navigation, focus states, labels, contrast, Thai text readability, and responsive behavior.
10. Add focused tests for the workflow and document any validation that cannot run yet.

## Design Guardrails

- Do not build a landing page for admin functionality.
- Do not hardcode a component library choice until selected; Tailwind CSS is already the styling foundation.
- Do not hide workflow status behind vague loading text when a queue/job record exists.
