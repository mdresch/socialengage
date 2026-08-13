// Contract: Story 1.13 (ADR-0052) — live ingestion-polling scheduler:
// registry bootstrap, generic per-connector poll(), derived-cadence loop.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-113
// and docs/adr/0052-live-ingestion-polling-scheduler.md
//
// Intent: close the real, live gap ADR-0052 found — a verified,
// credentialed, activated connector still ingests nothing, because nothing
// in the running server ever calls a connector's own poll function or
// populates the shared connector registry outside test setup. This story
// adds: (1) bootstrapConnectors() (src/connectors/bootstrapConnectors.ts),
// the one real production call site for registerSocialConnector()/
// registerAIProviderConnector(); (2) two new optional SocialConnector
// members, poll()/pollCadenceMs (src/connectors/types.ts), with GNews/
// Newswire/tenant-owned-feed each gaining a thin wrapper delegating
// unchanged to their existing pollX() function; (3) an in-process interval
// loop (src/scheduler/pollScheduler.ts) that enumerates
// listTenants() x listSocialConnectors().filter(deliveryMode==='poll'),
// gates each pair on shouldAttemptIngestion() and a derived, jittered
// cadence check against ingestion_runs' own history, and is started only
// from server.ts's main(), gated by SCHEDULER_ENABLED.
//
// Scope: src/connectors/bootstrapConnectors.ts (new), src/connectors/types.ts
// (extended), src/scheduler/pollScheduler.ts (new), src/http/server.ts
// (wires both, gated), contracts/epic-2/story-2.10... (CORE_FILES extended
// to include pollScheduler.ts, per that file's own documented convention).
//
// Contract to encode: AC1 bootstrap registers every real connector exactly
// once, previously []; AC2 each real poll connector's registered poll()
// wrapper + pollCadenceMs delegate unchanged to its existing pollX(); AC3
// no hardcoded providerId switch in the scheduler module (proven via the
// ADR-0048 CI guardrail's own CORE_FILES mechanism); AC4 one tick considers
// every (tenant, poll-connector) pair exactly once; AC5 a pair is polled
// only when eligible (health+activation) AND its derived, jittered cadence
// has elapsed, with deterministic per-pair jitter and full failure
// isolation (a ClassifiableError is recorded identically to a direct call;
// a raw exception never halts other pairs); AC6 only ownerType: 'tenant'
// pairs are ever considered; AC8 SCHEDULER_ENABLED gates the loop and
// createApp() alone never starts it.
//
// Explicitly out of scope (ADR-0052 Decision §6/§7, not tested): Tier-3
// (user-bound) poll scheduling — no real connector exists yet; multi-
// instance distributed locking — single-instance is this story's only
// supported shape, nothing to assert the absence of.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { deriveConnectorHealth } from '../../src/connectors/connectorHealth';
import { getSocialConnector, listSocialConnectors, __resetRegistryForTests } from '../../src/connectors/registry';
import { GNEWS_PROVIDER_ID } from '../../src/connectors/gnews/gnewsConnector';
import { pollGNewsSearch } from '../../src/connectors/gnews/pollGNewsSearch';
import { NEWSWIRE_PROVIDER_ID } from '../../src/connectors/newswire/newswireConnector';
import { pollNewswireFeeds } from '../../src/connectors/newswire/pollNewswireFeeds';
import { TENANT_OWNED_FEED_PROVIDER_ID } from '../../src/connectors/tenantOwnedFeed/tenantOwnedFeedConnector';
import { pollTenantOwnedFeed } from '../../src/connectors/tenantOwnedFeed/pollTenantOwnedFeed';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import { SocialConnector } from '../../src/connectors/types';
import {
  runSchedulerTick,
  jitterFraction,
  isSchedulerEnabled,
  SchedulerDeps,
} from '../../src/scheduler/pollScheduler';

jest.setTimeout(90000);

const CORE_ROOT = path.join(__dirname, '../..');

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

beforeEach(() => {
  __resetRegistryForTests();
});

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

/** A minimal, valid SocialConnector fixture — deliberately not a real platform. */
function fixtureConnector(providerId: string, overrides: Partial<SocialConnector> = {}): SocialConnector {
  return {
    providerId,
    authMode: 'none',
    deliveryMode: 'poll',
    normalize: (raw) => ({ externalId: 'x', authorExternalId: 'a', publishedAt: new Date().toISOString(), rawPayload: raw }),
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 60 }),
    ...overrides,
  };
}

function baseDeps(overrides: Partial<SchedulerDeps> = {}): Partial<SchedulerDeps> {
  return {
    onPollError: () => undefined,
    ...overrides,
  };
}

describe('Story 1.13 — live ingestion-polling scheduler', () => {
  describe('AC1 (ADR-0052 §3): bootstrapConnectors() registers every real connector exactly once', () => {
    it('listSocialConnectors() is empty before bootstrap, and contains every real poll connector after', () => {
      expect(listSocialConnectors()).toHaveLength(0);

      bootstrapConnectors();

      const registered = listSocialConnectors();
      const providerIds = registered.map((c) => c.providerId).sort();
      expect(providerIds).toEqual([GNEWS_PROVIDER_ID, NEWSWIRE_PROVIDER_ID, TENANT_OWNED_FEED_PROVIDER_ID].sort());
      for (const connector of registered) {
        expect(connector.deliveryMode).toBe('poll');
        expect(typeof connector.poll).toBe('function');
        expect(typeof connector.pollCadenceMs).toBe('number');
      }
    });
  });

  describe('AC2 (ADR-0052 §4): each real poll connector\'s registered poll() delegates unchanged, with the right cadence', () => {
    it('GNews: wrapper poll() produces the same outcome class as calling pollGNewsSearch() directly (missing-credential fast path, no network)', async () => {
      bootstrapConnectors();
      const tenantDirect = await makeTenant();
      const tenantWrapped = await makeTenant();

      const direct = await pollGNewsSearch(tenantDirect);
      const wrapped = await getSocialConnector(GNEWS_PROVIDER_ID)!.poll!(tenantWrapped);

      expect(direct.status).toBe('failed');
      expect(wrapped.status).toBe('failed');
      expect(direct.errorSummary).toContain('No GNews credential registered for tenant');
      expect(wrapped.errorSummary).toContain('No GNews credential registered for tenant');
      expect(getSocialConnector(GNEWS_PROVIDER_ID)!.pollCadenceMs).toBe(15 * 60 * 1000);
    });

    it('Tenant-owned feed: wrapper poll() produces the same outcome as calling pollTenantOwnedFeed() directly (zero verified activations, DB-only)', async () => {
      bootstrapConnectors();
      const tenantDirect = await makeTenant();
      const tenantWrapped = await makeTenant();

      const direct = await pollTenantOwnedFeed(tenantDirect);
      const wrapped = await getSocialConnector(TENANT_OWNED_FEED_PROVIDER_ID)!.poll!(tenantWrapped);

      expect(direct.status).toBe('succeeded');
      expect(wrapped.status).toBe('succeeded');
      expect(getSocialConnector(TENANT_OWNED_FEED_PROVIDER_ID)!.pollCadenceMs).toBe(30 * 60 * 1000);
    });

    it('Newswire: wrapper poll() produces the same outcome as calling pollNewswireFeeds() directly (real feed fetch, mirrors story-2.6\'s own contract)', async () => {
      bootstrapConnectors();
      const tenantDirect = await makeTenant();
      const tenantWrapped = await makeTenant();

      const direct = await pollNewswireFeeds(tenantDirect);
      const wrapped = await getSocialConnector(NEWSWIRE_PROVIDER_ID)!.poll!(tenantWrapped);

      expect(wrapped.status).toBe(direct.status);
      expect(getSocialConnector(NEWSWIRE_PROVIDER_ID)!.pollCadenceMs).toBe(15 * 60 * 1000);
    });
  });

  describe('AC3 (ADR-0052 §4): the scheduler never hardcodes a per-providerId switch', () => {
    it('src/scheduler/pollScheduler.ts contains no real connector\'s own providerId literal', () => {
      const source = fs.readFileSync(path.join(CORE_ROOT, 'src/scheduler/pollScheduler.ts'), 'utf8');
      for (const providerId of [GNEWS_PROVIDER_ID, NEWSWIRE_PROVIDER_ID, TENANT_OWNED_FEED_PROVIDER_ID]) {
        const escaped = providerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(new RegExp(`['"]${escaped}['"]`).test(source)).toBe(false);
      }
    });
  });

  describe('AC4 (ADR-0052 §1/§2): one tick considers every (tenant, poll-connector) pair exactly once', () => {
    it('a fixture of 2 tenants x 2 connectors, all eligible and due, produces exactly 4 outcomes, each polled once', async () => {
      const tenantA = { id: `tenant-a-${randomUUID()}` };
      const tenantB = { id: `tenant-b-${randomUUID()}` };
      const pollX = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const pollY = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connectorX = fixtureConnector('fixture-x', { poll: pollX, pollCadenceMs: 1000 });
      const connectorY = fixtureConnector('fixture-y', { poll: pollY, pollCadenceMs: 1000 });

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenantA, tenantB],
          listPollConnectors: () => [connectorX, connectorY],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          now: () => Date.now(),
        })
      );

      expect(outcomes).toHaveLength(4);
      expect(outcomes.every((o) => o.polled)).toBe(true);
      expect(pollX).toHaveBeenCalledTimes(2);
      expect(pollX).toHaveBeenCalledWith(tenantA.id);
      expect(pollX).toHaveBeenCalledWith(tenantB.id);
      expect(pollY).toHaveBeenCalledTimes(2);
    });
  });

  describe('AC5 (ADR-0052 §5/§8): eligibility, cadence, jitter, and failure isolation', () => {
    it('an inactive/failing connector is never polled regardless of elapsed time', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector('fixture-inactive', { poll, pollCadenceMs: 1000 });

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => false,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          now: () => Date.now(),
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(poll).not.toHaveBeenCalled();
    });

    it('a pair still under its jittered cadence is not polled', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const cadenceMs = 1_000_000;
      const connector = fixtureConnector('fixture-cadence', { poll, pollCadenceMs: cadenceMs });
      const now = Date.now();
      const lastAttemptAt = new Date(now - 1000).toISOString(); // barely elapsed

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          now: () => now,
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(poll).not.toHaveBeenCalled();
    });

    it('jitterFraction() is deterministic per pair, within [-0.05, 0.05), and differs across pairs', () => {
      const a1 = jitterFraction('tenant-1', 'platform-1');
      const a2 = jitterFraction('tenant-1', 'platform-1');
      const b = jitterFraction('tenant-2', 'platform-1');

      expect(a1).toBe(a2); // deterministic/repeatable
      expect(a1).toBeGreaterThanOrEqual(-0.05);
      expect(a1).toBeLessThan(0.05);
      expect(a1).not.toBe(b); // spreads distinct pairs apart
    });

    it('two pairs with identical cadence and identical last_started_at become due at different, jitter-derived times', async () => {
      const tenantA = { id: `tenant-jitter-a-${randomUUID()}` };
      const tenantB = { id: `tenant-jitter-b-${randomUUID()}` };
      const platformId = 'fixture-jitter';
      const cadenceMs = 1_000_000;
      const lastStartedAtMs = Date.now() - 10_000_000; // long enough ago that jitter is the only variable
      const lastAttemptAt = new Date(lastStartedAtMs).toISOString();

      const jitterA = jitterFraction(tenantA.id, platformId);
      const jitterB = jitterFraction(tenantB.id, platformId);
      const thresholdA = cadenceMs * (1 + jitterA);
      const thresholdB = cadenceMs * (1 + jitterB);
      expect(thresholdA).not.toBe(thresholdB);

      const midpointElapsed = (thresholdA + thresholdB) / 2;
      const now = lastStartedAtMs + midpointElapsed;

      const pollA = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const pollB = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connectorA = fixtureConnector(platformId, { poll: pollA, pollCadenceMs: cadenceMs });
      const connectorB = fixtureConnector(platformId, { poll: pollB, pollCadenceMs: cadenceMs });

      const [outcomeA] = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenantA],
          listPollConnectors: () => [connectorA],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          now: () => now,
        })
      );
      const [outcomeB] = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenantB],
          listPollConnectors: () => [connectorB],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          now: () => now,
        })
      );

      // At the midpoint between the two thresholds, exactly one pair is due.
      expect(outcomeA.polled).not.toBe(outcomeB.polled);
    });

    it('a scheduler-triggered ClassifiableError poll failure updates ConnectorHealth identically to a directly-invoked one', async () => {
      const tenantDirect = await makeTenant();
      const tenantScheduled = await makeTenant();

      await pollGNewsSearch(tenantDirect); // missing credential -> ClassifiableError('http_401'), recorded by runIngestionAttempt()

      const connector = fixtureConnector(GNEWS_PROVIDER_ID, {
        poll: (tenantId) => pollGNewsSearch(tenantId),
        pollCadenceMs: 1000,
      });
      await runSchedulerTick(
        baseDeps({
          listTenants: async () => [{ id: tenantScheduled }],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          now: () => Date.now(),
        })
      );

      const directHealth = await deriveConnectorHealth(tenantDirect, GNEWS_PROVIDER_ID);
      const scheduledHealth = await deriveConnectorHealth(tenantScheduled, GNEWS_PROVIDER_ID);

      expect(scheduledHealth.status).toBe(directHealth.status);
      expect(scheduledHealth.consecutiveFailures).toBe(directHealth.consecutiveFailures);
      expect(scheduledHealth.consecutiveFailures).toBe(1);
    });

    it('one pair throwing a raw (non-ClassifiableError) exception does not prevent another eligible pair from being polled in the same tick', async () => {
      const tenantBroken = { id: `tenant-broken-${randomUUID()}` };
      const tenantHealthy = { id: `tenant-healthy-${randomUUID()}` };
      const brokenPoll = jest.fn().mockRejectedValue(new Error('a genuine programming error'));
      const healthyPoll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const brokenConnector = fixtureConnector('fixture-broken', { poll: brokenPoll, pollCadenceMs: 1000 });
      const healthyConnector = fixtureConnector('fixture-healthy', { poll: healthyPoll, pollCadenceMs: 1000 });
      const onPollError = jest.fn();

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenantBroken, tenantHealthy],
          listPollConnectors: () => [brokenConnector, healthyConnector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          now: () => Date.now(),
          onPollError,
        })
      );

      expect(healthyPoll).toHaveBeenCalledTimes(2); // both tenants x the healthy connector
      expect(brokenPoll).toHaveBeenCalledTimes(2); // both tenants x the broken connector — attempted, not skipped
      expect(onPollError).toHaveBeenCalledTimes(2);
      const brokenOutcomes = outcomes.filter((o) => o.platformId === 'fixture-broken');
      expect(brokenOutcomes.every((o) => o.polled === false)).toBe(true);
      const healthyOutcomes = outcomes.filter((o) => o.platformId === 'fixture-healthy');
      expect(healthyOutcomes.every((o) => o.polled === true)).toBe(true);
    });
  });

  describe('AC6 (ADR-0052 §6): only ownerType: \'tenant\' pairs are ever considered', () => {
    it('a user-scoped activation with no matching tenant-scoped activation is never polled', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const platformId = `fixture-user-scope-${randomUUID()}`;
      await setConnectorActivation(tenantId, platformId, 'user', true, userId, userId);

      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector(platformId, { poll, pollCadenceMs: 1000 });

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [{ id: tenantId }],
          listPollConnectors: () => [connector],
          now: () => Date.now(),
          // shouldAttemptIngestion/deriveConnectorHealth left as real defaults —
          // this proves the real default (ownerType: 'tenant') genuinely
          // ignores the user-scoped row above, not a stubbed assumption.
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(poll).not.toHaveBeenCalled();
    });
  });

  describe('AC8 (ADR-0052 §9): SCHEDULER_ENABLED gating and test isolation', () => {
    it('createApp() never references the scheduler or bootstrap modules — constructing the app alone starts no background timer', () => {
      const appSource = fs.readFileSync(path.join(CORE_ROOT, 'src/http/app.ts'), 'utf8');
      expect(appSource).not.toMatch(/pollScheduler|bootstrapConnectors|startPollScheduler/);
    });

    it('server.ts wires bootstrapConnectors() and the gated scheduler start, only inside main()', () => {
      const serverSource = fs.readFileSync(path.join(CORE_ROOT, 'src/http/server.ts'), 'utf8');
      expect(serverSource).toContain('bootstrapConnectors');
      expect(serverSource).toContain('startPollScheduler');
      expect(serverSource).toContain('isSchedulerEnabled');
    });

    it('isSchedulerEnabled() defaults off under NODE_ENV=test, on otherwise, and honors an explicit override', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalFlag = process.env.SCHEDULER_ENABLED;
      try {
        process.env.NODE_ENV = 'test';
        delete process.env.SCHEDULER_ENABLED;
        expect(isSchedulerEnabled()).toBe(false);

        process.env.SCHEDULER_ENABLED = 'true';
        expect(isSchedulerEnabled()).toBe(true);

        delete process.env.SCHEDULER_ENABLED;
        process.env.NODE_ENV = 'production';
        expect(isSchedulerEnabled()).toBe(true);

        process.env.SCHEDULER_ENABLED = 'false';
        expect(isSchedulerEnabled()).toBe(false);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalFlag === undefined) delete process.env.SCHEDULER_ENABLED;
        else process.env.SCHEDULER_ENABLED = originalFlag;
      }
    });
  });
});
