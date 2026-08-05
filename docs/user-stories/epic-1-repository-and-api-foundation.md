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

## Story 1.5 — Watchlist CRUD REST surface

**Source:** Phase 1 "also build, not storied" work (see `docs/open-items-and-deferred-work.md` §A, `docs/implementation-plan.md` Phase 1) · **Status:** Ready

**As a** user of the social listening platform,
**I want** to create, read, update, and delete watchlists via REST endpoints,
**so that** I can define what content I want to monitor and have it persist across sessions.

**Acceptance Criteria**
- `POST /v1/watchlists` creates a watchlist and returns it with a generated id, `createdAt`, and `updatedAt` timestamps.
- `GET /v1/watchlists` returns all watchlists for the current tenant (filtered by RLS), ordered by `createdAt` descending.
- `GET /v1/watchlists?matchType=<type>` filters watchlists by their `matchType` field.
- `PATCH /v1/watchlists/:id` updates a watchlist by id for the current tenant, only modifying fields provided in the request body (PATCH semantics), and updates the `updatedAt` timestamp.
- `DELETE /v1/watchlists/:id` removes a watchlist by id for the current tenant and returns 204 on success.
- All endpoints return 404 for non-existent watchlists or watchlists belonging to a different tenant (RLS enforced).
- All endpoints require the `X-Tenant-Id` header and return 400 if it is missing.
- The `watchlists` table exists with RLS policy `tenant_isolation` matching the pattern of other tenant-scoped tables.
- `isActive` defaults to `true` and `platformIds` defaults to an empty array when not provided on creation.
- Watchlists support all four match types: `keyword`, `hashtag`, `account`, `boolean`.
- When `matchType` is `boolean`, a `booleanQuery` field is required and carries the boolean query syntax.
- Tenant isolation is enforced at the database layer: a tenant can only see and modify their own watchlists.

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

**Source:** ADR-0031 (Accepted) · **Status:** Ready — no new ADR needed. `tenants.md`'s own RLS policy (Story 5.8, built) already proves a tenant-scoped session sees exactly its own row at the database layer; this story only adds the HTTP route calling into it, the same ordinary CRUD-shaped surface-exposure Story 1.5 already established as not needing its own ADR.

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
