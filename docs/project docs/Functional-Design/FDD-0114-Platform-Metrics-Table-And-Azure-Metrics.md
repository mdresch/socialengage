# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Platform Metrics Table and Azure Metrics Integration |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0114, BRD-0114, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

The Platform Operations Dashboard (ADR-0089) needs a fast, predictable data source for health, cost, capacity, and usage metrics across all tenants. Today, the dashboard would have to call Azure APIs directly on every page load, which is slow, throttling-prone, and operationally fragile. This BRD defines the business need for a new `platform_metrics` table and an hourly Azure Metrics ingestion worker that together provide a cached, normalized time-series store for the dashboard.

This FDD translates the accepted architecture and business requirements from ADR-0114 and BRD-0114 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Design and creation of a global `platform_metrics` table with `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, `source`, and `created_at` columns.
- Internal metric ingestion from the ingestion worker for `posts_ingested`, `ingestion_runs`, and `connector_health_changed`.
- An hourly `PlatformMetricsWorker` that pulls cost, container CPU/memory, Service Bus queue depth, and Blob Storage size from Azure Monitor / Azure Cost Management.
- Hourly and daily roll-up aggregation for the Platform Operations Dashboard.
- Retention policy: 7 days for hour-granularity data and 365 days for day-granularity data.
- Read access for `Platform-Admin` and `Sole-Operator` only; `platform_metrics` is not tenant-scoped.
- **Out of scope:** - The Platform Operations Dashboard UI itself (covered by ADR-0089 and Story 10.7).
- Real-time alerting rules and anomaly explanation features (covered by `09-real-time-alerts.md` and `22-metric-explainability`).
- A tenant-filtered, read-only metrics view for `Tenant-Admin` (reserved as an open question for a future ADR).
- Multi-region cost attribution by region.
- Invoice-grade, real-time cost allocation; this release uses best-effort Azure billing data.
- **Assumptions and constraints:** - Azure SDK and credentials already exist in the project (ADR-0014, ADR-0016, ADR-0029).
- Azure Cost Management data may lag 12–24 hours; the dashboard will reflect the latest available data.
- The ingestion worker already emits the internal events needed to populate `posts_ingested`, `ingestion_runs`, and `connector_health_changed`.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. The platform dashboard needs a data source
`ADR-0089` defined the Platform Operations Dashboard and its `GET /v1/admin/platform-dashboard` contract. This ADR defines the underlying `platform_metrics` table and the Azure Metrics integration that populates it.

### 2. Azure Metrics is the cheapest source for infra data
Azure provides cost, request, queue depth, and container metrics. A scheduled job can pull these and store them in the project database for fast dashboard queries.

### 3. The project already has Azure SDK access
`ADR-0014` (Azure resource model), `ADR-0016` (Azure Blob/Storage), and `ADR-0029` (Entra) established Azure-native patterns. Using Azure Monitor Metrics follows the same pattern.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable a fast, reliable Platform Operations Dashboard | Dashboard page loads and time-series queries complete in under 2 seconds for 95th percentile of requests |
| 2 | Reduce operational dependency on the Azure Portal | `Sole-Operator` and `Platform-Admin` can triage health, cost, and queue depth without logging into Azure |
| 3 | Provide a cost and capacity foundation for the platform | Cloud spend and resource utilization are visible in a single, normalized time-series store |
| 4 | Preserve the tenant-content-free operational boundary | No post bodies, watchlist queries, or user PII is ever stored in `platform_metrics` |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a global `platform_metrics` table for operational time-series data | Must | Table exists with columns `id`, `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, `source`, and `created_at` | Product Owner |
| BR-002 | The system shall ingest internal metrics from the ingestion pipeline | Must | `posts_ingested`, `ingestion_runs`, and `connector_health_changed` rows are written by the ingestion worker | Product Owner |
| BR-003 | The system shall pull infrastructure metrics from Azure every hour | Must | `PlatformMetricsWorker` runs hourly and fetches `estimated_total_cost`, `container_cpu`, `container_memory`, `servicebus_active_messages`, `dead_letter_messages`, and `blob_storage_bytes` | Product Owner |
| BR-004 | The system shall support hourly and daily granularity roll-ups | Must | Hour data retained 7 days, day data retained 365 days; dashboard reads last 24 hours and last 7 days | Product Owner |
| BR-005 | The system shall expose `platform_metrics` to `Platform-Admin` and `Sole-Operator` only | Must | Only `Platform-Admin`/`Sole-Operator` roles can read `platform_metrics` | Product Owner |
| BR-006 | The system shall aggregate metrics correctly for the dashboard | Should | Costs are summed, counts are summed, and percentages are averaged per dashboard time window | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Sole-Operator | Primary operator of the platform; runs SocialEngage alone | High | Single-screen health, cost, and capacity triage |
| Platform-Admin | Provisions tenants and investigates platform-wide incidents | High | Fast, authoritative operational data without Azure Portal |
| Tenant-Admin | Manages their own tenant (future, limited view) | Medium | Optional, read-only view of their own tenant metrics |
| Legal-Advisor | Verifies compliance and data handling | Medium | Confidence that `platform_metrics` never stores tenant content or PII |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 10.6 | backend engineer | a `platform_metrics` table and an hourly Azure Monitor ingestion worker, | the platform operations dashboard has fast, cached infrastructure data. | `platform_metrics` table exists with `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, and `source`.; `PlatformMetricsWorker` pulls cost, queue, container, and ingestion metrics from Azure Monitor / Cost Management.; Hourly and daily roll-ups are supported. |
| 13.8 | backend engineer | `platform_metrics` and an hourly Azure Monitor worker, | the platform dashboard has fast, cached infrastructure data. | `platform_metrics` table exists with `metric_name`, `granularity`, `value`, `unit`, `dimensions`, `source`.; Hourly worker pulls cost, queue, container, and ingestion metrics.; `GET /v1/admin/platform-dashboard` uses `platform_metrics` for charts. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_metrics.id` | Unique row identifier | System-generated | Platform-Admin | Operational |
| `platform_metrics.metric_name` | Name of the metric, e.g. `cost`, `posts_ingested`, `connector_runs` | Ingestion worker / Azure Monitor | Platform-Admin | Operational |
| `platform_metrics.granularity` | Time bucket: `hour` or `day` | Aggregation pipeline | Platform-Admin | Operational |
| `platform_metrics.timestamp` | Start of the time bucket | Ingestion worker / Azure Monitor | Platform-Admin | Operational |
| `platform_metrics.value` | Numeric metric value | Ingestion worker / Azure Monitor | Platform-Admin | Operational |
| `platform_metrics.unit` | Unit of measure: `usd`, `count`, `bytes`, `percent` | Ingestion worker / Azure Monitor | Platform-Admin | Operational |
| `platform_metrics.dimensions` | JSONB breakdowns such as `tenant_id`, `platform_id`, `service` | Ingestion worker / Azure Monitor | Platform-Admin | Operational; must not contain PII |
| `platform_metrics.source` | Origin of the row: `azure_metrics` or `internal` | Ingestion worker / Azure Monitor | Platform-Admin | Operational |
| `platform_metrics.created_at` | Row insertion timestamp | System-generated | Platform-Admin | Operational |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | `platform_metrics` is a global, non-tenant-scoped table; read access is restricted to `Platform-Admin` and `Sole-Operator`. |
| BRU-002 | `dimensions` may carry optional breakdowns such as `tenant_id`, `platform_id`, and `service`, but may never include post content, watchlist queries, or user PII. |
| BRU-003 | Internal metrics are derived from `ingestion_runs`; `platform_metrics` is a derived, time-bucketed roll-up for fast dashboard reads. |
| BRU-004 | Hour-granularity data is retained for 7 days; day-granularity data is retained for 365 days. |
| BRU-005 | Costs are summed, counts are summed, and percentages are averaged when aggregating for the dashboard. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard data must be fresh within one hour for infrastructure metrics and within one minute for health/cost data | Performance | Must | Worker runs hourly; dashboard refreshes every 60 seconds for live tiles |
| NFR-002 | `platform_metrics` must never store tenant post content, watchlist queries, or user PII | Security | Must | Audit and automated test confirm no post bodies, queries, or PII columns exist |
| NFR-003 | The worker must be resilient to Azure API delays and throttling | Reliability | Should | Worker logs failures, backs off, and does not block dashboard reads when Azure is unavailable |
| NFR-004 | `platform_metrics` must support fast, indexed time-series reads | Performance | Must | 95th percentile dashboard query time is under 2 seconds |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure Cost Management data is 12–24 hours delayed, making cost displays stale | High | Medium | Document the lag in the dashboard and use the latest available data; consider dual cost sources in a later ADR | Product Owner |
| R-002 | Azure API throttling or outages interrupt metric collection | Medium | Medium | Worker retries with exponential backoff and surfaces a degraded state in the dashboard | Technical Lead |
| R-003 | `platform_metrics` accidentally captures tenant content or PII | Low | High | Automated contract test enforces the tenant-content-free rule; code review focuses on `dimensions` content | Legal-Advisor |
| R-004 | Retention policy causes unbounded table growth | Medium | Medium | 7-day hourly / 365-day daily retention with scheduled archival to Blob or deletion | Technical Lead |

---

---

## 12. Assumptions and Dependencies

- Azure SDK and credentials already exist in the project (ADR-0014, ADR-0016, ADR-0029).
- Azure Cost Management data may lag 12–24 hours; the dashboard will reflect the latest available data.
- The ingestion worker already emits the internal events needed to populate `posts_ingested`, `ingestion_runs`, and `connector_health_changed`.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0089 (Platform Operations Dashboard) | Internal / Consuming ADR | Product Owner | Aligned before UI story pickup |
| D-002 | ADR-0052 (live ingestion scheduler) for `ingestion_runs` events | Internal / Foundation | Technical Lead | Already in place |
| D-003 | Azure Monitor and Azure Cost Management permissions for the worker | External / Azure | Technical Lead | Before worker deployment |
| D-004 | ADR-0014/ADR-0016/ADR-0029 Azure-native patterns | Internal / Foundation | Technical Lead | Already in place |

---

---

## 13. Open Questions

- Should `platform_metrics` be partitioned by `granularity` and `timestamp`?
- How are Azure Cost Management delays handled? (Cost data is often 12-24 hours behind.)
- Should `Tenant-Admin` see a read-only, tenant-filtered view of platform metrics for their own tenant?
- What is the minimum Azure role needed for the worker to read metrics?

---

---

## 14. Appendix

### Reference Documents

- ADR-0114: `docs/adr/0114-platform-metrics-table-and-azure-metrics.md`
- BRD-0114: `docs/project docs/Business-Requirements/BRD-0114-Platform-Metrics-Table-And-Azure-Metrics.md`
- Feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md`
- User stories: `docs/user-stories/epic-10-adr-0086-to-0094.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0114 and BRD-0114. |