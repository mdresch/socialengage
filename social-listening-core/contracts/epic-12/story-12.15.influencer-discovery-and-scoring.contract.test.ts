/**
 * Contract: Story 12.15 (ADR-0108, BRD-0108, FDD-0108) — Influencer discovery and scoring (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1215--influencer-discovery-and-scoring-backend
 * and docs/adr/0108-influencer-discovery-and-scoring.md
 */

import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { withTenant } from '../../src/db/withTenant';
import { getPool } from '../../src/db/pool';
import {
  computeAuthorScores,
  refreshAuthorScores,
  queryInfluencers,
  explainInfluencerScore,
} from '../../src/authors/influencerService';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 12.15 — Influencer discovery and scoring (backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let author1Id: string;
  let author2Id: string;
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant Influencer ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `influencer-analyst-${Date.now()}@example.com`,
      role: 'tenant_user',
    });

    // Seed test authors
    await withTenant(tenant.id, async (client) => {
      const a1 = await client.query(
        `INSERT INTO authors (tenant_id, platform_id, external_author_id, handle, display_name, follower_count, reach_score, engagement_score, authenticity_score, influence_score)
         VALUES ($1, 'twitter', 'ext_auth_1', 'techlead', 'Tech Leader', 50000, 85.00, 78.50, 92.00, 83.15)
         RETURNING id`,
        [tenant.id]
      );
      author1Id = a1.rows[0].id;

      const a2 = await client.query(
        `INSERT INTO authors (tenant_id, platform_id, external_author_id, handle, display_name, follower_count, reach_score, engagement_score, authenticity_score, influence_score)
         VALUES ($1, 'linkedin', 'ext_auth_2', 'exec_jane', 'Jane Executive', 15000, 65.00, 88.00, 90.00, 78.05)
         RETURNING id`,
        [tenant.id]
      );
      author2Id = a2.rows[0].id;

      // Seed topic signal
      await client.query(
        `INSERT INTO author_topic_signals (tenant_id, author_id, topic, mention_count, avg_engagement)
         VALUES ($1, $2, 'artificial-intelligence', 25, 4.5)
         ON CONFLICT (tenant_id, author_id, topic) DO NOTHING`,
        [tenant.id, author1Id]
      );
    }, getPool(), user.id);

    app = createApp();
  });

  describe('AC1 & AC2: Author scoring model and composite calculation', () => {
    it('computes composite influence score using weighted formula', () => {
      const scores = computeAuthorScores({
        followerCount: 50000,
        avgEngagement: 78.5,
        authenticity: 92.0,
        topicRelevance: 80.0,
      });

      expect(scores.reachScore).toBeGreaterThan(0);
      expect(scores.engagementScore).toBeGreaterThan(0);
      expect(scores.authenticityScore).toBeGreaterThan(0);
      expect(scores.influenceScore).toBeGreaterThan(0);
      expect(scores.influenceScore).toBeLessThanOrEqual(100);

      // Formula test: 0.25*reach + 0.35*engagement + 0.20*authenticity + 0.20*relevance
      const expected =
        0.25 * scores.reachScore +
        0.35 * scores.engagementScore +
        0.20 * scores.authenticityScore +
        0.20 * scores.topicRelevance;
      expect(Math.abs(scores.influenceScore - expected)).toBeLessThan(0.05);
    });

    it('refreshAuthorScores recomputes and updates author table scores in db', async () => {
      const count = await refreshAuthorScores(tenant.id);
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AC3: GET /v1/influencers discovery endpoint', () => {
    it('returns ranked list of influencers with scores and metadata', async () => {
      const res = await request(app)
        .get('/v1/influencers')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('influencers');
      expect(Array.isArray(res.body.influencers)).toBe(true);
      expect(res.body.influencers.length).toBeGreaterThanOrEqual(2);

      const first = res.body.influencers[0];
      expect(first).toHaveProperty('authorId');
      expect(first).toHaveProperty('authorName');
      expect(first).toHaveProperty('platformId');
      expect(first).toHaveProperty('reachScore');
      expect(first).toHaveProperty('engagementScore');
      expect(first).toHaveProperty('authenticityScore');
      expect(first).toHaveProperty('influenceScore');
      expect(first).toHaveProperty('topTopics');
    });

    it('filters influencers by platformId', async () => {
      const res = await request(app)
        .get('/v1/influencers?platformId=linkedin')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.influencers.every((inf: any) => inf.platformId === 'linkedin')).toBe(true);
    });

    it('filters influencers by minScore and respects limit', async () => {
      const res = await request(app)
        .get('/v1/influencers?minScore=80&limit=1')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.influencers.length).toBeLessThanOrEqual(1);
      if (res.body.influencers.length > 0) {
        expect(res.body.influencers[0].influenceScore).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('AC4: GET /v1/influencers/:authorId/explain endpoint', () => {
    it('returns explainability breakdown for an author score', async () => {
      const res = await request(app)
        .get(`/v1/influencers/${author1Id}/explain`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.authorId).toBe(author1Id);
      expect(res.body).toHaveProperty('influenceScore');
      expect(res.body).toHaveProperty('breakdown');
      expect(res.body.breakdown).toHaveProperty('reach');
      expect(res.body.breakdown).toHaveProperty('engagement');
      expect(res.body.breakdown).toHaveProperty('authenticity');
      expect(res.body.breakdown).toHaveProperty('topicRelevance');
      expect(res.body.breakdown.reach.weight).toBe(0.25);
      expect(res.body.breakdown.engagement.weight).toBe(0.35);
      expect(res.body.breakdown.authenticity.weight).toBe(0.20);
      expect(res.body.breakdown.topicRelevance.weight).toBe(0.20);
    });

    it('returns 404 for non-existent author', async () => {
      const res = await request(app)
        .get(`/v1/influencers/00000000-0000-0000-0000-000000000000/explain`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(404);
    });
  });
});
