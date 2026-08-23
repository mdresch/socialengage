# ADR-0074: Tenant-Facing Workspace and Matched-Posts Export

**Status:** Accepted (2026-08-23)

**Accepted by Menno 2026-08-23.** Authorizes two new tenant-facing `GET` endpoints in `social-listening-core` — a full workspace JSON archive (`/v1/tenants/me/export/workspace`) and a matched-posts CSV export (`/v1/posts/export.csv`) — powering the `/tenant/settings` export buttons with real API calls and no mock/fallback values.

**Source:** User request to implement `docs/design/Google AI Studio/src/views/TenantSettingsView.tsx` on the real `/tenant/settings` page, with the explicit constraint that all UI data must come from real `social-listening-core` API calls and no mock/fallback values.

---

## Context

### 1. The design requires two on-demand export actions
The Google AI Studio `TenantSettingsView.tsx` design shows two buttons on the Tenant Settings screen:

- **Export Full Workspace (JSON)** — "Download full historical archives of watchlists, enriched posts, and connector configs."
- **Export Matched Posts (CSV)** — "Export Matched Posts (CSV)."

These are presented as ordinary, on-demand tenant actions, not tied to the deletion/offboarding flow.

### 2. Workspace metadata already has a real backend source
The design's read-only workspace cards (`name`, `domain`, `activeSeats`/`licenseSeats`, `createdAt`) already map to the existing `GET /v1/tenants/me` response (Story 1.8, ADR-0031). No new backend data store is needed for those cards.

### 3. No on-demand export endpoints exist today
- `social-listening-core/src/tenants/tenantDeletion.ts` has an `exportTenantData()` function, but it is an internal helper for the self-service tenant-deletion offboarding flow (Story 3.8, ADR-0043), not a tenant-facing on-demand endpoint.
- That deletion export is triggered inside a deletion request and is conceptually coupled to the 30-day offboarding lifecycle.
- There is no endpoint that produces a CSV of posts, whether matched or otherwise.

### 4. The design's client-side context does not exist in the project
The design file imports `useApp` from a non-existent `../context/AppContext` and calls a non-existent `exportTenantData('json'/'csv')` helper. Those artifacts must not be introduced as mock/fallback mechanisms. The real UI must call real `social-listening-core` endpoints.

---

## Decision

### 1. New tenant-facing export endpoints, separate from deletion export
Introduce two new `GET` endpoints in `social-listening-core`, distinct from `POST /v1/tenants/self-service-deletion` and its export step:

- `GET /v1/tenants/me/export/workspace` — returns a full workspace JSON archive.
- `GET /v1/posts?format=csv` (or `GET /v1/posts/export.csv`) — returns a CSV of the same posts the caller is authorized to see through `GET /v1/posts`.

Both endpoints are tenant-scoped behind the existing `authMiddleware` (ADR-0029/0033) and `withTenant()` RLS path (ADR-0015).

### 2. Authorization

| Endpoint | Role | Rationale |
|---|---|---|
| `GET /v1/tenants/me/export/workspace` | `tenant_admin` only | A full workspace export includes all tenant content, including other users' private watchlists (ADR-0044 §5c) and credential/connector metadata. A `tenant_user` has no business need and no ownership right to that breadth of data. |
| `GET /v1/posts` in CSV format | `tenant_admin` or `tenant_user` | The post feed is already visible to both roles (Story 6.11). The CSV export is the same result set, in a different format, with the same filters and authorization. |

No `platform_admin` access to either endpoint — the zero-tenant-content boundary for Platform Admin (ADR-0030 §2/ADR-0041) is preserved.

### 3. Workspace JSON scope
The workspace JSON export reuses the same assembly logic as the deletion export where appropriate (`social_posts` with resolved archived `rawPayload`, `authors`, `watchlists`, `ingestion_runs`, `platform_credentials` metadata, `connector_activations`) but is produced by a new, independent service function. It does **not** include credential secrets, OAuth refresh tokens, or Key Vault-encrypted envelopes (ADR-0014). It includes connector config metadata and the public parts of `platform_credentials` (provider, owner type, active/inactive, creation date) only.

### 4. Matched Posts CSV scope
The CSV export mirrors the query shape of `GET /v1/posts` (cursor pagination, provider/source/author/search filters, and `watchlistId` per ADR-0063) and returns a flat, one-row-per-post CSV with the following columns:

- `id`
- `published_at`
- `provider`
- `author_name`
- `author_url`
- `title`
- `body_markdown`
- `url`
- `sentiment`
- `keywords`
- `watchlist_ids` (comma-separated, if `watchlistId` or matched-watchlist expansion is active)

The output is UTF-8 with a BOM, RFC 4180-ish quoting, and a header row. A default row cap (e.g. 10,000) is applied for v1; larger exports are deferred to an async background-export mechanism (Open Question 2).

### 5. Performance and storage
For v1, both exports are synchronous HTTP responses with a hard size/row cap. The workspace JSON cap is a document size limit (e.g. 100 MB) returned directly in the response body. The posts CSV is streamed to the response as it is generated, with the same row cap.

Large-tenant async export to Azure Blob Storage, with a job-polling/download-URL model, is explicitly left as a future Open Question.

### 6. UI contract
`social-listening-admin` will call these endpoints through `core-client.ts` (ADR-0036 §2). The settings page remains a Server Component; the export buttons are plain links or form posts to these endpoints, not a client-side `useApp()` context. No mock data or client-side fallback values are permitted.

---

## Consequences

- `social-listening-core` gains two new, real, tenant-scoped export endpoints.
- The deletion export in `tenantDeletion.ts` stays unchanged in scope; the new workspace export may refactor shared query/assembly code into a reusable `assembleTenantExport()` helper.
- `social-listening-admin` can implement the design's two export buttons against real API calls.
- The design's `useApp`/`exportTenantData` client-side helper is not implemented; the equivalent actions are real `core-client.ts` calls.
- `lucide-react` is still not a project dependency; the UI styling of the export buttons is a separate frontend concern and remains out of this ADR's scope.

## Note on relation to ADR-0043

ADR-0043's deletion export (Decision §4) remains the sole offboarding/deletion export path. This ADR's workspace export is additive and independent. Where the query/assembly logic overlaps, it is refactored into a shared internal helper, not a second implementation, but the endpoint, authorization, and lifecycle are new.

## Alternatives Considered

- **Extend the offboarding export endpoint to serve non-deletion downloads.** Rejected: the offboarding export is conceptually tied to the deletion lifecycle, has different authorization checks, and its response shape may change with deletion requirements. Mixing on-demand compliance export with offboarding would couple two different concerns.
- **Client-side CSV generation from `GET /v1/posts` results.** Rejected: it would require paginating the entire filtered result set into the browser and would not satisfy the "real API calls only" constraint for the final deliverable file; the export must be produced server-side.
- **`tenant_user` allowed to export the full workspace.** Rejected: a `tenant_user` cannot access other users' private watchlists (ADR-0044 §5c) and has no legitimate need for connector credential metadata or other users' data.

## Open Questions

1. **Endpoint naming:** `GET /v1/tenants/me/export/workspace` vs. `GET /v1/tenants/export/workspace` — the former is consistent with `GET /v1/tenants/me`; the latter is shorter for the UI. Decide at implementation time.
2. **Async export for large tenants:** Synchronous v1 is capped. Whether to build a background job + Azure Blob Storage + polling endpoint for unbounded exports is deferred to a later ADR/story.
3. **Workspace JSON exact column set:** The precise inclusion/exclusion of `ingestion_runs` archived rows, `watchlists` full query AST text, and `platform_credentials` non-secret metadata is left for the implementation contract.
4. **CSV watchlist match expansion:** Whether `watchlist_ids` is a single column, a one-row-per-match expansion, or omitted for the initial version is left to the frontend story's contract.

## Resolved Questions

Resolved during acceptance review on 2026-08-23:

1. **Endpoint naming:** `GET /v1/tenants/me/export/workspace` is chosen for consistency with `GET /v1/tenants/me`. `GET /v1/posts/export.csv` is chosen for the posts CSV export (a dedicated path rather than `?format=csv` on the paginated `GET /v1/posts` endpoint).
2. **Async export for large tenants:** V1 remains synchronous and capped. Async background export to Azure Blob Storage is deferred to a later ADR/story (see ADR-0111).
3. **Workspace JSON exact column set:** Export is a "safe metadata" archive, not a raw dump. Include tenant, users list, watchlists with full query AST, connector activations, and `platform_credentials` non-secret metadata (provider, `owner_type`, active/inactive, created date). For posts, include the same canonical fields as the CSV (`id`, `published_at`, `provider`, `author_name`, `author_url`, `title`, `body_markdown`, `url`, `sentiment`, `keywords`, `watchlist_ids`). Exclude `rawPayload`, full `enrichment` JSONB internals, credential secrets, OAuth refresh tokens, and Key Vault envelopes. Exclude archived `ingestion_runs` raw rows; include only run summary rows if audit continuity is required.
4. **CSV watchlist match expansion:** A single `watchlist_ids` column with comma-separated watchlist IDs. One-row-per-match expansion is deferred to a future "exploded export" option.
