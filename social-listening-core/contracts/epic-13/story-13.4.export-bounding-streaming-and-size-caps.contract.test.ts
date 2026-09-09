/**
 * Contract: Story 13.4 (ADR-0111, BRD-0111, FDD-0111) — Export bounding, streaming, and size caps.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-134
 *
 * Intent:
 *   Enforce ADR-0111 resource guards on the posts export surface: synchronous CSV
 *   up to 5,000 rows, asynchronous CSV up to 100,000 rows and JSON up to 10,000 rows,
 *   per-tenant rate limits, Azure Blob lifecycle (7-day object, 24-hour presigned URL),
 *   and an `export_jobs` table that tracks status, format, row count, blob path,
 *   SHA-256, and expiry.
 *
 * Scope:
 *   - social-listening-core/src/posts/postExportEngine.ts
 *   - social-listening-core/src/http/versions/v1/postsExportRouter.ts
 *   - social-listening-core/src/archival/blobArchiveClient.ts
 *   - social-listening-core/src/posts/exportRateLimit.ts (new)
 *   - social-listening-core/.claude/skills/export-jobs/SKILL.md (new)
 *   - social-listening-core/.claude/skills/posts-csv-export/SKILL.md (update)
 *   - social-listening-core/migrations/0065_align_export_jobs_for_adr_0111.sql
 *
 * Contract to encode:
 *   (1) `export_jobs` tracks `status`, `format`, `row_count`, `blob_path`, `sha256`, and `expires_at`.
 *   (2) `GET /v1/posts/export.csv` returns a synchronous `text/csv` stream for `limit <= 5,000`.
 *   (3) `POST /v1/posts/export` creates an `export_jobs` row, returns `202 Accepted` with a job ID,
 *       and asynchronously streams the export to Azure Blob for `limit > 5,000` or `format='json'`.
 *   (4) Hard caps: CSV 100,000 rows, JSON 10,000 rows. `limit` outside [1, hardCap] returns
 *       `400 INVALID_LIMIT`; a matched set exceeding the cap returns `422 EXPORT_TOO_LARGE`.
 *   (5) `GET /v1/posts/exports/:id` tracks job status and `GET /v1/posts/exports/:id/download`
 *       returns a 24-hour presigned download URL.
 *   (6) Per-tenant rate limits: 60 sync/hour, 20 async/hour, 120 status/hour, 10 downloads/hour.
 *   (7) Blob objects carry metadata with a 7-day expiry.
 *
 * Explicitly out of scope:
 *   - Scheduled worker that hard-deletes expired blobs (ADR-0111's lifecycle is metadata-driven
 *     and enforced by a container policy, not a worker in this story).
 *   - Plan-configurable sync caps (open question in ADR-0111).
 *   - Changing the legacy `GET /v1/posts?format=csv` path (Story 3.16, ADR-0074).
 */

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

function setDefaultExportEnvs(): void {
  process.env.EXPORT_SYNC_ROW_LIMIT = '5000';
  process.env.EXPORT_ASYNC_CSV_MAX_ROWS = '100000';
  process.env.EXPORT_ASYNC_JSON_MAX_ROWS = '10000';
  process.env.EXPORT_RATE_SYNC_LIMIT = '60';
  process.env.EXPORT_RATE_ASYNC_LIMIT = '20';
  process.env.EXPORT_RATE_STATUS_LIMIT = '120';
  process.env.EXPORT_RATE_DOWNLOAD_LIMIT = '10';
  process.env.EXPORT_RATE_WINDOW_SECONDS = '3600';
  process.env.EXPORT_BLOB_LIFETIME_SECONDS = (7 * 24 * 60 * 60).toString();
  process.env.EXPORT_DOWNLOAD_URL_LIFETIME_SECONDS = (24 * 60 * 60).toString();
}

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

async function seedPost(
  tenantId: string,
  overrides: { body?: string; platform?: string; publishedAt?: string } = {}
) {
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
       COALESCE($3, now()),
       $4,
       $5
     )`,
    [
      tenantId,
      JSON.stringify({
        providerId: overrides.platform ?? 'twitter',
        externalId: `ext-${randomUUID()}`,
      }),
      overrides.publishedAt ?? null,
      overrides.body ?? `Exportable post content for ${tenantId}`,
      JSON.stringify({ sentiment: 'positive' }),
    ]
  );
}

async function getExportJobDirectly(jobId: string) {
  const { rows } = await getAdminPool().query(
    `SELECT * FROM export_jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0] ?? null;
}

async function pollForStatus(
  app: ReturnType<typeof createApp>,
  tenantId: string,
  userId: string,
  jobId: string,
  target: string,
  timeoutMs = 10000
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await request(app)
      .get(`/v1/posts/exports/${jobId}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }));
    if (res.status === 200 && res.body.status === target) {
      return res.body;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for export job ${jobId} to reach status ${target}`);
}

const app = createApp();

beforeEach(() => {
  setDefaultExportEnvs();
});

describe('Story 13.4 — Export bounding, streaming, and size caps', () => {
  it('AC1: export_jobs table tracks status, format, row_count, blob_path, sha256, and expiry', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac1-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPost(tenant.id, { platform: 'twitter' });

    const createRes = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 6000 });

    expect(createRes.status).toBe(202);
    expect(createRes.body).toMatchObject({
      jobId: expect.any(String),
      status: 'pending',
    });

    const status = await pollForStatus(app, tenant.id, user.id, createRes.body.jobId, 'ready');
    expect(status.status).toBe('ready');
    expect(status.rowCount).toBeGreaterThanOrEqual(1);

    const job = await getExportJobDirectly(createRes.body.jobId);
    expect(job).not.toBeNull();
    expect(job.format).toBe('csv');
    expect(job.row_count).toBeGreaterThanOrEqual(1);
    expect(typeof job.blob_path).toBe('string');
    expect(job.blob_path.length).toBeGreaterThan(0);
    expect(typeof job.sha256).toBe('string');
    expect(job.sha256.length).toBe(64);
    expect(job.expires_at).not.toBeNull();

    const expiresAt = new Date(job.expires_at).getTime();
    const nowPlus23h = Date.now() + 23 * 60 * 60 * 1000;
    const nowPlus25h = Date.now() + 25 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(nowPlus23h);
    expect(expiresAt).toBeLessThan(nowPlus25h);
  });

  it('AC2: GET /v1/posts/export.csv streams synchronous CSV up to 5,000 rows', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac2-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPost(tenant.id, { platform: 'linkedin' });
    await seedPost(tenant.id, { platform: 'linkedin' });

    const res = await request(app)
      .get('/v1/posts/export.csv?limit=2')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows
    expect(lines[0]).toContain('id');
    expect(res.text).toContain('linkedin');

    // Over the sync threshold, the CSV endpoint rejects rather than blocking the worker.
    const overSync = await request(app)
      .get('/v1/posts/export.csv?limit=5001')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));
    expect([202, 400]).toContain(overSync.status);
  });

  it('AC3: POST /v1/posts/export creates an async job and streams to Blob for limit > 5,000', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac3-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPost(tenant.id, { platform: 'gnews' });

    const createRes = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 5001 });

    expect(createRes.status).toBe(202);
    expect(createRes.body).toMatchObject({
      jobId: expect.any(String),
      status: 'pending',
    });

    const status = await pollForStatus(app, tenant.id, user.id, createRes.body.jobId, 'ready');
    expect(status.status).toBe('ready');
    expect(status.rowCount).toBe(1);

    const job = await getExportJobDirectly(createRes.body.jobId);
    expect(job.status).toBe('ready');
    expect(job.format).toBe('csv');
    expect(typeof job.blob_path).toBe('string');
    expect(typeof job.sha256).toBe('string');
  });

  it('AC4: hard caps return 400 INVALID_LIMIT or 422 EXPORT_TOO_LARGE', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac4-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const csvOver = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 100001 });
    expect(csvOver.status).toBe(400);
    expect(csvOver.body.code).toBe('INVALID_LIMIT');

    const jsonOver = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'json', limit: 10001 });
    expect(jsonOver.status).toBe(400);
    expect(jsonOver.body.code).toBe('INVALID_LIMIT');

    process.env.EXPORT_ASYNC_CSV_MAX_ROWS = '2';
    await seedPost(tenant.id, { platform: 'newswire' });
    await seedPost(tenant.id, { platform: 'newswire' });
    await seedPost(tenant.id, { platform: 'newswire' });

    const tooLarge = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 3 });
    expect(tooLarge.status).toBe(422);
    expect(tooLarge.body.code).toBe('EXPORT_TOO_LARGE');
  });

  it('AC5: status and download routes return job status and a 24h presigned URL', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac5-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPost(tenant.id, { platform: 'wikipedia' });

    const createRes = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 6000 });
    expect(createRes.status).toBe(202);
    const jobId = createRes.body.jobId;

    const status = await pollForStatus(app, tenant.id, user.id, jobId, 'ready');
    expect(status.jobId).toBe(jobId);
    expect(status.status).toBe('ready');
    expect(status.rowCount).toBeGreaterThanOrEqual(1);

    const downloadRes = await request(app)
      .get(`/v1/posts/exports/${jobId}/download`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }));

    expect(downloadRes.status).toBe(302);
    expect(downloadRes.headers.location).toMatch(/^https:\/\//);
    expect(downloadRes.headers.location).toMatch(/[?&](se|sig|sv)=/);
  });

  it('AC6: per-tenant rate limits are enforced', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac6-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // Sync cap
    process.env.EXPORT_RATE_SYNC_LIMIT = '2';
    const idSync = testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' });
    const sync1 = await request(app).get('/v1/posts/export.csv?limit=1').set('X-Test-Identity', idSync);
    expect(sync1.status).toBe(200);
    const sync2 = await request(app).get('/v1/posts/export.csv?limit=1').set('X-Test-Identity', idSync);
    expect(sync2.status).toBe(200);
    const sync3 = await request(app).get('/v1/posts/export.csv?limit=1').set('X-Test-Identity', idSync);
    expect(sync3.status).toBe(429);
    expect(sync3.body.code).toBe('EXPORT_RATE_LIMITED');

    // Async cap
    process.env.EXPORT_RATE_ASYNC_LIMIT = '1';
    const async1 = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', idSync)
      .send({ format: 'csv', limit: 6000 });
    expect(async1.status).toBe(202);
    const async2 = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', idSync)
      .send({ format: 'csv', limit: 6000 });
    expect(async2.status).toBe(429);
    expect(async2.body.code).toBe('EXPORT_RATE_LIMITED');

    const jobId = async1.body.jobId;

    // Status cap
    process.env.EXPORT_RATE_STATUS_LIMIT = '1';
    await request(app)
      .get(`/v1/posts/exports/${jobId}`)
      .set('X-Test-Identity', idSync);
    const status2 = await request(app)
      .get(`/v1/posts/exports/${jobId}`)
      .set('X-Test-Identity', idSync);
    expect(status2.status).toBe(429);
    expect(status2.body.code).toBe('EXPORT_RATE_LIMITED');

    // Download cap
    process.env.EXPORT_RATE_DOWNLOAD_LIMIT = '1';
    await request(app)
      .get(`/v1/posts/exports/${jobId}/download`)
      .set('X-Test-Identity', idSync);
    const download2 = await request(app)
      .get(`/v1/posts/exports/${jobId}/download`)
      .set('X-Test-Identity', idSync);
    expect(download2.status).toBe(429);
    expect(download2.body.code).toBe('EXPORT_RATE_LIMITED');
  });

  it('AC7: Blob objects carry metadata with a 7-day expiry', async () => {
    const tenant = await createTenantFixture(`T-13.4-ac7-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    await seedPost(tenant.id, { platform: 'facebook' });

    const createRes = await request(app)
      .post('/v1/posts/export')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_user' }))
      .send({ format: 'csv', limit: 6000 });
    expect(createRes.status).toBe(202);

    const status = await pollForStatus(app, tenant.id, user.id, createRes.body.jobId, 'ready');
    expect(status.status).toBe('ready');

    const job = await getExportJobDirectly(createRes.body.jobId);
    expect(typeof job.blob_path).toBe('string');

    // Verify the Blob metadata has a 7-day expiry via the production test helper.
    const blobArchiveClient = (await import('../../src/archival/blobArchiveClient')) as any;
    const metadata = await blobArchiveClient.__getExportBlobMetadataForTests(job.blob_path);
    expect(metadata).toMatchObject({
      blobPath: job.blob_path,
      expiresAt: expect.any(String),
    });

    const blobExpiresAt = new Date(metadata.expiresAt).getTime();
    const nowPlus6d = Date.now() + 6 * 24 * 60 * 60 * 1000;
    const nowPlus8d = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(blobExpiresAt).toBeGreaterThan(nowPlus6d);
    expect(blobExpiresAt).toBeLessThan(nowPlus8d);
  });
});
