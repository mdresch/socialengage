// Contract: Story 10.14 (ADR-0094, BRD-0094, FDD-0094) — AI Insights Digest & Scheduled Summaries (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-1014

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

describe('Story 10.14 — AI Insights Digest Contract', () => {
  const app = createApp();

  it('AC1/AC2: GET /v1/analytics/digest returns executive summary, sentiment breakdown, themes, and recommendations', async () => {
    const tenant = await createTenantFixture(`T-10.14-digest-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .get('/v1/analytics/digest?period=daily')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tenantId: tenant.id,
      period: 'daily',
      generatedAt: expect.any(String),
      executiveSummary: expect.any(String),
      sentimentBreakdown: expect.objectContaining({
        positivePct: expect.any(Number),
        neutralPct: expect.any(Number),
        negativePct: expect.any(Number),
        trend: expect.stringMatching(/improving|stable|declining/),
      }),
      topThemes: expect.any(Array),
      strategicRecommendations: expect.any(Array),
    });

    expect(res.body.topThemes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.strategicRecommendations.length).toBeGreaterThanOrEqual(1);
  });
});
