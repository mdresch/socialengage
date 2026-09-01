# ADR-0111: Export bounding, streaming, and size caps

**Status:** Accepted (2026-08-28)

**Authorizes:** the resource guards for `GET /v1/posts/export.csv`, `GET /v1/exports/:id`, and export streaming, including synchronous size caps, async thresholds, Blob lifecycle, and rate-limiting.

**Source:** `docs/product-research/feature-designs/10-data-export.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Exports can be large
`docs/product-research/feature-designs/10-data-export.md` and `ADR-0090` describe a CSV export endpoint. Without bounding, a tenant could request millions of rows, exhausting memory, storage, and the worker.

### 2. Streaming and async are already part of `ADR-0090`
This ADR finalizes the limits: how many rows can be synchronous, when a request goes async, how async exports are stored, and when they expire.

### 3. Rate limiting must be tenant-scoped
Exports are expensive. A per-tenant rate limit prevents abuse and runaway costs.

---

## Decision

### 1. Synchronous export caps
- `limit <= 5,000` and `format='csv'` is synchronous.
- `Content-Type: text/csv; charset=utf-8`.
- Streamed row-by-row; no full in-memory materialization.
- Default `limit` is 1,000.

### 2. Async export thresholds
- Any request with `limit > 5,000`, or `format='json'`, or `watchlistId` that matches > 5,000 posts goes async.
- `POST /v1/posts/export` (async) returns `202 Accepted` with `jobId`.
- The worker streams the result to Azure Blob Storage and writes `export_jobs`:
  ```sql
  export_jobs (
    id uuid,
    tenant_id uuid,
    requested_by_user_id uuid,
    status text,                 -- 'pending' | 'running' | 'ready' | 'expired' | 'failed'
    format text,
    row_count int,
    blob_path text,
    sha256 text,
    expires_at timestamptz,
    created_at timestamptz
  );
  ```

### 3. Hard limits
- CSV: max 100,000 rows per export.
- JSON: max 10,000 rows per export (because JSON includes full post bodies and is larger).
- Max concurrent async exports per tenant: 3.
- Max export file size: 100 MB.

### 4. Rate limiting
- `GET /v1/posts/export.csv` — 60 requests per hour per tenant.
- `POST /v1/posts/export` — 20 async jobs per hour per tenant.
- `GET /v1/exports/:id` — 120 requests per hour per tenant.
- `GET /v1/exports/:id/download` — 10 downloads per hour per tenant.

### 5. Blob storage lifecycle
- Async exports are stored in a tenant-scoped Blob container.
- Default expiry: 24 hours for the download URL, 7 days for the blob object.
- Expired exports are hard-deleted by a scheduled worker.
- `export_jobs` rows are retained for 90 days for audit.

### 6. Error responses
- `400 INVALID_LIMIT` if `limit` < 1 or > hard cap.
- `429 EXPORT_RATE_LIMITED` if rate cap exceeded.
- `422 EXPORT_TOO_LARGE` if the matched set exceeds 100,000 rows.
- `500 EXPORT_WORKER_FAILED` if the async job fails, with a retryable `jobId`.

---

## Consequences

1. **Predictable resource use:** exports cannot monopolize the server.
2. **Cost control:** blob lifecycle and rate limits keep storage and compute bounded.
3. **Audit trail:** `export_jobs` tracks who exported what and when.
4. **User experience:** small exports are fast and synchronous; large exports are async with a download link.

---

## Alternatives considered

1. **Allow unlimited synchronous exports.**
   - *Rejected:* it risks out-of-memory and connection timeout. Streaming and async are required.

2. **Keep async exports forever.**
   - *Rejected:* it creates unbounded storage. 7-day blob retention with a 24-hour download URL is reasonable.

3. **Rate limit by user, not by tenant.**
   - *Rejected:* a single malicious user can still exhaust tenant quota. Tenant-level caps are the platform's control.

---

## Open questions

- Should the synchronous cap be configurable per plan (free vs. paid)?
- How is the matched-row count estimated before the export begins?
- Should failed exports be retried automatically, or only on manual re-queue?
- How are CSV and JSON exports signed for integrity?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/10-data-export.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0090` (CSV export), `ADR-0074` (workspace export), `ADR-0016` (Azure Blob)
