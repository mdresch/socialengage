# ADR-0070: Connector Ingestion Health Status, Hanging Run Watchdog Reconciliation, and Inactivity Alerting

**Status:** Proposed (2026-08-20)

**Source:** Follow-up to ADR-0005 (`IngestionRun` as audit anchor), ADR-0009 (`ConnectorHealth` derived not stored), ADR-0010 (Error handling & auto-disable policy), ADR-0023 (Proportional failure threshold & circuit breaker), ADR-0052 (Live polling scheduler & in-flight guard §5b), ADR-0058 (Ingestion events & `ConnectorHealthChangedEvent`), and ADR-0061 (Tier-3 per-user scheduler).

---

## Context

### 1. The In-Flight Deadlock Vulnerability (Story 1.14 / 1.15 Gap)

Story 1.14 (ADR-0052 §5b) and Story 1.15 (ADR-0061 §2) introduced a vital concurrency guard in `pollScheduler.ts`:
```ts
const mostRecentStatus = await deps.getMostRecentRunStatus(tenant.id, platformId);
if (mostRecentStatus !== 'running') {
  await connector.poll(tenant.id);
}
```
This check protects against same-process poll overlaps when a connector poll takes longer than its scheduled cadence.

However, in production environments (e.g. Node.js process restart, container redeployment, uncaught exception, SIGTERM/SIGKILL, or unhandled socket hang), any `ingestion_runs` row that was in progress retains `status = 'running'` and `completed_at = NULL` in PostgreSQL indefinitely.

**Consequence:** Because `getMostRecentRunStatus()` perpetually returns `'running'`, the polling scheduler **permanently skips** all future ticks for that `(tenantId, platformId)` (and `userId` for Tier-3 connectors). Ingestion stops silently and permanently without any automatic recovery or explicit error notification.

### 2. Silent Ingestion Stalls & Inactivity

Even when runs are not orphaned in `'running'`, an active connector (`isActive: true`) may cease ingesting content due to:
1. **Upstream Silent Outages:** The upstream API or feed remains reachable (returning HTTP 200 with empty items or unchanged payload) while the upstream pipeline has stopped producing data.
2. **Circuit-Breaker Lockout:** Successive non-retryable failures put the connector in `failing` or `reconnect_required` status, and subsequent half-open probe cooldown attempts continue to fail silently in the background.
3. **Scheduler Starvation / Drift:** A connector fails to be polled within its expected `pollCadenceMs` interval (e.g. scheduler queue delays, unexpected lock contention, or misconfigured intervals).

Currently, `ConnectorHealthStatus` (`healthy | degraded | failing | disconnected | reconnect_required`) does not differentiate between an active connector that is ingesting on schedule and an active connector that has **stalled** (i.e. where elapsed time since `lastAttemptAt` or `lastSuccessfulFetchAt` has severely breached the expected cadence SLA).

### 3. Lack of Proactive Ingestion Alerts

When connector ingestion fails or stalls:
- Tenant users and administrators receive no proactive alerts or in-app notifications.
- The Admin UI (`/tenant/connectors`) displays metrics only when a user navigates to the screen, but provides no top-level alert banners, SLA indicators, or manual recovery triggers to reset stuck runs.

---

## Decision

### 1. Automated Watchdog Run Reconciliation (`reconcileStaleIngestionRuns`)

A watchdog reconciliation function is introduced into `social-listening-core/src/ingestion/ingestionRunStore.ts` and executed automatically at the start of each scheduler tick in `pollScheduler.ts`:

1. **Stale Run Timeout Threshold (`MAX_RUN_DURATION_MS`):**
   - A running run is defined as stale if:
     `status = 'running' AND started_at < (NOW() - MAX_RUN_DURATION_MS)`
   - Default `MAX_RUN_DURATION_MS`: **15 minutes** (or `2 * connector.pollCadenceMs`, whichever is larger).
2. **Atomic Reconciliation:**
   - The watchdog executes an atomic SQL update:
     ```sql
     UPDATE ingestion_runs
     SET status = 'failed',
         completed_at = NOW(),
         error_summary = 'Ingestion run timed out or aborted (reconciled by watchdog)',
         retryable = true
     WHERE status = 'running'
       AND started_at < NOW() - INTERVAL '15 minutes';
     ```
3. **Recovery:**
   - Marking the run as `failed` (with `retryable = true`) immediately unlocks the Story 1.14/1.15 in-flight guard, allowing the scheduler to evaluate the connector on the next tick while preserving an honest audit trail in `ingestion_runs`.

### 2. Extend Derived Connector Health with `'stalled'` Status

The `ConnectorHealthStatus` union in `connectorHealth.ts` is extended:
```ts
export type ConnectorHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'failing'
  | 'disconnected'
  | 'reconnect_required'
  | 'stalled';
```

#### Derivation Rules for `'stalled'`:
An active connector (`isConnectorActive === true` and `credentialStatus === 'valid'`) derives `status = 'stalled'` when:
1. `lastAttemptAt` is older than `STALL_CADENCE_MULTIPLIER * pollCadenceMs` (default multiplier: **3×**, minimum 45 minutes); **OR**
2. `lastSuccessfulFetchAt` is older than `MAX_INGESTION_SILENCE_MS` (default: **24 hours**) while `consecutiveFailures < 20` (not yet classified as `failing`); **AND**
3. The connector has at least one recorded run in history (otherwise it remains `'disconnected'`).

When a connector is `stalled`, it represents an actionable condition: the connector is configured and active, but no successful ingestion has taken place within the expected operational window.

### 3. Ingestion Alert Events on Service Bus

Building on ADR-0012 and ADR-0058, the core pipeline publishes structured alert events to Azure Service Bus when ingestion anomalies occur:

1. **`ConnectorIngestionAlertEvent` Topic / Message:**
   ```ts
   export interface ConnectorIngestionAlertEvent {
     tenantId: string;
     platformId: string;
     userId?: string;
     alertType: 'run_timed_out' | 'ingestion_stalled' | 'connector_failing' | 'reconnect_required';
     severity: 'warning' | 'critical';
     message: string;
     occurredAt: string;
     metadata: {
       consecutiveFailures?: number;
       lastAttemptAt?: string | null;
       lastSuccessfulFetchAt?: string | null;
       staleRunId?: string;
     };
   }
   ```
2. **Trigger Points:**
   - **`run_timed_out` (Warning):** Emitted when the watchdog reconciles a hanging `running` run.
   - **`ingestion_stalled` (Warning):** Emitted when derived health transitions to `stalled`.
   - **`connector_failing` / `reconnect_required` (Critical):** Emitted when connector enters auto-disable or credential revocation states.

### 4. Admin UI Ingestion Status & Actionable Alerts

In `social-listening-admin`:

1. **Connector Status View (`/tenant/connectors`):**
   - The status badge renders explicit states:
     - `Healthy` (Green)
     - `Degraded` (Amber)
     - `Stalled / Inactive Ingestion` (Amber-Red)
     - `Failing / Suspended` (Red)
     - `Reconnect Required` (Red)
     - `Disconnected` (Gray)
   - Displays real operational timestamps:
     - **Last Polled:** relative time (e.g. "5 minutes ago")
     - **Last Ingested Post:** relative time (e.g. "12 minutes ago")
     - **Next Estimated Poll:** derived from cadence + last attempt.
2. **Manual "Force Retry / Re-sync" Trigger:**
   - Adds a tenant-admin action `POST /v1/connectors/:id/retry` (and `/v1/connectors/:id/users/:userId/retry` for Tier-3) to allow immediate on-demand polling.
   - The endpoint invokes `reconcileStaleIngestionRuns()`, resets circuit-breaker transient failure counters if valid credentials exist, and immediately triggers `connector.poll(tenantId)`.
3. **Global Ingestion Alert Banner:**
   - When any active connector is in `stalled`, `failing`, or `reconnect_required` state, a top-level alert banner is rendered on `/tenant/analytics` and `/tenant/connectors`:
     > ⚠️ **Ingestion Alert:** 1 connector (Facebook) has stalled. No posts have been ingested for > 24 hours. [View Connectors & Re-sync]

---

## Consequences

### Positive
- **Zero Ingestion Deadlocks:** Hanging runs caused by server restarts or crashes are automatically healed within 15 minutes by the watchdog sweep.
- **Proactive Inactivity Visibility:** Operators and tenant admins immediately see when ingestion has stopped rather than discovering silent gaps days later.
- **Self-Healing & Actionable Manual Overrides:** The combination of automated watchdog reconciliation and manual "Force Retry" enables self-service recovery without direct database access.
- **Event-Driven Integration:** Downstream alerting mechanisms (email notifications, webhook alerts, PagerDuty/Slack integrations) can consume `ConnectorIngestionAlertEvent` from Service Bus.

### Negative / Trade-offs
- **Added Health State:** UI components and existing contracts asserting the `ConnectorHealthStatus` union must accommodate `'stalled'`.
- **Watchdog Query Overhead:** Each scheduler tick performs an indexed sweep for stale `running` runs. (Negligible overhead with an index on `(status, started_at)`).

---

## Implementation Plan & User Stories

1. **Story 1.16 (`social-listening-core`):** Ingestion Run Watchdog Reconciliation, Stalled Health Derivation, and Service Bus Ingestion Alert Events.
2. **Story 6.29 (`social-listening-admin`):** Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action.

---

## Amendment Log

- **2026-08-20:** Proposed by Menno Drescher. Drafted to eliminate in-flight deadlocks from orphaned runs and introduce proactive ingestion alerting.
