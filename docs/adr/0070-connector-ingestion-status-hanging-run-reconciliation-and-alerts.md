# ADR-0070: Connector Ingestion Health Status, Hanging Run Watchdog Reconciliation, and Inactivity Alerting

**Status:** Accepted (2026-08-20)

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

### 1. Lock-Safe Automated Watchdog Run Reconciliation (`reconcileStaleIngestionRuns`)

A watchdog reconciliation function is introduced into `social-listening-core/src/ingestion/ingestionRunStore.ts` and executed automatically at the start of each scheduler tick in `pollScheduler.ts`:

1. **Stale Run Timeout Threshold (`MAX_RUN_DURATION_MS`):**
   - A running run is defined as stale if:
     `status = 'running' AND started_at < (NOW() - MAX_RUN_DURATION_MS)`
   - Timeout formula: `MAX_RUN_DURATION_MS = max(15 minutes, 2 * effectiveCadenceMs)` using the connector's effective poll cadence for that context (Tier-3 user-level cadence or Tier-2 platform/tenant cadence; default fallback: 15 minutes).
2. **Lock-Safe Row-Level Atomic Reconciliation:**
   - To prevent race conditions with legitimately completing runners, the watchdog uses a row-locked, non-blocking update:
     ```sql
     UPDATE ingestion_runs
     SET status = 'failed',
         completed_at = NOW(),
         error_summary = 'Ingestion run timed out or aborted (reconciled by watchdog)',
         retryable = true
     WHERE id IN (
       SELECT id FROM ingestion_runs
       WHERE status = 'running'
         AND started_at < NOW() - INTERVAL '15 minutes'
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, tenant_id, platform_id, user_id, started_at;
     ```
   - If a concurrent worker finishes and sets `completed_at` right as the sweep runs, `FOR UPDATE SKIP LOCKED` safely ignores it.
3. **Index Prerequisite:**
   - A database migration adds a partial index:
     ```sql
     CREATE INDEX idx_ingestion_runs_stale_watchdog ON ingestion_runs(status, started_at) WHERE status = 'running';
     ```
     ensuring O(1) watchdog sweeps regardless of total historical table size.
4. **Recovery & Scheduler Unblocking:**
   - Marking the run as `failed` (with `retryable = true`) immediately unlocks the Story 1.14/1.15 in-flight guard, allowing the scheduler to evaluate the connector on the next tick while preserving an honest audit trail in `ingestion_runs`.

### 2. Extend Derived Connector Health with `'stalled'` & Explicit Precedence

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

#### Strict Derivation Precedence Order:
When deriving `deriveConnectorHealth(tenantId, platformId, pageId?, userId?)`:

1. **`disconnected`:** If zero runs exist in history, return `'disconnected'`.
2. **`reconnect_required`:** If the latest run failed with `is_credential_failure = true` OR `credentialStatus` is `'expired' | 'revoked'`, return `'reconnect_required'`.
3. **`failing`:** If consecutive non-retryable failures reach `CONSECUTIVE_FAILURE_CEILING = 20` OR the failure rate in the trailing hour reaches `RATE_FAILURE_THRESHOLD = 0.5` (across `RATE_ATTEMPT_FLOOR = 5` attempts, ADR-0023), return `'failing'`.
4. **`stalled`:** If active (`isConnectorActive === true`) with valid credentials (`credentialStatus === 'valid'`), not in 1–3, and either:
   - `now - lastAttemptAt >= 3 * effectiveCadenceMs` (minimum 45 minutes); **OR**
   - `now - lastSuccessfulFetchAt >= MAX_INGESTION_SILENCE_MS` (default: 24 hours),
   return `'stalled'`.
5. **`degraded`:** If recent failures occurred within the trailing 1 hour but a success also occurred, return `'degraded'`.
6. **`healthy`:** Otherwise, return `'healthy'`.

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
2. **Emission Semantics:**
   - **`run_timed_out` (Warning):** Emitted for each reconciled run row returned by the lock-safe watchdog sweep (`metadata.staleRunId` populated). Batched / throttled to at most once per `(tenantId, platformId[, userId])` per sweep window to avoid alert storms.
   - **`ingestion_stalled` (Warning):** Emitted when derived health transitions into `'stalled'`.
   - **`connector_failing` / `reconnect_required` (Critical):** Emitted when derived health transitions into auto-disable or credential revocation states.

### 4. Admin UI Ingestion Status & Actionable Alerts

In `social-listening-admin`:

1. **Connector Status View (`/tenant/connectors`):**
   - The status badge renders explicit states:
     - `Healthy` (Green)
     - `Degraded` (Amber)
     - `Stalled / No Ingestion` (Amber-Red)
     - `Failing / Suspended` (Red)
     - `Reconnect Required` (Red)
     - `Disconnected` (Gray)
   - Displays real operational timestamps:
     - **Last Polling Attempt:** Relative time (e.g. "5 minutes ago") from `lastAttemptAt`.
     - **Last Successful Ingestion:** Relative time (e.g. "12 minutes ago") from `lastSuccessfulFetchAt` (the timestamp of the most recent completed run where posts were acquired/processed).
     - **Poll Cadence:** e.g. "Interval: 15m".
2. **Idempotent "Force Retry / Re-sync" Endpoint:**
   - `POST /v1/connectors/:id/retry` and `/v1/connectors/:id/users/:userId/retry`
   - **Authorization:** Gated by `requireTenantAdmin` (or for Tier-3, the authenticated user themselves matching `:userId`), with strict tenant-isolation validation.
   - **Semantics:** Reconciles any stale runs for that target, resets circuit-breaker transient failure counters (`consecutiveFailures = 0`, cooldown cleared), and triggers an immediate on-demand `connector.poll(tenantId)` / `pollUser(tenantId, userId)`.
   - **Idempotency:** If a legitimate run is currently running and started within the last 60 seconds, returns HTTP 409 (`"Run already in progress"`) safely without failing abruptly.
3. **Global Ingestion Alert Banner:**
   - When any active connector is in `stalled`, `failing`, or `reconnect_required` state, a top-level alert banner is rendered on `/tenant/analytics` (Overview tab) and `/tenant/connectors`:
     > ⚠️ **Ingestion Alert:** 1 connector (Facebook) has stalled. No posts have been ingested for > 24 hours. [View Connectors & Re-sync]

---

## Consequences

### Positive
- **Zero Ingestion Deadlocks:** Hanging runs caused by server restarts or crashes are automatically healed within 15 minutes by the lock-safe watchdog sweep.
- **Race-Safe Execution:** `SKIP LOCKED` guarantees that legitimate long-running or finishing runs are not overwritten mid-transition.
- **Unambiguous Health Precedence:** Explicit evaluation ordering ensures `failing` or `reconnect_required` are never masked by `stalled`.
- **Proactive Inactivity Visibility:** Operators and tenant admins immediately see when ingestion has stopped rather than discovering silent gaps days later.
- **Self-Healing & Actionable Manual Overrides:** The combination of automated watchdog reconciliation and manual "Force Retry" enables self-service recovery without direct database access.

### Negative / Trade-offs
- **Added Health State:** UI components and existing contracts asserting the `ConnectorHealthStatus` union must accommodate `'stalled'`.
- **Watchdog Query Overhead:** Solved with the partial index on `(status, started_at) WHERE status = 'running'`.

---

## Implementation Plan & User Stories

1. **Story 1.16 (`social-listening-core`):** Ingestion Run Watchdog Reconciliation, Stalled Health Derivation, and Service Bus Ingestion Alert Events.
2. **Story 6.29 (`social-listening-admin`):** Connector Ingestion Status Badges, Stalled Alerts Banner, and On-Demand Re-sync Action.

---

## Amendment Log

- **2026-08-20:** Proposed by Menno Drescher. Drafted to eliminate in-flight deadlocks from orphaned runs and introduce proactive ingestion alerting.
- **2026-08-20:** Accepted by Menno Drescher with critical clarifications: lock-safe `SKIP LOCKED` row-level watchdog updates, strict health derivation precedence, effective cadence calculations, partial index prerequisite, and idempotent retry endpoint authorization.
