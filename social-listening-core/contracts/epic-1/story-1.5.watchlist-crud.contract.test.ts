// Contract: Watchlist CRUD — Phase 1 "also build, not storied" work
// See docs/open-items-and-deferred-work.md §A, docs/implementation-plan.md Phase 1,
// and .claude/skills/watchlist-crud/SKILL.md.
//
// Intent: Watchlist CRUD REST surface — POST /v1/watchlists, GET /v1/watchlists,
// PATCH /v1/watchlists/:id, DELETE /v1/watchlists/:id with full tenant isolation.
// Scope: migrations/0014_create_watchlists.sql, src/watchlists/watchlistStore.ts,
// src/http/versions/v1/watchlistsRouter.ts, src/http/versions/v1/router.ts
// Contract to encode: (1) POST creates a watchlist and returns it with generated id;
// (2) GET returns all watchlists for the current tenant, filtered by RLS; (3) PATCH
// updates a watchlist by id for the current tenant; (4) DELETE removes a watchlist
// by id for the current tenant; (5) all operations respect tenant isolation
// (RLS) — a tenant can only see/modify their own watchlists; (6) createdAt/updatedAt
// timestamps are managed automatically; (7) the watchlists table exists with
// correct schema.
// Explicitly out of scope: authentication (X-Tenant-Id is a Phase 1 placeholder,
// see .claude/skills/posts-api/SKILL.md Known gaps); watchlist validation
// beyond schema; pagination on GET; soft-delete; watchlist usage in ingestion
// (wiring watchlist matching into connectors — separate Phase 1 deferred work).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { getPool } from '../../src/db/pool';

jest.setTimeout(30000);

afterAll(async () => {
  await closePool();
});

describe('Watchlist CRUD contract', () => {
  const app = createApp();

  // Verify the table schema exists before running CRUD tests
  it('AC0: watchlists table exists with correct schema', async () => {
    const client = await getPool().connect();
    try {
      const { rows } = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = 'watchlists'
         ORDER BY ordinal_position`
      );

      const columns = rows.map((r: { column_name: string; data_type: string }) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('name');
      expect(columns).toContain('match_type');
      expect(columns).toContain('terms');
      expect(columns).toContain('boolean_query');
      expect(columns).toContain('platform_ids');
      expect(columns).toContain('is_active');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');

      // Verify RLS policy exists
      const { rows: policies } = await client.query(
        `SELECT policyname FROM pg_policies WHERE tablename = 'watchlists'`
      );
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.some((p: { policyname: string }) => p.policyname === 'tenant_isolation')).toBe(true);
    } finally {
      client.release();
    }
  });

  it('AC1: POST /v1/watchlists creates a watchlist and returns it with generated id', async () => {
    const tenantId = randomUUID();
    const watchlistData = {
      name: 'Test Keyword Watchlist',
      matchType: 'keyword',
      terms: ['acme', 'support'],
      platformIds: ['gnews', 'newswire'],
      isActive: true,
    };

    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send(watchlistData);

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe(watchlistData.name);
    expect(response.body.matchType).toBe(watchlistData.matchType);
    expect(response.body.terms).toEqual(expect.arrayContaining(watchlistData.terms));
    expect(response.body.platformIds).toEqual(expect.arrayContaining(watchlistData.platformIds));
    expect(response.body.isActive).toBe(watchlistData.isActive);
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
    expect(new Date(response.body.createdAt).getTime()).not.toBeNaN();
    expect(new Date(response.body.updatedAt).getTime()).not.toBeNaN();
  });

  it('AC2: POST /v1/watchlists with boolean matchType and booleanQuery', async () => {
    const tenantId = randomUUID();
    const watchlistData = {
      name: 'Boolean Query Watchlist',
      matchType: 'boolean',
      booleanQuery: 'acme AND (support OR help) NOT jobs',
      platformIds: ['gnews'],
      isActive: false,
      terms: [], // empty for boolean type
    };

    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send(watchlistData);

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.matchType).toBe('boolean');
    expect(response.body.booleanQuery).toBe(watchlistData.booleanQuery);
    expect(response.body.isActive).toBe(false);
  });

  it('AC3: GET /v1/watchlists returns all watchlists for the current tenant', async () => {
    const tenantId = randomUUID();

    // Create multiple watchlists for the tenant
    const watchlist1 = {
      name: 'Watchlist 1',
      matchType: 'keyword',
      terms: ['test1'],
      platformIds: ['gnews'],
    };
    const watchlist2 = {
      name: 'Watchlist 2',
      matchType: 'hashtag',
      terms: ['#test'],
      platformIds: ['newswire'],
    };

    const create1 = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send(watchlist1);
    const create2 = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send(watchlist2);

    expect(create1.status).toBe(201);
    expect(create2.status).toBe(201);

    // List all watchlists for the tenant
    const response = await request(app)
      .get('/v1/watchlists')
      .set('X-Tenant-Id', tenantId);

    expect(response.status).toBe(200);
    expect(response.body.watchlists).toBeDefined();
    expect(Array.isArray(response.body.watchlists)).toBe(true);
    expect(response.body.watchlists.length).toBe(2);

    const returnedIds = response.body.watchlists.map((w: { id: string }) => w.id);
    expect(returnedIds).toContain(create1.body.id);
    expect(returnedIds).toContain(create2.body.id);
  });

  it('AC4: GET /v1/watchlists with matchType filter returns only watchlists of that type', async () => {
    const tenantId = randomUUID();

    // Create watchlists of different types
    await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Keyword', matchType: 'keyword', terms: ['test'], platformIds: ['gnews'] });
    await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Hashtag', matchType: 'hashtag', terms: ['#test'], platformIds: ['gnews'] });
    await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Boolean', matchType: 'boolean', booleanQuery: 'test AND more', platformIds: ['gnews'] });

    // Filter by matchType
    const response = await request(app)
      .get('/v1/watchlists?matchType=keyword')
      .set('X-Tenant-Id', tenantId);

    expect(response.status).toBe(200);
    expect(response.body.watchlists.length).toBe(1);
    expect(response.body.watchlists[0].matchType).toBe('keyword');
  });

  it('AC5: PATCH /v1/watchlists/:id updates a watchlist for the current tenant', async () => {
    const tenantId = randomUUID();

    // Create a watchlist
    const createResponse = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'Original Name',
        matchType: 'keyword',
        terms: ['original'],
        platformIds: ['gnews'],
        isActive: true,
      });

    expect(createResponse.status).toBe(201);
    const watchlistId = createResponse.body.id;

    // Update the watchlist
    const originalUpdatedAt = createResponse.body.updatedAt;
    const updateResponse = await request(app)
      .patch(`/v1/watchlists/${watchlistId}`)
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'Updated Name',
        terms: ['updated', 'terms'],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.id).toBe(watchlistId);
    expect(updateResponse.body.name).toBe('Updated Name');
    expect(updateResponse.body.terms).toEqual(expect.arrayContaining(['updated', 'terms']));
    // updatedAt should have changed
    expect(updateResponse.body.updatedAt).not.toBe(originalUpdatedAt);
    // createdAt should remain the same
    expect(updateResponse.body.createdAt).toBe(createResponse.body.createdAt);
  });

  it('AC6: DELETE /v1/watchlists/:id removes a watchlist for the current tenant', async () => {
    const tenantId = randomUUID();

    // Create a watchlist
    const createResponse = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'To Delete',
        matchType: 'keyword',
        terms: ['delete'],
        platformIds: ['gnews'],
      });

    expect(createResponse.status).toBe(201);
    const watchlistId = createResponse.body.id;

    // Delete the watchlist
    const deleteResponse = await request(app)
      .delete(`/v1/watchlists/${watchlistId}`)
      .set('X-Tenant-Id', tenantId);

    expect(deleteResponse.status).toBe(204);

    // Verify it's gone
    const listResponse = await request(app)
      .get('/v1/watchlists')
      .set('X-Tenant-Id', tenantId);

    expect(listResponse.status).toBe(200);
    const returnedIds = listResponse.body.watchlists.map((w: { id: string }) => w.id);
    expect(returnedIds).not.toContain(watchlistId);
  });

  it('AC7: tenant isolation — a tenant can only see their own watchlists', async () => {
    const tenantId1 = randomUUID();
    const tenantId2 = randomUUID();

    // Create watchlist for tenant 1
    const createResponse = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId1)
      .send({
        name: 'Tenant 1 Watchlist',
        matchType: 'keyword',
        terms: ['tenant1'],
        platformIds: ['gnews'],
      });

    expect(createResponse.status).toBe(201);
    const watchlistId = createResponse.body.id;

    // Tenant 2 should not see tenant 1's watchlist
    const listResponse = await request(app)
      .get('/v1/watchlists')
      .set('X-Tenant-Id', tenantId2);

    expect(listResponse.status).toBe(200);
    const returnedIds = listResponse.body.watchlists.map((w: { id: string }) => w.id);
    expect(returnedIds).not.toContain(watchlistId);

    // Tenant 2 should not be able to update tenant 1's watchlist
    const updateResponse = await request(app)
      .patch(`/v1/watchlists/${watchlistId}`)
      .set('X-Tenant-Id', tenantId2)
      .send({ name: 'Should Not Work' });

    // Should return 404 (not found) due to RLS, not 200
    expect(updateResponse.status).toBe(404);

    // Tenant 2 should not be able to delete tenant 1's watchlist
    const deleteResponse = await request(app)
      .delete(`/v1/watchlists/${watchlistId}`)
      .set('X-Tenant-Id', tenantId2);

    expect(deleteResponse.status).toBe(404);
  });

  it('AC8: POST /v1/watchlists without X-Tenant-Id header returns 400', async () => {
    const response = await request(app)
      .post('/v1/watchlists')
      .send({
        name: 'No Tenant Watchlist',
        matchType: 'keyword',
        terms: ['test'],
        platformIds: ['gnews'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('X-Tenant-Id');
  });

  it('AC9: GET /v1/watchlists without X-Tenant-Id header returns 400', async () => {
    const response = await request(app).get('/v1/watchlists');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('X-Tenant-Id');
  });

  it('AC10: PATCH /v1/watchlists/:id without X-Tenant-Id header returns 400', async () => {
    const tenantId = randomUUID();
    const createResponse = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'Test',
        matchType: 'keyword',
        terms: ['test'],
        platformIds: ['gnews'],
      });

    const watchlistId = createResponse.body.id;
    const response = await request(app)
      .patch(`/v1/watchlists/${watchlistId}`)
      .send({ name: 'Updated' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('X-Tenant-Id');
  });

  it('AC11: DELETE /v1/watchlists/:id without X-Tenant-Id header returns 400', async () => {
    const tenantId = randomUUID();
    const createResponse = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'Test',
        matchType: 'keyword',
        terms: ['test'],
        platformIds: ['gnews'],
      });

    const watchlistId = createResponse.body.id;
    const response = await request(app).delete(`/v1/watchlists/${watchlistId}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('X-Tenant-Id');
  });

  it('AC12: PATCH /v1/watchlists/:id with non-existent id returns 404', async () => {
    const tenantId = randomUUID();
    const nonExistentId = randomUUID();

    const response = await request(app)
      .patch(`/v1/watchlists/${nonExistentId}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Updated' });

    expect(response.status).toBe(404);
  });

  it('AC13: DELETE /v1/watchlists/:id with non-existent id returns 404', async () => {
    const tenantId = randomUUID();
    const nonExistentId = randomUUID();

    const response = await request(app)
      .delete(`/v1/watchlists/${nonExistentId}`)
      .set('X-Tenant-Id', tenantId);

    expect(response.status).toBe(404);
  });

  it('AC14: defaults — isActive defaults to true, platformIds defaults to empty array', async () => {
    const tenantId = randomUUID();

    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Tenant-Id', tenantId)
      .send({
        name: 'Minimal Watchlist',
        matchType: 'keyword',
        terms: ['test'],
        // isActive and platformIds omitted
      });

    expect(response.status).toBe(201);
    expect(response.body.isActive).toBe(true);
    expect(response.body.platformIds).toEqual([]);
  });
});
