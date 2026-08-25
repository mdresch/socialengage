---
name: tenant-export
description: On-demand tenant workspace JSON and matched-posts CSV export endpoints (Story 3.16, ADR-0074). Read before touching tenant export routes, the workspace store, or CSV rendering.
---

# Tenant export endpoints

## What this is

`GET /v1/tenants/me/export/workspace` and `GET /v1/posts?format=csv` (Story 3.16,
ADR-0074). These are on-demand, synchronous, bounded exports for a tenant's own
data — a safe-metadata workspace JSON archive and a flat CSV of the same matched
posts the caller is already authorized to see. They are intentionally separate
from the offboarding/deletion export in `src/tenants/tenantDeletion.ts`
(ADR-0043) and must not be coupled to it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0074 | New tenant-facing workspace JSON (`/v1/tenants/me/export/workspace`) and matched-posts CSV (`/v1/posts?format=csv`) exports | 3.16 |
| ADR-0043 | Reusable cross-RLS `watchlists` read pattern via `getAdminPool()` (this export uses the same narrow exception) | 3.8 |
| ADR-0044 §5c | A `tenant_admin` may access all users' watchlists for the workspace export only | — |
| ADR-0030 §2 | `platform_admin` zero-tenant-content boundary — both exports reject `platform_admin` with `403` | 5.7 |

## Files that make this work

- `src/tenants/tenantExportStore.ts` — assembles the workspace JSON archive.
- `src/http/versions/v1/tenantExportRouter.ts` — `GET /v1/tenants/me/export/workspace`.
- `src/posts/socialPostStore.ts` — `exportSocialPostsCsv()` (row-capped, `watchlistId` filter).
- `src/posts/csvExport.ts` — flat, RFC 4180-ish CSV quoting helper.
- `src/http/versions/v1/postsRouter.ts` — `?format=csv` branch on `GET /v1/posts`.
- `src/http/versions/v1/router.ts` — mounts `tenantExportRouter` at `/v1/tenants/me/export`.
- `contracts/epic-3/story-3.16.tenant-workspace-and-posts-export.contract.test.ts`.

## Load-bearing constraints — do not change casually

- `tenant_admin` only for the workspace export; `tenant_user` gets `403`.
- Both `tenant_admin` and `tenant_user` may call the CSV export; `platform_admin` gets `403`.
- Workspace export uses `getAdminPool()` only for the `watchlists` query, because that table's per-user ownership RLS would otherwise hide other users' watchlists. All other tables use `withTenant()`.
- `platform_credentials` is queried with an explicit, allow-listed column set (`id`, `platform_id`, `owner_type`, `user_id`, `created_at`). Secret-bearing columns (`ciphertext`, `wrapped_dek`, `iv`, `auth_tag`, `key_vault_key_id`) are never selected.
- `raw_payload` and full `enrichment` JSONB are not included in the workspace archive. The post section uses the same canonical field set as the CSV: `id`, `publishedAt`, `provider`, `authorName`, `authorUrl`, `title`, `bodyMarkdown`, `url`, `sentiment`, `keywords`, `watchlistIds`.
- Workspace size cap is controlled by `WORKSPACE_EXPORT_MAX_BYTES` (default 1 MB); CSV row cap by `POSTS_CSV_MAX_ROWS` (default 10,000). Both return `413` with code `EXPORT_TOO_LARGE` when exceeded.
- CSV is UTF-8 with a BOM (`\uFEFF`), RFC 4180-ish quoting (commas, quotes, and newlines trigger wrapping and quote-doubling), and a header row.

## How to extend this safely

- Adding a workspace section: update `src/tenants/tenantExportStore.ts` and add an AC in the contract. Do not add credential secrets or raw payloads.
- Adding a CSV column: update `CSV_HEADERS` in `socialPostStore.ts`, the contract's header assertion, and the SQL `SELECT`. Keep the workspace post section in sync.
- Adding a filter to `GET /v1/posts?format=csv`: mirror whatever `listSocialPosts()` learns. The CSV export must return the same result set as the JSON endpoint for the same filter.
