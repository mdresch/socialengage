# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0109 Connector Health Auto-Disable and Recovery — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0109, BRD-0109, feature design 01) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0109 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0109, BRD-0109, `docs/product-research/feature-designs/01-multi-source-ingestion.md`, Story 13.1, ADR-0009, ADR-0010, ADR-0051, ADR-0101, ADR-0106, ADR-0028, ADR-0107 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0109 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the thresholds and endpoints below may still change before acceptance.

Today connectors report health and `ingestion_runs` record success/failure, but nothing automatically stops a persistently failing connector from continuing to poll — wasting provider quota, generating noise, and risking rate-limit exhaustion. This document defines the functional behavior of the `healthy → degraded → failing → disabled` state machine, the automatic disable and limited automatic recovery rules, the explicit manual re-enable path (with its health-check gate), and the notifications/audit trail that keep operators aware of and in control of connector health.

### 2.2 Scope

**In scope:**
- Health state transitions: `healthy`, `degraded`, `failing`, `disabled`.
- Automatic transition to `failing` after 5 consecutive failed `ingestion_runs`, or immediately on a non-retryable failure.
- Automatic recovery from `degraded` to `healthy` after 3 consecutive successful runs.
- Explicit manual re-enable (`POST /v1/connectors/:platformId/enable`) with a lightweight health-check gate.
- `ConnectorHealthChangedEvent` and `ConnectorIngestionAlertEvent` emissions.
- Audit logging of re-enable actions.
- Admin UI `disabled` badge with last error and re-enable control.

**Out of scope:**
- Auto-recovery of a `failing` or `disabled` connector without explicit re-enablement.
- Configurable per-connector or per-tenant failure thresholds (open question).
- Billing treatment of `disabled` connectors' `connector_activations` status.
- Provider-specific troubleshooting wizards.
- Notification on every individual failed run (only the `failing`→`disabled` transition triggers an alert).

### 2.3 Target Audience

Backend engineers implementing the state machine and re-enable endpoint (Story 13.1); QA authoring threshold/recovery contract tests; Tenant Admins, the Sole-Operator persona, and Platform Admins who monitor and recover connectors.

---

## 3. Context and Background

ADR-0009/0010 already established health states and retryable-error classification; ADR-0051 added `connector_activations` and the `ingestion_runs.retryable` column. This ADR closes the loop: it defines exactly when a connector automatically stops polling, when it can recover on its own, and when a human must step in. The design deliberately favors a human-in-the-loop recovery model over automatic cooldown-based recovery, because silent resumption after a persistent failure can mask real problems and continue wasting quota — the risk this feature exists to prevent in the first place.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce wasted provider quota from failing connectors | Failed poll attempts per connector drop sharply after auto-disable triggers |
| G2 | Give operators clear visibility into connector health | Tenant/Platform Admins can see which connectors are `failing`/`disabled` and why |
| G3 | Prevent flapping | `failing`/`disabled` connectors never resume polling without an explicit re-enable or a successful health check |
| G4 | Enable downstream real-time alerting | Health-state transitions emit events usable by alert rules (ADR-0091) |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Health state machine

- **Description:** Governs the four-state lifecycle (`healthy` → `degraded` → `failing` → `disabled`, with recovery paths) that every `SocialConnector` moves through based on `ingestion_runs` outcomes.
- **Triggers:** Each completed `ingestion_run` (success or failure) evaluates the connector's current state and may transition it.
- **Inputs:** The connector's recent `ingestion_runs` history, specifically `status` and `retryable`.
- **Processing:**
  - `degraded`: one or more recent runs failed with `retryable` errors but some succeeded (BRU-001).
  - `failing`: 5 consecutive failed runs, or any single non-retryable failure (BRU-002).
  - `disabled`: the connector is automatically or manually deactivated and stops polling.
  - A `failing` connector's `shouldAttemptIngestion()` returns `false` (BRU-003) — no further polls are attempted while `failing`/`disabled`.
- **Outputs:** The connector's current health state, visible via the connector status API/UI.
- **Error handling:** N/A — this is itself the error-handling mechanism for ingestion failures.
- **Edge cases:** A connector alternating between success and retryable failure without ever reaching 5 consecutive failures remains `degraded` indefinitely until either it strings together 3 successes (recovers) or 5 consecutive failures (fails) — it does not get stuck ambiguously.

### 5.2 Feature / Capability: Auto-disable

- **Description:** Automatically stops polling for a connector that has crossed a failure threshold or hit a non-retryable error.
- **Triggers:** The 5th consecutive failed `ingestion_run`, or any single non-retryable failure.
- **Inputs:** `ingestion_runs.retryable` (the source of truth for failure classification) and the consecutive-failure count.
- **Processing:**
  - After 5 consecutive failed runs, `ConnectorHealth` transitions to `failing` and polling stops.
  - If the triggering failure is non-retryable (e.g., HTTP 401/403), the connector is disabled immediately — it does not wait for 5 consecutive failures (BRU-004).
  - A `ConnectorHealthChangedEvent` is emitted with `newState='failing'`.
- **Outputs:** Updated connector health state; a `ConnectorHealthChangedEvent` on Service Bus.
- **Error handling:** N/A (this is the failure-response mechanism itself).
- **Edge cases:** A connector that had 4 consecutive failures followed by 1 success resets the consecutive-failure counter — it does not "bank" partial progress toward the threshold.

### 5.3 Feature / Capability: Auto-recovery (degraded only)

- **Description:** Automatically restores a `degraded` connector to `healthy` without human intervention.
- **Triggers:** 3 consecutive successful `ingestion_runs` while the connector is `degraded`.
- **Inputs:** The connector's recent run outcomes.
- **Processing:** A `degraded` connector recovers to `healthy` automatically after 3 consecutive successes (BRU-005). A `failing` or `disabled` connector never auto-recovers this way — it requires explicit re-enable (BRU-006, 5.4).
- **Outputs:** Updated connector health state (`healthy`).
- **Error handling:** N/A.
- **Edge cases:** A connector that reaches 2 consecutive successes and then fails once resets the recovery counter to 0, requiring another full run of 3 successes.

### 5.4 Feature / Capability: Manual re-enable with health check

- **Description:** The explicit, auditable path by which a `failing`/`disabled` connector is brought back into service.
- **Triggers:** `POST /v1/connectors/:platformId/enable` called by an authorized actor.
- **Inputs:** The connector/platform id; the caller's identity and role.
- **Processing:**
  1. Authorization: `Tenant-Admin` or `Platform-Admin` may re-enable any connector in scope; for a user-bound (Tier-3) connector, only the owning user may additionally re-enable it themselves (BRU-009).
  2. Re-enable begins with a health-check attempt: a lightweight poll with `limit=1` (BRU-007), not a full normal poll.
  3. If the health check succeeds, the connector transitions to `healthy` and normal polling resumes.
  4. If the health check fails, the connector returns to `failing` and the consecutive-failure counter resets to 1 (BRU-008) — not back to 0, since the failed health check itself counts as one failure.
  5. The re-enable action is recorded in `platform_admin_audit_log` (BRU-010).
- **Outputs:** Updated connector health state (`healthy` or back to `failing`); an audit log entry.
- **Error handling:** A re-enable request from an unauthorized caller (wrong role, or not the owning user for a Tier-3 connector) is rejected with `403`.
- **Edge cases:** Rapid repeated re-enable calls against the same connector should not bypass the health-check gate or double-count consecutive-failure resets — each call runs its own independent health-check cycle.

### 5.5 Feature / Capability: Notifications on disable

- **Description:** Alerts relevant parties when a connector transitions from `failing` to `disabled`.
- **Triggers:** The `failing` → `disabled` transition.
- **Inputs:** The connector's identity, tenant, and last error.
- **Processing:** A `ConnectorIngestionAlertEvent` is emitted. If a webhook subscription for this event type exists (ADR-0106), it is delivered. No notification is sent for every individual failed run — only this specific transition.
- **Outputs:** The alert event on Service Bus; a delivered webhook (if subscribed); an updated admin UI badge.
- **Error handling:** A webhook delivery failure follows the existing webhook retry/dead-letter behavior (ADR-0106) and does not block the internal alert event from being recorded.
- **Edge cases:** A tenant with no webhook subscription for this event type still sees the in-app `disabled` badge — the UI signal does not depend on webhook configuration.

### 5.6 Feature / Capability: Admin UI disabled indicator

- **Description:** Surfaces connector health and a recovery action in the connector status screen.
- **Triggers:** A connector's health state is `failing` or `disabled`.
- **Inputs:** The connector's current state and last error message.
- **Processing:** The connector card/row shows a `disabled` badge, the last error, and a re-enable button. Clicking re-enable calls 5.4's endpoint.
- **Outputs:** A visible status indicator and a one-click recovery action.
- **Error handling:** If the re-enable call fails (e.g., unauthorized), the UI surfaces the error rather than silently leaving the badge unchanged with no feedback.
- **Edge cases:** A user without re-enable permission (e.g., a `tenant_user` for a tenant-wide connector) sees the badge but not an actionable re-enable button, or sees it disabled/grayed out.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Admin | Owns tenant connectors and budget; re-enables failing/disabled connectors |
| Sole-Operator | Runs a single-tenant deployment; needs a one-screen view of failing sources |
| Platform-Admin | Cross-tenant operational visibility and audit trail |
| Tenant-User | Consumes the post feed; benefits indirectly from reliable, non-noisy sources |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 13.1) | backend engineer | `failing`/`degraded`/`disabled` health transitions and explicit re-enable rules | failing connectors stop polling and can be safely re-enabled | `ConnectorHealth` transitions to `failing` after 5 consecutive failed runs; non-retryable failures immediately disable; `POST /v1/connectors/:platformId/enable` re-enables with a health-check attempt; disabled connectors do not poll; `ConnectorIngestionAlertEvent` is emitted on `failing`→`disabled` |

### 6.3 Workflow Diagrams / Steps

**Auto-disable workflow:**
1. A connector's poll (`ingestion_run`) completes with a failure.
2. The system checks `retryable`. If non-retryable, the connector transitions directly to `failing`/`disabled` and emits `ConnectorHealthChangedEvent`/`ConnectorIngestionAlertEvent`.
3. If retryable, the consecutive-failure counter increments. At 5 consecutive failures, the connector transitions to `failing` (and effectively `disabled` for polling purposes), emitting both events.
4. `shouldAttemptIngestion()` now returns `false`; the scheduler skips this connector on subsequent ticks.

**Auto-recovery (degraded) workflow:**
1. A `degraded` connector's poll succeeds.
2. The consecutive-success counter increments.
3. At 3 consecutive successes, the connector transitions to `healthy` automatically.

**Manual re-enable workflow:**
1. An authorized user (Tenant-Admin, Platform-Admin, or the owning Tier-3 user) clicks "Re-enable" or calls the endpoint.
2. The system performs a `limit=1` health-check poll.
3. On success, the connector becomes `healthy` and resumes normal polling.
4. On failure, the connector returns to `failing` with the counter reset to 1, and the badge/error updates accordingly.
5. The action is written to `platform_admin_audit_log` regardless of outcome.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `ingestion_runs.status` and `ingestion_runs.retryable` (existing, ADR-0051/0052).
- The re-enable request (`platformId`, caller identity/role).

### 7.2 Data Outputs

- Connector health state, surfaced via the connector status API and admin UI.
- `ConnectorHealthChangedEvent`, `ConnectorIngestionAlertEvent` on Service Bus.
- `platform_admin_audit_log` entries for re-enable actions.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Connector health state (derived, not a new table) | Current value: `healthy` \| `degraded` \| `failing` \| `disabled`; consecutive-failure/success counters | Derived from `ingestion_runs`; associated with `connector_activations` |
| `ingestion_runs` (existing) | `status`, `retryable`, timestamp | Source of truth for health derivation |
| `connector_activations` (existing, ADR-0051) | `is_active` and ownership tier | Governs who may re-enable; toggled by the enable/disable flow |
| `platform_admin_audit_log` (existing) | Actor, timestamp, connector identifier, action | Written on every re-enable call |
| `ConnectorHealthChangedEvent` (Service Bus event) | `connectorId`, `tenantId`, `newState`, `timestamp` | Emitted on state transitions to `failing` |
| `ConnectorIngestionAlertEvent` (Service Bus event) | `connectorId`, `tenantId`, `lastError`, `timestamp` | Emitted on `failing` → `disabled` |

### 7.4 Validation Rules

- `degraded`: some recent runs failed with retryable errors, some succeeded (BRU-001).
- `failing`: 5 consecutive failed runs, or one non-retryable failure (BRU-002).
- A `failing` connector's `shouldAttemptIngestion()` is `false` (BRU-003).
- Non-retryable failures disable immediately (BRU-004).
- `degraded` → `healthy` after 3 consecutive successes (BRU-005).
- `failing`/`disabled` never auto-recover (BRU-006).
- Re-enable always performs a `limit=1` health-check first (BRU-007).
- Health-check success → `healthy`; failure → `failing` with counter reset to 1 (BRU-008).
- Only `Tenant-Admin`/`Platform-Admin`/owning Tier-3 user may re-enable (BRU-009).
- Every re-enable is audit-logged (BRU-010).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | 5 consecutive failed runs → `failing` | Health state machine |
| BR2 | Any non-retryable failure → immediate `failing`/`disabled` | Health state machine |
| BR3 | 3 consecutive successes from `degraded` → `healthy` | Auto-recovery |
| BR4 | `failing`/`disabled` require explicit re-enable, never auto-recover | Auto-recovery boundary |
| BR5 | Re-enable always starts with a `limit=1` health check | Manual re-enable |
| BR6 | Failed health check resets the counter to 1, not 0 | Manual re-enable |
| BR7 | Re-enable authorization respects role and Tier-3 ownership | Manual re-enable |
| BR8 | Every re-enable is recorded in the audit log | Audit logging |
| BR9 | `failing`→`disabled` (not every failed run) triggers `ConnectorIngestionAlertEvent` | Notifications |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `ingestion_runs` (existing) | Read | Source of truth for health derivation | Postgres |
| Ingestion scheduler | Internal | Consults `shouldAttemptIngestion()` before each tick | Internal call |
| `POST /v1/connectors/:platformId/enable` | Inbound API | Manual re-enable | REST/JSON |
| Service Bus | Outbound | `ConnectorHealthChangedEvent`, `ConnectorIngestionAlertEvent` | Azure Service Bus |
| Webhook delivery (ADR-0106) | Outbound (optional) | Delivers `ConnectorIngestionAlertEvent` to subscribed tenant endpoints | HTTPS POST, HMAC signed |
| `platform_admin_audit_log` | Write | Records re-enable actions | Postgres |
| Connector status admin UI | Internal | Displays `disabled` badge, last error, re-enable control | React UI |

---

## 10. Non-Functional Considerations

- **Performance:** Health derivation must run within the existing 60-second poll tick budget, adding no more than 100 ms per tick (NFR-001).
- **Security / access control:** Health transitions and re-enable actions are multi-tenant safe; RLS and role checks prevent cross-tenant exposure (NFR-002).
- **Reliability:** Every health-state change is traceable to the triggering `ingestion_run` id, observable in monitoring (NFR-003).
- **Usability:** Re-enable is achievable from the connector status screen in fewer than 3 clicks (NFR-004).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| 5th consecutive retryable failure | Connector badge shows `failing` | Polling stops; `ConnectorHealthChangedEvent` emitted |
| Non-retryable failure (e.g., 401/403) | Connector badge shows `disabled`, last error shown | Immediate disable, no waiting for the threshold |
| Unauthorized re-enable attempt | `403 Forbidden` | Request denied; connector state unchanged |
| Re-enable health check fails | Badge returns to `failing` with updated error | Consecutive-failure counter reset to 1, not 0 |
| Webhook delivery of `ConnectorIngestionAlertEvent` fails | None (tenant-side, per ADR-0106) | Retried per existing webhook retry/dead-letter behavior; internal event still recorded |
| Re-enable called on an already-healthy connector | No-op / informational response | Health check still runs; state remains `healthy` on success |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- `ingestion_runs.retryable` is already populated and reliable (ADR-0051/0052).
- Existing activation and health-state machinery is in place (ADR-0009/0010, ADR-0051).
- Role/ownership-tier enforcement is available (ADR-0028, ADR-0107).
- Webhook delivery infrastructure exists and is consumed optionally (ADR-0106).

**Dependencies:**
- ADR-0009 (ingestion health) — accepted.
- ADR-0010 (retryable errors) — accepted.
- ADR-0051 (connector activation) — accepted.
- ADR-0101 (connector capabilities) — accepted.
- ADR-0106 (webhooks) — in place, consumed optionally.
- ADR-0028 / ADR-0107 (role/ownership enforcement) — in place.
- Story 13.1 (backend), currently Blocked pending ADR-0109 acceptance.

**Pending decisions:** ADR-0109 is Proposed; open questions below must be resolved before or during Story 13.1 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the consecutive-failure threshold be configurable per connector or per tenant? | Product Owner | Before Story 13.1 implementation |
| Q2 | Should Platform-Admin be able to re-enable any tenant's connector, or only tenant-wide connectors? | Product Owner | Before Story 13.1 implementation |
| Q3 | How is the health-check attempt different from a normal poll — does it use a smaller result set beyond `limit=1`? | Technical Lead | Before Story 13.1 implementation |
| Q4 | Should `disabled` connectors still count toward `connector_activations` billing, or are they paused? | Product Owner | Before Story 13.1 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| `SocialConnector` | A pluggable source that polls external content into the normalized post stream. |
| `ingestion_run` | A single poll attempt and its outcome, recorded in `ingestion_runs`. |
| Retryable | A failure caused by a transient condition (e.g., 5xx, 429) that may succeed on retry. |
| Non-retryable | A failure caused by a persistent condition (e.g., 401/403) requiring intervention. |
| `degraded` | Health state where some recent runs failed but others succeeded. |
| `failing` | Health state where the connector has crossed the consecutive-failure threshold. |
| `disabled` | Health/activation state where the connector is stopped and will not poll. |
| Health-check attempt | A lightweight re-enablement poll, typically `limit=1`, confirming recovery. |

### Reference links

- ADR-0109: `docs/adr/0109-connector-health-auto-disable-and-recovery.md` (Proposed)
- BRD-0109: `docs/project docs/Business-Requirements/BRD-0109-Connector-Health-Auto-Disable-And-Recovery.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Related ADRs: ADR-0009 (ingestion health), ADR-0010 (retryable errors), ADR-0051 (connector activation), ADR-0101 (connector capabilities), ADR-0106 (webhooks), ADR-0028/ADR-0107 (role/ownership)
- Related user stories: Story 13.1 (backend) — `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing sources

- No `docs/product-research/reports/01-multi-source-ingestion-deep-research.md` deep-research brief was found for this feature.
- No dedicated frontend story exists for this ADR beyond the connector status UI badge/re-enable control, which is covered inline in Story 13.1's acceptance criteria and the existing connector status screen.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
