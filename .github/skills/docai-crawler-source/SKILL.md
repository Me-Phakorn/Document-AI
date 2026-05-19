---
name: docai-crawler-source
description: "Onboard or modify DocAI website crawler sources. Use for BOT FIPCS and other regulatory sources, pagination, detail pages, PDF discovery, metadata extraction, deduplication, rate limits, storage, and crawler fixtures."
argument-hint: "Website source URL or source type"
---
# DocAI Crawler Source

## When To Use

- A task adds or changes a crawler strategy for a regulatory website or document source.
- The source needs list parsing, pagination, detail-page traversal, related document discovery, PDF download, deduplication, or metadata mapping.

## Procedure

1. Profile the source manually first. Identify list pages, search parameters, pagination, detail pages, related document links, direct PDF links, language indicators, status fields, and date formats.
2. For BOT FIPCS, start from `https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx`, parse table rows, detect pagination, follow related document links, and discover PDFs or attachments.
3. Define source-specific metadata fields and map them to shared document/source models. Preserve original labels and normalized values when both are useful.
4. Define crawl limits: allowed domains, allowed paths, max pages, max depth, rate limit, retry policy, timeout, and user-agent policy.
5. Implement source-specific parsing behind a crawler strategy interface. Keep shared deduplication, storage, audit, queue, and document creation logic outside the strategy.
6. Deduplicate in order: source URL, binary file hash, extracted content hash. Create a new document version when a known URL points to changed content.
7. Store downloaded files in object storage and store crawl/download metadata in PostgreSQL.
8. Make crawler jobs idempotent so retries do not duplicate documents, versions, artifacts, or queue jobs.
9. Add fixtures for representative list pages, pagination, detail pages, missing PDFs, changed files, and malformed rows.
10. Add tests for parser output, pagination behavior, deduplication paths, and failure handling.

## Output Shape

- Source profile and assumptions.
- Metadata mapping.
- Crawl limits and operational safety rules.
- Parser/strategy implementation notes.
- Fixture and test checklist.
