# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0089 Platform Operations Dashboard — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Draft |
| Related Documents | ADR-0089 (platform operations dashboard), ADR-0030 (Platform-Admin metadata-only boundary), ADR-0052 (live ingestion scheduler), ADR-0010 (ingestion health), ADR-0031 (platform admin audit log), BRD-0089, `docs/product-research/feature-designs/17-platform-operations-dashboard.md`, `docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md`, Stories 10.6 and 10.7 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0089's decision — a `GET /v1/admin/platform-dashboard` endpoint and its `PlatformOperationsDashboard` UI that aggregate cross-tenant platform health, connector status, cost, and capacity metrics while strictly excluding tenant content — into a functional design covering data aggregation, the metadata-only boundary, caching, and UI presentation.

**Note:** ADR-0089's Status is **Proposed**, not Accepted. This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:** `GET /v1/admin/platform-dashboard` and its response shape; the `platform_metrics` table and hourly `PlatformMetricsWorker` (Story 10.6); the metadata-only content boundary (what may and may never be returned); time-window selection and 60-second caching; the `PlatformOperationsDashboard` UI (`MetricTileGrid`, `TimeSeriesChart`, `ConnectorHealthTable`, `CostBreakdownCard`).
- **Out of scope:** a full third-party observability stack (Grafana/Datadog); search or display of tenant posts for debugging; write/modify actions on connectors, tenants, or queues from this dashboard; invoice-grade billing; multi-region deployment visualization in v1; a tenant-facing read-only variant (future consideration).

### 2.3 Target Audience

Backend engineers implementing the metrics worker and endpoint, frontend engineers implementing the dashboard UI, the Sole-Operator/Platform-Admin as primary users, and Legal-Advisor reviewing the content-exclusion boundary.

---

## 3. Context and Background

SocialEngage is run by a single `Sole-Operator`, supported by the `Platform-Admin` role. Today, understanding platform health, connector status, cost, and capacity requires opening multiple Azure portals and stitching together data manually — slow, error-prone, and unsuited to a solo-operated project. The underlying data already exists: `ADR-0009`/`ADR-0010` (ingestion health), `ADR-0051` (connector activation), and `ADR-0052` (live ingestion scheduler) already produce `ConnectorHealth`, `ingestion_runs`, and `connector_activations`; Azure Metrics/Cost Management supply cloud cost and queue data. ADR-0089 aggregates these into one console rather than creating new data sources, while making the existing `Platform-Admin` metadata-only boundary (ADR-0030 §2) explicit and enforced: the dashboard must never expose post bodies, watchlist queries, or personal data, even though `Platform-Admin` technically has `BYPASSRLS`.

Source requirements: ADR-0089, BRD-0089, Stories 10.6 (backend metrics infrastructure) and 10.7 (frontend dashboard) in `docs/user-stories/epic-10-adr-0086-to-0094.md`.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Give the Sole-Operator a single-pane operational view | Operator can triage platform health/cost/capacity without opening Azure Portal |
| G2 | Guarantee tenant content is never exposed | Independent review confirms no post bodies, watchlist queries, user emails, or secrets appear anywhere on the dashboard |
| G3 | Surface incidents quickly | Connector/queue issues visible within the cache-refresh window (60 seconds) |
| G4 | Provide actionable cost visibility | Daily cost estimate and per-service breakdown are shown |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `platform_metrics` Table and `PlatformMetricsWorker`

- **Description:** A backend worker that pulls cost, queue, container, and ingestion metrics from Azure Monitor / Cost Management and persists them into a `platform_metrics` table so the dashboard can read fast, cached infrastructure data instead of calling Azure APIs synchronously on every dashboard load.
- **Triggers:** Runs on an hourly schedule.
- **Inputs:** Azure Monitor and Azure Cost Management API responses; internal `ingestion_runs`, `connector_activations`, `ConnectorHealth` for platform-native metrics.
- **Processing:** Pulls cost, queue depth, container, and ingestion metrics; writes hourly roll-ups; also maintains daily roll-ups (aggregated from the hourly data). Retention: 7 days for hourly rows, 365 days for daily rows. No tenant post content is ever written to `platform_metrics` — only counts, rates, and cost figures.
- **Outputs:** Populated `platform_metrics` rows consumed by `GET /v1/admin/platform-dashboard`.
- **Error handling:** An Azure API failure during a scheduled run is logged and does not crash the worker; the next hourly run retries. The dashboard endpoint falls back to the last successfully cached values and reports a degraded status (Section 5.3) rather than erroring.
- **Edge cases:** A gap in hourly data (missed run) should not silently present stale data as current — the dashboard's freshness indicator should reflect the actual last-updated time.

### 5.2 Feature / Capability: `GET /v1/admin/platform-dashboard`

- **Description:** Returns a tenant-content-free, aggregated summary of platform health, connectors, ingestion, cost, and queues.
- **Triggers:** Called by the `PlatformOperationsDashboard` UI, or directly by an authorized operator/tool.
- **Inputs:** Optional `start`/`end` query parameters (time window); the caller's role (must be `Platform-Admin` or equivalent to access this endpoint at all).
- **Processing:**
  1. Authorize the caller as `Platform-Admin`/`Sole-Operator`; reject any other role.
  2. Determine the time window: default last 24 hours, or the caller-supplied `start`/`end`.
  3. Aggregate `tenants` (total/active/suspended/new this week) from the `tenants` table.
  4. Aggregate `connectors` (total active, by-platform active/failing counts) from `connector_activations` and `ConnectorHealth`.
  5. Aggregate `ingestion` (posts and runs in the window, failing-run count) from `ingestion_runs`.
  6. Determine overall `health.platformStatus` (`healthy`/`degraded`/`unavailable`) and the list of `degradedConnectors`.
  7. Read `cost` (estimated daily spend, currency, per-service breakdown) and `queues` (dead-letter count, event backlog) from `platform_metrics` (populated by the worker in Section 5.1), not by calling Azure synchronously.
  8. Apply the 60-second cache (Section 5.4) before returning.
- **Outputs:**
  ```ts
  { tenants: { total, active, suspended, newThisWeek },
    connectors: { totalActive, byPlatform: [{ platformId, active, failing }] },
    ingestion: { postsLast24h, runsLast24h, failingRuns },
    health: { degradedConnectors: string[], platformStatus: 'healthy'|'degraded'|'unavailable' },
    cost: { estimatedDaily, currency, breakdown: [{ service, amount }] },
    queues: { deadLetterCount, eventBacklog } }
  ```
- **Error handling:** A caller without `Platform-Admin`/`Sole-Operator` access is rejected (authorization error), not merely given an empty response. If cost/queue metrics are unavailable (Azure outage propagated through `platform_metrics` staleness), those fields are marked degraded rather than omitted or fabricated.
- **Edge cases:** A brand-new platform instance with no tenants yet returns zeroed counts, not an error. A time window with no runs/posts at all returns zero values, not an error.

### 5.3 Feature / Capability: Metadata-Only Content Boundary Enforcement

- **Description:** Enforces, structurally and by contract, that the dashboard endpoint/UI can never surface tenant content.
- **Triggers:** Applies continuously to every field returned by Section 5.2.
- **Inputs:** N/A — a constraint on the response shape, not a separate trigger.
- **Processing:** The response schema is limited to counts, rates, connector platform names/statuses, tenant names, seat counts, and cost attribution by tenant/connector. It explicitly excludes: post bodies, comments, or raw payloads; watchlist queries or search terms; user email addresses or other personal data; connector credentials or secrets. This is enforced at the query/aggregation layer (queries never `SELECT` content columns) and verified by contract tests, not left to UI-layer filtering alone.
- **Outputs:** A response guaranteed free of tenant content by construction.
- **Error handling:** Any code path that would add a new field to the response must pass a contract check confirming the field is not a content/PII column before it can ship.
- **Edge cases:** `Platform-Admin`'s `BYPASSRLS` capability (ADR-0030) is a database-level permission, not an implicit authorization to display content through this dashboard — the boundary here is enforced regardless of what the underlying role could technically query. Break-glass tenant-content access, when it happens, is governed separately by ADR-0030 and its own audit log, never through this dashboard.

### 5.4 Feature / Capability: Time Window Selection and Caching

- **Description:** Lets the caller select a time range and protects downstream Azure APIs via caching.
- **Triggers:** Every call to `GET /v1/admin/platform-dashboard`.
- **Inputs:** Optional `start`/`end` query parameters.
- **Processing:** Defaults to the last 24 hours when no window is supplied. Aggregated response data is cached for at least 60 seconds so repeated dashboard loads/refreshes do not re-trigger expensive aggregation or Azure calls.
- **Outputs:** A response reflecting the requested (or default) window, served from cache when within the cache TTL.
- **Error handling:** An invalid `start`/`end` combination (e.g., `start` after `end`) is rejected with a validation error.
- **Edge cases:** A request immediately after the cache expires triggers a fresh aggregation; concurrent requests during that window should not each trigger a duplicate expensive recomputation (single-flight or similar behavior is a reasonable implementation choice).

### 5.5 Feature / Capability: `PlatformOperationsDashboard` UI

- **Description:** The console presenting the aggregated data as tiles, charts, and tables.
- **Triggers:** `Sole-Operator`/`Platform-Admin` navigates to the dashboard in the admin console.
- **Inputs:** The `GET /v1/admin/platform-dashboard` response; user-selected time range.
- **Processing:**
  - `MetricTileGrid` renders the top-level numbers (tenant counts, active connectors, posts in the last 24h, estimated daily cost, queue backlogs).
  - `TimeSeriesChart` renders ingestion volume and cost over the selected window.
  - `ConnectorHealthTable` lists failing connectors grouped by platform.
  - `CostBreakdownCard` shows spend by service.
  - Time range and refresh controls let the user adjust the window and manually refresh (respecting the cache).
- **Outputs:** A rendered, read-only operational console.
- **Error handling:** If the endpoint reports a degraded/unavailable status for cost or queue data, the UI visibly marks those sections as degraded rather than showing blank or stale-looking numbers without explanation.
- **Edge cases:** A dashboard opened for the first time on a fresh platform instance (few/no tenants) still renders correctly with zeroed tiles rather than erroring or showing empty/broken layout.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Sole-Operator | Primary day-to-day operator; single-screen triage |
| Platform-Admin | Provisioning and incident investigation |
| Backend Engineer | Implements `PlatformMetricsWorker`, `platform_metrics`, and the endpoint |
| Frontend Engineer | Implements `PlatformOperationsDashboard` |
| Legal-Advisor | Reviews evidence of the metadata-only boundary |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 10.6) | Backend engineer | Have a `platform_metrics` table and an hourly Azure Monitor ingestion worker | The platform operations dashboard has fast, cached infrastructure data | `platform_metrics` table exists; `PlatformMetricsWorker` pulls cost/queue/container/ingestion metrics from Azure Monitor/Cost Management; hourly and daily roll-ups supported; retention 7 days hourly / 365 days daily; no tenant post content stored |
| US2 (Story 10.7) | Platform-Admin / Sole-Operator | Have a dashboard showing tenant counts, connector health, ingestion volume, and cost | Triage the platform without opening Azure Portal | `PlatformOperationsDashboard` with metric tiles, time-series charts, connector health table; `GET /v1/admin/platform-dashboard` consumed with 60-second cache; UI never displays post bodies, watchlist queries, or user PII; time range and refresh controls available |

### 6.3 Workflow Diagrams / Steps

**Backend metrics pipeline (hourly):**
1. `PlatformMetricsWorker` wakes on schedule.
2. Pulls cost, queue, container, and ingestion metrics from Azure Monitor / Cost Management.
3. Writes hourly roll-up rows to `platform_metrics`; maintains daily roll-ups.
4. Applies retention (prune hourly rows older than 7 days; daily rows older than 365 days).

**Dashboard load:**
1. `Platform-Admin`/`Sole-Operator` opens `PlatformOperationsDashboard`.
2. UI calls `GET /v1/admin/platform-dashboard` (default last-24h window, or a previously selected window).
3. Endpoint aggregates `tenants`/`connectors`/`ingestion`/`health` from live tables and `cost`/`queues` from `platform_metrics`, applying the 60-second cache.
4. UI renders `MetricTileGrid`, `TimeSeriesChart`, `ConnectorHealthTable`, `CostBreakdownCard`.
5. User adjusts the time range or manually refreshes → repeats from step 2.

---

## 7. Data Requirements

### 7.1 Data Inputs

`tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, `platform_admin_audit_log` (internal tables); Azure Monitor and Azure Cost Management API data (external, via `PlatformMetricsWorker`).

### 7.2 Data Outputs

The `GET /v1/admin/platform-dashboard` response payload; `platform_metrics` rows (hourly/daily roll-ups); rendered dashboard UI.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `platform_metrics` | Metric type/category, timestamp, granularity (`hourly`/`daily`), value(s) (cost, queue depth, container metrics, ingestion counts) | Populated by `PlatformMetricsWorker`; read by the dashboard endpoint; retained 7 days (hourly) / 365 days (daily) |
| Dashboard response (`PlatformDashboardSummary`) | `tenants{total,active,suspended,newThisWeek}`, `connectors{totalActive,byPlatform[]}`, `ingestion{postsLast24h,runsLast24h,failingRuns}`, `health{degradedConnectors[],platformStatus}`, `cost{estimatedDaily,currency,breakdown[]}`, `queues{deadLetterCount,eventBacklog}` | Assembled per-request (subject to caching) from `tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, and `platform_metrics` |
| `tenants` (external) | Tenant identity, status, creation date | Source for `tenants` counts |
| `connector_activations` / `ConnectorHealth` (external, ADR-0051/ADR-0010) | Connector activation state, health status | Source for `connectors`/`health` |
| `ingestion_runs` (external, ADR-0052) | Run outcome, post counts, timestamps | Source for `ingestion` |
| `platform_admin_audit_log` (external, ADR-0031) | Recent platform-level events | Referenced context, not directly in the response payload per the ADR's field list |

### 7.4 Validation Rules

- `start`/`end` query parameters, when provided, must form a valid range (`start` ≤ `end`).
- Every response field must be traceable to an allowed source (counts/rates/statuses/cost attribution) — no field may originate from a content or PII column.
- `platformStatus` must be one of `healthy`/`degraded`/`unavailable`.
- Cached responses must not be served past the 60-second TTL without a documented refresh.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | The dashboard may display counts, rates, connector platform names, statuses, tenant names, and seat counts only. | Response shape |
| BR2 | The dashboard must never display post bodies, comments, raw payloads, watchlist queries, search terms, user email addresses, or other personal data. | Response shape |
| BR3 | The dashboard must never display connector credentials or secrets. | Response shape |
| BR4 | `Platform-Admin` access here is scoped to metadata and operational tables; break-glass tenant-content access is governed separately by ADR-0030 and its own audit log. | Access boundary |
| BR5 | Cost and queue metrics are sourced from Azure; if Azure is unavailable, the dashboard surfaces a degraded state rather than synthetic values. | Cost/queue data |
| BR6 | The default time window is the last 24 hours, with optional user selection of a different range. | Time window |
| BR7 | Dashboard data must be cached for at least 60 seconds to prevent excessive Azure API calls. | Caching |
| BR8 | This dashboard is strictly read-only; no controls modify tenants, connectors, or data from this screen. | UI |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `tenants` table | Inbound (read) | Tenant counts | SQL (Postgres) |
| `connector_activations` / `ConnectorHealth` (ADR-0051/0010) | Inbound (read) | Connector health/activation counts | SQL (Postgres) |
| `ingestion_runs` (ADR-0052) | Inbound (read) | Ingestion volume and failure rates | SQL (Postgres) |
| `platform_admin_audit_log` (ADR-0031) | Inbound (read, contextual) | Recent platform-level events | SQL (Postgres) |
| Azure Monitor / Azure Cost Management | Inbound (via `PlatformMetricsWorker`) | Cost, queue depth, container, ingestion metrics | Azure API |
| `platform_metrics` table | Inbound (read) | Cached cost/queue data for the dashboard endpoint | SQL (Postgres) |
| `PlatformOperationsDashboard` (UI) | Inbound (consumer) | Calls `GET /v1/admin/platform-dashboard` | REST / JSON over HTTPS |

---

## 10. Non-Functional Considerations

- **Security:** Dashboard data must be tenant-content-free (NFR-001), independently verifiable. Access is restricted to `Platform-Admin`/`Sole-Operator` roles (NFR-003).
- **Performance:** Health/cost data is fresh within one minute; billing-grade cost attribution within one hour (NFR-002).
- **Usability:** UI must be responsive and colorblind-safe, meeting WCAG contrast and keyboard-navigation checks (NFR-004).
- **Reliability:** Azure API outages degrade gracefully — the dashboard reports `degraded`/`unavailable` rather than erroring or showing stale data as if current (NFR-005).
- **Cost visibility:** Cost figures are explicitly labeled as estimates, not invoice-grade billing.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Caller lacks `Platform-Admin`/`Sole-Operator` role | Authorization error | Request rejected before any aggregation runs |
| Azure Monitor/Cost Management API unavailable during worker run | N/A (background) | Logged; worker retries next scheduled run; dashboard falls back to last cached `platform_metrics` values |
| Cost/queue data stale beyond an acceptable threshold | Dashboard shows a `degraded`/`unavailable` status for those sections | UI clearly marks the affected tiles rather than showing blank or misleadingly current numbers |
| Invalid `start`/`end` time window | Validation error (400) | Request rejected |
| Fresh platform instance with no tenants/connectors/runs | N/A | Zeroed metric tiles rendered normally, not an error |

---

## 12. Assumptions and Dependencies

- Azure Metrics and Azure Cost Management data are available for cost/queue metrics.
- Existing tables (`tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, `platform_admin_audit_log`) already contain the necessary metadata.
- `Platform-Admin` access is scoped to metadata and operational tables per ADR-0030.
- Primary users are `Sole-Operator`/`Platform-Admin`; a tenant-facing read-only view is a future consideration, not in scope here.
- Story 10.6 (`platform_metrics`/worker) should be built before or alongside Story 10.7 (dashboard UI).
- Azure Cost Management API access and billing data must be available before the cost breakdown goes live.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Which Azure cost API is the v1 source — Cost Management API, resource tags, or both? | Technical Lead | Before implementation |
| Q2 | Should the dashboard also show projected monthly spend based on current daily run rate? | Product Owner | Before implementation |
| Q3 | How are multi-region deployments visualized — separate dashboards or region filters? | Technical Lead | Future consideration |
| Q4 | Should tenants see a read-only version of this dashboard for their own tenant? | Product Owner | Future consideration |

---

## 14. Appendix

- **ADR:** `docs/adr/0089-platform-operations-dashboard.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0089-Platform-Operations-Dashboard.md`
- **Feature design:** `docs/product-research/feature-designs/17-platform-operations-dashboard.md`
- **Stakeholder profile:** `docs/project docs/Stakeholder Management/Sole-Operator-Stakeholder-Profile.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0030 (Platform-Admin boundary), ADR-0052 (live ingestion scheduler), ADR-0010 (ingestion health), ADR-0031 (platform admin audit log)
- **User stories:** Story 10.6 (backend), Story 10.7 (frontend) in `docs/user-stories/epic-10-adr-0086-to-0094.md`
- **Glossary:**
  - *ConnectorHealth* — operational data indicating whether a connector is healthy or failing.
  - *Dead-letter queue* — a queue holding messages that could not be processed successfully.
  - *Tenant content* — post bodies, comments, watchlist queries, search terms, and user personal data; strictly excluded from this dashboard.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0089/BRD-0089.
