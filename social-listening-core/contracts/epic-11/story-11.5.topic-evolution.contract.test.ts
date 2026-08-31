/**
 * Contract: Story 11.5 (ADR-0097, BRD-0097, FDD-0097) — Topic evolution timeline (backend)
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-115--topic-evolution-timeline-backend
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import {
  recordTopicDailyCount,
  calculateTrend,
} from '../../src/topics/topicEvolutionService';

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

describe('Story 11.5 — Topic Evolution Timeline (Backend)', () => {
  let tenant: { id: string };
  let otherTenant: { id: string };
  let user: { id: string };
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant Topic Evo ${Date.now()}`);
    otherTenant = await createTenantFixture(`Tenant Other ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `topic-analyst-${Date.now()}@example.com`,
    });
    app = createApp();

    // Seed 14 days of data for topic "Artificial Intelligence" in tenant
    for (let i = 14; i >= 1; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const postCount = 10 + (14 - i) * 5; // Rising volume: 10, 15, 20, ..., 75

      await recordTopicDailyCount(tenant.id, {
        date: dateStr,
        topic: 'Artificial Intelligence',
        postCount,
        uniqueAuthors: Math.round(postCount * 0.6),
        positiveCount: Math.round(postCount * 0.6),
        neutralCount: Math.round(postCount * 0.3),
        negativeCount: Math.round(postCount * 0.1),
        topKeywords: [
          { keyword: 'llm', count: Math.round(postCount * 0.5) },
          { keyword: 'agent', count: Math.round(postCount * 0.3) },
        ],
        topAuthors: [
          { authorId: 'a1', authorName: 'Alice Tech', count: Math.round(postCount * 0.4) },
        ],
      });
    }

    // Seed data for otherTenant to verify isolation
    await recordTopicDailyCount(otherTenant.id, {
      date: new Date().toISOString().slice(0, 10),
      topic: 'Artificial Intelligence',
      postCount: 9999,
    });
  });

  describe('AC1: Trend slope calculation unit check', () => {
    it('accurately identifies rising, falling, and stable trends', () => {
      expect(calculateTrend([10, 20, 30, 45, 60, 80, 110])).toBe('rising');
      expect(calculateTrend([100, 80, 60, 40, 25, 15, 5])).toBe('falling');
      expect(calculateTrend([50, 52, 49, 51, 50, 51, 50])).toBe('stable');
    });
  });

  describe('AC2: GET /v1/topics/evolution time-series response', () => {
    it('returns timeline points with metrics, sentiment, keywords, authors, and trend', async () => {
      const res = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence&granularity=day')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(res.body.topicName).toBe('Artificial Intelligence');
      expect(res.body.granularity).toBe('day');
      expect(Array.isArray(res.body.points)).toBe(true);
      expect(res.body.points.length).toBeGreaterThanOrEqual(14);

      const latestPoint = res.body.points[res.body.points.length - 1];
      expect(latestPoint.mentionCount).toBeGreaterThan(0);
      expect(latestPoint.uniqueAuthors).toBeGreaterThan(0);
      expect(latestPoint.sentiment).toHaveProperty('positive');
      expect(latestPoint.sentiment).toHaveProperty('negative');
      expect(latestPoint.topKeywords.length).toBeGreaterThan(0);
      expect(latestPoint.topKeywords[0].keyword).toBe('llm');
      expect(latestPoint.topAuthors[0].authorName).toBe('Alice Tech');
      expect(latestPoint.trend).toBe('rising');
    });
  });

  describe('AC3: Granularity and Bucketing', () => {
    it('supports week and month granularity bucketing', async () => {
      const resWeek = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence&granularity=week')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(resWeek.status).toBe(200);
      expect(resWeek.body.granularity).toBe('week');
      expect(resWeek.body.points.length).toBeLessThanOrEqual(5);

      const resMonth = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence&granularity=month')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(resMonth.status).toBe(200);
      expect(resMonth.body.granularity).toBe('month');
    });

    it('rejects invalid granularity with HTTP 400', async () => {
      const res = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence&granularity=yearly')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/granularity must be one of/);
    });
  });

  describe('AC4: Period Comparison (compareToPrevious)', () => {
    it('returns previousPeriodPoints when compareToPrevious=true', async () => {
      const res = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence&compareToPrevious=true')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('previousPeriodPoints');
      expect(Array.isArray(res.body.previousPeriodPoints)).toBe(true);
    });
  });

  describe('AC5: Authentication', () => {
    it('rejects requests with only a stray X-Tenant-Id header', async () => {
      const res = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence')
        .set('x-tenant-id', tenant.id);

      expect(res.status).toBe(401);
    });
  });

  describe('AC6: Tenant Isolation', () => {
    it('does not leak other tenants data into timeline', async () => {
      const res = await request(app)
        .get('/v1/topics/evolution?topic=Artificial Intelligence')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      for (const pt of res.body.points) {
        expect(pt.mentionCount).toBeLessThan(9000);
      }
    });
  });
});
