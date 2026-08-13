import { createHash } from 'crypto';
import { listTenants } from '../tenants/tenantStore';
import { listSocialConnectors } from '../connectors/registry';
import { shouldAttemptIngestion, deriveConnectorHealth } from '../connectors/connectorHealth';
import { SocialConnector } from '../connectors/types';

/** Implementation default (ADR-0052 §9) — a real guess, revisable via Amendment Log. */
export const DEFAULT_TICK_INTERVAL_MS = 60 * 1000;

/** Implementation default (ADR-0052 §5) — a real, named, revisable ±5% bound. */
const JITTER_BOUND = 0.05;

/**
 * Deterministic, per-(tenantId, platformId) offset in [-0.05, +0.05)
 * (ADR-0052 Decision §5) — never Math.random(), never recomputed per tick.
 * Spreads simultaneous-due pairs apart across tenants/restarts without ever
 * changing *whether* a pair is due, only *when it first becomes* due (see
 * ADR-0052 Decision §5's own monotonicity argument). A cryptographic hash is
 * used only for its even bit distribution, not for any security property.
 */
export function jitterFraction(tenantId: string, platformId: string): number {
  const digest = createHash('sha256').update(`${tenantId}:${platformId}`).digest();
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
  shouldAttemptIngestion: (tenantId: string, platformId: string) => Promise<boolean>;
  deriveConnectorHealth: (tenantId: string, platformId: string) => Promise<{ lastAttemptAt: string | null }>;
  now: () => number;
  onPollError: (err: unknown, tenantId: string, platformId: string) => void;
}

const defaultDeps: SchedulerDeps = {
  listTenants: async () => (await listTenants()).map((tenant) => ({ id: tenant.id })),
  listPollConnectors: () => listSocialConnectors().filter((connector) => connector.deliveryMode === 'poll'),
  shouldAttemptIngestion: (tenantId, platformId) => shouldAttemptIngestion(tenantId, platformId),
  deriveConnectorHealth: (tenantId, platformId) => deriveConnectorHealth(tenantId, platformId),
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
 */
export async function runSchedulerTick(overrides: Partial<SchedulerDeps> = {}): Promise<SchedulerPairOutcome[]> {
  const deps: SchedulerDeps = { ...defaultDeps, ...overrides };
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
              await connector.poll(tenant.id);
              polled = true;
            }
          }
        }
      } catch (err) {
        deps.onPollError(err, tenant.id, platformId);
      }
      outcomes.push({ tenantId: tenant.id, platformId, polled });
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
