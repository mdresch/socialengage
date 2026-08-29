---
name: dashboard-widget-contracts
description: Backend implementation of GET /v1/analytics/dashboard, WidgetRegistry, and typed widget data providers conforming to ADR-0105.
---

# Dashboard Widget Contracts Skill

## Overview
Implements ADR-0105:
- `GET /v1/analytics/dashboard` returning typed dashboard widgets (`metric`, `time-series`, `bar`, `pie`, `list`, `table`) and filter metadata (`watchlists`, `topics`, `availableTimeRanges`).
- `WidgetRegistry` pattern allowing modular registration and execution of widget data providers.
- Query routing prioritizing `*DailyCount` precomputed aggregate tables with tenant isolation.
- Metric explainability integration for `metric` widgets via explain prompts/summary.

## Key Types & Interfaces
```ts
export type WidgetData =
  | MetricWidgetData
  | TimeSeriesWidgetData
  | BarWidgetData
  | PieWidgetData
  | ListWidgetData
  | TableWidgetData;
```

## Routing
Mounted at `GET /v1/analytics/dashboard` in `src/http/versions/v1/analyticsViewsRouter.ts`.
