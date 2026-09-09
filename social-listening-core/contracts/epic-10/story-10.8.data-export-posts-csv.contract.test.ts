// Contract: Story 10.8 (ADR-0090, BRD-0090, FDD-0090) — Posts Data Export (Backend)
// See docs/user-stories/epic-10-adr-0086-to-0094.md#story-108

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { drainActiveExportJobs } from '../../src/posts/postExportEngine';

jest.setTimeout(30000);

afterAll(async () => {
  await drainActiveExportJobs();
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

async function seedPostForTenant(tenantId: string, platformId: string) {
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
       now(),
       'Exportable post with "quoted", comma, and special text',
       '{"sentiment": "positive"}'
     )`,
    [
      tenantId,
      JSON.stringify({ providerId: platformId, externalId: `ext-${randomUUID()}` }),
    ]
  );
}

describe('Story 10.8 — Posts Data Export Contract', () => {
  const app = createApp();

  it('AC1: GET /v1/posts/export.csv returns synchronous streaming CSV with escaped content', async () => {
    const tenant = await createTenantFixture(`T-10.8-sync-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPostForTenant(tenant.id, 'twitter');

    const res = await request(app)
      .get('/v1/posts/export.csv')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('id,published_at,platform,sentiment,author_followers,content');
    expect(res.text).toContain('twitter');
    expect(res.text).toContain('"Exportable post with ""quoted"", comma, and special text"');
  });

  it('AC2/AC3: POST /v1/posts/export creates async export job, GET /v1/exports/:jobId/status tracks status', async () => {
    const tenant = await createTenantFixture(`T-10.8-async-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPostForTenant(tenant.id, 'linkedin');

    // 1. Create async export job
    const createRes = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ filters: { platformId: 'linkedin' } });

    expect(createRes.status).toBe(202);
    expect(createRes.body).toMatchObject({
      jobId: expect.any(String),
      status: 'pending',
      expiresAt: expect.any(String),
      statusUrl: expect.stringContaining('/v1/exports/'),
    });

    const jobId = createRes.body.jobId;

    // 2. Poll job status
    // Wait slightly for async simulation
    await new Promise((r) => setTimeout(r, 100));

    const statusRes = await request(app)
      .get(`/v1/exports/${jobId}/status`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.jobId).toBe(jobId);
    expect(['pending', 'processing', 'completed']).toContain(statusRes.body.status);
  });
});
