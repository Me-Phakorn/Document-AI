---
name: docai-compliance-check
description: "Design or implement DocAI compliance checking workflows. Use for checking content against rulebook versions, risk classification, AI-assisted findings, citations, reviewer gates, final decisions, notifications, and audit records."
argument-hint: "Compliance scenario or content type"
---
# DocAI Compliance Check

## When To Use

- A task creates, changes, reviews, or tests compliance checking for text, images, screenshots, PDFs, web pages, campaign material, contracts, or other external content.

## Procedure

1. Identify the input content type and extraction needs: raw text, image OCR, screenshot, PDF extraction, webpage scrape, uploaded file, or manual text.
2. Select the rulebook version and compliance domain explicitly. Never run checks against an unversioned or mutable rulebook reference.
3. Create a compliance check record with input metadata, actor, selected rulebook version, prompt/template version, status, and correlation ID.
4. Run extraction and AI analysis through provider adapters with configuration-driven model/provider selection.
5. Persist findings with matched rule IDs, citations, explanation, confidence, risk level, source snippets, and evidence artifact links.
6. Route ambiguous, high-risk, low-confidence, or notification-triggering outcomes to human review before finalization.
7. Record reviewer decision, final status, remediation notes, and notification eligibility.
8. Send notifications only after required review gates pass and the operation is idempotently recorded.
9. Audit submission, analysis, reviewer decisions, finalization, notification, export, and access events.
10. Test rule matching, risk classification, review gating, idempotent retries, notification suppression before approval, and report output.

## Output Shape

- Input and rulebook selection.
- Findings and risk model.
- Review gate requirements.
- Audit and notification behavior.
- Tests and documentation updates.
