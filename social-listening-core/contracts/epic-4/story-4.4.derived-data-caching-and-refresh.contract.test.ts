// Contract: Story 4.4 (ADR-0022) — ConnectorHealth served from a short-TTL
// in-process read-through cache; AuthorTopicSignal refreshed hourly via pg_cron.
// See docs/user-stories/epic-4-derived-data-analytics-and-health.md#story-44--derived-data-caching-and-refresh-strategy
//
// Intent: Story 4.4 — Derived-data caching and refresh strategy (ADR-0022)
// Scope: src/connectors/connectorHealthCache.ts, src/http/versions/v1/connectorsRouter.ts,
// src/http/versions/v1/router.ts, migrations/0013_enable_pg_cron_and_refresh_author_topic_signals.sql,
// docker/test-postgres/Dockerfile, docker-compose.test.yml (pg_cron needs a real
// Postgres extension, not mocked — the shared test image gains it here).
// Contract to encode: (1) GET /v1/connectors/:platformId is served from a
// TTL-bound cache in front of deriveConnectorHealth() — two reads inside the
// TTL return the identical cached value even if IngestionRun data changes in
// between; a read after the TTL expires recomputes and reflects the change;
// (2) the cache module has no Redis/shared-store dependency at all (source
// inspection — same pattern Story 4.1's AC3 used), so it degrades to "slower
// but correct" rather than failing if a shared cache were ever unavailable;
// (3) flushing the cache and immediately re-reading (with underlying data
// unchanged) produces the identical result — proving it's a pure derivation
// cache, never a second, independently-updatable copy; (4) two independent
// cache instances (standing in for two social-listening-core instances) can
// show different, individually-correct results within the same TTL window —
// documented as acceptable cross-instance staleness, not a bug; (5)
// AuthorTopicSignal has a genuinely hourly pg_cron schedule (checked via
// cron.job) whose target function, invoked directly (the same call pg_cron
// itself would make — waiting a real hour isn't feasible in a test), correctly
// recomputes mentionCount/firstMentionAt/lastMentionAt/activeMonthsCount from
// real social_posts rows and advances refreshed_at.
// Explicitly out of scope: avgEngagement/sentimentBreakdown population — their
// source columns (engagementMetrics, sentiment) don't exist on social_posts
// yet (Phase 2 enrichment-pipeline wiring, not this story's — see
// .claude/skills/social-post-enrichment/SKILL.md's Known gaps), so the refresh
// function leaves them untouched, same as any other caller inserting a
// partial signal row; a "list all connectors" endpoint (only a single-platform
// GET /v1/connectors/:platformId exists, mirroring topicsRouter's per-resource
// shape — no connector/platform registry query is storied yet); a Redis-backed
// shared cache (ADR-0022 explicitly rejects this for ConnectorHealth); the
// optional `?fresh=true` bypass param (ADR-0022's Acceptance note calls it
// optional, not required for acceptance); spinning up two real server
// processes for AC4 (proven via two independent in-process cache instances
// within one test process instead — same "prove the mechanism" pattern this
// session has used throughout).

// 2026-08-03 — Story 5.10 (ADR-0033): tenant identity now comes from
// X-Test-Identity (via testAuthBypassMiddleware, NODE_ENV==='test' only),
// not X-Tenant-Id — see .claude/skills/tenant-auth-middleware/SKILL.md.
// Business-logic assertions below are otherwise unchanged.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getPool, closePool } from '../../src/db/pool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { ConnectorHealthCache, flushConnectorHealthCache } from '../../src/connectors/connectorHealthCache';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
  await closeAdminPool();
});

const platformId = 'example-poll';

async function recordRun(
  tenantId: string,
  status: 'succeeded' | 'failed',
  errorSummary?: string
): Promise<void> {
  const run = await startIngestionRun(tenantId, {
    platformId,
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  await completeIngestionRun(tenantId, run.id, {
    status,
    postsIngested: status === 'succeeded' ? 1 : 0,
    postsSkipped: 0,
    errorSummary,
  });
}

describe('Story 4.4 — derived-data caching and refresh strategy contract', () => {
  const app = createApp();

  it('AC1a: GET /v1/connectors/:platformId serves ConnectorHealth via the cache', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');

    const res = await request(app).get(`/v1/connectors/${platformId}`).set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('lastSuccessfulFetchAt');
  });

  it('AC1b: a cached read stays stable within the TTL and recomputes once the TTL expires', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');

    // TTL is short but comfortably longer than the 20 sequential seeding
    // round trips below take in practice — a 50ms TTL was flaky here because
    // those round trips (real Postgres, not mocked) themselves sometimes
    // exceeded 50ms, expiring the entry before "stillCached" was even read.
    const cache = new ConnectorHealthCache(3000);
    const first = await cache.get(tenantId, platformId);
    expect(first.status).toBe('healthy');

    // Underlying data changes enough to flip the derived status, but the
    // cached read (still within the TTL) must not reflect it yet.
    for (let i = 0; i < 20; i++) {
      await recordRun(tenantId, 'failed', `failure ${i}`);
    }
    const stillCached = await cache.get(tenantId, platformId);
    expect(stillCached.status).toBe('healthy');
    expect(stillCached).toEqual(first);

    await new Promise((resolve) => setTimeout(resolve, 3200));
    const afterExpiry = await cache.get(tenantId, platformId);
    expect(afterExpiry.status).toBe('failing');
  });

  it('AC2: the cache module has no Redis/shared-store dependency — in-process only', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'connectors', 'connectorHealthCache.ts'),
      'utf8'
    );
    // Matches an actual import/require of a redis-like module, not mere
    // mentions of the word in an explanatory comment — same style as Story
    // 4.1's AC3 (social_posts) and Story 3.4's AC3 (OFFSET) source checks.
    expect(source).not.toMatch(/from\s+['"](ioredis|redis)['"]|require\(\s*['"](ioredis|redis)['"]\s*\)/i);
  });

  it('AC3: flushing the cache and immediately re-reading (data unchanged) produces the identical result', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');

    const cache = new ConnectorHealthCache(60_000);
    const before = await cache.get(tenantId, platformId);
    cache.flush();
    const after = await cache.get(tenantId, platformId);
    expect(after).toEqual(before);

    // The module-level shared cache (what the router actually uses) supports
    // the same flush operation.
    await request(app).get(`/v1/connectors/${platformId}`).set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    expect(() => flushConnectorHealthCache()).not.toThrow();
  });

  it('AC4: two independent cache instances may show different, individually-correct results within the same TTL window', async () => {
    const tenantId = randomUUID();
    await recordRun(tenantId, 'succeeded');

    // Stand-ins for two separate social-listening-core process instances —
    // each with its own in-process cache, per ADR-0022's cache-locality decision.
    const instanceA = new ConnectorHealthCache(60_000);
    const instanceB = new ConnectorHealthCache(60_000);

    const staleRead = await instanceA.get(tenantId, platformId); // populates A's cache
    expect(staleRead.status).toBe('healthy');

    for (let i = 0; i < 20; i++) {
      await recordRun(tenantId, 'failed', `failure ${i}`);
    }

    const aStillStale = await instanceA.get(tenantId, platformId); // A: cache hit, unaware of the change
    const bFresh = await instanceB.get(tenantId, platformId); // B: first read, computes fresh

    expect(aStillStale.status).toBe('healthy');
    expect(bFresh.status).toBe('failing');
    expect(aStillStale.status).not.toBe(bFresh.status); // real, acceptable cross-instance staleness
  });

  it('AC5a: author_topic_signals has a genuinely hourly pg_cron schedule', async () => {
    const { rows } = await getAdminPool().query<{ schedule: string; command: string }>(
      `SELECT schedule, command FROM cron.job WHERE jobname = 'refresh-author-topic-signals'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].schedule).toBe('0 * * * *');
    expect(rows[0].command).toMatch(/refresh_author_topic_signals/);
  });

  it('AC5b: invoking the scheduled refresh recomputes AuthorTopicSignal from real social_posts rows and advances refreshed_at', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId,
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const author = await upsertAuthor(tenantId, platformId, `ext-${randomUUID()}`, {});

    const fixtures = ['2026-03-01T09:00:00Z', '2026-03-01T15:00:00Z', '2026-04-10T09:00:00Z'];
    for (const publishedAt of fixtures) {
      await insertSocialPost({
        tenantId,
        authorId: author.id,
        acquisitionId: run.id,
        rawPayload: {},
        publishedAt: new Date(publishedAt),
        enrichment: { entities: ['acme'], keyPhrases: [] },
      });
    }

    // Captured via Postgres's own now(), not the test process's Date.now() —
    // refreshed_at is also set by Postgres's now() (migration 0013), and
    // comparing across two different clocks (host/test-process vs. the
    // Dockerized Postgres container) is unsound: Docker Desktop/WSL2 VM
    // clock drift from the host is real and grows over a session's runtime,
    // which is what previously made this assertion intermittently fail by a
    // widening margin (10ms, then 95ms) even under --runInBand (no Jest
    // parallelism involved at all). See .claude/skills/derived-data-caching-and-refresh/SKILL.md's
    // matching Load-bearing constraint.
    const {
      rows: [{ now: before }],
    } = await getAdminPool().query<{ now: Date }>('SELECT now()');
    await getAdminPool().query('SELECT refresh_author_topic_signals();');

    const { rows } = await withTenant(tenantId, (client) =>
      client.query<{
        mention_count: number;
        active_months_count: number;
        first_mention_at: Date;
        last_mention_at: Date;
        refreshed_at: Date;
      }>(
        `SELECT mention_count, active_months_count, first_mention_at, last_mention_at, refreshed_at
         FROM author_topic_signals WHERE tenant_id = $1 AND author_id = $2 AND topic = 'acme'`,
        [tenantId, author.id]
      )
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].mention_count).toBe(3);
    expect(rows[0].active_months_count).toBe(2); // March + April
    expect(rows[0].first_mention_at.toISOString()).toBe('2026-03-01T09:00:00.000Z');
    expect(rows[0].last_mention_at.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(rows[0].refreshed_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
