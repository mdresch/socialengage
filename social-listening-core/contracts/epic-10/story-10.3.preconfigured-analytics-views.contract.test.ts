// Contract: Story 10.3 (ADR-0087, BRD-0087, FDD-0087) — Precomputed Daily Count Analytics Views (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-103

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { runDailyAggregatesRefresh } from '../../src/analytics/dailyAggregatesWorker';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedPostForTenant(tenantId: string, platformId: string, sentiment: string, publishedAt: string) {
  await getAdminPool().query(
    `INSERT INTO social_posts (
       tenant_id,
       raw_payload,
       published_at,
       body_markdown,
       enrichment
     ) VALUES (
       $1,
       $2,
       $3::timestamptz,
       'Test post markdown body',
       $4
     )`,
    [
      tenantId,
      JSON.stringify({ providerId: platformId, externalId: `ext-${randomUUID()}` }),
      publishedAt,
      JSON.stringify({ sentiment, modelUsed: 'azure-ai-language' }),
    ]
  );
}

describe('Story 10.3 — Precomputed Daily Count Analytics Views Contract', () => {
  const app = createApp();

  it('AC1: GET /v1/analytics/sources returns 200 with daily source aggregates', async () => {
    const tenant = await createTenantFixture(`T-10.3-sources-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const today = new Date().toISOString().slice(0, 10);
    await seedPostForTenant(tenant.id, 'twitter', 'positive', today + 'T10:00:00Z');
    await seedPostForTenant(tenant.id, 'twitter', 'negative', today + 'T11:00:00Z');
    await seedPostForTenant(tenant.id, 'linkedin', 'neutral', today + 'T12:00:00Z');

    await runDailyAggregatesRefresh();

    const res = await request(app)
      .get(`/v1/analytics/sources?start_date=${today}&end_date=${today}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('sources');
    expect(Array.isArray(res.body.rows)).toBe(true);

    const twitterRow = res.body.rows.find((r: any) => r.platform_id === 'twitter');
    expect(twitterRow).toBeDefined();
    expect(twitterRow.post_count).toBeGreaterThanOrEqual(2);
  });

  it('AC2: GET /v1/analytics/sentiments returns daily sentiment breakdown', async () => {
    const tenant = await createTenantFixture(`T-10.3-sentiments-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const today = new Date().toISOString().slice(0, 10);
    await seedPostForTenant(tenant.id, 'twitter', 'positive', today + 'T10:00:00Z');
    await seedPostForTenant(tenant.id, 'twitter', 'negative', today + 'T11:00:00Z');
    await seedPostForTenant(tenant.id, 'linkedin', 'neutral', today + 'T12:00:00Z');

    await runDailyAggregatesRefresh();

    const res = await request(app)
      .get(`/v1/analytics/sentiments?start_date=${today}&end_date=${today}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('sentiments');
    const positiveRow = res.body.rows.find((r: any) => r.sentiment === 'positive');
    expect(positiveRow).toBeDefined();
    expect(positiveRow.post_count).toBeGreaterThanOrEqual(1);
  });

  it('AC3: Cross-tenant isolation — tenant B cannot see tenant A data', async () => {
    const tenantA = await createTenantFixture(`T-10.3-tenantA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-10.3-tenantB-${randomUUID()}`);
    const userB = await createInvitedUser(tenantB.id, { email: `userB-${randomUUID()}@example.com` });

    const today = new Date().toISOString().slice(0, 10);
    await seedPostForTenant(tenantA.id, 'twitter', 'positive', today + 'T10:00:00Z');
    await runDailyAggregatesRefresh();

    const res = await request(app)
      .get(`/v1/analytics/sources?start_date=${today}&end_date=${today}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id, { userId: userB.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    const tenantBHasNoRows = res.body.rows.length === 0 || res.body.rows.every((r: any) => r.post_count === 0);
    expect(tenantBHasNoRows).toBe(true);
  });

  it('AC4: Invalid view name returns 400', async () => {
    const tenant = await createTenantFixture(`T-10.3-invalid-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .get('/v1/analytics/invalid-view-xyz')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid view');
  });
});
