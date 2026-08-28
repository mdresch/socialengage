# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0105 Dashboards and Analytics Widget Contracts — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0105, BRD-0105, feature design 08) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0105 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0105, BRD-0105, `docs/product-research/feature-designs/08-dashboards-and-analytics.md`, Story 12.9, Story 12.10, ADR-0087, ADR-0078, ADR-0104 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0105 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the contract below may still change before acceptance.

The Analytics Dashboard (Epic 8) already ships, but each widget was hand-built with its own data shape and client-side aggregation, so adding a widget means touching both backend fetching and frontend rendering, and large date ranges degrade client-side performance. This document defines the functional behavior of a single, typed widget contract: the `GET /v1/analytics/dashboard` endpoint, the six per-widget data shapes, the backend `WidgetRegistry`/`WidgetDataProvider` pattern, filter propagation rules, precomputed-vs-fallback query routing, and the frontend `WidgetRenderer` hierarchy that maps `widget.type` to a generic renderer.

### 2.2 Scope

**In scope:**
- `GET /v1/analytics/dashboard` request/response contract (`watchlistId`, `selectedTopic`, `timeRange`, `granularity` in; `widgets[]` and `filters` out).
- The six typed `WidgetData` shapes: `metric`, `time-series`, `bar`, `pie`, `list`, `table`.
- Backend `WidgetRegistry` mapping `widgetId` to a `WidgetDataProvider`.
- Filter semantics for `watchlistId`, `selectedTopic` (ADR-0104), `timeRange`, `granularity`, including the "unsupported filter returns null" rule.
- Query routing: prefer `*DailyCount` (ADR-0087) tables; fall back to `social_posts` only for the current partial day.
- Optional metric `explanation` via `POST /v1/explain` (ADR-0078).
- Frontend `WidgetRenderer` component hierarchy (`DashboardView` → `FilterBar` → `WidgetGrid` → typed renderers) and deep-link encoding of filter state.

**Out of scope:**
- Publicly shareable (non-tenant-authenticated) dashboard links.
- Persistent per-user dashboard layout (`user_dashboard_layout` — open question).
- A `widgets` allowlist / per-request widget subset (open question).
- New v2 widget types (Share of Voice, Top Influencers, Engagement Rate) beyond the contract needed to support future ones.
- Geospatial/Location widgets (reaffirmed out of scope per ADR-0054/0055).
- New precomputed aggregate tables beyond the existing `*DailyCount` design.

### 2.3 Target Audience

Backend engineers implementing the `WidgetRegistry`/providers (Story 12.9), frontend engineers implementing `WidgetRenderer` (Story 12.10), QA authoring RLS/filter contract tests, and the Product Owner validating widget shapes against dashboard needs.

---

## 3. Context and Background

Epic 8 (Stories 8.1–8.6) already shipped Overview/Sentiment/Conversations/Sources/Language dashboard views, built as client-side aggregations over `GET /v1/posts` and `enrichment`, each widget owning its own transformation and rendering logic. This works for a v1 but does not scale: widget shapes are inconsistent, there's no generic `widget.type → renderer` mapping, filter propagation is ad hoc, and client-side aggregation over large date ranges is slow. ADR-0087's `*DailyCount` precomputed tables and ADR-0104's `selectedTopic` filter both need a stable contract point to plug into; ADR-0078's `POST /v1/explain` needs a place to surface `explanation` text on metric widgets.

This design formalizes what already works in Epic 8 into a typed, versioned contract so future widgets are additive (a new provider + a new renderer) rather than requiring endpoint changes.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Standardize the widget contract | New widget types are added via a registered `WidgetDataProvider` and renderer, with no change to `GET /v1/analytics/dashboard` itself |
| G2 | Improve dashboard performance at scale | p99 dashboard load under 500 ms for pre-aggregated historical views |
| G3 | Consistent, shareable filtering | Deep links restore `watchlistId`, `selectedTopic`, `timeRange`, and all compatible widgets update accordingly |
| G4 | Built-in explainability | Metric widgets can surface a plain-language `explanation` with a confidence indicator when the user opts in |
| G5 | Preserve tenant isolation | All widget data remains scoped by tenant RLS and the user's watchlist/provider permissions |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `GET /v1/analytics/dashboard` contract

- **Description:** The single endpoint the dashboard UI calls to retrieve all widgets for the current filter state.
- **Triggers:** `DashboardView` loads, or the user changes a filter (`watchlistId`, `selectedTopic`, `timeRange`, `granularity`).
- **Inputs:** Optional `watchlistId`, `selectedTopic`, `timeRange` (`{ start, end }` ISO strings), `granularity` (`hour`/`day`/`week`/`month`).
- **Processing:** The endpoint resolves the caller's tenant/user context, iterates the `WidgetRegistry` (5.3) to build the `widgets[]` array, and separately computes the `filters` object (available `watchlists`, `topics`, `availableTimeRanges`) for populating `FilterBar` controls.
- **Outputs:** `{ widgets: Array<{ id, type, title, data }>; filters: { watchlists, topics, availableTimeRanges } }`.
- **Error handling:** An invalid `timeRange` (end before start) or unknown `granularity` value is rejected with a validation error before any provider is invoked. A `watchlistId`/`selectedTopic` the caller cannot access is treated as not found (no cross-tenant/cross-permission disclosure).
- **Edge cases:** No filters supplied returns the tenant's default (unfiltered, default time range) view.

### 5.2 Feature / Capability: Per-widget data shapes

- **Description:** Defines the six discriminated-union `WidgetData` shapes every provider must emit, so the frontend can render generically by `type`.
- **Triggers:** Emitted by each `WidgetDataProvider` as part of building the `GET /v1/analytics/dashboard` response.
- **Inputs:** Provider-specific query results (aggregate counts, series, breakdowns).
- **Processing:** Each provider maps its query result into exactly one of: `metric` (`value`, optional `previousValue`, optional `explanation`), `time-series` (`labels[]`, `series: [{ name, data[] }]`), `bar` (`labels[]`, `data[]`), `pie` (`segments: [{ label, value, color? }]`), `list` (`items: [{ label, value, url? }]`), `table` (`columns[]`, `rows[]`).
- **Outputs:** A `widget.data` value strictly matching one of the six shapes; the frontend never receives an undocumented seventh shape.
- **Error handling:** A provider that cannot produce valid data for its declared shape (e.g., empty result set) still returns a well-formed, empty instance of that shape (e.g., `{ type: 'metric', value: 0 }`), not a null/undefined `data`.
- **Edge cases:** A `metric` widget with no prior-period comparison omits `previousValue` rather than sending a placeholder zero that could be misread as an actual prior value.

### 5.3 Feature / Capability: `WidgetRegistry` / `WidgetDataProvider`

- **Description:** The backend extensibility mechanism that lets new widgets be added without modifying the main endpoint.
- **Triggers:** Invoked once per registered widget on every `GET /v1/analytics/dashboard` call.
- **Inputs:** The resolved request filters (`watchlistId`, `selectedTopic`, `timeRange`, `granularity`) and the caller's tenant/permission context.
- **Processing:** Each `WidgetDataProvider` declares which filter dimensions it supports and which aggregate view or query it uses (5.5). The registry invokes every applicable provider (or an allowlisted subset, pending Q1) and assembles their outputs into `widgets[]`.
- **Outputs:** One `widgets[]` entry per registered, applicable provider.
- **Error handling:** A single provider's failure (e.g., a query timeout) must not fail the whole dashboard response; that widget can be omitted or returned in an error/empty state while other widgets still render.
- **Edge cases:** Registering two providers with the same `widgetId` is a configuration error caught at startup/registration time, not at request time.

### 5.4 Feature / Capability: Filter propagation semantics

- **Description:** Defines how `watchlistId`, `selectedTopic`, `timeRange`, and `granularity` affect each widget.
- **Triggers:** Any active filter on a `GET /v1/analytics/dashboard` request.
- **Inputs:** The filter values from 5.1.
- **Processing:**
  - `watchlistId` restricts every widget to posts matching that watchlist (BRU-001).
  - `selectedTopic` restricts every widget to posts associated (via `post_topics`, ADR-0104) with that topic (BRU-002).
  - `timeRange`/`granularity` are honored only where the underlying data has a `date`/`published_at` dimension (BRU-003).
  - A widget whose data has no dimension matching an active filter returns `null` for that specific filter's effect rather than raising an error (BRU-004) — the widget still renders, just without that filter applied.
- **Outputs:** Filtered widget data consistent with all filters the widget supports; explicit `null` markers for unsupported filters (used by the frontend to show "filter not applicable" state if desired).
- **Error handling:** N/A beyond 5.1's validation — filter *application* never errors, only filter *parsing* can.
- **Edge cases:** `selectedTopic` referencing a merged topic (ADR-0104) resolves to the merge target's data, consistent with ADR-0104 §6's merge semantics.

### 5.5 Feature / Capability: Query routing (precomputed vs. fallback)

- **Description:** Determines whether a widget's data comes from a fast precomputed aggregate or a live query over raw posts.
- **Triggers:** Every widget data fetch.
- **Inputs:** The requested `timeRange` and the availability/freshness of the relevant `*DailyCount` table (ADR-0087).
- **Processing:** Widgets prefer `*DailyCount` tables for historical aggregation. Only the current, not-yet-fully-aggregated partial day may fall back to a live `social_posts` query; the fallback query window is kept small (capped) to bound latency (mitigation for R-002).
- **Outputs:** Widget data that is a seamless blend of precomputed history plus (for the current day only) live data, indistinguishable in shape to the consumer.
- **Error handling:** If the `*DailyCount` table has not yet been refreshed for a requested historical date, that gap is also covered by the live-query fallback rather than showing missing data.
- **Edge cases:** A `timeRange` spanning both historical and current-day data must merge both sources into one continuous series without a visible seam or double-count at the boundary.

### 5.6 Feature / Capability: Metric explainability integration

- **Description:** Lets a `metric` widget surface a plain-language explanation of its value/change.
- **Triggers:** The user enables explainability (an opt-in setting or per-widget action).
- **Inputs:** The metric widget's underlying value/previousValue and its query context.
- **Processing:** The provider calls `POST /v1/explain` (ADR-0078) and attaches the result as `explanation` on the `metric` widget's data.
- **Outputs:** `widget.data.explanation` (plain-language text) alongside the numeric value; per ADR-0078/BRU-006 the explanation must surface a confidence indicator.
- **Error handling:** If `POST /v1/explain` fails or times out, the metric widget still returns its numeric value with `explanation` omitted rather than failing the whole widget.
- **Edge cases:** Explainability is per-request opt-in; it must not be silently cached/reused for a different metric value without regenerating.

### 5.7 Feature / Capability: `WidgetRenderer` frontend hierarchy

- **Description:** The frontend component hierarchy that consumes `GET /v1/analytics/dashboard` output generically.
- **Triggers:** `DashboardView` mounts or filters change.
- **Inputs:** The `widgets[]` and `filters` payload from 5.1.
- **Processing:** `DashboardView` renders a `FilterBar` (`WatchlistSelector`, `TopicSelector`, `TimeRangeSelector`) and a `WidgetGrid`. For each widget, `WidgetGrid` maps `widget.type` to one of `MetricTile`, `TimeSeriesChart`, `BarChart`, `PieChart`, `RankedList`, `DataTable`. Each renderer manages its own loading and error/empty state independently.
- **Outputs:** A rendered dashboard reflecting the current filter state; a URL that encodes `watchlistId`, `selectedTopic`, and `timeRange` for deep linking.
- **Error handling:** A renderer receiving malformed/unexpected data for its type shows an inline error state for that widget only, not a full-page failure.
- **Edge cases:** An unrecognized `widget.type` (e.g., a newly registered backend widget the frontend build predates) is rendered as a generic "unsupported widget" placeholder rather than crashing the grid.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Reader | Daily dashboard viewer |
| Tenant-Business-Analyst | Filters and exports data for deeper analysis |
| Topic-Center-Analyst | Uses `selectedTopic` and topic/trend widgets |
| Tenant-Brand-Reputation-Manager | Monitors crisis KPIs (sentiment, reach, source breakdown) |
| Platform-Admin | Views platform-wide usage/cost/connector-health widgets without seeing tenant content |
| Tenant-User | Customizes and shares dashboard views within the tenant |
| Backend / Frontend Engineers | Implement and extend the contract |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.9) | backend engineer | `GET /v1/analytics/dashboard` to return a registry of typed widgets and `selectedTopic` filters | the frontend can render dashboards generically and new widgets can be added easily | Endpoint accepts `watchlistId`/`selectedTopic`/`timeRange`/`granularity`; six data shapes; `WidgetRegistry` maps `widgetId` to provider; widgets prefer `*DailyCount`, fall back for current day; metric widgets can include `explanation` |
| US2 (Story 12.10) | Tenant-Reader | a dashboard that renders widgets consistently and lets me filter by topic and watchlist | I can see the metrics that matter | `DashboardView` with `FilterBar`/`WidgetGrid`; six renderer components; filters propagate to all compatible widgets; each renderer handles its own loading/empty state; deep links include filter state |

### 6.3 Workflow Diagrams / Steps

**Dashboard load workflow:**
1. User opens the Analytics Dashboard (or loads a deep link with filter query params).
2. `DashboardView` calls `GET /v1/analytics/dashboard` with the current filter state.
3. The backend `WidgetRegistry` invokes each applicable `WidgetDataProvider`, which routes to `*DailyCount` (or the bounded live fallback for the current day) and, for opted-in metrics, calls `POST /v1/explain`.
4. The response's `widgets[]` and `filters` are returned; `WidgetGrid` maps each `widget.type` to its renderer and displays the dashboard.
5. The URL is updated/kept in sync with `watchlistId`, `selectedTopic`, `timeRange` for deep-linking.

**Filter-change workflow:**
1. User changes a `FilterBar` control (watchlist, topic, or time range).
2. `DashboardView` re-requests `GET /v1/analytics/dashboard` with the new filter values.
3. Widgets that support the changed filter re-render with updated data; widgets that do not support it are unaffected (receive `null` for that filter's effect) and continue showing their existing data.
4. The URL updates to reflect the new filter state.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `watchlistId`, `selectedTopic`, `timeRange`, `granularity` from the `FilterBar`/deep-link URL.
- `*DailyCount` precomputed aggregate rows (ADR-0087) and, for the current day, live `social_posts`/`enrichment` rows.
- `POST /v1/explain` output (ADR-0078) when explainability is enabled.

### 7.2 Data Outputs

- `GET /v1/analytics/dashboard` response: `widgets[]` and `filters`, consumed by `DashboardView`/`WidgetGrid`.
- Deep-link URLs encoding filter state.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `DashboardRequest` (request DTO, not persisted) | `watchlistId?`, `selectedTopic?`, `timeRange? {start, end}`, `granularity? ('hour'\|'day'\|'week'\|'month')` | Consumed by `GET /v1/analytics/dashboard` |
| `DashboardResponse` (response DTO, not persisted) | `widgets: Widget[]`, `filters: { watchlists[], topics[], availableTimeRanges[] }` | Returned to the frontend |
| `Widget` (embedded object) | `id`, `type`, `title`, `data: WidgetData` | One per registered `WidgetDataProvider` applicable to the request |
| `WidgetData` (discriminated union) | One of `metric` \| `time-series` \| `bar` \| `pie` \| `list` \| `table`, each with its own typed fields (see 5.2) | Embedded in `Widget.data` |
| `WidgetRegistry` (backend component, not persisted) | Maps `widgetId → WidgetDataProvider` | Iterated once per dashboard request |
| `*DailyCount` (ADR-0087, existing tables) | Precomputed daily aggregates (e.g., `SentimentDailyCount`, `TopicDailyCount`, `SourceDailyCount`) | Primary data source for historical widget providers |
| `social_posts` / `enrichment` (existing) | Raw post fallback for current-partial-day data | Secondary data source, bounded to the current day |

### 7.4 Validation Rules

- `timeRange.start` must be before `timeRange.end`; invalid ranges are rejected before any provider runs.
- `granularity` must be one of `hour`, `day`, `week`, `month`.
- `widget.data` must match exactly one of the six defined shapes — no additional/undocumented shape is emitted (BR-002).
- A widget unable to honor an active filter must emit `null` for that filter's effect, never throw (BRU-004).
- All widget data queries must be scoped by tenant RLS and the caller's watchlist/provider permissions (BRU-007, NFR-002).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `watchlistId` restricts every widget to posts matching that watchlist | All providers |
| BR2 | `selectedTopic` restricts every widget to posts associated with that topic | All providers |
| BR3 | `timeRange`/`granularity` apply only where a `date`/`published_at` dimension exists | All providers |
| BR4 | A widget that cannot honor a filter returns `null` for that filter's effect, not an error | All providers |
| BR5 | Historical data prefers `*DailyCount`; only the current partial day may fall back to `social_posts` | Query routing |
| BR6 | Metric explainability is opt-in and must include a confidence indicator | `metric` widget providers |
| BR7 | New widget types require a registered provider + renderer only, no endpoint contract change | `WidgetRegistry`, `WidgetRenderer` |
| BR8 | Dashboard data is always scoped by tenant RLS and the user's watchlist/provider permissions | All providers, all renderers |
| BR9 | Deep links encode `watchlistId`, `selectedTopic`, `timeRange` for shareable/restorable state | Frontend `DashboardView` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `GET /v1/analytics/dashboard` | Inbound API | Serve the typed widget list and filter options | REST/JSON |
| `WidgetRegistry` / `WidgetDataProvider` (backend) | Internal | Extensible per-widget data-fetch mechanism | Internal interface |
| `*DailyCount` tables (ADR-0087) | Read | Primary historical data source for widgets | Postgres aggregation |
| `social_posts` / `enrichment` | Read | Fallback source for current-partial-day data | Postgres, tenant RLS |
| `post_topics` / `topics` (ADR-0104) | Read | Resolves `selectedTopic` filter | Postgres, tenant RLS |
| `POST /v1/explain` (ADR-0078) | Outbound call | Produces plain-language metric explanations | REST/JSON |
| `WidgetRenderer` hierarchy (frontend) | Internal | Maps `widget.type` to a rendering component | React component tree |

---

## 10. Non-Functional Considerations

- **Performance:** p99 dashboard load under 500 ms for pre-aggregated historical views (NFR-001); fallback queries are bounded to small windows to avoid degrading current-day performance (mitigates R-002).
- **Security / access control:** All widget data is scoped by tenant RLS and the user's watchlist/provider permissions; contract tests must verify no cross-tenant leakage through any provider or filter combination (NFR-002).
- **Scalability:** The registry/provider pattern lets widget count grow without endpoint changes; heavy aggregation stays in precomputed tables rather than per-request computation.
- **Reliability / availability:** A single provider's failure must not take down the whole dashboard response (5.3).
- **Maintainability:** The contract is versioned under `/v1` and must remain backward-compatible when new widget types are added (NFR-003); new widget types must not break existing renderers (NFR-005).
- **Accessibility:** Charts and widgets must be keyboard-focusable and carry accessible labels (NFR-004).
- **Auditability:** Filter usage and widget render/error rates support engineering and product reporting (Section 11 of the BRD).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Invalid `timeRange` (end before start) or unknown `granularity` | Validation error | Request rejected before any provider runs |
| `watchlistId`/`selectedTopic` the caller cannot access | Not-found (no cross-tenant disclosure) | Treated as if the resource does not exist |
| A single `WidgetDataProvider` fails or times out | That widget shows an inline error/empty state | Other widgets in the response still render normally |
| A widget cannot honor an active filter | No user-visible error; filter simply has no effect on that widget | Provider returns `null` for that filter's effect |
| `POST /v1/explain` fails or times out | Metric widget shows its value without an explanation | `explanation` field omitted; numeric `value` still returned |
| Frontend receives an unrecognized `widget.type` | Generic "unsupported widget" placeholder | Rest of the dashboard grid renders normally |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- Epic 8 (Stories 8.1–8.6) is already built and provides the existing frontend scaffold to formalize.
- ADR-0087's `*DailyCount` tables and ADR-0104's `selectedTopic`/topic curation are in place as data sources.
- ADR-0078's `POST /v1/explain` is available for explainability.
- All dashboard data remains subject to existing multi-tenant RLS and watchlist/provider access rules.

**Dependencies:**
- ADR-0087 (preconfigured analytics views) — required for historical query routing.
- ADR-0078 (metric explainability) — required for the optional `explanation` field.
- ADR-0104 (`selectedTopic` filter, topic curation) — required for topic filtering.
- Epic 8 Analytics Dashboard (Stories 8.1–8.6) — already built.
- Story 12.9 (backend) and Story 12.10 (frontend), both currently Blocked pending ADR-0105 acceptance.

**Pending decisions:** ADR-0105 is Proposed; the open questions below must be resolved before or during Story 12.9/12.10 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `GET /v1/analytics/dashboard` return all widgets or support a `widgets` allowlist? | Product Owner | Before Story 12.9 implementation |
| Q2 | How is widget layout persisted per user — a new `user_dashboard_layout` table? | Product Owner | Post-v1 |
| Q3 | Should the `selectedTopic` filter persist across sessions? | Product Owner | Before Story 12.10 implementation |
| Q4 | How do widgets indicate they are missing data for the current filter, beyond the `null`-filter-effect rule? | Technical Lead | Before Story 12.9 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| Widget | A typed visualization tile on the analytics dashboard (metric, chart, list, or table). |
| `WidgetRegistry` | Backend component mapping `widgetId` to a `WidgetDataProvider`. |
| `WidgetDataProvider` | Backend component that fetches and shapes data for one widget. |
| `WidgetRenderer` | Frontend component tree that maps `widget.type` to the appropriate visualization. |
| `selectedTopic` | Single-topic filter defined by ADR-0104, restricting widgets to a curated topic. |
| `*DailyCount` | Precomputed daily aggregate tables (ADR-0087) preferred for historical widget data. |
| Explanation | Plain-language description of a metric's value/change, from `POST /v1/explain` (ADR-0078). |
| Deep link | A dashboard URL capturing the current filter state for sharing/bookmarking. |

### Reference links

- ADR-0105: `docs/adr/0105-dashboards-and-analytics-widget-contracts.md` (Proposed)
- BRD-0105: `docs/project docs/Business-Requirements/BRD-0105-Dashboards-And-Analytics-Widget-Contracts.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Related ADRs: ADR-0087 (preconfigured analytics views), ADR-0078 (metric explainability), ADR-0104 (`selectedTopic` filter)
- Related user stories: Story 12.9 (backend), Story 12.10 (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing sources

- No `docs/product-research/reports/08-dashboards-and-analytics-deep-research.md` deep-research brief was found for this feature.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
