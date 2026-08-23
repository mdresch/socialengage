# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Connector Health Auto-Disable and Recovery — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for Review) |
| Related Documents | ADR-0109, BRD-0109, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Failing connectors can consume API quota, generate noise, and pollute ingestion runs before an operator notices. Without an automatic stop condition, a single bad credential or transient provider outage can drive repeated, wasteful poll attempts.

This FDD translates the accepted architecture and business requirements from ADR-0109 and BRD-0109 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Health state transitions: `healthy`, `degraded`, `failing`, and `disabled`.
- Automatic transition to `failing` after 5 consecutive failed `ingestion_runs`.
- Immediate automatic disable for non-retryable failures (e.g., HTTP 401 / 403).
- Auto-recovery from `degraded` to `healthy` after 3 consecutive successful runs.
- Manual re-enable via `POST /v1/connectors/:platformId/enable` for authorized admins or the owning user.
- Health-check attempt on re-enable (lightweight poll with `limit=1`).
- Event emissions: `ConnectorHealthChangedEvent` and `ConnectorIngestionAlertEvent`.
- Admin UI `disabled` badge with last error and re-enable control.
- Audit logging of re-enable actions in `platform_admin_audit_log`.
- **Out of scope:** - Auto-recovery of a `failing` or `disabled` connector without explicit re-enablement.
- Configurable per-connector or per-tenant failure thresholds (proposed open question).
- Billing decisions about whether `disabled` connectors count toward `connector_activations`.
- Provider-specific troubleshooting wizards.
- Email or webhook notifications on every individual failed run (only the `failing` → `disabled` transition is in scope).
- **Assumptions and constraints:** - The `ingestion_runs` table already records a `retryable` flag, as established by ADR-0051 / ADR-0052.
- Existing activation (`connector_activations`) and health-state machinery (ADR-0009 / ADR-0010) is in place.
- Role-based access control for `Tenant-Admin`, `Platform-Admin`, and user-bound Tier-3 connectors is available (ADR-0028 / ADR-0107).
- Webhook delivery infrastructure exists (ADR-0106) but is consumed optionally.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Connectors fail for many reasons
`docs/product-research/feature-designs/01-multi-source-ingestion.md` and the `Sole-Operator`/`Platform-Admin` profiles require robust ingestion. `ADR-0009`/`ADR-0010` established health states. `ADR-0051` added `connector_activations`. This ADR finishes the policy: when a connector is `failing`, it is automatically disabled; when it recovers, it is re-enabled.

### 2. Auto-disable protects quota and cost
A failing connector can burn through retries, exhaust quota, and generate noise. Auto-disable stops polling. Manual re-enable gives the tenant control.

### 3. Recovery must be explicit
A connector should not silently resume after a transient failure. A `Tenant-Admin` or `Platform-Admin` must re-enable it or the platform must detect a sustained healthy state.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce wasted provider quota from failing connectors | Number of failed poll attempts per disabled connector drops after auto-disable |
| 2 | Give operators clear visibility of connector health | Tenant- and Platform-Admins can see which connectors are `failing` or `disabled` and why |
| 3 | Prevent automatic flapping between failure and recovery | `failing` or `disabled` connectors do not resume polling without explicit re-enablement or a successful health check |
| 4 | Prepare for real-time alerting | Health-state transitions emit events that can trigger alert rules |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Owns tenant connectors and budget | High | Stop wasteful polling, re-enable safely, see why a connector stopped |
| Sole-Operator | Runs a single-tenant deployment | High | One-screen view of failing sources and quick recovery path |
| Platform-Admin | Operates the whole platform | Medium | Cross-tenant active/suspended connector counts and audit trail |
| Tenant-User | Consumes the normalized post feed | Low | Trust that the feed reflects currently reliable sources |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.1 | backend engineer | `failing`/`degraded`/`disabled` health transitions and explicit re-enable rules, | failing connectors stop polling and can be safely re-enabled. | `ConnectorHealth` transitions to `failing` after 5 consecutive failed `ingestion_runs`.; Non-retryable failures immediately disable the connector.; `POST /v1/connectors/:platformId/enable` re-enables a connector with a health-check attempt. |

### 6.3 Workflow Diagrams / Steps

### 1. Health state transitions
```
healthy -> degraded -> failing -> disabled
  ^                                      |
  |______________________________________|
          manual re-enable or auto-recovery
```

- `degraded` — one or more recent `ingestion_runs` failed with `retryable` errors but some succeeded.
- `failing` — N consecutive `ingestion_runs` failed (N = 5 by default) or a non-retryable error occurred.
- `disabled` — the connector is automatically or manually deactivated and stops polling.

### 2. Auto-disable rules
- After 5 consecutive failed `ingestion_runs`, `ConnectorHealth` transitions to `failing` and `shouldAttemptIngestion()` returns `false`.
- If the last failure is `non-retryable` (e.g. HTTP 401, 403), the connector is disabled immediately.
- The `ingestion_runs.retryable` column (ADR-0051/0052) is the source of truth for the failure type.
- A `ConnectorHealthChangedEvent` is emitted with `newState='failing'`.

### 3. Auto-recovery rules
- A `degraded` connector recovers to `healthy` after 3 consecutive successful runs.
- A `failing` or `disabled` connector does **not** auto-recover; it requires manual re-enable.
- After re-enable, the first run begins with a `health_check` attempt (a lightweight poll with `limit=1`).
- If the health check succeeds, the connector returns to `healthy`.
- If the health check fails, the connector returns to `failing` and the counter resets to 1.

### 4. Manual re-enable
- `POST /v1/connectors/:platformId/enable` for `Tenant-Admin` or `Platform-Admin`.
- For user-bound (Tier 3) connectors, the owning user can re-enable their own.
- Re-enable is auditable in `platform_admin_audit_log`.

### 5. Notifications
- On `failing` → `disabled`, a `ConnectorIngestionAlertEvent` is emitted.
- If a webhook subscription exists (ADR-0106), it is delivered.
- The admin UI shows a `disabled` badge with the last error and a re-enable button.

---

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ingestion_runs.retryable` | Classifies whether a run failure may be retried | ADR-0051 / ADR-0052 | Backend | Operational |
| `ingestion_runs.status` | Outcome of each poll attempt (success / failure) | ADR-0052 | Backend | Operational |
| Connector health state | Current `healthy`/`degraded`/`failing`/`disabled` value | Derived from `ingestion_runs` | Backend | Operational |
| `connector_activations.is_active` | Whether the connector is currently activated | ADR-0051 | Backend | Tenant-scoped |
| `platform_admin_audit_log` | Record of who re-enabled a connector and when | Audit service | Platform | Operational/audit |
| Last error message | Human-readable reason for the most recent failure | Connector run output | Backend | Could contain provider details; tenant-scoped |

---

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. Health state transitions
```
healthy -> degraded -> failing -> disabled
  ^                                      |
  |______________________________________|
          manual re-enable or auto-recovery
```

- `degraded` — one or more recent `ingestion_runs` failed with `retryable` errors but some succeeded.
- `failing` — N consecutive `ingestion_runs` failed (N = 5 by default) or a non-retryable error occurred.
- `disabled` — the connector is automatically or manually deactivated and stops polling.

### 2. Auto-disable rules
- After 5 consecutive failed `ingestion_runs`, `ConnectorHealth` transitions to `failing` and `shouldAttemptIngestion()` returns `false`.
- If the last failure is `non-retryable` (e.g. HTTP 401, 403), the connector is disabled immediately.
- The `ingestion_runs.retryable` column (ADR-0051/0052) is the source of truth for the failure type.
- A `ConnectorHealthChangedEvent` is emitted with `newState='failing'`.

### 3. Auto-recovery rules
- A `degraded` connector recovers to `healthy` after 3 consecutive successful runs.
- A `failing` or `disabled` connector does **not** auto-recover; it requires manual re-enable.
- After re-enable, the first run begins with a `health_check` attempt (a lightweight poll with `limit=1`).
- If the health check succeeds, the connector returns to `healthy`.
- If the health check fails, the connector returns to `failing` and the counter resets to 1.

### 4. Manual re-enable
- `POST /v1/connectors/:platformId/enable` for `Tenant-Admin` or `Platform-Admin`.
- For user-bound (Tier 3) connectors, the owning user can re-enable their own.
- Re-enable is auditable in `platform_admin_audit_log`.

### 5. Notifications
- On `failing` → `disabled`, a `ConnectorIngestionAlertEvent` is emitted.
- If a webhook subscription exists (ADR-0106), it is delivered.
- The admin UI shows a `disabled` badge with the last error and a re-enable button.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Health derivation must run within the existing 60-second poll tick budget | Performance | Must | No health-state calculation adds more than 100 ms to a tick in contract tests |
| NFR-002 | Health transitions must be multi-tenant safe and not expose one tenant's data to another | Security | Must | RLS and role checks pass for cross-tenant contract tests |
| NFR-003 | Health-state changes must be observable in monitoring and traceable to the source `ingestion_runs` | Reliability | Should | Every state change is linked to the run id that triggered it |
| NFR-004 | The re-enable flow must be usable without engineering support | Usability | Should | Admin can re-enable from the connector status screen in fewer than 3 clicks |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A transient provider blip disables a connector too aggressively | Low | Medium | Require 5 consecutive failures; non-retryable errors (auth) are the only immediate disable triggers | Product Owner |
| R-002 | Operators do not notice a `disabled` connector and leave it off for too long | Medium | Medium | UI badge, alert event, and optional webhook delivery (ADR-0106) | Product Owner |
| R-003 | Unauthorized user re-enables another user's Tier-3 connector | Low | High | Enforce ownership-tier / role checks on `enable` endpoint | Technical Lead |
| R-004 | Health-check attempt itself burns quota or causes more failures | Medium | Low | Use `limit=1` lightweight poll and reset counter to 1 on failure | Technical Lead |
| R-005 | Missing `retryable` classification causes false disable | Medium | High | Make `ingestion_runs.retryable` the source of truth and audit unexpected classifications | Technical Lead |

---

---

## 12. Assumptions and Dependencies

- The `ingestion_runs` table already records a `retryable` flag, as established by ADR-0051 / ADR-0052.
- Existing activation (`connector_activations`) and health-state machinery (ADR-0009 / ADR-0010) is in place.
- Role-based access control for `Tenant-Admin`, `Platform-Admin`, and user-bound Tier-3 connectors is available (ADR-0028 / ADR-0107).
- Webhook delivery infrastructure exists (ADR-0106) but is consumed optionally.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ingestion_runs.retryable` classification (ADR-0051 / ADR-0052) | Internal | Backend | Already in place |
| D-002 | Health state model and activation tables (ADR-0009 / ADR-0051) | Internal | Backend | Already in place |
| D-003 | `POST /v1/connectors/:platformId/activate|deactivate` (ADR-0065) | Internal | Backend | Already in place |
| D-004 | Webhook delivery events (ADR-0106) | Internal | Backend | In place; consumed optionally |
| D-005 | Role/ownership-tier enforcement (ADR-0028 / ADR-0107) | Internal | Backend | Already in place |
| D-006 | Story 13.1 — Connector health auto-disable and recovery (backend) | Internal | Backend | Ready to implement once ADR-0109 is Accepted |

---

---

## 13. Open Questions

- Should the consecutive-failure threshold be configurable per connector or per tenant?
- Should `Platform-Admin` be able to re-enable any tenant's connector, or only tenant-wide connectors?
- How is the health-check attempt different from a normal poll? Does it have a smaller result set?
- Should `disabled` connectors still count toward `connector_activations` billing, or are they paused?

---

---

## 14. Appendix

### Reference Documents

- ADR-0109: `docs/adr/0109-connector-health-auto-disable-and-recovery.md`
- BRD-0109: `docs/project docs/Business-Requirements/BRD-0109-Connector-Health-Auto-Disable-And-Recovery.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0109 and BRD-0109. |