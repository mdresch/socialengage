# Business Requirements Document — Platform Operations Dashboard

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Platform Operations Dashboard |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0089-platform-operations-dashboard.md, ../Business-Requirements/BRD-0089-Platform-Operations-Dashboard.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0089-platform-operations-dashboard.md and the business requirements in BRD-0089-Platform-Operations-Dashboard.md into functional design for **Platform Operations Dashboard**.
The SocialEngage platform is operated by a single `Sole-Operator` and supported by a `Platform-Admin` role. Today, understanding the health, cost, and capacity of the platform requires opening multiple Azure portals and stitching together operational data from different sources. This is inefficient for a small, self-funded team and increases the risk that runaway ingestion, connector failures, or cost spikes go unnoticed.

This BRD defines a **Platform Operations Dashboard** — a read-only console that aggregates cross-tenant platform health, connector status, cloud cost, and capacity metrics in a single pane. The dashboard is intentionally scoped to operational metadata: it will show counts, rates, statuses, and cost attribution, but will never expose tenant post content, watchlist queries, or personal data. It is the business-facing companion to the technical decisions captured in ADR-0089.

**Draft status note:** ADR-0089 is currently *Proposed*. This BRD is therefore a draft for review and may be updated once the ADR is accepted.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Build a separate observability stack (Grafana, Datadog, or similar) — a dedicated third-party observability product is not required.
- Search or display of tenant posts for debugging purposes.
- Write/modify actions on connectors, tenants, or ingestion queues from the dashboard.
- Invoice-grade billing or multi-region deployment visualisation at v1.

## 3. Context and Background
See ADR Context.
The SocialEngage platform is operated by a single `Sole-Operator` and supported by a `Platform-Admin` role. Today, understanding the health, cost, and capacity of the platform requires opening multiple Azure portals and stitching together operational data from different sources. This is inefficient for a small, self-funded team and increases the risk that runaway ingestion, connector failures, or cost spikes go unnoticed.

This BRD defines a **Platform Operations Dashboard** — a read-only console that aggregates cross-tenant platform health, connector status, cloud cost, and capacity metrics in a single pane. The dashboard is intentionally scoped to operational metadata: it will show counts, rates, statuses, and cost attribution, but will never expose tenant post content, watchlist queries, or personal data. It is the business-facing companion to the technical decisions captured in ADR-0089.

**Draft status note:** ADR-0089 is currently *Proposed*. This BRD is therefore a draft for review and may be updated once the ADR is accepted.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Give the Sole-Operator a single-pane view of platform health, cost, and capacity | Operator can triage the platform without opening Azure Portal during normal operations |
| 2 | Protect tenant content and personal data while surfacing operational metadata | Dashboard is independently verified to never display post bodies, watchlist queries, user emails, or connector secrets |
| 3 | Reduce time to detect and respond to ingestion or connector incidents | Connector health and queue issues visible within 60 seconds of the dashboard refreshing |
| 4 | Control cloud spend and quota usage | Daily and time-series cost views enable spend attribution by service/tenant |
| 5 | Support the future operational growth of the platform | Dashboard scales from the first few tenants to many tenants without redesign |

---

**Positive consequences (from ADR):**
1. **Single-pane operations:** the `Sole-Operator` can triage the platform without opening multiple Azure portals.
2. **Tenant content stays isolated:** the dashboard is explicitly scoped to metadata and operational tables.
3. **Cost and health visibility:** runaway ingestion or connector failures are visible in one place.
4. **Azure dependency:** cost and queue metrics rely on Azure APIs. If unavailable, the dashboard shows a degraded state.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Sole-Operator | Primary day-to-day operator | High | Single screen showing platform health, cost, and capacity without switching portals |
| Platform-Admin | Platform provisioning and incident investigation | High | Connector health, tenant status, and platform-wide metrics in one console |
| Tenant-Admin (future) | Read-only view of own tenant operations | Low | Visibility into their own tenant and connector health, if a future scope is approved |
| Legal-Advisor | Privacy and compliance oversight | Medium | Evidence that the dashboard is scoped to metadata only and does not expose tenant content |
| Customers / Tenants | Beneficiaries of a healthy platform | Medium | Platform issues detected and resolved faster |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.6 | epic-10-adr-0086-to-0094.md | As backend engineer, I want a `platform_metrics` table and an hourly Azure Monitor ingestion worker, so that the platform operations dashboard has fast, cach... | `platform_metrics` table exists with `metric_name`, `granularity`, `timestamp`, `value`, `unit`, `dimensions`, and `source`.; `PlatformMetricsWorker` pulls c... |
| Story 10.7 | epic-10-adr-0086-to-0094.md | As `Platform-Admin` / `Sole-Operator`, I want a dashboard showing tenant counts, connector health, ingestion volume, and cost, so that I can triage the platf... | `PlatformOperationsDashboard` with metric tiles, time-series charts, and connector health table.; `GET /v1/admin/platform-dashboard` is consumed and data is ... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- Azure Metrics and Azure Cost Management data will be available for cost and queue metrics.
- Existing tables (`tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, `platform_admin_audit_log`) already contain the necessary metadata.
- The `Platform-Admin` role is scoped to metadata and operational tables per ADR-0030.
- The primary users are the `Sole-Operator` and `Platform-Admin`; tenant read-only views are a future consideration.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Dashboard data must be tenant-content-free | Security | Must | Independent audit confirms no post bodies, watchlist queries, user emails, or connector secrets are exposed |
| NFR-002 | Dashboard data must be fresh within one minute for health/cost and one hour for billing-grade cost attribution | Performance | Should | Monitoring confirms cache/ingestion windows meet freshness targets |
| NFR-003 | Dashboard must be accessible only to `Platform-Admin` and `Sole-Operator` roles | Security | Must | Role-based access control tests pass |
| NFR-004 | Dashboard UI must be responsive and colorblind-safe | Usability | Should | WCAG contrast and keyboard navigation checks pass for dashboard components |
| NFR-005 | Dashboard must handle Azure API outages gracefully | Reliability | Should | Azure outage results in a `degraded` or `unavailable` status rather than errors or stale data being misrepresented |

---

## 11. Error Handling and Exceptions
1. **Single-pane operations:** the `Sole-Operator` can triage the platform without opening multiple Azure portals.
2. **Tenant content stays isolated:** the dashboard is explicitly scoped to metadata and operational tables.
3. **Cost and health visibility:** runaway ingestion or connector failures are visible in one place.
4. **Azure dependency:** cost and queue metrics rely on Azure APIs. If unavailable, the dashboard shows a degraded state.

---

## 12. Assumptions and Dependencies
- Azure Metrics and Azure Cost Management data will be available for cost and queue metrics.
- Existing tables (`tenants`, `connector_activations`, `ConnectorHealth`, `ingestion_runs`, `platform_admin_audit_log`) already contain the necessary metadata.
- The `Platform-Admin` role is scoped to metadata and operational tables per ADR-0030.
- The primary users are the `Sole-Operator` and `Platform-Admin`; tenant read-only views are a future consideration.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure cost or metrics APIs are unavailable, leaving the dashboard blank or misleading | Medium | High | Cache last-known values and surface `degraded`/`unavailable` status clearly | Technical Lead |
| R-002 | Tenant content accidentally exposed through a future drill-down feature | Medium | High | Enforce the metadata-only rule in code review, contract tests, and audit; never show post bodies or user PII | Legal-Advisor / Technical Lead |
| R-003 | Operator desensitisation to alerts due to noisy or stale data | Medium | Medium | Set appropriate refresh intervals, distinguish cached vs live data, and keep thresholds user-tunable | Product Owner |
| R-004 | Cost attribution accuracy does not match invoice-grade billing | Medium | Medium | Label cost metrics as "estimated" and consider a separate, delayed billing-grade report | Product Owner |
| R-005 | Dashboard becomes too complex for a solo operator | Low | Medium | Keep v1 focused on five top-level tiles and one drill-down table; defer advanced features | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0089-platform-operations-dashboard.md`
- BRD: `../Business-Requirements/BRD-0089-Platform-Operations-Dashboard.md`
- Feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md``
- Deep research: `docs/product-research/reports/platform-operations-dashboard-deep-research.md``
- User stories: see extracted stories above