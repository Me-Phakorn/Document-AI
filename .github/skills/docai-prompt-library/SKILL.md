---
name: docai-prompt-library
description: "Manage DocAI prompt library workflows. Use for prompt template creation, versioning, activation, deprecation, test runs, prompt instances, provider-neutral metadata, audit trails, and safe reuse across document analysis and compliance workflows."
argument-hint: "Prompt workflow or template"
---
# DocAI Prompt Library

## When To Use

- A task creates, modifies, reviews, tests, activates, deprecates, or audits prompt templates and prompt instances.
- A feature needs reusable prompts for OCR post-processing, document analysis, rule extraction, compliance checks, summaries, or reviewer-assisted regeneration.

## Procedure

1. Define the prompt purpose, target workflow, input documents, expected structured output, domain scope, and reviewer impact.
2. Store prompt templates as versioned artifacts. Editing an active or published prompt creates a new draft version.
3. Track prompt metadata: name, description, domain tags, task type, language expectations, output schema, owner, status, createdAt, updatedAt, and deprecation reason.
4. Keep provider/model selection out of the prompt template unless the project explicitly adds provider-specific prompt variants.
5. For every AI run, create a PromptInstance linked to the prompt template version, document version or compliance input, rendered variables, correlation ID, and analysis job.
6. Add test cases for representative Thai regulatory text, tables, ambiguous obligations, citations, and rejection/regeneration comments.
7. Require review before prompt output becomes trusted rulebook content or a high-risk compliance decision.
8. Audit prompt version creation, activation, deprecation, execution, reviewer decisions, and regeneration requests.
9. Document prompt behavior changes when they affect analysis output or reviewer workflow.

## Quality Checks

- Prompt output schema is explicit and testable.
- Prompt versions are immutable after activation or publication.
- Prompt instances are traceable to inputs, versions, and results.
- Provider choices remain configuration-driven.
