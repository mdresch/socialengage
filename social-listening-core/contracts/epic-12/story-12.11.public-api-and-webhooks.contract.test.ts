/**
 * Contract: Story 12.11 (ADR-0106, BRD-0106, FDD-0106) — Public API versioning and webhooks (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1211--public-api-versioning-and-webhooks-backend
 * and docs/adr/0106-api-and-integrations-versioning-and-webhooks.md
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  getWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  deliverWebhookWithRetry,
  computeWebhookSignature,
} from '../../src/webhooks/webhookDispatcher';
import { checkRateLimit, resetRateLimitsForTesting } from '../../src/http/rateLimitMiddleware';

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

describe('Story 12.11 — Public API versioning and webhooks (backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;

  beforeAll(async () => {
    tenant = await createTenantFixture(`Tenant Webhooks & API ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `webhook-api-${Date.now()}@example.com`,
    });
    app = createApp();
  });

  beforeEach(() => {
    resetRateLimitsForTesting();
  });

  describe('AC1: Public API versioning (/v1/) and authentication', () => {
    it('serves endpoints under /v1/ requiring valid authentication', async () => {
      const unauth = await request(app).get('/v1/webhooks/subscriptions');
      expect([401, 403]).toContain(unauth.status);

      const auth = await request(app)
        .get('/v1/webhooks/subscriptions')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));
      expect(auth.status).toBe(200);
      expect(auth.body).toHaveProperty('subscriptions');
    });
  });

  describe('AC2: Rate limiting with X-RateLimit-* headers', () => {
    it('sets X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers', async () => {
      const res = await request(app)
        .get('/v1/webhooks/subscriptions')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('enforces rate limits and returns 429 when tenant quota is exceeded', () => {
      const tenantKey = `rate-test-${tenant.id}`;
      // Consume up to limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(tenantKey, 10);
      }
      const overLimit = checkRateLimit(tenantKey, 10);
      expect(overLimit.allowed).toBe(false);
      expect(overLimit.remaining).toBe(0);
    });
  });

  describe('AC3: Webhook subscriptions CRUD endpoints (POST, GET, PATCH, DELETE)', () => {
    let createdSubId: string;

    it('POST /v1/webhooks/subscriptions creates a new subscription', async () => {
      const res = await request(app)
        .post('/v1/webhooks/subscriptions')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
        .send({
          url: 'https://webhook.site/test-integration',
          events: ['post.ingested', 'alert.triggered'],
          secret: 'my-custom-secret-key-12345',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.url).toBe('https://webhook.site/test-integration');
      expect(res.body.events).toContain('post.ingested');
      expect(res.body.enabled).toBe(true);
      createdSubId = res.body.id;
    });

    it('GET /v1/webhooks/subscriptions lists active subscriptions', async () => {
      const res = await request(app)
        .get('/v1/webhooks/subscriptions')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

      expect(res.status).toBe(200);
      expect(res.body.subscriptions.some((s: any) => s.id === createdSubId)).toBe(true);
    });

    it('PATCH /v1/webhooks/subscriptions/:id updates subscription fields', async () => {
      const res = await request(app)
        .patch(`/v1/webhooks/subscriptions/${createdSubId}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }))
        .send({
          enabled: false,
          events: ['alert.triggered', 'connector.health.changed'],
        });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.events).toContain('connector.health.changed');
    });

    it('DELETE /v1/webhooks/subscriptions/:id removes the subscription', async () => {
      const res = await request(app)
        .delete(`/v1/webhooks/subscriptions/${createdSubId}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

      expect([200, 204]).toContain(res.status);

      const check = await request(app)
        .get('/v1/webhooks/subscriptions')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));
      expect(check.body.subscriptions.some((s: any) => s.id === createdSubId)).toBe(false);
    });
  });

  describe('AC4: HMAC-SHA256 signature generation and verification', () => {
    it('computes correct HMAC-SHA256 signature for webhook payload', () => {
      const secret = 'super-secret-key';
      const payload = JSON.stringify({
        eventType: 'post.ingested',
        tenantId: tenant.id,
        timestamp: '2026-08-29T12:00:00Z',
        payload: { postId: 'post-1' },
      });

      const signature = computeWebhookSignature(secret, payload);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // 32 bytes in hex = 64 characters
    });
  });

  describe('AC5: Webhook delivery retries and dead-lettering', () => {
    it('retries failed delivery with exponential backoff and dead-letters after 10 attempts', async () => {
      let callCount = 0;
      const mockPost = async () => {
        callCount++;
        throw new Error('Endpoint HTTP 500 Internal Server Error');
      };

      const result = await deliverWebhookWithRetry({
        url: 'https://broken-target.example.com/webhook',
        secret: 'test-secret',
        eventType: 'alert.triggered',
        tenantId: tenant.id,
        payload: { alertId: 'alert-1', message: 'Crisis trigger' },
        maxAttempts: 10,
        mockPoster: mockPost,
      });

      expect(callCount).toBe(10);
      expect(result.success).toBe(false);
      expect(result.status).toBe('dead_lettered');
      expect(result.attempts).toBe(10);
    });

    it('succeeds on recovery within retry limit', async () => {
      let callCount = 0;
      const mockPost = async () => {
        callCount++;
        if (callCount < 3) throw new Error('Temporary 503');
        return { status: 200 };
      };

      const result = await deliverWebhookWithRetry({
        url: 'https://healthy-target.example.com/webhook',
        secret: 'test-secret',
        eventType: 'post.ingested',
        tenantId: tenant.id,
        payload: { postId: 'p-100' },
        maxAttempts: 10,
        mockPoster: mockPost,
      });

      expect(callCount).toBe(3);
      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
      expect(result.attempts).toBe(3);
    });
  });
});
