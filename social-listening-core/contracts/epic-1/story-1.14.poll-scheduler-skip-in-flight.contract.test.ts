// Contract: Story 1.14 (ADR-0052 Decision §5b, Clarification 2026-08-18) —
// poll scheduler: skip a (tenant, platform) pair whose most recent run is
// still status: 'running'.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-114
// and docs/adr/0052-live-ingestion-polling-scheduler.md's own Decision §5b.
//
// Intent: a real, live investigation this session (a reported Wikipedia
// duplication/missing-posts symptom) found no actual duplicate social_posts
// rows, but did find real evidence of the underlying gap: ADR-0052 Decision
// §5's eligibility comparison is elapsed-time-only and never checks whether
// the pair's most recent ingestion_runs row has actually finished. A slow
// poll cycle (Wikipedia's own re-poll-every-tracked-article design means
// duration scales with tracked-article count) or a prior run interrupted by
// a dev-server restart and left permanently 'running' lets the next
// eligible tick start a second, overlapping poll for the same pair while
// the first is still in flight — a real risk given insertSocialPost()/
// findSocialPostByExternalId()'s check-then-insert dedup has no database-
// level uniqueness constraint.
//
// Scope: src/ingestion/ingestionRunStore.ts (new getMostRecentRunStatus()),
// src/scheduler/pollScheduler.ts (SchedulerDeps gains
// getMostRecentRunStatus; eligibility check gains the additional
// not-'running' condition).
//
// Contract to encode: AC1 a pair whose most recent run is 'running' is
// never polled, even when its jittered cadence has genuinely elapsed; AC2 a
// pair with no prior run, or whose most recent run is 'succeeded'/'failed',
// is unaffected — evaluated purely on elapsed time, same as before; AC3 the
// existing cadence/jitter formula itself is untouched (no new stored
// field); AC4 the check is wired through SchedulerDeps' existing injectable
// seam, not a new direct database call inside pollScheduler.ts.
//
// Explicitly out of scope (ADR-0052 Decision §5b's own stated boundary, not
// tested): a genuine multi-instance distributed lock — two truly concurrent
// processes can still both observe "not running" and both poll; a database-
// level uniqueness constraint on social_posts as defense-in-depth; cleaning
// up the orphaned 'running' rows already found in the dev database (a
// direct, one-off DB fix, not code).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { runSchedulerTick, SchedulerDeps } from '../../src/scheduler/pollScheduler';
import { SocialConnector } from '../../src/connectors/types';

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

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

describe('Story 1.14 — poll scheduler skips a pair whose most recent run is still running', () => {
  describe("AC1 (ADR-0052 §5b): a 'running' most-recent run is never polled, regardless of elapsed cadence", () => {
    it('a pair whose cadence has long elapsed, but whose most recent run is still running, is not polled', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const cadenceMs = 1000;
      const connector = fixtureConnector('fixture-in-flight', { poll, pollCadenceMs: cadenceMs });
      const now = Date.now();
      const lastAttemptAt = new Date(now - 10_000_000).toISOString(); // far past cadence

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          getMostRecentRunStatus: async () => 'running',
          now: () => now,
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(poll).not.toHaveBeenCalled();
    });
  });

  describe("AC2 (ADR-0052 §5b): 'succeeded'/'failed'/no-prior-run are all unaffected — elapsed time still decides", () => {
    it.each(['succeeded', 'failed', null] as const)(
      'a due pair whose most recent run status is %s is still polled',
      async (status) => {
        const tenant = { id: `tenant-${randomUUID()}` };
        const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
        const cadenceMs = 1000;
        const connector = fixtureConnector('fixture-not-in-flight', { poll, pollCadenceMs: cadenceMs });
        const now = Date.now();
        const lastAttemptAt = new Date(now - 10_000_000).toISOString(); // far past cadence

        const outcomes = await runSchedulerTick(
          baseDeps({
            listTenants: async () => [tenant],
            listPollConnectors: () => [connector],
            shouldAttemptIngestion: async () => true,
            deriveConnectorHealth: async () => ({ lastAttemptAt }),
            getMostRecentRunStatus: async () => status,
            now: () => now,
          })
        );

        expect(outcomes[0].polled).toBe(true);
        expect(poll).toHaveBeenCalledTimes(1);
      }
    );

    it('a pair still under its jittered cadence is not polled, regardless of most-recent-run status (existing §5 behavior, unchanged)', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const cadenceMs = 1_000_000;
      const connector = fixtureConnector('fixture-cadence-unaffected', { poll, pollCadenceMs: cadenceMs });
      const now = Date.now();
      const lastAttemptAt = new Date(now - 1000).toISOString(); // barely elapsed

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          getMostRecentRunStatus: async () => 'succeeded',
          now: () => now,
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(poll).not.toHaveBeenCalled();
    });
  });

  describe('AC4 (ADR-0052 §5b): the check is wired through SchedulerDeps\' existing injectable seam', () => {
    it('getMostRecentRunStatus() is never called when the pair is not due on elapsed time alone (no wasted query)', async () => {
      const tenant = { id: `tenant-${randomUUID()}` };
      const poll = jest.fn().mockResolvedValue({ runId: randomUUID(), status: 'succeeded' });
      const cadenceMs = 1_000_000;
      const connector = fixtureConnector('fixture-not-due', { poll, pollCadenceMs: cadenceMs });
      const now = Date.now();
      const lastAttemptAt = new Date(now - 1000).toISOString(); // barely elapsed
      const getMostRecentRunStatus = jest.fn().mockResolvedValue('running');

      const outcomes = await runSchedulerTick(
        baseDeps({
          listTenants: async () => [tenant],
          listPollConnectors: () => [connector],
          shouldAttemptIngestion: async () => true,
          deriveConnectorHealth: async () => ({ lastAttemptAt }),
          getMostRecentRunStatus,
          now: () => now,
        })
      );

      expect(outcomes[0].polled).toBe(false);
      expect(getMostRecentRunStatus).not.toHaveBeenCalled();
    });
  });
});
