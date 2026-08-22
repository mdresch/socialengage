---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Ad-hoc query endpoint

### What it is

A tenant-scoped server-side query endpoint that allows Tenant-Business-Analysts to run structured aggregations over their own social-post and enrichment data. It exposes `GROUP BY`, time-bucketed counts, and simple expressions without requiring direct database access.

### End-user benefits

- **Analytical power:** users can answer questions the dashboard does not pre-build.
- **Data safety:** analysts never need credentials or raw SQL; RLS enforces scope.
- **Exportable results:** query results can be downloaded as CSV/JSON for reports and external tools.
- **Faster insights:** server-side aggregation avoids loading large datasets into the browser.

### Core details

- Endpoint: `POST /v1/analytics/query` accepts a JSON query with `dimensions`, `metrics`, `filters`, and `time_grain` (`hour`, `day`, `week`, `month`).
- Allowed dimensions: `platform`, `source`, `author_id`, `topic`, `sentiment`, `watchlist_id`, `location`, `date`.
- Allowed metrics: `count`, `sum(reach)`, `sum(engagement)`, `avg(sentiment_score)`, `unique_authors`.
- Results are tenant-scoped and paginated.
- Query execution is read-only and subject to rate limits and timeouts to protect the database.
- Reuses existing `social_posts` and `post_watchlist_matches` tables.

### Implementation complexity

**Medium-to-high.** Requires a safe query parser/validator, a builder that translates JSON to SQL, and guardrails against expensive queries. The heavy part is security and performance, not the UI.

### Growth and reach

A power-user and enterprise feature. Distinguishes the platform from basic dashboards and supports the Tenant-Business-Analyst persona directly.

---

## Technical design

- **Data flow:** user builds a query in the UI or API → `POST /v1/analytics/query` validates the query against an allowlist of dimensions and metrics → `AdHocQueryService` generates parameterized SQL → executes under the tenant RLS role → returns rows and metadata.
- **Component interactions:** `AdHocQueryBuilder` → `AdHocQueryService` → `withTenant()` read path → `social_posts` / `post_watchlist_matches` / `author_topic_signals`.
- **REST/Service Bus contracts:** `POST /v1/analytics/query`, `GET /v1/analytics/query/:id` (for async long-running queries), `POST /v1/analytics/query/:id/export`.
- **Storage:** `ad_hoc_queries` table to store query definitions and async results; results written to Blob for large payloads.
- **Security considerations:** Strict allowlist of dimensions/metrics. Parameterized queries only. Read-only. Timeout and row limits enforced. Tenant RLS prevents cross-tenant access.

## Backend principles

- **Allowlist, not arbitrary SQL.** The endpoint accepts a structured query, not free SQL, to prevent injection and exfiltration.
- **Read-only and scoped.** It cannot modify data and is always filtered by `tenant_id`.
- **Resource-guarded.** Queries are capped by runtime, row count, and rate per tenant/user.
- **Pre-aggregated where possible.** Use existing `AuthorTopicSignal` and, in v2, `TopicDailyCount` roll-ups for common dimensions.

## Frontend / UI principles

- **User flow:** analyst opens query builder → selects dimensions, metrics, filters, and time grain → runs query → sees a table or chart → exports results.
- **Component hierarchy:** `AdHocQueryBuilder` → `DimensionPicker`, `MetricPicker`, `FilterBuilder`, `QueryResultTable`, `QueryChart`.
- **State management:** Server state for query results; local state for the query draft.
- **Accessibility and responsive design:** Drag-and-drop or dropdown builders; results table has sortable, keyboard-accessible headers.

## Open questions

- Should the endpoint support time-series charts, pivot tables, or just flat rows?
- How do we prevent users from writing queries that are too expensive? (timeout, row limit, query plan estimate)
- Should saved queries be a separate feature, or part of the dashboard?
- Which exact dimensions and metrics ship in v1?
- Should the endpoint be exposed to all `tenant_user` roles or only `tenant_admin` and analyst users?

## AI enhancements

- **Natural-language query builder:** the user types a question, and the AI returns the matching query.
- **Query explanation:** the AI describes what the query will compute before it runs.
- **Smart suggestions:** the AI recommends dimensions and filters based on the user's role and history.

## Persona acceptance

- **Tenant-Business-Analyst (primary):** can build a server-side aggregation query and export results without writing SQL.
- **Tenant-Brand-Reputation-Manager (secondary):** can run one-off investigations during a crisis.
- **Topic-Center-Analyst (secondary):** can explore topic and author dimensions beyond the pre-built views.
- **Tenant-Admin (secondary):** can control which roles have access to ad-hoc queries.
