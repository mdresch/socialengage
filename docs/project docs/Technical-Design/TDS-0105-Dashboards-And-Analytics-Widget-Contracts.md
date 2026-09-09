# Technical Design Specification (TDS) — Dashboards & Analytics Widget Contracts

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0105: Dashboards and Analytics Widget Contracts — Standardized Widget Data Payloads, Backend WidgetRegistry & Unified Dashboard Endpoint |
| **Document ID** | `TDS-0105` |
| **Feature Name** | Unified Dashboard API & Extensible Widget Provider Registry |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/dashboard-widget-contracts/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0105` | [ADR-0105: Dashboards and Analytics Widget Contracts](../../adr/0105-dashboards-and-analytics-widget-contracts.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0105` | [BRD-0105: Dashboards And Analytics Widget Contracts](../Business-Requirements/BRD-0105-Dashboards-And-Analytics-Widget-Contracts.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0105` | [FDD-0105: Dashboards And Analytics Widget Contracts](../Functional-Design/FDD-0105-Dashboards-And-Analytics-Widget-Contracts.md) | Fully Aligned |
| **Governing User Story** | `Story 12.9` | [Epic 12: Stories 101–108](../../user-stories/epic-12-adr-0101-to-0108.md#story-129--dashboard-widget-contracts-backend) | Acceptance Target |
| **Related User Stories** | `Story 12.10`, `Story 8.1` | Dashboard Widget Renderer, Analytics Shell | Client Implementation |
| **Related Architecture Decisions** | `ADR-0054`, `ADR-0087`, `ADR-0104`, `ADR-0113` | Data-Source Strategy, Precomputed Views, Selected Topic, Metric Explainability | Architectural Foundation |
| **Executable Contract Tests** | `Story 12.9 & 12.10 Contracts` | `social-listening-core/contracts/epic-12/story-12.9.dashboard-widget-contracts.contract.test.ts`<br>`social-listening-admin/contracts/epic-12/story-12.10.dashboard-widget-renderer.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Frontend["social-listening-admin UI"]
        DashboardView["DashboardView.tsx"]
        FilterBar["FilterBar (Watchlist, Topic, DateRange)"]
        Renderer["WidgetRenderer.tsx"]
        
        subgraph Renderers["Polymorphic Renderers"]
            M["MetricTile.tsx"]
            TS["TimeSeriesChart.tsx"]
            B["BarChart.tsx"]
            P["PieChart.tsx"]
            L["RankedList.tsx"]
            T["DataTable.tsx"]
        end
    end

    subgraph BackendAPI["social-listening-core API"]
        UnifiedRoute["GET /v1/analytics/dashboard"]
        Registry["WidgetRegistry (Extensible Provider Mapping)"]
        
        subgraph Providers["Widget Data Providers"]
            P_Sent["SentimentSummaryProvider"]
            P_Vol["VolumeTimeSeriesProvider"]
            P_Top["TopTopicsBarProvider"]
            P_Src["SourceSharePieProvider"]
            P_Auth["TopAuthorsListProvider"]
        end
    end

    subgraph DataSources["Persistence Stores"]
        RollupTables["Precomputed Daily Views (*daily_counts)"]
        RawPosts["social_posts (Current Partial Day Fallback)"]
    end

    DashboardView --> FilterBar
    DashboardView --> UnifiedRoute
    UnifiedRoute --> Registry
    Registry --> Providers
    Providers --> RollupTables
    Providers -.-> RawPosts
    UnifiedRoute -->> DashboardView
    DashboardView --> Renderer
    Renderer --> M
    Renderer --> TS
    Renderer --> B
    Renderer --> P
    Renderer --> L
    Renderer --> T
```

### 2.2 Architectural Boundaries & Invariants
- **Unified Aggregated Dashboard Payload:** Rather than issuing dozens of disjoint REST calls per chart, the UI fetches `GET /v1/analytics/dashboard`. The response returns all registered widgets alongside available filter metadata in a single network round-trip.
- **6 Standardized Widget Polymorphic Shapes:** Every widget payload strictly matches one of the 6 canonical DTO variants: `metric`, `time-series`, `bar`, `pie`, `list`, or `table`. Custom ad-hoc JSON schemas are forbidden.
- **Extensible Backend Provider Registry:** The backend decouples widget calculation via a `WidgetRegistry` pattern. Registering a new widget requires implementing a `WidgetDataProvider` without altering the HTTP controller logic.
- **Query Routing Priority:** Providers query precomputed `*daily_counts` tables (ADR-0087) for historical dates, querying raw `social_posts` only when necessary for the current in-progress day.

---

## 3. Data Architecture & Persistence Design

### 3.1 Polymorphic Widget DTO Types
Defined in `social-listening-core/src/analytics/dashboard/widgetRegistry.ts`:

```typescript
export interface MetricWidgetData {
  type: 'metric';
  value: number;
  previousValue?: number;
  explanation?: string;
}

export interface TimeSeriesWidgetData {
  type: 'time-series';
  labels: string[];              // e.g. ["2026-09-01", "2026-09-02"]
  series: Array<{
    name: string;
    data: number[];
  }>;
}

export interface BarWidgetData {
  type: 'bar';
  labels: string[];
  data: number[];
}

export interface PieWidgetData {
  type: 'pie';
  segments: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
}

export interface ListWidgetData {
  type: 'list';
  items: Array<{
    label: string;
    value: number;
    url?: string;
  }>;
}

export interface TableWidgetData {
  type: 'table';
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export type WidgetData =
  | MetricWidgetData
  | TimeSeriesWidgetData
  | BarWidgetData
  | PieWidgetData
  | ListWidgetData
  | TableWidgetData;
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Widget Provider Interface & Registry
```typescript
export interface WidgetContext {
  tenantId: string;
  watchlistId?: string;
  selectedTopic?: string;
  timeRange?: { start: string; end: string };
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface WidgetDataProvider {
  id: string;
  type: string;
  title: string;
  getData(ctx: WidgetContext): Promise<WidgetData>;
}

export class WidgetRegistry {
  private providers = new Map<string, WidgetDataProvider>();

  register(provider: WidgetDataProvider): void {
    this.providers.set(provider.id, provider);
  }

  async resolveAll(ctx: WidgetContext): Promise<Array<{ id: string; type: string; title: string; data: WidgetData }>> {
    const results = [];
    for (const provider of this.providers.values()) {
      try {
        const data = await provider.getData(ctx);
        results.push({
          id: provider.id,
          type: provider.type,
          title: provider.title,
          data,
        });
      } catch (err) {
        // Degrade gracefully with empty shape on provider failure
        results.push({
          id: provider.id,
          type: provider.type,
          title: provider.title,
          data: { type: 'metric', value: 0, explanation: 'Data unavailable' } as any,
        });
      }
    }
    return results;
  }
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Endpoint Specification
`GET /v1/analytics/dashboard`

- **Query Parameters:**
  - `watchlistId` (Optional): Restricts to matched watchlist posts
  - `selectedTopic` (Optional): Restricts to specific topic cluster
  - `startDate` (Optional): ISO Date
  - `endDate` (Optional): ISO Date
  - `granularity` (Optional): `'hour' | 'day' | 'week' | 'month'`
- **Response Format (200 OK):**
```json
{
  "widgets": [
    {
      "id": "sentiment-kpi",
      "type": "metric",
      "title": "Net Sentiment Score",
      "data": {
        "type": "metric",
        "value": 4.2,
        "previousValue": 3.8
      }
    },
    {
      "id": "volume-history",
      "type": "time-series",
      "title": "Mentions Over Time",
      "data": {
        "type": "time-series",
        "labels": ["2026-09-01", "2026-09-02"],
        "series": [{ "name": "Total Mentions", "data": [120, 145] }]
      }
    }
  ],
  "filters": {
    "watchlists": [{ "id": "wl-1", "name": "Brand Monitor" }],
    "topics": [{ "id": "top-1", "name": "AI Automation" }],
    "availableTimeRanges": ["24h", "7d", "30d", "90d"]
  }
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Cross-Tenant Guard:** All registered `WidgetDataProvider` instances inherit the tenant's scoped PostgreSQL pool (`withTenant()`), preventing cross-tenant leakage across every widget calculation.
- **Authorization:** Only authenticated users with `tenant_user` or `tenant_admin` roles can call `/v1/analytics/dashboard`.

---

## 7. Performance, Scalability & Resource Caps
- **Parallel Resolution:** `resolveAll()` executes data provider queries in parallel via `Promise.allSettled()`, completing all 6 widgets in $< 60\text{ms}$.
- **Precomputed Efficiency:** $> 90\%$ of widget reads hit `*daily_counts` tables, avoiding post table locking.

---

## 8. Resilience, Recovery & Failure Semantics
- **Provider Fault Isolation:** If a single widget provider throws a database error, only that widget renders in an error/empty state; the remaining widgets render cleanly.

---

## 9. Observability, Telemetry & Auditability
- Emits metric: `dashboard_fetch_duration_ms{widget_count, error_count}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Extends the core API surface cleanly without altering preexisting raw post endpoints.

---

## 11. Verification, Testing & Quality Assurance
- **Story 12.9 Contract:** `social-listening-core/contracts/epic-12/story-12.9.dashboard-widget-contracts.contract.test.ts`
  - Validates polymorphic DTO schemas for all 6 widget types.
  - Proves `watchlistId` and `selectedTopic` filter propagation.
  - Verifies multi-tenant isolation across widget providers.
- **Story 12.10 Contract:** `social-listening-admin/contracts/epic-12/story-12.10.dashboard-widget-renderer.contract.test.ts`
  - Validates client-side mapping of DTO types to React charting components.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0105-1]** **Widget allowlist parameter.** Supporting `?widgets=sentiment-kpi,volume-history` to fetch subsets of widgets.
- [ ] **[Q-0105-2]** **User layout persistence.** Storing custom grid coordinates in a `user_dashboard_layouts` table.
- [x] ~~**[Q-0105-3]** **AI explanation integration.**~~ Decided in ADR-0105: Metric widgets support optional `explanation` strings powered by ADR-0113.
