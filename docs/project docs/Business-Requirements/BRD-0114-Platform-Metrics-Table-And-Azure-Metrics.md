# BRD-0114: Platform Metrics Table and Azure Metrics Integration

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Platform Metrics Table and Azure Metrics Integration |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0114 and related feature design |

---

## 2. Executive Summary

The Platform Operations Dashboard (ADR-0089) needs a fast, predictable data source for health, cost, capacity, and usage metrics across all tenants. Today, the dashboard would have to call Azure APIs directly on every page load, which is slow, throttling-prone, and operationally fragile. This BRD defines the business need for a new `platform_metrics` table and an hourly Azure Metrics ingestion worker that together provide a cached, normalized time-series store for the dashboard.

At a glance, the solution is: (1) a global `platform_metrics` table that stores hourly and daily roll-ups of internal and Azure-sourced metrics, (2) a scheduled worker that pulls cost, container, queue, and storage metrics from Azure Monitor and Azure Cost Management, and (3) an aggregation layer so the Platform Operations Dashboard reads from the table instead of live Azure APIs.

The expected business value is a faster, more reliable operations console, reduced dependency on the Azure Portal for day-to-day platform health checks, a foundation for cost tracking and capacity planning, and a single screen that enables the `Sole-Operator` to triage the platform without opening multiple Azure portals.

> **Note on status:** ADR-0114 is currently **Proposed**, so this BRD is a draft for review and may change upon acceptance.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable a fast, reliable Platform Operations Dashboard | Dashboard page loads and time-series queries complete in under 2 seconds for 95th percentile of requests |
| 2 | Reduce operational dependency on the Azure Portal | `Sole-Operator` and `Platform-Admin` can triage health, cost, and queue depth without logging into Azure |
| 3 | Provide a cost and capacity foundation for the platform | Cloud spend and resource utilization are visible in a single, normalized time-series store |
| 4 | Preserve the tenant-content-free operational boundary | No post bodies, watchlist queries, or user PII is ever stored in `platform_metrics` |

---

## 4. Scope

### 4.1 In Scope

- Design and creation of a global `platform_metrics` table with `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, `source`, and `created_at` columns.
- Internal metric ingestion from the ingestion worker for `posts_ingested`, `ingestion_runs`, and `connector_health_changed`.
- An hourly `PlatformMetricsWorker` that pulls cost, container CPU/memory, Service Bus queue depth, and Blob Storage size from Azure Monitor / Azure Cost Management.
- Hourly and daily roll-up aggregation for the Platform Operations Dashboard.
- Retention policy: 7 days for hour-granularity data and 365 days for day-granularity data.
- Read access for `Platform-Admin` and `Sole-Operator` only; `platform_metrics` is not tenant-scoped.

### 4.2 Out of Scope

- The Platform Operations Dashboard UI itself (covered by ADR-0089 and Story 10.7).
- Real-time alerting rules and anomaly explanation features (covered by `09-real-time-alerts.md` and `22-metric-explainability`).
- A tenant-filtered, read-only metrics view for `Tenant-Admin` (reserved as an open question for a future ADR).
- Multi-region cost attribution by region.
- Invoice-grade, real-time cost allocation; this release uses best-effort Azure billing data.

### 4.3 Assumptions

- Azure SDK and credentials already exist in the project (ADR-0014, ADR-0016, ADR-0029).
- Azure Cost Management data may lag 12–24 hours; the dashboard will reflect the latest available data.
- The ingestion worker already emits the internal events needed to populate `posts_ingested`, `ingestion_runs`, and `connector_health_changed`.

### 4.4 Constraints

- `platform_metrics` must remain strictly tenant-content-free: no post bodies, watchlist queries, or user PII.
- Only `Platform-Admin` and `Sole-Operator` roles may read from `platform_metrics`.
- The solution must stay Azure-native to avoid adding new third-party observability bills.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Sole-Operator | Primary operator of the platform; runs SocialEngage alone | High | Single-screen health, cost, and capacity triage |
| Platform-Admin | Provisions tenants and investigates platform-wide incidents | High | Fast, authoritative operational data without Azure Portal |
| Tenant-Admin | Manages their own tenant (future, limited view) | Medium | Optional, read-only view of their own tenant metrics |
| Legal-Advisor | Verifies compliance and data handling | Medium | Confidence that `platform_metrics` never stores tenant content or PII |

---

## 6. Current State (As-Is)

The Platform Operations Dashboard (ADR-0089) defines a `GET /v1/admin/platform-dashboard` contract that requires tenant counts, connector health, ingestion volume, queue depth, and cost. Today, these data points live in separate places:

- Tenant counts come from the `tenants` table.
- Connector health comes from `connector_activations` and `ConnectorHealth`.
- Ingestion volume and run status come from `ingestion_runs`.
- Infrastructure cost, container utilization, and queue depth would require live calls to Azure Monitor and Azure Cost Management.

**Pain points:**

- Dashboard page loads would be slow and unpredictable because every load would call multiple Azure APIs.
- Azure API throttling and credential scoping make live queries operationally risky.
- Cost and infrastructure health are not pre-aggregated, so time-series charts are expensive to generate.
- The `Sole-Operator` must open multiple Azure portals to get a complete picture.

---

## 7. Future State (To-Be)

After this initiative, the platform will have a dedicated `platform_metrics` table that acts as a normalized time-series store for both internal and Azure-sourced operational metrics.

**New or improved process:**

1. The ingestion worker writes internal operational events (`posts_ingested`, `ingestion_runs`, `connector_health_changed`) to `platform_metrics` as they happen.
2. The `PlatformMetricsWorker` runs every hour, pulls cost, container, queue, and storage metrics from Azure, and writes them into `platform_metrics` at hour granularity.
3. Daily roll-ups are produced from the hourly data.
4. The Platform Operations Dashboard calls `GET /v1/admin/platform-dashboard`, which reads from `platform_metrics` instead of live Azure APIs.
5. Old data is archived or deleted according to the retention policy (7 days for hourly, 365 days for daily).

**Expected capabilities:**

- Fast, indexed dashboard reads.
- Hourly refreshed cost, queue, container, and storage metrics.
- Internal and external metrics stored in a single, queryable schema.
- A clear content boundary: only counts, rates, statuses, and dimensions—never tenant posts or PII.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a global `platform_metrics` table for operational time-series data | Must | Table exists with columns `id`, `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, `source`, and `created_at` | Product Owner |
| BR-002 | The system shall ingest internal metrics from the ingestion pipeline | Must | `posts_ingested`, `ingestion_runs`, and `connector_health_changed` rows are written by the ingestion worker | Product Owner |
| BR-003 | The system shall pull infrastructure metrics from Azure every hour | Must | `PlatformMetricsWorker` runs hourly and fetches `estimated_total_cost`, `container_cpu`, `container_memory`, `servicebus_active_messages`, `dead_letter_messages`, and `blob_storage_bytes` | Product Owner |
| BR-004 | The system shall support hourly and daily granularity roll-ups | Must | Hour data retained 7 days, day data retained 365 days; dashboard reads last 24 hours and last 7 days | Product Owner |
| BR-005 | The system shall expose `platform_metrics` to `Platform-Admin` and `Sole-Operator` only | Must | Only `Platform-Admin`/`Sole-Operator` roles can read `platform_metrics` | Product Owner |
| BR-006 | The system shall aggregate metrics correctly for the dashboard | Should | Costs are summed, counts are summed, and percentages are averaged per dashboard time window | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard data must be fresh within one hour for infrastructure metrics and within one minute for health/cost data | Performance | Must | Worker runs hourly; dashboard refreshes every 60 seconds for live tiles |
| NFR-002 | `platform_metrics` must never store tenant post content, watchlist queries, or user PII | Security | Must | Audit and automated test confirm no post bodies, queries, or PII columns exist |
| NFR-003 | The worker must be resilient to Azure API delays and throttling | Reliability | Should | Worker logs failures, backs off, and does not block dashboard reads when Azure is unavailable |
| NFR-004 | `platform_metrics` must support fast, indexed time-series reads | Performance | Must | 95th percentile dashboard query time is under 2 seconds |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `platform_metrics` is a global, non-tenant-scoped table; read access is restricted to `Platform-Admin` and `Sole-Operator`. |
| BRU-002 | `dimensions` may carry optional breakdowns such as `tenant_id`, `platform_id`, and `service`, but may never include post content, watchlist queries, or user PII. |
| BRU-003 | Internal metrics are derived from `ingestion_runs`; `platform_metrics` is a derived, time-bucketed roll-up for fast dashboard reads. |
| BRU-004 | Hour-granularity data is retained for 7 days; day-granularity data is retained for 365 days. |
| BRU-005 | Costs are summed, counts are summed, and percentages are averaged when aggregating for the dashboard. |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Estimated total cloud cost | Track platform spend and support chargeback | Sole-Operator, Platform-Admin | Hourly refresh, daily roll-up |
| Container CPU and memory | Spot capacity pressure before it affects tenants | Sole-Operator, Platform-Admin | Hourly |
| Service Bus active and dead-letter messages | Identify queue backlogs and failing consumers | Sole-Operator, Platform-Admin | Hourly |
| Blob Storage size | Track storage growth and cost | Sole-Operator, Platform-Admin | Hourly |
| Posts ingested count | Correlate ingestion volume with cost and incidents | Sole-Operator, Platform-Admin | Hourly / daily |
| Connector health changes | Surface failing or degraded connectors | Sole-Operator, Platform-Admin | Event-driven / hourly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure Cost Management data is 12–24 hours delayed, making cost displays stale | High | Medium | Document the lag in the dashboard and use the latest available data; consider dual cost sources in a later ADR | Product Owner |
| R-002 | Azure API throttling or outages interrupt metric collection | Medium | Medium | Worker retries with exponential backoff and surfaces a degraded state in the dashboard | Technical Lead |
| R-003 | `platform_metrics` accidentally captures tenant content or PII | Low | High | Automated contract test enforces the tenant-content-free rule; code review focuses on `dimensions` content | Legal-Advisor |
| R-004 | Retention policy causes unbounded table growth | Medium | Medium | 7-day hourly / 365-day daily retention with scheduled archival to Blob or deletion | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0089 (Platform Operations Dashboard) | Internal / Consuming ADR | Product Owner | Aligned before UI story pickup |
| D-002 | ADR-0052 (live ingestion scheduler) for `ingestion_runs` events | Internal / Foundation | Technical Lead | Already in place |
| D-003 | Azure Monitor and Azure Cost Management permissions for the worker | External / Azure | Technical Lead | Before worker deployment |
| D-004 | ADR-0014/ADR-0016/ADR-0029 Azure-native patterns | Internal / Foundation | Technical Lead | Already in place |

---

## 14. Acceptance Criteria

- `platform_metrics` table exists with `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, and `source` columns.
- `PlatformMetricsWorker` pulls cost, queue, container, and ingestion metrics from Azure Monitor / Cost Management every hour.
- Hourly and daily roll-ups are supported, with 7-day hourly and 365-day daily retention.
- `GET /v1/admin/platform-dashboard` uses `platform_metrics` for charts and summary data.
- No tenant post content, watchlist queries, or user PII is stored in `platform_metrics`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `platform_metrics` | A global, time-series table that stores internal and Azure-sourced operational metrics for the Platform Operations Dashboard. |
| `PlatformMetricsWorker` | A scheduled worker that pulls infrastructure metrics from Azure Monitor and Azure Cost Management and writes them to `platform_metrics`. |
| `Sole-Operator` | The single person responsible for running the SocialEngage platform; primary consumer of the Platform Operations Dashboard. |
| `Platform-Admin` | A platform-wide administrator role with read access to operational data and tenant management. |
| `Granularity` | The time bucket size of a metric row, either `hour` or `day`. |
| `Dimensions` | Optional JSONB key/value breakdowns for a metric, such as tenant, platform, or service. |

---

## 16. Appendices

- **Architecture Decision Record:** `docs/adr/0114-platform-metrics-table-and-azure-metrics.md`
- **Parent feature design:** `docs/product-research/feature-designs/17-platform-operations-dashboard.md`
- **Scoping plan:** `docs/product-research/feature-adr-scoping.md`
- **Related ADR:** `docs/adr/0089-platform-operations-dashboard.md`
- **Related user stories:**
  - Story 10.6 — Platform metrics table and Azure Metrics integration (backend), `docs/user-stories/epic-10-adr-0086-to-0094.md`
  - Story 13.8 — Platform metrics table and Azure Metrics (backend), `docs/user-stories/epic-13-adr-0109-to-0117.md`
- **Missing source note:** No `docs/product-research/reports/<feature>-deep-research.md` file was found for the platform operations dashboard feature.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
