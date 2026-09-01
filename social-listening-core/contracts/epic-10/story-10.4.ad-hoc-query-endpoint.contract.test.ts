// Contract: Story 10.4 (ADR-0088, BRD-0088, FDD-0088) — Ad-Hoc Analytics Query Engine (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-104

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';

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
       'Test post body',
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

describe('Story 10.4 — Ad-Hoc Analytics Parameterized Query Engine Contract', () => {
  const app = createApp();

  it('AC1/AC2: POST /v1/analytics/query returns multi-dimensional aggregations in JSON format', async () => {
    const tenant = await createTenantFixture(`T-10.4-query-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const today = new Date().toISOString().slice(0, 10);
    await seedPostForTenant(tenant.id, 'twitter', 'positive', today + 'T10:00:00Z');
    await seedPostForTenant(tenant.id, 'twitter', 'negative', today + 'T11:00:00Z');
    await seedPostForTenant(tenant.id, 'linkedin', 'positive', today + 'T12:00:00Z');

    const res = await request(app)
      .post('/v1/analytics/query')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        dimensions: ['platform', 'sentiment'],
        metrics: ['post_count', 'positive_count', 'negative_count'],
        filters: {
          startDate: today + 'T00:00:00Z',
          endDate: today + 'T23:59:59Z',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      dimensions: ['platform', 'sentiment'],
      metrics: ['post_count', 'positive_count', 'negative_count'],
      rowCount: expect.any(Number),
      executionTimeMs: expect.any(Number),
      data: expect.any(Array),
    });
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('AC3: Supports format=csv with text/csv content type', async () => {
    const tenant = await createTenantFixture(`T-10.4-csv-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const today = new Date().toISOString().slice(0, 10);
    await seedPostForTenant(tenant.id, 'twitter', 'positive', today + 'T10:00:00Z');

    const res = await request(app)
      .post('/v1/analytics/query')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        dimensions: ['platform'],
        metrics: ['post_count'],
        format: 'csv',
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('platform,post_count');
    expect(res.text).toContain('twitter,1');
  });

  it('AC4: Invalid dimension or metric rejects with 400', async () => {
    const tenant = await createTenantFixture(`T-10.4-bad-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/analytics/query')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({
        dimensions: ['drop_table_users_exploit' as any],
        metrics: ['post_count'],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid dimension');
  });
});
