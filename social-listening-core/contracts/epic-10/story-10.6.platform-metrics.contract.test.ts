// Contract: Story 10.6 (ADR-0089, BRD-0089, FDD-0089) — Platform Operations Telemetry (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-106

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

describe('Story 10.6 — Platform Operations Telemetry Contract', () => {
  const app = createApp();

  it('AC1/AC2: GET /v1/admin/platform-dashboard returns platform throughput, connector health, and cost telemetry', async () => {
    const tenant = await createTenantFixture(`T-10.6-ops-${randomUUID()}`);
    const admin = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com` });

    const res = await request(app)
      .get('/v1/admin/platform-dashboard')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: admin.id, role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      throughputPostsSec: expect.any(Number),
      avgIngestionLagSec: expect.any(Number),
      errorRateLast24hPct: expect.any(Number),
      totalTokensLast30d: expect.any(Number),
      estimatedCostLast30dUsd: expect.any(Number),
      connectors: expect.any(Array),
      timeSeries: expect.any(Array),
    });

    expect(res.body.connectors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.connectors[0]).toHaveProperty('platformId');
    expect(res.body.connectors[0]).toHaveProperty('status');
  });
});
