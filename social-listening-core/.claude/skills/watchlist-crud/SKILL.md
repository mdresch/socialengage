---
name: watchlist-crud
description: CRUD operations and REST endpoints for Watchlist management in social-listening-core. Read this before adding a new watchlist field, before touching the watchlists table schema, or before modifying any /watchlists endpoint.
---

# Watchlist CRUD

## What this is

The persistence and API surface for tenant-defined watchlists: `POST /v1/watchlists`, `GET /v1/watchlists`, `PATCH /v1/watchlists/:id`, `DELETE /v1/watchlists/:id` (`src/http/versions/v1/watchlistsRouter.ts`), backed by the `watchlists` table (`migrations/0014_create_watchlists.sql`) and `WatchlistStore` (`src/watchlists/watchlistStore.ts`). This is Phase 1's "also build, not storied" work (see `docs/open-items-and-deferred-work.md` §A, `docs/implementation-plan.md` Phase 1) — the CRUD surface and admin UI that validates the full ingestion pipeline end to end, not an architecturally interesting decision warranting its own ADR.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0006 | Watchlist matching prefers connector-side native filtering with post-fetch fallback | 3.3 |
| ADR-0021 | Boolean query AST for unified watchlist matching semantics | 3.6 |
| ADR-0015 | Tenant isolation enforced at the database layer via RLS | 5.4 |
| ADR-0017 | All routes live under `/v1/` with API versioning | 1.3 |

This component implements the CRUD surface those ADRs depend on, but does not introduce new architectural decisions itself.

## Contracts that constrain this component

- This is **not storied work** — no contract test in `contracts/` owns this component directly (it's Phase 1's explicitly "also build, not storied" scope). However, these contracts depend on watchlists existing:
  - `contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts` — assumes a `Watchlist` shape with `terms` for OR-of-terms matching
  - `contracts/epic-3/story-3.6.watchlist-boolean-ast.contract.test.ts` — assumes a `Watchlist` shape with `booleanQuery` for AST-based matching
  - `contracts/epic-5/story-5.1.thin-events.contract.test.ts` — `SocialPostIngestedEvent` carries a `watchlistId` field referencing a stored watchlist

The **watchlist-crud.contract.test.ts** created alongside this SKILL.md proves the REST surface and persistence layer work correctly, following the same contract-first discipline as storied work.

## Data Model

```typescript
// Backed by migrations/0014_create_watchlists.sql
interface WatchlistRow {
  id: string;              // UUID primary key
  tenant_id: string;       // UUID, RLS-filtered
  name: string;           // Display name
  match_type: string;      // 'keyword' | 'hashtag' | 'account' | 'boolean'
  terms: string[];        // Simple OR-of-terms (keyword/hashtag/account)
  boolean_query?: string;  // Optional: full boolean query syntax
  platform_ids: string[];  // Scoped to subset of connected platforms
  is_active: boolean;      // Default true
  created_at: TIMESTAMPTZ;
  updated_at: TIMESTAMPTZ;
}

// REST shape (serialized/deserialized at the router boundary)
interface Watchlist {
  id: string;
  name: string;
  matchType: string;
  terms: string[];
  booleanQuery?: string;
  platformIds: string[];
  isActive: boolean;
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

## How to extend this safely

- **Adding a new field to `Watchlist`:**
  1. Add the column to the `watchlists` table in a new migration
  2. Add the field to both `WatchlistRow` and the REST `Watchlist` interface in `watchlistStore.ts`
  3. Update `INSERT`/`UPDATE`/`SELECT` statements in `watchlistStore.ts`
  4. Update the OpenAPI shape in the router if exposed
  5. Add contract tests proving the new field round-trips correctly
  
- **Adding a new match type:**
  - Extend the `match_type` enum/Union type (currently 'keyword' | 'hashtag' | 'account' | 'boolean')
  - Ensure `watchlist-matching`'s dispatch logic (`resolveWatchlistDispatch`/`resolveWatchlistAstDispatch`) handles it appropriately
  - Update the validation in the router

- **Adding a query filter to `GET /v1/watchlists`:**
  - Add query param parsing in `watchlistsRouter.ts`
  - Add WHERE clause to `listWatchlists()` in `watchlistStore.ts`
  - Add contract tests proving the filter works

## Load-bearing constraints — do not change casually

- **Tenant isolation is enforced at the database layer (ADR-0015).** Never bypass `withTenant()` when querying the `watchlists` table. Never add a route that reads watchlists without the `X-Tenant-Id` header, even if the current implementation doesn't enforce it as a security boundary (Phase 5 work).

- **`watchlists.id` is a UUID, not a sequential integer.** This matches the pattern of all other tenant-scoped tables (`social_posts`, `ingestion_runs`, `platform_credentials`, `authors`) and ensures no cross-tenant ID collisions.

- **`platform_ids` is an array, not a single value.** A watchlist can be scoped to multiple platforms simultaneously. The `watchlist-matching` component uses this to determine which connectors should apply the watchlist filter.

- **`match_type` and `boolean_query`/`terms` are mutually related.** When `match_type === 'boolean'`, `boolean_query` should be present and `terms` should be empty or ignored. When `match_type` is one of the other three, `terms` carries the values. This is enforced at the API layer, not the database layer.

- **`is_active` defaults to `true`.** New watchlists are active immediately. Setting to `false` effectively disables the watchlist without deleting it.

- **`created_at` and `updated_at` are managed by the store.** Never set these manually in router code; `watchlistStore.ts` handles them automatically.

## Known gaps / deferred work

- **No list-all-watchlists-for-a-tenant endpoint exists yet** — only `GET /v1/watchlists` (list for current tenant) is built. A `GET /v1/tenants/:tenantId/watchlists` or similar cross-tenant admin endpoint is explicitly out of scope for this component (Phase 5 authentication work).

- **No watchlist validation beyond JSON schema** — the router accepts whatever `match_type`/`terms`/`boolean_query` are provided. Structural validation of boolean query syntax happens in the `watchlist-matching` component when the watchlist is actually used, not at creation time.

- **No uniqueness constraint on `name` per tenant** — multiple watchlists with the same name are allowed. Adding one would require a database-level constraint or application-level check.

- **No pagination on `GET /v1/watchlists`** — for a single tenant, the expected watchlist count is small enough that full-table scans are acceptable. If this assumption proves wrong, add cursor-based pagination following ADR-0011's pattern.

- **No soft-delete support** — `DELETE /v1/watchlists/:id` performs a hard delete. Adding soft delete would require an `is_deleted` column and filtering, plus cascade behavior decisions for dependent data (none currently exists).

## Relations to other components

- **`watchlist-matching`** (`src/watchlists/matcher.ts`, `src/watchlists/dispatch.ts`, `src/watchlists/ast.ts`): Consumes `Watchlist` shapes from this component. The `match_type`/`terms`/`boolean_query` fields drive which matching path (native connector-side vs. post-fetch fallback) is used.

- **`provider-connector-framework`**: Connectors use `translateWatchlistQuery()` (terms-based) or `supportedQueryFeatures` (AST-based) to determine if they can handle a watchlist natively. The watchlist data from this component is what they translate/evaluate against.

- **`posts-api`**: `GET /v1/posts` accepts a `watchlistId` filter (not yet built — see `.claude/skills/posts-api/SKILL.md` §Known gaps). When built, it will query posts that match the specified watchlist's criteria.

- **`ingestion-events`**: `SocialPostIngestedEvent` carries `watchlistId` referencing a watchlist from this component. The event publishing wiring (Phase 1 deferred work) will associate posts with their triggering watchlist(s).

- **`social-listening-admin`**: The Next.js admin UI (separate repo) will call these endpoints to manage watchlists. This component only provides the API surface; the UI is out of scope here.
