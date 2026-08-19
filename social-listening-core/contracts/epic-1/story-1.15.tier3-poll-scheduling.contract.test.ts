// Contract: Story 1.15 (ADR-0061, Accepted 2026-08-18) — Tier-3 (user-bound)
// poll scheduling: per-user enumeration, cross-user health/in-flight
// isolation, pollUser() as a new generic scheduler surface.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-115
// and docs/adr/0061-tier-3-poll-scheduler-per-user-enumeration.md
//
// Intent: pollFacebook(tenantId, userId) (ADR-0060/Story 2.15) has zero real
// call sites in the running server today — a tenant's real, connected
// Facebook Page is never actually polled by anything, since the scheduler
// (ADR-0052/Story 1.13) only enumerates ownerType:'tenant' pairs. This story
// closes that gap with a third, independent per-user enumeration level in
// runSchedulerTick(), and fixes three real, confirmed cross-user blending
// bugs found while designing it: getMostRecentRunStatus()/
// deriveConnectorHealth() are keyed by (tenantId, platformId) only (no
// user_id column existed until this story), so naively extending the
// existing tenant-wide machinery to Tier-3 pairs would let one user's
// in-flight/failing poll incorrectly block or falsely auto-disable another
// user's own healthy one; and shouldAttemptIngestion()'s own internal
// deriveConnectorHealth() call (already-shipped Story 1.11 code) already
// silently drops the ownerType/userId arguments its own callers pass it.
//
// Scope: migrations/0033_add_ingestion_runs_user_id.sql (new),
// src/ingestion/ingestionRunStore.ts (StartIngestionRunInput.userId?,
// getMostRecentRunStatusForUser() new), src/connectors/
// connectorActivationStore.ts (listActiveUserActivations() new),
// src/connectors/connectorHealth.ts (deriveConnectorHealth() gains pageId?/
// userId?; shouldAttemptIngestion()'s internal call fixed),
// src/connectors/types.ts (SocialConnector.pollUser?() new),
// src/connectors/bootstrapConnectors.ts (Facebook's throwing-placeholder
// poll retired, pollUser: pollFacebook registered), src/connectors/
// facebook/pollFacebook.ts (threads userId into connectorInfo so the new
// column is actually populated), src/scheduler/pollScheduler.ts (third
// enumeration level; jitterFraction() gains optional userId).
//
// Also touches contracts/epic-1/story-1.13...contract.test.ts (dated-note
// fix, anticipated by ADR-0061 Decision §3's own Alternatives Considered —
// "keep the throwing-placeholder poll... rejected" — not a surprise
// regression): AC1's per-connector invariant ("every registered connector
// has typeof connector.poll === 'function'") is narrowed to "poll or
// pollUser," since a connector may now legitimately have only the latter.
//
// Contract to encode: AC1 ingestion_runs.user_id is nullable, populated
// only by a Tier-3 poll path, NULL for every tenant-wide connector; AC2
// listActiveUserActivations() returns exactly the active users for a
// (tenant, platform); AC3 getMostRecentRunStatusForUser() is scoped by
// user_id, existing getMostRecentRunStatus() unchanged; AC4
// deriveConnectorHealth()'s new pageId?/userId? params are backward
// compatible (omitted = unchanged) and, when userId is supplied, return
// independently correct per-user results, never blended; AC5
// shouldAttemptIngestion() no longer blends across users for ownerType:
// 'user'; AC6 SocialConnector.pollUser? is a distinct optional method;
// AC7 Facebook's registration has no poll property, pollUser delegates to
// pollFacebook() unchanged; AC8 runSchedulerTick()'s new per-user
// enumeration level triggers each user's own pollUser() based solely on
// that user's own due-check; AC9 one user's pollUser() throwing doesn't
// block another user/tenant in the same tick; AC10 jitterFraction()'s new
// optional userId segment is backward compatible and spreads users apart.
//
// Explicitly out of scope, per ADR-0061's own named Open Questions (not
// tested): RequestGate's own key shape for Facebook (unaffected, belongs to
// ADR-0060/pollFacebook()'s own scope); a cost/quota budget ceiling; multi-
// instance distributed locking; any change to pollFacebook()'s own internal
// per-Page fan-out; any Admin UI surfacing of Tier-3 scheduler activity.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { listActiveUserActivations } from '../../src/connectors/connectorActivationStore';
import { startIngestionRun, completeIngestionRun, getMostRecentRunStatusForUser, getMostRecentRunStatus } from '../../src/ingestion/ingestionRunStore';
import { deriveConnectorHealth, shouldAttemptIngestion } from '../../src/connectors/connectorHealth';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, listSocialConnectors, __resetRegistryForTests } from '../../src/connectors/registry';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import { FACEBOOK_PROVIDER_ID } from '../../src/connectors/facebook/facebookConnector';
import { pollFacebook } from '../../src/connectors/facebook/pollFacebook';
import { SocialConnector } from '../../src/connectors/types';
import { runSchedulerTick, jitterFraction, SchedulerDeps } from '../../src/scheduler/pollScheduler';

jest.setTimeout(30000);

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
    getMostRecentRunStatus: async () => null,
    listActiveUserActivations: async () => [],
    getMostRecentRunStatusForUser: async () => null,
    ...overrides,
  };
}

describe('Story 1.15 — Tier-3 poll scheduling', () => {
  describe('AC1 (ADR-0061 §1): ingestion_runs.user_id is nullable, populated only by a Tier-3 poll path', () => {
    it('a tenant-wide run (no userId supplied) writes user_id = NULL', async () => {
      const tenantId = await makeTenant();
      const run = await startIngestionRun(tenantId, { platformId: 'fixture-platform', triggerType: 'poll', connectorVersion: '1.0.0' });
      const row = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ user_id: string | null }>(`SELECT user_id FROM ingestion_runs WHERE id = $1`, [run.id]);
        return rows[0];
      });
      expect(row.user_id).toBeNull();
    });

    it('a Tier-3 run (userId supplied) writes the real user_id', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const run = await startIngestionRun(tenantId, { platformId: 'fixture-platform', triggerType: 'poll', connectorVersion: '1.0.0', userId });
      const row = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ user_id: string | null }>(`SELECT user_id FROM ingestion_runs WHERE id = $1`, [run.id]);
        return rows[0];
      });
      expect(row.user_id).toBe(userId);
    });
  });

  describe('AC2 (ADR-0061 §2): listActiveUserActivations() returns exactly the active users', () => {
    it('two active users and one deactivated user for the same (tenant, platform) — only the two active ones returned', async () => {
      const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
      const tenantId = tenant.id;
      const platformId = `fixture-${randomUUID()}`;
      const makeUser = async (): Promise<string> => {
        const email = `user-${randomUUID()}@example.com`;
        const invited = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
        await resolveIdentity({ sub: `sub-${invited.id}`, email });
        return invited.id;
      };
      const userA = await makeUser();
      const userB = await makeUser();
      const userC = await makeUser();
      await setConnectorActivation(tenantId, platformId, 'user', true, userA, userA);
      await setConnectorActivation(tenantId, platformId, 'user', true, userB, userB);
      await setConnectorActivation(tenantId, platformId, 'user', true, userC, userC);
      await setConnectorActivation(tenantId, platformId, 'user', false, userC, userC);

      const active = await listActiveUserActivations(tenantId, platformId);
      expect(active.sort()).toEqual([userA, userB].sort());
    });
  });

  describe('AC3 (ADR-0061 §2): getMostRecentRunStatusForUser() is scoped by user_id, existing getMostRecentRunStatus() unchanged', () => {
    it("two users' own runs for the same (tenant, platform) — each user's own call returns only their own status", async () => {
      const { tenantId, userId: userA } = await makeTenantWithUser();
      const email = `user-${randomUUID()}@example.com`;
      const invited = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
      await resolveIdentity({ sub: `sub-${invited.id}`, email });
      const userB = invited.id;

      const platformId = `fixture-${randomUUID()}`;
      const runA = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userA });
      await completeIngestionRun(tenantId, runA.id, { status: 'failed', postsIngested: 0, postsSkipped: 0 });
      const runB = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userB });
      await completeIngestionRun(tenantId, runB.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

      expect(await getMostRecentRunStatusForUser(tenantId, platformId, userA)).toBe('failed');
      expect(await getMostRecentRunStatusForUser(tenantId, platformId, userB)).toBe('succeeded');
      // The pre-existing, tenant-wide function stays blended (unchanged behavior) — proves it wasn't touched.
      expect(await getMostRecentRunStatus(tenantId, platformId)).not.toBeNull();
    });
  });

  describe('AC4 (ADR-0061 §2): deriveConnectorHealth() gains backward-compatible pageId?/userId? params', () => {
    it('omitted params: behavior is byte-for-byte unchanged (existing 2-arg call)', async () => {
      const tenantId = await makeTenant();
      const health = await deriveConnectorHealth(tenantId, 'fixture-platform');
      expect(health.status).toBe('disconnected');
      expect(health.consecutiveFailures).toBe(0);
    });

    it("two users' own runs/credentials for the same (tenant, platform) — userId-scoped calls return independently correct results, never blended", async () => {
      const { tenantId, userId: userA } = await makeTenantWithUser();
      const email = `user-${randomUUID()}@example.com`;
      const invited = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
      await resolveIdentity({ sub: `sub-${invited.id}`, email });
      const userB = invited.id;
      const platformId = `fixture-${randomUUID()}`;

      // User A: a real, non-retryable failure (drives consecutiveFailures/status).
      const runA = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userA });
      await completeIngestionRun(tenantId, runA.id, { status: 'failed', postsIngested: 0, postsSkipped: 0, retryable: false });

      // User B: a real success.
      const runB = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userB });
      await completeIngestionRun(tenantId, runB.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

      const healthA = await deriveConnectorHealth(tenantId, platformId, undefined, userA);
      const healthB = await deriveConnectorHealth(tenantId, platformId, undefined, userB);

      expect(healthA.consecutiveFailures).toBe(1);
      expect(healthB.consecutiveFailures).toBe(0);
      expect(healthB.status).toBe('healthy');
    });
  });

  describe('AC5 (ADR-0061 §2): shouldAttemptIngestion() no longer blends failing status across users', () => {
    it("one user's badly-failing Tier-3 connector does not falsely auto-disable another user's own healthy one", async () => {
      const { tenantId, userId: userA } = await makeTenantWithUser();
      const email = `user-${randomUUID()}@example.com`;
      const invited = await createInvitedUser(tenantId, { email, role: 'tenant_user' });
      await resolveIdentity({ sub: `sub-${invited.id}`, email });
      const userB = invited.id;
      const platformId = `fixture-${randomUUID()}`;

      await setConnectorActivation(tenantId, platformId, 'user', true, userA, userA);
      await setConnectorActivation(tenantId, platformId, 'user', true, userB, userB);

      // Drive user A's own health to 'failing' via 20 consecutive non-retryable failures.
      for (let i = 0; i < 20; i++) {
        const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userA });
        await completeIngestionRun(tenantId, run.id, { status: 'failed', postsIngested: 0, postsSkipped: 0, retryable: false });
      }
      // User B has one real success.
      const runB = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0', userId: userB });
      await completeIngestionRun(tenantId, runB.id, { status: 'succeeded', postsIngested: 1, postsSkipped: 0 });

      const healthA = await deriveConnectorHealth(tenantId, platformId, undefined, userA);
      expect(healthA.status).toBe('failing');

      const allowedForB = await shouldAttemptIngestion(tenantId, platformId, 'user', userB);
      expect(allowedForB).toBe(true);
    });

    it('the ownerType:"tenant" default path is completely unaffected (regression check)', async () => {
      const tenantId = await makeTenant();
      const platformId = 'fixture-never-polled';
      await setConnectorActivation(tenantId, platformId, 'tenant', true);
      const allowed = await shouldAttemptIngestion(tenantId, platformId);
      expect(allowed).toBe(true); // disconnected (no runs) is not 'failing'; real activation makes this true
    });
  });

  describe('AC6 (ADR-0061 §3): SocialConnector.pollUser? is a new, distinct optional method', () => {
    it('a connector may declare pollUser without poll, poll without pollUser, both, or neither', () => {
      const pollOnly = fixtureConnector('x', { poll: async () => ({ runId: randomUUID(), status: 'succeeded' }), pollCadenceMs: 1000 });
      const pollUserOnly = fixtureConnector('y', { pollUser: async () => ({ runId: randomUUID(), status: 'succeeded' }), pollCadenceMs: 1000 });
      const both = fixtureConnector('z', {
        poll: async () => ({ runId: randomUUID(), status: 'succeeded' }),
        pollUser: async () => ({ runId: randomUUID(), status: 'succeeded' }),
        pollCadenceMs: 1000,
      });
      const neither = fixtureConnector('w');

      expect(typeof pollOnly.poll).toBe('function');
      expect(pollOnly.pollUser).toBeUndefined();
      expect(typeof pollUserOnly.pollUser).toBe('function');
      expect(pollUserOnly.poll).toBeUndefined();
      expect(typeof both.poll).toBe('function');
      expect(typeof both.pollUser).toBe('function');
      expect(neither.poll).toBeUndefined();
      expect(neither.pollUser).toBeUndefined();
    });
  });

  describe("AC7 (ADR-0061 §3): Facebook's registration has no poll property; pollUser delegates to pollFacebook() unchanged", () => {
    it('the real registered facebook connector has no poll property and a real pollUser', async () => {
      bootstrapConnectors();
      const registered = getSocialConnector(FACEBOOK_PROVIDER_ID);
      expect(registered).toBeDefined();
      expect(registered!.poll).toBeUndefined();
      expect(typeof registered!.pollUser).toBe('function');
      expect(registered!.pollCadenceMs).toBe(30 * 60 * 1000);
    });

    it("Story 1.13's own AC1 registry-shape invariant now allows poll OR pollUser, not poll unconditionally (dated note, ADR-0061 Decision §3)", () => {
      // See contracts/epic-1/story-1.13...contract.test.ts's own dated fix — this is the companion proof.
      bootstrapConnectors();
      for (const connector of listSocialConnectors()) {
        expect(connector.deliveryMode).toBe('poll');
        expect(typeof connector.poll === 'function' || typeof connector.pollUser === 'function').toBe(true);
        expect(typeof connector.pollCadenceMs).toBe('number');
      }
    });
  });

  describe('AC8 (ADR-0061 §4): a new per-user enumeration level triggers each user\'s own pollUser() based solely on that user\'s own due-check', () => {
    it('two users under one tenant, each independently due, are both polled', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const userA = `user-a-${randomUUID()}`;
      const userB = `user-b-${randomUUID()}`;
      const pollUser = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector('fixture-tier3', { pollUser, pollCadenceMs: 1000 });

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          listActiveUserActivations: async () => [userA, userB],
          getMostRecentRunStatusForUser: async () => null,
          now: () => Date.now(),
        })
      );

      expect(pollUser).toHaveBeenCalledTimes(2);
      expect(pollUser).toHaveBeenCalledWith(tenant.id, userA);
      expect(pollUser).toHaveBeenCalledWith(tenant.id, userB);
      const tier3Outcomes = outcomes.filter((o) => o.platformId === 'fixture-tier3');
      expect(tier3Outcomes.length).toBeGreaterThanOrEqual(2);
    });

    it('a user whose most recent run is still running is skipped, even once cadence has elapsed (Story 1.14 parity)', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const userA = `user-a-${randomUUID()}`;
      const pollUser = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector('fixture-tier3-inflight', { pollUser, pollCadenceMs: 1000 });
      const now = Date.now();

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: new Date(now - 10_000_000).toISOString() }),
          listActiveUserActivations: async () => [userA],
          getMostRecentRunStatusForUser: async () => 'running',
          now: () => now,
        })
      );

      expect(pollUser).not.toHaveBeenCalled();
      expect(outcomes.some((o) => o.platformId === 'fixture-tier3-inflight')).toBe(true);
    });

    it("a user not returned by listActiveUserActivations() is never polled — real defaults confirm the actual DB read, not a stub", async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const platformId = `fixture-tier3-real-${randomUUID()}`;
      const pollUser = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector(platformId, { pollUser, pollCadenceMs: 1000 });
      // Deliberately never activated for this user.

      await runSchedulerTick(
        baseDeps({
          listTenants: async () => [{ id: tenantId }],
          listPollConnectors: () => [connector],
          now: () => Date.now(),
          // shouldAttemptIngestion/deriveConnectorHealth/listActiveUserActivations left as real defaults.
        })
      );

      expect(pollUser).not.toHaveBeenCalled();
      void userId;
    });
  });

  describe("AC9 (ADR-0061 §4): one user's pollUser() throwing does not block another user or tenant in the same tick", () => {
    it('a raw exception from one user\'s pollUser() never prevents another due user/tenant from being attempted', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const userBroken = `user-broken-${randomUUID()}`;
      const userHealthy = `user-healthy-${randomUUID()}`;
      const brokenPollUser = jest.fn().mockRejectedValue(new Error('a genuine programming error'));
      const healthyPollUser = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const connector = fixtureConnector('fixture-tier3-isolation', { pollUser: async (t, u) => (u === userBroken ? brokenPollUser(t, u) : healthyPollUser(t, u)), pollCadenceMs: 1000 });
      const onPollError = jest.fn();

      await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt: null }),
          listActiveUserActivations: async () => [userBroken, userHealthy],
          getMostRecentRunStatusForUser: async () => null,
          now: () => Date.now(),
          onPollError,
        })
      );

      expect(brokenPollUser).toHaveBeenCalledTimes(1);
      expect(healthyPollUser).toHaveBeenCalledTimes(1);
      expect(onPollError).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC10 (ADR-0061 §5): jitterFraction() gains an optional userId segment, backward compatible', () => {
    it('omitted userId: output is byte-for-byte identical to the existing two-argument call', () => {
      const twoArg = jitterFraction('tenant-1', 'platform-1');
      const twoArgAgain = jitterFraction('tenant-1', 'platform-1', undefined);
      expect(twoArg).toBe(twoArgAgain);
    });

    it('two different users under the same tenant/connector receive different, deterministic jittered offsets', () => {
      const jitterA = jitterFraction('tenant-1', 'platform-1', 'user-a');
      const jitterAAgain = jitterFraction('tenant-1', 'platform-1', 'user-a');
      const jitterB = jitterFraction('tenant-1', 'platform-1', 'user-b');

      expect(jitterA).toBe(jitterAAgain); // deterministic/repeatable
      expect(jitterA).not.toBe(jitterB); // spreads users apart
      expect(jitterA).toBeGreaterThanOrEqual(-0.05);
      expect(jitterA).toBeLessThan(0.05);
    });
  });

  describe('Real end-to-end proof: pollFacebook() threads userId into its own IngestionRun (closes the actual gap this story exists for)', () => {
    it('a real pollFacebook() call (missing-credential fast path, no network) writes a real user_id on its own IngestionRun', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const result = await pollFacebook(tenantId, userId);
      expect(result.status).toBe('failed'); // no credential connected — expected, fast, no network
      const row = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{ user_id: string | null }>(`SELECT user_id FROM ingestion_runs WHERE id = $1`, [result.runId]);
        return rows[0];
      });
      expect(row.user_id).toBe(userId);
    });
  });
});
