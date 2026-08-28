/**
 * Contract: Story 11.7 (ADR-0098, BRD-0098, FDD-0098) — Outbound Publishing and Scheduling (Backend)
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-117--publishing-and-scheduling-backend
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { withTenant } from '../../src/db/withTenant';
import { runScheduledPublishBatch } from '../../src/publishing/outboundPublishScheduler';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';

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

describe('Story 11.7 — Publishing and Scheduling (Backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;

  beforeAll(async () => {
    bootstrapConnectors();
    tenant = await createTenantFixture(`Tenant Publishing ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `publisher-${Date.now()}@example.com`,
    });
    app = createApp();
  });

  describe('AC1: POST /v1/outbound/posts immediate dispatch', () => {
    it('creates immediate activity and returns 202 Accepted with activityIds', async () => {
      const res = await request(app)
        .post('/v1/outbound/posts')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Excited to announce our major quarterly product update!',
          targetPlatforms: ['linkedin'],
          assetTargets: { linkedin: 'urn:li:organization:123456' },
        });

      expect(res.status).toBe(202);
      expect(Array.isArray(res.body.activityIds)).toBe(true);
      expect(res.body.activityIds.length).toBe(1);
      expect(res.body.scheduledFor).toBeNull();
    });
  });

  describe('AC2: Asset Target Validation', () => {
    it('returns 400 MISSING_ASSET_TARGET when required asset target is omitted for platform', async () => {
      const res = await request(app)
        .post('/v1/outbound/posts')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Missing asset target post',
          targetPlatforms: ['facebook'],
          // omitted assetTargets for facebook
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_ASSET_TARGET');
    });
  });

  describe('AC3: Scheduling and Queue Management', () => {
    let scheduledActivityId: string;
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    it('creates scheduled post with 202 Accepted and scheduledFor timestamp', async () => {
      const res = await request(app)
        .post('/v1/outbound/posts')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          text: 'Scheduled morning product announcement',
          targetPlatforms: ['linkedin'],
          assetTargets: { linkedin: 'urn:li:organization:123456' },
          scheduledFor: futureDate,
        });

      expect(res.status).toBe(202);
      expect(res.body.activityIds.length).toBe(1);
      expect(res.body.scheduledFor).toBe(futureDate);
      scheduledActivityId = res.body.activityIds[0];
    });

    it('PATCH /v1/outbound/activities/:id/reschedule updates scheduled timestamp', async () => {
      const newFutureDate = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .patch(`/v1/outbound/activities/${scheduledActivityId}/reschedule`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({ scheduledFor: newFutureDate });

      expect(res.status).toBe(200);
      expect(res.body.scheduledFor).toBe(newFutureDate);
      expect(res.body.status).toBe('scheduled');
    });

    it('PATCH /v1/outbound/activities/:id/cancel cancels scheduled post', async () => {
      const res = await request(app)
        .patch(`/v1/outbound/activities/${scheduledActivityId}/cancel`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancelledAt).not.toBeNull();
    });
  });

  describe('AC4: Target Asset Discovery Endpoint', () => {
    it('GET /v1/connectors/:platformId/targets returns available pages/accounts', async () => {
      const res = await request(app)
        .get('/v1/connectors/linkedin/targets')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(res.body.platformId).toBe('linkedin');
      expect(Array.isArray(res.body.targets)).toBe(true);
      expect(res.body.targets.length).toBeGreaterThan(0);
      expect(res.body.targets[0]).toHaveProperty('id');
      expect(res.body.targets[0]).toHaveProperty('name');
    });
  });

  describe('AC5: Background Scheduler Worker', () => {
    it('runScheduledPublishBatch processes due scheduled posts without throwing', async () => {
      // Seed a due scheduled post in the past
      await withTenant(tenant.id, async (client) => {
        await client.query(
          `INSERT INTO outbound_activities (
            tenant_id, user_id, provider_id, activity_type,
            body, status, scheduled_for, created_at
          ) VALUES ($1, $2, 'linkedin', 'post', 'Batch scheduled post', 'scheduled', now() - INTERVAL '5 minutes', now())`,
          [tenant.id, user.id]
        );
      });

      const batchResult = await runScheduledPublishBatch();
      expect(batchResult.processedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
