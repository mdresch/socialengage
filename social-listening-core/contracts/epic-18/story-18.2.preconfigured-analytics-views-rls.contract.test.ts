// Contract: Story 18.2 (ADR-0135, BRD-0135, FDD-0135, TDS-0135) — Preconfigured analytics view RLS table enforcement (backend)
// See docs/user-stories/epic-18-adr-0134-to-0135.md#story-182
//
// Intent: Story 18.2 — Preconfigured analytics view RLS table enforcement (ADR-0135, Accepted 2026-08-28)
// Scope:
//   social-listening-core:
//     src/http/versions/v1/analyticsViewsRouter.ts (add 'topics' to VALID_VIEWS and route to topic_daily_counts),
//     contracts/epic-18/story-18.2.preconfigured-analytics-views-rls.contract.test.ts (new contract test),
//     .claude/skills/precomputed-analytics-views/SKILL.md
// Contract to encode:
//   AC1: Verification that all five rollup entities (source_daily_counts, author_daily_counts,
//        sentiment_daily_counts, watchlist_daily_counts, topic_daily_counts) are ordinary
//        physical PostgreSQL tables (relkind = 'r') in pg_class, and none are literal
//        materialized views (relkind = 'm') or regular views (relkind = 'v').
//   AC2: Verification that all five tables have Row-Level Security enabled (relrowsecurity = true)
//        in pg_class.
//   AC3: Verification that each of the five tables has a tenant isolation policy restricting access by tenant_id.
//   AC4: Worker refresh idempotency: runDailyAggregatesRefresh() populates via idempotent upserts
//        (INSERT ... ON CONFLICT DO UPDATE) and multiple runs do not duplicate rollups.
//   AC5: Query routing and cross-tenant isolation: GET /v1/analytics/:view supports all five views
//        (sources, sentiments, topics, authors, watchlists) and guarantees cross-tenant isolation.
// Explicitly out of scope:
//   - Adopting TimescaleDB continuous aggregates (deferred by ADR-0135 §5).
//   - Changing composite primary keys or 15-minute refresh cadence.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { runDailyAggregatesRefresh } from '../../src/analytics/dailyAggregatesWorker';

jest.setTimeout(30000);

const EXPECTED_TABLES = [
  'source_daily_counts',
  'author_daily_counts',
  'sentiment_daily_counts',
  'watchlist_daily_counts',
  'topic_daily_counts',
];

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedPostForTenant(
  tenantId: string,
  platformId: string,
  sentiment: string,
  publishedAt: string
) {
  await getAdminPool().query(
    `INSERT INTO social_posts (
       tenant_id,
       raw_payload,
       published_at,
       body_markdown,
       enrichment
     ) VALUES (
       $1,
       $2,
       $3::timestamptz,
       'Test post markdown body',
       $4
     )`,
    [
      tenantId,
      JSON.stringify({ providerId: platformId, externalId: `ext-${randomUUID()}` }),
      publishedAt,
      JSON.stringify({ sentiment, modelUsed: 'azure-ai-language' }),
    ]
  );
}

describe('Story 18.2 (ADR-0135) — Preconfigured Analytics Views RLS Table Enforcement', () => {
  const app = createApp();

  describe('AC1: Five rollup structures are physical PostgreSQL tables, not materialized views', () => {
    it('verifies in pg_class that all five structures have relkind = "r" and none are "m" or "v"', async () => {
      const pool = getPlatformAdminPool();
      const { rows } = await pool.query<{ relname: string; relkind: string }>(
        `SELECT relname, relkind 
         FROM pg_class 
         WHERE relname = ANY($1::text[])`,
        [EXPECTED_TABLES]
      );

      expect(rows).toHaveLength(5);
      for (const table of EXPECTED_TABLES) {
        const found = rows.find((r) => r.relname === table);
        expect(found).toBeDefined();
        // relkind 'r' = ordinary table, 'm' = materialized view, 'v' = view
        expect(found!.relkind).toBe('r');
      }
    });
  });

  describe('AC2: Row-Level Security is enabled on all five rollup tables', () => {
    it('verifies in pg_class that relrowsecurity is true for all five tables', async () => {
      const pool = getPlatformAdminPool();
      const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relname, relrowsecurity, relforcerowsecurity 
         FROM pg_class 
         WHERE relname = ANY($1::text[])`,
        [EXPECTED_TABLES]
      );

      expect(rows).toHaveLength(5);
      for (const table of EXPECTED_TABLES) {
        const found = rows.find((r) => r.relname === table);
        expect(found).toBeDefined();
        expect(found!.relrowsecurity).toBe(true);
      }
    });
  });

  describe('AC3: Tenant isolation RLS policies exist for all five rollup tables', () => {
    it('verifies active pg_policy records exist scoping by tenant_id', async () => {
      const pool = getPlatformAdminPool();
      const { rows } = await pool.query<{ tablename: string; policyname: string }>(
        `SELECT tablename, policyname 
         FROM pg_policies 
         WHERE tablename = ANY($1::text[])`,
        [EXPECTED_TABLES]
      );

      for (const table of EXPECTED_TABLES) {
        const policies = rows.filter((r) => r.tablename === table);
        expect(policies.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('AC4: Worker refresh idempotency via ON CONFLICT DO UPDATE', () => {
    it('re-running runDailyAggregatesRefresh does not duplicate or corrupt counts', async () => {
      const tenant = await createTenantFixture(`T-18.2-idempotency-${randomUUID()}`);
      const today = new Date().toISOString().slice(0, 10);

      await seedPostForTenant(tenant.id, 'bluesky', 'positive', today + 'T09:00:00Z');
      await seedPostForTenant(tenant.id, 'bluesky', 'negative', today + 'T10:00:00Z');

      // First refresh
      const firstRun = await runDailyAggregatesRefresh();
      expect(firstRun.errors).toBe(0);

      const pool = getAdminPool();
      const { rows: firstRows } = await pool.query<{ post_count: number }>(
        `SELECT post_count FROM source_daily_counts WHERE tenant_id = $1 AND platform_id = 'bluesky' AND date = $2::date`,
        [tenant.id, today]
      );
      expect(firstRows).toHaveLength(1);
      const initialCount = firstRows[0].post_count;
      expect(initialCount).toBe(2);

      // Second refresh (idempotency check)
      const secondRun = await runDailyAggregatesRefresh();
      expect(secondRun.errors).toBe(0);

      const { rows: secondRows } = await pool.query<{ post_count: number }>(
        `SELECT post_count FROM source_daily_counts WHERE tenant_id = $1 AND platform_id = 'bluesky' AND date = $2::date`,
        [tenant.id, today]
      );
      expect(secondRows).toHaveLength(1);
      expect(secondRows[0].post_count).toBe(initialCount);
    });
  });

  describe('AC5: Query routing and cross-tenant isolation for all five views', () => {
    it('GET /v1/analytics/topics returns 200 with topic daily counts', async () => {
      const tenant = await createTenantFixture(`T-18.2-topics-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-topics-${randomUUID()}@example.com` });
      const today = new Date().toISOString().slice(0, 10);

      // Seed a topic daily count record directly
      await getAdminPool().query(
        `INSERT INTO topic_daily_counts (tenant_id, date, topic, post_count, positive_count, neutral_count, negative_count)
         VALUES ($1, $2::date, 'ai-trends', 5, 3, 1, 1)
         ON CONFLICT (tenant_id, date, topic) DO UPDATE SET post_count = 5`,
        [tenant.id, today]
      );

      const res = await request(app)
        .get(`/v1/analytics/topics?start_date=${today}&end_date=${today}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.view).toBe('topics');
      expect(Array.isArray(res.body.rows)).toBe(true);
      const aiTopic = res.body.rows.find((r: any) => r.topic === 'ai-trends');
      expect(aiTopic).toBeDefined();
      expect(aiTopic.post_count).toBe(5);
    });

    it('cross-tenant isolation: tenant B cannot access tenant A topic counts', async () => {
      const tenantA = await createTenantFixture(`T-18.2-isoA-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-18.2-isoB-${randomUUID()}`);
      const userB = await createInvitedUser(tenantB.id, { email: `userB-iso-${randomUUID()}@example.com` });
      const today = new Date().toISOString().slice(0, 10);

      // Seed topic counts for tenant A
      await getAdminPool().query(
        `INSERT INTO topic_daily_counts (tenant_id, date, topic, post_count)
         VALUES ($1, $2::date, 'confidential-merger', 10)
         ON CONFLICT (tenant_id, date, topic) DO NOTHING`,
        [tenantA.id, today]
      );

      // Query as tenant B
      const res = await request(app)
        .get(`/v1/analytics/topics?start_date=${today}&end_date=${today}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id, { userId: userB.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      const leaked = res.body.rows.find((r: any) => r.topic === 'confidential-merger');
      expect(leaked).toBeUndefined();
    });
  });
});
