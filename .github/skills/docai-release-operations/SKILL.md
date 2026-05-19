---
name: docai-release-operations
description: "Prepare DocAI for local development, release, and operations. Use for Docker Compose, environment variables, migrations, worker health, observability, backup/restore, deployment checks, queues, object storage, and production readiness."
argument-hint: "Operational task or release target"
---
# DocAI Release And Operations

## When To Use

- A task involves environment setup, Docker Compose, deployment readiness, migrations, workers, observability, backups, restore, queues, object storage, or operational runbooks.

## Procedure

1. Identify the target environment: local development, test, staging, production, on-prem, or managed cloud. Do not assume a deployment target if the user has not chosen one.
2. Keep environment-specific values in configuration and examples. Do not hardcode endpoints, credentials, provider names, bucket names, retention durations, or secrets.
3. Define service dependencies: Next.js app, NestJS API, PostgreSQL, Redis, MinIO, workers, OCR binaries, crawler networking, and optional observability components.
4. Plan Prisma migration execution and rollback strategy appropriate to the environment.
5. Add health checks for API, worker processes, queues, Redis, PostgreSQL, MinIO, OCR tool availability, and external integrations.
6. Define logs and metrics for job throughput, queue lag, failures, retries, OCR quality, AI provider latency, crawler errors, compliance decisions, and export generation.
7. Define backup/restore for PostgreSQL and object storage metadata/artifacts together so document traceability survives restore.
8. Add operational runbooks for stuck workers, failed migrations, failed OCR jobs, crawler source changes, AI provider errors, storage failures, and export retries.
9. Validate setup with the narrowest useful command available for the touched area and document commands that cannot run yet.

## Guardrails

- Do not commit secrets.
- Do not make production destructive operations the default command.
- Do not treat local-only shortcuts as production behavior.
