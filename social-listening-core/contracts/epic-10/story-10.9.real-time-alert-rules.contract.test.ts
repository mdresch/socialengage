// Contract: Story 10.9 (ADR-0091, BRD-0091, FDD-0091) — Real-Time Alert Engine (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-109

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { triggerAlert } from '../../src/alerts/alertRulesStore';

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

describe('Story 10.9 — Real-Time Alert Rules and Inbox Contract', () => {
  const app = createApp();

  it('AC1/AC2/AC3: CRUD for alert rules and type validation', async () => {
    const tenant = await createTenantFixture(`T-10.9-rules-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // 1. Create rule
    const createRes = await request(app)
      .post('/v1/alerts/rules')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        name: 'Brand Viral Outcry Alert',
        type: 'negative_sentiment_spike',
        thresholds: { spike_pct: 60, min_posts: 10 },
        cooldown_minutes: 30,
        channels: ['in_app', 'email'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      id: expect.any(String),
      name: 'Brand Viral Outcry Alert',
      type: 'negative_sentiment_spike',
      cooldown_minutes: 30,
      enabled: true,
    });

    const ruleId = createRes.body.id;

    // 2. List rules
    const listRes = await request(app)
      .get('/v1/alerts/rules')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(listRes.status).toBe(200);
    expect(listRes.body.rules).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ruleId, name: 'Brand Viral Outcry Alert' })])
    );

    // 3. Update rule
    const updateRes = await request(app)
      .patch(`/v1/alerts/rules/${ruleId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ cooldown_minutes: 45 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.cooldown_minutes).toBe(45);

    // 4. Invalid type rejected
    const badTypeRes = await request(app)
      .post('/v1/alerts/rules')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ name: 'Bad', type: 'unknown_type' });

    expect(badTypeRes.status).toBe(400);
  });

  it('AC4/AC5: Alerts inbox lifecycle & cooldown enforcement', async () => {
    const tenant = await createTenantFixture(`T-10.9-inbox-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // Create rule with 60 min cooldown
    const ruleRes = await request(app)
      .post('/v1/alerts/rules')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        name: 'Critical Outage Alert',
        type: 'connector_error',
        cooldown_minutes: 60,
      });
    const ruleId = ruleRes.body.id;

    // Trigger alert 1
    const alert1 = await triggerAlert(
      tenant.id,
      ruleId,
      'critical',
      'Facebook Connector returned 500 error cascade',
      { error_count: 15 }
    );
    expect(alert1).toBeDefined();
    expect(alert1?.status).toBe('active');

    // Trigger alert 2 immediately -> should be suppressed by cooldown
    const alert2 = await triggerAlert(
      tenant.id,
      ruleId,
      'critical',
      'Facebook Connector returned 500 error cascade again'
    );
    expect(alert2).toBeNull(); // Suppressed

    // Check inbox
    const inboxRes = await request(app)
      .get('/v1/alerts/inbox?status=active')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(inboxRes.status).toBe(200);
    expect(inboxRes.body.alerts.length).toBe(1);
    expect(inboxRes.body.alerts[0].id).toBe(alert1!.id);

    // Acknowledge alert
    const ackRes = await request(app)
      .patch(`/v1/alerts/inbox/${alert1!.id}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ status: 'acknowledged' });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe('acknowledged');
    expect(ackRes.body.acknowledged_at).toBeDefined();
  });
});
