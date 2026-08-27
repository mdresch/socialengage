// Contract: Story 10.13 (ADR-0093, BRD-0093, FDD-0093) — YouTube Data API v3 Ingestion Connector (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-1013

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

describe('Story 10.13 — YouTube Connector Contract', () => {
  const app = createApp();

  it('AC1/AC2: Connect YouTube channel & get connector status with quota tracking', async () => {
    const tenant = await createTenantFixture(`T-10.13-yt-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // 1. Initial status -> disconnected
    const initialStatus = await request(app)
      .get('/v1/connectors/youtube/status')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(initialStatus.status).toBe(200);
    expect(initialStatus.body.isActive).toBe(false);
    expect(initialStatus.body.channelCount).toBe(0);

    // 2. Connect channel
    const connectRes = await request(app)
      .post('/v1/connectors/youtube/connect')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', channelTitle: 'Google Developers' });

    expect(connectRes.status).toBe(201);
    expect(connectRes.body.status).toBe('connected');

    // 3. Updated status -> active with quota tracking
    const updatedStatus = await request(app)
      .get('/v1/connectors/youtube/status')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(updatedStatus.status).toBe(200);
    expect(updatedStatus.body.isActive).toBe(true);
    expect(updatedStatus.body.channelCount).toBe(1);
    expect(updatedStatus.body.maxDailyQuota).toBe(10000);
    expect(updatedStatus.body.quotaUsedToday).toBeGreaterThanOrEqual(100);
  });
});
