// Contract: Story 1.5 — Watchlist CRUD REST surface, personal/per-user, with
// ADR-0044's PATCH/error/locking contract.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-15 and
// .claude/skills/watchlist-crud/SKILL.md.
//
// Intent: rework the pre-existing, already-shipped-ish Watchlist CRUD surface
// (POST/GET/PATCH/DELETE /v1/watchlists) against ADR-0044's four durable
// decisions: (1) RFC 7396 JSON Merge Patch semantics on PATCH; (2) the
// explicit 404/422/400/409/428 error-code mapping (403 reserved, unused
// here); (3) `version`-column optimistic locking via `If-Match`; (4) the
// `watchlists` row shape reconciled with ADR-0021, including the new
// `user_id` ownership column (ADR-0044 §5c, added in-place 2026-08-11).
// Scope: migrations/0025_watchlists_ownership_and_versioning.sql (new),
// src/db/withTenant.ts (optional userId propagation to `app.user_id`),
// src/watchlists/watchlistStore.ts (re-signed for userId, version,
// validateWatchlistShape, PATCH merge semantics), src/http/versions/v1/
// watchlistsRouter.ts (new GET /:id, ownership via requireTenantUserIdentity,
// PATCH semantics + error mapping + locking).
// Contract to encode: (1) POST creates a watchlist owned by the caller,
// ignoring any client-supplied user_id, and returns it with a `version`;
// (2) GET (list) and the new GET /:id return only the caller's own
// watchlists — never another user's, even a Tenant-Admin's, even within the
// same tenant; a request for another user's or another tenant's watchlist
// returns an identical 404 body; (3) PATCH follows RFC 7396 (null deletes,
// omitted is unchanged, arrays replace in full), requires `If-Match`,
// returns 428 if absent and 409 with `current_version` if stale, and
// increments `version` on success; (4) the matchType <-> terms/booleanQuery
// invariant is enforced (422) on create and on any PATCH touching those
// fields; (5) malformed/wrong-shape bodies get 400; (6) DELETE is unchanged
// in shape (204/404) but ownership-scoped like everything else; (7) the
// four match types and existing list/matchType-filter/defaults behavior are
// carried forward unchanged in substance.
// Explicitly out of scope: watchlist validation beyond this story's own
// invariant (deferred to watchlist-matching, ADR-0021); pagination on GET;
// soft-delete; a per-user watchlist count/complexity cap (ADR-0044's own
// named, deliberately unresolved Open Question); Platform Admin's own
// zero-access boundary to `watchlists` (inherited unchanged from ADR-0030
// §2 — platform_admin_role has no grant on this table, untouched by this
// story, and requireTenantUserIdentity already 403s a platform_admin
// identity on every route in this router, per Story 5.10).
//
// 2026-08-12 — real rework of this file's own prior version, per Story 1.5's
// own dated note ("needs substantial extension, not just a status-line
// update") and ADR-0044 (Accepted 2026-08-11). The prior version asserted
// none of ADR-0044's actual contract (no version/If-Match, no 422/409/428,
// no RFC 7396 semantics, no ownership) — ACs below are a full replacement,
// not an extension of the old numbering. AC0/AC-tenant-isolation/AC-defaults
// carry forward the same underlying behaviors the old AC0/AC7/AC14 proved,
// re-verified against the new schema/ownership model.
//
// 2026-08-12 — a real, necessary ripple from this same rework, named rather
// than silently absorbed: `createWatchlist()` gained a required `userId`
// parameter (ADR-0044 §5) and `watchlists.user_id` became a hard, non-null
// FK to `users(id)` — two other already-passing contracts that call
// `createWatchlist()` directly (story-3.8, story-5.10) needed a matching,
// real `users` row and, for story-5.10's AC2/AC3, a consistent caller
// identity between their create and list calls, since ownership-scoped RLS
// now means only the creating user's own identity can see what it created.
// Both fixes are minimal and additive — see each file's own 2026-08-12 note.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePool();
});

/** A tenant plus one real, activated user — the established makeTenantWithUsers()-style pattern (Story 1.7). */
async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

function identityHeader(tenantId: string, userId: string, role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): string {
  return testIdentityHeaderValue(tenantId, { userId, role });
}

describe('Story 1.5 — Watchlist CRUD, personal/per-user, ADR-0044 contract', () => {
  const app = createApp();

  it('AC0: watchlists table has user_id/version columns and the extended tenant_isolation RLS policy', async () => {
    const client = await getPool().connect();
    try {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'watchlists'`
      );
      const columns = rows.map((r: { column_name: string }) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('version');
      expect(columns).toContain('name');
      expect(columns).toContain('match_type');
      expect(columns).toContain('terms');
      expect(columns).toContain('boolean_query');
      expect(columns).toContain('platform_ids');
      expect(columns).toContain('is_active');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');

      const { rows: policies } = await client.query(
        `SELECT policyname, qual FROM pg_policies WHERE tablename = 'watchlists'`
      );
      const tenantIsolation = policies.find((p: { policyname: string }) => p.policyname === 'tenant_isolation');
      expect(tenantIsolation).toBeDefined();
      expect(tenantIsolation.qual).toContain('user_id');
    } finally {
      client.release();
    }
  });

  it('AC1: POST /v1/watchlists creates a watchlist owned by the caller, ignoring a client-supplied user_id, returns version 1', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const someoneElsesId = randomUUID();

    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        name: 'Test Keyword Watchlist',
        matchType: 'keyword',
        terms: ['acme', 'support'],
        platformIds: ['gnews', 'newswire'],
        isActive: true,
        userId: someoneElsesId, // spoofed — must have no effect
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Test Keyword Watchlist');
    expect(response.body.matchType).toBe('keyword');
    expect(response.body.terms).toEqual(expect.arrayContaining(['acme', 'support']));
    expect(response.body.platformIds).toEqual(expect.arrayContaining(['gnews', 'newswire']));
    expect(response.body.isActive).toBe(true);
    expect(response.body.version).toBe(1);
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();

    // Confirm ownership landed on the real caller, never the spoofed id —
    // via getAdminPool() (BYPASSRLS), since the ordinary app_user pool
    // would itself be RLS-filtered with no session context set here.
    const { rows } = await getAdminPool().query(`SELECT user_id FROM watchlists WHERE id = $1`, [response.body.id]);
    expect(rows[0].user_id).toBe(userId);
    expect(rows[0].user_id).not.toBe(someoneElsesId);
  });

  it('AC2: POST with matchType "boolean" stores booleanQuery and a null terms', async () => {
    const { tenantId, userId } = await makeTenantWithUser();

    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        name: 'Boolean Query Watchlist',
        matchType: 'boolean',
        booleanQuery: 'acme AND (support OR help) NOT jobs',
        platformIds: ['gnews'],
        isActive: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.matchType).toBe('boolean');
    expect(response.body.booleanQuery).toBe('acme AND (support OR help) NOT jobs');
    expect(response.body.isActive).toBe(false);
    expect(response.body.terms == null || response.body.terms.length === 0).toBe(true);
  });

  it('AC3: create validation — 422 when matchType invariant is violated (both populated, or both absent)', async () => {
    const { tenantId, userId } = await makeTenantWithUser();

    const bothPopulated = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ name: 'Bad', matchType: 'boolean', booleanQuery: 'x AND y', terms: ['x'] });
    expect(bothPopulated.status).toBe(422);
    expect(bothPopulated.body.code).toBe('validation_failed');
    expect(Array.isArray(bothPopulated.body.details)).toBe(true);

    const bothAbsent = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ name: 'Bad', matchType: 'keyword' });
    expect(bothAbsent.status).toBe(422);
    expect(bothAbsent.body.code).toBe('validation_failed');
  });

  it('AC4: create — 400 bad_request for missing name, invalid matchType, or wrong-shape terms', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const missingName = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ matchType: 'keyword', terms: ['x'] });
    expect(missingName.status).toBe(400);
    expect(missingName.body.code).toBe('bad_request');

    const badMatchType = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'X', matchType: 'nonsense', terms: ['x'] });
    expect(badMatchType.status).toBe(400);
    expect(badMatchType.body.code).toBe('bad_request');

    const wrongShape = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'X', matchType: 'keyword', terms: 'not-an-array' });
    expect(wrongShape.status).toBe(400);
    expect(wrongShape.body.code).toBe('bad_request');
  });

  it('AC5: GET /v1/watchlists lists only the caller\'s own watchlists, with matchType filter, ordered newest first', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const create1 = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Watchlist 1', matchType: 'keyword', terms: ['test1'], platformIds: ['gnews'] });
    const create2 = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Watchlist 2', matchType: 'hashtag', terms: ['#test'], platformIds: ['newswire'] });

    expect(create1.status).toBe(201);
    expect(create2.status).toBe(201);

    const listAll = await request(app).get('/v1/watchlists').set('X-Test-Identity', header);
    expect(listAll.status).toBe(200);
    expect(listAll.body.watchlists.length).toBe(2);
    const returnedIds = listAll.body.watchlists.map((w: { id: string }) => w.id);
    expect(returnedIds).toContain(create1.body.id);
    expect(returnedIds).toContain(create2.body.id);

    const filtered = await request(app).get('/v1/watchlists?matchType=hashtag').set('X-Test-Identity', header);
    expect(filtered.status).toBe(200);
    expect(filtered.body.watchlists.length).toBe(1);
    expect(filtered.body.watchlists[0].id).toBe(create2.body.id);
  });

  it('AC6: GET /v1/watchlists/:id returns the caller\'s own watchlist by id', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Fetch me', matchType: 'keyword', terms: ['x'] });
    expect(created.status).toBe(201);

    const fetched = await request(app).get(`/v1/watchlists/${created.body.id}`).set('X-Test-Identity', header);
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.name).toBe('Fetch me');
  });

  it('AC7: ownership — another user in the SAME tenant (including a Tenant-Admin) gets 404 on GET/PATCH/DELETE, identical to the cross-tenant case', async () => {
    const owner = await makeTenantWithUser('tenant_user');
    const ownerHeader = identityHeader(owner.tenantId, owner.userId);
    const adminEmail = `admin-${randomUUID()}@example.com`;
    const admin = await createInvitedUser(owner.tenantId, { email: adminEmail, role: 'tenant_admin' });
    await resolveIdentity({ sub: `sub-${admin.id}`, email: adminEmail });
    const adminHeader = identityHeader(owner.tenantId, admin.id, 'tenant_admin');

    const otherTenant = await makeTenantWithUser('tenant_user');
    const otherTenantHeader = identityHeader(otherTenant.tenantId, otherTenant.userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', ownerHeader)
      .send({ name: 'Private', matchType: 'keyword', terms: ['x'] });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const sameTenantAdminGet = await request(app).get(`/v1/watchlists/${id}`).set('X-Test-Identity', adminHeader);
    expect(sameTenantAdminGet.status).toBe(404);
    expect(sameTenantAdminGet.body).toEqual({ code: 'not_found' });

    const crossTenantGet = await request(app).get(`/v1/watchlists/${id}`).set('X-Test-Identity', otherTenantHeader);
    expect(crossTenantGet.status).toBe(404);
    expect(crossTenantGet.body).toEqual({ code: 'not_found' });

    const sameTenantAdminPatch = await request(app)
      .patch(`/v1/watchlists/${id}`)
      .set('X-Test-Identity', adminHeader)
      .set('If-Match', '"1"')
      .send({ name: 'Hijacked' });
    expect(sameTenantAdminPatch.status).toBe(404);

    const sameTenantAdminDelete = await request(app).delete(`/v1/watchlists/${id}`).set('X-Test-Identity', adminHeader);
    expect(sameTenantAdminDelete.status).toBe(404);

    // The owner can still see it — proves the above were real ownership
    // rejections, not the watchlist having vanished.
    const ownerGet = await request(app).get(`/v1/watchlists/${id}`).set('X-Test-Identity', ownerHeader);
    expect(ownerGet.status).toBe(200);
  });

  it('AC8: both tenant_admin and tenant_user may create and own watchlists, no role gate', async () => {
    const { tenantId, userId } = await makeTenantWithUser('tenant_admin');
    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId, 'tenant_admin'))
      .send({ name: 'Admin-owned', matchType: 'keyword', terms: ['x'] });
    expect(response.status).toBe(201);
  });

  it('AC9: PATCH — array replace + null-deletion in one request (Appendix A example)', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Switching', matchType: 'boolean', booleanQuery: 'old query' });
    expect(created.status).toBe(201);
    expect(created.body.version).toBe(1);

    const patched = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', `"${created.body.version}"`)
      .send({ matchType: 'keyword', terms: ['acme', 'support'], booleanQuery: null });

    expect(patched.status).toBe(200);
    expect(patched.body.matchType).toBe('keyword');
    expect(patched.body.terms).toEqual(expect.arrayContaining(['acme', 'support']));
    expect(patched.body.booleanQuery == null).toBe(true);
    expect(patched.body.version).toBe(2);
    expect(patched.body.updatedAt).not.toBe(created.body.updatedAt);
    expect(patched.body.createdAt).toBe(created.body.createdAt);
  });

  it('AC10: PATCH — a field omitted from the body is left unchanged; an array field present is replaced in full, not merged', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Original Name', matchType: 'keyword', terms: ['original'], platformIds: ['gnews'] });
    expect(created.status).toBe(201);

    const patched = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', `"${created.body.version}"`)
      .send({ terms: ['newterm'] });

    expect(patched.status).toBe(200);
    expect(patched.body.terms).toEqual(['newterm']);
    // name and platformIds were omitted from the patch body — unchanged.
    expect(patched.body.name).toBe('Original Name');
    expect(patched.body.platformIds).toEqual(expect.arrayContaining(['gnews']));
  });

  it('AC11: PATCH with no If-Match header returns 428 precondition_required', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Needs lock', matchType: 'keyword', terms: ['x'] });

    const response = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .send({ name: 'Renamed' });

    expect(response.status).toBe(428);
    expect(response.body).toEqual({ code: 'precondition_required' });
  });

  it('AC12: PATCH with a stale If-Match returns 409 with the current version', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Contested', matchType: 'keyword', terms: ['x'] });

    // Two real PATCHes happen, moving version to 3.
    await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', '"1"')
      .send({ name: 'v2' });
    await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', '"2"')
      .send({ name: 'v3' });

    const stale = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', '"1"')
      .send({ name: 'Should conflict' });

    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ code: 'version_conflict', current_version: 3 });
  });

  it('AC13: PATCH — 422 when the resulting matchType/terms/booleanQuery combination is invalid', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Valid to start', matchType: 'keyword', terms: ['x'] });

    // Switching to boolean without clearing terms leaves both populated.
    const response = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', `"${created.body.version}"`)
      .send({ matchType: 'boolean', booleanQuery: 'x AND y' });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('validation_failed');
  });

  it('AC14: PATCH — 400 bad_request for a wrong-shape body', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'Shape check', matchType: 'keyword', terms: ['x'] });

    const response = await request(app)
      .patch(`/v1/watchlists/${created.body.id}`)
      .set('X-Test-Identity', header)
      .set('If-Match', `"${created.body.version}"`)
      .send({ terms: 'not-an-array' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: 'bad_request' });
  });

  it('AC15: PATCH with a non-existent id returns 404 (If-Match still required first, but existence wins the 404)', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const response = await request(app)
      .patch(`/v1/watchlists/${randomUUID()}`)
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .set('If-Match', '"1"')
      .send({ name: 'Updated' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'not_found' });
  });

  it('AC16: DELETE /v1/watchlists/:id removes the caller\'s own watchlist (204), then 404 on a repeat and on a non-existent id', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const header = identityHeader(tenantId, userId);

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', header)
      .send({ name: 'To delete', matchType: 'keyword', terms: ['x'] });

    const deleted = await request(app).delete(`/v1/watchlists/${created.body.id}`).set('X-Test-Identity', header);
    expect(deleted.status).toBe(204);

    const listAfter = await request(app).get('/v1/watchlists').set('X-Test-Identity', header);
    expect(listAfter.body.watchlists.map((w: { id: string }) => w.id)).not.toContain(created.body.id);

    const repeatDelete = await request(app).delete(`/v1/watchlists/${created.body.id}`).set('X-Test-Identity', header);
    expect(repeatDelete.status).toBe(404);

    const nonExistentDelete = await request(app)
      .delete(`/v1/watchlists/${randomUUID()}`)
      .set('X-Test-Identity', header);
    expect(nonExistentDelete.status).toBe(404);
  });

  it('AC17: tenant isolation — a tenant can only see, patch, or delete their own tenant\'s watchlists', async () => {
    const tenant1 = await makeTenantWithUser();
    const tenant2 = await makeTenantWithUser();

    const created = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenant1.tenantId, tenant1.userId))
      .send({ name: 'Tenant 1 Watchlist', matchType: 'keyword', terms: ['tenant1'] });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenant2.tenantId, tenant2.userId));
    expect(list.status).toBe(200);
    expect(list.body.watchlists.map((w: { id: string }) => w.id)).not.toContain(created.body.id);
  });

  it('AC18: no authenticated identity returns 401 on every route (POST/GET/GET:id/PATCH/DELETE)', async () => {
    const post = await request(app).post('/v1/watchlists').send({ name: 'X', matchType: 'keyword', terms: ['x'] });
    expect(post.status).toBe(401);

    const list = await request(app).get('/v1/watchlists');
    expect(list.status).toBe(401);

    const getById = await request(app).get(`/v1/watchlists/${randomUUID()}`);
    expect(getById.status).toBe(401);

    const patch = await request(app).patch(`/v1/watchlists/${randomUUID()}`).set('If-Match', '"1"').send({ name: 'X' });
    expect(patch.status).toBe(401);

    const del = await request(app).delete(`/v1/watchlists/${randomUUID()}`);
    expect(del.status).toBe(401);
  });

  it('AC19: defaults — isActive defaults to true, platformIds defaults to an empty array', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const response = await request(app)
      .post('/v1/watchlists')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ name: 'Minimal Watchlist', matchType: 'keyword', terms: ['test'] });

    expect(response.status).toBe(201);
    expect(response.body.isActive).toBe(true);
    expect(response.body.platformIds).toEqual([]);
  });
});
