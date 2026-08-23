# BRD-0105: Dashboards and Analytics Widget Contracts

> **Draft notice:** This BRD is based on ADR-0105, which is currently **Proposed** (2026-08-23). It is a draft for review and may change upon ADR acceptance.

---

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0105: Dashboards and Analytics Widget Contracts |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0105 and related feature design |

---

## 2. Executive Summary

The analytics dashboard already gives tenants visual, interactive views of listening data, but each widget has been built as a one-off component. This initiative establishes a single, typed contract between the backend and the front end so that every widget—sentiment gauges, volume charts, topic clouds, source breakdowns, and future visualizations—can be rendered generically and deep-linked consistently.

The proposed solution is a new `GET /v1/analytics/dashboard` endpoint that returns a registry of typed widgets, a `WidgetRegistry` on the backend, and a `WidgetRenderer` component hierarchy on the front end. Filters for `watchlistId`, `selectedTopic`, `timeRange`, and `granularity` propagate to all compatible widgets. Widgets prefer precomputed `*DailyCount` aggregate tables for historical data and may fall back to `social_posts` only for the current partial day, keeping dashboards fast while remaining accurate.

Business value: a standardized contract reduces the cost of adding new analytics widgets, improves dashboard maintainability, and makes the platform's social-listening value immediately visible to tenant readers, analysts, and brand-reputation managers.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Standardize the dashboard widget contract so new widgets require only a backend provider and a front-end renderer | New widget types can be added without changing the main `GET /v1/analytics/dashboard` endpoint |
| 2 | Improve dashboard response time and scalability | Dashboard renders within p99 < 500 ms for pre-aggregated historical views |
| 3 | Enable consistent, shareable filtering across all dashboard widgets | Deep links restore `watchlistId`, `selectedTopic`, and `timeRange` and all compatible widgets update |
| 4 | Support explainable metrics where users opt in | Metric widgets can display a plain-language `explanation` from `POST /v1/explain` |

---

## 4. Scope

### 4.1 In Scope

- The `GET /v1/analytics/dashboard` request and response contract.
- The six per-widget data shapes: `metric`, `time-series`, `bar`, `pie`, `list`, and `table`.
- A backend `WidgetRegistry` that maps `widgetId` to a `WidgetDataProvider`.
- Filter semantics for `watchlistId`, `selectedTopic`, `timeRange`, and `granularity`.
- Query routing that prefers `*DailyCount` precomputed tables and falls back to `social_posts` for the current partial day.
- Integration with the `selectedTopic` filter from ADR-0104.
- A front-end `WidgetRenderer` component hierarchy: `DashboardView` → `FilterBar` → `WidgetGrid` → typed renderers.
- Deep-link encoding of filter state.
- Optional metric explainability via `POST /v1/explain` (ADR-0078) when the user enables it.

### 4.2 Out of Scope

- Public shareable dashboard links (deferred; tenant-internal sharing only for v2).
- Persistent user-specific dashboard layout (pending open question on `user_dashboard_layout`).
- A `widgets` allowlist or per-request widget subset (pending open question).
- New v2 widgets such as Share of Voice, Top Influencers, or Engagement Rate beyond the contract needed to support them.
- Geospatial/Location widgets explicitly reaffirmed as not buildable in Epic 8 (ADR-0054/0055).
- New precomputed aggregate tables beyond the current `*DailyCount` design unless client-side aggregation becomes a bottleneck.

### 4.3 Assumptions

- Epic 8 (Analytics Dashboard, Stories 8.1–8.6) is already built in `social-listening-admin`.
- ADR-0087 (preconfigured analytics views and `*DailyCount` tables) provides the historical aggregate data source.
- ADR-0104 (`selectedTopic` filter and topic curation) is in place.
- ADR-0078 (metric explainability) makes `POST /v1/explain` available.
- All dashboard data remains subject to multi-tenant RLS and watchlist/provider access rules.

### 4.4 Constraints

- v1 aggregation remains client-side over `GET /v1/posts` where possible; server-side routing is used for precomputed historical data and the current partial day fallback.
- Dashboards must never expose cross-tenant data or data from watchlists/providers the user cannot access.
- The contract must be versioned under `/v1` and backward-compatible when new widget types are added.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader | Daily dashboard viewer | High | Understand every widget at a glance with plain-language labels |
| Tenant-Business-Analyst | Filters and exports data for deeper analysis | High | Filter by watchlist, date, source, language, and topic; export underlying data |
| Topic-Center-Analyst | Investigates trends and topics | Medium | Use `selectedTopic` and future topic/influencer widgets |
| Tenant-Brand-Reputation-Manager | Monitors crisis KPIs | Medium | See negative sentiment, reach, and source breakdown quickly |
| Platform-Admin | Operates the platform | Medium | View platform-wide usage, cost, and connector-health widgets without seeing tenant content |
| Tenant-User | Customizes and shares within the tenant | Low | Customize default dashboard view and share within the tenant |
| Backend / Frontend Engineers | Implement and maintain the contract | High | Clear, typed, versioned contract and generic rendering pipeline |

---

## 6. Current State (As-Is)

The Epic 8 Analytics Dashboard (Overview, Sentiment, Conversations, Sources, Language) is already in place. Widgets in that release were client-side aggregations over `GET /v1/posts` and `enrichment`, with each widget owning its own data transformation and rendering logic. This allowed a fast v1 but creates the following pain points:

- **Inconsistent widget shapes:** each widget defines its own prop and data shape, so adding a new widget means touching both backend data fetching and front-end rendering.
- **No generic renderer:** the `WidgetGrid` cannot simply map `widget.type` to a component.
- **Filter propagation is ad hoc:** `watchlistId`, `selectedTopic`, and `timeRange` are not guaranteed to affect every widget the same way.
- **Performance degrades with large datasets:** client-side aggregation over thousands of posts becomes slow and is not suitable for 30+ day ranges.
- **No built-in explainability:** metric widgets do not explain why a number changed or what it means.

---

## 7. Future State (To-Be)

After this initiative, a tenant user opens the Analytics Dashboard and sees a `DashboardView` with a `FilterBar` and a `WidgetGrid`. The `FilterBar` offers `WatchlistSelector`, `TopicSelector`, and `TimeRangeSelector`. The `WidgetGrid` receives a typed list of widgets from `GET /v1/analytics/dashboard` and renders each with the appropriate `MetricTile`, `TimeSeriesChart`, `BarChart`, `PieChart`, `RankedList`, or `DataTable` renderer.

The backend `WidgetRegistry` maps each `widgetId` to a `WidgetDataProvider`. Providers query `*DailyCount` precomputed tables for historical data and fall back to `social_posts` only when the requested range includes the current partial day. Each provider returns data in one of the six defined shapes and indicates when a filter cannot be honored by returning `null` for that filter's effect. If the user enables explainability, `metric` widgets may include an `explanation` from `POST /v1/explain`.

Expected capabilities:
- New widgets are added by registering a backend provider and a front-end renderer, without modifying `GET /v1/analytics/dashboard`.
- All compatible widgets react to the same filter set.
- Dashboard state can be shared via deep links.
- Dashboards remain fast by default by using precomputed aggregates.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose `GET /v1/analytics/dashboard` accepting `watchlistId`, `selectedTopic`, `timeRange`, and `granularity` | Must | Endpoint returns a typed `widgets` array and a `filters` object | Product Owner |
| BR-002 | The system shall define six per-widget data shapes (`metric`, `time-series`, `bar`, `pie`, `list`, `table`) | Must | Each returned widget's `data` matches exactly one of the six shapes | Product Owner |
| BR-003 | The backend shall maintain a `WidgetRegistry` mapping `widgetId` to a `WidgetDataProvider` | Must | New widgets can be registered without changing the main endpoint | Technical Lead |
| BR-004 | The system shall propagate `watchlistId`, `selectedTopic`, `timeRange`, and `granularity` to all compatible widgets | Must | Each widget's data reflects the active filters where the dimension exists | Product Owner |
| BR-005 | Widgets that cannot honor a filter shall return `null` for that filter's effect, not an error | Must | Dashboard renders without failure when a filter is unsupported by a widget | Technical Lead |
| BR-006 | Widgets shall prefer `*DailyCount` tables and fall back to `social_posts` only for the current partial day | Should | Historical data loads from precomputed tables; current-day data is accurate | Technical Lead |
| BR-007 | Metric widgets may include a plain-language `explanation` from `POST /v1/explain` when the user enables explainability | Could | Explanation appears only when requested and has a confidence indicator | Product Owner |
| BR-008 | The front end shall provide a `WidgetRenderer` component hierarchy that maps `widget.type` to a renderer | Must | All six data shapes render correctly and handle loading/empty states | Technical Lead |
| BR-009 | The system shall encode `watchlistId`, `selectedTopic`, and `timeRange` in the dashboard URL for deep links | Should | Loading a deep link restores the same dashboard state | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | p99 dashboard load time under 500 ms for pre-aggregated historical views | Performance | Should | Measured by contract and production monitoring |
| NFR-002 | All dashboard data must be scoped by tenant and user access (RLS) | Security | Must | Contract tests verify no cross-tenant data leakage |
| NFR-003 | The widget contract must be versioned under `/v1` and backward-compatible | Maintainability | Must | Existing widgets continue to work when a new type is added |
| NFR-004 | Charts and widgets must be keyboard-focusable and include accessible labels | Accessibility | Should | Verified by accessibility check / manual review |
| NFR-005 | New widget types must not break existing renderers | Maintainability | Should | Existing renderer contract tests continue to pass |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `watchlistId` restricts every widget to posts that match the selected watchlist. |
| BRU-002 | `selectedTopic` (ADR-0104) restricts every widget to posts associated with the selected topic. |
| BRU-003 | `timeRange` and `granularity` are honored only where the underlying data has a `date` or `published_at` dimension. |
| BRU-004 | A widget that cannot honor an active filter must return `null` for that filter's effect, not raise an error. |
| BRU-005 | Historical widget data must prefer `*DailyCount` precomputed tables; the current partial day may fall back to `social_posts`. |
| BRU-006 | Metric explainability requires explicit user opt-in and must surface a confidence indicator. |
| BRU-007 | Dashboard data access is governed by multi-tenant RLS and the user's watchlist/provider permissions. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `widgets` array | Typed list of dashboard widgets returned by `GET /v1/analytics/dashboard` | `WidgetRegistry` / `WidgetDataProvider` | Backend | Tenant-scoped |
| `widget.data` | One of `metric`, `time-series`, `bar`, `pie`, `list`, `table` | Provider query result | Backend | Tenant-scoped |
| `filters` | Available `watchlists`, `topics`, and `availableTimeRanges` | `watchlists`, `topics` | Backend | Tenant-scoped |
| `watchlistId` | Selected watchlist filter | User selection | Frontend | Tenant-scoped |
| `selectedTopic` | Selected topic filter | User selection + ADR-0104 | Frontend / Backend | Tenant-scoped |
| `timeRange` / `granularity` | Date filter and bucket size | User selection | Frontend | None |
| `*DailyCount` tables | Precomputed daily aggregates (ADR-0087) | Derived from `social_posts` + `enrichment` | Backend | Tenant-scoped |
| `social_posts` | Raw post fallback for the current partial day | Ingestion pipeline | Backend | Tenant-scoped / PII possible |
| `explanation` | Plain-language metric explanation (ADR-0078) | `POST /v1/explain` | Backend | Tenant-scoped |
| `user_dashboard_layout` (proposed) | Per-user widget layout persistence | Open question | Backend | Tenant-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Dashboard p99 response time | Track query-routing and precomputed-view performance | Engineering | Daily |
| Widget render / error rates | Monitor renderer health and unsupported filter handling | Engineering | Daily |
| Most/least used widget types | Inform roadmap and widget investment | Product | Monthly |
| Filter usage (watchlist, topic, time) | Understand how users interact with dashboards | Product | Monthly |
| Explainability usage | Track adoption of AI metric explanations | Product | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | ADR-0105 is still Proposed, so decisions may change | High | High | Keep BRD in Draft status; reissue upon ADR acceptance | Product Owner |
| R-002 | Fallback to raw `social_posts` for the current partial day could degrade performance | Medium | Medium | Limit fallback to small time windows and cap returned posts | Technical Lead |
| R-003 | Growing number of widget types increases renderer maintenance | Medium | Medium | Enforce the strict six-type contract and version the API | Technical Lead |
| R-004 | Cross-tenant data could leak through dashboard filters or aggregates | Low | High | Apply RLS to every provider and aggregate; contract-test with multi-tenant fixtures | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0087 — preconfigured analytics views and `*DailyCount` tables | Internal | Technical Lead | Required before historical query routing |
| D-002 | ADR-0078 — metric explainability and `POST /v1/explain` | Internal | Technical Lead | Required for optional `explanation` field |
| D-003 | ADR-0104 — `selectedTopic` filter and topic curation | Internal | Technical Lead | Required for topic filtering on the dashboard |
| D-004 | Epic 8 Analytics Dashboard (Stories 8.1–8.6) | Internal | Engineering | Already built; existing front-end scaffold |
| D-005 | Story 12.9 — Dashboard widget contracts (backend) | Internal | Engineering | Ready; builds the backend contract |
| D-006 | Story 12.10 — Dashboard widget renderer (frontend) | Internal | Engineering | Ready (depends on Story 12.9) |

---

## 14. Acceptance Criteria

- `GET /v1/analytics/dashboard` accepts `watchlistId`, `selectedTopic`, `timeRange`, and `granularity` and returns a typed `widgets` array plus a `filters` object.
- Each widget's `data` matches one of the six defined shapes (`metric`, `time-series`, `bar`, `pie`, `list`, `table`).
- `WidgetRegistry` maps `widgetId` to a `WidgetDataProvider`, and a new provider can be registered without changing the main endpoint.
- Filters are propagated to all compatible widgets; unsupported filters return `null` for that filter's effect, not an error.
- `WidgetRenderer` maps `widget.type` to the correct renderer and handles loading, error, and empty states.
- Deep links encode and restore `watchlistId`, `selectedTopic`, and `timeRange`.
- All dashboard data remains tenant-scoped and RLS-enforced.
- Metric widgets can include an `explanation` when explainability is enabled.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Widget** | A typed visualization tile on the analytics dashboard (e.g., a metric, chart, list, or table). |
| **WidgetRegistry** | A backend component that maps `widgetId` to a `WidgetDataProvider`. |
| **WidgetDataProvider** | The backend component responsible for fetching and shaping data for one widget. |
| **WidgetRenderer** | A front-end component that maps `widget.type` to the appropriate visualization. |
| **selectedTopic** | A single-topic filter defined by ADR-0104 that restricts dashboard widgets to a curated topic. |
| **`*DailyCount`** | Precomputed daily aggregate tables (e.g., `TopicDailyCount`, `SourceDailyCount`) authorized by ADR-0087. |
| **Explanation** | A plain-language description of a metric's value or change, produced by `POST /v1/explain` (ADR-0078). |
| **Deep link** | A dashboard URL that captures the current filter state so it can be shared or bookmarked. |

---

## 16. Appendices

### 16.1 Source Documents

- [ADR-0105: Dashboards and analytics widget contracts](../../adr/0105-dashboards-and-analytics-widget-contracts.md)
- [Feature design: 08-dashboards-and-analytics](../../product-research/feature-designs/08-dashboards-and-analytics.md)
- [Feature-to-ADR Scoping Plan](../../product-research/feature-adr-scoping.md)

### 16.2 Related ADRs

- [ADR-0087: Preconfigured analytics views](../../adr/0087-preconfigured-analytics-views.md) (if present)
- [ADR-0078: Metric explainability](../../adr/0078-metric-explainability.md) (if present)
- [ADR-0104: selectedTopic filter and topic curation](../../adr/0104-selected-topic-filter-and-topic-curation.md) (if present)

### 16.3 Related User Stories

- [Story 12.9 — Dashboard widget contracts (backend)](../../user-stories/epic-12-adr-0101-to-0108.md#story-129--dashboard-widget-contracts-backend)
- [Story 12.10 — Dashboard widget renderer (frontend)](../../user-stories/epic-12-adr-0101-to-0108.md#story-1210--dashboard-widget-renderer-frontend)

### 16.4 Missing Source Notes

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature.
- Related ADR links above use relative paths; verify the exact filenames if the ADR numbering convention differs.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
