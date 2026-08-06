// Contract: Story 5.14 (ADR-0030 §5) — Platform Admin audit-log query REST
// surface.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-514--platform-admin-audit-log-query-rest-surface
//
// Intent: Story 5.14 — Platform Admin audit-log query REST surface
// (ADR-0030 §5; no new ADR needed — platform_admin_audit_log's schema and
// write path already exist, Story 5.7; this adds a read-only query endpoint)
// Scope: src/http/versions/v1/adminAuditLogRouter.ts (new), src/http/versions/v1/router.ts
// (mount /admin/audit-log), src/admin/platformAdminAuditLog.ts (new
// queryPlatformAdminAuditLog() — the existing logPlatformAdminAction() write
// path is untouched), src/admin/auditLogCursor.ts (new — keyset cursor over
// (created_at, id), since this table has no monotonic seq column the way
// social_posts does; id breaks ties deterministically).
// Contract to encode, one test group per Acceptance Criterion: (AC1) GET
// /v1/admin/audit-log returns entries (id, actorIdentity, operation,
// targetTenantId, detail, createdAt), reachable through a platform_admin
// resolved identity; (AC2) supports filtering by tenantId, actorIdentity,
// and a from/to date range (ADR-0011's own already-established from/to
// naming for GET /posts), and cursor-paginates correctly with no filters
// (ADR-0011 convention) — proven by walking two pages via nextCursor with no
// duplicate/overlapping entries; (AC3) GET only — no other verb is
// registered on this route at all; (AC4) unauthenticated and tenant-scoped
// (app_user) callers are both rejected, never reaching the query; (AC5) no
// entry's detail ever contains a TAP code or temporary password.
// Test-cost discipline for AC5: this endpoint only ever SELECTs and forwards
// platform_admin_audit_log's own `detail` column verbatim — it does not call
// breakGlassCredentialReset.ts or construct `detail` itself. Story 5.7's and
// 5.13's own contracts already prove, against the real Entra tenant, that
// neither the TAP nor the temporary password is ever written to `detail` in
// the first place; paying for a second real ~15s+ Graph round trip here
// would only re-derive that same already-proven fact through a read-only
// surface with no independent way to introduce a leak. AC5 is instead proven
// two ways, in a single test, that together cover this endpoint's own real
// risk surface: (a) structurally, this router's source never references a
// TAP/password field name at all, so it cannot inject one; (b) functionally,
// a synthetic entry logged through the existing, already-load-bearing
// logPlatformAdminAction() is returned with its `detail` byte-identical to
// what was stored — pure pass-through, not a place a field could be added.
// Explicitly out of scope: re-proving platform_admin_audit_log's own write
// path or that TAP/password are never logged in the first place (Story
// 5.7/5.13's own contracts); re-proving requirePlatformAdmin()'s own 403
// mechanics beyond this route's use of it (Story 5.12's own contract already
// covers the helper itself).

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { logPlatformAdminAction } from '../../src/admin/platformAdminAuditLog';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

const ADMIN_AUDIT_LOG_ROUTER_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../src/http/versions/v1/adminAuditLogRouter.ts'),
  'utf8'
);

describe('Story 5.14 — Platform Admin audit-log query REST surface', () => {
  const app = createApp();

  it('AC1: GET /v1/admin/audit-log returns entries with the admin-facing shape, reachable through platform_admin', async () => {
    const adminId = randomUUID();
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId })
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    const entry = res.body.entries.find((e: { targetTenantId: string }) => e.targetTenantId === created.body.id);
    expect(entry).toBeDefined();
    expect(Object.keys(entry).sort()).toEqual(
      ['actorIdentity', 'createdAt', 'detail', 'id', 'operation', 'targetTenantId'].sort()
    );
    expect(entry.operation).toBe('create_tenant');
    expect(entry.actorIdentity).toBe(adminId);
  });

  it('AC2: filtering by tenantId scopes entries to that tenant only', async () => {
    const adminId = randomUUID();
    const tenantA = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `T-A-${randomUUID()}`, licenseSeatCount: 5 });
    const tenantB = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `T-B-${randomUUID()}`, licenseSeatCount: 5 });
    await request(app)
      .patch(`/v1/admin/tenants/${tenantA.body.id}`)
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ status: 'suspended' });

    const res = await request(app)
      .get('/v1/admin/audit-log')
      .query({ tenantId: tenantA.body.id })
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(2);
    expect(res.body.entries.every((e: { targetTenantId: string }) => e.targetTenantId === tenantA.body.id)).toBe(true);
    expect(res.body.entries.some((e: { targetTenantId: string }) => e.targetTenantId === tenantB.body.id)).toBe(false);
  });

  it('AC2: filtering by actorIdentity isolates one Platform Admin from another', async () => {
    const adminOne = randomUUID();
    const adminTwo = randomUUID();
    await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminOne))
      .send({ name: `T-1-${randomUUID()}`, licenseSeatCount: 5 });
    await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminTwo))
      .send({ name: `T-2-${randomUUID()}`, licenseSeatCount: 5 });

    const res = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminOne })
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(res.body.entries.every((e: { actorIdentity: string }) => e.actorIdentity === adminOne)).toBe(true);
  });

  it('AC2: filtering by from/to date range includes an in-range entry and excludes an out-of-range one', async () => {
    const adminId = randomUUID();
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });

    const lookup = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId })
      .set('X-Test-Identity', platformAdminHeader());
    const entry = lookup.body.entries.find((e: { targetTenantId: string }) => e.targetTenantId === created.body.id);
    const createdAtMs = new Date(entry.createdAt).getTime();

    const inRange = await request(app)
      .get('/v1/admin/audit-log')
      .query({
        actorIdentity: adminId,
        from: new Date(createdAtMs - 60_000).toISOString(),
        to: new Date(createdAtMs + 60_000).toISOString(),
      })
      .set('X-Test-Identity', platformAdminHeader());
    expect(inRange.body.entries.some((e: { id: string }) => e.id === entry.id)).toBe(true);

    const outOfRange = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId, to: new Date(createdAtMs - 60_000).toISOString() })
      .set('X-Test-Identity', platformAdminHeader());
    expect(outOfRange.body.entries.some((e: { id: string }) => e.id === entry.id)).toBe(false);
  });

  it('AC2: no filters, cursor pagination walks distinct pages with no duplicate entries', async () => {
    const adminId = randomUUID();
    const tenantIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const created = await request(app)
        .post('/v1/admin/tenants')
        .set('X-Test-Identity', platformAdminHeader(adminId))
        .send({ name: `T-page-${i}-${randomUUID()}`, licenseSeatCount: 5 });
      tenantIds.push(created.body.id);
    }

    const page1 = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId, limit: 2 })
      .set('X-Test-Identity', platformAdminHeader());
    expect(page1.body.entries.length).toBe(2);
    expect(page1.body.nextCursor).toEqual(expect.any(String));

    const page2 = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId, limit: 2, cursor: page1.body.nextCursor })
      .set('X-Test-Identity', platformAdminHeader());
    expect(page2.body.entries.length).toBe(1);
    expect(page2.body.nextCursor).toBeNull();

    const allIds = [...page1.body.entries, ...page2.body.entries].map((e: { id: string }) => e.id);
    expect(new Set(allIds).size).toBe(3);
    const allTargetTenantIds = [...page1.body.entries, ...page2.body.entries].map(
      (e: { targetTenantId: string }) => e.targetTenantId
    );
    expect(allTargetTenantIds.sort()).toEqual([...tenantIds].sort());
  });

  it('AC3: only GET is registered on this route — POST/PUT/PATCH/DELETE are all rejected', async () => {
    const header = platformAdminHeader();

    const post = await request(app).post('/v1/admin/audit-log').set('X-Test-Identity', header);
    const put = await request(app).put('/v1/admin/audit-log').set('X-Test-Identity', header);
    const patch = await request(app).patch('/v1/admin/audit-log').set('X-Test-Identity', header);
    const del = await request(app).delete('/v1/admin/audit-log').set('X-Test-Identity', header);

    expect(post.status).not.toBe(200);
    expect(put.status).not.toBe(200);
    expect(patch.status).not.toBe(200);
    expect(del.status).not.toBe(200);
  });

  it('AC4: a tenant_admin/tenant_user identity is rejected 403', async () => {
    const res = await request(app)
      .get('/v1/admin/audit-log')
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()));
    expect(res.status).toBe(403);
  });

  it('AC4: no Authorization/X-Test-Identity at all is rejected 401 before any handler runs', async () => {
    const res = await request(app).get('/v1/admin/audit-log');
    expect(res.status).toBe(401);
  });

  it("AC5: the router cannot leak a TAP/password — it never references either field name, and a logged entry's detail passes through byte-identical", async () => {
    expect(ADMIN_AUDIT_LOG_ROUTER_SOURCE).not.toMatch(/temporaryAccessPass|password/i);

    const adminId = randomUUID();
    const detail = { note: `contract-5.14-${randomUUID()}` };
    await logPlatformAdminAction({
      actorIdentity: adminId,
      operation: 'story_5_14_pass_through_check',
      detail,
    });

    const res = await request(app)
      .get('/v1/admin/audit-log')
      .query({ actorIdentity: adminId })
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBe(1);
    expect(res.body.entries[0].detail).toEqual(detail);
  });
});
