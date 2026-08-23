# Business Requirements Document (BRD) — Connector Ingestion Health Status, Hanging Run Reconciliation, and Inactivity Alerting

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Connector Ingestion Health Status, Hanging Run Reconciliation, and Inactivity Alerting |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md, ../Business-Requirements/BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md and the business requirements in BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md into functional design for **Connector Ingestion Status Hanging Run Reconciliation And Alerts**.
Ingestion runs can be left in a perpetual `running` state when the backend process is restarted, the container is redeployed, or an uncaught exception terminates a connector poll. Because the scheduler's in-flight guard skips any connector that already has a `running` run, a single orphaned row silently and permanently halts all future ingestion for that tenant, platform, and (for Tier-3 connectors) user. Even when no run is orphaned, active connectors can stop producing posts because of upstream silent outages, circuit-breaker lockouts, or scheduler starvation, and neither operators nor tenant admins are notified.

This BRD authorizes an automated, lock-safe watchdog to reconcile stale `running` ingestion runs; an extended `ConnectorHealthStatus` that includes an explicit `stalled` state; structured `ConnectorIngestionAlertEvent` messages on Azure Service Bus; and new Admin UI status badges, a global ingestion alert banner, and an on-demand "Force Retry / Re-sync" action. The result is zero manual recovery for hung runs, proactive visibility when ingestion stops, and self-service recovery without direct database access.

---

### 2.2 Scope
**In scope:**
- Automated lock-safe reconciliation of stale `running` ingestion runs at the start of each scheduler tick.
- Partial database index to keep watchdog sweeps efficient regardless of historical table size.
- Extension of derived `ConnectorHealthStatus` to include `stalled` with strict derivation precedence.
- `ConnectorIngestionAlertEvent` publishing on Azure Service Bus for run timeout, stall, failing, and reconnect-required conditions.
- `POST /v1/connectors/:id/retry` and `POST /v1/connectors/:id/users/:userId/retry` force-retry endpoints.
- Admin UI connector status badges and operational timestamps (last attempt, last successful ingestion, cadence).
- Global ingestion alert banner on `/tenant/analytics` (Overview tab) and `/tenant/connectors`.
- On-demand "Re-sync now" button with loading, success, and 409 conflict handling.

**Out of scope:**
- Third-party push, email, SMS, Slack, or PagerDuty notification delivery (Service Bus events are produced for downstream consumers, not the core pipeline).
- Re-architecting the connector `poll()` loop or content normalization logic.
- Predictive stall detection using ML or anomaly models.
- Multi-tenant alert aggregation for `Platform-Admin` dashboards.

## 3. Context and Background
See ADR Context.
Ingestion runs can be left in a perpetual `running` state when the backend process is restarted, the container is redeployed, or an uncaught exception terminates a connector poll. Because the scheduler's in-flight guard skips any connector that already has a `running` run, a single orphaned row silently and permanently halts all future ingestion for that tenant, platform, and (for Tier-3 connectors) user. Even when no run is orphaned, active connectors can stop producing posts because of upstream silent outages, circuit-breaker lockouts, or scheduler starvation, and neither operators nor tenant admins are notified.

This BRD authorizes an automated, lock-safe watchdog to reconcile stale `running` ingestion runs; an extended `ConnectorHealthStatus` that includes an explicit `stalled` state; structured `ConnectorIngestionAlertEvent` messages on Azure Service Bus; and new Admin UI status badges, a global ingestion alert banner, and an on-demand "Force Retry / Re-sync" action. The result is zero manual recovery for hung runs, proactive visibility when ingestion stops, and self-service recovery without direct database access.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate permanent ingestion deadlocks from orphaned or hung `running` runs | A reconciled stale run is marked `failed` with `retryable = true` and the next scheduler tick resumes polling for that target. |
| 2 | Make connector inactivity visible before users discover gaps in their data | `stalled` health is derived and surfaced when a connector has not attempted or successfully fetched within configured thresholds. |
| 3 | Enable proactive alerting for ingestion anomalies | `ConnectorIngestionAlertEvent` messages are emitted for `run_timed_out`, `ingestion_stalled`, `connector_failing`, and `reconnect_required`. |
| 4 | Provide self-service recovery for tenant admins and Tier-3 users | Authorized users can trigger `Force Retry / Re-sync` from the Admin UI and receive immediate feedback. |
| 5 | Preserve a complete, honest audit trail | Every reconciliation, health transition, and manual retry is reflected in `ingestion_runs` and health history. |

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall automatically reconcile stale `running` ingestion runs at the start of each scheduler tick. | Must | Runs older than `max(15 minutes, 2 * effectiveCadenceMs)` are updated to `failed`, `retryable = true`, with a completed audit timestamp. | Technical Lead |
| BR-002 | The reconciliation sweep shall be lock-safe and non-blocking. | Must | `FOR UPDATE SKIP LOCKED` ensures active runs within the threshold are not overwritten. | Technical Lead |
| BR-003 | The system shall support `stalled` as a derived connector health status. | Must | `ConnectorHealthStatus` includes `stalled` and `deriveConnectorHealth()` returns it under the documented conditions. | Technical Lead |
| BR-004 | The system shall derive `stalled` only after higher-priority failure states are ruled out. | Must | `stalled` is never returned when `disconnected`, `reconnect_required`, or `failing` apply. | Technical Lead |
| BR-005 | The system shall publish structured ingestion alert events on Service Bus. | Must | `ConnectorIngestionAlertEvent` is emitted for `run_timed_out`, `ingestion_stalled`, `connector_failing`, and `reconnect_required`. | Technical Lead |
| BR-006 | Alert events for run timeouts shall be throttled to avoid storms. | Must | At most one `run_timed_out` event per `(tenantId, platformId[, userId])` per sweep window. | Technical Lead |
| BR-007 | Authorized users shall be able to trigger a force retry / re-sync for a connector. | Must | `POST /v1/connectors/:id/retry` and `/v1/connectors/:id/users/:userId/retry` reconcile stale runs, reset failure counters, and trigger an immediate poll. | Technical Lead |
| BR-008 | Force retry shall be idempotent and safe. | Must | Returns `409` without erroring if a run started within the last 60 seconds is still in progress. | Technical Lead |
| BR-009 | The Admin UI shall display explicit connector health badges. | Must | Badges include `Healthy`, `Degraded`, `Stalled`, `Failing`, `Reconnect Required`, and `Disconnected`. | Product Owner |
| BR-010 | The Admin UI shall show operational timestamps and cadence for each connector. | Must | `lastAttemptAt`, `lastSuccessfulFetchAt`, and poll interval are visible on the connector status screen. | Product Owner |
| BR-011 | The Admin UI shall surface a global ingestion alert banner when active connectors are unhealthy. | Must | Banner appears on `/tenant/analytics` and `/tenant/connectors` for any `stalled`, `failing`, or `reconnect_required` connector. | Product Owner |
| BR-012 | The Admin UI shall allow authorized users to request a re-sync from the connector card. | Must | "Re-sync now" button calls the retry endpoint, shows loading state, and refreshes metrics on success. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-Admin` (primary) | Owns connector configuration and credential health | High | See when ingestion stops, understand why, and recover without support tickets. |
| `Tenant-User` (primary) | Relies on accurate, timely post feeds for monitoring | High | Trust that stalled sources are flagged and not silently dropping content. |
| `Sole-Operator` (primary) | Manages both business and technical operations | High | One screen with connector counts, health, and one-click re-sync. |
| `Platform-Admin` (secondary) | Operates platform infrastructure | Medium | Avoid manual database cleanup of orphaned `running` rows. |
| `Support / System Operator` (secondary) | Monitors ingestion health across tenants | Medium | Receive structured Service Bus events for runbook automation. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.16 | epic-1-repository-and-api-foundation.md | As system operator and platform engineer, I want orphaned or hung `running` ingestion runs to be automatically reconciled by a lock-safe scheduler watchdog, ... | **Database Partial Index:**; **Lock-Safe Watchdog Stale Run Reconciliation (`reconcileStaleIngestionRuns`):**; **Extended Connector Health Derivation with St... |
| Story 6.29 | epic-6-tenant-admin-ui.md | As Tenant-Admin or Tenant User, I want to see clear, real-time ingestion status badges (including `Stalled`), actionable alert banners when ingestion stops, ... | **Connector Status View (`/tenant/connectors/status` & `/tenant/connectors`):**; **On-Demand "Force Retry / Re-sync" Button:**; **Global Ingestion Alert Bann... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs` rows | Audit anchor for each poll attempt, including `status`, `started_at`, `completed_at`, `error_summary`, `retryable`, and `is_credential_failure` | `ingestion_runs` table | System / Tenant | Medium |
| `ConnectorHealthStatus` | Derived health value (`healthy`, `degraded`, `failing`, `disconnected`, `reconnect_required`, `stalled`) | Derived from `ingestion_runs` and credential status | System | Low |
| `lastAttemptAt` | Timestamp of the most recent ingestion attempt | Latest `ingestion_runs` row for the target | System | Low |
| `lastSuccessfulFetchAt` | Timestamp of the most recent completed run that acquired posts | Latest successful `ingestion_runs` row for the target | System | Low |
| `effectiveCadenceMs` | Connector poll cadence for the current context (tenant-wide or per-user Tier-3) | `connector_activations` / scheduler configuration | System | Low |
| `ConnectorIngestionAlertEvent` | Structured alert message on Service Bus | Core pipeline event publisher | System / Tenant | Medium |
| `platform_credentials` | Credential status (valid / expired / revoked) used in health derivation | Azure Key Vault–backed credential store | Tenant | High |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A `running` ingestion run is considered stale when `started_at < NOW() - MAX_RUN_DURATION_MS`, where `MAX_RUN_DURATION_MS = max(15 minutes, 2 * effectiveCadenceMs)`. |
| BRU-002 | Health derivation follows strict precedence: `disconnected` → `reconnect_required` → `failing` → `stalled` → `degraded` → `healthy`. |
| BRU-003 | `stalled` is derived only for active connectors with valid credentials that are not already `reconnect_required` or `failing`. |
| BRU-004 | `stalled` is triggered when `now - lastAttemptAt >= 3 * effectiveCadenceMs` (minimum 45 minutes) OR `now - lastSuccessfulFetchAt >= 24 hours`. |
| BRU-005 | Force retry is authorized for `tenant_admin` users or, for Tier-3 connectors, the authenticated user who owns the credential. |
| BRU-006 | A force retry returns `409` if a run started within the last 60 seconds is actively `running`. |
| BRU-007 | `ConnectorIngestionAlertEvent` `run_timed_out` warnings are batched/throttled to at most one per target per sweep window. |
| BRU-008 | Global alert banners reappear on the next page load if the underlying connector status remains unresolved. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0005 (`IngestionRun` as audit anchor) | Internal | Technical Lead | Already Accepted |
| D-002 | ADR-0009 (`ConnectorHealth` derived not stored) | Internal | Technical Lead | Already Accepted |
| D-003 | ADR-0010 (Error handling & auto-disable policy) | Internal | Technical Lead | Already Accepted |
| D-004 | ADR-0023 (Proportional failure threshold & circuit breaker) | Internal | Technical Lead | Already Accepted |
| D-005 | ADR-0052 (Live polling scheduler & in-flight guard) | Internal | Technical Lead | Already Accepted |
| D-006 | ADR-0058 (Ingestion events & `ConnectorHealthChangedEvent`) | Internal | Technical Lead | Already Accepted |
| D-007 | ADR-0061 (Tier-3 per-user scheduler) | Internal | Technical Lead | Already Accepted |
| D-008 | Story 1.13/1.14/1.15 (scheduler and in-flight guard) | Internal | Technical Lead | Already Built |
| D-009 | Story 1.16 (reconciliation, stalled health, alert events) | Internal | Technical Lead | Already Built 2026-08-20 |
| D-010 | Story 5.19 (Service Bus event publishing) | Internal | Technical Lead | Already Built |
| D-011 | Story 6.5 (connector status view) | Internal | Product Owner | Already Built |
| D-012 | Story 6.24 (connectors & AI providers grouping) | Internal | Product Owner | Already Built |
| D-013 | Story 6.29 (badges, banner, and re-sync UI) | Internal | Product Owner | Already Built 2026-08-20 |

---

- The live polling scheduler (`pollScheduler.ts`) and `ingestion_runs` audit anchor from ADR-0005/ADR-0052 already exist.
- Azure Service Bus event publishing from ADR-0058/Story 5.19 is already in place.
- `ConnectorHealth` is derived, not stored, per ADR-0009.
- Health derivation already consumes `lastAttemptAt`, `lastSuccessfulFetchAt`, consecutive-failure counters, and credential status.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Watchdog sweeps must remain O(1) regardless of `ingestion_runs` table size. | Performance | Must | A partial index on `(status, started_at) WHERE status = 'running'` is created. |
| NFR-002 | Force retry endpoints must enforce tenant and ownership-tier authorization. | Security | Must | `requireTenantAdmin` or matching Tier-3 user with RLS validation. |
| NFR-003 | Alert emissions must not overwhelm downstream consumers. | Reliability | Must | Timeout alerts are throttled per target per sweep; stall/failing events are emitted on transition, not every tick. |
| NFR-004 | Health derivation must be deterministic and consistent with precedence rules. | Maintainability | Must | Unit/contract tests assert the full precedence order. |
| NFR-005 | UI banners must be accessible and dismissible. | Usability | Should | Banner is keyboard-focusable, includes an `aria-live` region, and can be dismissed for the session. |
| NFR-006 | Reconciliation must not block the scheduler tick from completing. | Performance | Should | Watchdog runs as an initial step and returns quickly; skipped-locked rows are not waited on. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The live polling scheduler (`pollScheduler.ts`) and `ingestion_runs` audit anchor from ADR-0005/ADR-0052 already exist.
- Azure Service Bus event publishing from ADR-0058/Story 5.19 is already in place.
- `ConnectorHealth` is derived, not stored, per ADR-0009.
- Health derivation already consumes `lastAttemptAt`, `lastSuccessfulFetchAt`, consecutive-failure counters, and credential status.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A legitimate long-running run is incorrectly reconciled as stale. | Low | Medium | Timeout is `max(15 min, 2 * cadence)` and uses `FOR UPDATE SKIP LOCKED`; active workers are not overwritten. | Technical Lead |
| R-002 | Alert storms overwhelm downstream consumers or operators. | Low | High | Throttle `run_timed_out` to one per target per sweep; emit stall/failing on transition only. | Technical Lead |
| R-003 | `stalled` status is misinterpreted as a fatal failure. | Medium | Medium | UI labels clearly distinguish `Stalled / No Ingestion` from `Failing / Suspended`; tooltip/help text explains the cause. | Product Owner |
| R-004 | Watchdog query becomes slow without the partial index. | Low | High | Require migration `idx_ingestion_runs_stale_watchdog` on `(status, started_at) WHERE status = 'running'`. | Technical Lead |
| R-005 | Tier-3 users trigger force retry on connectors they do not own. | Low | High | Enforce `requireTenantAdmin` or exact `userId` match with strict tenant-isolation validation. | Technical Lead |
| R-006 | UI banner fatigue causes users to ignore real alerts. | Medium | Low | Dismissible per session; banner reappears if status is unresolved, and status badges provide persistent visibility. | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md`
- BRD: `../Business-Requirements/BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above