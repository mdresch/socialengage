# ADR-0105: Dashboards and analytics widget contracts

**Status:** Proposed (2026-08-23)

**Authorizes:** the `GET /v1/analytics/dashboard` contract, per-widget data shapes, filter rules, `selectedTopic` integration, and the `WidgetRenderer` component hierarchy for the analytics dashboard.

**Source:** `docs/product-research/feature-designs/08-dashboards-and-analytics.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The analytics dashboard is already built
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and the Analytics Dashboard (Epic 8, Stories 8.1–8.6) already exist. This ADR formalizes the widget contract, the `selectedTopic` filter, and the query-routing rules so future widgets follow the same pattern.

### 2. Widgets need a common contract
Each widget (sentiment gauge, volume chart, topic cloud, source breakdown, etc.) should have a consistent request/response shape so the UI can render them generically.

### 3. Precomputed views and `RAG` can power widgets
`ADR-0087` (preconfigured analytics views) and `ADR-0084` (RAG search) provide fast aggregate data and natural-language Q&A. The dashboard contract must support both.

---

## Decision

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

## Consequences

1. **Consistent widget contract:** every dashboard widget follows the same request/response pattern.
2. **Easy to add widgets:** new widgets only need a backend provider and a front-end renderer.
3. **Fast by default:** widgets use precomputed views and fall back to raw posts only for the current partial day.
4. **Explainability built in:** metric widgets can include AI explanations with one flag.

---

## Alternatives considered

1. **Each widget has its own endpoint and no shared contract.**
   - *Rejected:* it fragments the dashboard and makes deep-linking and filter propagation harder.

2. **Embed widget data in the dashboard page HTML at build time.**
   - *Rejected:* dashboards are dynamic and tenant-specific. Server-rendered JSON is required.

3. **Use a third-party charting data format (e.g. Vega-Lite specs).**
   - *Rejected:* it adds a front-end dependency and is overkill. A small set of typed widget shapes is enough.

---

## Open questions

- Should `GET /v1/analytics/dashboard` return all widgets or support a `widgets` allowlist?
- How is widget layout persisted per user? `user_dashboard_layout` table?
- Should the `selectedTopic` filter persist across sessions?
- How do widgets indicate that they are missing data for the current filter?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0087` (precomputed views), `ADR-0078` (metric explainability), `ADR-0104` (`selectedTopic` filter)
