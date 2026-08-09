// Contract: Story 1.8 (ADR-0031) — Tenant self-view REST endpoint.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-18--tenant-self-view-rest-endpoint
//
// Intent: Story 1.8 — GET /v1/tenants/me (ADR-0031; no new ADR needed)
// Scope: src/http/versions/v1/tenantSelfViewRouter.ts (new),
//   src/http/versions/v1/router.ts (mount /tenants/me),
//   .claude/skills/tenants/SKILL.md (updated)
// Contract to encode:
//   (1) GET /v1/tenants/me returns 200 with { id, name, status,
//       licenseSeatCount, activeSeatCount, domain, createdAt } for a
//       resolved tenant_user or tenant_admin identity, read via the ordinary
//       withTenant() / app_user path — never platform_admin_role;
//   (2) a platform_admin identity receives 403 (zero-tenant-content boundary,
//       ADR-0030 §2);
//   (3) missing / invalid X-Test-Identity is rejected 401 before the
//       handler runs (inherited from shared authMiddleware);
//   (4) the route returns exactly the caller's own tenant — a two-tenant
//       isolation test confirms no cross-tenant bleed;
//   (5) POST/PATCH/DELETE at this path are not defined — additive-only,
//       no write surface exposed here.
// Explicitly out of scope: re-proving RLS mechanics at the DB layer —
//   Story 5.8's contract already does this; this story proves only the
//   HTTP surface. Updating status/license_seat_count/domain remains
//   Platform-Admin-only (Story 5.12).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

/** Helper: create a real tenant via platform_admin_role pool for test fixtures. */
async function createTenantFixture(name: string, licenseSeatCount = 5): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, licenseSeatCount]
  );
  return rows[0];
}

describe('Story 1.8 — GET /v1/tenants/me contract', () => {
  const app = createApp();

  it('AC1: GET /v1/tenants/me is mounted and reachable through the shared authMiddleware', async () => {
    const tenant = await createTenantFixture(`T-1.8-ac1-${randomUUID()}`);
    const res = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id));
    expect(res.status).toBe(200);
  });

  it('AC2: missing X-Test-Identity is rejected 401 before the handler runs', async () => {
    const res = await request(app).get('/v1/tenants/me');
    expect(res.status).toBe(401);
  });

  it('AC2: invalid X-Test-Identity is rejected 401', async () => {
    const res = await request(app).get('/v1/tenants/me').set('X-Test-Identity', 'not-valid-json');
    expect(res.status).toBe(401);
  });

  it('AC3: a platform_admin identity receives 403 (zero-tenant-content boundary, ADR-0030 §2)', async () => {
    const res = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', platformAdminHeader());
    expect(res.status).toBe(403);
  });

  it('AC4: returns 200 with the correct tenant shape for a tenant_user identity', async () => {
    const tenant = await createTenantFixture(`T-1.8-ac4-${randomUUID()}`, 10);
    const res = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: tenant.id,
      status: 'active',
      licenseSeatCount: 10,
      activeSeatCount: 0,
    });
    expect(typeof res.body.name).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
    // domain is nullable — just confirm the key is present
    expect('domain' in res.body).toBe(true);
  });

  it('AC4: returns 200 with the correct tenant shape for a tenant_admin identity', async () => {
    const tenant = await createTenantFixture(`T-1.8-ac4-admin-${randomUUID()}`, 3);
    const res = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(tenant.id);
    expect(res.body.licenseSeatCount).toBe(3);
  });

  it('AC5: returns exactly the caller\'s own tenant — cross-tenant isolation', async () => {
    const tenantA = await createTenantFixture(`T-1.8-isolA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-1.8-isolB-${randomUUID()}`);

    const resA = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id));
    const resB = await request(app)
      .get('/v1/tenants/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantB.id));

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.id).toBe(tenantA.id);
    expect(resB.body.id).toBe(tenantB.id);
    // Confirm A session never returns B's data and vice versa
    expect(resA.body.id).not.toBe(tenantB.id);
    expect(resB.body.id).not.toBe(tenantA.id);
  });

  it('AC6: POST/PATCH/DELETE at /v1/tenants/me are not defined (additive-only, no write surface)', async () => {
    const tenant = await createTenantFixture(`T-1.8-ac6-${randomUUID()}`);
    const header = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' });

    const post = await request(app).post('/v1/tenants/me').set('X-Test-Identity', header);
    const patch = await request(app).patch('/v1/tenants/me').set('X-Test-Identity', header);
    const del = await request(app).delete('/v1/tenants/me').set('X-Test-Identity', header);

    // Express returns 404 for unregistered methods on a route
    expect(post.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });
});
