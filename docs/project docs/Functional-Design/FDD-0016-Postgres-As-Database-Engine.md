# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0016 Postgres as the Database Engine — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0016-postgres-as-database-engine.md, ../Business-Requirements/BRD-0016-Postgres-As-Database-Engine.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0016-postgres-as-database-engine.md and the business requirements in BRD-0016-Postgres-As-Database-Engine.md into functional design for **Postgres As Database Engine**.
The Social Listening / Insights subsystem must persist high-volume, platform-specific social posts while enforcing strict isolation between tenants. Platform payloads vary wildly— a tweet, a Reddit comment, and a YouTube comment do not share a fixed schema — so a rigid relational column layout would force constant schema migration or data loss. At the same time, the database will store encrypted tenant credentials, making defense-in-depth isolation essential rather than optional.

This BRD ratifies the decision to use **Azure Database for PostgreSQL** as the sole database engine for `social-listening-core`. The two load-bearing reasons are native JSONB storage for the full, original `rawPayload` and native Row-Level Security (RLS) for multi-tenant isolation. Full-text search and `pgvector` are recognized as future headroom, not current commitments.

The expected outcome is a single, queryable store where tenant data is isolated by the database itself, development can proceed with first-class TypeScript ORM support, and the architecture retains optionality for later semantic-search or keyword-search extensions without a database migration.

---

### 2.2 Scope
**In scope:**
- Azure Database for PostgreSQL as the only database engine for `social-listening-core`.
- Native JSONB for `SocialPost.rawPayload` and any other schema-flexible attributes.
- Native Postgres Row-Level Security (RLS) on every tenant-scoped table.
- Database provisioning documentation that names Azure Database for PostgreSQL explicitly.
- Operational readiness: boot-time Postgres connectivity check and a database-aware `/v1/health` route.
- Developer and contract-test database setup that exercises real Postgres JSONB and RLS behavior.

**Out of scope:**
- Implementing full-text search or `pgvector`-based semantic search in the current phase.
- Supporting a second database engine or planning an engine migration.
- Application-level-only tenant isolation; RLS is the required isolation mechanism.
- Direct database access from `social-listening-admin` or any future UI; all access goes through the `social-listening-core` REST API.

## 3. Context and Background
The spec commits to Postgres in one line (§2). The reasoning behind that line was worked out earlier in the design conversation, when asked to choose between the two Azure database options under consideration (Azure SQL and Postgres):

> Q: Between the two Azure options you mentioned, which database engine?
> A: Not sure — want your recommendation
>
> For this workload, I'd recommend Azure Database for PostgreSQL, for a few concrete reasons:
>
> - **JSONB support** — social posts from different platforms have wildly different schemas (a tweet vs. a Reddit comment vs. a YouTube comment). Postgres's JSONB lets you store the raw normalized-but-flexible payload without forcing a rigid schema, while still being queryable/indexable.
> - **Row-Level Security (RLS)** — Postgres has native RLS, which is a strong fit for your multi-tenant isolation requirement: you can enforce "tenant A can never see tenant B's rows" at the database layer itself, not just in application code. That's a meaningful defense-in-depth layer given you're also storing encrypted credentials.
> - **Full-text search + extensions** — built-in full-text search covers keyword/hashtag tracking reasonably well out of the box, and pgvector gives you a future path to embedding-based semantic search/sentiment clustering without changing databases later.
> - **Node/TypeScript ecosystem** — Prisma and Drizzle (the two leading TS ORMs) both have first-class Postgres support; Azure SQL support is comparatively secondary in both.
>
> Azure SQL is a fine engine, but it's a stronger fit for rigid, relational, transactional workloads (e.g. financial ledgers) — less natural for the flexible, high-volume, semi-structured ingestion this system needs.
>
> Q: Sound good?
> A: Yes, go with Postgres

Two of the four reasons given (JSONB, RLS) went on to become load-bearing in the spec itself — §4.2's `rawPayload` and §8's RLS-based tenant isolation (ADR-0015). The other two (full-text search, `pgvector`) were part of the original rationale but are not exercised by anything in the current spec — noted below as headroom rather than active justification.
The Social Listening / Insights subsystem must persist high-volume, platform-specific social posts while enforcing strict isolation between tenants. Platform payloads vary wildly— a tweet, a Reddit comment, and a YouTube comment do not share a fixed schema — so a rigid relational column layout would force constant schema migration or data loss. At the same time, the database will store encrypted tenant credentials, making defense-in-depth isolation essential rather than optional.

This BRD ratifies the decision to use **Azure Database for PostgreSQL** as the sole database engine for `social-listening-core`. The two load-bearing reasons are native JSONB storage for the full, original `rawPayload` and native Row-Level Security (RLS) for multi-tenant isolation. Full-text search and `pgvector` are recognized as future headroom, not current commitments.

The expected outcome is a single, queryable store where tenant data is isolated by the database itself, development can proceed with first-class TypeScript ORM support, and the architecture retains optionality for later semantic-search or keyword-search extensions without a database migration.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Store platform-specific post payloads without losing schema flexibility | `SocialPost.rawPayload` is JSONB, queryable with JSONB path operators, and covered by contract tests |
| 2 | Enforce multi-tenant isolation at the database layer | Every table carrying `tenantId` has an RLS policy; contract tests prove cross-tenant reads are blocked |
| 3 | Reduce operational surprise on startup and runtime health checks | Server refuses to start when Postgres is unreachable; `/v1/health` reflects live database connectivity |
| 4 | Maintain alignment with the TypeScript/Node.js stack | Provisioning and ORM tooling treat Azure Database for PostgreSQL as a first-class target |
| 5 | Preserve future search optionality without committing to it today | Full-text search and `pgvector` capability are documented as headroom, not built speculatively |

---

**Positive consequences (from ADR):**
**Positive**
- JSONB gives `rawPayload` a queryable, indexable column type instead of an opaque blob (e.g., a `TEXT` column holding serialized JSON) — directly addressing the schema variance across platforms (a tweet vs. a Reddit comment vs. a YouTube comment) called out in the original reasoning.
- Native RLS is enforced by the database engine itself, not just in application code — the specific defense-in-depth property the original discussion flagged as mattering given credentials are also stored in the same database.
- Un-exercised today, but real optionality: `pgvector` gives a future path to embedding-based semantic search or sentiment clustering without a database migration if that's ever wanted; built-in full-text search is available for keyword/hashtag matching without adding a search-engine dependency.
- Prisma/Drizzle (the leading TypeScript ORMs) both treat Postgres as first-class, consistent with the rest of the stack being TypeScript/Node.js throughout (§2).

**Negative**
- Two of the four original reasons (full-text search, `pgvector`) aren't used by anything the spec currently does — they're carried as future-proofing, which is a reasonable bet but means part of this decision's justification won't be validated until (if) those capabilities are actually exercised.
- Committing to Postgres-specific features (JSONB operators, RLS policies) at the schema level means a future engine migration, if ever needed, is not a mechanical port: RLS policies and any JSONB-specific queries would need to be reimplemented, not just translated.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall store the original platform payload as a native Postgres JSONB column | Must | `SocialPost.rawPayload` is JSONB; at least one integration test demonstrates JSONB path querying | Backend Engineering |
| BR-002 | The system shall enforce tenant isolation at the database layer via RLS on every table carrying `tenantId` | Must | Every `tenantId`-bearing table has an RLS policy before tenant data is written; contract tests prove cross-tenant access is denied | Backend Engineering |
| BR-003 | The server shall verify Postgres connectivity before accepting HTTP traffic | Must | Startup runs a bounded `SELECT 1` (or equivalent) and exits non-zero if Postgres is unreachable; retries with backoff are bounded | Backend Engineering |
| BR-004 | `GET /v1/health` shall reflect current Postgres connectivity | Must | Returns `200`/`{ status: 'ok' }` when Postgres answers; returns `503`/`{ status: 'unavailable' }` when it does not; remains unauthenticated | Backend Engineering |
| BR-005 | Database provisioning documentation shall reference Azure Database for PostgreSQL by name | Must | No generic "SQL database" placeholder appears in provisioning or environment documentation | Product Owner |
| BR-006 | The admin UI shall not connect directly to the database | Must | `social-listening-admin` contains no Postgres driver or connection string; all data access uses the `social-listening-core` REST API | Frontend Engineering |

### 5.1 Architecture Decision
Use Azure Database for PostgreSQL as the sole database engine, per the reasoning above. The two reasons that carry direct, present-day weight are native JSONB (backing `rawPayload`, §4.2) and native Row-Level Security (backing tenant isolation, §8, ADR-0015). Full-text search and `pgvector` were cited as additional reasons at decision time but describe future capability headroom, not something the current spec commits to using.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Backend Engineer | Builds and maintains the data layer | High | A stable, well-documented Postgres target with JSONB and RLS primitives |
| Platform Admin | Operates `social-listening-core` | High | Clear startup and health signals for Postgres connectivity |
| Tenant User | Relies on data privacy and correctness | High | No cross-tenant data exposure |
| Tenant Admin | Manages connectors and watchlists | Medium | Confidence that tenant-scoped data is isolated |
| Product Owner / Sponsor (Menno) | Owns the architecture decision | High | A single, defensible engine choice aligned with the Azure stack |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.2 | epic-1-repository-and-api-foundation.md | As backend engineer setting up the data layer, I want `social-listening-core` provisioned against Azure Database for PostgreSQL, using native JSONB for `rawP... | `SocialPost.rawPayload` is a JSONB column, confirmed queryable via JSONB path operators in at least one integration test.; RLS policies exist on every table ... |
| Story 1.10 | epic-1-repository-and-api-foundation.md | As operator running `social-listening-core`, I want the server to refuse to start if Postgres isn't reachable, and `/v1/health` to reflect real, current Post... | On startup, before calling `.listen(...)`, the server runs a real connectivity check against Postgres (e.g. `SELECT 1` via `getPool()`) and only proceeds to ... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.rawPayload` | Full original platform payload, stored as JSONB | Provider connector normalization | Backend Engineering | May contain PII; tenant-scoped and RLS-protected |
| `tenantId` (all tenant-scoped tables) | Foreign key to the tenant for row-level isolation | Identity resolution | Backend Engineering | High — controls isolation boundary |
| `Author.rawProfilePayload` | Optional full author profile JSONB | Provider connector normalization | Backend Engineering | May contain PII; tenant-scoped and RLS-protected |
| `platform_credentials` credential fields | Encrypted OAuth/API-key material | Connector connect flow | Backend Engineering | Very high — stored encrypted with envelope encryption (ADR-0014) and RLS-protected |
| `IngestionRun` status and metrics | Audit anchor for each acquisition | Ingestion pipeline | Backend Engineering | Operational; tenant-scoped and RLS-protected |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Every table that contains `tenantId` must have a `tenant_isolation` RLS policy before any tenant data is inserted. |
| BRU-002 | The original platform payload in `rawPayload` must never be discarded; it must be stored as JSONB for audit and future querying. |
| BRU-003 | `social-listening-admin` must not hold a Postgres connection string or database driver; it consumes `social-listening-core` REST APIs only. |
| BRU-004 | All tenant-scoped queries must run with `app.tenant_id` (and `app.user_id` where per-user RLS is required) configured for the transaction. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0015 — Multi-tenant RLS and the `app.tenant_id` mechanism | Internal | Technical Lead | Accepted; referenced by this BRD |
| D-002 | Design Spec §2, §4.2, §8 — architecture, data model, and RLS | Internal | Product Owner | Approved |
| D-003 | ADR-0014 — Azure Key Vault envelope encryption for credentials | Internal | Technical Lead | Accepted |
| D-004 | Azure Database for PostgreSQL service and connection environment | External | Platform Admin | Provisioned per environment |
| D-005 | Story 1.2 — Postgres as the database engine | Internal | Backend Engineering | Built |
| D-006 | Story 1.10 — Postgres boot-time readiness check and real `/v1/health` | Internal | Backend Engineering | Built |

---

- Azure Database for PostgreSQL is available in the target Azure subscription and region.
- Schema tooling (Prisma, Drizzle, or similar) is used and treats Postgres as a first-class target.
- RLS policies are applied before any tenant data is written.
- The application layer always sets the Postgres `app.tenant_id` (and `app.user_id` where applicable) configuration before running tenant-scoped queries.

Use Azure Database for PostgreSQL as the sole database engine, per the reasoning above. The two reasons that carry direct, present-day weight are native JSONB (backing `rawPayload`, §4.2) and native Row-Level Security (backing tenant isolation, §8, ADR-0015). Full-text search and `pgvector` were cited as additional reasons at decision time but describe future capability headroom, not something the current spec commits to using.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Tenant data must be isolated by the database engine, not only by application filtering | Security | Must | RLS policies are in place and verified by the contract suite across all tenant-scoped tables |
| NFR-002 | Flexible post payloads must remain queryable and indexable | Maintainability | Must | JSONB column and at least one JSONB query/index are exercised in contract or integration tests |
| NFR-003 | The data layer must use tooling with first-class PostgreSQL support | Maintainability | Should | Chosen ORM/migration tooling is documented and demonstrated against Postgres |
| NFR-004 | The engine must allow future full-text search and vector extensions without migration | Scalability | Could | Full-text search and `pgvector` are listed in the technology-roadmap appendix, not implemented until required |
| NFR-005 | Database readiness checks must have bounded timeout and retry behavior | Reliability | Must | Startup and health checks fail deterministically within documented timeout/retry limits |

---

## 11. Error Handling and Exceptions
**Positive**
- JSONB gives `rawPayload` a queryable, indexable column type instead of an opaque blob (e.g., a `TEXT` column holding serialized JSON) — directly addressing the schema variance across platforms (a tweet vs. a Reddit comment vs. a YouTube comment) called out in the original reasoning.
- Native RLS is enforced by the database engine itself, not just in application code — the specific defense-in-depth property the original discussion flagged as mattering given credentials are also stored in the same database.
- Un-exercised today, but real optionality: `pgvector` gives a future path to embedding-based semantic search or sentiment clustering without a database migration if that's ever wanted; built-in full-text search is available for keyword/hashtag matching without adding a search-engine dependency.
- Prisma/Drizzle (the leading TypeScript ORMs) both treat Postgres as first-class, consistent with the rest of the stack being TypeScript/Node.js throughout (§2).

**Negative**
- Two of the four original reasons (full-text search, `pgvector`) aren't used by anything the spec currently does — they're carried as future-proofing, which is a reasonable bet but means part of this decision's justification won't be validated until (if) those capabilities are actually exercised.
- Committing to Postgres-specific features (JSONB operators, RLS policies) at the schema level means a future engine migration, if ever needed, is not a mechanical port: RLS policies and any JSONB-specific queries would need to be reimplemented, not just translated.

## 12. Assumptions and Dependencies
- Azure Database for PostgreSQL is available in the target Azure subscription and region.
- Schema tooling (Prisma, Drizzle, or similar) is used and treats Postgres as a first-class target.
- RLS policies are applied before any tenant data is written.
- The application layer always sets the Postgres `app.tenant_id` (and `app.user_id` where applicable) configuration before running tenant-scoped queries.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Future database engine migration is non-mechanical because of JSONB operators and RLS policies | Low | Medium | Document the engine lock-in explicitly; re-evaluate migration only if business requirements change | Technical Lead |
| R-002 | Full-text search and `pgvector` are cited as justification but not used today, creating unused future-proofing | Medium | Low | Treat them as roadmap headroom; do not provision or build against them until a concrete feature is accepted | Product Owner |
| R-003 | Misconfigured or missing RLS policy could expose cross-tenant data | Low | High | Enforce RLS via contract tests and a pre-commit/CI check that fails when a new `tenantId` table has no policy | Backend Engineering |
| R-004 | Boot-time connectivity failure is misreported as an application error | Low | Medium | Use dedicated `postgresReadiness` helper with clear logging and non-zero exit codes | Backend Engineering |

---

## 14. Appendix
- ADR: `../../adr/0016-postgres-as-database-engine.md`
- BRD: `../Business-Requirements/BRD-0016-Postgres-As-Database-Engine.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: _No deep-research report found._
- User stories: see extracted stories above