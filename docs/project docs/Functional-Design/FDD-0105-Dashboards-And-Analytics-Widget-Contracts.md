# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0105: Dashboards and Analytics Widget Contracts |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0105, BRD-0105, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

The analytics dashboard already gives tenants visual, interactive views of listening data, but each widget has been built as a one-off component. This initiative establishes a single, typed contract between the backend and the front end so that every widget—sentiment gauges, volume charts, topic clouds, source breakdowns, and future visualizations—can be rendered generically and deep-linked consistently.

This FDD translates the accepted architecture and business requirements from ADR-0105 and BRD-0105 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - The `GET /v1/analytics/dashboard` request and response contract.
- The six per-widget data shapes: `metric`, `time-series`, `bar`, `pie`, `list`, and `table`.
- A backend `WidgetRegistry` that maps `widgetId` to a `WidgetDataProvider`.
- Filter semantics for `watchlistId`, `selectedTopic`, `timeRange`, and `granularity`.
- Query routing that prefers `*DailyCount` precomputed tables and falls back to `social_posts` for the current partial day.
- Integration with the `selectedTopic` filter from ADR-0104.
- A front-end `WidgetRenderer` component hierarchy: `DashboardView` → `FilterBar` → `WidgetGrid` → typed renderers.
- Deep-link encoding of filter state.
- Optional metric explainability via `POST /v1/explain` (ADR-0078) when the user enables it.
- **Out of scope:** - Public shareable dashboard links (deferred; tenant-internal sharing only for v2).
- Persistent user-specific dashboard layout (pending open question on `user_dashboard_layout`).
- A `widgets` allowlist or per-request widget subset (pending open question).
- New v2 widgets such as Share of Voice, Top Influencers, or Engagement Rate beyond the contract needed to support them.
- Geospatial/Location widgets explicitly reaffirmed as not buildable in Epic 8 (ADR-0054/0055).
- New precomputed aggregate tables beyond the current `*DailyCount` design unless client-side aggregation becomes a bottleneck.
- **Assumptions and constraints:** - Epic 8 (Analytics Dashboard, Stories 8.1–8.6) is already built in `social-listening-admin`.
- ADR-0087 (preconfigured analytics views and `*DailyCount` tables) provides the historical aggregate data source.
- ADR-0104 (`selectedTopic` filter and topic curation) is in place.
- ADR-0078 (metric explainability) makes `POST /v1/explain` available.
- All dashboard data remains subject to multi-tenant RLS and watchlist/provider access rules.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. The analytics dashboard is already built
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and the Analytics Dashboard (Epic 8, Stories 8.1–8.6) already exist. This ADR formalizes the widget contract, the `selectedTopic` filter, and the query-routing rules so future widgets follow the same pattern.

### 2. Widgets need a common contract
Each widget (sentiment gauge, volume chart, topic cloud, source breakdown, etc.) should have a consistent request/response shape so the UI can render them generically.

### 3. Precomputed views and `RAG` can power widgets
`ADR-0087` (preconfigured analytics views) and `ADR-0084` (RAG search) provide fast aggregate data and natural-language Q&A. The dashboard contract must support both.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Standardize the dashboard widget contract so new widgets require only a backend provider and a front-end renderer | New widget types can be added without changing the main `GET /v1/analytics/dashboard` endpoint |
| 2 | Improve dashboard response time and scalability | Dashboard renders within p99 < 500 ms for pre-aggregated historical views |
| 3 | Enable consistent, shareable filtering across all dashboard widgets | Deep links restore `watchlistId`, `selectedTopic`, and `timeRange` and all compatible widgets update |
| 4 | Support explainable metrics where users opt in | Metric widgets can display a plain-language `explanation` from `POST /v1/explain` |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

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

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.9 | backend engineer | `GET /v1/analytics/dashboard` to return a registry of typed widgets and `selectedTopic` filters, | the frontend can render dashboards generically and new widgets can be added easily. | `GET /v1/analytics/dashboard` accepts `watchlistId`, `selectedTopic`, `timeRange`, `granularity`.; Widget data shapes: `metric`, `time-series`, `bar`, `pie`, `list`, `table`.; `WidgetRegistry` maps `widgetId` to a `WidgetDataProvider`. |
| 12.10 | `Tenant-Reader` | a dashboard that renders widgets consistently and lets me filter by topic and watchlist, | I can see the metrics that matter. | `DashboardView` with `FilterBar` and `WidgetGrid`.; `MetricTile`, `TimeSeriesChart`, `BarChart`, `PieChart`, `RankedList`, `DataTable` renderers.; Filters propagate to all compatible widgets. |

### 6.3 Workflow Diagrams / Steps

### 1. `GET /v1/analytics/dashboard` contract
```ts
// Request
{
  watchlistId?: string;
  selectedTopic?: string;
  timeRange?: { start: ISOString; end: ISOString };
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

// Response
{
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    data: WidgetData;
  }>;
  filters: {
    watchlists: Array<{ id: string; name: string }>;
    topics: Array<{ id: string; name: string }>;
    availableTimeRanges: string[];
  };
}
```

### 2. Per-widget data shapes
```ts
type WidgetData =
  | { type: 'metric'; value: number; previousValue?: number; explanation?: string }
  | { type: 'time-series'; labels: string[]; series: Array<{ name: string; data: number[] }> }
  | { type: 'bar'; labels: string[]; data: number[] }
  | { type: 'pie'; segments: Array<{ label: string; value: number; color?: string }> }
  | { type: 'list'; items: Array<{ label: string; value: number; url?: string }> }
  | { type: 'table'; columns: string[]; rows: Array<Record<string, string | number>> };
```

### 3. Widget registry
- The backend has a `WidgetRegistry` that maps `widgetId` to a `WidgetDataProvider`.
- Each provider knows which aggregate view or query to use and what filter combinations it supports.
- New widgets can be added without changing the main endpoint by registering a new provider.

### 4. Filter semantics
- `watchlistId` restricts all widgets to posts matching that watchlist.
- `selectedTopic` (ADR-0104) restricts widgets to posts associated with that topic.
- `timeRange` is honored where the underlying data has a `date` or `published_at` dimension.
- Widgets that cannot honor a filter return `null` for that filter's effect, not an error.

### 5. Query routing
- Widgets prefer `*DailyCount` tables (ADR-0087) for historical aggregation.
- The current partial day may fall back to `social_posts` if the aggregate table has not yet been refreshed.
- `metric` widgets can include an `explanation` from `POST /v1/explain` (ADR-0078) if the user enables explainability.

### 6. `WidgetRenderer` component hierarchy
```
DashboardView
├── FilterBar
│   ├── WatchlistSelector
│   ├── TopicSelector
│   └── TimeRangeSelector
└── WidgetGrid
    ├── MetricTile
    ├── TimeSeriesChart
    ├── BarChart
    ├── PieChart
    ├── RankedList
    └── DataTable
```

- The front-end maps `widget.type` to a renderer.
- Each renderer handles its own loading and error states.
- Deep links encode `watchlistId`, `selectedTopic`, and `timeRange`.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. `GET /v1/analytics/dashboard` contract
```ts
// Request
{
  watchlistId?: string;
  selectedTopic?: string;
  timeRange?: { start: ISOString; end: ISOString };
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

// Response
{
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    data: WidgetData;
  }>;
  filters: {
    watchlists: Array<{ id: string; name: string }>;
    topics: Array<{ id: string; name: string }>;
    availableTimeRanges: string[];
  };
}
```

### 2. Per-widget data shapes
```ts
type WidgetData =
  | { type: 'metric'; value: number; previousValue?: number; explanation?: string }
  | { type: 'time-series'; labels: string[]; series: Array<{ name: string; data: number[] }> }
  | { type: 'bar'; labels: string[]; data: number[] }
  | { type: 'pie'; segments: Array<{ label: string; value: number; color?: string }> }
  | { type: 'list'; items: Array<{ label: string; value: number; url?: string }> }
  | { type: 'table'; columns: string[]; rows: Array<Record<string, string | number>> };
```

### 3. Widget registry
- The backend has a `WidgetRegistry` that maps `widgetId` to a `WidgetDataProvider`.
- Each provider knows which aggregate view or query to use and what filter combinations it supports.
- New widgets can be added without changing the main endpoint by registering a new provider.

### 4. Filter semantics
- `watchlistId` restricts all widgets to posts matching that watchlist.
- `selectedTopic` (ADR-0104) restricts widgets to posts associated with that topic.
- `timeRange` is honored where the underlying data has a `date` or `published_at` dimension.
- Widgets that cannot honor a filter return `null` for that filter's effect, not an error.

### 5. Query routing
- Widgets prefer `*DailyCount` tables (ADR-0087) for historical aggregation.
- The current partial day may fall back to `social_posts` if the aggregate table has not yet been refreshed.
- `metric` widgets can include an `explanation` from `POST /v1/explain` (ADR-0078) if the user enables explainability.

### 6. `WidgetRenderer` component hierarchy
```
DashboardView
├── FilterBar
│   ├── WatchlistSelector
│   ├── TopicSelector
│   └── TimeRangeSelector
└── WidgetGrid
    ├── MetricTile
    ├── TimeSeriesChart
    ├── BarChart
    ├── PieChart
    ├── RankedList
    └── DataTable
```

- The front-end maps `widget.type` to a renderer.
- Each renderer handles its own loading and error states.
- Deep links encode `watchlistId`, `selectedTopic`, and `timeRange`.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | p99 dashboard load time under 500 ms for pre-aggregated historical views | Performance | Should | Measured by contract and production monitoring |
| NFR-002 | All dashboard data must be scoped by tenant and user access (RLS) | Security | Must | Contract tests verify no cross-tenant data leakage |
| NFR-003 | The widget contract must be versioned under `/v1` and backward-compatible | Maintainability | Must | Existing widgets continue to work when a new type is added |
| NFR-004 | Charts and widgets must be keyboard-focusable and include accessible labels | Accessibility | Should | Verified by accessibility check / manual review |
| NFR-005 | New widget types must not break existing renderers | Maintainability | Should | Existing renderer contract tests continue to pass |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | ADR-0105 is still Proposed, so decisions may change | High | High | Keep BRD in Draft status; reissue upon ADR acceptance | Product Owner |
| R-002 | Fallback to raw `social_posts` for the current partial day could degrade performance | Medium | Medium | Limit fallback to small time windows and cap returned posts | Technical Lead |
| R-003 | Growing number of widget types increases renderer maintenance | Medium | Medium | Enforce the strict six-type contract and version the API | Technical Lead |
| R-004 | Cross-tenant data could leak through dashboard filters or aggregates | Low | High | Apply RLS to every provider and aggregate; contract-test with multi-tenant fixtures | Technical Lead |

---

---

## 12. Assumptions and Dependencies

- Epic 8 (Analytics Dashboard, Stories 8.1–8.6) is already built in `social-listening-admin`.
- ADR-0087 (preconfigured analytics views and `*DailyCount` tables) provides the historical aggregate data source.
- ADR-0104 (`selectedTopic` filter and topic curation) is in place.
- ADR-0078 (metric explainability) makes `POST /v1/explain` available.
- All dashboard data remains subject to multi-tenant RLS and watchlist/provider access rules.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0087 — preconfigured analytics views and `*DailyCount` tables | Internal | Technical Lead | Required before historical query routing |
| D-002 | ADR-0078 — metric explainability and `POST /v1/explain` | Internal | Technical Lead | Required for optional `explanation` field |
| D-003 | ADR-0104 — `selectedTopic` filter and topic curation | Internal | Technical Lead | Required for topic filtering on the dashboard |
| D-004 | Epic 8 Analytics Dashboard (Stories 8.1–8.6) | Internal | Engineering | Already built; existing front-end scaffold |
| D-005 | Story 12.9 — Dashboard widget contracts (backend) | Internal | Engineering | Ready; builds the backend contract |
| D-006 | Story 12.10 — Dashboard widget renderer (frontend) | Internal | Engineering | Ready (depends on Story 12.9) |

---

---

## 13. Open Questions

- Should `GET /v1/analytics/dashboard` return all widgets or support a `widgets` allowlist?
- How is widget layout persisted per user? `user_dashboard_layout` table?
- Should the `selectedTopic` filter persist across sessions?
- How do widgets indicate that they are missing data for the current filter?

---

---

## 14. Appendix

### Reference Documents

- ADR-0105: `docs/adr/0105-dashboards-and-analytics-widget-contracts.md`
- BRD-0105: `docs/project docs/Business-Requirements/BRD-0105-Dashboards-And-Analytics-Widget-Contracts.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0105 and BRD-0105. |