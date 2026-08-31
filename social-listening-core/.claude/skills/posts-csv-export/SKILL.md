---
name: posts-csv-export
description: Synchronous streaming CSV export and asynchronous blob export job runner (ADR-0090, Story 10.8, ADR-0111, Story 13.4).
---

# Posts CSV Export (ADR-0090, ADR-0111)

## Purpose

Enables tenant users to export filtered social post datasets for offline analysis,
auditing, or CRM integration. Exports are bounded per ADR-0111: sync CSV up to
5,000 rows, async CSV up to 100,000 rows, and JSON up to 10,000 rows, with
tenant-scoped rate limits and a 7-day Azure Blob lifecycle.

## Invariants

1. **Synchronous Streaming:** `GET /v1/posts/export.csv` streams directly with
   `Content-Type: text/csv; charset=utf-8` for `format='csv'` and `limit <= 5,000`.
   Default `limit` is 1,000. Special characters (quotes, commas, newlines) are escaped.
2. **Asynchronous Jobs:** `POST /v1/posts/export` creates an `export_jobs` row
   with 24-hour `expires_at`, returns `202 Accepted`, and streams the result to
   Azure Blob for `limit > 5,000`, `format='json'`, or watchlist matches > 5,000.
3. **Status Polling (ADR-0111):** `GET /v1/posts/exports/:id` returns ADR-0111
   statuses (`pending`, `running`, `ready`, `expired`, `failed`), `rowCount`,
   `blobPath`, `sha256`, and `expiresAt`. `GET /v1/posts/exports/:id/download`
   returns a 24-hour presigned SAS URL.
4. **Legacy Status Polling (Story 10.8):** `GET /v1/exports/:jobId/status` keeps
   returning `pending`, `processing`, `completed`, `failed`, `downloadUrl`, and
   `completedAt` so Story 10.8's contract remains green.
5. **Tenant Scoping:** All exports enforce tenant RLS boundaries via `withTenant()`.
6. **Rate Limiting:** Exports are gated per tenant by `src/posts/exportRateLimit.ts`:
   60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
7. **Blob Lifecycle:** Async export blobs are uploaded with `expires_at` metadata
   set 7 days in the future; presigned download URLs are valid for 24 hours.

## Endpoints

- `GET /v1/posts/export.csv` — synchronous streaming CSV download.
- `POST /v1/posts/export` — initiate async export job.
- `GET /v1/posts/exports/:id` — ADR-0111 job status.
- `GET /v1/posts/exports/:id/download` — presigned download URL (302 redirect).
- `GET /v1/exports/:jobId/status` — legacy Story 10.8 status.

## Related skills

- `export-jobs/SKILL.md` — ADR-0111 bounding, rate limits, `export_jobs` schema,
  and Azure Blob lifecycle details.
- `tenant-export/SKILL.md` — Story 3.16 on-demand workspace JSON and posts CSV
  exports (`GET /v1/posts?format=csv`).
