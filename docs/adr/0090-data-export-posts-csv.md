# ADR-0090: Data export — posts CSV

**Status:** Accepted (2026-08-28)

**Acceptance note (2026-08-28):** Accepted by Menno. Authorizes the synchronous and asynchronous streaming CSV post export engine. Story 10.8 is fully implemented and verified.

**Authorizes:** a `GET /v1/posts/export.csv` endpoint that lets a `Tenant-Admin` or `Tenant-User` export their matched posts to CSV, bounded by watchlist, date range, and size, with strict RLS and no raw-secret leakage.

**Source:** `docs/product-research/feature-designs/10-data-export.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Data portability is an enterprise requirement
`docs/product-research/feature-designs/10-data-export.md` describes the need for tenants to download listening data in machine-readable formats for backup, analysis, and compliance. `ADR-0074` already covers workspace JSON export; this ADR covers the posts CSV path.

### 2. CSV is the most common analysis interchange
While JSON preserves structure, CSV is the format most users expect for dropping into Excel, BI tools, or regulatory filings. It must be bounded and streamed so large exports do not crash the server.

### 3. Exports must respect RLS and avoid secrets
The endpoint must only export posts the caller can see. It must not include `rawPayload` secrets, `enrichment` JSONB internals, or connector credentials.

---

## Decision

### 1. New `GET /v1/posts/export.csv` endpoint
```
GET /v1/posts/export.csv?watchlistId=...&start=...&end=...&format=csv&limit=10000
```

**Query parameters**
- `watchlistId` (optional) — filter to a watchlist the user owns or that is shared.
- `start`, `end` (optional) — `published_at` range, ISO 8601.
- `limit` (optional) — default 1000, hard cap 50000.
- `format` — `csv` only in v1. `json` is handled by `ADR-0074`.

**Response**
- `Content-Type: text/csv`.
- `Content-Disposition: attachment; filename="<tenant>-posts-<date>.csv"`.
- Streaming, row-by-row generation.

### 2. CSV columns
```
post_id, published_at, platform_id, author_name, author_url, body_markdown, sentiment, topics, reach, engagement, url, watchlist_ids
```

- `body_markdown` is the canonical normalized post body.
- `sentiment` is the derived `enrichment` label.
- `topics` is a pipe-separated list of topic names.
- `reach` and `engagement` come from `SocialPost` metadata if present.
- `watchlist_ids` is a pipe-separated list of matching watchlists.
- `rawPayload` and `enrichment` JSONB internals are **excluded**.

### 3. RLS and bounding
- The endpoint uses `withTenant()` and the caller's `tenant_id`.
- `watchlistId` must belong to the user or be shared with the caller.
- `limit` is enforced before streaming begins.
- Rows are sorted by `published_at` descending.

### 4. Async for large exports
- If `limit > 10000`, the request returns `202 Accepted` with a `jobId`.
- A background worker writes the CSV to Blob Storage and the caller receives a presigned download URL.
- `GET /v1/exports/:jobId/status` tracks `pending`, `ready`, `expired`, `failed`.

### 5. No secrets
- Connector credentials, `rawPayload` secret fields, and `enrichment` raw JSONB are not written.
- `author_url` is public profile URL only.
- `platform_id` is the platform code, not the internal connector ID.

---

## Consequences

1. **Portability:** tenants can take their matched posts into other tools.
2. **Compliance support:** CSV format is suitable for DSR responses and regulator requests.
3. **Bounded streaming:** large exports do not hold HTTP connections open or load all rows into memory.
4. **Storage cost:** async exports create temporary Blob objects; they expire after 24 hours.
5. **Foundation for `15-dsr-self-service-portal`:** the DSR access-request export can reuse this worker and CSV shape.

---

## Alternatives considered

1. **Include `rawPayload` and full `enrichment` JSON in the CSV.**
   - *Rejected:* it leaks connector secrets and makes the CSV unwieldy. Exports should be analysis-ready, not debugging dumps.

2. **Use `GET /v1/posts?format=csv` instead of a dedicated export endpoint.**
   - *Rejected:* it complicates the existing `posts` pagination API and makes it easy to accidentally request 50,000 rows. A separate path makes the export semantics explicit.

3. **Support Excel (`.xlsx`) directly.**
   - *Rejected:* it requires an additional dependency. CSV is universal and can be opened by Excel.

---

## Open Questions

- [ ] **[Q-0090-1]** Should the export include media URLs or only text post bodies?
- [ ] **[Q-0090-2]** What is the right hard `limit` for synchronous exports — 1,000, 5,000, or 10,000?
- [ ] **[Q-0090-3]** Should `Tenant-Admin` see exports initiated by all tenant users?
- [ ] **[Q-0090-4]** How should the DSR `access` request reuse this export shape? Should the same endpoint accept a `dsr=true` flag?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/10-data-export.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0074` (workspace JSON export), `ADR-0015` (tenant RLS), `ADR-0018` (retention)

---

## Implementation Learnings & Real-World Constraints (Amended 2026-08-27 per ADR-0122)

- **`$O(1)` Streaming Standard for Posts CSV**: Enforces direct chunked streaming from Postgres cursor queries through core and Next.js proxy route handlers to prevent server heap exhaustion.
- **Operational Trade-offs**: Holds client-to-proxy connection handles for the duration of the download; single exports exceeding serverless timeouts must utilize asynchronous blob generation (ADR-0111).
- **Reference Commits**: `cf1f96c` (Story 6.40 `/api/posts/export.csv` streaming proxy route).

### Pending supersession note (2026-08-28)

If ADR-0124 (Proposed, 2026-08-28) is accepted, this ADR's Decision §1 would be extended by ADR-0124's own §1 and §2 — specifically an explicit 24-month maximum lookback bound and an opt-in sample=true representative sampling mode for large synchronous exports. This is a pending note only: ADR-0124 is currently Proposed, not accepted. Per ADR-0047 §2, don't assume already-shipped code changes automatically — it would only change once ADR-0124's own story is actually built following acceptance. This ADR's original Decision and Consequences text above is unchanged and remains the historical record.