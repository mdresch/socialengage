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
