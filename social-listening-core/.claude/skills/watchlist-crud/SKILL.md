---
name: watchlist-crud
description: CRUD operations and REST endpoints for Watchlist management in social-listening-core — personal/per-user ownership, RFC 7396 PATCH semantics, and optimistic locking per ADR-0044. Read this before adding a new watchlist field, before touching the watchlists table schema, or before modifying any /watchlists endpoint.
---

# Watchlist CRUD

## What this is

The persistence and API surface for per-user watchlists: `POST /v1/watchlists`, `GET /v1/watchlists`, `GET /v1/watchlists/:id`, `PATCH /v1/watchlists/:id`, `DELETE /v1/watchlists/:id` (`src/http/versions/v1/watchlistsRouter.ts`), backed by the `watchlists` table (`migrations/0014_create_watchlists.sql` + `migrations/0025_watchlists_ownership_and_versioning.sql`) and `watchlistStore.ts`. Originally Phase 1's "also build, not storied" work; **reworked as Story 1.5 (2026-08-12) against ADR-0044**, which turned it into a real, ADR-governed contract — PATCH semantics, error-code mapping, optimistic locking, and per-user ownership.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0044 | PATCH (RFC 7396), error mapping, `version` optimistic locking, `updated_at` trigger policy, row shape + `user_id` ownership | 1.5 |
| ADR-0006 | Watchlist matching prefers connector-side native filtering with post-fetch fallback | 3.3 |
| ADR-0021 | Boolean query AST for unified watchlist matching semantics | 3.6 |
| ADR-0015 | Tenant isolation enforced at the database layer via RLS | 5.4 |
| ADR-0017 | All routes live under `/v1/` with API versioning | 1.3 |

## Contracts that constrain this component

- `contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts` — the owning contract, proving ADR-0044's full surface (ownership, PATCH semantics, error mapping, locking) end to end.
- `contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts` — assumes a `Watchlist` shape with `terms` for OR-of-terms matching.
- `contracts/epic-3/story-3.6.watchlist-boolean-ast.contract.test.ts` — assumes a `Watchlist` shape with `booleanQuery` for AST-based matching.
- `contracts/epic-5/story-5.1.thin-events.contract.test.ts` — `SocialPostIngestedEvent` carries a `watchlistId` field referencing a stored watchlist.
- `contracts/epic-3/story-3.8.self-service-tenant-initiated-deletion.contract.test.ts` and `contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts` — both call `createWatchlist()` directly; updated 2026-08-12 for the new required `userId` parameter (see "Relations to other components" below for the deeper cross-story finding).

## Data Model

```typescript
// Backed by migrations/0014_create_watchlists.sql + 0025_watchlists_ownership_and_versioning.sql
interface WatchlistRow {
  id: string;              // UUID primary key
  tenant_id: string;        // UUID, RLS-filtered
  user_id: string;          // UUID, RLS-filtered (ADR-0044 §5c) — ON DELETE CASCADE from users(id)
  name: string;
  match_type: string;       // 'keyword' | 'hashtag' | 'account' | 'boolean'
  terms: string[] | null;   // null for 'boolean'; non-empty array otherwise
  boolean_query: string | null; // non-null for 'boolean'; null otherwise
  platform_ids: string[];
  is_active: boolean;
  version: integer;         // optimistic locking (ADR-0044 §3), starts at 1
  created_at: TIMESTAMPTZ;
  updated_at: TIMESTAMPTZ;  // trigger-maintained, update_updated_at_column()
}

// REST shape (serialized/deserialized at the router boundary) — userId is
// deliberately NOT exposed (ADR-0044 Appendix A never surfaces it).
interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[] | null;
  booleanQuery?: string;
  platformIds: string[];
  isActive: boolean;
  version: number;
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

## The contract, in brief (ADR-0044)

- **PATCH is RFC 7396 JSON Merge Patch.** A key's *presence* in the request body (not its value) drives behavior: absent = unchanged, `null` = delete (where nullable), any other value = full replace (arrays are replaced whole, never merged). See `WatchlistPatchInput`'s own doc comment in `watchlistStore.ts` — build patch objects with `'key' in req.body` checks, never a plain object literal.
- **Optimistic locking is mandatory on PATCH.** `If-Match: "<version>"` is required — missing it is `428`; a stale value is `409` with `{ code: 'version_conflict', current_version }`. The version-check-and-write is one atomic `UPDATE ... WHERE id = $ AND version = $` — never a separate read-then-write, which would reopen the exact race optimistic locking exists to close.
- **Error codes**: `400 bad_request` (malformed/wrong-shape body), `404 not_found` (missing, cross-tenant, or another user's — all three identical, undistinguishable by design), `422 validation_failed` (matchType ↔ terms/booleanQuery invariant violated), `409 version_conflict`, `428 precondition_required`. `403` is never used by this component — ownership is an RLS boundary, not a role check.
- **Ownership is personal, not tenant-wide (ADR-0044 §5c).** Both `tenant_admin` and `tenant_user` may create/own watchlists; there is **no Tenant-Admin oversight override** — a Tenant-Admin's own watchlists are exactly as private as anyone else's. Enforced by a second RLS predicate on `user_id`, propagated via `app.user_id` (see `withTenant()`'s optional 4th parameter) the same transaction-local way `app.tenant_id` already is.

## How to extend this safely

- **Adding a new field to `Watchlist`:**
  1. Add the column to the `watchlists` table in a new migration.
  2. Add the field to both `WatchlistRow` and the REST `Watchlist` interface in `watchlistStore.ts`.
  3. Decide nullability under RFC 7396 if it's PATCH-able — add it to `WatchlistPatchInput` and the `if ('key' in patch) setField(...)` list in `updateWatchlist()`.
  4. Update the router's create-path validation if the field needs shape checking.
  5. Add contract tests proving the new field round-trips correctly, including its PATCH null/omit/replace behavior if applicable.

- **Adding a new match type:**
  - Extend the `match_type` enum/union type (currently `'keyword' | 'hashtag' | 'account' | 'boolean'`) in both the router's `MATCH_TYPES` array and `watchlistStore.ts`'s type unions.
  - Extend `validateWatchlistShape()` if the new type has its own terms/booleanQuery requirement.
  - Ensure `watchlist-matching`'s dispatch logic handles it appropriately.

- **Adding a query filter to `GET /v1/watchlists`:**
  - Add query param parsing in `watchlistsRouter.ts`.
  - Add a WHERE clause to `listWatchlists()` in `watchlistStore.ts` (ownership/tenant filtering stays RLS-only — never add an explicit `WHERE user_id = ...`, which would be redundant with, and could silently drift from, the RLS policy).
  - Add contract tests proving the filter works.

## Load-bearing constraints — do not change casually

- **Tenant isolation AND per-user ownership are both enforced at the database layer (ADR-0015, ADR-0044 §5b/§5c).** Never bypass `withTenant()` when querying the `watchlists` table for an ordinary caller-scoped operation. Every store function takes `(tenantId, userId, ...)` and passes `userId` through to `withTenant()`'s 4th parameter — dropping it silently reintroduces either a tenant leak or an ownership leak, RLS-caught only if you actually test for it.
- **The one deliberate exception**: Story 3.8's `exportTenantData()` (`src/tenants/tenantDeletion.ts`) reads `watchlists` via `getAdminPool()` (not `platform_admin_role` — the plain superuser pool this project's migration runner already uses), with `tenant_id` still enforced explicitly in the SQL. This is a whole-tenant compliance-export operation that structurally cannot be scoped to one user's ownership — see that file's own 2026-08-12 header note before adding a second such exception anywhere else.
- **`watchlists.user_id` is `ON DELETE CASCADE` from `users(id)`**, deliberately — added during this story after discovering Story 3.8's tenant hard-delete would otherwise FK-violate when deleting a `users` row that an un-owned-by-anyone-else watchlist still referenced (the ownership RLS predicate blocks `batchDeleteByTenant('watchlists', ...)` from removing it directly; cascade closes the gap when the owning user is deleted next in that same pipeline). A watchlist disappearing when its owner does is correct behavior generally, not a workaround adopted only for Story 3.8.
- **`watchlists.id` is a UUID, not a sequential integer.** Matches every other tenant-scoped table.
- **`platform_ids` is an array, not a single value.**
- **`updated_at` is trigger-maintained (`update_updated_at_column()`, migration 0014), never application-set** — per ADR-0044 §4. Do not add an `updated_at = now()` clause to any UPDATE statement in this component.
- **`version` only ever changes via the atomic UPDATE in `updateWatchlist()`.** Never write to it from anywhere else.
- **`matchType` ↔ `terms`/`booleanQuery` invariant (ADR-0044 §5a) is enforced at the application layer** via `validateWatchlistShape()` (exported from `watchlistStore.ts`), called by the router on create and internally by `updateWatchlist()` on any PATCH touching those three fields, against the *merged* resulting state — not the raw patch body alone.

## Known gaps / deferred work

- **No per-user watchlist count/complexity cap** — ADR-0044's own deliberately unresolved Open Question, pending real usage data (mirrors ADR-0020's precedent of not building limits ahead of need).
- **No cross-tenant/admin watchlist listing endpoint** — out of scope; Platform Admin has zero access to this table by design (ADR-0030 §2), unaffected by this story.
- **No structural boolean-query validation at creation time** — `watchlist-matching` validates AST correctness when the watchlist is actually used, not here.
- **No uniqueness constraint on `name` per (tenant, user).**
- **No pagination on `GET /v1/watchlists`.**
- **No `activity_logs`-style mutation audit trail** — `version` + `updated_at` are this project's current change-tracking mechanism for this table (ADR-0044 §6), deliberately.

## Relations to other components

- **`watchlist-matching`** (`src/watchlists/matcher.ts`, `dispatch.ts`, `ast.ts`): consumes a `Watchlist`-shaped object's `match_type`/`terms`/`boolean_query` fields — decoupled via its own `WatchlistTerms` type in `types.ts`, so this story's changes to `watchlistStore.ts` didn't ripple there.
- **`self-service-tenant-deletion`** (Story 3.8): a real, load-bearing cross-story finding from this story's own build — `watchlists` becoming the first table with per-user ownership RLS broke that story's whole-tenant export (silently returned zero watchlists) and its hard-delete pipeline (FK-violation hang once `users` rows were deleted before their un-cascaded watchlist rows). Fixed via `ON DELETE CASCADE` (migration 0025) and the `getAdminPool()` exception in `exportTenantData()` — see that file's own header note, not repeated here.
- **`provider-connector-framework`**: connectors use `translateWatchlistQuery()`/`supportedQueryFeatures` against the data this component owns.
- **`posts-api`**: `GET /v1/posts` accepts a `watchlistId` filter (not yet built).
- **`ingestion-events`**: `SocialPostIngestedEvent` carries `watchlistId`.
- **`social-listening-admin`**: the Next.js admin UI calls these endpoints; out of scope here.
