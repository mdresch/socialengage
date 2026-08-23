# BRD-0088: Ad-hoc Query Allowlist

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0088: Ad-hoc Query Allowlist |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0088-ad-hoc-query-allowlist.md, ../Business-Requirements/BRD-0088-Ad-Hoc-Query-Allowlist.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0088-ad-hoc-query-allowlist.md and the business requirements in BRD-0088-Ad-Hoc-Query-Allowlist.md into functional design for **Ad Hoc Query Allowlist**.
**What problem are we solving?** Tenant business analysts and brand-reputation managers need flexible, server-side aggregations to answer custom questions that the pre-built dashboard does not cover. Today, the platform does not expose a safe way for these users to explore their data, which either limits insight or pushes them toward unsanctioned, high-risk access patterns.

**Who is affected?** The primary beneficiaries are `Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` personas. `Tenant-Admin` and `Topic-Center-Analyst` are secondary users, while the platform team gains a controlled, monitorable analytics surface.

**What is the proposed solution at a glance?** A structured, allowlist-governed `POST /v1/analytics/query` endpoint that translates a JSON query into a safe, parameterized, RLS-scoped aggregation. Users select dimensions, metrics, filters, and a time grain, and receive a JSON or CSV result set without writing SQL or touching raw data.

**What business value do we expect?** Ad-hoc analytical power without SQL-injection or cross-tenant data-exfiltration risk; faster insights from server-side aggregation; exportable results for external reporting; and a reusable foundation for future dashboard widgets.

---

### 2.2 Scope
**In scope:**
- A structured query request format with `dimensions`, `metrics`, `filters`, `timeGrain`, `limit`, and `format`.
- A hard-coded allowlist of dimensions (`date`, `platform`, `author`, `topic`, `sentiment`, `watchlist`, `source`) and metrics (`count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, `unique_authors`).
- Validation that rejects unknown dimensions and metrics with a clear `400` error.
- Translation of the structured query into safe, parameterized SQL scoped to the calling tenant.
- JSON and CSV response formats.
- Server-side resource guards: 30-second query timeout, 1,000-row hard cap, 60 requests-per-minute per-tenant rate limit (configurable).
- Use of precomputed daily-count views where the query grain and filters match, with fallback to raw post data for drill-downs.
- Read-only behavior: the endpoint accepts a `POST` body by convention but never writes data.
- Backend support for `hour`, `day`, `week`, and `month` time grains.

**Out of scope:**
- Arbitrary SQL, free-text query, or general-purpose query language support.
- Saved, named, or shared ad-hoc queries (deferred pending open question resolution).
- Natural-language query builder, AI explanation, or smart suggestions (future enhancements listed in the feature design).
- Real-time streaming or continuous-query execution.
- Client-side, in-browser aggregation over unbounded data sets.

## 3. Context and Background
See ADR Context.
**What problem are we solving?** Tenant business analysts and brand-reputation managers need flexible, server-side aggregations to answer custom questions that the pre-built dashboard does not cover. Today, the platform does not expose a safe way for these users to explore their data, which either limits insight or pushes them toward unsanctioned, high-risk access patterns.

**Who is affected?** The primary beneficiaries are `Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` personas. `Tenant-Admin` and `Topic-Center-Analyst` are secondary users, while the platform team gains a controlled, monitorable analytics surface.

**What is the proposed solution at a glance?** A structured, allowlist-governed `POST /v1/analytics/query` endpoint that translates a JSON query into a safe, parameterized, RLS-scoped aggregation. Users select dimensions, metrics, filters, and a time grain, and receive a JSON or CSV result set without writing SQL or touching raw data.

**What business value do we expect?** Ad-hoc analytical power without SQL-injection or cross-tenant data-exfiltration risk; faster insights from server-side aggregation; exportable results for external reporting; and a reusable foundation for future dashboard widgets.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenant analysts to answer custom questions without writing SQL | `Tenant-Business-Analyst` can complete an ad-hoc query end-to-end in the UI or API within one session |
| 2 | Preserve tenant data isolation and prevent injection attacks | No successful cross-tenant query or SQL-injection finding in security review; parameterized queries only |
| 3 | Protect database performance under ad-hoc load | 95% of allowed queries complete within 30 seconds and return no more than 1,000 rows |
| 4 | Create a reusable analytics foundation for future dashboard features | New dashboard widgets can be built on the same endpoint within one subsequent epic |

---

**Positive consequences (from ADR):**
1. **Analyst power without SQL risk:** users can answer custom questions without direct database access.
2. **Performance guardrails:** the allowlist, time caps, and row limits prevent runaway queries.
3. **Foundation for dashboards:** future dashboard widgets can be built on this endpoint.
4. **Maintenance cost:** every new dimension or metric must be added to the allowlist and query builder.
5. **Not a general query language:** users cannot express arbitrary analytics. The allowlist is intentionally narrow.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall let a tenant user build a structured query with dimensions, metrics, filters, time grain, and output format | Must | API accepts the request shape defined in ADR-0088; UI story 10.5 covers builder controls | Product Owner |
| BR-002 | The system shall validate `dimensions` and `metrics` against a hard-coded allowlist | Must | Unknown dimensions return `400 UNKNOWN_DIMENSION`; unknown metrics return `400 UNKNOWN_METRIC` | Product Owner |
| BR-003 | The system shall execute each query as a parameterized, tenant-scoped, read-only aggregation | Must | Query uses `withTenant()` RLS; no user input is concatenated into SQL; no writes occur | Technical Lead |
| BR-004 | The system shall return query results as JSON or streaming CSV | Must | `format:'json'` returns a columns/rows/metadata payload; `format:'csv'` returns a downloadable stream | Product Owner |
| BR-005 | The system shall prefer precomputed daily-count views and fall back to raw tables for drill-downs | Should | Same query against a precomputed view completes in under 5 seconds and reports `source:'precomputed'` | Technical Lead |
| BR-006 | The system shall support `hour`, `day`, `week`, and `month` time grains for the `date` dimension | Must | Contract tests cover all four grains with valid and invalid combinations | Technical Lead |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user of ad-hoc queries | High | Build aggregations without SQL; export results for reporting |
| Tenant-Brand-Reputation-Manager | Crisis and one-off investigations | High | Quickly run one-off queries during incidents |
| Topic-Center-Analyst | Explores topic and author dimensions | Medium | Go beyond pre-built views for topic/author analysis |
| Tenant-Admin | Access controller for tenant users | Medium | Decide which roles may use ad-hoc queries |
| Platform-Admin / Sole-Operator | Platform health and cost owner | Medium | Prevent runaway queries and monitor usage |
| Development Team | Builds the query builder and API | High | A bounded, safe contract that is testable and maintainable |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.4 | epic-10-adr-0086-to-0094.md | As backend engineer, I want `POST /v1/analytics/query` to accept a structured, allowlisted query and return a safe aggregation, so that `Tenant-Business-Anal... | `dimensions` and `metrics` are validated against an allowlist.; `QueryBuilder` translates the structured request into a parameterized, tenant-scoped SQL quer... |
| Story 10.5 | epic-10-adr-0086-to-0094.md | As `Tenant-Business-Analyst`, I want a query builder in the analytics dashboard that lets me pick dimensions and metrics and export results, so that I can ex... | `AdHocQueryBuilder` lets users select dimensions, metrics, filters, and time grain.; Results are shown in a table or downloaded as CSV.; Errors (unknown dime... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Dimension values | Allowed categorical fields such as `platform`, `source`, `author`, `topic`, `sentiment`, `watchlist`, `date` | `social_posts`, `post_watchlist_matches`, precomputed `*DailyCount` tables | Data Engineering | Tenant-scoped; some contain personal data (author) |
| Metrics | Aggregated values: `count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, `unique_authors` | Computed at query time from `social_posts` or precomputed views | Data Engineering | Tenant-scoped; aggregated only |
| Filter criteria | `dateRange`, `platform`, `author`, `topic`, `sentiment`, `watchlist` values submitted by the user | User input, validated against allowlist | Product Owner | Untrusted input; must be parameterized |
| Query result metadata | `columns`, `rows`, `rowCount`, `truncated`, `queryTimeMs`, `source` | Generated by the endpoint at runtime | Technical Lead | Operational |
| CSV export stream | Streaming result file for download | Generated by the endpoint at runtime | Technical Lead | Tenant-scoped; must not be cached across tenants |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Only allowlisted `dimensions` and `metrics` combinations may be accepted. |
| BRU-002 | Every query is executed under the requesting tenant's RLS scope and cannot access another tenant's data. |
| BRU-003 | The ad-hoc query endpoint is read-only and may not insert, update, or delete any table. |
| BRU-004 | An unknown dimension must return `400 UNKNOWN_DIMENSION`; an unknown metric must return `400 UNKNOWN_METRIC`. |
| BRU-005 | The maximum number of returned rows is 1,000; results that exceed the cap must be truncated and flagged. |
| BRU-006 | The per-tenant request rate is limited to 60 per minute by default and must be configurable. |
| BRU-007 | The selected `timeGrain` must be compatible with the chosen dimensions and metrics. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0087 – Preconfigured analytics views (`*DailyCount` tables) | Internal / Prerequisite | Technical Lead | Before Story 10.4 completion |
| D-002 | ADR-0015 – Tenant RLS and `withTenant()` query model | Internal / Existing | Technical Lead | Already in place |
| D-003 | ADR-0044 – Watchlist ownership and tenant-scoped watchlist data | Internal / Existing | Technical Lead | Already in place |
| D-004 | Story 10.3 – Preconfigured analytics views (backend) | Internal / Story | Technical Lead | Before ad-hoc endpoint is fully validated |
| D-005 | Story 10.4 – Ad-hoc query endpoint (backend) | Internal / Story | Technical Lead | Precedes Story 10.5 (UI) |
| D-006 | Story 10.5 – Ad-hoc query UI (frontend) | Internal / Story | Product Owner | After Story 10.4 |

---

- ADR-0087 precomputed analytics views are available for the common daily-count roll-ups.
- Tenant isolation is already enforced via the `withTenant()` RLS model (ADR-0015).
- Users authorized to call the endpoint have an authenticated tenant context.
- The query endpoint is read-only and will not be used for data modification.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Queries must be protected against SQL injection and cross-tenant exfiltration | Security | Must | Penetration/security review finds no vector; all inputs are parameterized |
| NFR-002 | 95% of precomputed-view queries complete in under 5 seconds | Performance | Should | Measured over a 7-day production-like test period |
| NFR-003 | Query runtime must not exceed 30 seconds and must fail gracefully | Reliability | Must | Timeout returns a controlled error without exposing SQL or schema details |
| NFR-004 | Returned result sets must not exceed 1,000 rows | Performance | Must | Any larger result is truncated and `truncated:true` is returned |
| NFR-005 | Requests must be rate-limited to 60 per minute per tenant (configurable) | Scalability | Must | Load test confirms the limit is enforced and over-limit requests are rejected |
| NFR-006 | The query builder UI must be keyboard-accessible and responsive | Usability | Should | WCAG 2.1 keyboard-navigable controls; responsive layout verified |

---

## 11. Error Handling and Exceptions
1. **Analyst power without SQL risk:** users can answer custom questions without direct database access.
2. **Performance guardrails:** the allowlist, time caps, and row limits prevent runaway queries.
3. **Foundation for dashboards:** future dashboard widgets can be built on this endpoint.
4. **Maintenance cost:** every new dimension or metric must be added to the allowlist and query builder.
5. **Not a general query language:** users cannot express arbitrary analytics. The allowlist is intentionally narrow.

---

## 12. Assumptions and Dependencies
- ADR-0087 precomputed analytics views are available for the common daily-count roll-ups.
- Tenant isolation is already enforced via the `withTenant()` RLS model (ADR-0015).
- Users authorized to call the endpoint have an authenticated tenant context.
- The query endpoint is read-only and will not be used for data modification.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | SQL injection or cross-tenant data exfiltration | Low | High | Strict allowlist, parameterized queries only, tenant RLS, contract security tests | Technical Lead |
| R-002 | Runaway queries degrade shared database performance | Medium | High | 30-second timeout, 1,000-row cap, 60 req/min rate limit, query-plan monitoring | Platform-Admin |
| R-003 | Allowlist maintenance burden grows as new dimensions/metrics are requested | Medium | Medium | Gate additions through ADR/BRD updates; keep v1 allowlist intentionally narrow | Product Owner |
| R-004 | Users are frustrated by a narrow allowlist and limited expressiveness | Medium | Medium | Document supported queries clearly; iterate based on usage analytics; keep open questions visible | Product Owner |
| R-005 | Precomputed views are not ready when the endpoint ships | Medium | Medium | Sequence Story 10.3 before Story 10.4; fallback to raw tables is already required | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0088-ad-hoc-query-allowlist.md`
- BRD: `../Business-Requirements/BRD-0088-Ad-Hoc-Query-Allowlist.md`
- Feature design: `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above