# BRD-0016: Postgres as the Database Engine

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0016: Postgres as the Database Engine |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Architecture / Backend Engineering |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | Architecture / Backend Engineering | Initial BRD derived from ADR-0016, the design spec, and related user stories |

---

## 2. Executive Summary

The Social Listening / Insights subsystem must persist high-volume, platform-specific social posts while enforcing strict isolation between tenants. Platform payloads vary wildly— a tweet, a Reddit comment, and a YouTube comment do not share a fixed schema — so a rigid relational column layout would force constant schema migration or data loss. At the same time, the database will store encrypted tenant credentials, making defense-in-depth isolation essential rather than optional.

This BRD ratifies the decision to use **Azure Database for PostgreSQL** as the sole database engine for `social-listening-core`. The two load-bearing reasons are native JSONB storage for the full, original `rawPayload` and native Row-Level Security (RLS) for multi-tenant isolation. Full-text search and `pgvector` are recognized as future headroom, not current commitments.

The expected outcome is a single, queryable store where tenant data is isolated by the database itself, development can proceed with first-class TypeScript ORM support, and the architecture retains optionality for later semantic-search or keyword-search extensions without a database migration.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Store platform-specific post payloads without losing schema flexibility | `SocialPost.rawPayload` is JSONB, queryable with JSONB path operators, and covered by contract tests |
| 2 | Enforce multi-tenant isolation at the database layer | Every table carrying `tenantId` has an RLS policy; contract tests prove cross-tenant reads are blocked |
| 3 | Reduce operational surprise on startup and runtime health checks | Server refuses to start when Postgres is unreachable; `/v1/health` reflects live database connectivity |
| 4 | Maintain alignment with the TypeScript/Node.js stack | Provisioning and ORM tooling treat Azure Database for PostgreSQL as a first-class target |
| 5 | Preserve future search optionality without committing to it today | Full-text search and `pgvector` capability are documented as headroom, not built speculatively |

---

## 4. Scope

### 4.1 In Scope

- Azure Database for PostgreSQL as the only database engine for `social-listening-core`.
- Native JSONB for `SocialPost.rawPayload` and any other schema-flexible attributes.
- Native Postgres Row-Level Security (RLS) on every tenant-scoped table.
- Database provisioning documentation that names Azure Database for PostgreSQL explicitly.
- Operational readiness: boot-time Postgres connectivity check and a database-aware `/v1/health` route.
- Developer and contract-test database setup that exercises real Postgres JSONB and RLS behavior.

### 4.2 Out of Scope

- Implementing full-text search or `pgvector`-based semantic search in the current phase.
- Supporting a second database engine or planning an engine migration.
- Application-level-only tenant isolation; RLS is the required isolation mechanism.
- Direct database access from `social-listening-admin` or any future UI; all access goes through the `social-listening-core` REST API.

### 4.3 Assumptions

- Azure Database for PostgreSQL is available in the target Azure subscription and region.
- Schema tooling (Prisma, Drizzle, or similar) is used and treats Postgres as a first-class target.
- RLS policies are applied before any tenant data is written.
- The application layer always sets the Postgres `app.tenant_id` (and `app.user_id` where applicable) configuration before running tenant-scoped queries.

### 4.4 Constraints

- The project is intentionally Azure-native (see ADR-0014, ADR-0015, ADR-0016).
- It is a solo-developer project; documentation and validation must be lightweight but real.
- Committing to JSONB operators and RLS policies creates a non-mechanical future migration path if the engine ever changes.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Backend Engineer | Builds and maintains the data layer | High | A stable, well-documented Postgres target with JSONB and RLS primitives |
| Platform Admin | Operates `social-listening-core` | High | Clear startup and health signals for Postgres connectivity |
| Tenant User | Relies on data privacy and correctness | High | No cross-tenant data exposure |
| Tenant Admin | Manages connectors and watchlists | Medium | Confidence that tenant-scoped data is isolated |
| Product Owner / Sponsor (Menno) | Owns the architecture decision | High | A single, defensible engine choice aligned with the Azure stack |

---

## 6. Current State (As-Is)

The design spec states "Azure Database for PostgreSQL" in its architecture overview, but the underlying trade-off discussion was captured only in the chat conversation that produced the spec, not in the written document itself. Before this ADR, the project lacked a recorded, reviewable rationale for why Postgres was chosen over Azure SQL or Cosmos DB.

The as-is data model already plans to store the full original platform payload in `rawPayload` and to enforce tenant isolation. Without a documented engine decision, there was a risk that:
- `rawPayload` would be treated as an opaque serialized blob rather than a queryable, indexable JSONB column.
- Tenant isolation would be implemented only in application code, leaving the database layer as a bypassable boundary.
- Future search capabilities would be selected without a recorded compatibility check against the engine.

---

## 7. Future State (To-Be)

All `social-listening-core` persistence runs on Azure Database for PostgreSQL. The design spec's data model is realized with the following properties:

- `SocialPost.rawPayload` is a native JSONB column, supporting JSONB path operators and indexes, so the full original payload remains available without a rigid schema.
- Every table that carries `tenantId` (e.g., `Author`, `SocialPost`, `IngestionRun`, `Watchlist`, `platform_credentials`) is protected by a `tenant_isolation` RLS policy.
- The server refuses to start if Postgres is unreachable, and the public `/v1/health` endpoint returns `503` when database connectivity is lost.
- `social-listening-admin` has no Postgres driver or connection string; all data access is through the versioned REST API.
- Full-text search and `pgvector` remain available Postgres extensions for future use, but are not provisioned or coded against until a concrete feature requires them.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store the original platform payload as a native Postgres JSONB column | Must | `SocialPost.rawPayload` is JSONB; at least one integration test demonstrates JSONB path querying | Backend Engineering |
| BR-002 | The system shall enforce tenant isolation at the database layer via RLS on every table carrying `tenantId` | Must | Every `tenantId`-bearing table has an RLS policy before tenant data is written; contract tests prove cross-tenant access is denied | Backend Engineering |
| BR-003 | The server shall verify Postgres connectivity before accepting HTTP traffic | Must | Startup runs a bounded `SELECT 1` (or equivalent) and exits non-zero if Postgres is unreachable; retries with backoff are bounded | Backend Engineering |
| BR-004 | `GET /v1/health` shall reflect current Postgres connectivity | Must | Returns `200`/`{ status: 'ok' }` when Postgres answers; returns `503`/`{ status: 'unavailable' }` when it does not; remains unauthenticated | Backend Engineering |
| BR-005 | Database provisioning documentation shall reference Azure Database for PostgreSQL by name | Must | No generic "SQL database" placeholder appears in provisioning or environment documentation | Product Owner |
| BR-006 | The admin UI shall not connect directly to the database | Must | `social-listening-admin` contains no Postgres driver or connection string; all data access uses the `social-listening-core` REST API | Frontend Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Tenant data must be isolated by the database engine, not only by application filtering | Security | Must | RLS policies are in place and verified by the contract suite across all tenant-scoped tables |
| NFR-002 | Flexible post payloads must remain queryable and indexable | Maintainability | Must | JSONB column and at least one JSONB query/index are exercised in contract or integration tests |
| NFR-003 | The data layer must use tooling with first-class PostgreSQL support | Maintainability | Should | Chosen ORM/migration tooling is documented and demonstrated against Postgres |
| NFR-004 | The engine must allow future full-text search and vector extensions without migration | Scalability | Could | Full-text search and `pgvector` are listed in the technology-roadmap appendix, not implemented until required |
| NFR-005 | Database readiness checks must have bounded timeout and retry behavior | Reliability | Must | Startup and health checks fail deterministically within documented timeout/retry limits |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Every table that contains `tenantId` must have a `tenant_isolation` RLS policy before any tenant data is inserted. |
| BRU-002 | The original platform payload in `rawPayload` must never be discarded; it must be stored as JSONB for audit and future querying. |
| BRU-003 | `social-listening-admin` must not hold a Postgres connection string or database driver; it consumes `social-listening-core` REST APIs only. |
| BRU-004 | All tenant-scoped queries must run with `app.tenant_id` (and `app.user_id` where per-user RLS is required) configured for the transaction. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.rawPayload` | Full original platform payload, stored as JSONB | Provider connector normalization | Backend Engineering | May contain PII; tenant-scoped and RLS-protected |
| `tenantId` (all tenant-scoped tables) | Foreign key to the tenant for row-level isolation | Identity resolution | Backend Engineering | High — controls isolation boundary |
| `Author.rawProfilePayload` | Optional full author profile JSONB | Provider connector normalization | Backend Engineering | May contain PII; tenant-scoped and RLS-protected |
| `platform_credentials` credential fields | Encrypted OAuth/API-key material | Connector connect flow | Backend Engineering | Very high — stored encrypted with envelope encryption (ADR-0014) and RLS-protected |
| `IngestionRun` status and metrics | Audit anchor for each acquisition | Ingestion pipeline | Backend Engineering | Operational; tenant-scoped and RLS-protected |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Postgres connectivity on startup | Detect misconfigured or unreachable database before traffic is accepted | Platform Admin / CI | Every deployment |
| `/v1/health` database status | Enable infrastructure monitoring to detect runtime database outages | Platform Admin / Monitoring | Continuous |
| RLS policy coverage | Confirm every `tenantId`-bearing table is protected | Backend Engineering / Security | Per migration / release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Future database engine migration is non-mechanical because of JSONB operators and RLS policies | Low | Medium | Document the engine lock-in explicitly; re-evaluate migration only if business requirements change | Technical Lead |
| R-002 | Full-text search and `pgvector` are cited as justification but not used today, creating unused future-proofing | Medium | Low | Treat them as roadmap headroom; do not provision or build against them until a concrete feature is accepted | Product Owner |
| R-003 | Misconfigured or missing RLS policy could expose cross-tenant data | Low | High | Enforce RLS via contract tests and a pre-commit/CI check that fails when a new `tenantId` table has no policy | Backend Engineering |
| R-004 | Boot-time connectivity failure is misreported as an application error | Low | Medium | Use dedicated `postgresReadiness` helper with clear logging and non-zero exit codes | Backend Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 — Multi-tenant RLS and the `app.tenant_id` mechanism | Internal | Technical Lead | Accepted; referenced by this BRD |
| D-002 | Design Spec §2, §4.2, §8 — architecture, data model, and RLS | Internal | Product Owner | Approved |
| D-003 | ADR-0014 — Azure Key Vault envelope encryption for credentials | Internal | Technical Lead | Accepted |
| D-004 | Azure Database for PostgreSQL service and connection environment | External | Platform Admin | Provisioned per environment |
| D-005 | Story 1.2 — Postgres as the database engine | Internal | Backend Engineering | Built |
| D-006 | Story 1.10 — Postgres boot-time readiness check and real `/v1/health` | Internal | Backend Engineering | Built |

---

## 14. Acceptance Criteria

- `SocialPost.rawPayload` is a JSONB column and is confirmed queryable via JSONB path operators in at least one integration or contract test.
- RLS policies exist on every table carrying `tenantId` before any tenant data is written.
- Database provisioning and environment documentation reference Azure Database for PostgreSQL specifically.
- The server refuses to start if Postgres is unreachable and logs a clear, actionable error.
- `GET /v1/health` returns `200` when Postgres is reachable and `503` when it is not, while remaining public/unauthenticated.
- `social-listening-admin` contains no Postgres driver or connection string.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Azure Database for PostgreSQL | Managed PostgreSQL service on Azure; the chosen database engine for `social-listening-core`. |
| JSONB | Postgres binary JSON storage type, queryable with JSONB operators and indexable. |
| Row-Level Security (RLS) | Postgres feature that enforces access policies at the row level based on session variables or user attributes. |
| `rawPayload` | The full, original platform payload retained for audit and future querying in the `SocialPost` table. |
| `pgvector` | Postgres extension for vector storage and similarity search; future headroom for embedding-based semantic search. |
| `tenantId` | The identifier used to scope every tenant's data and drive RLS policies. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0016-postgres-as-database-engine.md` — source architecture decision record.
- `docs/project docs/2026-07-28-social-listening-ingestion-design.md` — design spec §2 (Architecture Overview), §4.2 (`SocialPost` / `rawPayload`), §8 (Security & Multi-Tenancy).

### 16.2 Product Research

No dedicated product-research feature-design or deep-research file was found for the database-engine decision. The business rationale is drawn from the ADR's recorded chat conversation and the design spec's architecture and data-model sections.

### 16.3 Related User Stories

- **Story 1.2 — Postgres as the database engine**
  - *As a* backend engineer setting up the data layer, *I want* `social-listening-core` provisioned against Azure Database for PostgreSQL using native JSONB for `rawPayload` and native RLS for tenant isolation, *so that* platform-specific post payloads don't force a rigid schema and tenant isolation is enforced by the database itself.
  - Key acceptance criteria: `SocialPost.rawPayload` is JSONB; RLS policies exist on every table carrying `tenantId` before tenant data is written; provisioning documentation names Azure Database for PostgreSQL.

- **Story 1.10 — Postgres boot-time readiness check and a real `/v1/health`**
  - *As an* operator running `social-listening-core`, *I want* the server to refuse to start if Postgres isn't reachable and `/v1/health` to reflect real Postgres connectivity, *so that* misconfiguration is caught immediately and infrastructure monitoring can detect database outages.
  - Key acceptance criteria: startup runs a real `SELECT 1` before `.listen(...)`; unreachable Postgres exits non-zero with a clear error; `/v1/health` returns `200` when reachable and `503` when not; remains public/unauthenticated.

### 16.4 Related ADRs

- ADR-0015 — Multi-tenant RLS and database-level tenant isolation.
- ADR-0014 — Azure Key Vault envelope encryption for stored credentials.
- ADR-0017 — REST API versioning and compatibility policy.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
