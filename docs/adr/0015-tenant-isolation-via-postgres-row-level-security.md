# ADR-0015: Enforce tenant isolation at the database layer with Postgres Row-Level Security

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §8 "Security & Multi-Tenancy — Tenant isolation"

## Context

Every table carrying `tenantId` (`Author`, `SocialPost`, `IngestionRun`, `Watchlist`, `AuthorTopicSignal`, credentials, etc.) must guarantee that one tenant's data is never returned in another tenant's queries. This is a single Postgres database shared across tenants (not one database per tenant), so isolation has to be enforced by something other than physical separation.

## Decision

Enforce tenant isolation via Postgres Row-Level Security (RLS) policies on every table carrying `tenantId`, rather than relying solely on application-level `WHERE tenantId = ?` filtering.

## Consequences

**Positive**
- RLS makes tenant isolation a database-enforced invariant: even a query path that forgets a `WHERE tenantId = ?` clause (a bug in a new endpoint, a hand-written migration script, an ad-hoc admin query) still can't return another tenant's rows, because the database itself blocks it.
- This is a materially stronger guarantee than application-level filtering alone, which depends on every current and future code path getting the filter right — a single missed filter in one of potentially many query sites (REST API, event publishers, materialized view refresh jobs, admin tooling) would otherwise be a cross-tenant data leak.
- Centralizes the isolation guarantee in one place (the RLS policy definitions) rather than scattering it across every query in the codebase, making it auditable as a fixed, reviewable set of policies.

**Negative**
- Every database connection/session must correctly set the tenant context (e.g., a session variable RLS policies check) before querying; getting this wrong doesn't leak data (RLS still blocks it) but can cause confusing "no rows returned" bugs if the context is simply missing rather than wrong.
- RLS policies add a small amount of query planning/execution overhead versus an unfiltered query, and add a layer that must be kept consistent with the schema as new `tenantId`-bearing tables are added — a new table without an RLS policy is an isolation gap that isn't automatically caught unless enforced by convention or migration tooling.
- Background/batch processes that legitimately need to operate across all tenants (e.g., the `AuthorTopicSignal` materialized view refresh in ADR-0007) need a deliberate, audited way to bypass or iterate through RLS per-tenant, rather than one implicit "admin mode" that could be misused.

## Alternatives Considered

- **Application-level filtering only (`WHERE tenantId = ?` on every query)** — simpler to reason about with no session-context setup, but pushes the entire isolation guarantee onto every developer getting every query right, forever, across two repositories and an ever-growing set of downstream consumers — a much larger and more fragile trust boundary than DB-enforced RLS.
- **Database-per-tenant or schema-per-tenant** — the strongest physical isolation, but doesn't fit a platform designed to onboard many tenants dynamically (connection/schema management overhead grows linearly with tenant count) and isn't what the spec describes (a single Azure Database for PostgreSQL instance with RLS).
