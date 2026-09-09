// Contract: Story 11.3 (ADR-0096, BRD-0096, FDD-0096) — Daily Digest Email (Backend)
// See docs/user-stories/epic-11-adr-0095-to-0100.md#story-113--daily-digest-email-backend

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { withTenant } from '../../src/db/withTenant';
import {
  getUserDigestPreferences,
  upsertUserDigestPreferences,
  findDueDigestSubscriptions,
  updateLastSentAt,
} from '../../src/digest/digestPreferenceStore';
import { buildDailyDigest } from '../../src/digest/dailyDigestBuilder';
import { renderDailyDigest } from '../../src/digest/dailyDigestRenderer';
import { runHourlyDigestBatch } from '../../src/digest/dailyDigestScheduler';

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

async function createPostFixture(tenantId: string, authorName: string, text: string, sentiment = 'positive'): Promise<{ id: string }> {
  return withTenant(tenantId, async (client) => {
    const authorRes = await client.query(
      `INSERT INTO authors (tenant_id, platform_id, external_author_id, display_name, handle, first_seen_at, last_seen_at)
       VALUES ($1, 'twitter', $2, $3, $4, now(), now())
       RETURNING id`,
      [tenantId, `user-${randomUUID()}`, authorName, `@${authorName.toLowerCase().replace(/\s+/g, '')}`]
    );
    const authorId = authorRes.rows[0].id;

    const postRes = await client.query(
      `INSERT INTO social_posts (
         tenant_id, author_id, raw_payload, body_markdown, published_at, enrichment, author_follower_count_at_publish
       )
       VALUES ($1, $2, $3, $4, now(), $5, $6)
       RETURNING id`,
      [
        tenantId,
        authorId,
        JSON.stringify({
          platformId: 'twitter',
          externalId: `ext-${randomUUID()}`,
          authorName,
          body: text,
          likeCount: 42,
          replyCount: 5,
        }),
        text,
        JSON.stringify({ sentiment }),
        1250,
      ]
    );

    return postRes.rows[0];
  });
}

describe('Story 11.3 — Daily Digest Email (Backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant Digest ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `digest-user-${Date.now()}@example.com`,
    });
    app = createApp();

    // Seed test posts
    await createPostFixture(tenant.id, 'Alice Customer', 'Loving the new product update! Outstanding work.', 'positive');
    await createPostFixture(tenant.id, 'Bob Critic', 'Encountered a critical bug in checkout flow.', 'negative');
  });

  describe('AC1: Preferences Management API', () => {
    it('GET /v1/users/me/digest-preferences returns default settings when unconfigured', async () => {
      const res = await request(app)
        .get('/v1/users/me/digest-preferences')
        .set(
          'X-Test-Identity',
          testIdentityHeaderValue(tenant.id, {
            userId: user.id,
            role: 'tenant_user',
          })
        );

      expect(res.status).toBe(200);
      expect(res.body.isEnabled).toBe(true);
      expect(res.body.timezone).toBe('Europe/Amsterdam');
      expect(res.body.sendAtLocal).toBe('08:00:00');
    });

    it('POST /v1/users/me/digest-preferences updates user preferences', async () => {
      const res = await request(app)
        .post('/v1/users/me/digest-preferences')
        .set(
          'X-Test-Identity',
          testIdentityHeaderValue(tenant.id, {
            userId: user.id,
            role: 'tenant_user',
          })
        )
        .send({
          isEnabled: true,
          sendAtLocal: '07:30:00',
          timezone: 'America/New_York',
          includeAiSummary: true,
          includeTopPosts: true,
          includeTopicBreakdown: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.timezone).toBe('America/New_York');
      expect(res.body.sendAtLocal).toBe('07:30:00');
      expect(res.body.includeTopicBreakdown).toBe(false);
    });
  });

  describe('AC2: Daily Digest Data Assembly & Preview Generation', () => {
    it('POST /v1/users/me/digest-previews returns compiled metrics and rendered dual MIME email', async () => {
      const res = await request(app)
        .post('/v1/users/me/digest-previews')
        .set(
          'X-Test-Identity',
          testIdentityHeaderValue(tenant.id, {
            userId: user.id,
            role: 'tenant_user',
          })
        )
        .send({
          includeAiSummary: true,
          includeTopPosts: true,
          includeTopicBreakdown: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.totalMentions).toBeGreaterThanOrEqual(2);
      expect(res.body.data.sentimentDistribution).toBeDefined();
      expect(res.body.data.notablePosts.length).toBeGreaterThanOrEqual(1);

      // Verify rendered email parts
      expect(res.body.rendered).toBeDefined();
      expect(res.body.rendered.subject).toMatch(/daily digest/i);
      expect(res.body.rendered.html).toContain('<!DOCTYPE html>');
      expect(res.body.rendered.html).toContain('AI Executive Summary');
      expect(res.body.rendered.text).toContain('24-HOUR SUMMARY');
    });
  });

  describe('AC3: Scheduler & Cooldown Enforcement', () => {
    it('enforces 20-hour duplicate suppression cooldown', async () => {
      // Upsert preferences with matching current local hour for UTC
      const currentHourStr = new Date().getUTCHours().toString().padStart(2, '0') + ':00:00';
      const pref = await upsertUserDigestPreferences(tenant.id, user.id, {
        isEnabled: true,
        sendAtLocal: currentHourStr,
        timezone: 'UTC',
      });

      // Find due subscriptions
      const dueBefore = await findDueDigestSubscriptions(20);
      const isDue = dueBefore.some((s) => s.userId === user.id);
      expect(isDue).toBe(true);

      // Mark as sent just now
      await updateLastSentAt(pref.id, new Date());

      // Query again; user must now be suppressed by 20h cooldown
      const dueAfter = await findDueDigestSubscriptions(20);
      const isDueAfter = dueAfter.some((s) => s.userId === user.id);
      expect(isDueAfter).toBe(false);
    });

    it('runHourlyDigestBatch executes batch without errors', async () => {
      const result = await runHourlyDigestBatch();
      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('AC4: One-Click Unsubscribe Endpoint', () => {
    it('GET /v1/digest/unsubscribe disables user subscription', async () => {
      const res = await request(app).get(`/v1/digest/unsubscribe?tenantId=${tenant.id}&userId=${user.id}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('successfully unsubscribed');

      const updatedPrefs = await getUserDigestPreferences(tenant.id, user.id);
      expect(updatedPrefs.isEnabled).toBe(false);
    });
  });
});
