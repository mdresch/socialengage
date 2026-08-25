# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0070 Connector Ingestion Health Status, Hanging Run Reconciliation, and Inactivity Alerting — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated) |
| Reviewer(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0070, BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md, Story 1.16 (epic-1), Story 6.29 (epic-6), ADR-0005/0009/0010/0023/0052/0058/0061 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0070 (Accepted, 2026-08-20) and BRD-0070 into the functional design for: (a) a lock-safe automated watchdog that reconciles stale/orphaned `running` ingestion runs, (b) an extended `ConnectorHealthStatus` including a new `stalled` state with a strict derivation precedence, (c) structured `ConnectorIngestionAlertEvent` publishing on Azure Service Bus, and (d) Admin UI status badges, a global ingestion alert banner, and an on-demand "Force Retry / Re-sync" action.

### 2.2 Scope

- **In scope:**
  - `reconcileStaleIngestionRuns` watchdog function, executed at the start of every scheduler tick, with lock-safe (`FOR UPDATE SKIP LOCKED`) reconciliation of stale `running` rows.
  - A supporting partial database index for O(1) watchdog sweeps.
  - Extension of `ConnectorHealthStatus` with `'stalled'` and the six-step strict derivation precedence.
  - `ConnectorIngestionAlertEvent` publishing for `run_timed_out`, `ingestion_stalled`, `connector_failing`, and `reconnect_required`, with throttling for `run_timed_out`.
  - `POST /v1/connectors/:id/retry` and `POST /v1/connectors/:id/users/:userId/retry` idempotent force-retry endpoints.
  - Admin UI: connector status badges (including `Stalled / No Ingestion`), operational timestamps/cadence display, global ingestion alert banner, and "Re-sync now" action with loading/success/409 handling.
- **Out of scope:**
  - Third-party push, email, SMS, Slack, or PagerDuty notification delivery (Service Bus events are produced for downstream consumers only, not delivered by the core pipeline itself).
  - Re-architecting the connector `poll()` loop or content normalization logic.
  - Predictive stall detection using ML or anomaly models.
  - Multi-tenant alert aggregation for Platform-Admin dashboards.

### 2.3 Target Audience

Backend engineers (`social-listening-core`), frontend engineers (`social-listening-admin`), QA/contract authors, product owner, platform operators.

---

## 3. Context and Background

Story 1.14 (ADR-0052 §5b) and Story 1.15 (ADR-0061 §2) introduced an in-flight concurrency guard in `pollScheduler.ts`: before polling, the scheduler checks `getMostRecentRunStatus()` and skips the poll if the most recent run is still `'running'`. This correctly prevents same-process poll overlaps, but has a critical gap: in production, a Node.js process restart, container redeployment, uncaught exception, SIGTERM/SIGKILL, or unhandled socket hang can leave an `ingestion_runs` row permanently at `status = 'running'` with `completed_at = NULL`. Because `getMostRecentRunStatus()` then perpetually returns `'running'`, the scheduler **permanently skips all future ticks** for that `(tenantId, platformId[, userId])` — ingestion stops silently and permanently with no automatic recovery or notification.

Separately, even without an orphaned run, an active connector can silently stop producing content due to upstream silent outages (HTTP 200 with empty/unchanged payload), circuit-breaker lockout (repeated non-retryable failures), or scheduler starvation/drift. `ConnectorHealthStatus` previously had no way to distinguish a healthy, on-schedule connector from one that has stalled. There was also no proactive alerting mechanism and no top-level UI banner or manual recovery trigger — only the connector status screen's on-demand metrics, visible only when a user happens to navigate there.

ADR-0070 builds on ADR-0005 (`IngestionRun` audit anchor), ADR-0009 (derived, not stored, `ConnectorHealth`), ADR-0010 (error handling/auto-disable), ADR-0023 (proportional failure threshold/circuit breaker), ADR-0052 (live scheduler/in-flight guard), ADR-0058 (ingestion events), and ADR-0061 (Tier-3 per-user scheduler). It is implemented by Story 1.16 (backend, built 2026-08-20) and Story 6.29 (UI, built 2026-08-20).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Eliminate permanent ingestion deadlocks from orphaned/hung `running` runs | A reconciled stale run is marked `failed` with `retryable = true`; the next scheduler tick resumes polling for that target |
| G2 | Make connector inactivity visible before users discover data gaps themselves | `stalled` health is derived and surfaced whenever a connector has not attempted or successfully fetched within configured thresholds |
| G3 | Enable proactive alerting for ingestion anomalies | `ConnectorIngestionAlertEvent` messages are emitted for `run_timed_out`, `ingestion_stalled`, `connector_failing`, and `reconnect_required` |
| G4 | Provide self-service recovery for tenant admins and Tier-3 users | Authorized users can trigger "Force Retry / Re-sync" from the Admin UI and receive immediate feedback |
| G5 | Preserve a complete, honest audit trail | Every reconciliation, health transition, and manual retry is reflected in `ingestion_runs` and health history |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Lock-Safe Watchdog Stale Run Reconciliation (`reconcileStaleIngestionRuns`)

- **Description:** Automatically detects and reconciles `ingestion_runs` rows orphaned in `status = 'running'` due to process restarts, redeployments, crashes, or hangs, unblocking the scheduler's in-flight guard.
- **Triggers:** Executed automatically at the start of every `runSchedulerTick()`, before any connector is evaluated for polling.
- **Inputs:** Current `ingestion_runs` table state; the connector's `effectiveCadenceMs` (Tier-3 user-level or Tier-2 platform/tenant-level cadence).
- **Processing:**
  1. Compute `MAX_RUN_DURATION_MS = max(15 minutes, 2 * effectiveCadenceMs)` for the run's context; default fallback is 15 minutes when cadence is unknown.
  2. A run is stale if `status = 'running' AND started_at < (NOW() - MAX_RUN_DURATION_MS)`.
  3. Execute a row-locked, non-blocking update: `SELECT id FROM ingestion_runs WHERE status = 'running' AND started_at < NOW() - INTERVAL '15 minutes' FOR UPDATE SKIP LOCKED`, then `UPDATE` the selected rows to `status = 'failed'`, `completed_at = NOW()`, `error_summary = 'Ingestion run timed out or aborted (reconciled by watchdog)'`, `retryable = true`.
  4. `FOR UPDATE SKIP LOCKED` ensures rows currently being finalized by a legitimately-completing worker are skipped rather than overwritten mid-transition — no race condition.
  5. Return reconciled row details (`id`, `tenant_id`, `platform_id`, `user_id`, `started_at`) to the caller for alert emission (5.3).
- **Outputs:** Updated `ingestion_runs` rows (now `failed`, `retryable = true`); the scheduler's `getMostRecentRunStatus()` immediately reflects `failed`, unblocking the in-flight guard so the next tick can poll normally.
- **Error handling:** If the reconciliation query itself fails (e.g. transient DB error), the scheduler tick logs the failure and proceeds without blocking other connectors' polling for that tick.
- **Edge cases:** A run that completes normally in the few milliseconds between the watchdog's row selection and its own completion is protected by `SKIP LOCKED` — it is not reconciled. A run inside the threshold (e.g. started 10 minutes ago against a 15-minute threshold) is left untouched.

### 5.2 Feature / Capability: Watchdog Query Performance (Partial Index)

- **Description:** Ensures the watchdog sweep remains O(1) regardless of the historical size of `ingestion_runs`.
- **Triggers:** Database migration applied once; queried on every watchdog sweep thereafter.
- **Inputs:** N/A (schema-level).
- **Processing:** Adds a partial index `idx_ingestion_runs_stale_watchdog` on `ingestion_runs(status, started_at) WHERE status = 'running'`, scoping the index to only currently-running rows (a small, bounded subset regardless of total table size).
- **Outputs:** Fast, indexed lookups for the watchdog's `WHERE status = 'running' AND started_at < ...` predicate.
- **Error handling:** N/A (schema prerequisite; absence would degrade performance, not correctness).
- **Edge cases:** None beyond standard migration rollout considerations.

### 5.3 Feature / Capability: Extended Connector Health Derivation with `'stalled'` (Strict Precedence)

- **Description:** Widens the derived `ConnectorHealthStatus` union to include `'stalled'`, and enforces a strict, unambiguous precedence order so `stalled` never masks a more severe failure state and vice versa.
- **Triggers:** Any call to `deriveConnectorHealth(tenantId, platformId, pageId?, userId?)` — e.g. status screen render, alert-banner evaluation, force-retry response.
- **Inputs:** `ingestion_runs` history for the target; `credentialStatus`; `isConnectorActive`; `lastAttemptAt`; `lastSuccessfulFetchAt`; `effectiveCadenceMs`.
- **Processing (strict precedence, evaluated in order, first match wins):**
  1. `disconnected` — if zero runs exist in history.
  2. `reconnect_required` — if the latest run failed with `is_credential_failure = true`, OR `credentialStatus` is `'expired'`/`'revoked'`.
  3. `failing` — if consecutive non-retryable failures reach `CONSECUTIVE_FAILURE_CEILING = 20`, OR the trailing-hour failure rate reaches `RATE_FAILURE_THRESHOLD = 0.5` across at least `RATE_ATTEMPT_FLOOR = 5` attempts (ADR-0023).
  4. `stalled` — if active (`isConnectorActive === true`) with valid credentials (`credentialStatus === 'valid'`), not matched by 1–3, and either `now - lastAttemptAt >= 3 * effectiveCadenceMs` (minimum 45 minutes) OR `now - lastSuccessfulFetchAt >= MAX_INGESTION_SILENCE_MS` (default 24 hours), with at least one prior run.
  5. `degraded` — if a recent failure occurred within the trailing hour but a success also occurred.
  6. `healthy` — otherwise (default/normal operation).
- **Outputs:** A single `ConnectorHealthStatus` value consumed by the status screen, alert-banner logic, and force-retry authorization checks.
- **Error handling:** Missing/undefined inputs (e.g. no `lastAttemptAt` on a newly-connected connector with zero runs) fall through to `disconnected` at step 1 rather than raising an error.
- **Edge cases:** A connector exactly at the 45-minute or 24-hour boundary is treated as having crossed it (inclusive `>=`); a connector that is `failing` due to the rate-based threshold but also technically past the stall silence window still returns `failing` (step 3 wins before step 4 is evaluated).

### 5.4 Feature / Capability: Structured Ingestion Alert Events on Service Bus

- **Description:** Publishes structured `ConnectorIngestionAlertEvent` messages to Azure Service Bus when ingestion anomalies are detected, for downstream consumption (operator runbooks, future notification channels).
- **Triggers:** (a) Each row reconciled by the watchdog sweep (5.1); (b) a derived-health transition into `'stalled'`; (c) a derived-health transition into `'failing'`/`'reconnect_required'` (auto-disable or credential revocation).
- **Inputs:** Reconciled run metadata; health-derivation transition context.
- **Processing:**
  - Event shape: `{ tenantId, platformId, userId?, alertType: 'run_timed_out' | 'ingestion_stalled' | 'connector_failing' | 'reconnect_required', severity: 'warning' | 'critical', message, occurredAt, metadata: { consecutiveFailures?, lastAttemptAt?, lastSuccessfulFetchAt?, staleRunId? } }`.
  - `run_timed_out` (severity `warning`): emitted per reconciled run row, with `metadata.staleRunId` populated; throttled/batched to at most once per `(tenantId, platformId[, userId])` per sweep window to prevent alert storms during mass reconciliation.
  - `ingestion_stalled` (severity `warning`): emitted when derived health transitions into `'stalled'` (on transition, not every evaluation).
  - `connector_failing` / `reconnect_required` (severity `critical`): emitted when derived health transitions into an auto-disable or credential-revocation state.
- **Outputs:** Published Service Bus messages consumable by downstream systems.
- **Error handling:** A Service Bus publish failure is logged but does not block or roll back the underlying reconciliation/health-derivation operation (alert emission is best-effort, not transactional with the state change).
- **Edge cases:** A sweep reconciling many stale runs for the same target in one pass still emits at most one `run_timed_out` event for that target for that sweep window.

### 5.5 Feature / Capability: Idempotent Force Retry / Re-sync API

- **Description:** Lets an authorized user manually reconcile stale runs, reset circuit-breaker counters, and trigger an immediate poll for a specific connector or Tier-3 user, without direct database access.
- **Triggers:** `POST /v1/connectors/:id/retry` (Tier-2/tenant-wide) or `POST /v1/connectors/:id/users/:userId/retry` (Tier-3).
- **Inputs:** Connector/platform ID; optional `userId` (Tier-3); caller's authenticated identity and role.
- **Processing:**
  1. Authorization: gated by `requireTenantAdmin`, or — for Tier-3 — the authenticated user matching the `:userId` path segment, with strict tenant-isolation validation.
  2. Reconcile any stale runs for the target (reuses 5.1's logic scoped to the target).
  3. Reset circuit-breaker transient failure counters (`consecutiveFailures = 0`, cooldown cleared).
  4. Trigger an immediate on-demand `connector.poll(tenantId)` (Tier-2) or `pollUser(tenantId, userId)` (Tier-3).
  5. Idempotency check: if a legitimate run is currently `running` and was started within the last 60 seconds, return HTTP `409` ("Run already in progress") instead of starting a duplicate poll.
- **Outputs:** HTTP 200 with triggered-run confirmation, or HTTP 409 conflict response.
- **Error handling:** An unauthorized caller (wrong tenant, wrong Tier-3 user, non-admin) receives an authorization failure before any reconciliation or poll is attempted. A 409 is a safe, non-erroring outcome, not a failure.
- **Edge cases:** A retry request for a connector already in `reconnect_required` status still reconciles stale runs and clears failure counters, but the subsequent poll attempt will itself likely re-fail authentication until the credential is actually reconnected — this is expected, not a defect.

### 5.6 Feature / Capability: Admin UI — Connector Status Badges & Operational Metrics

- **Description:** Renders explicit, unambiguous health badges and operational timestamps for each connector on the status screen.
- **Triggers:** Tenant Admin/user navigates to `/tenant/connectors` or `/tenant/connectors/status`.
- **Inputs:** Derived `ConnectorHealthStatus` (5.3) and `lastAttemptAt`/`lastSuccessfulFetchAt`/cadence for each connector.
- **Processing:**
  - Renders one of: `Healthy` (Green), `Degraded` (Amber), `Stalled / No Ingestion` (Amber-Red), `Failing / Suspended` (Red), `Reconnect Required` (Red), `Disconnected` (Gray).
  - Displays **Last Ingestion Attempt** as a relative timestamp (e.g. "10 mins ago") with an ISO tooltip, from `lastAttemptAt`.
  - Displays **Last Successful Ingestion** as a relative timestamp with an ISO tooltip, from `lastSuccessfulFetchAt`.
  - Displays **Ingestion Cadence** (e.g. "Poll interval: 15m").
- **Outputs:** Rendered connector status cards.
- **Error handling:** A connector with no prior runs shows `Disconnected` and omits attempt/success timestamps rather than showing a misleading "never" or blank value inconsistently.
- **Edge cases:** A connector whose `lastSuccessfulFetchAt` is null (never successfully fetched) but has attempted recently shows `Last Successful Ingestion: —` rather than an error.

### 5.7 Feature / Capability: Admin UI — On-Demand "Force Retry / Re-sync" Button

- **Description:** Gives authorized users a one-click recovery action directly from the connector card.
- **Triggers:** User clicks "Re-sync now" on an active Ingestion Connector card.
- **Inputs:** Connector/platform ID; Tier-3 `userId` where applicable.
- **Processing:**
  - Rendered only for `tenant_admin` users, or — for Tier-3 connectors — the user owning the credential, and only when the connector is active.
  - Invokes `POST /v1/connectors/:id/retry` (or the Tier-3 variant) via the `/api/connectors/[id]/retry` Next.js proxy route.
  - While in-flight: shows a loading spinner and disables repeat clicks.
  - On success: shows a toast ("Ingestion run triggered") and immediately refreshes connector metrics.
  - On HTTP 409: shows an informative "Run already in progress" message without an error state.
- **Outputs:** Updated connector card reflecting the newly-triggered run once metrics refresh.
- **Error handling:** A non-409 failure response (e.g. 403 unauthorized, 5xx) shows a generic error toast without crashing the card.
- **Edge cases:** Rapid double-clicking is prevented by the disabled-while-loading state, not merely a debounce.

### 5.8 Feature / Capability: Admin UI — Global Ingestion Alert Banner

- **Description:** Surfaces a prominent, top-level banner when any active connector for the tenant is unhealthy, so users do not need to proactively check the connectors screen.
- **Triggers:** Render of `/tenant/analytics` (Overview tab) or `/tenant/connectors`.
- **Inputs:** Derived health for all active connectors for the tenant.
- **Processing:**
  - If any active connector is in `stalled`, `failing`, or `reconnect_required` status, renders a banner detailing the affected platform(s), a reason (e.g. "Ingestion stalled — no posts received in > 24 hours"), and direct actions ("Re-sync now" or "Reconnect account").
  - Dismissible for the current browser session, but reappears on the next page load if the underlying status remains unresolved.
- **Outputs:** Rendered banner (or its absence when all active connectors are healthy/degraded-only).
- **Error handling:** A banner-data fetch failure fails silently (no banner) rather than blocking page render.
- **Edge cases:** Multiple simultaneously-unhealthy connectors are summarized in a single banner rather than stacking multiple banners; dismissing the banner for one unresolved issue does not suppress a newly-arising, different issue on the next load if the underlying condition changed.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Administrator | Views connector health, triggers Force Retry/Re-sync, resolves alert banners |
| Tenant User (Tier-3 credential owner) | Views health for their own connectors, triggers Force Retry/Re-sync for owned Tier-3 connectors |
| Sole Operator | Combines both business and technical operator concerns; relies on one screen for counts, health, and recovery |
| Platform Administrator | Benefits from self-healing (avoids manual database cleanup) |
| Background Scheduler | System actor; runs the watchdog at the start of every tick |
| Downstream alert/runbook consumers | External/internal system actors consuming `ConnectorIngestionAlertEvent` from Service Bus |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 1.16 | System operator / platform engineer | Have orphaned or hung `running` ingestion runs automatically reconciled by a lock-safe scheduler watchdog, inactive connectors derived as `stalled`, and structured alert events published to Service Bus | Polling deadlocks cannot occur after server restarts or network hangs, and ingestion failures/stalls trigger proactive notifications | Partial index added; `reconcileStaleIngestionRuns` uses `FOR UPDATE SKIP LOCKED`; `stalled` added with strict precedence; `ConnectorIngestionAlertEvent` emitted for all four alert types; idempotent force-retry endpoints implemented |
| Story 6.29 | Tenant-Admin or Tenant User | See clear, real-time ingestion status badges (including `Stalled`), actionable alert banners when ingestion stops, and an on-demand "Force Retry / Re-sync" action | I am immediately aware when ingestion has stalled and can proactively trigger recovery without database intervention | `StatusBadge` widened to include `stalled`; operational metrics (last attempt, last success, cadence) rendered; re-sync button with loading/success/409 handling; global banner on Overview and Connectors screens |

Both stories are marked **Built** (2026-08-20) in `docs/user-stories/epic-1-repository-and-api-foundation.md` and `docs/user-stories/epic-6-tenant-admin-ui.md` respectively, sourced from ADR-0070.

### 6.3 Workflow Diagrams / Steps

**Watchdog reconciliation (background, per scheduler tick):**
1. `runSchedulerTick()` begins.
2. `reconcileStaleIngestionRuns()` runs first: selects stale `running` rows with `FOR UPDATE SKIP LOCKED`, updates them to `failed`/`retryable=true`, returns reconciled row details.
3. For each reconciled row, a throttled `run_timed_out` alert event is published.
4. The scheduler proceeds to evaluate each connector's in-flight guard using the now-current (possibly just-reconciled) run status, and polls connectors that are eligible.
5. After polling, `deriveConnectorHealth()` is (re-)evaluated as needed for status/alerting purposes; transitions into `stalled`, `failing`, or `reconnect_required` emit the corresponding alert event.

**Manual force retry (interactive):**
1. User clicks "Re-sync now" on a connector card.
2. UI calls the retry proxy route, which calls `POST /v1/connectors/:id/retry` (or Tier-3 variant).
3. Backend authorizes the caller, reconciles stale runs for the target, resets failure counters, and triggers an immediate poll — unless a run started within the last 60 seconds is still active, in which case it returns 409.
4. UI shows a loading state, then a success toast and refreshed metrics, or a 409 informational message.

**Global banner resolution (interactive):**
1. On page load of `/tenant/analytics` (Overview) or `/tenant/connectors`, the UI evaluates derived health for all active connectors.
2. If any is `stalled`/`failing`/`reconnect_required`, the banner renders with affected platform(s), reason, and direct actions.
3. User dismisses the banner for the session, or acts on it (re-sync / reconnect).
4. On the next page load, the banner re-evaluates and reappears if the condition is still unresolved.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `ingestion_runs` table state (`status`, `started_at`, `completed_at`, `error_summary`, `retryable`, `is_credential_failure`).
- `platform_credentials` credential status (`valid`/`expired`/`revoked`).
- Connector activation/configuration (`isConnectorActive`, `effectiveCadenceMs`).

### 7.2 Data Outputs

- Reconciled `ingestion_runs` rows (`failed`, `retryable = true`, `completed_at` set).
- Derived `ConnectorHealthStatus` values consumed by the status screen and alert banner.
- `ConnectorIngestionAlertEvent` messages on Azure Service Bus.
- HTTP responses from the force-retry endpoints (200 with triggered-run confirmation, or 409 conflict).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `ingestion_runs` | `id`, `tenant_id`, `platform_id`, `user_id?`, `status` (`running`\|`failed`\|`completed`\|...), `started_at`, `completed_at`, `error_summary`, `retryable`, `is_credential_failure` | Audit anchor per poll attempt; watchdog scans/updates rows where `status='running'` |
| `idx_ingestion_runs_stale_watchdog` (partial index) | On `ingestion_runs(status, started_at) WHERE status = 'running'` | Supports O(1) watchdog scans |
| `ConnectorHealthStatus` (derived, not stored) | `healthy` \| `degraded` \| `failing` \| `disconnected` \| `reconnect_required` \| `stalled` | Computed from `ingestion_runs` history + `platform_credentials` status; not itself a stored table |
| `ConnectorIngestionAlertEvent` | `tenantId`, `platformId`, `userId?`, `alertType` (`run_timed_out`\|`ingestion_stalled`\|`connector_failing`\|`reconnect_required`), `severity` (`warning`\|`critical`), `message`, `occurredAt`, `metadata` (`consecutiveFailures?`, `lastAttemptAt?`, `lastSuccessfulFetchAt?`, `staleRunId?`) | Published to Service Bus; references the tenant/platform/user context of the underlying `ingestion_runs`/health transition |
| `platform_credentials` | `credentialStatus` (`valid`\|`expired`\|`revoked`) | Consumed (read-only) by health derivation |
| Force-retry request/response | `connectorId`, `userId?` (path); response: 200 (triggered) or 409 (`"Run already in progress"`) | Bound to `ingestion_runs` reconciliation and an immediate poll invocation |

### 7.4 Validation Rules

- A run must never be reconciled by the watchdog while a concurrent worker is actively finalizing it (`FOR UPDATE SKIP LOCKED` guarantees this).
- `MAX_RUN_DURATION_MS` must never be computed as less than 15 minutes, even if `2 * effectiveCadenceMs` would be smaller.
- `deriveConnectorHealth()` must evaluate the six states in the fixed precedence order; a lower-precedence state must never be returned when a higher-precedence condition is met.
- `run_timed_out` alert emission must be throttled to at most one per `(tenantId, platformId[, userId])` per sweep window, regardless of how many rows for that target were reconciled in the same sweep.
- The force-retry endpoint must return 409 (not proceed) whenever a run for the same target started within the last 60 seconds and is still `running`.
- Force-retry authorization must strictly enforce tenant isolation and, for Tier-3, exact `userId` match — no cross-tenant or cross-user retry is permitted.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A `running` ingestion run is stale when `started_at < NOW() - MAX_RUN_DURATION_MS`, where `MAX_RUN_DURATION_MS = max(15 minutes, 2 * effectiveCadenceMs)`. | Watchdog reconciliation |
| BR2 | Health derivation follows strict precedence: `disconnected` → `reconnect_required` → `failing` → `stalled` → `degraded` → `healthy`. | Health derivation |
| BR3 | `stalled` is derived only for active connectors with valid credentials that are not already `reconnect_required` or `failing`. | Health derivation |
| BR4 | `stalled` is triggered when `now - lastAttemptAt >= 3 * effectiveCadenceMs` (minimum 45 minutes) OR `now - lastSuccessfulFetchAt >= 24 hours`. | Health derivation |
| BR5 | Force retry is authorized for `tenant_admin` users, or for Tier-3 connectors, the authenticated user who owns the credential. | Force retry authorization |
| BR6 | A force retry returns 409 if a run started within the last 60 seconds is actively `running`. | Force retry idempotency |
| BR7 | `ConnectorIngestionAlertEvent` `run_timed_out` warnings are batched/throttled to at most one per target per sweep window. | Alert emission |
| BR8 | Global alert banners reappear on the next page load if the underlying connector status remains unresolved. | UI banner behavior |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `ingestion_runs` table (Postgres) | Internal | Watchdog read/update target; audit anchor | Database (row-locked SQL) |
| Tier-3/Tier-2 poll scheduler (`pollScheduler.ts`) | Internal | Invokes watchdog at start of every tick; consumes reconciled status | In-process scheduling |
| `ConnectorHealth` derivation service | Internal | Computes `ConnectorHealthStatus` from `ingestion_runs` + credential status | In-process |
| Azure Service Bus | Outbound (system → Service Bus) | Publishes `ConnectorIngestionAlertEvent` messages | AMQP / Service Bus SDK |
| `platform_credentials` store | Internal | Credential status input to health derivation | Database |
| `POST /v1/connectors/:id/retry`, `/v1/connectors/:id/users/:userId/retry` | Inbound (UI → backend) | Force retry / re-sync API | HTTPS REST / JSON |
| `social-listening-admin` connectors/status UI + `/api/connectors/[id]/retry` proxy | Internal (upstream consumer) | Renders badges, banner, and re-sync action | Internal API / React components |

---

## 10. Non-Functional Considerations

- **Performance:** Partial index (`idx_ingestion_runs_stale_watchdog`) keeps watchdog sweeps O(1) regardless of table growth; reconciliation runs as an initial, quick step that does not block the scheduler tick from completing.
- **Security / access control:** Force-retry endpoints enforce `requireTenantAdmin` or exact Tier-3 `userId` match with strict tenant-isolation validation (RLS-backed).
- **Reliability / availability:** Lock-safe `SKIP LOCKED` semantics guarantee no race between the watchdog and legitimately-completing runs; alert emission is best-effort and does not block or roll back the underlying state change.
- **Scalability:** Alert throttling (one `run_timed_out` per target per sweep) prevents event storms during mass reconciliation after an outage affecting many tenants/connectors simultaneously.
- **Audit and logging:** Every reconciliation, health transition, and manual retry remains reflected in `ingestion_runs` and health history — no state change is silent or untracked.
- **Accessibility:** UI banners are keyboard-focusable and use an `aria-live` region (NFR-005 in BRD-0070); dismissible per session.
- **Maintainability:** Health-derivation precedence is deterministic and covered by unit/contract tests asserting the full ordering.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Orphaned `running` run older than threshold | No direct user message (self-healing); status screen reflects updated health on next load | Watchdog reconciles to `failed`, `retryable=true`; scheduler resumes polling next tick |
| Run inside the threshold, still legitimately running | None | Left untouched by the watchdog |
| Connector stalled (no attempt/success within thresholds) | `Stalled / No Ingestion` badge; global banner if active | Health derivation returns `stalled`; `ingestion_stalled` alert emitted on transition |
| Connector failing (consecutive/rate-based failure threshold breached) | `Failing / Suspended` badge; global banner | Health derivation returns `failing`; `connector_failing` alert emitted on transition |
| Credential expired/revoked | `Reconnect Required` badge; global banner with "Reconnect account" action | Health derivation returns `reconnect_required`; alert emitted on transition |
| Force retry requested while a run <60s old is still running | "Run already in progress" (409, non-error styling) | Request rejected without triggering a duplicate poll |
| Force retry requested by unauthorized caller | Action not visible / access denied | Request rejected before any reconciliation or poll is attempted |
| Service Bus publish failure during alert emission | None (silent to end user) | Logged; does not block or roll back the reconciliation/health-derivation operation |

---

## 12. Assumptions and Dependencies

- The live polling scheduler (`pollScheduler.ts`) and `ingestion_runs` audit anchor from ADR-0005/ADR-0052 already exist.
- Azure Service Bus event publishing from ADR-0058/Story 5.19 is already in place.
- `ConnectorHealth` is derived, not stored, per ADR-0009.
- Health derivation already consumes `lastAttemptAt`, `lastSuccessfulFetchAt`, consecutive-failure counters, and credential status.
- Depends on: ADR-0005 (`IngestionRun` audit anchor), ADR-0009 (derived `ConnectorHealth`), ADR-0010 (error handling/auto-disable), ADR-0023 (proportional failure threshold/circuit breaker), ADR-0052 (live scheduler/in-flight guard), ADR-0058 (ingestion events), ADR-0061 (Tier-3 scheduler).
- Story 1.16 depends on Story 1.13 (live polling scheduler), Story 1.14 (in-flight run guard), Story 1.15 (Tier-3 per-user scheduler), Story 5.19 (Service Bus event publishing).
- Story 6.29 depends on Story 1.16 (backend watchdog/retry API), Story 6.5 (connector status view), Story 6.24 (connectors & AI providers grouping).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `run_timed_out`/`ingestion_stalled`/`connector_failing` events eventually feed a real downstream notification channel (email/Slack/PagerDuty), given they are currently produced but not consumed by any delivery mechanism? | Product Owner | Future notification-delivery initiative (explicitly out of scope here) |
| Q2 | Should Platform-Admin dashboards eventually aggregate stalled/failing connectors across tenants, given this FDD explicitly excludes multi-tenant alert aggregation? | Product Owner | Future Platform-Admin epic consideration |

---

## 14. Appendix

### Glossary

See BRD-0070 §15 for the full glossary (`ingestion_runs`, `ConnectorHealthStatus`, `stalled`, `effectiveCadenceMs`, `ConnectorIngestionAlertEvent`, `reconcileStaleIngestionRuns`, `force retry / re-sync`).

### Reference links

- [ADR-0070: Connector Ingestion Health Status, Hanging Run Reconciliation, and Inactivity Alerting](../../adr/0070-connector-ingestion-status-hanging-run-reconciliation-and-alerts.md)
- [BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md](../Business-Requirements/BRD-0070-Connector-Ingestion-Status-Hanging-Run-Reconciliation-And-Alerts.md)
- [docs/user-stories/epic-1-repository-and-api-foundation.md](../../user-stories/epic-1-repository-and-api-foundation.md) — Story 1.16
- [docs/user-stories/epic-6-tenant-admin-ui.md](../../user-stories/epic-6-tenant-admin-ui.md) — Story 6.29
- [docs/user-stories/README.md](../../user-stories/README.md) — Epic index
- [docs/product-research/feature-designs/01-multi-source-ingestion.md](../../product-research/feature-designs/01-multi-source-ingestion.md) — general ingestion-reliability context (per BRD-0070 Appendix, used only for competitive/background framing, not a dedicated source)
- Related ADRs: ADR-0005 (`IngestionRun` audit anchor), ADR-0009 (derived health), ADR-0010 (error handling/auto-disable), ADR-0023 (circuit breaker), ADR-0052 (live scheduler/in-flight guard), ADR-0058 (ingestion events), ADR-0061 (Tier-3 scheduler)

### Feature-design / research cross-reference

No dedicated `docs/product-research/reports/` deep-research brief exists specifically for the stalled-reconciliation/alerting feature (confirmed by BRD-0070's own appendix note). `docs/product-research/feature-designs/01-multi-source-ingestion.md` provides only general multi-source ingestion background, not feature-specific research, and is cited here for completeness rather than as a substantive source.

### Diagrams

None supplied; see Section 6.3 for the textual watchdog-reconciliation, manual-retry, and banner-resolution workflow steps.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (regenerated) | Regenerated from ADR-0070 and BRD-0070 to replace a defective batch-generated FDD (wrong H1 and flat BR-table-only Section 5) with a genuine per-capability functional design. |
