# Business Requirements Document (BRD) — Tenant Isolation via Postgres Row-Level Security

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | SocialEngage Social Listening / Insights — Tenant Isolation via Postgres Row-Level Security |
|| Version | 1.0 |
|| Date | 2026-08-22 |
|| Author(s) | Menno, BRD Writer Agent |
|| Approver(s) | Menno, Business Sponsor / Product Owner / Technical Lead |
|| Status | Approved |

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 0.1 | 2026-08-22 | Menno | Initial draft from ADR-0015, Design Spec §8, and Story 5.4 |
|| 1.0 | 2026-08-22 | Menno | Approved as final BRD |

---

## 2. Executive Summary

The SocialEngage platform serves multiple tenants from a single Azure Database for PostgreSQL instance. As the number of tables and query paths grows (REST endpoints, event publishers, materialized view refresh jobs, ad-hoc scripts, and future admin tooling), the risk that a single missing `WHERE tenantId = ?` clause exposes one tenant's data to another becomes unmanageable if isolation depends entirely on application-level filtering.

This BRD captures the decision to make tenant isolation a database-enforced invariant through Postgres Row-Level Security (RLS). Every table that carries `tenantId` will have an active RLS policy that evaluates a session-level tenant context before returning rows. Even if application code forgets the tenant filter, the database itself will block the query from seeing another tenant's data, turning a potential cross-tenant leak into a fail-closed "no rows returned" result.

The expected business value is stronger, auditable, and more maintainable tenant isolation, reduced operational dependence on every developer getting every query right, and a clear trust boundary that supports safer ad-hoc queries, migrations, and batch processes.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
||---|---|---|
|| 1 | Make tenant isolation a database-enforced invariant | Every table carrying `tenantId` has an active RLS policy before it accepts writes |
|| 2 | Eliminate cross-tenant data leakage from missed application filters | Contract tests prove an unfiltered query under a tenant context returns only that tenant's rows, never another tenant's rows |
|| 3 | Centralize and audit the isolation guarantee | RLS policy definitions live in versioned migrations and can be reviewed as a single, consistent set of rules |
|| 4 | Keep legitimate cross-tenant operations explicit and governed | Background and platform-administrative processes use deliberate, audited bypass paths rather than implicit "admin mode" |

---

## 4. Scope

### 4.1 In Scope

- RLS policies on every table carrying `tenantId` (e.g., `Author`, `SocialPost`, `IngestionRun`, `Watchlist`, `AuthorTopicSignal`, `platform_credentials`, and any future tenant-scoped table).
- The `tenants` table, where RLS is scoped by `id` rather than a separate `tenant_id` column, following the same fail-closed pattern.
- Application-side tenant context setup (e.g., a session variable such as `app.tenant_id`) before every tenant-scoped query.
- A CI or migration-time check that fails if a new `tenantId`-bearing table is added without a corresponding RLS policy.
- Contract and regression tests that verify fail-closed behavior and the absence of cross-tenant row leakage.
- Provision for legitimate, narrowly scoped, audited bypass or per-tenant iteration for background and platform-administrative processes.

### 4.2 Out of Scope

- Authentication mechanism selection or identity provider integration (governed by ADR-0029 and Story 5.6).
- The detailed break-glass platform-admin bypass role and audit logging (governed by ADR-0030 and Story 5.7).
- Database-per-tenant or schema-per-tenant physical isolation.
- Any user interface for managing RLS policies or tenant context.

### 4.3 Assumptions

- The platform continues to use a single shared Azure Database for PostgreSQL instance for all tenants.
- All tenant-scoped tables include a `tenantId` UUID column, or the `tenants` table uses `id` as its scope key.
- All application queries that touch tenant data are routed through a tenant-context helper (e.g., `withTenant(resolvedTenantId, ...)`).
- Migration and CI tooling can inspect the schema for `tenantId` columns and missing RLS policies.

### 4.4 Constraints

- RLS must not break existing or future application query paths; policies must be additive and fail-closed.
- RLS policy overhead must remain within acceptable query-latency bounds.
- New tenant-scoped tables must adopt RLS as part of the same migration that creates them.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
||---|---|---|---|
|| Platform Operator / Security Lead | Owns the multi-tenant trust boundary | High | Database-level, auditable isolation that survives application bugs |
|| Tenant Admin | Manages a single tenant's users, connectors, and data | Medium | Assurance that other tenants cannot see or affect their data |
|| Tenant User | Uses the platform on behalf of a tenant | Medium | Reliable access to their own tenant's data only |
|| Backend / Platform Engineer | Implements and maintains data access patterns | High | A single, central isolation mechanism instead of per-query filtering |
|| Product Owner / Sponsor (Menno) | Accountable for scope and acceptability | High | Fail-closed, future-proof tenant isolation from day one |
|| Auditor / Compliance Reviewer | Validates data-access controls | Medium | Documented, versioned RLS policies and proof of no cross-tenant leakage |

---

## 6. Current State (As-Is)

The platform stores all tenant data in a single shared Postgres database. Tenant separation today depends on every query, migration, ad-hoc script, event publisher, and background job including the correct `WHERE tenantId = ?` filter. This creates the following pain points:

- A single missed filter in any new endpoint, batch job, or migration script becomes a potential cross-tenant data leak.
- The isolation guarantee is scattered across the codebase, making it hard to audit and easy to regress.
- Background processes that legitimately need to operate across tenants (for example, refreshing `AuthorTopicSignal` in ADR-0007) lack a deliberate, governed bypass pattern and may be tempted to rely on an implicit "admin mode."

---

## 7. Future State (To-Be)

After the initiative is implemented, tenant isolation is enforced by the database itself. Before any tenant-scoped query runs, the application sets a session-level tenant context. Postgres RLS policies on every `tenantId`-bearing table then restrict each query to rows matching that context, regardless of whether the application remembered to add a `WHERE tenantId = ?` clause.

**New or improved process:**

1. A caller's tenant is resolved and the session's tenant context is set before any tenant-scoped query.
2. Every query against a tenant-scoped table is filtered by the active RLS policy, not only by application logic.
3. An unset or mismatched tenant context returns zero rows (fail closed), never another tenant's rows.
4. New tables carrying `tenantId` are caught by migration/CI checks if they lack an RLS policy.
5. Legitimate cross-tenant work uses an explicit, audited, narrowly scoped bypass or per-tenant iteration.

**Expected capabilities:**

- Database-level tenant isolation that is independent of application correctness.
- A single, reviewable set of RLS policy definitions.
- Safer ad-hoc queries, migrations, and new endpoints that cannot accidentally leak across tenants.
- A governed pattern for platform administration and batch jobs that must operate across tenants.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
||---|---|---|---|---|
|| BR-001 | The system shall have an active RLS policy on every table carrying `tenantId` before it accepts writes | Must | A migration or CI check confirms every `tenantId`-bearing table has an active RLS policy | Product Owner |
|| BR-002 | The RLS policy shall fail closed: a query executed without a tenant session context shall return zero rows, not another tenant's data | Must | A contract test with no tenant context set confirms no rows are returned from a tenant-scoped table | Technical Lead |
|| BR-003 | A deliberately unfiltered query against a tenant-scoped table with two tenants' data shall return only the session's own tenant's rows | Must | A contract test omits `WHERE tenantId` and confirms only the configured tenant's rows are returned | Technical Lead |
|| BR-004 | The application shall set the tenant context on every database session before issuing a tenant-scoped query | Must | All tenant-scoped query paths use a helper (e.g., `withTenant`) that sets the RLS session variable; repository check confirms no raw, unwrapped tenant queries | Technical Lead |
|| BR-005 | The system shall detect any new `tenantId`-bearing table that is added without an RLS policy | Should | CI or a schema test fails when a `tenantId` column exists without a corresponding active RLS policy | Technical Lead |
|| BR-006 | Background and platform-administrative processes that legitimately operate across tenants shall use a deliberate, audited bypass or per-tenant iteration, not an implicit admin mode | Should | Code review and contract tests confirm that cross-tenant operations use dedicated, named roles or loops, with no general "read all tenants" path | Platform Operator |

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
||---|---|---|---|---|
|| NFR-001 | RLS-enforced queries shall not introduce unacceptable latency for typical tenant workloads | Performance | Should | Contract and regression tests show query latency remains within acceptable bounds compared to pre-RLS baselines |
|| NFR-002 | RLS policies shall be versioned, reviewable, and stored alongside schema migrations | Maintainability | Must | Every RLS `CREATE POLICY` or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is captured in a numbered migration file under source control |
|| NFR-003 | No tenant shall be able to read or modify another tenant's data through the database layer | Security | Must | Cross-tenant isolation contract tests pass for all tenant-scoped tables |
|| NFR-004 | Tenant isolation shall hold for ad-hoc queries, new endpoints, migration scripts, and batch jobs without requiring application-level filtering at every site | Security | Must | A database session with the wrong or missing tenant context cannot access another tenant's rows |

---

## 9. Business Rules

|| ID | Rule |
||---|---|
|| BRU-001 | Every table carrying `tenantId` must have an active RLS policy before it accepts writes. |
|| BRU-002 | The `tenants` table is also RLS-protected, scoped by its own `id` column following the same fail-closed pattern as other tenant-scoped tables. |
|| BRU-003 | A tenant-scoped query must set the RLS session context (e.g., `app.tenant_id`) before execution. |
|| BRU-004 | If the tenant context is missing, empty, or does not match a row's `tenantId`, the row is invisible (fail closed). |
|| BRU-005 | Application code may not rely solely on `WHERE tenantId = ?` as the primary isolation mechanism. |
|| BRU-006 | Any process that needs to bypass RLS or operate across all tenants must be deliberate, narrowly scoped, and audited. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
||---|---|---|---|---|
|| `tenantId` / `tenant_id` | UUID identifying the tenant to which a row belongs | Schema of each tenant-scoped table | Data Engineering | Tenant-scoped operational data |
|| `tenants.id` | Primary key of the tenant record; used as the RLS scope key for the `tenants` table | `tenants` table schema | Data Engineering | Tenant directory data |
|| RLS session context (e.g., `app.tenant_id`) | Postgres session variable that the RLS policy compares against `tenantId` | Application connection/session setup | Platform Engineering | Internal control data |
|| RLS policy on each tenant-scoped table | `CREATE POLICY` definition enforcing `tenantId = current_setting('app.tenant_id')` or equivalent | Database migrations / DDL | Technical Lead | Tenant isolation rule |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
||---|---|---|---|
|| RLS policy coverage | Confirm that every `tenantId`-bearing table has an active policy | Platform Operator / Technical Lead | Per build / per migration |
|| Cross-tenant isolation test results | Prove that no query path leaks tenant data | Engineering / Security | Per build |
|| Missing-RLS alerts | Catch newly added tables that lack an RLS policy | Platform Operator / Technical Lead | Per CI run |
|| Tenant-scoped query latency | Monitor the performance overhead of RLS policies | Platform Operator / Engineering | Per release / continuous |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
||---|---|---|---|---|---|
|| R-001 | A missing or unset tenant context causes a query to return zero rows, creating confusing "no data" behavior rather than a leak | Medium | Medium | Standardize a `withTenant` wrapper; add contract tests and clear logging for context setup | Technical Lead |
|| R-002 | A new `tenantId`-bearing table is added without an RLS policy, creating a silent isolation gap | Medium | High | Add a CI/migration check and enforce the convention that RLS is created in the same migration that adds a tenant-scoped table | Technical Lead |
|| R-003 | RLS policies add query planning or execution overhead, degrading performance for high-volume paths | Medium | Medium | Monitor query latency, review execution plans, and keep policies simple and index-friendly | Platform Operator |
|| R-004 | Background or platform-administrative processes are implemented using a broad, unaudited RLS bypass | Medium | High | Require dedicated, narrowly scoped bypass roles (e.g., `platform_admin_role`) and per-tenant iteration by default; audit every bypass | Platform Operator |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
||---|---|---|---|---|
|| D-001 | Design Spec §8 "Security & Multi-Tenancy" | Internal / Source | Product Owner | Approved (source of ADR-0015) |
|| D-002 | ADR-0016 — Postgres as the Database Engine | Internal / Architecture | Technical Lead | Accepted; data-layer foundation |
|| D-003 | Story 5.4 — Tenant isolation via Postgres Row-Level Security | Internal / Implementation | Product Owner | Ready; governed by ADR-0015 |
|| D-004 | ADR-0030 — Platform Admin's audited, narrowly-scoped RLS bypass | Internal / Architecture | Technical Lead | Accepted; defines the legitimate bypass mechanism |
|| D-005 | ADR-0031 — `tenants` table with its own RLS policy | Internal / Architecture | Technical Lead | Accepted; extends the RLS pattern to the `tenants` table |
|| D-006 | Migration and CI tooling to enforce the RLS convention | Internal / Tooling | Technical Lead | In place or established as part of Story 5.4 |

---

## 14. Acceptance Criteria

- Every table carrying `tenantId` has an active RLS policy before it accepts writes.
- A query executed without the expected tenant session context returns zero rows (fails closed).
- A deliberately unfiltered query against a table containing two tenants' data returns only the session's own tenant's rows.
- A CI or migration check fails when a new `tenantId`-bearing table is created without an RLS policy.
- Legitimate background or platform-administrative processes that operate across tenants use an explicit, audited, narrowly scoped path.

---

## 15. Glossary

|| Term | Definition |
||---|---|
|| Row-Level Security (RLS) | A Postgres feature that restricts which rows a query can see based on the session context and active policies. |
|| `tenantId` / `tenant_id` | The UUID column that associates a row with a specific tenant. |
|| `app.tenant_id` (or equivalent) | The Postgres session-level variable that the RLS policy compares to a row's `tenantId` to enforce isolation. |
|| Fail-closed | A security design in which a missing or invalid context results in no access (zero rows) rather than too much access. |
|| `BYPASSRLS` | A Postgres role attribute that allows a session to bypass RLS policies; intended only for deliberate, audited use. |
|| `withTenant` | The application helper that sets the tenant context before executing a tenant-scoped database query. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md` — the source ADR.
- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` §8 "Security & Multi-Tenancy".
- `docs/user-stories/epic-5-security-isolation-and-messaging.md` — Story 5.4 derived from ADR-0015.
- `docs/user-stories/README.md` — epic and story index.

### 16.2 Missing or Not-Applicable Sources

- No dedicated `docs/product-research/feature-designs/<feature>.md` file was found for tenant isolation / Postgres Row-Level Security; the source material is the ADR, the Design Spec §8, and Story 5.4.
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature.

---

## 17. Approval

|| Role | Name | Signature | Date |
||---|---|---|---|
|| Business Sponsor | Menno | — | 2026-08-22 |
|| Product Owner | Menno | — | 2026-08-22 |
|| Technical Lead | Menno | — | 2026-08-22 |
|| Other Stakeholder | — | — | — |
