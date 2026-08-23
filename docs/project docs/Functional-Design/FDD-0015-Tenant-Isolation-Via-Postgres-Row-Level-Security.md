# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0015 Tenant Isolation via Postgres Row-Level Security — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0015-tenant-isolation-via-postgres-row-level-security.md, ../Business-Requirements/BRD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0015-tenant-isolation-via-postgres-row-level-security.md and the business requirements in BRD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md into functional design for **Tenant Isolation Via Postgres Row Level Security**.
The SocialEngage platform serves multiple tenants from a single Azure Database for PostgreSQL instance. As the number of tables and query paths grows (REST endpoints, event publishers, materialized view refresh jobs, ad-hoc scripts, and future admin tooling), the risk that a single missing `WHERE tenantId = ?` clause exposes one tenant's data to another becomes unmanageable if isolation depends entirely on application-level filtering.

This BRD captures the decision to make tenant isolation a database-enforced invariant through Postgres Row-Level Security (RLS). Every table that carries `tenantId` will have an active RLS policy that evaluates a session-level tenant context before returning rows. Even if application code forgets the tenant filter, the database itself will block the query from seeing another tenant's data, turning a potential cross-tenant leak into a fail-closed "no rows returned" result.

The expected business value is stronger, auditable, and more maintainable tenant isolation, reduced operational dependence on every developer getting every query right, and a clear trust boundary that supports safer ad-hoc queries, migrations, and batch processes.

---

### 2.2 Scope
**In scope:**
- RLS policies on every table carrying `tenantId` (e.g., `Author`, `SocialPost`, `IngestionRun`, `Watchlist`, `AuthorTopicSignal`, `platform_credentials`, and any future tenant-scoped table).
- The `tenants` table, where RLS is scoped by `id` rather than a separate `tenant_id` column, following the same fail-closed pattern.
- Application-side tenant context setup (e.g., a session variable such as `app.tenant_id`) before every tenant-scoped query.
- A CI or migration-time check that fails if a new `tenantId`-bearing table is added without a corresponding RLS policy.
- Contract and regression tests that verify fail-closed behavior and the absence of cross-tenant row leakage.
- Provision for legitimate, narrowly scoped, audited bypass or per-tenant iteration for background and platform-administrative processes.

**Out of scope:**
- Authentication mechanism selection or identity provider integration (governed by ADR-0029 and Story 5.6).
- The detailed break-glass platform-admin bypass role and audit logging (governed by ADR-0030 and Story 5.7).
- Database-per-tenant or schema-per-tenant physical isolation.
- Any user interface for managing RLS policies or tenant context.

## 3. Context and Background
Every table carrying `tenantId` (`Author`, `SocialPost`, `IngestionRun`, `Watchlist`, `AuthorTopicSignal`, credentials, etc.) must guarantee that one tenant's data is never returned in another tenant's queries. This is a single Postgres database shared across tenants (not one database per tenant), so isolation has to be enforced by something other than physical separation.
The SocialEngage platform serves multiple tenants from a single Azure Database for PostgreSQL instance. As the number of tables and query paths grows (REST endpoints, event publishers, materialized view refresh jobs, ad-hoc scripts, and future admin tooling), the risk that a single missing `WHERE tenantId = ?` clause exposes one tenant's data to another becomes unmanageable if isolation depends entirely on application-level filtering.

This BRD captures the decision to make tenant isolation a database-enforced invariant through Postgres Row-Level Security (RLS). Every table that carries `tenantId` will have an active RLS policy that evaluates a session-level tenant context before returning rows. Even if application code forgets the tenant filter, the database itself will block the query from seeing another tenant's data, turning a potential cross-tenant leak into a fail-closed "no rows returned" result.

The expected business value is stronger, auditable, and more maintainable tenant isolation, reduced operational dependence on every developer getting every query right, and a clear trust boundary that supports safer ad-hoc queries, migrations, and batch processes.

---

## 4. Goals and Objectives
|| # | Objective | Success Measure |
||---|---|---|
|| 1 | Make tenant isolation a database-enforced invariant | Every table carrying `tenantId` has an active RLS policy before it accepts writes |
|| 2 | Eliminate cross-tenant data leakage from missed application filters | Contract tests prove an unfiltered query under a tenant context returns only that tenant's rows, never another tenant's rows |
|| 3 | Centralize and audit the isolation guarantee | RLS policy definitions live in versioned migrations and can be reviewed as a single, consistent set of rules |
|| 4 | Keep legitimate cross-tenant operations explicit and governed | Background and platform-administrative processes use deliberate, audited bypass paths rather than implicit "admin mode" |

---

**Positive consequences (from ADR):**
**Positive**
- RLS makes tenant isolation a database-enforced invariant: even a query path that forgets a `WHERE tenantId = ?` clause (a bug in a new endpoint, a hand-written migration script, an ad-hoc admin query) still can't return another tenant's rows, because the database itself blocks it.
- This is a materially stronger guarantee than application-level filtering alone, which depends on every current and future code path getting the filter right — a single missed filter in one of potentially many query sites (REST API, event publishers, materialized view refresh jobs, admin tooling) would otherwise be a cross-tenant data leak.
- Centralizes the isolation guarantee in one place (the RLS policy definitions) rather than scattering it across every query in the codebase, making it auditable as a fixed, reviewable set of policies.

**Negative**
- Every database connection/session must correctly set the tenant context (e.g., a session variable RLS policies check) before querying; getting this wrong doesn't leak data (RLS still blocks it) but can cause confusing "no rows returned" bugs if the context is simply missing rather than wrong.
- RLS policies add a small amount of query planning/execution overhead versus an unfiltered query, and add a layer that must be kept consistent with the schema as new `tenantId`-bearing tables are added — a new table without an RLS policy is an isolation gap that isn't automatically caught unless enforced by convention or migration tooling.
- Background/batch processes that legitimately need to operate across all tenants (e.g., the `AuthorTopicSignal` materialized view refresh in ADR-0007) need a deliberate, audited way to bypass or iterate through RLS per-tenant, rather than one implicit "admin mode" that could be misused.

## 5. Functional Requirements
|| ID | Requirement | Priority | Acceptance Criteria | Owner |
||---|---|---|---|---|
|| BR-001 | The system shall have an active RLS policy on every table carrying `tenantId` before it accepts writes | Must | A migration or CI check confirms every `tenantId`-bearing table has an active RLS policy | Product Owner |
|| BR-002 | The RLS policy shall fail closed: a query executed without a tenant session context shall return zero rows, not another tenant's data | Must | A contract test with no tenant context set confirms no rows are returned from a tenant-scoped table | Technical Lead |
|| BR-003 | A deliberately unfiltered query against a tenant-scoped table with two tenants' data shall return only the session's own tenant's rows | Must | A contract test omits `WHERE tenantId` and confirms only the configured tenant's rows are returned | Technical Lead |
|| BR-004 | The application shall set the tenant context on every database session before issuing a tenant-scoped query | Must | All tenant-scoped query paths use a helper (e.g., `withTenant`) that sets the RLS session variable; repository check confirms no raw, unwrapped tenant queries | Technical Lead |
|| BR-005 | The system shall detect any new `tenantId`-bearing table that is added without an RLS policy | Should | CI or a schema test fails when a `tenantId` column exists without a corresponding active RLS policy | Technical Lead |
|| BR-006 | Background and platform-administrative processes that legitimately operate across tenants shall use a deliberate, audited bypass or per-tenant iteration, not an implicit admin mode | Should | Code review and contract tests confirm that cross-tenant operations use dedicated, named roles or loops, with no general "read all tenants" path | Platform Operator |

### 5.1 Architecture Decision
Enforce tenant isolation via Postgres Row-Level Security (RLS) policies on every table carrying `tenantId`, rather than relying solely on application-level `WHERE tenantId = ?` filtering.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
|| Stakeholder | Role / Interest | Impact | Key Needs |
||---|---|---|---|
|| Platform Operator / Security Lead | Owns the multi-tenant trust boundary | High | Database-level, auditable isolation that survives application bugs |
|| Tenant Admin | Manages a single tenant's users, connectors, and data | Medium | Assurance that other tenants cannot see or affect their data |
|| Tenant User | Uses the platform on behalf of a tenant | Medium | Reliable access to their own tenant's data only |
|| Backend / Platform Engineer | Implements and maintains data access patterns | High | A single, central isolation mechanism instead of per-query filtering |
|| Product Owner / Sponsor (Menno) | Accountable for scope and acceptability | High | Fail-closed, future-proof tenant isolation from day one |
|| Auditor / Compliance Reviewer | Validates data-access controls | Medium | Documented, versioned RLS policies and proof of no cross-tenant leakage |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.4 | epic-5-security-isolation-and-messaging.md | As platform operator responsible for multi-tenant data isolation, I want every table carrying `tenantId` protected by a Postgres RLS policy, not only by appl... | Every table with a `tenantId` column has an active RLS policy before it accepts writes — enforced by a CI/migration check that fails if a new `tenantId`-bear... |


## 7. Data Requirements
|| Data Element | Description | Source | Owner | Sensitivity |
||---|---|---|---|---|
|| `tenantId` / `tenant_id` | UUID identifying the tenant to which a row belongs | Schema of each tenant-scoped table | Data Engineering | Tenant-scoped operational data |
|| `tenants.id` | Primary key of the tenant record; used as the RLS scope key for the `tenants` table | `tenants` table schema | Data Engineering | Tenant directory data |
|| RLS session context (e.g., `app.tenant_id`) | Postgres session variable that the RLS policy compares against `tenantId` | Application connection/session setup | Platform Engineering | Internal control data |
|| RLS policy on each tenant-scoped table | `CREATE POLICY` definition enforcing `tenantId = current_setting('app.tenant_id')` or equivalent | Database migrations / DDL | Technical Lead | Tenant isolation rule |

---

## 8. Business Rules and Logic
|| ID | Rule |
||---|---|
|| BRU-001 | Every table carrying `tenantId` must have an active RLS policy before it accepts writes. |
|| BRU-002 | The `tenants` table is also RLS-protected, scoped by its own `id` column following the same fail-closed pattern as other tenant-scoped tables. |
|| BRU-003 | A tenant-scoped query must set the RLS session context (e.g., `app.tenant_id`) before execution. |
|| BRU-004 | If the tenant context is missing, empty, or does not match a row's `tenantId`, the row is invisible (fail closed). |
|| BRU-005 | Application code may not rely solely on `WHERE tenantId = ?` as the primary isolation mechanism. |
|| BRU-006 | Any process that needs to bypass RLS or operate across all tenants must be deliberate, narrowly scoped, and audited. |

---

## 9. Interfaces and Integrations
|| ID | Dependency | Type | Owner | Expected Resolution |
||---|---|---|---|---|
|| D-001 | Design Spec §8 "Security & Multi-Tenancy" | Internal / Source | Product Owner | Approved (source of ADR-0015) |
|| D-002 | ADR-0016 — Postgres as the Database Engine | Internal / Architecture | Technical Lead | Accepted; data-layer foundation |
|| D-003 | Story 5.4 — Tenant isolation via Postgres Row-Level Security | Internal / Implementation | Product Owner | Ready; governed by ADR-0015 |
|| D-004 | ADR-0030 — Platform Admin's audited, narrowly-scoped RLS bypass | Internal / Architecture | Technical Lead | Accepted; defines the legitimate bypass mechanism |
|| D-005 | ADR-0031 — `tenants` table with its own RLS policy | Internal / Architecture | Technical Lead | Accepted; extends the RLS pattern to the `tenants` table |
|| D-006 | Migration and CI tooling to enforce the RLS convention | Internal / Tooling | Technical Lead | In place or established as part of Story 5.4 |

---

- The platform continues to use a single shared Azure Database for PostgreSQL instance for all tenants.
- All tenant-scoped tables include a `tenantId` UUID column, or the `tenants` table uses `id` as its scope key.
- All application queries that touch tenant data are routed through a tenant-context helper (e.g., `withTenant(resolvedTenantId, ...)`).
- Migration and CI tooling can inspect the schema for `tenantId` columns and missing RLS policies.

Enforce tenant isolation via Postgres Row-Level Security (RLS) policies on every table carrying `tenantId`, rather than relying solely on application-level `WHERE tenantId = ?` filtering.

## 10. Non-Functional Considerations
|| ID | Requirement | Category | Priority | Acceptance Criteria |
||---|---|---|---|---|
|| NFR-001 | RLS-enforced queries shall not introduce unacceptable latency for typical tenant workloads | Performance | Should | Contract and regression tests show query latency remains within acceptable bounds compared to pre-RLS baselines |
|| NFR-002 | RLS policies shall be versioned, reviewable, and stored alongside schema migrations | Maintainability | Must | Every RLS `CREATE POLICY` or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is captured in a numbered migration file under source control |
|| NFR-003 | No tenant shall be able to read or modify another tenant's data through the database layer | Security | Must | Cross-tenant isolation contract tests pass for all tenant-scoped tables |
|| NFR-004 | Tenant isolation shall hold for ad-hoc queries, new endpoints, migration scripts, and batch jobs without requiring application-level filtering at every site | Security | Must | A database session with the wrong or missing tenant context cannot access another tenant's rows |

---

## 11. Error Handling and Exceptions
**Positive**
- RLS makes tenant isolation a database-enforced invariant: even a query path that forgets a `WHERE tenantId = ?` clause (a bug in a new endpoint, a hand-written migration script, an ad-hoc admin query) still can't return another tenant's rows, because the database itself blocks it.
- This is a materially stronger guarantee than application-level filtering alone, which depends on every current and future code path getting the filter right — a single missed filter in one of potentially many query sites (REST API, event publishers, materialized view refresh jobs, admin tooling) would otherwise be a cross-tenant data leak.
- Centralizes the isolation guarantee in one place (the RLS policy definitions) rather than scattering it across every query in the codebase, making it auditable as a fixed, reviewable set of policies.

**Negative**
- Every database connection/session must correctly set the tenant context (e.g., a session variable RLS policies check) before querying; getting this wrong doesn't leak data (RLS still blocks it) but can cause confusing "no rows returned" bugs if the context is simply missing rather than wrong.
- RLS policies add a small amount of query planning/execution overhead versus an unfiltered query, and add a layer that must be kept consistent with the schema as new `tenantId`-bearing tables are added — a new table without an RLS policy is an isolation gap that isn't automatically caught unless enforced by convention or migration tooling.
- Background/batch processes that legitimately need to operate across all tenants (e.g., the `AuthorTopicSignal` materialized view refresh in ADR-0007) need a deliberate, audited way to bypass or iterate through RLS per-tenant, rather than one implicit "admin mode" that could be misused.

## 12. Assumptions and Dependencies
- The platform continues to use a single shared Azure Database for PostgreSQL instance for all tenants.
- All tenant-scoped tables include a `tenantId` UUID column, or the `tenants` table uses `id` as its scope key.
- All application queries that touch tenant data are routed through a tenant-context helper (e.g., `withTenant(resolvedTenantId, ...)`).
- Migration and CI tooling can inspect the schema for `tenantId` columns and missing RLS policies.

## 13. Open Questions / Risks
|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
||---|---|---|---|---|---|
|| R-001 | A missing or unset tenant context causes a query to return zero rows, creating confusing "no data" behavior rather than a leak | Medium | Medium | Standardize a `withTenant` wrapper; add contract tests and clear logging for context setup | Technical Lead |
|| R-002 | A new `tenantId`-bearing table is added without an RLS policy, creating a silent isolation gap | Medium | High | Add a CI/migration check and enforce the convention that RLS is created in the same migration that adds a tenant-scoped table | Technical Lead |
|| R-003 | RLS policies add query planning or execution overhead, degrading performance for high-volume paths | Medium | Medium | Monitor query latency, review execution plans, and keep policies simple and index-friendly | Platform Operator |
|| R-004 | Background or platform-administrative processes are implemented using a broad, unaudited RLS bypass | Medium | High | Require dedicated, narrowly scoped bypass roles (e.g., `platform_admin_role`) and per-tenant iteration by default; audit every bypass | Platform Operator |

---

## 14. Appendix
- ADR: `../../adr/0015-tenant-isolation-via-postgres-row-level-security.md`
- BRD: `../Business-Requirements/BRD-0015-Tenant-Isolation-Via-Postgres-Row-Level-Security.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above