---
name: posts-csv-export
description: Synchronous streaming CSV export and asynchronous blob export job runner (ADR-0090, Story 10.8).
---

# Posts CSV Export (ADR-0090)

## Purpose
Enables tenant users to export filtered social post datasets for offline analysis, auditing, or CRM integration via bounded sync streaming (<= 5k rows) or async jobs (<= 100k rows).

## Invariants
1. **Synchronous Streaming:** `GET /v1/posts/export.csv` streams directly with `Content-Type: text/csv` up to 5,000 rows. Properly escapes special characters (quotes, commas, newlines).
2. **Asynchronous Jobs:** `POST /v1/posts/export` creates a background job record with 24-hour expiration (`expires_at`), returning `202 Accepted` with a job ID and status URL.
3. **Status Polling:** `GET /v1/exports/:jobId/status` returns status (`pending`, `processing`, `completed`, `failed`), `download_url`, and `row_count`.
4. **Tenant Scoping:** All exports enforce tenant RLS boundaries via `withTenant()`.

## Endpoints
- `GET /v1/posts/export.csv`: Synchronous streaming CSV download.
- `POST /v1/posts/export`: Initiate async export job.
- `GET /v1/exports/:jobId/status`: Check export job status.
