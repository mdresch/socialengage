---
name: export-jobs
description: ADR-0111 bounded post export jobs, rate limits, and Azure Blob lifecycle. Read before changing `export_jobs`, `postExportEngine.ts`, `postsExportRouter.ts`, or `blobArchiveClient.ts` export paths.
---

# Export Jobs (ADR-0111)

## What this is

The `export_jobs` table and `POST /v1/posts/export` flow coordinate bounded,
trackable exports of tenant posts. Small CSV requests are returned synchronously
via `GET /v1/posts/export.csv`; larger CSV or JSON requests become asynchronous
jobs that are streamed to Azure Blob Storage and polled through
`GET /v1/posts/exports/:id` / `GET /v1/posts/exports/:id/download`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0111 | Export bounding, streaming, size caps, tenant rate limits, Blob lifecycle | 13.4 |
| ADR-0090 | Posts CSV export (sync streaming, `export_jobs` status tracking) | 10.8 |
| ADR-0074 | Tenant-facing matched-posts CSV export (column set and RLS) | 3.16 |
| ADR-0016 | Azure Blob Storage tenant-scoped container | — |
| ADR-0015 | Tenant RLS on every query | — |

## Contracts that constrain this component

- `contracts/epic-13/story-13.4.export-bounding-streaming-and-size-caps.contract.test.ts` — sync/async thresholds, `export_jobs` schema, rate limits, Blob lifecycle, presigned download URLs.
- `contracts/epic-10/story-10.8.data-export-posts-csv.contract.test.ts` — existing sync CSV and async job status endpoint (`GET /v1/exports/:jobId/status`) must keep working.

## Endpoints

- `GET /v1/posts/export.csv` — synchronous CSV export, `limit <= 5,000` (default 1,000).
- `POST /v1/posts/export` — create async `export_jobs` row; triggers streaming to Blob.
- `GET /v1/posts/exports/:id` — ADR-0111 job status (`pending`, `running`, `ready`, `expired`, `failed`).
- `GET /v1/posts/exports/:id/download` — returns `302 Found` with a 24-hour presigned SAS URL in `Location`.
- `GET /v1/exports/:jobId/status` — legacy Story 10.8 status shape (`pending`, `processing`, `completed`, `failed`) and `downloadUrl`.

## Load-bearing constraints — do not change casually

- Synchronous CSV is only allowed for `format='csv'` and `limit <= 5,000`.
- Hard caps: CSV 100,000 rows, JSON 10,000 rows, 100 MB file size.
- `export_jobs` columns: `id`, `tenant_id`, `requested_by_user_id`, `status`, `format`, `row_count`, `blob_path`, `sha256`, `expires_at`, `created_at`.
- `status` may be `pending`, `running`, `ready`, `expired`, or `failed`. The legacy `GET /v1/exports/:jobId/status` maps `running`→`processing` and `ready`→`completed` to keep Story 10.8's contract green.
- Rate limits are per-tenant, not per-user: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
- Blob objects are uploaded with `expires_at` metadata set to 7 days after creation.
- Presigned download URLs expire 24 hours after generation.
- All export queries run through `withTenant()`; `rawPayload`, OAuth tokens, and connector secrets are never written.

## How to extend this safely

- Adding a new export `format`: add a generator in `postExportEngine.ts`, update hard caps, and add an AC to the Story 13.4 contract.
- Changing rate-limit thresholds: read from `process.env` (see `src/posts/exportRateLimit.ts`) with ADR-0111 defaults; any production change must be mirrored in the contract and this SKILL.md.
- Adding a scheduled cleanup worker for expired blobs: use the `expires_at` metadata/tag set by `blobArchiveClient.ts`, and add a contract for the worker.

## Known gaps / deferred work

- Hard deletion of expired Blob objects is not implemented by application code; ADR-0111's 7-day object lifecycle is enforced by container lifecycle policy and the `expires_at` metadata, not a worker in Story 13.4.
- Plan-configurable sync caps are an open question in ADR-0111 and remain unimplemented.
