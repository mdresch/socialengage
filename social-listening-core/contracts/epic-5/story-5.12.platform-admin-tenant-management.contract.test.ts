// Contract: Story 5.12 (ADR-0030, ADR-0031) — Platform Admin tenant
// management REST surface.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-512--platform-admin-tenant-management-rest-surface
//
// Intent: Story 5.12 — Platform Admin tenant management REST surface
// (ADR-0030, ADR-0031; no new ADR needed)
// Scope: src/http/versions/v1/adminTenantsRouter.ts (new), src/http/versions/v1/router.ts
// (mount /admin/tenants), src/http/auth/requireTenantUser.ts (new
// requirePlatformAdmin() helper — the first route needing exactly this
// identity type, matching the sanctioned-accessor pattern getResolvedIdentity()
// already established for Story 5.11), src/tenants/tenantStore.ts (new
// listTenants(); UpdateTenantAdminInput/updateTenantAdmin() extended to
// support domain — ADR-0037 §9 already decided platform_admin_role gets
// UPDATE(domain) on tenants, but the grant migration was never actually
// built, confirmed directly: no migration file references it), migrations/0020
// (new — the missing grant).
// Contract to encode: (1) GET /v1/admin/tenants lists every tenant with the
// full admin-facing shape, reachable only through a platform_admin resolved
// identity, 403 for tenant_admin/tenant_user; (2) POST /v1/admin/tenants
// creates a tenant via the existing createTenant(), which structurally can
// only succeed under platform_admin_role since app_user has no INSERT grant
// on tenants at all (migration 0017) — a successful create is itself the
// proof, not a re-derivation of Story 5.7/5.8's own already-proven role
// mechanism; (3) PATCH /v1/admin/tenants/:id updates status/license_seat_count
// and now domain (the newly-built grant), rejects/ignores an attempt to set
// active_seat_count (DB-enforced column-scoped grant, re-proven at the HTTP
// layer); (4) a tenant_admin/tenant_user identity gets 403 on all three
// routes; (5) every write calls the existing logPlatformAdminAction(),
// reusing Story 5.7/5.8's own audit path, not a new one.
// Explicitly out of scope: re-proving platform_admin_role's own DB
// mechanics (BYPASSRLS, the exact column-level grant enforcement) — Story
// 5.7/5.8's own contracts already do this at the store layer; this story
// only proves the HTTP surface calls the right, already-correct functions
// and gates them to the right caller. Domain-collision (unique constraint)
// handling on POST — no AC requires it; ordinary 500 propagation, same as
// every other route's unhandled-DB-error path.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

describe('Story 5.12 — Platform Admin tenant management REST surface', () => {
  const app = createApp();

  it('AC1: GET /v1/admin/tenants lists every tenant, reachable only through a platform_admin identity', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });
    expect(created.status).toBe(201);

    const res = await request(app).get('/v1/admin/tenants').set('X-Test-Identity', platformAdminHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
    const row = res.body.tenants.find((t: { id: string }) => t.id === created.body.id);
    expect(row).toBeDefined();
    expect(Object.keys(row).sort()).toEqual(
      ['activeSeatCount', 'createdAt', 'domain', 'id', 'licenseSeatCount', 'name', 'status', 'updatedAt'].sort()
    );
  });

  it('AC1: a tenant_admin/tenant_user identity is rejected 403 on GET', async () => {
    const res = await request(app).get('/v1/admin/tenants').set('X-Test-Identity', testIdentityHeaderValue(randomUUID()));
    expect(res.status).toBe(403);
  });

  it('AC2: POST /v1/admin/tenants creates a tenant — success itself proves platform_admin_role ran, since app_user has no INSERT grant on tenants at all', async () => {
    const name = `T-${randomUUID()}`;
    const res = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name, licenseSeatCount: 10 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(res.body.licenseSeatCount).toBe(10);
    expect(res.body.activeSeatCount).toBe(0);
    expect(res.body.status).toBe('active');
  });

  it('AC2: a tenant_admin/tenant_user identity is rejected 403 on POST', async () => {
    const res = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()))
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });
    expect(res.status).toBe(403);
  });

  it('AC3: PATCH updates status and license_seat_count', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });

    const res = await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ status: 'suspended', licenseSeatCount: 20 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');
    expect(res.body.licenseSeatCount).toBe(20);
  });

  it('AC3: PATCH attempting to set active_seat_count is rejected, never applied', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });

    const res = await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ activeSeatCount: 999 });

    expect(res.status).toBe(400);

    const list = await request(app).get('/v1/admin/tenants').set('X-Test-Identity', platformAdminHeader());
    const row = list.body.tenants.find((t: { id: string }) => t.id === created.body.id);
    expect(row.activeSeatCount).toBe(0);
  });

  it('AC4: PATCH can set domain, and can clear it back to null (ADR-0037 §9)', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });
    expect(created.body.domain).toBeNull();

    const domain = `example-${randomUUID()}.com`;
    const setRes = await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ domain });
    expect(setRes.status).toBe(200);
    expect(setRes.body.domain).toBe(domain);

    const clearRes = await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ domain: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.domain).toBeNull();
  });

  it('AC5: a tenant_admin/tenant_user identity is rejected 403 on PATCH', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });

    const res = await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()))
      .send({ status: 'suspended' });
    expect(res.status).toBe(403);
  });

  it('AC5: no Authorization/X-Test-Identity at all is rejected 401 before any handler runs', async () => {
    const res = await request(app).get('/v1/admin/tenants');
    expect(res.status).toBe(401);
  });

  it('AC6: every write (create and update) is recorded in platform_admin_audit_log', async () => {
    const adminId = randomUUID();
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5 });

    await request(app)
      .patch(`/v1/admin/tenants/${created.body.id}`)
      .set('X-Test-Identity', platformAdminHeader(adminId))
      .send({ status: 'suspended' });

    const { rows } = await getPlatformAdminPool().query(
      `SELECT operation, actor_identity, target_tenant_id FROM platform_admin_audit_log
       WHERE target_tenant_id = $1 ORDER BY created_at`,
      [created.body.id]
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((r: { operation: string }) => r.operation)).toEqual(
      expect.arrayContaining(['create_tenant', 'update_tenant_admin'])
    );
    expect(rows.every((r: { actor_identity: string }) => r.actor_identity === adminId)).toBe(true);
  });
});
