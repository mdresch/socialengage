// Contract: Story 3.16 (ADR-0074) — tenant-facing workspace and matched-posts
// export endpoints.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-316--tenant-facing-workspace-and-matched-posts-export-endpoints
//
// Intent: Story 3.16 — let a tenant_admin download a full, safe-metadata JSON
// archive of their own tenant workspace and let both tenant_admin and
// tenant_user download the same matched posts they already see as a flat CSV,
// without going through the deletion/offboarding flow. No platform_admin may
// access either endpoint; no credential secrets, raw payloads, or OAuth tokens
// may leak; and both exports are bounded with an explicit `EXPORT_TOO_LARGE`
// code.
//
// Scope: src/tenants/tenantExportStore.ts (new), src/http/versions/v1/tenantExportRouter.ts
// (new), src/posts/csvExport.ts (new), src/posts/socialPostStore.ts
// (exportSocialPostsCsv), src/http/versions/v1/postsRouter.ts (?format=csv),
// src/http/versions/v1/router.ts (mount), .claude/skills/tenant-export/SKILL.md
// (new), .claude/skills/posts-api/SKILL.md (update).
//
// Contract to encode, per AC:
// (1) GET /v1/tenants/me/export/workspace returns 200 with the caller's own
//     tenant metadata for a tenant_admin identity;
// (2) the workspace JSON includes the expected tables and excludes credential
//     secret-bearing columns (ciphertext, wrapped_dek, iv, auth_tag,
//     key_vault_key_id);
// (3/4) GET /v1/posts?format=csv returns the same rows as the JSON endpoint for
//     the same filters, with a UTF-8 BOM, RFC 4180-ish quoting, and a header
//     row, honoring watchlistId;
// (5) both endpoints return 413 with code `EXPORT_TOO_LARGE` when their
//     respective caps (workspace size, CSV row count) are exceeded;
// (6) a tenant_user gets 403 on the workspace export and a platform_admin gets
//     403 on both exports.
//
// Explicitly out of scope: async background export to Azure Blob Storage;
// one-row-per-match "exploded" CSV expansion; client-side CSV generation;
// editing/deleting data through the export endpoint; `lucide-react` or other
// UI styling.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';

jest.setTimeout(60000);

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

describe('Story 3.16 — tenant-facing workspace and matched-posts exports', () => {
  const app = createApp();

  async function createTenantWithAdmin(): Promise<{
    tenantId: string;
    adminUserId: string;
    adminHeader: string;
  }> {
    const adminId = randomUUID();
    const createRes = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `Story 3.16 test tenant ${randomUUID()}`, licenseSeatCount: 10 });
    expect(createRes.status).toBe(201);
    const tenantId = createRes.body.id as string;
    const adminUserId = randomUUID();
    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO users (id, tenant_id, email, role, status) VALUES ($1, $2, $3, 'tenant_admin', 'active')`,
        [adminUserId, tenantId, `admin-${adminUserId}@example.com`]
      );
    });
    const adminHeader = testIdentityHeaderValue(tenantId, { role: 'tenant_admin', userId: adminUserId });
    return { tenantId, adminUserId, adminHeader };
  }

  it('AC1: GET /v1/tenants/me/export/workspace returns 200 with correct tenant metadata for tenant_admin', async () => {
    const { tenantId, adminHeader } = await createTenantWithAdmin();

    const res = await request(app)
      .get('/v1/tenants/me/export/workspace')
      .set('X-Test-Identity', adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(tenantId);
    expect(res.body.tenant.name).toBeTruthy();
    expect(res.body.tenant).toHaveProperty('licenseSeatCount');
    expect(res.body.tenant).toHaveProperty('activeSeatCount');
    expect(res.body.tenant).toHaveProperty('status');
    expect(res.body.tenant).toHaveProperty('createdAt');
  });

  it('AC2: workspace JSON includes expected tables and excludes credential secrets', async () => {
    const { tenantId, adminUserId, adminHeader } = await createTenantWithAdmin();

    const anotherUserId = randomUUID();
    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO users (id, tenant_id, email, role, status) VALUES ($1, $2, $3, 'tenant_user', 'active')`,
        [anotherUserId, tenantId, `user-${anotherUserId}@example.com`]
      );
    });

    const run = await startIngestionRun(tenantId, {
      platformId: 'gnews',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    await completeIngestionRun(tenantId, run.id, {
      status: 'succeeded',
      postsIngested: 1,
      postsSkipped: 0,
    });

    const author = await upsertAuthor(tenantId, 'gnews', `ext-${randomUUID()}`, {
      displayName: 'Export Author',
      handle: '@export',
    });

    const post = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: run.id,
      rawPayload: { providerId: 'gnews', title: 'Exportable post', url: 'https://example.com/post' },
      publishedAt: '2026-08-23T00:00:00.000Z',
      enrichment: { sentiment: 'positive', keyPhrases: ['a', 'b', 'c'] },
      bodyMarkdown: '# Exportable post',
    });

    const watchlist = await createWatchlist(tenantId, adminUserId, {
      name: 'Export',
      matchType: 'keyword',
      terms: ['post'],
    });

    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO post_watchlist_matches (post_id, watchlist_id, tenant_id) VALUES ($1, $2, $3)`,
        [post.id, watchlist.id, tenantId]
      );
    });

    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO platform_credentials
           (tenant_id, platform_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext, owner_type, user_id)
         VALUES ($1, 'gnews', '\\x00', 'kv-test', '\\x00', '\\x00', '\\x00', 'tenant', null)`,
        [tenantId]
      );
    });

    const res = await request(app)
      .get('/v1/tenants/me/export/workspace')
      .set('X-Test-Identity', adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeInstanceOf(Array);
    expect(res.body.watchlists).toBeInstanceOf(Array);
    expect(res.body.connectorActivations).toBeInstanceOf(Array);
    expect(res.body.platformCredentials).toBeInstanceOf(Array);
    expect(res.body.authors).toBeInstanceOf(Array);
    expect(res.body.socialPosts).toBeInstanceOf(Array);
    expect(res.body.ingestionRuns).toBeInstanceOf(Array);

    const credential = res.body.platformCredentials[0];
    expect(credential).toBeDefined();
    expect(credential).not.toHaveProperty('ciphertext');
    expect(credential).not.toHaveProperty('wrapped_dek');
    expect(credential).not.toHaveProperty('iv');
    expect(credential).not.toHaveProperty('auth_tag');
    expect(credential).not.toHaveProperty('key_vault_key_id');

    const payload = JSON.stringify(res.body).toLowerCase();
    expect(payload).not.toContain('ciphertext');
    expect(payload).not.toContain('wrapped_dek');
    expect(payload).not.toContain('auth_tag');
  });

  it('AC3/AC4: GET /v1/posts?format=csv returns the same rows as JSON, with headers and quoting, honoring watchlistId', async () => {
    const { tenantId, adminUserId, adminHeader } = await createTenantWithAdmin();

    const run = await startIngestionRun(tenantId, {
      platformId: 'gnews',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    await completeIngestionRun(tenantId, run.id, {
      status: 'succeeded',
      postsIngested: 2,
      postsSkipped: 0,
    });

    const author = await upsertAuthor(tenantId, 'gnews', `ext-${randomUUID()}`, {
      displayName: 'CSV Author',
      handle: '@csv',
    });

    const post1 = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: run.id,
      rawPayload: { providerId: 'gnews', title: 'One', url: 'https://example.com/1' },
      bodyMarkdown: 'Body one',
      enrichment: { sentiment: 'neutral', keyPhrases: ['one'] },
    });

    const post2 = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: run.id,
      rawPayload: { providerId: 'gnews', title: 'Two', url: 'https://example.com/2' },
      bodyMarkdown: 'Body two',
      enrichment: { sentiment: 'positive', keyPhrases: ['two'] },
    });

    const watchlist = await createWatchlist(tenantId, adminUserId, {
      name: 'CSV filter',
      matchType: 'keyword',
      terms: ['One'],
    });

    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO post_watchlist_matches (post_id, watchlist_id, tenant_id) VALUES ($1, $2, $3)`,
        [post1.id, watchlist.id, tenantId]
      );
    });

    const jsonRes = await request(app)
      .get(`/v1/posts?watchlistId=${watchlist.id}&limit=100`)
      .set('X-Test-Identity', adminHeader);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.posts.map((p: { id: string }) => p.id)).toEqual([post1.id]);

    const csvRes = await request(app)
      .get(`/v1/posts?format=csv&watchlistId=${watchlist.id}`)
      .set('X-Test-Identity', adminHeader);
    expect(csvRes.status).toBe(200);

    const text = csvRes.text as string;
    expect(text.startsWith('\uFEFF')).toBe(true);

    const headerLine = text.split('\n')[0].replace(/^\uFEFF/, '');
    expect(headerLine).toBe(
      'id,published_at,provider,author_name,author_url,title,body_markdown,url,sentiment,keywords,watchlist_ids'
    );
    expect(text).toContain(post1.id);
    expect(text).toContain(watchlist.id);
    expect(text).not.toContain(post2.id);
    expect(text).toContain('CSV Author');
  });

  it('AC5: workspace too large returns 413 EXPORT_TOO_LARGE; CSV too many rows returns 413 EXPORT_TOO_LARGE', async () => {
    const { tenantId, adminHeader } = await createTenantWithAdmin();

    process.env.WORKSPACE_EXPORT_MAX_BYTES = '1';
    const workspaceRes = await request(app)
      .get('/v1/tenants/me/export/workspace')
      .set('X-Test-Identity', adminHeader);
    expect(workspaceRes.status).toBe(413);
    expect(workspaceRes.body.code).toBe('EXPORT_TOO_LARGE');
    delete process.env.WORKSPACE_EXPORT_MAX_BYTES;

    const run = await startIngestionRun(tenantId, {
      platformId: 'gnews',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    await completeIngestionRun(tenantId, run.id, {
      status: 'succeeded',
      postsIngested: 0,
      postsSkipped: 0,
    });

    process.env.POSTS_CSV_MAX_ROWS = '1';
    await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { title: 'first' },
    });
    await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { title: 'second' },
    });

    const csvRes = await request(app)
      .get('/v1/posts?format=csv')
      .set('X-Test-Identity', adminHeader);
    expect(csvRes.status).toBe(413);
    expect(csvRes.body.code).toBe('EXPORT_TOO_LARGE');
    delete process.env.POSTS_CSV_MAX_ROWS;
  });

  it('AC6: tenant_user gets 403 on workspace; platform_admin gets 403 on both exports', async () => {
    const { tenantId, adminUserId } = await createTenantWithAdmin();

    const userHeader = testIdentityHeaderValue(tenantId, { role: 'tenant_user', userId: adminUserId });
    const workspaceUserRes = await request(app)
      .get('/v1/tenants/me/export/workspace')
      .set('X-Test-Identity', userHeader);
    expect(workspaceUserRes.status).toBe(403);

    const platformHeader = platformAdminHeader();
    const workspaceAdminRes = await request(app)
      .get('/v1/tenants/me/export/workspace')
      .set('X-Test-Identity', platformHeader);
    expect(workspaceAdminRes.status).toBe(403);

    const csvAdminRes = await request(app)
      .get('/v1/posts?format=csv')
      .set('X-Test-Identity', platformHeader);
    expect(csvAdminRes.status).toBe(403);
  });
});
