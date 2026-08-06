---
name: platform-admin-audit-log
description: GET /v1/admin/audit-log — the read-only, cursor-paginated (ADR-0011 convention) HTTP surface over platform_admin_audit_log. Read this before touching adminAuditLogRouter.ts or auditLogCursor.ts, before adding a new filter to the query, or before adding a field to platform_admin_audit_log that should be queryable here.
---

# Platform Admin audit-log query REST surface

## What this is

`adminAuditLogRouter.ts` is a single `GET /v1/admin/audit-log` route, Platform Admin only, over the `platform_admin_audit_log` table Story 5.7 already writes to (via `logPlatformAdminAction()`, unchanged by this story). It is read-only and additive — no write path, no new table, no change to what gets logged or how. `queryPlatformAdminAuditLog()` (`src/admin/platformAdminAuditLog.ts`) does the actual filtering/pagination; the router only gates the caller and forwards query parameters.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 §5 | Every Platform-Admin-bypassed write must be durably logged and queryable | 5.7 (write path), 5.14 (this query surface) |
| ADR-0011 | Cursor-based pagination convention (`cursor`/`limit` query params, opaque token) | 5.14 reuses this convention, not `GET /posts` itself |

## Contracts that constrain this component

- `contracts/epic-5/story-5.14.platform-admin-audit-log-rest-surface.contract.test.ts` — entry shape (`id`, `actorIdentity`, `operation`, `targetTenantId`, `detail`, `createdAt`); filtering by `tenantId`, `actorIdentity`, and `from`/`to`; cursor pagination walks distinct pages with no duplicate/overlapping entries when no filters are given; only `GET` is registered on the route at all; `tenant_admin`/`tenant_user`/unauthenticated callers are all rejected; the router cannot leak a TAP/password — it never references either field name, and a logged entry's `detail` passes through byte-identical (no independent way for this endpoint to introduce a leak Story 5.7/5.13 didn't already prevent at the write path).

## How to extend this safely

- **A new filter** (e.g. `operation`): add it to `AuditLogQueryFilters` and `queryPlatformAdminAuditLog()`'s `WHERE` clause in `platformAdminAuditLog.ts` — parameterized, same pattern as `tenantId`/`actorIdentity`. Never string-concatenate a filter value into the SQL.
- **A new field on the returned shape:** add it to `PlatformAdminAuditLogEntry` and `mapRowToEntry()` in `platformAdminAuditLog.ts` — the router itself has no field-mapping logic of its own to touch.
- **This table has no monotonic `seq` column** the way `social_posts` does (`posts/cursor.ts`'s own pattern) — `auditLogCursor.ts` instead keys on `(created_at, id)`, ordered `DESC` (newest first), with `id` breaking ties when two rows share a `created_at` value. Don't switch to a single-column `created_at`-only cursor — timestamps are not guaranteed unique across rows.

## Load-bearing constraints — do not change casually

- **This router never calls anything in `breakGlassCredentialReset.ts` or `tenantStore.ts`, and never constructs a `detail` value itself** — it only ever `SELECT`s and forwards `platform_admin_audit_log`'s own columns. This is the structural half of AC5's leak-proof; don't add a "for convenience" field built from anything other than the row itself.
- **Cursor tokens are opaque** (ADR-0011) — `auditLogCursor.ts`'s `encodeAuditLogCursor()`/`decodeAuditLogCursor()` are the only sanctioned way to produce or read one; never accept a client-constructed `{createdAt, id}` pair directly as if it were trusted input.
- **Ordering is `created_at DESC, id DESC`** (newest first) — a client walking pages via `nextCursor` sees the most recent entries first. Don't flip to ascending without updating the cursor's `<` comparison to match, or pagination will silently skip or repeat rows.
- **`limit` is clamped, not rejected** — an out-of-range value is silently bounded to `[1, MAX_LIMIT]` rather than erroring, matching `listSocialPosts()`'s own convention in `socialPostStore.ts`.

## Known gaps / deferred work

- **No `operation`-name filter yet** — a caller can filter by `tenantId`/`actorIdentity`/date range only; filtering by e.g. `operation=break_glass_credential_reset` requires a client-side scan of the paginated results today. Add per "How to extend this safely" above if a real need appears.
- **No total-count field** — same limitation ADR-0011 already names for `GET /posts`: cursor pagination doesn't give "page 5 of 40" style navigation for free. Not built here; not required by this story's own Acceptance Criteria.
