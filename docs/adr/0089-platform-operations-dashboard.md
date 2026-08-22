# ADR-0089: Platform operations dashboard

**Status:** Proposed (2026-08-23)

**Authorizes:** a `Platform-Admin` and `Sole-Operator` console that surfaces cross-tenant platform health, connector status, cloud cost, and capacity metrics, while strictly avoiding exposure of tenant post content.

**Source:** `docs/product-research/feature-designs/17-platform-operations-dashboard.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The platform is run by one person
`docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md` and `docs/product-research/feature-designs/17-platform-operations-dashboard.md` identify a need for a single operational view that tells `Sole-Operator` and `Platform-Admin` whether the platform is healthy, how much it is costing, and whether any tenant or connector needs attention.

### 2. Health and cost data already exist
`ADR-0009`/`ADR-0010` (ingestion health), `ADR-0051` (connector activation), and `ADR-0052` (live ingestion scheduler) already produce `ConnectorHealth`, `ingestion_runs`, and `connector_activations`. Azure Metrics and billing data are available from Azure. The dashboard aggregates these rather than creating new data sources.

### 3. Tenant content is off-limits
`Platform-Admin` has `BYPASSRLS` but is explicitly scoped to metadata and operational tables by `ADR-0030` §2. The dashboard must never display post bodies, watchlist queries, or user content. This ADR makes that boundary visible and enforceable.

---

## Decision

### 1. New `GET /v1/admin/platform-dashboard` endpoint
Returns a tenant-content-free summary:

```ts
{
  tenants: {
    total: number;
    active: number;
    suspended: number;
    newThisWeek: number;
  };
  connectors: {
    totalActive: number;
    byPlatform: Array<{ platformId: string; active: number; failing: number }>;
  };
  ingestion: {
    postsLast24h: number;
    runsLast24h: number;
    failingRuns: number;
  };
  health: {
    degradedConnectors: string[];
    platformStatus: 'healthy' | 'degraded' | 'unavailable';
  };
  cost: {
    estimatedDaily: number;     // currency-agnostic, in smallest unit
    currency: string;
    breakdown: Array<{ service: string; amount: number }>;
  };
  queues: {
    deadLetterCount: number;
    eventBacklog: number;
  };
}
```

### 2. Data sources
- `tenants` table for tenant counts.
- `connector_activations` and `ConnectorHealth` for active/failing connectors.
- `ingestion_runs` for post counts and failure rates.
- `platform_admin_audit_log` for recent platform-level events.
- Azure Metrics / Azure Cost Management for cost and queue depth.

### 3. No tenant content
The endpoint and UI may return:
- Counts and rates.
- Connector platform names and statuses.
- Tenant names and seat counts.
- Cost attribution by tenant/connector.

They must **not** return:
- Post bodies, comments, or raw payloads.
- Watchlist queries or search terms.
- User email addresses or personal data.
- Connector credentials or secrets.

### 4. Time windows and refresh
- Default time window: last 24 hours.
- Optional `start`/`end` query parameters.
- Data is cached for 60 seconds to avoid hammering Azure APIs.

### 5. UI layout
- `PlatformOperationsDashboard` with metric tiles, time-series charts, connector health table, and cost breakdown.
- `MetricTileGrid` shows the top-level numbers.
- `TimeSeriesChart` renders ingestion volume and cost over the selected window.
- `ConnectorHealthTable` lists failing connectors by platform.
- `CostBreakdownCard` shows spend by service.

---

## Consequences

1. **Single-pane operations:** the `Sole-Operator` can triage the platform without opening multiple Azure portals.
2. **Tenant content stays isolated:** the dashboard is explicitly scoped to metadata and operational tables.
3. **Cost and health visibility:** runaway ingestion or connector failures are visible in one place.
4. **Azure dependency:** cost and queue metrics rely on Azure APIs. If unavailable, the dashboard shows a degraded state.

---

## Alternatives considered

1. **Build a full observability stack (Grafana/Datadog) instead of an in-app dashboard.**
   - *Rejected:* it adds another bill and another system. An in-app dashboard using Azure Metrics is simpler for a solo project.

2. **Expose post counts but not post bodies.**
   - *Accepted:* counts are metadata and are the primary signal of platform activity. This is the boundary.

3. **Allow `Platform-Admin` to search tenant posts for debugging.**
   - *Rejected:* it violates the metadata-only boundary and creates a PII risk. Break-glass access is already governed by `ADR-0030` and a separate audit log.

---

## Open questions

- Which Azure cost API is the v1 source — Cost Management API, resource tags, or both?
- Should the dashboard also show projected monthly spend based on current daily run rate?
- How are multi-region deployments visualized — separate dashboards or region filters?
- Should tenants see a read-only version of this dashboard for their own tenant?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0030` (Platform Admin boundary), `ADR-0052` (live ingestion scheduler), `ADR-0010` (ingestion health), `ADR-0031` (audit log)
