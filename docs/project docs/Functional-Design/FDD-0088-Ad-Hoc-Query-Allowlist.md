# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0088 Ad-Hoc Query Allowlist — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Approved |
| Related Documents | ADR-0088 (Accepted 2026-08-28) (ad-hoc query allowlist), ADR-0087 (preconfigured analytics views), ADR-0015 (tenant RLS), ADR-0044 (watchlist ownership), BRD-0088, `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md`, Stories 10.4 and 10.5 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0088 (Accepted 2026-08-28)'s decision — a structured, allowlist-validated `POST /v1/analytics/query` endpoint that safely translates a JSON query DSL into a parameterized, tenant-scoped aggregation, plus its consuming UI query builder — into a functional design covering validation, query building, resource guards, response shape, and UI behavior.

**Note:** ADR-0088 (Accepted 2026-08-28)'s Status is **Proposed**, not Accepted. This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:** the structured query request shape (`dimensions`, `metrics`, `filters`, `timeGrain`, `limit`, `format`); allowlist validation of dimensions/metrics; the `QueryBuilder`'s safe SQL translation and tenant scoping; preference for precomputed `*DailyCount` views with fallback to `social_posts`; response shape (`columns`, `rows`, `rowCount`, `truncated`, `queryTimeMs`, `source`); resource guards (30s timeout, 1000-row cap, 60 req/min per-tenant rate limit); JSON/CSV output; read-only enforcement; the `AdHocQueryBuilder` UI.
- **Out of scope:** arbitrary SQL or a general-purpose query language; saved/named/shared queries (deferred pending an open question); natural-language query building, AI explanation, or smart suggestions; real-time/continuous query execution; client-side aggregation over unbounded data.

### 2.3 Target Audience

Backend engineers implementing the query builder and endpoint, frontend engineers implementing the query-builder UI, QA authoring security/contract tests for injection and cross-tenant isolation, and the Product Owner.

---

## 3. Context and Background

`Tenant-Business-Analyst` and `Tenant-Brand-Reputation-Manager` need flexible, server-side aggregation to answer questions the pre-built dashboard does not cover — but the platform must never accept arbitrary SQL, which would open SQL-injection and cross-tenant-exfiltration risk in a multi-tenant system built around RLS-first isolation (ADR-0015). ADR-0088 (Accepted 2026-08-28) answers this with a narrow, structured JSON DSL that is validated against a hard-coded allowlist and translated into safe, parameterized SQL — never string concatenation of user input. It builds directly on ADR-0087's precomputed `*DailyCount` tables, preferring them when the requested grain/filters match and falling back to `social_posts` (with guards) only for drill-downs.

Source requirements: ADR-0088 (Accepted 2026-08-28), BRD-0088, Stories 10.4 (backend) and 10.5 (frontend) in `docs/user-stories/epic-10-adr-0086-to-0094.md`. Depends on ADR-0087 (Story 10.3) for the precomputed views it prefers.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Give analysts custom-question power without SQL access | A tenant user can express a `dimensions`/`metrics`/`filters` query and get a result without writing SQL |
| G2 | Eliminate SQL-injection and cross-tenant exfiltration risk | Every query is parameterized and RLS-scoped; no user input reaches SQL as text |
| G3 | Protect shared database performance under ad-hoc load | Runtime capped at 30s, rows capped at 1000, rate-limited to 60 req/min per tenant |
| G4 | Reuse the precomputed-view investment (ADR-0087) | Queries matching a `*DailyCount` view's grain/filters resolve from it, reported as `source:'precomputed'` |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Structured Query Request and Allowlist Validation

- **Description:** Accepts a JSON query DSL and validates every field against a hard-coded allowlist before any query executes.
- **Triggers:** `POST /v1/analytics/query` is called with a request body.
- **Inputs:**
  ```ts
  {
    dimensions: ('date'|'platform'|'author'|'topic'|'sentiment'|'watchlist'|'source')[],
    metrics: ({type:'count'} | {type:'sum',field:'reach'|'engagement'} |
              {type:'avg',field:'sentiment_score'} | {type:'unique',field:'author'})[],
    filters?: { dateRange?: {start,end}, platform?, author?, topic?, sentiment?, watchlist? },
    timeGrain?: 'hour'|'day'|'week'|'month',
    limit?: number,   // default 100, hard cap 1000
    format?: 'json'|'csv'
  }
  ```
- **Processing:**
  - Every `dimensions` entry is checked against the fixed allowlist; any value not on it is rejected before query construction begins.
  - Every `metrics` entry's `type` (and, where applicable, `field`) is checked against the fixed allowlist.
  - `timeGrain`, if present, must be compatible with the chosen dimensions (e.g., a `date` dimension is required for a `timeGrain` to be meaningful).
  - `limit` defaults to 100; values above 1000 are rejected or clamped.
  - `format` defaults to `json` when omitted.
- **Outputs:** A validated, allowlist-conformant query object passed to the `QueryBuilder` (Section 5.2), or a `400` validation error.
- **Error handling:** An unknown `dimensions` value returns `400 UNKNOWN_DIMENSION`. An unknown `metrics` type/field returns `400 UNKNOWN_METRIC`. An incompatible `timeGrain`/dimension combination returns a distinct validation error.
- **Edge cases:** An empty `dimensions` array (metrics-only, e.g., a single overall `count`) must be explicitly handled as valid or rejected — a consistent, documented choice. A `filters.dateRange` with `start` after `end` is invalid.

### 5.2 Feature / Capability: Safe Query Translation (`QueryBuilder`)

- **Description:** Translates a validated structured query into a parameterized, tenant-scoped SQL `SELECT`, never concatenating user input into SQL text.
- **Triggers:** Called after successful allowlist validation (Section 5.1).
- **Inputs:** The validated query object; the caller's `tenant_id`.
- **Processing:**
  - Wraps the query with `withTenant()` (ADR-0015) so the resulting SQL is RLS-scoped to the caller's tenant.
  - All filter/dimension/metric values are bound as query parameters, never interpolated into the SQL string.
  - Determines whether the requested `dimensions`/`metrics`/`filters`/`timeGrain` combination matches a precomputed `*DailyCount` table's grain (ADR-0087); if so, builds the query against that table.
  - Otherwise, falls back to querying `social_posts` (and related tables, e.g., `post_watchlist_matches`) directly, bounded by the row/time guards in Section 5.4.
- **Outputs:** A parameterized SQL statement (and its parameter values) ready for execution; a `source` classification (`precomputed` or `raw`).
- **Error handling:** A combination that cannot be satisfied by either a precomputed view or a safe raw-table query (e.g., an unsupported dimension/metric pairing not caught by the allowlist alone) is rejected with a clear error before execution.
- **Edge cases:** A query that mixes dimensions spanning multiple precomputed tables (e.g., `topic` + `platform` together) may not correspond to any single `*DailyCount` table — this is explicitly called out as an open question (Q2) and must fall back to `social_posts` or be rejected, not silently produce an incorrect join.

### 5.3 Feature / Capability: Read-Only, Rate-Limited Execution

- **Description:** Executes the built query with resource guards and enforces strict read-only behavior.
- **Triggers:** After `QueryBuilder` produces a safe query.
- **Inputs:** The parameterized SQL/parameters; per-tenant current rate-limit usage.
- **Processing:**
  - Checks the caller's tenant against the per-tenant rate limit (default 60 requests/minute, configurable); rejects before executing if exceeded.
  - Executes the query with a maximum runtime of 30 seconds; a query exceeding this is aborted.
  - Caps the returned row count at 1000 (or the caller's smaller `limit`); if the underlying result would exceed this, the response is truncated and flagged.
  - The query is verified/guaranteed read-only — it can never `INSERT`/`UPDATE`/`DELETE` any table, by construction of the `QueryBuilder` (SELECT-only) rather than by a runtime permission check alone.
- **Outputs:** A result set within the row/time bounds, or a controlled timeout/rate-limit error.
- **Error handling:** A timeout returns a clear error without exposing internal SQL, schema, or raw table names. A rate-limit violation returns a distinct `429`-class error.
- **Edge cases:** A query that would return exactly the row cap (1000) is not marked truncated unless strictly more rows exist. Two rate-limit-adjacent requests arriving concurrently must not both bypass the limit due to a race.

### 5.4 Feature / Capability: Response Shape and Output Format

- **Description:** Returns results as JSON or a streaming CSV, always with execution metadata.
- **Triggers:** Query execution (Section 5.3) completes successfully.
- **Inputs:** The executed query's result rows; execution timing; the `source` classification; the requested `format`.
- **Processing:**
  - `format: 'json'` (default) returns `{ columns, rows, rowCount, truncated, queryTimeMs, source }`.
  - `format: 'csv'` streams the same data as a downloadable CSV rather than buffering the full result in memory.
  - `source` is `'precomputed'` when the query resolved from a `*DailyCount` table, `'raw'` when it fell back to `social_posts`.
- **Outputs:** A JSON payload or a CSV stream.
- **Error handling:** An unsupported `format` value is rejected during validation (Section 5.1), not at response-building time.
- **Edge cases:** A zero-row result still returns valid `columns`/empty `rows`/`rowCount: 0`, not an error. CSV output must correctly escape values containing commas, quotes, or newlines.

### 5.5 Feature / Capability: `AdHocQueryBuilder` UI

- **Description:** A query-builder UI in the analytics dashboard that lets a user pick dimensions, metrics, filters, and time grain, and view/export results.
- **Triggers:** User navigates to the ad-hoc query section of the dashboard.
- **Inputs:** User selections for dimensions, metrics, filters, and time grain.
- **Processing:**
  - Offers only the allowlisted dimension/metric/time-grain options (mirroring the backend allowlist) so the user cannot construct an invalid request client-side.
  - Enforces the same limits/caps as the backend (row cap, rate-limit awareness) so the UI does not encourage requests it knows will be rejected.
  - Submits the structured query to `POST /v1/analytics/query`; renders results as a table, or triggers a CSV download.
- **Outputs:** A rendered results table, or a downloaded CSV file.
- **Error handling:** Errors (`UNKNOWN_DIMENSION`, `UNKNOWN_METRIC`, timeout, rate limit) are shown inline within the query builder, not as a full-page failure.
- **Edge cases:** A user changing dimensions after selecting an incompatible `timeGrain` should have the UI reconcile or warn about the mismatch before submission, mirroring backend validation client-side where feasible.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| `Tenant-Business-Analyst` | Primary end user of ad-hoc queries |
| `Tenant-Brand-Reputation-Manager` | Runs one-off queries during incidents/investigations |
| `Topic-Center-Analyst` | Explores topic/author dimensions beyond pre-built views |
| `Tenant-Admin` | Controls which roles may use ad-hoc queries |
| Platform-Admin / Sole-Operator | Monitors usage, rate limits, and performance |
| Backend Engineer | Implements the allowlist, `QueryBuilder`, and endpoint |
| Frontend Engineer | Implements `AdHocQueryBuilder` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 10.4) | Backend engineer | Have `POST /v1/analytics/query` accept a structured, allowlisted query and return a safe aggregation | `Tenant-Business-Analyst` can ask custom questions without writing SQL | Dimensions/metrics validated against allowlist; `QueryBuilder` produces parameterized, tenant-scoped SQL; `timeGrain` supports hour/day/week/month; `limit` capped at 1000, runtime capped at 30s; prefers `*DailyCount`, falls back to `social_posts`; unknown values return `400`; `json`/`csv` supported; read-only; response includes `columns`/`rows`/`rowCount`/`truncated`/`queryTimeMs`/`source`; rate limit 60/min per tenant; contract tests cover allowed/disallowed/timeout |
| US2 (Story 10.5) | `Tenant-Business-Analyst` | Have a query builder in the analytics dashboard to pick dimensions/metrics and export results | Explore data without SQL | `AdHocQueryBuilder` supports dimension/metric/filter/time-grain selection; results shown in a table or downloaded as CSV; errors (unknown dimension, timeout) shown inline; UI enforces the same limits/caps as the backend |

### 6.3 Workflow Diagrams / Steps

**Backend query flow:**
1. Client submits `POST /v1/analytics/query` with a structured query.
2. Server validates `dimensions`/`metrics`/`timeGrain`/`limit`/`format` against the allowlist; rejects with `400 UNKNOWN_DIMENSION`/`400 UNKNOWN_METRIC` on failure.
3. Server checks the tenant's rate-limit usage; rejects if exceeded.
4. `QueryBuilder` determines whether the request matches a precomputed `*DailyCount` grain/filter combination; builds a parameterized, `withTenant()`-scoped SQL statement accordingly (precomputed or raw fallback).
5. Server executes with a 30-second timeout and a 1000-row cap.
6. Server returns `{ columns, rows, rowCount, truncated, queryTimeMs, source }` as JSON, or streams CSV.

**UI query-builder flow:**
1. User opens `AdHocQueryBuilder`, selects dimensions/metrics/filters/time grain from allowlisted options.
2. User submits → the UI calls `POST /v1/analytics/query`.
3. On success, results render in a table or download as CSV.
4. On error, an inline message explains the failure (unknown selection, timeout, rate limit).

---

## 7. Data Requirements

### 7.1 Data Inputs

User-selected `dimensions`, `metrics`, `filters`, `timeGrain`, `limit`, `format`; the caller's authenticated `tenant_id`; source data from `social_posts`, `post_watchlist_matches`, and the `*DailyCount` tables (ADR-0087).

### 7.2 Data Outputs

Query result rows (`columns`/`rows`/`rowCount`/`truncated`/`queryTimeMs`/`source`); CSV export streams; rendered UI table.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `AdHocQueryRequest` | `dimensions[]`, `metrics[]`, `filters?`, `timeGrain?`, `limit` (default 100, max 1000), `format` (default `json`) | Validated against the allowlist; translated by `QueryBuilder` |
| Allowlist (dimensions) | `date`, `platform`, `author`, `topic`, `sentiment`, `watchlist`, `source` | Fixed set; extending requires an ADR/BRD update |
| Allowlist (metrics) | `count`; `sum(reach\|engagement)`; `avg(sentiment_score)`; `unique(author)` | Fixed set; extending requires an ADR/BRD update |
| `AdHocQueryResponse` | `columns[]`, `rows[]` (`Record<string, string\|number>`), `rowCount`, `truncated`, `queryTimeMs`, `source` (`precomputed`\|`raw`) | Returned per request; `source` reflects whether `*DailyCount` or `social_posts` served the query |
| Per-tenant rate-limit state | `tenant_id`, request count, window | Consulted/incremented on every request |

### 7.4 Validation Rules

- `dimensions` values must be members of the fixed allowlist; unknown values → `400 UNKNOWN_DIMENSION`.
- `metrics` entries must be one of the allowlisted `{type, field?}` shapes; unknown → `400 UNKNOWN_METRIC`.
- `timeGrain` must be compatible with the chosen dimensions.
- `limit` defaults to 100; values above 1000 are rejected or clamped.
- `filters.dateRange.start` must not be after `end`.
- `format` must be `json` or `csv`.
- The generated SQL must never contain unparameterized user input.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Only allowlisted `dimensions`/`metrics` combinations may be accepted. | Request validation |
| BR2 | Every query executes under the requesting tenant's RLS scope and cannot access another tenant's data. | `QueryBuilder` |
| BR3 | The endpoint is read-only and may not insert, update, or delete any table. | Execution |
| BR4 | An unknown dimension returns `400 UNKNOWN_DIMENSION`; an unknown metric returns `400 UNKNOWN_METRIC`. | Validation |
| BR5 | The maximum number of returned rows is 1000; results exceeding the cap are truncated and flagged (`truncated: true`). | Execution/response |
| BR6 | The per-tenant request rate is limited to 60/minute by default and is configurable. | Rate limiting |
| BR7 | The selected `timeGrain` must be compatible with the chosen dimensions and metrics. | Validation |
| BR8 | The query prefers a precomputed `*DailyCount` table when the grain/filters match; otherwise falls back to `social_posts` with guards. | `QueryBuilder` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `*DailyCount` tables (ADR-0087) | Inbound (read) | Preferred data source when grain/filters match | SQL (Postgres, RLS-scoped) |
| `social_posts` / `post_watchlist_matches` | Inbound (read) | Fallback data source for drill-downs | SQL (Postgres, RLS-scoped) |
| `withTenant()` (ADR-0015) | Wraps all queries | Enforces tenant RLS scoping | Internal query helper |
| `AdHocQueryBuilder` (UI) | Inbound (consumer) | Calls the endpoint on the user's behalf | REST / JSON over HTTPS |
| Per-tenant rate limiter | Bidirectional | Reads/increments request counts | Internal service |

---

## 10. Non-Functional Considerations

- **Security:** Queries are protected against SQL injection and cross-tenant exfiltration — parameterized inputs only, RLS-scoped execution (NFR-001).
- **Performance:** 95% of precomputed-view queries complete under 5 seconds (NFR-002); overall runtime is hard-capped at 30 seconds and fails gracefully on timeout (NFR-003).
- **Result size:** Returned result sets never exceed 1000 rows; larger results are truncated with `truncated:true` (NFR-004).
- **Scalability:** Requests are rate-limited to 60/minute per tenant by default, configurable (NFR-005).
- **Usability/Accessibility:** The query-builder UI is keyboard-accessible and responsive (NFR-006).
- **Maintainability:** Every new dimension or metric requires an explicit allowlist and `QueryBuilder` update — an intentional, documented maintenance cost, not an oversight.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Unknown `dimensions` value | `400 UNKNOWN_DIMENSION` | Request rejected before query construction |
| Unknown `metrics` type/field | `400 UNKNOWN_METRIC` | Request rejected before query construction |
| Incompatible `timeGrain`/dimension combination | Validation error (400) | Request rejected |
| Query exceeds 30-second runtime | Controlled timeout error, no internal SQL/schema exposed | Query aborted server-side |
| Result would exceed 1000 rows | N/A (not an error) | Response returned with `truncated: true` |
| Per-tenant rate limit exceeded | Rate-limit error (429-class) | Request rejected before execution |
| Query mixes dimensions spanning multiple/no matching precomputed table | Validation error, or safe raw fallback (implementation choice, must be documented) | No incorrect join is ever silently produced |

---

## 12. Assumptions and Dependencies

- ADR-0087 precomputed analytics views (`*DailyCount` tables) are available for common daily roll-ups (Story 10.3 precedes Story 10.4).
- Tenant isolation is already enforced via `withTenant()` (ADR-0015).
- Callers have an authenticated tenant context.
- The endpoint is read-only and will never be used for data modification.
- Depends on ADR-0088 (Accepted 2026-08-28) being accepted before Stories 10.4/10.5 are implemented; Story 10.5 depends on Story 10.4.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the `date` dimension support `hour` grain in v1, or only `day`/`week`/`month`? | Technical Lead | Before implementation |
| Q2 | How should the endpoint handle a query that mixes dimensions not sharing a single precomputed view? | Technical Lead | Before implementation |
| Q3 | Should users be able to save and share ad-hoc queries as named views? | Product Owner | Post-v1 candidate |
| Q4 | What is the right rate-limit and row-cap for free vs. paid tiers? | Product Owner | Before implementation |

---

## 14. Appendix

- **ADR:** `docs/adr/0088-ad-hoc-query-allowlist.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0088-Ad-Hoc-Query-Allowlist.md`
- **Feature design:** `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0087 (preconfigured analytics views), ADR-0015 (tenant RLS), ADR-0044 (watchlist ownership)
- **User stories:** Story 10.4 (backend), Story 10.5 (frontend) in `docs/user-stories/epic-10-adr-0086-to-0094.md` — Blocked, pending ADR acceptance
- **Glossary:**
  - *Ad-hoc query* — a user-defined, one-off aggregation request not covered by a pre-built dashboard widget.
  - *Allowlist* — the explicit set of allowed `dimensions`, `metrics`, and `timeGrain` values.
  - *Time grain* — the level of date grouping (`hour`/`day`/`week`/`month`).
  - *Drill-down* — a query requiring raw post-level data rather than a precomputed aggregate.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0088 (Accepted 2026-08-28)/BRD-0088.
