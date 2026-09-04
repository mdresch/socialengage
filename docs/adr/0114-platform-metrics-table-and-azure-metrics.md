# ADR-0114: Platform metrics table and Azure Metrics integration

**Status:** Accepted (2026-08-28)

**Authorizes:** the `platform_metrics` table, the Azure Metrics ingestion path, and the aggregation rules that feed the Platform Operations Dashboard (ADR-0089).

**Source:** `docs/product-research/feature-designs/17-platform-operations-dashboard.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. The platform dashboard needs a data source
`ADR-0089` defined the Platform Operations Dashboard and its `GET /v1/admin/platform-dashboard` contract. This ADR defines the underlying `platform_metrics` table and the Azure Metrics integration that populates it.

### 2. Azure Metrics is the cheapest source for infra data
Azure provides cost, request, queue depth, and container metrics. A scheduled job can pull these and store them in the project database for fast dashboard queries.

### 3. The project already has Azure SDK access
`ADR-0014` (Azure resource model), `ADR-0016` (Azure Blob/Storage), and `ADR-0029` (Entra) established Azure-native patterns. Using Azure Monitor Metrics follows the same pattern.

---

## Decision

### 1. New `platform_metrics` table
```sql
platform_metrics (
  id uuid,
  metric_name text,             -- e.g. 'cost', 'posts_ingested', 'connector_runs'
  granularity text,             -- 'hour' | 'day'
  timestamp timestamptz,
  value numeric,
  unit text,                    -- 'usd', 'count', 'bytes', 'percent'
  dimensions jsonb,             -- { tenant_id, platform_id, service }
  source text,                  -- 'azure_metrics' | 'internal'
  created_at timestamptz
);
```

- `platform_metrics` is not tenant-scoped; it is a global platform table with `Platform-Admin` read access.
- `dimensions` carries optional breakdowns (tenant, platform, service) but never post content.

### 2. Internal metrics
- The ingestion worker writes `posts_ingested`, `ingestion_runs`, and `connector_health_changed` rows.
- `ingestion_runs` is the source; `platform_metrics` is a derived, time-bucketed roll-up for fast dashboard reads.

### 3. Azure Metrics ingestion
- A `PlatformMetricsWorker` runs every hour.
- It calls Azure Monitor Metrics API for:
  - `estimated_total_cost` per resource group (Azure Cost Management).
  - `container_cpu`, `container_memory` for the App Service / Container App.
  - `servicebus_active_messages` and `dead_letter_messages`.
  - `blob_storage_bytes` for the storage account.
- Results are written to `platform_metrics` at `hour` granularity.

### 4. Aggregation for the dashboard
- `GET /v1/admin/platform-dashboard` reads the last 24 hours (`day` granularity) and the last 7 days for charts.
- Costs are summed; counts are summed; percentages are averaged.
- The API uses `platform_metrics` rather than calling Azure APIs on every dashboard load.

### 5. Retention
- `platform_metrics` retains `hour` data for 7 days and `day` data for 365 days.
- Older data is archived to Blob or deleted per a retention policy.

---

## Consequences

1. **Fast dashboard:** the dashboard reads from a small, indexed table, not Azure APIs.
2. **Azure dependency:** the worker requires Azure Monitor and Cost Management permissions.
3. **Foundation for `Sole-Operator`:** one person can see platform health without opening Azure Portal.
4. **Cost tracking:** the `platform_metrics` table supports billing and capacity planning.

---

## Alternatives considered

1. **Query Azure Metrics directly from the dashboard endpoint.**
   - *Rejected:* it is slow and can hit throttling. A scheduled worker with a derived table is more predictable.

2. **Store only internal metrics and skip Azure infrastructure metrics.**
   - *Rejected:* infra cost and health are the primary concerns for the `Sole-Operator`. Azure Metrics are required.

3. **Use a third-party observability tool as the single metrics store.**
   - *Rejected:* it adds a new bill and system. Azure-native keeps the stack simple.

---

## Open Questions

- [ ] **[Q-0114-1]** Should `platform_metrics` be partitioned by `granularity` and `timestamp`?
- [ ] **[Q-0114-2]** How are Azure Cost Management delays handled? (Cost data is often 12-24 hours behind.)
- [ ] **[Q-0114-3]** Should `Tenant-Admin` see a read-only, tenant-filtered view of platform metrics for their own tenant?
- [ ] **[Q-0114-4]** What is the minimum Azure role needed for the worker to read metrics?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0089` (platform dashboard), `ADR-0016` (Azure resources), `ADR-0052` (live ingestion scheduler)
