# BRD-0109 — Connector Health Auto-Disable and Recovery

> **Note:** This Business Requirements Document is based on **ADR-0109**, which is currently **Proposed**. The contents are a draft for review and may change if the ADR is revised or rejected.

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Connector Health Auto-Disable and Recovery — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft for Review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0109, feature design, and Epic 13 story 13.1 |

---

## 2. Executive Summary

Failing connectors can consume API quota, generate noise, and pollute ingestion runs before an operator notices. Without an automatic stop condition, a single bad credential or transient provider outage can drive repeated, wasteful poll attempts.

This BRD describes the business rules for automatically disabling connectors that have crossed a health threshold and for safely re-enabling them. A `SocialConnector` moves through `healthy` → `degraded` → `failing` → `disabled` based on the outcome of its `ingestion_runs`. Connectors that reach `failing` stop polling, and `disabled` connectors require an explicit action before they can run again.

The expected business value is lower wasted API consumption, clearer operational status, and a human-in-the-loop recovery model that prevents flapping. This also creates the foundation for real-time alerting and platform monitoring.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce wasted provider quota from failing connectors | Number of failed poll attempts per disabled connector drops after auto-disable |
| 2 | Give operators clear visibility of connector health | Tenant- and Platform-Admins can see which connectors are `failing` or `disabled` and why |
| 3 | Prevent automatic flapping between failure and recovery | `failing` or `disabled` connectors do not resume polling without explicit re-enablement or a successful health check |
| 4 | Prepare for real-time alerting | Health-state transitions emit events that can trigger alert rules |

---

## 4. Scope

### 4.1 In Scope

- Health state transitions: `healthy`, `degraded`, `failing`, and `disabled`.
- Automatic transition to `failing` after 5 consecutive failed `ingestion_runs`.
- Immediate automatic disable for non-retryable failures (e.g., HTTP 401 / 403).
- Auto-recovery from `degraded` to `healthy` after 3 consecutive successful runs.
- Manual re-enable via `POST /v1/connectors/:platformId/enable` for authorized admins or the owning user.
- Health-check attempt on re-enable (lightweight poll with `limit=1`).
- Event emissions: `ConnectorHealthChangedEvent` and `ConnectorIngestionAlertEvent`.
- Admin UI `disabled` badge with last error and re-enable control.
- Audit logging of re-enable actions in `platform_admin_audit_log`.

### 4.2 Out of Scope

- Auto-recovery of a `failing` or `disabled` connector without explicit re-enablement.
- Configurable per-connector or per-tenant failure thresholds (proposed open question).
- Billing decisions about whether `disabled` connectors count toward `connector_activations`.
- Provider-specific troubleshooting wizards.
- Email or webhook notifications on every individual failed run (only the `failing` → `disabled` transition is in scope).

### 4.3 Assumptions

- The `ingestion_runs` table already records a `retryable` flag, as established by ADR-0051 / ADR-0052.
- Existing activation (`connector_activations`) and health-state machinery (ADR-0009 / ADR-0010) is in place.
- Role-based access control for `Tenant-Admin`, `Platform-Admin`, and user-bound Tier-3 connectors is available (ADR-0028 / ADR-0107).
- Webhook delivery infrastructure exists (ADR-0106) but is consumed optionally.

### 4.4 Constraints

- Multi-tenant data must remain isolated via RLS; Platform-Admins must not access tenant content.
- Health derivation must remain performant during live polling ticks.
- Recovery must not silently happen; a manual decision or a successful health check is required.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Owns tenant connectors and budget | High | Stop wasteful polling, re-enable safely, see why a connector stopped |
| Sole-Operator | Runs a single-tenant deployment | High | One-screen view of failing sources and quick recovery path |
| Platform-Admin | Operates the whole platform | Medium | Cross-tenant active/suspended connector counts and audit trail |
| Tenant-User | Consumes the normalized post feed | Low | Trust that the feed reflects currently reliable sources |

---

## 6. Current State (As-Is)

Connectors already report health, and `ingestion_runs` record success or failure. However, no automatic stop condition exists: a `failing` connector may continue to be polled, burning provider quota and producing repeated failed runs. Operators must manually deactivate a connector to stop the noise, and there is no explicit, auditable re-enable path.

**Pain points:**
- Failing connectors waste API calls and may exhaust rate limits or paid quotas.
- Operators may not notice a failing source before it has generated many failed runs.
- Manual deactivation is a blunt instrument with no structured recovery flow.
- There is no auditable record of who re-enabled a connector and when.

---

## 7. Future State (To-Be)

A `SocialConnector`'s health state follows a defined lifecycle. Consecutive failures degrade and then disable it. A non-retryable authentication or authorization error disables it immediately. Degraded connectors can recover automatically after a run of successful polls. Failing or disabled connectors remain stopped until a `Tenant-Admin`, `Platform-Admin`, or the owning user explicitly re-enables them.

**Expected capabilities:**
- Polling stops automatically when a connector is `failing` or `disabled`.
- Admins see the last error and a `disabled` badge in the connector status UI.
- Re-enable triggers a lightweight health check before normal polling resumes.
- State changes emit domain events for downstream alerting and audit logs.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall mark a connector as `failing` after 5 consecutive failed `ingestion_runs` | Must | A connector with 5 failed runs in a row stops polling and its health shows `failing` | Product Owner |
| BR-002 | The system shall immediately disable a connector on a non-retryable failure | Must | HTTP 401/403 or similar non-retryable error causes `disabled` state on the next evaluation | Product Owner |
| BR-003 | The system shall auto-recover a `degraded` connector to `healthy` after 3 consecutive successful runs | Must | A `degraded` connector with 3 successful runs returns to `healthy` without manual action | Product Owner |
| BR-004 | The system shall require explicit re-enablement for `failing` or `disabled` connectors | Must | A `failing` or `disabled` connector does not resume polling until an authorized re-enable occurs | Product Owner |
| BR-005 | The system shall provide a `POST /v1/connectors/:platformId/enable` endpoint | Must | `Tenant-Admin`, `Platform-Admin`, or owning Tier-3 user can call enable and a health check is attempted | Product Owner |
| BR-006 | The system shall emit `ConnectorHealthChangedEvent` when health transitions to `failing` | Should | Event is placed on the service bus with `newState='failing'` | Product Owner |
| BR-007 | The system shall emit `ConnectorIngestionAlertEvent` on `failing` → `disabled` transition | Should | Alert event is delivered to any configured webhook subscription | Product Owner |
| BR-008 | The system shall record re-enable actions in `platform_admin_audit_log` | Should | Each re-enable call stores actor, timestamp, and connector identifier | Product Owner |
| BR-009 | The admin UI shall show a `disabled` badge with the last error and a re-enable button | Should | Connector card displays status, error message, and re-enable control | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Health derivation must run within the existing 60-second poll tick budget | Performance | Must | No health-state calculation adds more than 100 ms to a tick in contract tests |
| NFR-002 | Health transitions must be multi-tenant safe and not expose one tenant's data to another | Security | Must | RLS and role checks pass for cross-tenant contract tests |
| NFR-003 | Health-state changes must be observable in monitoring and traceable to the source `ingestion_runs` | Reliability | Should | Every state change is linked to the run id that triggered it |
| NFR-004 | The re-enable flow must be usable without engineering support | Usability | Should | Admin can re-enable from the connector status screen in fewer than 3 clicks |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A connector is `degraded` when one or more recent `ingestion_runs` failed with `retryable` errors but some succeeded. |
| BRU-002 | A connector is `failing` after 5 consecutive failed `ingestion_runs` or upon any non-retryable failure. |
| BRU-003 | A `failing` connector's `shouldAttemptIngestion()` returns `false`; it does not poll. |
| BRU-004 | A non-retryable failure (e.g., HTTP 401 / 403) disables the connector immediately. |
| BRU-005 | A `degraded` connector recovers to `healthy` automatically after 3 consecutive successful runs. |
| BRU-006 | A `failing` or `disabled` connector does not auto-recover; it must be re-enabled explicitly. |
| BRU-007 | Re-enablement begins with a health-check attempt, which is a lightweight poll with `limit=1`. |
| BRU-008 | If the health check succeeds, the connector becomes `healthy`; if it fails, the connector returns to `failing` and the failure counter resets to 1. |
| BRU-009 | Only a `Tenant-Admin`, `Platform-Admin`, or the owning Tier-3 user may re-enable a user-bound connector. |
| BRU-010 | Re-enablement is recorded in `platform_admin_audit_log`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.retryable` | Classifies whether a run failure may be retried | ADR-0051 / ADR-0052 | Backend | Operational |
| `ingestion_runs.status` | Outcome of each poll attempt (success / failure) | ADR-0052 | Backend | Operational |
| Connector health state | Current `healthy`/`degraded`/`failing`/`disabled` value | Derived from `ingestion_runs` | Backend | Operational |
| `connector_activations.is_active` | Whether the connector is currently activated | ADR-0051 | Backend | Tenant-scoped |
| `platform_admin_audit_log` | Record of who re-enabled a connector and when | Audit service | Platform | Operational/audit |
| Last error message | Human-readable reason for the most recent failure | Connector run output | Backend | Could contain provider details; tenant-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Disabled connector count by tenant | Track sources that have stopped polling | Platform-Admin / Tenant-Admin | Real-time |
| Time from `failing` to `disabled` | Measure how quickly auto-disable protects quota | Operations | Hourly |
| Re-enable rate | Track how often operators recover stopped connectors | Product / Operations | Daily |
| Failure-to-disabled ratio | Identify noisy or fragile connectors | Product | Weekly |
| Cross-tenant active/suspended connector counts | Platform capacity planning | Platform-Admin | Hourly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A transient provider blip disables a connector too aggressively | Low | Medium | Require 5 consecutive failures; non-retryable errors (auth) are the only immediate disable triggers | Product Owner |
| R-002 | Operators do not notice a `disabled` connector and leave it off for too long | Medium | Medium | UI badge, alert event, and optional webhook delivery (ADR-0106) | Product Owner |
| R-003 | Unauthorized user re-enables another user's Tier-3 connector | Low | High | Enforce ownership-tier / role checks on `enable` endpoint | Technical Lead |
| R-004 | Health-check attempt itself burns quota or causes more failures | Medium | Low | Use `limit=1` lightweight poll and reset counter to 1 on failure | Technical Lead |
| R-005 | Missing `retryable` classification causes false disable | Medium | High | Make `ingestion_runs.retryable` the source of truth and audit unexpected classifications | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ingestion_runs.retryable` classification (ADR-0051 / ADR-0052) | Internal | Backend | Already in place |
| D-002 | Health state model and activation tables (ADR-0009 / ADR-0051) | Internal | Backend | Already in place |
| D-003 | `POST /v1/connectors/:platformId/activate|deactivate` (ADR-0065) | Internal | Backend | Already in place |
| D-004 | Webhook delivery events (ADR-0106) | Internal | Backend | In place; consumed optionally |
| D-005 | Role/ownership-tier enforcement (ADR-0028 / ADR-0107) | Internal | Backend | Already in place |
| D-006 | Story 13.1 — Connector health auto-disable and recovery (backend) | Internal | Backend | Ready to implement once ADR-0109 is Accepted |

---

## 14. Acceptance Criteria

- `ConnectorHealth` transitions to `failing` after 5 consecutive failed `ingestion_runs`.
- Non-retryable failures immediately disable the connector.
- `POST /v1/connectors/:platformId/enable` re-enables a connector and performs a health-check attempt.
- Disabled connectors do not poll.
- `ConnectorIngestionAlertEvent` is emitted on the `failing` → `disabled` transition.
- A `degraded` connector returns to `healthy` after 3 consecutive successful runs.
- Re-enablement is recorded in `platform_admin_audit_log`.
- The admin UI shows a `disabled` badge with the last error and a re-enable button.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialConnector` | A pluggable source that polls external content into the normalized post stream. |
| `ingestion_run` | A single poll attempt and its outcome, recorded in `ingestion_runs`. |
| `retryable` | A failure caused by a transient condition (e.g., 5xx, 429) that may succeed on retry. |
| `non-retryable` | A failure caused by a persistent condition (e.g., 401 / 403) that requires intervention. |
| `degraded` | Health state where some recent runs failed but others succeeded. |
| `failing` | Health state where the connector has crossed the consecutive-failure threshold. |
| `disabled` | Health/activation state where the connector is stopped and will not poll. |
| Health-check attempt | A lightweight re-enablement poll, typically with `limit=1`, to confirm recovery. |

---

## 16. Appendices

- **ADR-0109 — Connector health auto-disable and recovery** (`docs/adr/0109-connector-health-auto-disable-and-recovery.md`)
- **Feature design — Multi-source ingestion** (`docs/product-research/feature-designs/01-multi-source-ingestion.md`)
- **Feature-to-ADR scoping plan** (`docs/product-research/feature-adr-scoping.md`)
- **Story 13.1 — Connector health auto-disable and recovery (backend)** (`docs/user-stories/epic-13-adr-0109-to-0117.md`)
- **Note:** No `docs/product-research/reports/<feature>-deep-research.md` file exists for connector-health auto-disable. This source was not available.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
