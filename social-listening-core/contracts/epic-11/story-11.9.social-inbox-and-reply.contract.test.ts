/**
 * Contract: Story 11.9 (ADR-0099, BRD-0099, FDD-0099) — Unified Social Inbox and Reply (Backend)
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-119--unified-social-inbox-and-reply-backend
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { withTenant } from '../../src/db/withTenant';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import {
  createInboxItem,
  deriveInboxPriority,
  autoResolveRedactedPostItems,
} from '../../src/inbox/inboxItemStore';

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

describe('Story 11.9 — Unified Social Inbox and Reply (Backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;
  let testPostId: string;

  beforeAll(async () => {
    bootstrapConnectors();
    tenant = await createTenantFixture(`Tenant Inbox ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `agent-${Date.now()}@example.com`,
    });
    app = createApp();

    // Create a mock social post for inbox testing
    testPostId = randomUUID();
    await withTenant(tenant.id, async (client) => {
      await client.query(
        `INSERT INTO social_posts (
          id, tenant_id, raw_payload, published_at, created_at
        ) VALUES ($1, $2, '{"content":"Great update on SocialEngage!","platformId":"linkedin"}', now(), now())`,
        [testPostId, tenant.id]
      );
    });
  });

  describe('AC1 & AC5: Inbox Item Creation & Priority Derivation', () => {
    it('derives priority correctly from sentiment and reach rules', () => {
      expect(deriveInboxPriority('negative', 60000)).toBe('urgent');
      expect(deriveInboxPriority('negative', 5000)).toBe('high');
      expect(deriveInboxPriority('positive', 20000)).toBe('high');
      expect(deriveInboxPriority('positive', 5000)).toBe('normal');
    });

    it('POST /v1/inbox creates an inbox item with calculated priority', async () => {
      const res = await request(app)
        .post('/v1/inbox')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({
          postId: testPostId,
          providerId: 'linkedin',
          sentiment: 'negative',
          reach: 80000,
          notes: 'Customer escalation',
          tags: ['escalation', 'vip'],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.priority).toBe('urgent');
      expect(res.body.status).toBe('open');
      expect(res.body.tags).toEqual(['escalation', 'vip']);
    });
  });

  describe('AC2: GET /v1/inbox with Filtering & Priority Sorting', () => {
    it('returns triage items sorted by priority and respects status filter', async () => {
      const res = await request(app)
        .get('/v1/inbox?status=open')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.items[0].priority).toBe('urgent');
    });
  });

  describe('AC3: Status Transitions (Assign, Snooze, Resolve)', () => {
    let inboxItemId: string;

    beforeAll(async () => {
      const item = await createInboxItem(tenant.id, {
        postId: testPostId,
        providerId: 'linkedin',
        priority: 'normal',
      });
      inboxItemId = item.id;
    });

    it('POST /v1/inbox/:id/assign assigns item to user and updates status', async () => {
      const res = await request(app)
        .post(`/v1/inbox/${inboxItemId}/assign`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({ assignedTo: user.id });

      expect(res.status).toBe(200);
      expect(res.body.assignedTo).toBe(user.id);
      expect(res.body.status).toBe('assigned');
    });

    it('POST /v1/inbox/:id/snooze snoozes item until given timestamp', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const res = await request(app)
        .post(`/v1/inbox/${inboxItemId}/snooze`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({ snoozedUntil: futureTime });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('snoozed');
      expect(res.body.snoozedUntil).toBe(futureTime);
    });

    it('POST /v1/inbox/:id/resolve resolves item', async () => {
      const res = await request(app)
        .post(`/v1/inbox/${inboxItemId}/resolve`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({ notes: 'Handled via chat' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
    });
  });

  describe('AC4: POST /v1/inbox/:id/reply and Auto-Resolution', () => {
    it('executes reply, records outbound activity, and marks item resolved', async () => {
      const item = await createInboxItem(tenant.id, {
        postId: testPostId,
        providerId: 'linkedin',
        priority: 'high',
      });

      const res = await request(app)
        .post(`/v1/inbox/${item.id}/reply`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }))
        .send({ body: 'Thanks for reaching out! We are on it.' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');
      expect(res.body.activityId).toBeDefined();

      // Check item status in database
      const checkRes = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.status).toBe('resolved');
    });
  });

  describe('AC6: Redaction Auto-Resolution', () => {
    it('autoResolveRedactedPostItems marks open items resolved with notes=redacted', async () => {
      const item = await createInboxItem(tenant.id, {
        postId: testPostId,
        providerId: 'linkedin',
        priority: 'high',
      });

      const count = await autoResolveRedactedPostItems(tenant.id, testPostId);
      expect(count).toBeGreaterThanOrEqual(1);

      const checkRes = await request(app)
        .get(`/v1/inbox/${item.id}`)
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(checkRes.body.status).toBe('resolved');
      expect(checkRes.body.notes).toBe('redacted');
    });
  });
});
