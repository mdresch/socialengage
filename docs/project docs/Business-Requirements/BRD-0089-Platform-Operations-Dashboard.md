# Business Requirements Document — Platform Operations Dashboard

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage Platform Operations Dashboard – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-28 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft (ADR-0089 (Accepted 2026-08-28) is Proposed; this BRD is for review and may change upon acceptance) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft based on ADR-0089 (Accepted 2026-08-28), feature design 17, and Epic 10 stories |

---

## 2. Executive Summary

The SocialEngage platform is operated by a single `Sole-Operator` and supported by a `Platform-Admin` role. Today, understanding the health, cost, and capacity of the platform requires opening multiple Azure portals and stitching together operational data from different sources. This is inefficient for a small, self-funded team and increases the risk that runaway ingestion, connector failures, or cost spikes go unnoticed.

This BRD defines a **Platform Operations Dashboard** — a read-only console that aggregates cross-tenant platform health, connector status, cloud cost, and capacity metrics in a single pane. The dashboard is intentionally scoped to operational metadata: it will show counts, rates, statuses, and cost attribution, but will never expose tenant post content, watchlist queries, or personal data. It is the business-facing companion to the technical decisions captured in ADR-0089 (Accepted 2026-08-28).

**Draft status note:** ADR-0089 (Accepted 2026-08-28) is currently *Proposed*. This BRD is therefore a draft for review and may be updated once the ADR is accepted.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Give the Sole-Operator a single-pane view of platform health, cost, and capacity | Operator can triage the platform without opening Azure Portal during normal operations |
| 2 | Protect tenant content and personal data while surfacing operational metadata | Dashboard is independently verified to never display post bodies, watchlist queries, user emails, or connector secrets |
| 3 | Reduce time to detect and respond to ingestion or connector incidents | Connector health and queue issues visible within 60 seconds of the dashboard refreshing |
| 4 | Control cloud spend and quota usage | Daily and time-series cost views enable spend attribution by service/tenant |
| 5 | Support the future operational growth of the platform | Dashboard scales from the first few tenants to many tenants without redesign |

---

## 4. Scope

### 4.1 In Scope

- A read-only `Platform-Admin` / `Sole-Operator` console.
- Tenant counts (total, active, suspended, new this week).
- Connector health by platform (active, failing, degraded) with drill-down to connector metadata.
- Ingestion volume and failure rates (posts and runs in the last 24 hours by default).
- Platform health status (`healthy`, `degraded`, `unavailable`) and a list of degraded connectors.
- Cloud cost estimate and breakdown by service.
- Queue and dead-letter backlog counts.
- Time range selection and automatic refresh controls.
- Cache for operational data to avoid excessive API calls.
- Strict prevention of tenant post content, watchlist queries, user personal data, and connector secrets.

### 4.2 Out of Scope

- Build a separate observability stack (Grafana, Datadog, or similar) — a dedicated third-party observability product is not required.
- Search or display of tenant posts for debugging purposes.
- Write/modify actions on connectors, tenants, or ingestion queues from the dashboard.
- Invoice-grade billing or multi-region deployment visualisation at v1.

### 4.3 Assumptions

- Azure Metrics and Azure Cost Management data will be available for cost and queue metrics.
- Existing tables (`tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, `platform_admin_audit_log`) already contain the necessary metadata.
- The `Platform-Admin` role is scoped to metadata and operational tables per ADR-0030.
- The primary users are the `Sole-Operator` and `Platform-Admin`; tenant read-only views are a future consideration.

### 4.4 Constraints

- Must not return or display tenant content, watchlist queries, user personal data, or connector credentials.
- Must rely on Azure APIs for cost and queue data, which may occasionally be unavailable.
- Must be implementable within the current two-repo architecture (`social-listening-core` and `social-listening-admin`).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Sole-Operator | Primary day-to-day operator | High | Single screen showing platform health, cost, and capacity without switching portals |
| Platform-Admin | Platform provisioning and incident investigation | High | Connector health, tenant status, and platform-wide metrics in one console |
| Tenant-Admin (future) | Read-only view of own tenant operations | Low | Visibility into their own tenant and connector health, if a future scope is approved |
| Legal-Advisor | Privacy and compliance oversight | Medium | Evidence that the dashboard is scoped to metadata only and does not expose tenant content |
| Customers / Tenants | Beneficiaries of a healthy platform | Medium | Platform issues detected and resolved faster |

---

## 6. Current State (As-Is)

The platform already produces health, cost, and operational data from several prior ADRs:

- `ADR-0009` and `ADR-0010` provide ingestion health data.
- `ADR-0051` produces connector activation records.
- `ADR-0052` provides the live ingestion scheduler.
- Azure Metrics and Azure billing data are available externally.

However, there is **no unified console** that brings these together. The `Sole-Operator` must open the Azure Portal, database consoles, and application logs to answer basic questions such as:

- Are any connectors currently failing?
- Is ingestion volume abnormal today?
- How much is the platform costing right now?
- How many tenants are active or suspended?

This manual, multi-tool process is slow, error-prone, and unsuited to a solo-operated project.

---

## 7. Future State (To-Be)

After implementation, the `Sole-Operator` or `Platform-Admin` signs in to the admin console and lands on the `PlatformOperationsDashboard`. The dashboard presents:

- A grid of top-level metric tiles (tenant counts, active connectors, posts in the last 24 hours, estimated daily cost, queue backlogs).
- Time-series charts for ingestion volume and cost over the selected time range.
- A connector health table showing failing connectors grouped by platform.
- A cost breakdown card showing spend by service.
- Health status and a list of degraded connectors.

The user can select a time range and refresh the data. All values are content-free: they are counts, rates, statuses, and attribution. The console is read-only; no tenant data, posts, watchlist queries, or credentials are shown.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall display a single dashboard that aggregates cross-tenant platform health, connector status, ingestion volume, cost, and queue metrics | Must | Dashboard loads within the admin console and shows all top-level metric tiles | Product Owner |
| BR-002 | The system shall display tenant counts (total, active, suspended, new this week) | Must | Tenant counts are accurate and sourced from the `tenants` table | Product Owner |
| BR-003 | The system shall display connector health by platform, including active and failing counts | Must | Connector health table lists failing connectors and the platforms they belong to | Product Owner |
| BR-004 | The system shall display ingestion activity (posts and runs in the last 24 hours) and the number of failing runs | Must | Ingestion counts are sourced from `ingestion_runs` and update with the selected time range | Product Owner |
| BR-005 | The system shall display an overall platform health status and a list of degraded connectors | Must | Status is `healthy`, `degraded`, or `unavailable`; degraded connectors are clearly listed | Product Owner |
| BR-006 | The system shall display an estimated daily cloud cost and a breakdown by service | Must | Cost estimate and service-level breakdown are shown in the selected currency | Product Owner |
| BR-007 | The system shall display queue depth and dead-letter counts | Should | Queue metrics are visible and refreshed from Azure or platform metrics | Product Owner |
| BR-008 | The system shall allow the user to select a time range and refresh the dashboard | Should | Time range controls and a manual/auto refresh option are available | Product Owner |
| BR-009 | The system shall cache dashboard data for a short period to protect downstream APIs | Should | Dashboard data is cached for at least 60 seconds; repeated requests do not flood Azure APIs | Product Owner |
| BR-010 | The system shall provide a read-only version of the dashboard; no management actions are allowed from this screen | Should | Dashboard contains no buttons or controls that modify tenants, connectors, or data | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard data must be tenant-content-free | Security | Must | Independent audit confirms no post bodies, watchlist queries, user emails, or connector secrets are exposed |
| NFR-002 | Dashboard data must be fresh within one minute for health/cost and one hour for billing-grade cost attribution | Performance | Should | Monitoring confirms cache/ingestion windows meet freshness targets |
| NFR-003 | Dashboard must be accessible only to `Platform-Admin` and `Sole-Operator` roles | Security | Must | Role-based access control tests pass |
| NFR-004 | Dashboard UI must be responsive and colorblind-safe | Usability | Should | WCAG contrast and keyboard navigation checks pass for dashboard components |
| NFR-005 | Dashboard must handle Azure API outages gracefully | Reliability | Should | Azure outage results in a `degraded` or `unavailable` status rather than errors or stale data being misrepresented |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The dashboard may display counts, rates, connector platform names, statuses, tenant names, and seat counts only. |
| BRU-002 | The dashboard must never display post bodies, comments, raw payloads, watchlist queries, search terms, user email addresses, or other personal data. |
| BRU-003 | The dashboard must never display connector credentials or secrets. |
| BRU-004 | `Platform-Admin` access is scoped to metadata and operational tables; break-glass tenant-content access is governed by ADR-0030 and a separate audit log, not this dashboard. |
| BRU-005 | Cost and queue metrics are sourced from Azure; if Azure is unavailable, the dashboard must surface a degraded state rather than synthetic values. |
| BRU-006 | The default time window for dashboard metrics is the last 24 hours, with optional user selection of a different range. |
| BRU-007 | Dashboard data must be cached for at least 60 seconds to prevent excessive calls to Azure APIs. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Tenant counts | Total, active, suspended, and new-this-week tenants | `tenants` table | Platform-Admin | Operational metadata |
| Connector activations | Active and failing connectors by platform | `connector_activations`, `ConnectorHealth` | Platform-Admin | Operational metadata |
| Ingestion runs | Posts and runs in the time window, plus failures | `ingestion_runs` | Platform-Admin | Operational metadata |
| Platform admin audit log | Recent platform-level events | `platform_admin_audit_log` | Platform-Admin | Audit / operational |
| Azure cost | Estimated spend and service breakdown | Azure Cost Management | Sole-Operator / Finance | Financial |
| Azure metrics | Queue depth, dead-letter count | Azure Metrics | Platform-Admin | Operational metadata |
| Platform metrics (future) | Aggregated, cached operational time series | `platform_metrics` (Story 10.6) | Platform-Admin | Operational metadata |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Platform health status | Quick triage of platform availability | Sole-Operator, Platform-Admin | Real-time (cached) |
| Connector failure count | Identify connectors needing attention | Sole-Operator, Platform-Admin | Real-time (cached) |
| Ingestion volume (last 24h) | Detect unusual activity or spikes | Sole-Operator, Platform-Admin | Real-time (cached) |
| Estimated daily cost | Track cloud spend | Sole-Operator, Finance | Real-time (cached) |
| Cost by service | Attribute spend to Azure services | Sole-Operator, Finance | Real-time (cached) |
| Queue / dead-letter backlog | Spot processing delays | Platform-Admin | Real-time (cached) |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure cost or metrics APIs are unavailable, leaving the dashboard blank or misleading | Medium | High | Cache last-known values and surface `degraded`/`unavailable` status clearly | Technical Lead |
| R-002 | Tenant content accidentally exposed through a future drill-down feature | Medium | High | Enforce the metadata-only rule in code review, contract tests, and audit; never show post bodies or user PII | Legal-Advisor / Technical Lead |
| R-003 | Operator desensitisation to alerts due to noisy or stale data | Medium | Medium | Set appropriate refresh intervals, distinguish cached vs live data, and keep thresholds user-tunable | Product Owner |
| R-004 | Cost attribution accuracy does not match invoice-grade billing | Medium | Medium | Label cost metrics as "estimated" and consider a separate, delayed billing-grade report | Product Owner |
| R-005 | Dashboard becomes too complex for a solo operator | Low | Medium | Keep v1 focused on five top-level tiles and one drill-down table; defer advanced features | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0030` — Platform-Admin metadata-only boundary | Internal / ADR | Menno | Already accepted |
| D-002 | `ADR-0052` — Live ingestion scheduler and `ingestion_runs` data | Internal / ADR | Menno | Already accepted |
| D-003 | `ADR-0010` — Ingestion health and `ConnectorHealth` data | Internal / ADR | Menno | Already accepted |
| D-004 | `ADR-0031` — Platform admin audit log | Internal / ADR | Menno | Already accepted |
| D-005 | `Story 10.6` — `platform_metrics` table and Azure Metrics integration | Internal / story | Menno | Ready, to be built before or with dashboard |
| D-006 | Azure Cost Management API access and billing data | External / cloud | Sole-Operator | Before cost breakdown goes live |
| D-007 | `docs/product-research/feature-designs/17-platform-operations-dashboard.md` | Reference document | Product Owner | Available |

---

## 14. Acceptance Criteria

- The dashboard loads and displays metric tiles for tenant counts, connector health, ingestion volume, platform status, daily cost, and queue backlog.
- No tenant post content, watchlist queries, user personal data, or connector secrets are rendered anywhere on the dashboard.
- Time range selection and refresh controls are present and functional.
- Data is cached for 60 seconds to avoid excessive Azure API calls.
- Connector health table lists failing connectors grouped by platform.
- Cost breakdown is shown by service.
- The dashboard is accessible only to `Platform-Admin` and `Sole-Operator` roles.
- If Azure cost/queue data is unavailable, the dashboard shows a `degraded` or `unavailable` state.

---

## 15. Glossary

| Term | Definition |
|---|---|
| ConnectorHealth | Operational data indicating whether a connector is healthy or failing. |
| Dead-letter queue | A queue that holds messages that could not be processed successfully. |
| Degraded connector | A connector that is not currently healthy and may need attention. |
| Ingestion run | A single execution of a connector / ingestion process. |
| Platform-Admin | A role with platform-wide access to operational metadata, but not tenant content. |
| Platform operations dashboard | The read-only console described in this BRD. |
| Sole-Operator | The single person responsible for running the SocialEngage platform. |
| Tenant content | Post bodies, comments, watchlist queries, search terms, and user personal data. |
| Time window | The user-selected or default period over which dashboard metrics are aggregated (default: last 24 hours). |

---

## 16. Appendices

### 16.1 Source Architecture Decision Record

- `docs/adr/0089-platform-operations-dashboard.md` — ADR-0089 (Accepted 2026-08-28) (Proposed)

### 16.2 Feature Design

- `docs/product-research/feature-designs/17-platform-operations-dashboard.md`

### 16.3 Scoping Reference

- `docs/product-research/feature-adr-scoping.md`

### 16.4 Related Architecture Decision Records

- `docs/adr/0030-platform-admin-boundary.md` — Platform-Admin metadata-only boundary
- `docs/adr/0052-live-ingestion-scheduler.md` — Live ingestion scheduler
- `docs/adr/0010-ingestion-health.md` — Ingestion health
- `docs/adr/0031-platform-admin-audit-log.md` — Platform admin audit log

### 16.5 Related User Stories

- `docs/user-stories/epic-10-adr-0086-to-0094.md`
  - **Story 10.6** — Platform metrics table and Azure Metrics integration (backend). As a backend engineer, I want a `platform_metrics` table and an hourly Azure Monitor ingestion worker, so that the platform operations dashboard has fast, cached infrastructure data. Acceptance criteria: `platform_metrics` table exists; `PlatformMetricsWorker` pulls cost, queue, container, and ingestion metrics from Azure Monitor / Cost Management; hourly and daily roll-ups are supported; retention is 7 days for hourly and 365 days for daily; no tenant post content is stored in `platform_metrics`.
  - **Story 10.7** — Platform operations dashboard (frontend). As a `Platform-Admin` / `Sole-Operator`, I want a dashboard showing tenant counts, connector health, ingestion volume, and cost, so that I can triage the platform without opening Azure Portal. Acceptance criteria: `PlatformOperationsDashboard` with metric tiles, time-series charts, and connector health table; `GET /v1/admin/platform-dashboard` is consumed and data is cached for 60 seconds; the UI never displays post bodies, watchlist queries, or user PII; time range and refresh controls are available.

### 16.6 Missing Research Brief

- A `docs/product-research/reports/platform-operations-dashboard-deep-research.md` brief was not found in the repository. It should be added later if competitive / market research is produced for this feature.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
