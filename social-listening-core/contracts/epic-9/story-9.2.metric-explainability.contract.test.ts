// Contract: Story 9.2 (ADR-0078, BRD-0078, FDD-0078) — Metric Explainability Endpoint (Backend)
// See docs/user-stories/epic-9-adr-0077-to-0085.md#story-92

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

/** Helper: create a real tenant via platform_admin_role pool for test fixtures. */
async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 9.2 — Metric Explainability Contract (POST /v1/explain)', () => {
  const app = createApp();

  it('AC2: Unknown metricKey returns 400 UNKNOWN_METRIC_KEY', async () => {
    const tenant = await createTenantFixture(`T-9.2-unk-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'unknown-fabricated-metric',
        value: 42,
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_METRIC_KEY');
  });

  it('AC3: String values not matching /^[a-z0-9-]+$/ are rejected with 400 BAD_REQUEST', async () => {
    const tenant = await createTenantFixture(`T-9.2-sec-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'volume-spike',
        value: 'DROP TABLE posts; -- injection',
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('AC5: Deterministic confidence scoring correctly computes high vs medium confidence', async () => {
    const tenant = await createTenantFixture(`T-9.2-conf-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    // 1. High confidence: value, timeRange, previousValue, and denominator >= 100
    const resHigh = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'sentiment-share',
        value: 0.65,
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
          previousValue: 0.50,
          denominator: 500,
        },
      });

    expect(resHigh.status).toBe(200);
    expect(resHigh.body.confidence).toBe('high');
    expect(resHigh.body.explanation).toBeTruthy();

    // 2. Medium confidence: previousValue omitted
    const resMedium = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'sentiment-share',
        value: 0.65,
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        },
      });

    expect(resMedium.status).toBe(200);
    expect(resMedium.body.confidence).toBe('medium');
  });

  it('AC8: explanations_enabled = false returns 403 EXPLAINABILITY_DISABLED kill switch', async () => {
    const tenant = await createTenantFixture(`T-9.2-kill-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    // Disable explanations for tenant via withTenant
    await withTenant(tenant.id, async (client) => {
      await client.query(
        `UPDATE tenants SET explanations_enabled = false WHERE id = $1`,
        [tenant.id]
      );
    });

    const res = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'volume-spike',
        value: 120,
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXPLAINABILITY_DISABLED');
  });

  it('AC9: 5-minute in-process cache returns cached explanation with same generationId', async () => {
    const tenant = await createTenantFixture(`T-9.2-cache-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `u-${randomUUID()}@example.com` });

    const payload = {
      metricKey: 'platform-mix',
      value: 85,
      context: {
        timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        previousValue: 70,
      },
    };

    const firstRes = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send(payload);

    expect(firstRes.status).toBe(200);
    const genId1 = firstRes.body.generationId;

    const secondRes = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send(payload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.generationId).toBe(genId1);
  });

  it('AC7: User token bucket enforces max 20 requests per minute', async () => {
    const tenant = await createTenantFixture(`T-9.2-rate-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `rate-${randomUUID()}@example.com` });

    // Send 20 requests with unique values to bypass in-memory cache
    for (let i = 0; i < 20; i++) {
      await request(app)
        .post('/v1/explain')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          metricKey: 'volume-spike',
          value: i + 1,
          context: {
            timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
          },
        });
    }

    // 21st request should be rate-limited (429)
    const rateLimitedRes = await request(app)
      .post('/v1/explain')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        metricKey: 'volume-spike',
        value: 999,
        context: {
          timeRange: { start: '2026-08-01T00:00:00Z', end: '2026-08-07T00:00:00Z' },
        },
      });

    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.body.code).toBe('TOO_MANY_REQUESTS');
  });
});
