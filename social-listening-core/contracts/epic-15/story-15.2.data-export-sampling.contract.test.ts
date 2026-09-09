// Contract: Story 15.2 (ADR-0124, BRD-0124, FDD-0124, TDS-0124) — Posts CSV Sampling and Bounded Lookback
// See docs/user-stories/epic-15-adr-0123-to-0124.md#story-152

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { drainActiveExportJobs } from '../../src/posts/postExportEngine';

jest.setTimeout(30000);

afterAll(async () => {
  await drainActiveExportJobs();
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedPostForTenant(
  tenantId: string,
  overrides: {
    publishedAt?: string;
    content?: string;
    platformId?: string;
    sentiment?: string;
  } = {}
) {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO social_posts (
       tenant_id,
       raw_payload,
       published_at,
       body_markdown,
       enrichment
     ) VALUES (
       $1,
       $2,
       COALESCE($3::timestamptz, now()),
       $4,
       $5
     ) RETURNING id`,
    [
      tenantId,
      JSON.stringify({ providerId: overrides.platformId ?? 'twitter', externalId: `ext-${randomUUID()}` }),
      overrides.publishedAt ?? null,
      overrides.content ?? `Post content ${randomUUID()}`,
      JSON.stringify({ sentiment: overrides.sentiment ?? 'positive' }),
    ]
  );
  return rows[0].id;
}

describe('Story 15.2 — Data Export Lookback Bounding and Representative Sampling Contract', () => {
  const app = createApp();

  describe('AC1: Maximum Lookback Date Range Validation', () => {
    it('rejects date range exceeding 24 months with 400 EXPORT_RANGE_TOO_LARGE', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac1-range-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .query({
          start: '2023-01-01T00:00:00Z',
          end: '2026-01-01T00:00:00Z',
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        code: 'EXPORT_RANGE_TOO_LARGE',
        maxLookbackMonths: 24,
      });
      expect(res.body.message).toContain('24 months');
    });

    it('rejects date range exceeding 24 months in async export POST /v1/posts/export', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac1-async-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      const res = await request(app)
        .post('/v1/posts/export')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .send({
          format: 'csv',
          limit: 1000,
          filters: {
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2026-01-01T00:00:00Z',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        code: 'EXPORT_RANGE_TOO_LARGE',
        maxLookbackMonths: 24,
      });
    });

    it('rejects invalid date formats with 400 INVALID_DATE_FORMAT', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac1-invalid-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .query({ start: 'not-a-valid-date' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE_FORMAT');
    });

    it('accepts valid date range within 24 months', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac1-valid-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      await seedPostForTenant(tenant.id, {
        publishedAt: '2025-06-01T12:00:00Z',
        content: 'Post inside 24m range',
      });

      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .query({
          start: '2025-01-01T00:00:00Z',
          end: '2026-01-01T00:00:00Z',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Post inside 24m range');
    });
  });

  describe('AC2: Opt-In Systematic Stride Sampling (sample=true)', () => {
    it('returns representative systematic sample with headers and in-file metadata when matched > limit', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac2-sampling-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      // Seed 20 posts chronologically spaced out
      for (let i = 1; i <= 20; i++) {
        const day = String(i).padStart(2, '0');
        await seedPostForTenant(tenant.id, {
          publishedAt: `2026-08-${day}T12:00:00Z`,
          content: `Sampled post item ${i}`,
        });
      }

      // Request sample=true with limit=5 (stride = floor(20 / 5) = 4)
      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .query({
          sample: 'true',
          limit: 5,
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('posts-export-sample-');

      // Transparent response headers
      expect(res.headers['x-socialengage-sampled']).toBe('true');
      expect(res.headers['x-socialengage-sample-fraction']).toBe('0.25');
      expect(res.headers['x-socialengage-total-matched']).toBe('20');

      // In-file metadata and CSV row verification
      const lines = res.text.trim().split('\n');
      expect(lines[0]).toBe('# socialengage_export: sampled=true; sample_fraction=0.25; total_matched=20; sample_size=5');
      expect(lines[1]).toBe('id,published_at,platform,sentiment,author_followers,content');

      // Exactly 5 data rows
      const dataRows = lines.slice(2);
      expect(dataRows.length).toBe(5);

      expect(res.text).toContain('Sampled post item');
    });
  });

  describe('AC3: Non-Sampled Path When Matched Set <= Limit', () => {
    it('returns full dataset without sampled header when matched <= limit', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac3-small-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      await seedPostForTenant(tenant.id, { content: 'Small result 1' });
      await seedPostForTenant(tenant.id, { content: 'Small result 2' });
      await seedPostForTenant(tenant.id, { content: 'Small result 3' });

      // Request sample=true with limit=10 (matched 3 <= 10)
      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
        .query({
          sample: 'true',
          limit: 10,
        });

      expect(res.status).toBe(200);
      expect(res.headers['x-socialengage-sampled']).toBeUndefined();

      const lines = res.text.trim().split('\n');
      expect(lines[0]).toContain('# socialengage_export: sampled=false; sample_fraction=1.0; total_matched=3; sample_size=3');
      expect(lines[1]).toBe('id,published_at,platform,sentiment,author_followers,content');

      const dataRows = lines.slice(2);
      expect(dataRows.length).toBe(3);
    });
  });

  describe('AC4: Default Path (sample=false or omitted)', () => {
    it('returns standard CSV without sampling metadata line when sample is false or omitted', async () => {
      const tenant = await createTenantFixture(`T-15.2-ac4-default-${randomUUID()}`);
      const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

      await seedPostForTenant(tenant.id, { content: 'Standard export post' });

      const res = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.headers['x-socialengage-sampled']).toBeUndefined();

      // Directly starts with CSV header, no metadata comment row
      expect(res.text.startsWith('id,published_at,platform,sentiment,author_followers,content')).toBe(true);
      expect(res.text).not.toContain('# socialengage_export:');
      expect(res.text).toContain('Standard export post');
    });
  });

  describe('AC5: Tenant Isolation Invariant', () => {
    it('enforces strict tenant isolation during count, stride, and sampling queries', async () => {
      const tenantA = await createTenantFixture(`T-15.2-ac5-tenantA-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-15.2-ac5-tenantB-${randomUUID()}`);
      const userA = await createInvitedUser(tenantA.id, { email: `userA-${randomUUID()}@example.com` });

      // Seed 10 posts for Tenant A and 10 posts for Tenant B
      for (let i = 1; i <= 10; i++) {
        await seedPostForTenant(tenantA.id, { content: `Tenant A post ${i}` });
        await seedPostForTenant(tenantB.id, { content: `Tenant B post ${i}` });
      }

      // Request sampled export for Tenant A
      const resA = await request(app)
        .get('/v1/posts/export.csv')
        .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id, { userId: userA.id, role: 'tenant_user' }))
        .query({
          sample: 'true',
          limit: 5,
        });

      expect(resA.status).toBe(200);
      expect(resA.headers['x-socialengage-total-matched']).toBe('10');
      expect(resA.headers['x-socialengage-sample-fraction']).toBe('0.5');

      // Tenant B's data is never returned to Tenant A
      expect(resA.text).toContain('Tenant A post');
      expect(resA.text).not.toContain('Tenant B post');
    });
  });
});
