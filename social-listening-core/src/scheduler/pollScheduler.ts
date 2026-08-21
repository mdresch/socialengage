import { createHash } from 'crypto';
import { listTenants } from '../tenants/tenantStore';
import { listSocialConnectors } from '../connectors/registry';
import { shouldAttemptIngestion, deriveConnectorHealth } from '../connectors/connectorHealth';
import { listActiveUserActivations } from '../connectors/connectorActivationStore';
import {
  getMostRecentRunStatus,
  getMostRecentRunStatusForUser,
  reconcileStaleIngestionRuns,
  ReconciledStaleRun,
  IngestionRunStatus,
} from '../ingestion/ingestionRunStore';
import { SocialConnector } from '../connectors/types';
import { publishConnectorAlertEvent } from '../events/publishConnectorAlertEvents';

/** Implementation default (ADR-0052 §9) — a real guess, revisable via Amendment Log. */
export const DEFAULT_TICK_INTERVAL_MS = 60 * 1000;

/** Implementation default (ADR-0052 §5) — a real, named, revisable ±5% bound. */
const JITTER_BOUND = 0.05;

/**
 * Deterministic, per-(tenantId, platformId[, userId]) offset in
 * [-0.05, +0.05) (ADR-0052 Decision §5, extended by ADR-0061 Decision §5 for
 * the Tier-3 per-user case) — never Math.random(), never recomputed per
 * tick. Spreads simultaneous-due pairs apart across tenants/restarts
 * without ever changing *whether* a pair is due, only *when it first
 * becomes* due (see ADR-0052 Decision §5's own monotonicity argument). The
 * optional `userId` segment additionally spreads different users under the
 * same tenant/connector apart from each other, preventing a per-user
 * thundering herd. Omitting `userId` is byte-for-byte identical to the
 * original two-argument call (backward compatible). A cryptographic hash is
 * used only for its even bit distribution, not for any security property.
 */
export function jitterFraction(tenantId: string, platformId: string, userId?: string): number {
  const key = userId ? `${tenantId}:${platformId}:${userId}` : `${tenantId}:${platformId}`;
  const digest = createHash('sha256').update(key).digest();
  const bucket = digest.readUInt32BE(0) % 1000;
  return (bucket / 1000) * (2 * JITTER_BOUND) - JITTER_BOUND;
}

/**
 * Injectable seams (ADR-0052 Decision §2/§9) — production code (
 * startPollScheduler()) uses the real defaults untouched; a test overrides
 * whichever of these it needs to control (e.g. a fixture tenant/connector
 * list, a controlled `now`), never the real `listTenants()`/
 * `listSocialConnectors()` against the shared contract-test database. See
 * .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
 */
export interface SchedulerDeps {
  listTenants: () => Promise<Array<{ id: string }>>;
  listPollConnectors: () => SocialConnector[];
  shouldAttemptIngestion: (
    tenantId: string,
    platformId: string,
    ownerType?: 'tenant' | 'user',
    userId?: string
  ) => Promise<boolean>;
  deriveConnectorHealth: (
    tenantId: string,
    platformId: string,
    userId?: string
  ) => Promise<{ lastAttemptAt: string | null }>;
  /** Story 1.14 (ADR-0052 Decision §5b) — status of the pair's single most recent ingestion_runs row, or null if none exists. */
  getMostRecentRunStatus: (tenantId: string, platformId: string) => Promise<IngestionRunStatus | null>;
  /** Story 1.15 (ADR-0061 Decision §2) — every userId with a real, active connector_user_activations row for this (tenant, platform). */
  listActiveUserActivations: (tenantId: string, platformId: string) => Promise<string[]>;
  /** Story 1.15 (ADR-0061 Decision §2) — the Tier-3 in-flight guard, scoped to one user's own runs (Story 1.14's tenant-wide parity). */
  getMostRecentRunStatusForUser: (tenantId: string, platformId: string, userId: string) => Promise<IngestionRunStatus | null>;
  /** Story 1.16 (ADR-0070 §1) — Watchdog sweep of stale running runs before evaluating due pairs. */
  reconcileStaleRuns: (maxDurationMs?: number) => Promise<ReconciledStaleRun[]>;
  now: () => number;
  onPollError: (err: unknown, tenantId: string, platformId: string) => void;
}

const defaultDeps: SchedulerDeps = {
  listTenants: async () => (await listTenants()).map((tenant) => ({ id: tenant.id })),
  listPollConnectors: () => listSocialConnectors().filter((connector) => connector.deliveryMode === 'poll'),
  shouldAttemptIngestion: (tenantId, platformId, ownerType, userId) =>
    shouldAttemptIngestion(tenantId, platformId, ownerType, userId),
  deriveConnectorHealth: (tenantId, platformId, userId) => deriveConnectorHealth(tenantId, platformId, undefined, userId),
  getMostRecentRunStatus: (tenantId, platformId) => getMostRecentRunStatus(tenantId, platformId),
  listActiveUserActivations: (tenantId, platformId) => listActiveUserActivations(tenantId, platformId),
  getMostRecentRunStatusForUser: (tenantId, platformId, userId) =>
    getMostRecentRunStatusForUser(tenantId, platformId, userId),
  reconcileStaleRuns: () => reconcileStaleIngestionRuns(),
  now: () => Date.now(),
  onPollError: (err, tenantId, platformId) => {
    // eslint-disable-next-line no-console
    console.error(`[pollScheduler] poll failed for tenant=${tenantId} platform=${platformId}:`, err);
  },
};

export interface SchedulerPairOutcome {
  tenantId: string;
  platformId: string;
  polled: boolean;
  /** Story 1.15 — present only for a Tier-3 (per-user) outcome; absent for a tenant-wide one. */
  userId?: string;
}

/**
 * One scheduler tick: every (tenant, poll-mode connector) pair is
 * considered exactly once (ADR-0052 Decision §1/§2). A pair is polled only
 * if shouldAttemptIngestion() allows it and its derived cadence (§5) has
 * elapsed. Failure isolation (ADR-0052 Decision §8): any exception for one
 * pair — a raised ClassifiableError already recorded by
 * runIngestionAttempt() inside connector.poll() itself, or a genuine raw
 * exception — is caught here and never halts evaluation of any other pair
 * in the same tick.
 *
 * Story 1.15 (ADR-0061 Decision §4) adds a third, independent enumeration
 * level: for every connector exposing `pollUser`, every user with a real,
 * active `connector_user_activations` row for that (tenant, platform) is
 * separately considered on their own due check and health, isolated from
 * both the tenant-wide loop and every other user — see
 * .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
 */
export async function runSchedulerTick(overrides: Partial<SchedulerDeps> = {}): Promise<SchedulerPairOutcome[]> {
  const deps: SchedulerDeps = { ...defaultDeps, ...overrides };

  // Story 1.16 (ADR-0070 §1) — Watchdog stale run reconciliation:
  // sweeps orphaned 'running' rows before evaluating due connectors.
  try {
    const reconciled = await deps.reconcileStaleRuns();
    for (const run of reconciled) {
      await publishConnectorAlertEvent({
        tenantId: run.tenantId,
        platformId: run.platformId,
        userId: run.userId,
        alertType: 'run_timed_out',
        severity: 'warning',
        message: `Ingestion run timed out after exceeding max duration (reconciled by watchdog)`,
        metadata: { staleRunId: run.id, lastAttemptAt: run.startedAt },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[pollScheduler] watchdog reconciliation failed:', err);
  }

  const tenants = await deps.listTenants();
  const connectors = deps.listPollConnectors();
  const now = deps.now();
  const outcomes: SchedulerPairOutcome[] = [];

  for (const tenant of tenants) {
    for (const connector of connectors) {
      const platformId = connector.providerId;
      let polled = false;
      try {
        if (connector.poll && connector.pollCadenceMs !== undefined) {
          const eligible = await deps.shouldAttemptIngestion(tenant.id, platformId);
          if (eligible) {
            const health = await deps.deriveConnectorHealth(tenant.id, platformId);
            const lastStartedAt = health.lastAttemptAt ? new Date(health.lastAttemptAt).getTime() : -Infinity;
            const jitter = jitterFraction(tenant.id, platformId);
            const due = now - lastStartedAt >= connector.pollCadenceMs * (1 + jitter);
            if (due) {
              // Story 1.14 (ADR-0052 Decision §5b) — elapsed time alone
              // isn't enough: a pair whose most recent run hasn't finished
              // must not be re-polled, even once its cadence has elapsed.
              const mostRecentStatus = await deps.getMostRecentRunStatus(tenant.id, platformId);
              if (mostRecentStatus !== 'running') {
                await connector.poll(tenant.id);
                polled = true;
              }
            }
          }
        }
      } catch (err) {
        deps.onPollError(err, tenant.id, platformId);
      }
      outcomes.push({ tenantId: tenant.id, platformId, polled });

      // Story 1.15 (ADR-0061 Decision §4) — a third, independent enumeration
      // level: every user with a real, active connector_user_activations
      // row for this (tenant, platform) is considered on their own due
      // check, composing with (never duplicating) the tenant-wide loop
      // above. Only connectors with pollUser participate — a connector
      // with only `poll` (tenant-wide) is never looked up here at all.
      if (connector.pollUser && connector.pollCadenceMs !== undefined) {
        const userIds = await deps.listActiveUserActivations(tenant.id, platformId);
        for (const userId of userIds) {
          let userPolled = false;
          try {
            const eligible = await deps.shouldAttemptIngestion(tenant.id, platformId, 'user', userId);
            if (eligible) {
              const health = await deps.deriveConnectorHealth(tenant.id, platformId, userId);
              const lastStartedAt = health.lastAttemptAt ? new Date(health.lastAttemptAt).getTime() : -Infinity;
              const jitter = jitterFraction(tenant.id, platformId, userId);
              const due = now - lastStartedAt >= connector.pollCadenceMs * (1 + jitter);
              if (due) {
                // Story 1.14 parity, scoped per user (ADR-0061 Decision §2):
                // a user's own most recent run must have actually finished
                // before their next cadence-elapsed poll is allowed.
                const mostRecentStatus = await deps.getMostRecentRunStatusForUser(tenant.id, platformId, userId);
                if (mostRecentStatus !== 'running') {
                  await connector.pollUser(tenant.id, userId);
                  userPolled = true;
                }
              }
            }
          } catch (err) {
            // A raw exception for one user must never block another due
            // user, or the tenant-wide pair, in the same tick (ADR-0061
            // Decision §4, mirroring the tenant-wide isolation above).
            deps.onPollError(err, tenant.id, platformId);
          }
          outcomes.push({ tenantId: tenant.id, platformId, polled: userPolled, userId });
        }
      }
    }
  }

  return outcomes;
}

/**
 * ADR-0052 Decision §9 — on outside NODE_ENV === 'test', off inside it,
 * overridable either direction via an explicit SCHEDULER_ENABLED value. A
 * belt-and-suspenders safety net alongside the structural guarantee that
 * this scheduler is only ever started from server.ts's main(), never from
 * createApp() (the construction path every contract test already uses).
 */
export function isSchedulerEnabled(): boolean {
  const raw = process.env.SCHEDULER_ENABLED;
  if (raw === undefined) return process.env.NODE_ENV !== 'test';
  return raw === 'true' || raw === '1';
}

let activeInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the single in-process interval loop (ADR-0052 Decision §1). Must
 * only ever be called from server.ts's main() — see
 * .claude/skills/live-ingestion-polling-scheduler/SKILL.md's Load-bearing
 * constraints for why.
 */
export function startPollScheduler(intervalMs: number = DEFAULT_TICK_INTERVAL_MS): ReturnType<typeof setInterval> {
  activeInterval = setInterval(() => {
    runSchedulerTick().catch((err) => {
      // A tick-level failure here means runSchedulerTick() itself threw,
      // i.e. listTenants()/listSocialConnectors() failed — every per-pair
      // failure is already caught inside runSchedulerTick() and never
      // reaches here.
      // eslint-disable-next-line no-console
      console.error('[pollScheduler] scheduler tick failed unexpectedly:', err);
    });
  }, intervalMs);
  return activeInterval;
}

/** Test-only: stops a scheduler started by startPollScheduler() in this process. */
export function __stopPollSchedulerForTests(): void {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}
