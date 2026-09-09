// Contract: Story 10.11 (ADR-0092, BRD-0092, FDD-0092) — Webhook Notification Dispatcher (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-1011

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';

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

describe('Story 10.11 — Webhook Notification Dispatcher Contract', () => {
  const app = createApp();

  it('AC1/AC2: CRUD for webhook subscriptions & test ping signature dispatch', async () => {
    const tenant = await createTenantFixture(`T-10.11-webhooks-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // 1. Create subscription
    const createRes = await request(app)
      .post('/v1/webhooks/subscriptions')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        url: 'https://webhook.site/test-endpoint',
        events: ['alert.triggered', 'test.ping'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      id: expect.any(String),
      url: 'https://webhook.site/test-endpoint',
      events: ['alert.triggered', 'test.ping'],
      enabled: true,
    });

    const subId = createRes.body.id;

    // 2. List subscriptions
    const listRes = await request(app)
      .get('/v1/webhooks/subscriptions')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(listRes.status).toBe(200);
    expect(listRes.body.subscriptions.length).toBe(1);

    // 3. Test ping dispatch
    const testRes = await request(app)
      .post(`/v1/webhooks/subscriptions/${subId}/test`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(testRes.status).toBe(200);
    expect(testRes.body.success).toBe(true);
    expect(testRes.body.results[0]).toHaveProperty('signature');
    expect(typeof testRes.body.results[0].signature).toBe('string');

    // 4. Delete subscription
    const delRes = await request(app)
      .delete(`/v1/webhooks/subscriptions/${subId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(delRes.status).toBe(204);
  });
});
