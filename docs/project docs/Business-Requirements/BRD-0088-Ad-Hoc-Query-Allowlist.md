# BRD-0088: Ad-hoc Query Allowlist

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Ad-hoc Query Allowlist – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft for review |

> **Note:** ADR-0088 is currently **Proposed**. This BRD is a draft for review and may change if the ADR is revised before acceptance.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0088 and feature design 21-ad-hoc-query-endpoint.md |

---

## 2. Executive Summary

**What problem are we solving?** Tenant business analysts and brand-reputation managers need flexible, server-side aggregations to answer custom questions that the pre-built dashboard does not cover. Today, the platform does not expose a safe way for these users to explore their data, which either limits insight or pushes them toward unsanctioned, high-risk access patterns.

**Who is affected?** The primary beneficiaries are `Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` personas. `Tenant-Admin` and `Topic-Center-Analyst` are secondary users, while the platform team gains a controlled, monitorable analytics surface.

**What is the proposed solution at a glance?** A structured, allowlist-governed `POST /v1/analytics/query` endpoint that translates a JSON query into a safe, parameterized, RLS-scoped aggregation. Users select dimensions, metrics, filters, and a time grain, and receive a JSON or CSV result set without writing SQL or touching raw data.

**What business value do we expect?** Ad-hoc analytical power without SQL-injection or cross-tenant data-exfiltration risk; faster insights from server-side aggregation; exportable results for external reporting; and a reusable foundation for future dashboard widgets.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable tenant analysts to answer custom questions without writing SQL | `Tenant-Business-Analyst` can complete an ad-hoc query end-to-end in the UI or API within one session |
| 2 | Preserve tenant data isolation and prevent injection attacks | No successful cross-tenant query or SQL-injection finding in security review; parameterized queries only |
| 3 | Protect database performance under ad-hoc load | 95% of allowed queries complete within 30 seconds and return no more than 1,000 rows |
| 4 | Create a reusable analytics foundation for future dashboard features | New dashboard widgets can be built on the same endpoint within one subsequent epic |

---

## 4. Scope

### 4.1 In Scope

- A structured query request format with `dimensions`, `metrics`, `filters`, `timeGrain`, `limit`, and `format`.
- A hard-coded allowlist of dimensions (`date`, `platform`, `author`, `topic`, `sentiment`, `watchlist`, `source`) and metrics (`count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, `unique_authors`).
- Validation that rejects unknown dimensions and metrics with a clear `400` error.
- Translation of the structured query into safe, parameterized SQL scoped to the calling tenant.
- JSON and CSV response formats.
- Server-side resource guards: 30-second query timeout, 1,000-row hard cap, 60 requests-per-minute per-tenant rate limit (configurable).
- Use of precomputed daily-count views where the query grain and filters match, with fallback to raw post data for drill-downs.
- Read-only behavior: the endpoint accepts a `POST` body by convention but never writes data.
- Backend support for `hour`, `day`, `week`, and `month` time grains.

### 4.2 Out of Scope

- Arbitrary SQL, free-text query, or general-purpose query language support.
- Saved, named, or shared ad-hoc queries (deferred pending open question resolution).
- Natural-language query builder, AI explanation, or smart suggestions (future enhancements listed in the feature design).
- Real-time streaming or continuous-query execution.
- Client-side, in-browser aggregation over unbounded data sets.

### 4.3 Assumptions

- ADR-0087 precomputed analytics views are available for the common daily-count roll-ups.
- Tenant isolation is already enforced via the `withTenant()` RLS model (ADR-0015).
- Users authorized to call the endpoint have an authenticated tenant context.
- The query endpoint is read-only and will not be used for data modification.

### 4.4 Constraints

- The endpoint must remain self-hosted and avoid third-party BI or SQL engines due to the project's self-funded, single-operator nature.
- Query runtime, row count, and request rate must be capped to protect shared Postgres resources.
- Every new dimension or metric must be explicitly added to the allowlist and query builder, creating ongoing maintenance overhead.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user of ad-hoc queries | High | Build aggregations without SQL; export results for reporting |
| Tenant-Brand-Reputation-Manager | Crisis and one-off investigations | High | Quickly run one-off queries during incidents |
| Topic-Center-Analyst | Explores topic and author dimensions | Medium | Go beyond pre-built views for topic/author analysis |
| Tenant-Admin | Access controller for tenant users | Medium | Decide which roles may use ad-hoc queries |
| Platform-Admin / Sole-Operator | Platform health and cost owner | Medium | Prevent runaway queries and monitor usage |
| Development Team | Builds the query builder and API | High | A bounded, safe contract that is testable and maintainable |

---

## 6. Current State (As-Is)

**Current process:** Tenant analysts currently rely on pre-built dashboard widgets and reports. When those do not answer a specific question, they must either export raw post data and analyze it offline, ask a developer or database administrator for a custom query, or attempt to work around the platform. None of these options are scalable, safe, or self-service.

**Pain points:**
- Pre-built dashboards cannot cover every ad-hoc analytical question.
- Exporting large raw datasets is slow and can expose sensitive or cross-tenant data if not carefully controlled.
- There is no safe, tenant-scoped, server-side aggregation capability for power users.
- Manual or unapproved query access creates security and compliance risk for a multi-tenant platform.

---

## 7. Future State (To-Be)

**New or improved process:** A tenant analyst opens the query builder in the analytics dashboard (or calls the API directly), chooses one or more allowed dimensions, picks metrics, adds optional filters and a time grain, and submits the query. The system validates the request against the allowlist, translates it into a safe SQL query under the tenant's RLS role, executes it with resource guards, and returns a JSON table or CSV file. If the query exceeds the runtime or row cap, the system returns a controlled error. For common daily roll-ups, the system uses precomputed views; otherwise it falls back to raw tables with a size cap.

**Expected capabilities:**
- Self-service ad-hoc aggregation without SQL knowledge.
- Tenant-scoped, parameterized, read-only query execution.
- Fast responses for common daily roll-ups by reusing precomputed views.
- Exportable JSON/CSV results for downstream reporting.
- Clear guardrails and error messages for unsupported or over-limit queries.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall let a tenant user build a structured query with dimensions, metrics, filters, time grain, and output format | Must | API accepts the request shape defined in ADR-0088; UI story 10.5 covers builder controls | Product Owner |
| BR-002 | The system shall validate `dimensions` and `metrics` against a hard-coded allowlist | Must | Unknown dimensions return `400 UNKNOWN_DIMENSION`; unknown metrics return `400 UNKNOWN_METRIC` | Product Owner |
| BR-003 | The system shall execute each query as a parameterized, tenant-scoped, read-only aggregation | Must | Query uses `withTenant()` RLS; no user input is concatenated into SQL; no writes occur | Technical Lead |
| BR-004 | The system shall return query results as JSON or streaming CSV | Must | `format:'json'` returns a columns/rows/metadata payload; `format:'csv'` returns a downloadable stream | Product Owner |
| BR-005 | The system shall prefer precomputed daily-count views and fall back to raw tables for drill-downs | Should | Same query against a precomputed view completes in under 5 seconds and reports `source:'precomputed'` | Technical Lead |
| BR-006 | The system shall support `hour`, `day`, `week`, and `month` time grains for the `date` dimension | Must | Contract tests cover all four grains with valid and invalid combinations | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Queries must be protected against SQL injection and cross-tenant exfiltration | Security | Must | Penetration/security review finds no vector; all inputs are parameterized |
| NFR-002 | 95% of precomputed-view queries complete in under 5 seconds | Performance | Should | Measured over a 7-day production-like test period |
| NFR-003 | Query runtime must not exceed 30 seconds and must fail gracefully | Reliability | Must | Timeout returns a controlled error without exposing SQL or schema details |
| NFR-004 | Returned result sets must not exceed 1,000 rows | Performance | Must | Any larger result is truncated and `truncated:true` is returned |
| NFR-005 | Requests must be rate-limited to 60 per minute per tenant (configurable) | Scalability | Must | Load test confirms the limit is enforced and over-limit requests are rejected |
| NFR-006 | The query builder UI must be keyboard-accessible and responsive | Usability | Should | WCAG 2.1 keyboard-navigable controls; responsive layout verified |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Dimension values | Allowed categorical fields such as `platform`, `source`, `author`, `topic`, `sentiment`, `watchlist`, `date` | `social_posts`, `post_watchlist_matches`, precomputed `*DailyCount` tables | Data Engineering | Tenant-scoped; some contain personal data (author) |
| Metrics | Aggregated values: `count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, `unique_authors` | Computed at query time from `social_posts` or precomputed views | Data Engineering | Tenant-scoped; aggregated only |
| Filter criteria | `dateRange`, `platform`, `author`, `topic`, `sentiment`, `watchlist` values submitted by the user | User input, validated against allowlist | Product Owner | Untrusted input; must be parameterized |
| Query result metadata | `columns`, `rows`, `rowCount`, `truncated`, `queryTimeMs`, `source` | Generated by the endpoint at runtime | Technical Lead | Operational |
| CSV export stream | Streaming result file for download | Generated by the endpoint at runtime | Technical Lead | Tenant-scoped; must not be cached across tenants |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Ad-hoc query volume per tenant | Monitor adoption and enforce rate limits | Platform-Admin / Operations | Hourly / Daily |
| Timeout and error rate by query type | Identify expensive or misused queries | Development / Operations | Daily |
| p95 / p99 query latency | Validate performance guardrails | Product / Operations | Daily |
| Precomputed vs. raw source ratio | Measure effectiveness of roll-up views | Technical Lead | Weekly |
| Top dimensions and metrics used | Guide future allowlist expansion | Product Owner | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | SQL injection or cross-tenant data exfiltration | Low | High | Strict allowlist, parameterized queries only, tenant RLS, contract security tests | Technical Lead |
| R-002 | Runaway queries degrade shared database performance | Medium | High | 30-second timeout, 1,000-row cap, 60 req/min rate limit, query-plan monitoring | Platform-Admin |
| R-003 | Allowlist maintenance burden grows as new dimensions/metrics are requested | Medium | Medium | Gate additions through ADR/BRD updates; keep v1 allowlist intentionally narrow | Product Owner |
| R-004 | Users are frustrated by a narrow allowlist and limited expressiveness | Medium | Medium | Document supported queries clearly; iterate based on usage analytics; keep open questions visible | Product Owner |
| R-005 | Precomputed views are not ready when the endpoint ships | Medium | Medium | Sequence Story 10.3 before Story 10.4; fallback to raw tables is already required | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0087 – Preconfigured analytics views (`*DailyCount` tables) | Internal / Prerequisite | Technical Lead | Before Story 10.4 completion |
| D-002 | ADR-0015 – Tenant RLS and `withTenant()` query model | Internal / Existing | Technical Lead | Already in place |
| D-003 | ADR-0044 – Watchlist ownership and tenant-scoped watchlist data | Internal / Existing | Technical Lead | Already in place |
| D-004 | Story 10.3 – Preconfigured analytics views (backend) | Internal / Story | Technical Lead | Before ad-hoc endpoint is fully validated |
| D-005 | Story 10.4 – Ad-hoc query endpoint (backend) | Internal / Story | Technical Lead | Precedes Story 10.5 (UI) |
| D-006 | Story 10.5 – Ad-hoc query UI (frontend) | Internal / Story | Product Owner | After Story 10.4 |

---

## 14. Acceptance Criteria

- A valid structured query returns an aggregation within 30 seconds, with at most 1,000 rows, and includes `rowCount`, `truncated`, `queryTimeMs`, and `source` metadata.
- Queries that request an unknown `dimension` or `metric` return a `400` error with `UNKNOWN_DIMENSION` or `UNKNOWN_METRIC` and no data.
- A query scoped to one tenant cannot return data belonging to another tenant.
- Both `json` and `csv` output formats are supported and correctly encoded.
- Queries exceeding the runtime cap return a clear timeout error without exposing internal SQL, schema, or raw table names.
- When the query grain and filters match a precomputed view, the endpoint uses that view and reports `source:'precomputed'`; otherwise it falls back safely and reports `source:'raw'`.
- The endpoint is read-only: no query can modify `social_posts`, `post_watchlist_matches`, or any other table.
- Per-tenant rate limiting of 60 requests per minute is enforced.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Ad-hoc query | A user-defined, one-off aggregation request that is not provided by a pre-built dashboard widget. |
| Allowlist | The explicit set of allowed `dimensions`, `metrics`, and `timeGrain` values accepted by the endpoint. |
| Time grain | The level of date grouping for an aggregation: `hour`, `day`, `week`, or `month`. |
| Precomputed view | A materialized or persisted daily-count roll-up table (e.g., `TopicDailyCount`) used to speed up common queries. |
| Parameterized query | A SQL query in which user inputs are bound as parameters, not concatenated as text, preventing injection. |
| RLS | Row-level security; the database mechanism that enforces tenant isolation per query. |
| Drill-down | A query that requires raw post-level data rather than a precomputed aggregate. |

---

## 16. Appendices

### 16.1 Source Documents

- [ADR-0088: Ad-hoc query allowlist](../adr/0088-ad-hoc-query-allowlist.md)
- [Feature design: 21-ad-hoc-query-endpoint.md](../product-research/feature-designs/21-ad-hoc-query-endpoint.md)
- [Feature-ADR scoping document](../product-research/feature-adr-scoping.md) (referenced by ADR-0088, not read for this draft)

### 16.2 Related ADRs

- ADR-0087 – Preconfigured analytics views
- ADR-0015 – Tenant RLS
- ADR-0044 – Watchlist ownership

### 16.3 Related User Stories

- [Epic 10: Analytics, operations, and trust (ADRs 0086–0094)](../user-stories/epic-10-adr-0086-to-0094.md)
  - **Story 10.4** — Ad-hoc query endpoint (backend)
  - **Story 10.5** — Ad-hoc query UI (frontend)

### 16.4 Missing Source Note

No deep-research brief (`docs/product-research/reports/<feature>-deep-research.md`) was found for this feature. The appendices will be updated if one is produced.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
