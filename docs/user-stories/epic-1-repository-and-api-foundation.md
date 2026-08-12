# Epic 1: Repository & API Foundation

## Story 1.1 — Core REST API access for the admin UI

**Source:** ADR-0001 · **Status:** Ready

**As an** admin UI developer,
**I want** `social-listening-admin` to talk to `social-listening-core` strictly through its REST API, never directly to the database,
**so that** the core stays independently deployable and testable, and downstream subsystems get the same API surface the admin UI already relies on.

**Acceptance Criteria**
- `social-listening-admin`'s dependency manifest contains no Postgres driver or database connection string.
- Every admin-UI feature (connect/disconnect a platform, manage watchlists, view connector status) is implemented as a call to a `social-listening-core` REST endpoint — no in-process shared code path that bypasses the API.
- `social-listening-core` and `social-listening-admin` can each be deployed, rolled back, and scaled independently without coordinating a joint release.

---

## Story 1.2 — Postgres as the database engine

**Source:** ADR-0016 · **Status:** Ready

**As a** backend engineer setting up the data layer,
**I want** `social-listening-core` provisioned against Azure Database for PostgreSQL, using native JSONB for `rawPayload` and native Row-Level Security for tenant isolation,
**so that** platform-specific post payloads don't force a rigid schema, and tenant isolation is enforced by the database itself rather than only by application code.

**Acceptance Criteria**
- `SocialPost.rawPayload` is a JSONB column, confirmed queryable via JSONB path operators in at least one integration test.
- RLS policies exist on every table carrying `tenantId` before any tenant data is written (see Story 5.4, ADR-0015).
- Database provisioning documentation references Azure Database for PostgreSQL specifically, not a generic "SQL database" placeholder.

---

## Story 1.3 — REST API versioning and compatibility policy

**Source:** ADR-0017 · **Status:** Ready (accepted 2026-07-29, ahead of its natural phase — see ADR-0017's Acceptance note)

**As an** API consumer (admin UI or a future downstream subsystem),
**I want** `social-listening-core`'s REST API served behind a `/v1/` path prefix, with breaking changes only ever shipped as a new version kept live alongside the old one for a deprecation window,
**so that** a change convenient for one feature can't silently break a consumer that isn't in the room when it ships.

**Acceptance Criteria**
- Every REST endpoint is reachable under `/v1/...`; no unversioned route exists.
- A deprecated version continues serving unmodified traffic and returns `Deprecation`/`Sunset` response headers (RFC 8594) for at least 90 days after its successor version ships (implementation default — see ADR-0017's Amendment Log for the current number).
- CI includes a contract check that fails the build if a change to a `/v1/` response shape would break a documented consumer expectation (i.e., catches the kind of change that should have been a `/v2/` bump).

---

## Story 1.4 — Persistent local dev database, separate from the ephemeral test database

**Source:** ADR-0025 · **Status:** Ready — accepted 2026-07-30, the same day it was built and verified (see ADR-0025's Acceptance note on why this is a deliberate exception to Phase 0's "also build, not storied" classification of local dev tooling)

**As a** developer running `social-listening-core` locally to see it actually work (not just pass its contract suite),
**I want** a persistent dev Postgres database, fully independent from the ephemeral one Jest owns for the contract suite,
**so that** running `npm test` can never wipe out data I'm actively looking at through a running `npm run dev` server, and vice versa.

**Acceptance Criteria**
- `docker-compose.dev.yml` defines a Postgres container with its own compose project name, container, network, port, database name, and a named volume — none shared with `docker-compose.test.yml`.
- Data in the dev database survives `docker compose -f docker-compose.dev.yml down`; only an explicit, separately-named reset action deletes it.
- Running the full contract suite (`npm test`) while `npm run dev` is live against the dev database leaves the dev database and the running server unaffected — proven by running both concurrently, not just argued.
- `npm run dev` starts the real Express server against the dev database using only npm scripts — no manual per-shell environment-variable export required, and the mechanism works unmodified from both bash and PowerShell.

---

## Story 1.5 — Watchlist CRUD REST surface, personal/per-user, with ADR-0044's PATCH/error/locking contract

**Source:** ADR-0044 (Accepted 2026-08-11) · **Status:** Ready — built 2026-08-12

**As a** tenant user or Tenant-Admin,
**I want** to create, read, update, and delete my own watchlists via REST endpoints, using standardized PATCH semantics, error codes, and optimistic locking, with real caller identity (not a self-declared header) determining what I can see,
**so that** I can define what content I want to monitor, have it persist across sessions, trust that concurrent edits don't silently clobber each other, and know my watchlists are private to me — not visible to other users in my tenant, including my own Tenant-Admin.

**This is a real rework of Story 1.5's pre-existing, already-shipped-ish scope, not net-new work — see the note below.** The prior version of this story's Acceptance Criteria predated ADR-0044 entirely and was stale in a way verified directly against the current codebase, not assumed:

- `social-listening-core/src/http/versions/v1/watchlistsRouter.ts` and `src/http/auth/requireTenantUser.ts` already resolve tenant identity from `req.identity` (the `Authorization: Bearer`-resolved, token-authenticated caller per Story 5.10/ADR-0033) — `X-Tenant-Id` is not read anywhere in this router. The prior AC's "All endpoints require the `X-Tenant-Id` header and return 400 if it is missing" was already false against shipped code before this rewrite; this story corrects it rather than perpetuating it.
- Migration `migrations/0014_create_watchlists.sql` (confirmed directly) has no `version` column and no `user_id` column — both are new, added by this story's own migration work (see AC1 below). It **already** ships a `before update` trigger named `update_updated_at_column()`, which already matches ADR-0044 §4's decision exactly (function name and behavior) — no change needed there, only continued correctness once new columns are added.
- The router has no `GET /v1/watchlists/:id` route today — `watchlistStore.ts`'s `getWatchlistById()` function exists but is imported and unused in the router. ADR-0044 Appendix A's worked examples (PATCH with `If-Match`, "requesting another user's watchlist" → 404) all presuppose a single-resource `GET`. This story adds that route; it did not exist before.
- The existing contract test (`contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts`) already dropped `X-Tenant-Id` in favor of the test-only `X-Test-Identity` bypass (see its own 2026-08-03 header note) but asserts none of ADR-0044's actual contract — no `version`/`If-Match`, no 422/409/428, no RFC 7396 null-deletion/array-replace semantics, no `user_id` ownership check. It needs substantial extension, not just a status-line update — named here as follow-up implementation work for whoever picks up this story via `implement-story`, not performed by this review.

**Acceptance Criteria**

*Schema (additive migration, new — the next available migration number after `0024`)*
- `watchlists` gains `version integer not null default 1` (§3, optimistic locking) and `user_id uuid not null references users(id)` (§5c, ownership) via an additive migration; every pre-existing row is not assumed to exist in production data yet, but the migration itself must not break if it does (default `1` for `version`; `user_id` cannot be defaulted — flagged as a real backfill consideration if any watchlist rows already exist outside test databases).
- The `tenant_isolation` RLS policy is extended with a second predicate on a new `user_id = NULLIF(current_setting('app.user_id', true), '')::uuid` condition (ADR-0044 §5b), alongside the existing `tenant_id` predicate — both in `USING` and `WITH CHECK`.
- `social-listening-core/src/db/withTenant.ts` (or a new sibling helper) propagates `app.user_id` via `set_config(..., true)` the same transaction-local way `app.tenant_id` already is — `userId` is already produced by identity resolution (ADR-0032 §5) alongside `tenantId`/`role`, so no new resolution step is needed, only wiring the value through.
- Every `watchlistStore.ts` function (`createWatchlist`, `listWatchlists`, `getWatchlistById`, `updateWatchlist`, `deleteWatchlist`) is re-signed to take `userId` alongside `tenantId`, and the router passes the caller's resolved `userId` (from `requireTenantUserIdentity()`, the same helper Story 1.7 already established for role/userId-dependent routes) instead of the tenant-only `requireTenantUser()`.

*Ownership (§5c)*
- `POST /v1/watchlists` sets `user_id` to the caller's own resolved identity; no client-supplied `user_id` is ever accepted or trusted, verified by a test that supplies a different user's id in the body and confirms it has no effect.
- Both `tenant_admin` and `tenant_user` resolved roles may create, list, read, patch, and delete their own watchlists — no role gate on any watchlist operation.
- `GET /v1/watchlists` (list) and `GET /v1/watchlists/:id` (new, see below) return only the caller's own watchlists — never another user's, even within the same tenant, including when the caller is `tenant_admin`. Proven by a same-tenant, two-user test: user A's watchlist is invisible to user B, and invisible to a `tenant_admin` in the same tenant who did not create it. **There is no Tenant-Admin oversight override, by design (§5c) — this is not a gap to close later.**
- A request for another user's watchlist — same tenant or a different tenant — returns **404** (`{ "code": "not_found" }`), identically in both cases; ownership is RLS-enforced the same way tenant isolation is, so there is no distinguishable 403 case here (§2's 403 row is reserved for Tenant-Admin role-check failures elsewhere in the project, not for watchlist ownership).

*New route*
- `GET /v1/watchlists/:id` returns the caller's own watchlist by id (200), or 404 per the ownership/tenant rule above. Wires the already-existing `getWatchlistById()` store function (re-signed for `userId` per above) into the router for the first time.

*PATCH semantics — RFC 7396 JSON Merge Patch (ADR-0044 §1)*
- A `null` value for a nullable field (e.g. `booleanQuery`) in the PATCH body deletes/clears that field.
- Fields omitted from the PATCH body are left unchanged — no "absent implies null" inference.
- Array-valued fields (`terms`, `platformIds`) are replaced in full when present in the body, never merged element-wise.
- `PATCH /v1/watchlists/:id` updates `updatedAt` via the existing `update_updated_at_column()` trigger (already shipped, migration 0014) — not application-set — and increments `version`.

*Error-code mapping (ADR-0044 §2) — replacing the prior AC's undifferentiated 400/404 usage*
- 404 (`{ code: "not_found" }`) for: watchlist does not exist in caller's tenant; exists in a different tenant; exists in caller's tenant but belongs to a different user (§5c) — all three cases return the identical body shape, deliberately not distinguishable by the caller.
- 422 (`{ code: "validation_failed", details: [...] }`) when the body is well-formed JSON but fails a business-validation rule — specifically the §5a `matchType` ↔ `terms`/`booleanQuery` invariant (below) on create or on any PATCH that changes `matchType`, `terms`, or `booleanQuery`.
- 400 (`{ code: "bad_request" }`) for unparseable JSON or a request body of the wrong shape (e.g. `terms` sent as a string instead of an array).
- 409 (`{ code: "version_conflict", current_version: <int> }`) when `PATCH` is sent with a stale `If-Match` value (the row's actual `version` has moved since the client last read it).
- 428 (`{ code: "precondition_required" }`) when `PATCH` is sent with no `If-Match` header at all — `watchlists` requires optimistic locking by default (§3).
- 403 is **not** used anywhere in this story's contract — reserved by §2 for Tenant-Admin application-layer role-check failures elsewhere in the project; watchlist ownership is an RLS boundary (404), not a role check.

*Optimistic locking (§3)*
- Every successful `POST`/`PATCH` response includes the current `version` integer.
- `PATCH /v1/watchlists/:id` requires an `If-Match: "<version>"` header; a mismatch against the row's actual current `version` returns 409 with `current_version` in the body; a missing header returns 428.

*Row-shape validation (§5a, reconciled with ADR-0021)*
- `matchType = 'boolean'` requires a non-null, non-empty `booleanQuery`; `terms` must be null/absent for that row.
- `matchType ∈ {'keyword', 'hashtag', 'account'}` requires a non-null, non-empty `terms` array; `booleanQuery` must be null/absent for that row.
- A create or matchType-affecting PATCH that violates either rule (both populated, or both absent, for the resulting `matchType`) fails 422 — never silently coerced or partially applied. This replaces the prior AC's weaker "`booleanQuery` required when `matchType` is boolean" statement, which never named the inverse rule or the failure code.

*Carried forward, unchanged in substance from the prior AC*
- `GET /v1/watchlists` returns all of the caller's own watchlists (RLS- and ownership-filtered), ordered by `createdAt` descending; `?matchType=<type>` filters by type.
- `isActive` defaults to `true` and `platformIds` defaults to an empty array when not provided on creation.
- Watchlists support all four match types: `keyword`, `hashtag`, `account`, `boolean`.
- `DELETE /v1/watchlists/:id` returns 204 on success, 404 per the ownership/tenant rule above.

**Built 2026-08-12.** `migrations/0025_watchlists_ownership_and_versioning.sql` (additive: `version`, `user_id` with `ON DELETE CASCADE`, extended `tenant_isolation` RLS policy), `watchlistStore.ts` (re-signed for `userId`, `WatchlistPatchInput`, `validateWatchlistShape()`, atomic version-checked `updateWatchlist()`), `watchlistsRouter.ts` (new `GET /:id`, RFC 7396 PATCH semantics, ADR-0044 §2 error-code mapping, `If-Match` locking) — see `contracts/epic-1/story-1.5.watchlist-crud.contract.test.ts` (20/20) and `docs/implementation-log.md`. **A real, necessary cross-story ripple, not silently folded in:** `createWatchlist()` gained a required `userId` parameter and `watchlists.user_id` became a hard FK, so `contracts/epic-3/story-3.8...` and `contracts/epic-5/story-5.10...` (both call `createWatchlist()` directly) needed matching real `users` rows and, for 5.10's AC2/AC3, a single consistent caller identity between create and list calls under the new ownership-scoped RLS. **A deeper, genuine architectural collision was found and resolved the same session, not worked around:** `watchlists` becoming the first table with per-user ownership RLS broke Story 3.8's own whole-tenant export (silently returned zero watchlists) and hard-delete pipeline (an FK-violation hang once `users` rows were deleted ahead of un-cascaded watchlist rows) — resolved via `ON DELETE CASCADE` on `watchlists.user_id` plus a narrow, explicitly-tenant-scoped `getAdminPool()` read in `exportTenantData()` (never `platform_admin_role`, which keeps zero access to this table). Full `social-listening-core` suite after: 49/49 suites, 335/335 tests passing.

**Note on scope, per ADR-0044's own §6 cross-references and this story's own place in the series:** this story does not build watchlist *matching* (ADR-0006/ADR-0021, already decided and separately storied), does not add a per-user watchlist count/complexity cap (ADR-0044's own named Open Question, deliberately left unresolved pending real usage data), and does not add a tenant-mutation audit table (ADR-0044 §6, deliberately deferred — `version` + `updated_at` are this project's current change-tracking mechanism for this table).

---

## Story 1.6 — Connector connect/disconnect REST surface (placeholder-auth shape)

**Source:** Phase 1 "also build, not storied" work (see `docs/open-items-and-deferred-work.md` §A, `docs/implementation-plan.md` Phase 1) · **Status:** Ready — already built and contract-verified (see `docs/implementation-plan.md`'s 2026-08-01 update); this entry is added retroactively, 2026-08-03, to give the already-in-use "Story 1.6" label a home in this file, per this project's own "don't rewrite history" convention (no prior entry existed here for it).

**As a** tenant connecting a social or news platform,
**I want** to store and remove a platform credential via REST endpoints,
**so that** a connector can poll on my tenant's behalf without engineering help.

**Acceptance Criteria**
- `POST /v1/connectors/:platformId/connect` stores a credential (envelope-encrypted per ADR-0014) and returns `201` with `id`, `platformId`, `authMethod`.
- The endpoint requires the `X-Tenant-Id` header and a `credential` (string) request body field, returning `400` if either is missing.
- `DELETE /v1/connectors/:platformId/disconnect` removes the stored credential(s) for that `(tenantId, platformId)` pair and returns `200`.
- Tenant isolation is enforced at the database layer (RLS) — a request scoped to one tenant cannot delete or read another tenant's credential.
- `GET /v1/connectors/:platformId` (connector health, Story 4.4) continues to function correctly after a credential is connected.

**A named, flagged limitation, not a silent one:** this story's endpoints trust the `X-Tenant-Id` header as their entire tenant boundary (no real authentication exists yet) and have **no ownership-tier or role concept at all** — any caller presenting any `X-Tenant-Id` value can connect or disconnect that tenant's credential. `Business-Case-v6.0.md` §6's own dependency matrix flagged this exact risk before this story was built ("could theoretically be built against the placeholder... not recommended"). **Story 1.7 (ADR-0034) supersedes this story's authorization and schema shape** once real authentication (ADR-0029/ADR-0033) and the `users`/ownership-tier model (ADR-0028, ADR-0032) exist — see Story 1.7 below and ADR-0034's own Context/Consequences for exactly what changes and why.

---

## Story 1.7 — Ownership-tier-aware connector connect/disconnect, superseding Story 1.6

**Source:** ADR-0034 · **Status:** Ready — ADR-0034 accepted 2026-08-03, its own flagged interpretive question (Tenant-Admin's offboarding revocation authority) confirmed as drafted. All dependencies (ADR-0028–0033) now Accepted. Scheduled last in Phase 4.5 (`docs/implementation-plan.md`) — the only remaining Blocked-to-Ready transition in that phase; Phase 4.5 now has no Blocked stories left.

**As a** Tenant-Admin or an individual tenant user,
**I want** connecting or disconnecting a platform credential to respect who is actually allowed to create or remove it — a tenant-wide credential only by Tenant-Admin, a personal credential only by the user themself — with real caller identity instead of a self-declared tenant header,
**so that** no caller can create a credential on another party's behalf, and a Tenant-Admin's ordinary disconnect action can never silently destroy another user's personal credential.

**Acceptance Criteria**
- `platform_credentials` carries `owner_type` (`'tenant'` | `'user'`, default `'tenant'`) and a nullable `user_id` (required and FK-valid when `owner_type = 'user'`, `NULL` otherwise) — enforced by a check constraint, added via an additive migration that leaves every existing (Story 1.6/2.6/2.7-created) row valid as `owner_type = 'tenant'`.
- `POST /v1/connectors/:platformId/connect` with `ownerType: 'tenant'` (or omitted) succeeds only when the caller's resolved role is `tenant_admin`; returns `403` otherwise.
- `POST /v1/connectors/:platformId/connect` with `ownerType: 'user'` always sets `user_id` to the caller's own resolved identity — any client-supplied `user_id` in the request body is ignored, never trusted, verified by a test that supplies a different user's id and confirms it has no effect.
- Deleting a tenant-wide credential requires the caller's resolved role to be `tenant_admin`.
- Deleting a user-bound credential succeeds for the owning user, or for a Tenant-Admin of the same tenant (offboarding case) — and for no one else.
- `deleteCredential(...)` no longer deletes every credential for a `(tenantId, platformId)` pair indiscriminately — it is scoped by `(tenantId, platformId, ownerType, userId?)`, verified by a test that connects one tenant-wide and one user-bound credential for the same `platformId` and confirms disconnecting one never removes the other.
- `X-Tenant-Id` is no longer read or trusted by any of these endpoints — caller identity comes exclusively from the `Authorization: Bearer` token resolved per ADR-0029/ADR-0033.

**Note:** this story supersedes Story 1.6's authorization and schema shape, per ADR-0034's own Decision and Consequences — it does not represent new, additive scope on top of an unrelated Story 1.6, it is the rework `Business-Case-v6.0.md` §6 already anticipated as necessary before real auth existed.

---

## Story 1.8 — Tenant self-view REST endpoint

**Source:** ADR-0031 (Accepted) · **Status:** Built 2026-08-09 (`social-listening-core@10fc934`, `contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts`, 8/8, full suite 44/44 suites / 272/272 tests — see `docs/implementation-log.md`). No new ADR needed. `tenants.md`'s own RLS policy (Story 5.8, built) already proves a tenant-scoped session sees exactly its own row at the database layer; this story only adds the HTTP route calling into it, the same ordinary CRUD-shaped surface-exposure Story 1.5 already established as not needing its own ADR.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes a real, confirmed gap: Story 5.8's own stated purpose is "viewing my own tenant's settings needs no special-case authorization path," but its Acceptance Criteria only prove the RLS policy returns one row at the DB layer (`contracts/epic-5/story-5.8.tenants-table-rls.contract.test.ts`) — no route in any `versions/v1/*Router.ts` file exposes it over HTTP, confirmed directly against the current router files.

**As a** Tenant-Admin or tenant user,
**I want** `GET /v1/tenants/me` to return my own tenant's name, status, and seat counts,
**so that** I can see my own tenant's settings without any special-case authorization path beyond the ordinary tenant-scoped session I already use for every other request.

**Acceptance Criteria**
- `GET /v1/tenants/me` is mounted in `createV1Router()` behind the same `authMiddleware` every other substantive `/v1` route uses (the same pattern Story 5.11 already established for `GET /v1/me`) — not a second, parallel auth mechanism.
- A request with a missing, invalid, expired, or wrong-issuer bearer token is rejected `401` before this route's own handler runs, inherited from the shared middleware, not reimplemented.
- A `platform_admin` resolved identity (Story 5.11's `GET /v1/me` shape) receives `403` — this route is for a resolved tenant user/Tenant-Admin only, consistent with Platform Admin's own zero-tenant-content-access boundary (ADR-0030 §2); Platform Admin's own equivalent view is Story 5.12, not this route.
- On success, returns `200` with `{ id, name, status, licenseSeatCount, activeSeatCount, domain, createdAt }` — read via the ordinary `withTenant(resolvedTenantId, ...)` path (ADR-0015), never `platform_admin_role`, proven by a test confirming the query runs entirely under `app_user`.
- Returns exactly one row — the caller's own tenant — never any other tenant's, proven by a two-tenant test.
- `GET` only — no `POST`/`PATCH`/`DELETE` at this path; updating `status`/`license_seat_count`/`domain` remains Platform-Admin-only (Story 5.12), and this route does not expose a write path around that boundary.
- This story is additive-only: mounted alongside `/posts`, `/topics`, `/connectors`, `/watchlists`, `/tenants/users` (Story 1.9), and `/me` in `createV1Router()`; no existing route's behavior changes.

---

## Story 1.9 — User invitation and offboarding REST surface

**Source:** ADR-0032 (Accepted) · **Status:** Ready — no new ADR needed. ADR-0032 §6 (invite/link flow) and §9 (`access_ends_at`) already fully designed the schema, RLS, and seat-enforcement mechanics this story exposes over HTTP; the same ordinary CRUD-shaped surface-exposure Story 1.5 already established as not needing its own ADR.

**Drafted 2026-08-05, as part of a 16-item batch requested by Menno.** Closes a real, confirmed gap: Story 5.9's own Acceptance Criteria assume "Tenant-Admin creates a `users` row in `invited` status" and that `access_ends_at` gets set for offboarding, but no story builds the endpoint for either — the same shape of gap Story 1.5 already closed for watchlists, confirmed directly against the current router files (no `/v1/tenants/users` route exists anywhere).

**As a** Tenant-Admin,
**I want** REST endpoints to invite a new user into my tenant, list my tenant's users, and end a user's access,
**so that** I can manage who belongs to my tenant without engineering help, respecting my tenant's own license-seat ceiling.

**Acceptance Criteria**
- `POST /v1/tenants/users` creates a `users` row in `invited` status (`external_subject = NULL`, `email` from the request body) — restricted to callers whose resolved role is `tenant_admin`; returns `403` for a `tenant_user` caller.
- `POST /v1/tenants/users` rejects the invite with `409` once `active_seat_count >= license_seat_count` for the caller's own tenant (`tenants/SKILL.md`'s own sanctioned `incrementActiveSeatCount()` enforcement point, Story 5.8's AC5) — proven by a test that fills every licensed seat and confirms the next invite is rejected, not silently accepted past the ceiling.
- `POST /v1/tenants/users` does not increment `active_seat_count` at invite time — per ADR-0032 §6, a seat is occupied once the invited user actually links their `external_subject` at first sign-in (not at invite creation); this story's contract must prove the counter only moves on activation, never on invite alone.
- `GET /v1/tenants/users` lists the caller's own tenant's users (RLS-filtered, per ADR-0032 §2), including `invited` and `active` rows — available to both `tenant_admin` and `tenant_user` resolved identities (read-only visibility, no role gate on `GET`).
- `PATCH /v1/tenants/users/:id` sets, clears, or updates `access_ends_at` — restricted to `tenant_admin` callers only; returns `403` for a `tenant_user` attempting to modify any user's `access_ends_at`, including their own.
- `PATCH /v1/tenants/users/:id` decrements `active_seat_count` when `access_ends_at` is set to a value that is now-or-past (an immediate offboarding), and does not decrement it for a future-dated `access_ends_at` (a scheduled expiration not yet in effect) — per ADR-0032 §9's own active/ended semantics, proven by both cases in this story's contract.
- Clearing `access_ends_at` back to `NULL` via `PATCH` re-increments `active_seat_count`, subject to the same seat-ceiling check `POST` uses — reactivating a user past the tenant's own license ceiling is rejected `409`, the same as a fresh invite would be.
- Every endpoint is RLS-scoped to the caller's own tenant — a request cannot invite into, list, or modify a user in any other tenant, proven by a two-tenant isolation test.
- Every write these endpoints perform is durably recorded per Story 5.17's own audit mechanism (`user_access_audit_log`, or equivalent) for `access_ends_at` changes specifically — this story is the first place that table actually gets written to; Story 5.17 designs the table, this story is one of (potentially several) callers of it.

**Named as a required, practical dependency, not a blocker to drafting:** Story 5.17 (audit trail for `access_ends_at` writes) should exist before this story's `PATCH` endpoint ships to production, so every `access_ends_at` change is audited from day one rather than retrofitted — the same "name the dependency, don't silently build past it" discipline this series applies elsewhere (e.g. Story 6.6 naming its own backend REST gap). This story's own Acceptance Criteria can still be written and its contract built independently; the audit call is a real, load-bearing part of AC8 above, not a separate follow-up.

---

## Story 1.10 — Postgres boot-time readiness check and a real `/v1/health`

**Source:** ADR-0016 (Postgres as the database engine, Accepted) · **Status:** Ready — built 2026-08-12. ADR-0016 already decided Postgres is this project's database engine; a boot-time connectivity check and a database-aware liveness route are operational implementation detail under that already-decided architecture, the same "ordinary surface work needs no new ADR" category Stories 1.5/1.8/1.9 already established.

**Drafted 2026-08-11, from a direct question during a live session.** Closes a real, confirmed gap: verified directly against `social-listening-core/src/http/server.ts` and `src/db/pool.ts` that the server today calls `createApp().listen(port, ...)` with no database check of any kind beforehand, and that `getPool()` is a lazy singleton — the `pg.Pool` isn't even constructed until the first request that happens to need it. Postgres unavailability is therefore only discovered reactively, on whichever request hits the database first, never proactively at boot. Also verified that `GET /v1/health` (`versions/v1/router.ts`) already exists but is an unconditional `{ status: 'ok' }` placeholder from Story 1.3/ADR-0017, predating any auth mechanism and deliberately public — it does not touch the database at all today.

**As an** operator running `social-listening-core`,
**I want** the server to refuse to start if Postgres isn't reachable, and `/v1/health` to reflect real, current Postgres connectivity rather than an unconditional "ok,"
**so that** a misconfigured or unreachable database is caught immediately at boot instead of surfacing as a confusing failure on whichever request happens to touch the database first, and so that infrastructure monitoring an already-running instance can actually detect a database outage that occurs after a successful boot.

**Acceptance Criteria**
- On startup, before calling `.listen(...)`, the server runs a real connectivity check against Postgres (e.g. `SELECT 1` via `getPool()`) and only proceeds to accept HTTP traffic if it succeeds.
- If the startup connectivity check fails, the process logs a clear, actionable error identifying Postgres connectivity as the cause and exits non-zero — it never silently starts listening in a state where every tenant-scoped request would fail.
- The startup check has a bounded timeout and a small number of retries with backoff (exact values are an implementation default, logged in this story's own commit, not hardcoded into this AC) — so a Postgres instance that is merely slow to accept connections at container-cold-start isn't treated identically to one that is genuinely unreachable.
- `GET /v1/health` is extended to run the same connectivity check on every call: returns `200` with `{ status: 'ok' }` when Postgres answers, and `503` with `{ status: 'unavailable' }` (exact body shape an implementation default) when it doesn't — proven by a contract test that simulates an unreachable database and asserts `503`, not just the existing happy-path `200` assertion.
- `/v1/health` remains public/unauthenticated, unchanged from Story 1.3/ADR-0017's own precedent — becoming database-aware does not change its auth boundary, only its response.
- This story does not add or change any Platform-Admin-facing surface. Surfacing this connectivity signal in a Platform Admin Dashboard is explicitly out of scope here — `docs/design/README.md`'s own dated note (lines 40–42) already records Menno's direct decision to defer infrastructure/operational metrics (server health, connectivity, storage) for the Platform Admin console until "the systems limitations and requirements are well known." This story's `/v1/health` response is named as the future data source that deferred screen would eventually read from, once it's actually designed — not new scope to reconcile with that deferral, and not a reason to reopen it now.

**Named as a related, not-yet-scoped future dependency:** whenever the deferred Platform Admin infrastructure-metrics screen (`docs/design/README.md` lines 40–42, Story 6.6's own explicit exclusion) is eventually designed, it has a real, concrete Postgres-connectivity signal to build on as of this story — named here so that future work doesn't have to rediscover it, per this series' own "name the dependency, don't silently build past it" discipline.

**Built 2026-08-12.** `src/db/postgresReadiness.ts` (new — `checkPostgresConnectivity()`, a single bounded-timeout `SELECT 1` that never throws; `waitForPostgresReady()`, a bounded retry-with-backoff wrapper around it), `src/http/server.ts` (calls `waitForPostgresReady()` before `.listen()`, exits non-zero with a clear message on failure), `src/http/versions/v1/router.ts` (`GET /v1/health` now calls `checkPostgresConnectivity()` on every request — 200/`{status:'ok'}` or 503/`{status:'unavailable'}`, still deliberately unauthenticated) — see `contracts/epic-1/story-1.10.postgres-readiness-and-health.contract.test.ts` (8/8, including the real `server.ts` entrypoint spawned as a real child process for both the reachable and unreachable cases) and `docs/implementation-log.md`. Full `social-listening-core` suite after: 50/50 suites, 343/343 tests passing.

---

## Story 1.11 — Connector activation, decoupled from credential presence

**Source:** ADR-0051 (Accepted 2026-08-12) · **Status:** Built 2026-08-12 — ADR-0051 accepted the same day it was drafted, after seven in-place revisions during live review (see ADR-0051's own Amendment Log). All dependencies (ADR-0028, ADR-0034/Story 1.7) already Accepted/built.

**Drafted 2026-08-12, at ADR-0051's own acceptance**, per this series' own "no story until acceptance" precedent (ADR-0024/0026). Closes two real gaps ADR-0051 names directly: Newswire (`authMode: 'none'`) is hardcoded `connected: true` for every tenant with no opt-out (`social-listening-admin`'s connector/status screens); and credentialed connectors conflate "has a stored credential" with "is turned on," so pausing one today means hard-deleting the credential via `deleteCredential()` and re-entering it later — the exact category of failure Menno described from the discontinued Microsoft Social Engagement product (a connector disconnected merely for exhausting quota).

**As a** Tenant-Admin or an individual tenant user,
**I want** to turn a connector on or off for my own ownership scope, independent of whether a credential is stored,
**so that** pausing a connector never means losing a stored credential and having to re-enter it, and a connector with no credential at all (Newswire) is never active for a tenant that never chose it.

**Acceptance Criteria**
- Two new tables exist: `connector_activations` (`tenant_id`, `platform_id`, `is_active boolean not null default false`, `activated_at`, `deactivated_at`, `updated_by`; unique on `(tenant_id, platform_id)`) and `connector_user_activations` (same shape plus `user_id`; unique on `(tenant_id, platform_id, user_id)`) — both RLS-scoped to the caller's own tenant per ADR-0015. **Correction (2026-08-12, caught during implementation, before this story was built):** the original AC text here claimed `connector_user_activations` gets a second, user-scoped RLS predicate "mirroring `platform_credentials`' existing user-bound-row RLS treatment" — checked directly against `migrations/0019_add_platform_credentials_ownership_tier.sql`'s own comment and found this claim was simply wrong: `platform_credentials` RLS is "deliberately unchanged" for Tier 3 rows, ownership enforced at the application layer (`connectorsRouter.ts`), never a second RLS predicate — the same pattern `watchlists` deliberately does NOT use (ADR-0034 §2 explicitly rejects a second RLS predicate for this exact reason). `connector_user_activations` follows `platform_credentials`' real, verified pattern: ordinary tenant-only RLS, ownership enforced in the router/store layer instead.
- No row is inserted into either table by tenant creation, connector registration, or any migration/backfill — a newly created tenant, and every existing tenant, has zero rows in either table until an explicit activate/deactivate action, proven by a test that creates a tenant and confirms no `connector_activations`/`connector_user_activations` row exists for it.
- `POST /v1/connectors/:platformId/activate` and `POST /v1/connectors/:platformId/deactivate` are discriminated by `ownerType` in the body, mirroring `connect`/`disconnect` (Story 1.7/ADR-0034 §3): `ownerType: 'tenant'` requires the caller's resolved role to be `tenant_admin` (`403` otherwise) and writes `connector_activations`; `ownerType: 'user'` writes `connector_user_activations`. **`activate` with `ownerType: 'user'` always uses the caller's own resolved identity as `userId`** (any client-supplied `userId` is ignored, verified the same way Story 1.7's AC3 already proves this for `connect`) — matching `connect`'s own self-only shape. **`deactivate` with `ownerType: 'user'` succeeds for the owning user OR a `tenant_admin` of the same tenant** (an optional `userId` body field, defaulting to the caller's own id) — matching `disconnect`'s own offboarding-override shape (Story 1.7 AC5), for the identical reason: a Tenant-Admin who may already destructively disconnect a user's credential must not be blocked from the strictly less destructive act of pausing that user's activation.
- Both endpoints are idempotent no-ops when the target state already matches (activating an already-active row does not error, and does not needlessly bump `activated_at`) — verified by a repeat-call test.
- `ownerType: 'user'` is rejected `400` for a platform whose `authMode` is `'none'` — no personal/"just for me" scope exists for a connector with no credential to own personally, per ADR-0051 Decision §1; `connector_user_activations` is never written for an `authMode: 'none'` platform, proven directly.
- Activating or deactivating `connector_activations` (tenant-wide) never creates, modifies, or reads any row in `connector_user_activations` for the same platform, and vice versa — proven by a test that activates both scopes independently for the same `(tenantId, platformId)` and confirms deactivating one leaves the other's `is_active` value unchanged.
- Neither endpoint invokes `runIngestionAttempt()` or any other ingestion code path as a side effect — a synchronous write to the activation table only, per ADR-0051 Decision §2's timing-semantics paragraph; verified by a test that activates a connector and confirms no `IngestionRun` row is created as a result of the call itself.
- `shouldAttemptIngestion()` (`social-listening-core/src/connectors/connectorHealth.ts`) is extended so a credentialed connector additionally requires `is_active = true` on the matching-scope activation row (`connector_activations` for a tenant-wide credential, `connector_user_activations` for a user-bound one) alongside its existing credential/health checks, and an `authMode: 'none'` connector requires `is_active = true` on `connector_activations` — closing the Newswire always-on bug and the credential-presence-as-activation conflation for real, not just at the schema/endpoint layer.
- Disconnect (`DELETE /v1/connectors/:platformId/disconnect`, Story 1.7, unchanged) continues to hard-delete the credential and does not touch either activation table — deactivating and disconnecting remain two distinct, independently callable actions, proven by a test that deactivates a connector, confirms the credential still exists in `platform_credentials`, then separately disconnects it.

**Explicitly out of scope, per ADR-0051's own Decision §6/§7/§8:** live credential validation; system-driven auto-deactivation; the `retryable`/non-retryable auto-disable conflation fix in `deriveConnectorHealth()` — addressed separately via ADR-0010/0023's own dated Clarification notes, not this story. **Also out of scope:** `social-listening-admin` UI wiring (activate/deactivate controls on the existing Story 6.3/6.5 screens) — separate future work once these endpoints exist; and `GET /v1/connectors/:platformId`'s own response shape combining activation with derived health (ADR-0051 Open Question 5, not designed there either).

**Built 2026-08-12.** `migrations/0028_create_connector_activations.sql` (new — `connector_activations`, `connector_user_activations`, both RLS-enabled/tenant-isolated; `connector_user_activations.user_id` is `REFERENCES users(id) ON DELETE CASCADE`, mirroring `watchlists.user_id`'s own precedent, which is why Story 3.8's tenant-deletion pipeline needed no changes), `src/connectors/connectorActivationStore.ts` (new — `setConnectorActivation()`/`isConnectorActive()`, idempotent, two ownerType-specific query paths, no dynamic table-name interpolation), `src/connectors/connectorHealth.ts` (`shouldAttemptIngestion()` extended with an optional `ownerType`/`userId`, defaulting to `'tenant'` for backward compatibility, now additionally requiring `is_active = true`), `src/http/versions/v1/connectorsRouter.ts` (new `POST .../activate`/`.../deactivate` routes, `authModeForbidsUserScope()` helper reading the shared connector registry, never a hardcoded providerId literal — this file is one of Story 2.10/ADR-0048's own `CORE_FILES`) — see `contracts/epic-1/story-1.11.connector-activation.contract.test.ts` (12/12) and `docs/implementation-log.md`. **A real, necessary AC correction was made during implementation, before any code was written:** the original AC text claimed `connector_user_activations` gets a second, user-scoped RLS predicate "mirroring `platform_credentials`' existing user-bound-row RLS treatment" — checked directly against `migrations/0019`'s own comment and found this was factually wrong (`platform_credentials`' RLS is "deliberately unchanged," ownership enforced at the application layer, never a second predicate); corrected in place above, with `connector_user_activations` following `platform_credentials`' real pattern instead. **Story 2.3's and Story 2.4's own already-passing contracts were updated** (dated notes, both files) since `shouldAttemptIngestion()`'s new activation requirement meant their own pre-existing "true" assertions needed the connector explicitly activated first to keep proving what they always proved (health-driven eligibility / dead-letter-auto-disable independence) — not a weakening, per this series' own ADR-0023-driven precedent for exactly this situation. Full `social-listening-core` suite after: 54/54 suites, 391/391 tests passing (one transient, unrelated real-network Newswire-connector 404 during the first full-suite run, confirmed gone on isolated and full re-runs — not a regression, the same category `docs/implementation-plan.md`'s own 2026-08-10 dated note already named for this exact connector).

---

## Story 1.12 — `GET /v1/connectors/:platformId` combines activation state with derived health

**Source:** ADR-0051 Open Question 5 (Accepted 2026-08-12) · **Status:** Built 2026-08-12 — no new ADR needed. This is an additive response-shape extension of an already-decided, already-shipped endpoint (Story 4.4/ADR-0022), the same "ordinary surface work" category Stories 1.5/1.8/1.9 already established as not needing one. Depends on Story 1.11 (`connector_activations`/`connector_user_activations`, built).

**Drafted 2026-08-12, at Menno's own direct request while scoping the admin-UI wiring story (6.15) that depends on it.** Confirmed directly: Story 1.11 built the write side of activation (`POST .../activate|deactivate`) but no endpoint anywhere lets a caller *read* current activation state — `GET /v1/connectors/:platformId` (`connectorsRouter.ts`) still returns only `ConnectorHealth`'s own four fields (`status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`, `credentialStatus`), with no `isActive` anywhere in the response. Without this, no UI can show real activation state on page load — only immediately after a POST, from that call's own response. This is exactly the gap ADR-0051 named as Open Question 5 and ADR-0022's own dated note on relation to ADR-0051 already anticipated ("activation can simply be read fresh (uncached) alongside the cached health value... not decided here").

**As a** Tenant-Admin or tenant user viewing a connector's status,
**I want** `GET /v1/connectors/:platformId` to tell me whether the connector is actually turned on, not just how healthy it's been,
**so that** the connector status screen can show real activation state without a second round trip or reading it only out of a POST response.

**Acceptance Criteria**
- `GET /v1/connectors/:platformId`'s response gains an `isActive` field (`boolean`), read via `isConnectorActive()` (`connectorActivationStore.ts`) for `ownerType: 'tenant'` — the scope every existing caller of this endpoint already implicitly means, since no caller passes a user-scoped context today.
- The new `isActive` read is **not** folded into `ConnectorHealthCache`'s existing 60-second TTL cache — read fresh on every call, per ADR-0022's own dated note on this exact question ("activation can simply be read fresh... no equivalent aggregation cost to what `deriveConnectorHealth()` does"). `getCachedConnectorHealth()`'s own cached value is unchanged; the route handler combines the cached health with a fresh activation read into the final response object.
- A platform with no `connector_activations` row (never activated) returns `isActive: false` — never `null`/`undefined` — per Story 1.11's own lazy-creation rule (absence of a row reads identically to `is_active = false`).
- Every existing consumer of this endpoint's response shape (Story 4.3's own contract, Story 6.5's screen) continues to pass unmodified — this is a purely additive field, not a rename or removal of any existing one.
- No change to `deriveConnectorHealth()`, `ConnectorHealth`'s own four original fields, or the 60-second cache TTL/locality decision (ADR-0022) — this story extends the route's *response*, not the health-derivation mechanism itself.

**Explicitly out of scope:** a user-scoped (`ownerType: 'user'`) variant of this same read — no caller needs it yet, since no per-user ingestion path exists (Story 1.11's own Known gaps); adding a query parameter for it speculatively would be building ahead of a demonstrated need. Deciding whether `isActive: false` should further distinguish "never activated" from "deliberately deactivated" in the response (ADR-0051 Open Question 6, a UX question) — not designed here, this story returns the boolean only.

**Built 2026-08-12.** `src/http/versions/v1/connectorsRouter.ts`'s `GET /:platformId` handler now combines the cached `ConnectorHealth` with a fresh `isConnectorActive(tenantId, platformId, 'tenant')` read into one response object — see `contracts/epic-1/story-1.12.connector-status-includes-activation.contract.test.ts` (3/3) and `docs/implementation-log.md`. Full `social-listening-core` suite after: 55/55 suites, 394/394 tests passing.
