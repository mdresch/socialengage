---
status: high-level
source: docs/project docs/Stakeholder Management/Feature-Persona-Acceptance-Mapping.md
created: 2026-08-23
---

# Platform operations dashboard

### What it is

A Platform-Admin and Sole-Operator console that shows the health, cost, capacity, and usage of the entire SocialEngage platform across all tenants. It is intentionally read-only and scoped so that platform operators cannot see tenant content.

### End-user benefits

- **Operational awareness:** spot capacity, cost, and health issues before they affect tenants.
- **Cost control:** track cloud spend, quota usage, and connector costs in one place.
- **Faster incident response:** correlate connector health, queue depth, and AI-provider status quickly.
- **Solo-operator friendly:** one screen for the entire platform's operational state.

### Core details

- Shows: active/suspended tenant count, connector health per platform, ingestion volume, queue depth, API rate-limit saturation, AI-provider quota/usage, cost by resource, error counts, and recovery trends.
- No access to tenant posts, watchlists, or user content.
- Supports time ranges, filtering by platform/region, and drill-down to the connector level.
- Alerting integration with `09-real-time-alerts.md` for platform-level health thresholds.

### Implementation complexity

**Medium-to-high.** Requires metrics aggregation, cost attribution, and a real-time or near-real-time view across multiple services. The heavy part is data collection and metric normalization.

### Growth and reach

Critical for go-live and multi-tenant operations. Becomes more valuable as the number of tenants, connectors, and AI calls grows.

---

## Technical design

- **Data flow:** platform metrics are emitted from `social-listening-core`, ingestion workers, and AI connectors → aggregated into a time-series store (e.g., Azure Metrics or a `platform_metrics` table) → `GET /v1/admin/platform-dashboard` returns summary and time-series data → `social-listening-admin` renders the dashboard.
- **Component interactions:** `PlatformOperationsDashboard` → `platformMetricsStore` → metric aggregation pipeline → Azure Monitor (optional).
- **REST/Service Bus contracts:** `GET /v1/admin/platform-dashboard` returns platform-wide aggregates. `GET /v1/admin/platform-dashboard/connectors` returns per-connector health. `PlatformHealthChangedEvent` published to Service Bus for alerting.
- **Storage:** `platform_metrics` table or Azure Monitor Metrics; `platform_admin_audit_log` for dashboard exports.
- **Security considerations:** Strictly `platform_admin` only. Tenant content never appears. Drill-down stops at metadata (connector ID, tenant name, counts).

## Backend principles

- **Tenant-content-free.** The dashboard must never expose post bodies, watchlist queries, or user content. It operates on counts, rates, and status.
- **Near-real-time.** Metrics should be fresh within one minute for health/cost and one hour for billing-grade cost attribution.
- **Cost-attributed.** Every metric should be traceable to a tenant or platform resource to support chargeback and optimization.
- **Alert-aware.** The dashboard integrates with existing platform-level alert rules.

## Frontend / UI principles

- **User flow:** Platform Admin signs in → lands on operations dashboard → selects time range and filters → expands any tile for detail.
- **Component hierarchy:** `PlatformOperationsDashboard` → `MetricTileGrid` → `TimeSeriesChart` → `ConnectorHealthTable` → `CostBreakdownCard`.
- **State management:** Server state with periodic refresh (e.g., 30s) for live metrics.
- **Accessibility and responsive design:** Charts have alt-text and data tables; colorblind-safe palette; responsive grid for mobile.

## Open questions

- Should cost metrics be approximate (real-time) or invoice-grade (delayed)?
- Should the dashboard be powered by Azure Monitor, a Postgres metrics table, or both?
- What is the retention period for platform metrics?
- Should tenants see a limited, read-only version of their own operational metrics?
- How do we handle multi-region deployments and cost attribution by region?

## AI enhancements

- **Anomaly explanation:** the AI explains why a metric is spiking, e.g., "Ingestion volume doubled because a new tenant activated Reddit."
- **Forecasting:** the AI projects cost and capacity needs for the next 30 days.
- **Smart alerting:** the AI recommends threshold changes for alert rules based on historical patterns.

## Persona acceptance

- **Sole-Operator (primary):** can open a single screen and know the platform's health, cost, and capacity without logging into multiple Azure portals.
- **Platform-Admin (primary):** can provision tenants and investigate platform-wide incidents from the same console.
- **Tenant-Admin (secondary):** (future) can see read-only health for their own tenant and connectors.
- **Legal-Advisor (secondary):** can verify that platform access is limited to metadata and that no tenant content is exposed.
