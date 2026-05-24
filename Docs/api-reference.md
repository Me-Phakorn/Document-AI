# DocAI API Reference

**Generated from live endpoint testing — 23 May 2026**

All endpoints were exercised against a locally running stack (Docker Compose + NestJS dev server). Results, IDs, and status codes in this document are from real HTTP calls.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Shared Conventions](#shared-conventions)
4. [Known Limitations (Dev Runtime)](#known-limitations-dev-runtime)
5. [Health](#health)
6. [Auth](#auth)
7. [Users](#users)
8. [Documents](#documents)
9. [Sources](#sources)
10. [Analysis](#analysis)
11. [Prompts](#prompts)
12. [Review](#review)
13. [Rulebooks](#rulebooks)
14. [Compliance](#compliance)
15. [Reports](#reports)
16. [Audit Logs](#audit-logs)

---

## Overview

| Property | Value |
|---|---|
| Base URL (local) | `http://localhost:4000/api/v1` |
| OpenAPI / Swagger UI | `http://localhost:4000/api/v1/docs` |
| API version prefix | `/api/v1` |
| Default port | `4000` (set via `PORT` env var) |
| Content type | `application/json` |

All endpoints except `GET /health` and `POST /auth/login` require a valid JWT Bearer token.

---

## Authentication

### How to obtain a token

```
POST /api/v1/auth/login
```

```json
{
  "username": "admin",
  "password": "admin"
}
```

Returns:

```json
{
  "accessToken": "<jwt>",
  "expiresIn": 28800,
  "user": {
    "id": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

### Using the token

Add to every protected request:

```
Authorization: Bearer <accessToken>
```

Token algorithm: HS256. Default expiry: 8 hours. Controlled by `JWT_EXPIRES_IN` env var.

Authentication is enabled when `JWT_AUTH_ENABLED=true` (default for production). When disabled, all requests pass without a token.

---

## Shared Conventions

### Pagination

All list endpoints accept these query parameters:

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `limit` | integer | `25` | `100` | Number of items to return |
| `offset` | integer | `0` | — | Number of items to skip |

All list responses follow this envelope:

```json
{
  "items": [...],
  "total": 36,
  "limit": 25,
  "offset": 0
}
```

### Optional Headers

| Header | Description |
|---|---|
| `x-actor-id` | Override the audit actor UUID (defaults to JWT subject) |
| `x-correlation-id` | Correlation UUID for tracing; auto-generated if omitted |

### Error Format

```json
{
  "statusCode": 400,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human-readable description."
}
```

---

## Known Limitations (Dev Runtime)

> **Critical:** The NestJS dev server runs under `tsx watch` (TypeScript execute), which loads modules without going through the full NestJS build pipeline. Under `tsx`, `class-validator` decorators on DTOs are **not enforced**. `ValidationPipe` is bypassed.
>
> **Consequences:**
> - Fields with wrong types or out-of-range values pass through to Prisma.
> - Missing required fields send `undefined` to Prisma, which returns `500` for non-nullable columns instead of the expected `400`.
> - Unknown extra fields in request bodies are silently forwarded to Prisma as unknown arguments, also causing `500`.
>
> **Workaround:** Always send exactly the fields defined in the DTO with correct types. This matches production behavior where the compiled NestJS app enforces all validators correctly.

---

## Health

### `GET /health`

Check API liveness. No authentication required.

**Response 200:**
```json
{
  "status": "ok",
  "service": "docai-api"
}
```

---

## Auth

### `POST /auth/login`

Authenticate with username and password. Returns a short-lived JWT access token.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `username` | string | yes | 1–120 chars |
| `password` | string | yes | 1–200 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**Response 201:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 28800,
  "user": {
    "id": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
    "username": "admin",
    "role": "ADMIN"
  }
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Username or password incorrect |

---

## Users

### `GET /users`

List all platform users. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/users?limit=10&offset=0"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
      "email": "admin@docai.local",
      "displayName": "Admin User",
      "role": "ADMIN",
      "createdAt": "2026-05-19T16:00:38.000Z",
      "updatedAt": "2026-05-19T16:00:38.000Z"
    }
  ],
  "total": 6,
  "limit": 10,
  "offset": 0
}
```

---

### `POST /users`

Create a platform user. No password field — the schema has no password column. Authentication credentials are managed externally (JWT secret / basic auth middleware).

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string (email) | yes | Valid email format |
| `displayName` | string | yes | Max 160 chars |
| `role` | string (enum) | yes | `SUPER_ADMIN`, `ADMIN`, `REVIEWER`, `ANALYST`, `VIEWER` |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "reviewer@example.com",
    "displayName": "New Reviewer",
    "role": "REVIEWER"
  }'
```

**Response 201:**
```json
{
  "id": "03259078-7e33-4d83-83e3-7693cd39c441",
  "email": "reviewer@example.com",
  "displayName": "New Reviewer",
  "role": "REVIEWER",
  "createdAt": "2026-05-23T12:00:00.000Z",
  "updatedAt": "2026-05-23T12:00:00.000Z"
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 409 | — | Email already exists (Prisma unique violation) |
| 500 | — | tsx runtime: missing/invalid fields hit Prisma before validation |

> **Note:** Do NOT include a `password` field. It is not in the DTO schema and will cause a 500 under the tsx runtime.

---

## Documents

### `GET /documents`

List document versions with import and pipeline status. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/documents?limit=5"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
      "documentId": "2c1d455a-4d47-4284-9455-fd952260abfe",
      "title": "...",
      "status": "PENDING_REVIEW",
      "ocrStatus": "COMPLETED",
      "sourceType": "WEBSITE_SCAN",
      "domain": "banking-regulation",
      "sourceUrl": "https://...",
      "fileSha256": "...",
      "byteSize": 123456,
      "versionNumber": 1,
      "createdAt": "2026-05-19T16:00:38.000Z",
      "updatedAt": "2026-05-23T14:00:00.000Z"
    }
  ],
  "total": 38,
  "limit": 5,
  "offset": 0
}
```

---

### `GET /documents/summary`

Get aggregate pipeline metrics across all documents.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/documents/summary"
```

**Response 200:**
```json
{
  "totalDocuments": 37,
  "totalDocumentVersions": 38,
  "documentsByStatus": {
    "PENDING": 1,
    "APPROVED": 1,
    "NOT_RELEVANT": 2,
    "PENDING_REVIEW": 34,
    "REJECTED": 0
  },
  "ocrByStatus": {
    "COMPLETED": 37,
    "PENDING": 0,
    "PROCESSING": 0,
    "FAILED": 0
  },
  "totalAiAnalysisResults": 4,
  "latestWebsiteScan": {
    "sourceId": "43bd7986-cb62-435f-957a-a2f831d8e49f",
    "sourceName": "BOT FIPCS (ภาษาไทย)",
    "startedAt": "2026-05-23T...",
    "finishedAt": "2026-05-23T...",
    "status": "COMPLETED"
  }
}
```

---

### `GET /documents/:documentVersionId`

Get a single document version with OCR artifact metadata and stored object details.

**Path parameters:**

| Parameter | Description |
|---|---|
| `documentVersionId` | UUID of the document version |

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/documents/fe180f6d-a65d-4a53-b34c-716f0db6d281"
```

**Response 200:**
```json
{
  "id": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
  "documentId": "2c1d455a-4d47-4284-9455-fd952260abfe",
  "title": "...",
  "status": "PENDING_REVIEW",
  "ocrStatus": "COMPLETED",
  "versionNumber": 1,
  "ocrArtifacts": [
    {
      "id": "...",
      "method": "NATIVE_PDF",
      "status": "COMPLETED",
      "pageCount": 3,
      "qualityScore": null,
      "textObjectId": "...",
      "rawObjectId": "..."
    }
  ],
  "sourceObject": {
    "id": "...",
    "bucket": "documents",
    "objectKey": "documents/.../original.pdf",
    "mimeType": "application/pdf",
    "byteSize": 123456
  }
}
```

---

### `GET /documents/:documentVersionId/ocr-text`

Get the extracted text content from the latest OCR/native-PDF artifact for a document version.

**Path parameters:**

| Parameter | Description |
|---|---|
| `documentVersionId` | UUID of the document version |

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/documents/fe180f6d-a65d-4a53-b34c-716f0db6d281/ocr-text"
```

**Response 200:**
```json
{
  "documentVersionId": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
  "ocrArtifactId": "...",
  "method": "NATIVE_PDF",
  "text": "ประกาศธนาคารแห่งประเทศไทย...",
  "charCount": 4821,
  "objectKey": "documents/.../ocr/text.txt"
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `OCR_TEXT_NOT_FOUND` | No OCR artifact with text exists for this version |

---

### `POST /documents/register`

Register document metadata (URL, hash, source type) without uploading the file. Applies three-layer deduplication: source URL → binary SHA-256 → content SHA-256.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | — |
| `sourceType` | string (enum) | yes | `UPLOAD`, `WEBSITE_SCAN`, `API` |
| `fileSha256` | string | yes | Exactly 64 hex characters |
| `domain` | string | no | — |
| `sourceUrl` | string | no | Valid URL |
| `sourceDocumentDate` | string (ISO date) | no | — |
| `sourceDocumentDateText` | string | no | — |
| `fileName` | string | no | — |
| `mimeType` | string | no | — |
| `byteSize` | integer | no | — |
| `contentSha256` | string | no | 64 hex chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/documents/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "BOT Circular 2569",
    "sourceType": "UPLOAD",
    "fileSha256": "a1b2c3d4e5f6...64hexchars...",
    "domain": "banking-regulation",
    "fileName": "bot-circular-2569.pdf",
    "mimeType": "application/pdf",
    "byteSize": 204800
  }'
```

**Response 201:**
```json
{
  "outcome": "CREATED",
  "documentId": "b4751a53-fb21-4aee-84af-3eeae6e1b744",
  "documentVersionId": "ec8fccd9-c858-4e01-afae-0dd32920e69d",
  "objectKey": "documents/b4751a53.../versions/ec8fccd9.../original.pdf"
}
```

Possible `outcome` values: `CREATED`, `DUPLICATE_URL`, `DUPLICATE_FILE`, `DUPLICATE_CONTENT`, `NEW_VERSION`.

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 500 | — | tsx runtime: `sourceType` must be one of `UPLOAD`, `WEBSITE_SCAN`, `API` (not `MANUAL_UPLOAD`) |

> **Warning:** `sourceType: "MANUAL_UPLOAD"` is NOT a valid enum value. Use `"UPLOAD"` instead.

---

### `POST /documents/upload`

Upload a PDF as a Base64-encoded payload. Stores source artifact in MinIO, runs OCR inline, and creates document records. Applies the same deduplication logic as `/register`.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | — |
| `fileBase64` | string | yes | Base64-encoded PDF content |
| `sourceType` | string (enum) | yes | `UPLOAD`, `WEBSITE_SCAN`, `API` |
| `domain` | string | no | — |
| `sourceUrl` | string | no | — |
| `fileName` | string | no | — |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Upload",
    "fileBase64": "JVBERi0xLj...",
    "sourceType": "UPLOAD",
    "domain": "banking-regulation"
  }'
```

**Response 200/201:**
```json
{
  "outcome": "CREATED",
  "documentId": "...",
  "documentVersionId": "...",
  "objectKey": "documents/.../original.pdf"
}
```

When an identical file is uploaded again, `outcome` is `DUPLICATE`:
```json
{
  "outcome": "DUPLICATE",
  "documentId": "08a5e8e7-0409-4214-9ecf-50ee2fe7dddc",
  "documentVersionId": "26b7d5cb-640b-4f8c-aab3-c953065cab19"
}
```

---

### `POST /documents/:documentVersionId/reupload`

Upload a replacement PDF as a new immutable version of an existing document. Uses the same `UploadDocumentDto` body as `/upload`. Creates a new `documentVersionId` linked to the same `documentId`.

---

### `POST /documents/:documentVersionId/refetch-source`

Re-download the source URL stored against the document version and create a new document version from the freshly fetched content. No request body required.

---

## Sources

### `GET /sources`

List website sources (crawler configurations) with their most recent scan status. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/sources"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "43bd7986-cb62-435f-957a-a2f831d8e49f",
      "name": "BOT FIPCS (ภาษาไทย)",
      "baseUrl": "https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx",
      "domain": "banking-regulation",
      "isActive": true,
      "maxPages": 2,
      "startPage": 1,
      "endPage": null,
      "maxDocuments": null,
      "createdAt": "2026-05-19T16:00:38.000Z",
      "updatedAt": "2026-05-23T12:00:00.000Z",
      "latestScan": {
        "id": "...",
        "status": "COMPLETED",
        "documentsFound": 36,
        "startedAt": "...",
        "finishedAt": "..."
      }
    }
  ],
  "total": 2,
  "limit": 25,
  "offset": 0
}
```

---

### `POST /sources`

Create a new website source for URL and PDF discovery.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | Max 200 chars |
| `baseUrl` | string (URL) | yes | Valid URL, TLD not required |
| `domain` | string | no | Max 120 chars |
| `maxPages` | integer | no | 1–500, default 2 |
| `startPage` | integer | no | 1–500, default 1 |
| `endPage` | integer | no | 1–500 |
| `maxDocuments` | integer | no | 1–500 |
| `isActive` | boolean | no | Default `true` |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/sources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BOT Annual Reports",
    "baseUrl": "https://www.bot.or.th/annualreports",
    "domain": "banking-regulation",
    "maxPages": 5
  }'
```

**Response 201:**
```json
{
  "id": "e570618a-ed15-4aaf-ab5d-084be84d4589",
  "name": "BOT Annual Reports",
  "baseUrl": "https://www.bot.or.th/annualreports",
  "domain": "banking-regulation",
  "isActive": true,
  "maxPages": 5,
  "startPage": 1,
  "createdAt": "2026-05-23T12:05:00.000Z",
  "updatedAt": "2026-05-23T12:05:00.000Z"
}
```

---

### `POST /sources/:sourceId/scans`

Trigger a live BOT FIPCS crawler scan for the specified source. Spawns a child process and returns immediately.

**Path parameters:**

| Parameter | Description |
|---|---|
| `sourceId` | UUID of the website source |

**No request body.**

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/sources/43bd7986-cb62-435f-957a-a2f831d8e49f/scans \
  -H "Authorization: Bearer $TOKEN"
```

**Response 200:**
```json
{
  "sourceId": "43bd7986-cb62-435f-957a-a2f831d8e49f",
  "status": "TRIGGERED",
  "pid": 12345
}
```

---

## Analysis

### `GET /analysis/ai-config`

Get sanitized (no secrets) AI provider configuration as currently loaded from environment variables.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/analysis/ai-config"
```

**Response 200:**
```json
{
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini",
  "baseUrl": "https://openrouter.ai/api/v1",
  "hasApiKey": true,
  "fallbackProvider": "claude-code",
  "fallbackModel": null
}
```

---

### `GET /analysis/results`

List AI analysis results with linked review state. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/analysis/results?limit=5"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "79c0514e-ee21-4ca6-9270-119e30acbdc3",
      "documentVersionId": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
      "promptInstanceId": "...",
      "status": "COMPLETED",
      "outcome": "NO_RULES_FOUND",
      "confidence": null,
      "tokenUsage": 5432,
      "estimatedCost": null,
      "latencyMs": 8200,
      "result": { "rules": [], "summary": null, ... },
      "reviews": [
        {
          "id": "36bc530b-fcb9-46a9-a3b5-5ee52109048f",
          "status": "REQUEST_CHANGES",
          "outcome": "CHANGES_REQUESTED"
        }
      ],
      "createdAt": "2026-05-23T13:30:00.000Z",
      "updatedAt": "2026-05-23T13:45:00.000Z"
    }
  ],
  "total": 4,
  "limit": 5,
  "offset": 0
}
```

---

### `POST /analysis/document-versions/:documentVersionId/run`

Run AI rule extraction for a document version using the currently active prompt template version. The document version must have a completed OCR artifact with text.

**Path parameters:**

| Parameter | Description |
|---|---|
| `documentVersionId` | UUID of the document version |

**No request body.** The active prompt template version is resolved automatically from the database. Any body fields sent are ignored.

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/analysis/document-versions/fe180f6d-a65d-4a53-b34c-716f0db6d281/run \
  -H "Authorization: Bearer $TOKEN"
```

**Response 200:**
```json
{
  "id": "011e0b5b-5a64-4ad8-a8cd-d58ce0e4ae8b",
  "documentVersionId": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
  "promptInstanceId": "7cfc662a-3991-4743-97cb-298af8738549",
  "status": "COMPLETED",
  "outcome": "RULES_FOUND",
  "confidence": null,
  "result": {
    "outcome": "RULES_FOUND",
    "summary": "...",
    "confidence": 0.9,
    "rules": [
      {
        "ruleCode": "BOT-001",
        "title": "...",
        "description": "...",
        "condition": "...",
        "prohibition": null,
        "riskLevel": "HIGH"
      }
    ]
  },
  "tokenUsage": 8424,
  "latencyMs": 10649,
  "reviews": [
    {
      "id": "ce7765c2-2999-4232-b1ce-2f58b2520860",
      "status": "PENDING",
      "reviewType": "SOURCE_AI_RESULT"
    }
  ],
  "createdAt": "2026-05-23T13:58:44.108Z",
  "updatedAt": "2026-05-23T13:58:54.760Z"
}
```

Possible `outcome` values: `RULES_FOUND`, `NO_RULES_FOUND`, `NOT_RELEVANT`.

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `DOCUMENT_VERSION_NOT_FOUND` | Document version does not exist |
| 404 | `OCR_TEXT_NOT_FOUND` | No OCR artifact with text found |
| 503 | `OCR_TEXT_EMPTY` | OCR text is empty |
| 404 | `NO_ACTIVE_PROMPT_TEMPLATE` | No active prompt template version exists |

---

## Prompts

### `GET /prompts`

List prompt templates with their version history. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/prompts"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "73b87442-8259-4bca-894d-7bb3ab7000d9",
      "name": "Thai Regulatory Rule Extraction",
      "domain": "banking-regulation",
      "tags": ["thai", "bot", "rule-extraction"],
      "status": "ACTIVE",
      "createdAt": "2026-05-20T08:20:00.000Z",
      "versions": [
        {
          "id": "841a0de1-c98a-487a-a5df-e7a5a07617fa",
          "versionNumber": 1,
          "status": "ACTIVE",
          "aiProvider": "openrouter",
          "aiModel": "openai/gpt-4o-mini",
          "createdAt": "2026-05-20T08:20:00.000Z"
        }
      ]
    }
  ],
  "total": 2,
  "limit": 25,
  "offset": 0
}
```

---

### `POST /prompts`

Create a new prompt template. Automatically creates version 1 as a DRAFT.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | yes | Max 200 chars |
| `templateText` | string | yes | The full prompt text |
| `domain` | string | no | Max 120 chars |
| `tags` | string[] | no | Max 20 items |
| `aiModel` | string | no | Max 180 chars (e.g. `anthropic/claude-3.5-sonnet`) |
| `variables` | string[] | no | Max 50 items, variable names used in template |

**Template variables** are referenced in `templateText` as `{{variableName}}`. The `ocrText` variable is injected automatically during analysis.

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/prompts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BOT FIPCS Rule Extractor",
    "domain": "banking-regulation",
    "tags": ["bot", "thai", "rules"],
    "templateText": "Extract all rules from this document.\n\nDocument:\n{{ocrText}}\n\nReturn JSON with rules array.",
    "variables": ["ocrText"]
  }'
```

**Response 201:**
```json
{
  "id": "92f2e484-1307-42bd-9afd-fa1d4883069a",
  "name": "BOT FIPCS Rule Extractor",
  "domain": "banking-regulation",
  "tags": ["bot", "thai", "rules"],
  "status": "DRAFT",
  "createdById": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
  "createdAt": "2026-05-23T14:00:20.387Z",
  "updatedAt": "2026-05-23T14:00:20.387Z",
  "versions": [
    {
      "id": "c8a51d9e-b1e8-4882-945a-660cb74db978",
      "promptTemplateId": "92f2e484-1307-42bd-9afd-fa1d4883069a",
      "versionNumber": 1,
      "status": "DRAFT",
      "templateText": "...",
      "variables": ["ocrText"],
      "aiProvider": "openrouter",
      "aiModel": "openai/gpt-4o-mini",
      "createdById": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
      "createdAt": "2026-05-23T14:00:20.387Z"
    }
  ]
}
```

---

### `POST /prompts/:promptTemplateId/versions`

Add a new version to an existing prompt template. New version starts as DRAFT.

**Path parameters:**

| Parameter | Description |
|---|---|
| `promptTemplateId` | UUID of the parent prompt template |

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `templateText` | string | yes | The full updated prompt text |
| `aiModel` | string | no | Max 180 chars |
| `variables` | string[] | no | Max 50 items |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/prompts/73b87442-8259-4bca-894d-7bb3ab7000d9/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateText": "Updated extraction prompt v2...\n\n{{ocrText}}",
    "variables": ["ocrText"]
  }'
```

**Response 201:**
```json
{
  "id": "c653db67-7993-43af-9b90-5e55de71162f",
  "promptTemplateId": "73b87442-8259-4bca-894d-7bb3ab7000d9",
  "versionNumber": 2,
  "status": "DRAFT",
  "templateText": "...",
  "aiProvider": "openrouter",
  "aiModel": "openai/gpt-4o-mini",
  "createdAt": "2026-05-23T13:00:00.000Z"
}
```

---

### `POST /prompts/versions/:promptTemplateVersionId/activate`

Activate a prompt template version. Deactivates any previously active version on the same template. The active version is used for all AI analysis runs.

**Path parameters:**

| Parameter | Description |
|---|---|
| `promptTemplateVersionId` | UUID of the prompt template version |

**No request body.**

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/prompts/versions/c8a51d9e-b1e8-4882-945a-660cb74db978/activate \
  -H "Authorization: Bearer $TOKEN"
```

**Response 200:**
```json
{
  "id": "c8a51d9e-b1e8-4882-945a-660cb74db978",
  "promptTemplateId": "92f2e484-1307-42bd-9afd-fa1d4883069a",
  "versionNumber": 1,
  "status": "ACTIVE",
  "aiProvider": "openrouter",
  "aiModel": "openai/gpt-4o-mini",
  "createdAt": "2026-05-23T14:00:20.387Z"
}
```

---

## Review

Review items are created automatically when AI analysis completes. A review item with `reviewType: SOURCE_AI_RESULT` represents an AI analysis result awaiting a human decision.

### `GET /review/items`

List review items with linked AI analysis or compliance check context. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/review/items?limit=10"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "ce7765c2-2999-4232-b1ce-2f58b2520860",
      "reviewType": "SOURCE_AI_RESULT",
      "status": "PENDING",
      "outcome": null,
      "aiAnalysisResultId": "011e0b5b-5a64-4ad8-a8cd-d58ce0e4ae8b",
      "complianceCheckId": null,
      "reviewerId": null,
      "roundNumber": 1,
      "comment": null,
      "createdAt": "2026-05-23T13:58:54.767Z",
      "decidedAt": null
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

Review item `status` values: `PENDING`, `APPROVED`, `REQUEST_CHANGES`.
Review item `outcome` values: `null` (pending), `APPROVED`, `CHANGES_REQUESTED`, `CONFIRMED_NOT_RELEVANT`.

---

### `POST /review/items/:reviewItemId/approve`

Approve an AI review item. Creates a new `MasterRulebookVersion` from the extracted rules and marks the document as `APPROVED`. **Requires that the AI result has at least one extracted rule** (`outcome: RULES_FOUND`).

**Path parameters:**

| Parameter | Description |
|---|---|
| `reviewItemId` | UUID of the review item |

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `comment` | string | no | Max 2000 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/review/items/ce7765c2-2999-4232-b1ce-2f58b2520860/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Rules verified against BOT regulatory framework."}'
```

**Response 200:**
```json
{
  "id": "e658ccc6-1325-4fed-9072-6fbde69424c3",
  "masterRulebookId": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
  "versionNumber": 1,
  "status": "APPROVED",
  "approvedById": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
  "approvedAt": "2026-05-23T14:01:00.000Z",
  "rules": [
    {
      "id": "b5a6c574-d200-4ab9-9a59-259d3fc58dad",
      "ruleCode": "BOT-001",
      "title": "...",
      "description": "...",
      "condition": "...",
      "prohibition": null,
      "riskLevel": "HIGH"
    }
  ],
  "masterRulebook": {
    "id": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
    "title": "banking-regulation Master Rulebook",
    "domain": "banking-regulation"
  }
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `NO_RULES_TO_APPROVE` | AI result has `outcome: NO_RULES_FOUND` — no rules to promote |
| 404 | `REVIEW_ITEM_NOT_FOUND` | Review item does not exist |

---

### `POST /review/items/:reviewItemId/request-changes`

Reject the AI analysis result and request a revised analysis. Sets document status to `REJECTED`. **Comment is required.**

**Path parameters:**

| Parameter | Description |
|---|---|
| `reviewItemId` | UUID of the review item |

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `comment` | string | **yes** | 1–2000 chars (required, not optional) |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/review/items/36bc530b-fcb9-46a9-a3b5-5ee52109048f/request-changes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Rules extracted are too generic. Please re-run with a more specific prompt."}'
```

**Response 200:**
```json
{
  "id": "36bc530b-fcb9-46a9-a3b5-5ee52109048f",
  "reviewType": "SOURCE_AI_RESULT",
  "status": "REQUEST_CHANGES",
  "outcome": "CHANGES_REQUESTED",
  "comment": "Rules extracted are too generic...",
  "reviewerId": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
  "decidedAt": "2026-05-23T13:45:00.000Z"
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `COMMENT_REQUIRED` | Empty or whitespace-only comment |
| 404 | `REVIEW_ITEM_NOT_FOUND` | Review item does not exist |

---

### `POST /review/items/:reviewItemId/confirm-not-relevant`

Confirm an AI review item as not relevant to rulemaking. Sets review status to `APPROVED` with outcome `CONFIRMED_NOT_RELEVANT` and marks the document as `NOT_RELEVANT`. The review item must be linked to an AI analysis result that has a document version.

**Path parameters:**

| Parameter | Description |
|---|---|
| `reviewItemId` | UUID of the review item |

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `comment` | string | no | Max 2000 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/review/items/8b7bdac0-0913-4b89-9f36-c79701155f66/confirm-not-relevant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Staff appointment notice, not relevant to rulemaking."}'
```

**Response 201:**
```json
{
  "id": "8b7bdac0-0913-4b89-9f36-c79701155f66",
  "reviewType": "SOURCE_AI_RESULT",
  "status": "APPROVED",
  "outcome": "CONFIRMED_NOT_RELEVANT",
  "comment": "Staff appointment notice, not relevant to rulemaking.",
  "reviewerId": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
  "roundNumber": 1,
  "createdAt": "2026-05-23T13:58:54.767Z",
  "decidedAt": "2026-05-23T13:59:45.778Z"
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `REVIEW_ITEM_HAS_NO_DOCUMENT` | Review item is not linked to a document version |
| 404 | `REVIEW_ITEM_NOT_FOUND` | Review item does not exist |

---

### `POST /review/document-versions/:documentVersionId/not-relevant`

Mark a document version as not relevant without requiring AI analysis first. Useful for fast triage of crawled documents that are clearly out of scope.

**Path parameters:**

| Parameter | Description |
|---|---|
| `documentVersionId` | UUID of the document version |

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `comment` | string | no | Max 2000 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/review/document-versions/fe180f6d-a65d-4a53-b34c-716f0db6d281/not-relevant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Press release, not a regulatory circular."}'
```

**Response 200:**
```json
{
  "documentVersionId": "fe180f6d-a65d-4a53-b34c-716f0db6d281",
  "status": "NOT_RELEVANT"
}
```

---

## Rulebooks

Rulebooks are created automatically when a review item is approved. A `MasterRulebook` groups all versions for a compliance domain. A `MasterRulebookVersion` contains the immutable set of rules for one approval cycle.

### `GET /rulebooks`

List master rulebooks with their versions and rules. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/rulebooks"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
      "title": "banking-regulation Master Rulebook",
      "domain": "banking-regulation",
      "ownerId": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
      "createdAt": "2026-05-23T14:01:00.000Z",
      "versions": [
        {
          "id": "e658ccc6-1325-4fed-9072-6fbde69424c3",
          "versionNumber": 1,
          "status": "PUBLISHED",
          "publishedAt": "2026-05-23T14:01:33.903Z",
          "rules": [ ... ]
        }
      ]
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

---

### `GET /rulebooks/versions/:rulebookVersionId`

Get full detail for a specific rulebook version including all rules and associated reports.

**Path parameters:**

| Parameter | Description |
|---|---|
| `rulebookVersionId` | UUID of the rulebook version |

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/rulebooks/versions/e658ccc6-1325-4fed-9072-6fbde69424c3"
```

**Response 200:**
```json
{
  "id": "e658ccc6-1325-4fed-9072-6fbde69424c3",
  "masterRulebookId": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
  "versionNumber": 1,
  "status": "PUBLISHED",
  "approvedById": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
  "approvedAt": "2026-05-23T14:01:00.000Z",
  "publishedAt": "2026-05-23T14:01:33.903Z",
  "masterRulebook": {
    "id": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
    "title": "banking-regulation Master Rulebook",
    "domain": "banking-regulation"
  },
  "rules": [
    {
      "id": "b5a6c574-d200-4ab9-9a59-259d3fc58dad",
      "ruleCode": "BOT-001",
      "title": "Appointment of Inspection Officers",
      "description": "...",
      "condition": "...",
      "prohibition": null,
      "riskLevel": "HIGH",
      "sourceReferences": [
        {
          "documentVersionId": "fe180f6d-...",
          "aiAnalysisResultId": "011e0b5b-..."
        }
      ]
    }
  ]
}
```

---

### `POST /rulebooks/versions/:rulebookVersionId/publish`

Publish an approved rulebook version. Any previously published version for the same rulebook is superseded. Only `APPROVED` versions can be published.

**Path parameters:**

| Parameter | Description |
|---|---|
| `rulebookVersionId` | UUID of the rulebook version |

**No request body.**

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/rulebooks/versions/e658ccc6-1325-4fed-9072-6fbde69424c3/publish \
  -H "Authorization: Bearer $TOKEN"
```

**Response 200:**
```json
{
  "id": "e658ccc6-1325-4fed-9072-6fbde69424c3",
  "versionNumber": 1,
  "status": "PUBLISHED",
  "publishedAt": "2026-05-23T14:01:33.903Z",
  "masterRulebook": {
    "id": "25edca91-31d8-4530-8f50-ed2d436bbd5d",
    "domain": "banking-regulation"
  },
  "rules": [ ... ]
}
```

---

## Compliance

Compliance checks apply a published rulebook's rules against arbitrary text content using keyword matching.

### `GET /compliance/checks`

List compliance checks with their result summaries and review items. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/compliance/checks"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "d1626fe9-0666-4b1c-a2c1-c71405fbbcdb",
      "inputType": "TEXT",
      "status": "POTENTIAL_VIOLATION",
      "selectedRulebookVersionId": "e658ccc6-1325-4fed-9072-6fbde69424c3",
      "inputHash": "sha256...",
      "metadata": {
        "title": "P2P Lending Platform Compliance Check",
        "contentLength": 192
      },
      "results": [
        {
          "versionNumber": 1,
          "status": "POTENTIAL_VIOLATION",
          "summary": "2 rule(s) matched submitted content and require reviewer confirmation.",
          "matchedRules": [ ... ],
          "recommendedAction": "Send to reviewer before final decision or notification."
        }
      ],
      "createdAt": "2026-05-23T14:02:00.000Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0
}
```

---

### `POST /compliance/checks`

Run a compliance check against a published or approved rulebook version using keyword-based rule matching against the submitted text.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `inputType` | string (enum) | no | `TEXT` (default), `DOCUMENT_TEXT`, `URL_CONTENT` |
| `content` | string | yes | The text content to check |
| `selectedRulebookVersionId` | string (UUID) | no | Specific rulebook version; uses latest published if omitted |
| `selectedReportId` | string (UUID) | no | Link to an existing report export |
| `title` | string | no | Max 300 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/compliance/checks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputType": "TEXT",
    "content": "Our company operates an electronic system for credit transactions between individuals who are not financial institutions.",
    "selectedRulebookVersionId": "e658ccc6-1325-4fed-9072-6fbde69424c3",
    "title": "P2P Lending Platform Compliance Check"
  }'
```

**Response 201:**
```json
{
  "id": "d1626fe9-0666-4b1c-a2c1-c71405fbbcdb",
  "inputType": "TEXT",
  "status": "POTENTIAL_VIOLATION",
  "selectedRulebookVersionId": "e658ccc6-1325-4fed-9072-6fbde69424c3",
  "inputHash": "sha256...",
  "metadata": { "title": "P2P Lending Platform Compliance Check", "contentLength": 118 },
  "results": [
    {
      "versionNumber": 1,
      "status": "POTENTIAL_VIOLATION",
      "summary": "2 rule(s) matched...",
      "matchedRules": [
        {
          "ruleId": "b5a6c574-...",
          "ruleCode": "BOT-001",
          "matchedTerms": ["electronic system", "credit transactions"],
          "riskLevel": "HIGH"
        }
      ],
      "recommendedAction": "Send to reviewer before final decision or notification."
    }
  ],
  "selectedRulebookVersion": { ... },
  "createdAt": "2026-05-23T14:02:00.000Z"
}
```

`status` values: `COMPLIANT` (no rules matched), `POTENTIAL_VIOLATION` (one or more rules matched).

When `status` is `POTENTIAL_VIOLATION`, a `ReviewItem` with `reviewType: COMPLIANCE_CHECK` is created automatically.

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `RULEBOOK_VERSION_NOT_FOUND` | No published/approved rulebook found or specified version not found |
| 400 | `NO_RULES_AVAILABLE` | The rulebook version exists but has no rules |

---

## Reports

Reports are generated synchronously and stored as JSON exports in MinIO object storage.

### `GET /reports`

List all generated report records. Supports pagination.

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/reports"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "5bd4d58a-d70f-4ff3-969e-556853a7f6fb",
      "reportType": "RULE_EXTRACTION",
      "status": "COMPLETED",
      "rulebookVersionId": "e658ccc6-1325-4fed-9072-6fbde69424c3",
      "complianceCheckId": null,
      "createdAt": "2026-05-23T14:01:40.000Z",
      "export": {
        "id": "d0f70e8c-c036-4bce-b16e-ed46ad125311",
        "status": "COMPLETED",
        "objectKey": "exports/d0f70e8c-.../report.json"
      }
    },
    {
      "id": "1a00db31-cf43-4ffd-a277-2a1f99be7367",
      "reportType": "COMPLIANCE_USAGE",
      "status": "COMPLETED",
      "complianceCheckId": "d1626fe9-0666-4b1c-a2c1-c71405fbbcdb"
    }
  ],
  "total": 2,
  "limit": 25,
  "offset": 0
}
```

---

### `POST /reports/rulebook-versions/:rulebookVersionId/generate`

Generate a `RULE_EXTRACTION` report for a rulebook version. Writes a JSON export to MinIO under the `exports/` bucket. Completes synchronously.

**Path parameters:**

| Parameter | Description |
|---|---|
| `rulebookVersionId` | UUID of the rulebook version |

**Request body:** (all optional; body may be omitted)

| Field | Type | Constraints |
|---|---|---|
| `format` | string | `JSON` (only supported value) |
| `title` | string | Max 300 chars |

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/reports/rulebook-versions/e658ccc6-1325-4fed-9072-6fbde69424c3/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format":"JSON","title":"BOT FIPCS Rulebook v1 Report"}'
```

**Response 200:**
```json
{
  "id": "5bd4d58a-d70f-4ff3-969e-556853a7f6fb",
  "reportType": "RULE_EXTRACTION",
  "status": "COMPLETED",
  "rulebookVersionId": "e658ccc6-1325-4fed-9072-6fbde69424c3",
  "export": {
    "id": "d0f70e8c-c036-4bce-b16e-ed46ad125311",
    "status": "COMPLETED",
    "objectKey": "exports/d0f70e8c-c036-4bce-b16e-ed46ad125311/report.json",
    "bucket": "exports"
  },
  "createdAt": "2026-05-23T14:01:40.000Z"
}
```

---

### `POST /reports/compliance-checks/:complianceCheckId/generate`

Generate a `COMPLIANCE_USAGE` report for a compliance check. Completes synchronously.

**Path parameters:**

| Parameter | Description |
|---|---|
| `complianceCheckId` | UUID of the compliance check |

**Request body:** same optional shape as the rulebook report endpoint.

**Example request:**
```bash
curl -s -X POST http://localhost:4000/api/v1/reports/compliance-checks/d1626fe9-0666-4b1c-a2c1-c71405fbbcdb/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format":"JSON","title":"P2P Lending Compliance Report"}'
```

**Response 200:**
```json
{
  "id": "1a00db31-cf43-4ffd-a277-2a1f99be7367",
  "reportType": "COMPLIANCE_USAGE",
  "status": "COMPLETED",
  "complianceCheckId": "d1626fe9-0666-4b1c-a2c1-c71405fbbcdb",
  "export": {
    "id": "6130d276-5e23-4c8a-98f2-34d5fb410342",
    "status": "COMPLETED",
    "objectKey": "exports/6130d276-.../report.json"
  }
}
```

---

### `GET /reports/exports/:reportExportId`

Read a report export from MinIO and return its metadata and JSON content. Use the **export ID** (from `report.export.id`), not the report ID.

**Path parameters:**

| Parameter | Description |
|---|---|
| `reportExportId` | UUID of the report export record (not the report itself) |

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/reports/exports/d0f70e8c-c036-4bce-b16e-ed46ad125311"
```

**Response 200:**
```json
{
  "export": {
    "id": "d0f70e8c-c036-4bce-b16e-ed46ad125311",
    "reportId": "5bd4d58a-d70f-4ff3-969e-556853a7f6fb",
    "status": "COMPLETED",
    "objectKey": "exports/d0f70e8c-.../report.json"
  },
  "storedObject": {
    "id": "416420fe-1c62-40b7-be39-f2df5050046b",
    "bucket": "exports",
    "objectKey": "exports/d0f70e8c-.../report.json",
    "mimeType": "application/json"
  },
  "content": { ... }
}
```

**Error codes:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `REPORT_EXPORT_NOT_FOUND` | Export ID not found (use export ID, not report ID) |

---

## Audit Logs

### `GET /audit/logs`

List audit log records for all state-changing operations. Supports pagination and action filtering.

**Query parameters:**

In addition to pagination (`limit`, `offset`):

| Parameter | Description |
|---|---|
| `action` | Filter by exact action string (e.g. `COMPLIANCE_CHECK_CREATED`) |

**Example request:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/audit/logs?action=COMPLIANCE_CHECK_CREATED&limit=5"
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "...",
      "actorId": "b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0",
      "action": "COMPLIANCE_CHECK_CREATED",
      "entityType": "ComplianceCheck",
      "entityId": "d1626fe9-0666-4b1c-a2c1-c71405fbbcdb",
      "previousState": null,
      "nextState": {
        "status": "POTENTIAL_VIOLATION",
        "selectedRulebookVersionId": "e658ccc6-...",
        "matchedRules": 2
      },
      "correlationId": "...",
      "requestMetadata": { "inputType": "TEXT", "title": "P2P Lending Platform Compliance Check" },
      "createdAt": "2026-05-23T14:02:00.000Z"
    }
  ],
  "total": 100,
  "limit": 5,
  "offset": 0
}
```

**Common action values** (from live audit log):

| Action | Trigger |
|---|---|
| `USER_CREATED` | `POST /users` |
| `DOCUMENT_REGISTERED` | `POST /documents/register` |
| `DOCUMENT_UPLOADED` | `POST /documents/upload` |
| `AI_ANALYSIS_COMPLETED` | `POST /analysis/document-versions/:id/run` |
| `AI_RESULT_APPROVED_RULEBOOK_VERSION_CREATED` | `POST /review/items/:id/approve` |
| `REVIEW_CHANGES_REQUESTED` | `POST /review/items/:id/request-changes` |
| `DOCUMENT_CONFIRMED_NOT_RELEVANT` | `POST /review/items/:id/confirm-not-relevant` |
| `DOCUMENT_MARKED_NOT_RELEVANT_WITHOUT_AI` | `POST /review/document-versions/:id/not-relevant` |
| `RULEBOOK_VERSION_PUBLISHED` | `POST /rulebooks/versions/:id/publish` |
| `COMPLIANCE_CHECK_CREATED` | `POST /compliance/checks` |
| `REPORT_GENERATED` | `POST /reports/*/generate` |
| `CRAWLER_SCAN_TRIGGERED` | `POST /sources/:id/scans` |
| `SOURCE_CREATED` | `POST /sources` |

---

## Endpoint Quick Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | API liveness check |
| POST | `/auth/login` | — | Obtain JWT access token |
| GET | `/users` | Bearer | List platform users |
| POST | `/users` | Bearer | Create user |
| GET | `/documents` | Bearer | List document versions |
| GET | `/documents/summary` | Bearer | Pipeline metrics |
| GET | `/documents/:id` | Bearer | Document version detail |
| GET | `/documents/:id/ocr-text` | Bearer | Extracted OCR text |
| POST | `/documents/register` | Bearer | Register document metadata |
| POST | `/documents/upload` | Bearer | Upload PDF (base64) |
| POST | `/documents/:id/reupload` | Bearer | Replace PDF with new version |
| POST | `/documents/:id/refetch-source` | Bearer | Re-download source URL |
| GET | `/sources` | Bearer | List website sources |
| POST | `/sources` | Bearer | Create website source |
| POST | `/sources/:id/scans` | Bearer | Trigger crawler scan |
| GET | `/analysis/ai-config` | Bearer | AI provider config |
| GET | `/analysis/results` | Bearer | List AI analysis results |
| POST | `/analysis/document-versions/:id/run` | Bearer | Run AI analysis |
| GET | `/prompts` | Bearer | List prompt templates |
| POST | `/prompts` | Bearer | Create prompt template |
| POST | `/prompts/:id/versions` | Bearer | Add prompt version |
| POST | `/prompts/versions/:id/activate` | Bearer | Activate prompt version |
| GET | `/review/items` | Bearer | List review items |
| POST | `/review/items/:id/approve` | Bearer | Approve AI result → create rulebook version |
| POST | `/review/items/:id/request-changes` | Bearer | Reject with comment |
| POST | `/review/items/:id/confirm-not-relevant` | Bearer | Mark as not relevant |
| POST | `/review/document-versions/:id/not-relevant` | Bearer | Skip AI, mark not relevant |
| GET | `/rulebooks` | Bearer | List master rulebooks |
| GET | `/rulebooks/versions/:id` | Bearer | Rulebook version detail |
| POST | `/rulebooks/versions/:id/publish` | Bearer | Publish rulebook version |
| GET | `/compliance/checks` | Bearer | List compliance checks |
| POST | `/compliance/checks` | Bearer | Run compliance check against text |
| GET | `/reports` | Bearer | List generated reports |
| POST | `/reports/rulebook-versions/:id/generate` | Bearer | Generate rulebook report |
| POST | `/reports/compliance-checks/:id/generate` | Bearer | Generate compliance report |
| GET | `/reports/exports/:id` | Bearer | Read report export from storage |
| GET | `/audit/logs` | Bearer | List audit log records |

---

## Test Data (Seeded & Session)

IDs created during testing sessions that are present in the local dev database:

| Entity | ID |
|---|---|
| Admin user | `b65f9cdf-8fa9-41c6-8647-c53b94fcf8c0` |
| Reviewer user | `03259078-7e33-4d83-83e3-7693cd39c441` |
| BOT FIPCS source | `43bd7986-cb62-435f-957a-a2f831d8e49f` |
| Sample document (version) | `fe180f6d-a65d-4a53-b34c-716f0db6d281` |
| Sample document | `2c1d455a-4d47-4284-9455-fd952260abfe` |
| Prompt template v1 | `73b87442-8259-4bca-894d-7bb3ab7000d9` |
| Prompt version (ACTIVE) | `841a0de1-c98a-487a-a5df-e7a5a07617fa` |
| AI analysis result | `011e0b5b-5a64-4ad8-a8cd-d58ce0e4ae8b` |
| Master rulebook | `25edca91-31d8-4530-8f50-ed2d436bbd5d` |
| Rulebook version (PUBLISHED v1) | `e658ccc6-1325-4fed-9072-6fbde69424c3` |
| Compliance check (POTENTIAL_VIOLATION) | `d1626fe9-0666-4b1c-a2c1-c71405fbbcdb` |
| Rulebook report | `5bd4d58a-d70f-4ff3-969e-556853a7f6fb` |
| Rulebook report export | `d0f70e8c-c036-4bce-b16e-ed46ad125311` |
| Compliance report | `1a00db31-cf43-4ffd-a277-2a1f99be7367` |
