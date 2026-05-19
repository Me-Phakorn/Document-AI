---
name: docai-review-rulebook
description: "Design or implement DocAI review center and master rulebook workflows. Use for AI result review, reviewer comments, approval/rejection, rule extraction, immutable rulebook versions, rule variants, citations, publishing, export, and re-review triggers."
argument-hint: "Review or rulebook workflow"
---
# DocAI Review And Rulebook

## When To Use

- A task touches Review Center behavior, AI result approval, rulebook drafting, rule variants, citations, publishing, export, or re-review after source changes.

## Procedure

1. Identify the reviewed input: AI analysis result, document version, prompt instance, OCR result, compliance check, or prior rulebook draft.
2. Define reviewer actions: approve, reject, comment, request regeneration, assign, escalate, publish, deprecate, or send back to draft.
3. Preserve review history. Do not overwrite reviewer comments, decisions, citations, or previous AI outputs.
4. Convert approved AI findings into draft rulebook entries with source document references, page/section citations, obligation text, prohibition text, condition text, examples, risk level, and domain tags.
5. Model rulebooks with immutable versions. Publishing a rulebook version freezes its content for compliance checks and exports.
6. Support rule variants for context-specific interpretation while preserving linkage to source rule and source documents.
7. Trigger re-review when source documents, prompt versions, OCR quality, or linked AI analysis results materially change.
8. Audit all review decisions, assignments, publishing events, deprecations, exports, and regeneration requests.
9. Add tests for approval gates, rejection/regeneration loops, immutable publish behavior, citation preservation, and re-review triggers.

## Guardrails

- AI-generated rules are draft content until approved by a human reviewer.
- Published rulebook versions must not be mutated in place.
- Compliance checks must record which rulebook version they used.
