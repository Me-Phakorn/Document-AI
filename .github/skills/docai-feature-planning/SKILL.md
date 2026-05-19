---
name: docai-feature-planning
description: "Plan DocAI features before coding. Use for turning product/design requirements into monorepo implementation plans across Next.js, NestJS, Prisma, workers, storage, AI, review, rulebook, compliance, docs, and tests."
argument-hint: "Feature or workflow to plan"
---
# DocAI Feature Planning

## When To Use

- A user asks to plan, design, scope, or break down a DocAI feature before implementation.
- A feature touches more than one surface, such as database, API, workers, frontend, documentation, or tests.
- A requirement needs to be checked against the production-grade design document before coding.

## Procedure

1. Read `Docs/Project Design Document.md` sections relevant to the requested feature.
2. State the feature goal in DocAI terms and avoid reducing scope to an MVP unless the user explicitly requests staged delivery.
3. Identify affected surfaces: `front-end`, `back-end/src`, `back-end/prisma`, workers, object storage, queue, AI/OCR/crawler adapters, reports, audit, and documentation.
4. List entities, workflow states, review gates, audit events, object artifacts, and external integrations involved.
5. Identify decisions that must remain configurable, such as provider/model, bucket names, auth strategy, retention, queue settings, and deployment values.
6. Break the work into implementation phases that preserve usable vertical slices and do not skip production requirements.
7. Define validation for each phase: unit tests, integration tests, migration checks, worker retry/idempotency checks, frontend workflow tests, and documentation review.
8. Call out open questions only when implementation would otherwise require guessing a business or security policy.

## Output Shape

- Summary of the feature and design-document alignment.
- Affected files/modules and data model impact.
- Step-by-step implementation plan.
- Verification checklist.
- Open questions and recommended defaults.
