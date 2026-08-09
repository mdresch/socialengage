// Contract: Story 1.9 (ADR-0032) — User invitation and offboarding REST surface.
// See docs/user-stories/epic-1-repository-and-api-foundation.md#story-19
//
// AC1: POST /v1/tenants/users — invited user, tenant_admin only, 403 for tenant_user
// AC2: POST — 409 when active_seat_count >= license_seat_count
// AC3: POST — does NOT increment active_seat_count at invite time
// AC4: GET /v1/tenants/users — lists users (invited+active), both roles, RLS-scoped
// AC5: PATCH /v1/tenants/users/:id — sets/clears access_ends_at, tenant_admin only
// AC6: PATCH — decrements seat on now-or-past; no change for future-dated
// AC7: PATCH null — re-increments seat; 409 at ceiling
// AC8: Two-tenant isolation on all three endpoints
// AC9: PATCH writes audit row to user_access_audit_log

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

// Fixtures

async function createTenantFixture(name: string, licenseSeatCount = 5): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, licenseSeatCount]
  );
  return rows[0];
}

async function setActiveSeatCount(tenantId: string, count: number): Promise<void> {
  // app_user can write active_seat_count; platform_admin_role is intentionally denied (Story 5.8 AC3)
  await withTenant(tenantId, (client) =>
    client.query(`UPDATE tenants SET active_seat_count = $1 WHERE id = $2`, [count, tenantId])
  );
}

async function getActiveSeatCount(tenantId: string): Promise<number> {
  const { rows } = await withTenant(tenantId, (client) =>
    client.query<{ active_seat_count: number }>(
      `SELECT active_seat_count FROM tenants WHERE id = $1`,
      [tenantId]
    )
  );
  return rows[0].active_seat_count;
}

function adminHeader(tenantId: string, userId?: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_admin', userId: userId ?? randomUUID() });
}
function userHeader(tenantId: string): string {
  return testIdentityHeaderValue(tenantId, { role: 'tenant_user' });
}

// Suite

describe('Story 1.9 � /v1/tenants/users contract', () => {
  const app = createApp();

  // AC1 � POST invite + role gate

  it('AC1: POST creates an invited user row (tenant_admin)', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac1-${randomUUID()}`);
    const email = `invite-${randomUUID()}@example.com`;
    const res = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id)).send({ email });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.status).toBe('invited');
    expect(res.body.externalSubject).toBeNull();
    expect(res.body.tenantId).toBe(tenant.id);
    expect(res.body.role).toBe('tenant_user');
  });

  it('AC1: POST returns 403 for a tenant_user caller', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac1b-${randomUUID()}`);
    const res = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', userHeader(tenant.id))
      .send({ email: `x-${randomUUID()}@example.com` });
    expect(res.status).toBe(403);
  });

  it('AC1: POST returns 401 for missing identity', async () => {
    const res = await request(app).post('/v1/tenants/users').send({ email: 'x@example.com' });
    expect(res.status).toBe(401);
  });

  it('AC1: POST returns 400 when email is missing', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac1c-${randomUUID()}`);
    const res = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id)).send({});
    expect(res.status).toBe(400);
  });

  it('AC1: POST accepts explicit role tenant_admin', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac1d-${randomUUID()}`);
    const res = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `r-${randomUUID()}@example.com`, role: 'tenant_admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('tenant_admin');
  });

  // AC2 � seat ceiling

  it('AC2: POST returns 409 when at license_seat_count ceiling', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac2-${randomUUID()}`, 2);
    await setActiveSeatCount(tenant.id, 2);
    const res = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `ov-${randomUUID()}@example.com` });
    expect(res.status).toBe(409);
  });

  // AC3 � no seat increment on invite

  it('AC3: POST does not increment active_seat_count', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac3-${randomUUID()}`);
    const before = await getActiveSeatCount(tenant.id);
    await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `ns-${randomUUID()}@example.com` });
    expect(await getActiveSeatCount(tenant.id)).toBe(before);
  });

  // AC4 � GET list

  it('AC4: GET returns 200 with users array for tenant_admin', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac4a-${randomUUID()}`);
    await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `l-${randomUUID()}@example.com` });
    const res = await request(app).get('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  it('AC4: GET returns 200 for tenant_user (no role gate on GET)', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac4b-${randomUUID()}`);
    const res = await request(app).get('/v1/tenants/users')
      .set('X-Test-Identity', userHeader(tenant.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('AC4: GET includes invited rows in the listing', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac4c-${randomUUID()}`);
    const email = `iv-${randomUUID()}@example.com`;
    await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id)).send({ email });
    const res = await request(app).get('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id));
    const found = res.body.users.find((u: { email: string }) => u.email === email);
    expect(found).toBeDefined();
    expect(found.status).toBe('invited');
  });

  it('AC4: GET returns 401 for missing identity', async () => {
    const res = await request(app).get('/v1/tenants/users');
    expect(res.status).toBe(401);
  });

  // AC5 � PATCH role gate + validation

  it('AC5: PATCH returns 403 for tenant_user caller', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac5a-${randomUUID()}`);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `pt-${randomUUID()}@example.com` });
    const res = await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', userHeader(tenant.id))
      .send({ accessEndsAt: new Date(Date.now() - 1000).toISOString() });
    expect(res.status).toBe(403);
  });

  it('AC5: PATCH returns 400 when accessEndsAt key is absent from body', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac5b-${randomUUID()}`);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `p4-${randomUUID()}@example.com` });
    const res = await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id)).send({});
    expect(res.status).toBe(400);
  });

  it('AC5: PATCH returns 404 for unknown userId', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac5c-${randomUUID()}`);
    const res = await request(app).patch(`/v1/tenants/users/${randomUUID()}`)
      .set('X-Test-Identity', adminHeader(tenant.id)).send({ accessEndsAt: null });
    expect(res.status).toBe(404);
  });

  // AC6 � seat adjustment on PATCH

  it('AC6: PATCH with now-or-past access_ends_at decrements active_seat_count', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac6a-${randomUUID()}`, 5);
    await setActiveSeatCount(tenant.id, 3);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `dc-${randomUUID()}@example.com` });
    await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ accessEndsAt: new Date(Date.now() - 5000).toISOString() });
    expect(await getActiveSeatCount(tenant.id)).toBe(2);
  });

  it('AC6: PATCH with future-dated access_ends_at does NOT decrement active_seat_count', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac6b-${randomUUID()}`, 5);
    await setActiveSeatCount(tenant.id, 3);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `fd-${randomUUID()}@example.com` });
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ accessEndsAt: future });
    expect(await getActiveSeatCount(tenant.id)).toBe(3); // unchanged
  });

  // AC7 � reactivation (null) re-increments, 409 at ceiling

  it('AC7: PATCH null re-increments active_seat_count (reactivation)', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac7a-${randomUUID()}`, 5);
    await setActiveSeatCount(tenant.id, 2);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `re-${randomUUID()}@example.com` });
    // First offboard (immediate)
    await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ accessEndsAt: new Date(Date.now() - 1000).toISOString() });
    expect(await getActiveSeatCount(tenant.id)).toBe(1); // decremented
    // Reactivate by clearing access_ends_at
    const reRes = await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ accessEndsAt: null });
    expect(reRes.status).toBe(200);
    expect(await getActiveSeatCount(tenant.id)).toBe(2); // re-incremented
  });

  it('AC7: PATCH null returns 409 when tenant is at license ceiling', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac7b-${randomUUID()}`, 2);
    await setActiveSeatCount(tenant.id, 2); // at ceiling
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ email: `c2-${randomUUID()}@example.com` });
    // Even though POST succeeded (seat not yet consumed), try to reactivate past ceiling
    const res = await request(app).patch(`/v1/tenants/users/${postRes.body.id}`)
      .set('X-Test-Identity', adminHeader(tenant.id))
      .send({ accessEndsAt: null });
    expect(res.status).toBe(409);
  });

  // AC8 � two-tenant isolation

  it('AC8: GET /v1/tenants/users is RLS-scoped � tenant A cannot see tenant B users', async () => {
    const tenantA = await createTenantFixture(`T-1.9-ac8a-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-1.9-ac8b-${randomUUID()}`);
    const emailA = `a-${randomUUID()}@example.com`;
    const emailB = `b-${randomUUID()}@example.com`;
    await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantA.id)).send({ email: emailA });
    await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantB.id)).send({ email: emailB });
    const resA = await request(app).get('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantA.id));
    const resB = await request(app).get('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantB.id));
    const emailsA = resA.body.users.map((u: { email: string }) => u.email);
    const emailsB = resB.body.users.map((u: { email: string }) => u.email);
    expect(emailsA).toContain(emailA);
    expect(emailsA).not.toContain(emailB);
    expect(emailsB).toContain(emailB);
    expect(emailsB).not.toContain(emailA);
  });

  it('AC8: POST /v1/tenants/users creates in caller tenant only', async () => {
    const tenantA = await createTenantFixture(`T-1.9-ac8c-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-1.9-ac8d-${randomUUID()}`);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantA.id))
      .send({ email: `iso-${randomUUID()}@example.com` });
    expect(postRes.status).toBe(201);
    expect(postRes.body.tenantId).toBe(tenantA.id);
    expect(postRes.body.tenantId).not.toBe(tenantB.id);
  });

  it('AC8: PATCH cannot modify a user from a different tenant', async () => {
    const tenantA = await createTenantFixture(`T-1.9-ac8e-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-1.9-ac8f-${randomUUID()}`);
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenantA.id))
      .send({ email: `xp-${randomUUID()}@example.com` });
    const userId = postRes.body.id;
    // Tenant B admin tries to PATCH a user that belongs to tenant A
    const res = await request(app).patch(`/v1/tenants/users/${userId}`)
      .set('X-Test-Identity', adminHeader(tenantB.id))
      .send({ accessEndsAt: new Date(Date.now() - 1000).toISOString() });
    // RLS means the row is invisible to tenant B � returns 404, not 403
    expect(res.status).toBe(404);
  });

  // AC9 � audit log written on PATCH

  it('AC9: PATCH writes an audit row to user_access_audit_log', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac9a-${randomUUID()}`);
    const actorId = randomUUID();
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id, actorId))
      .send({ email: `aud-${randomUUID()}@example.com` });
    const userId = postRes.body.id;
    const accessEndsAt = new Date(Date.now() - 1000).toISOString();
    await request(app).patch(`/v1/tenants/users/${userId}`)
      .set('X-Test-Identity', adminHeader(tenant.id, actorId))
      .send({ accessEndsAt });
    // Verify the audit row was written — must go through withTenant (app_user); platform_admin has no SELECT grant
    const { rows } = await withTenant(tenant.id, (client) =>
      client.query<{
        tenant_id: string; target_user_id: string; actor_user_id: string;
        operation: string; new_value: string | null;
      }>(`SELECT * FROM user_access_audit_log WHERE target_user_id = $1 ORDER BY occurred_at DESC LIMIT 1`, [userId])
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tenant_id).toBe(tenant.id);
    expect(rows[0].target_user_id).toBe(userId);
    expect(rows[0].actor_user_id).toBe(actorId);
    expect(rows[0].operation).toBe('set_access_ends_at');
    expect(rows[0].new_value).not.toBeNull();
  });

  it('AC9: PATCH clearing access_ends_at writes a clear_access_ends_at audit row', async () => {
    const tenant = await createTenantFixture(`T-1.9-ac9b-${randomUUID()}`, 5);
    await setActiveSeatCount(tenant.id, 1);
    const actorId = randomUUID();
    const postRes = await request(app).post('/v1/tenants/users')
      .set('X-Test-Identity', adminHeader(tenant.id, actorId))
      .send({ email: `clr-${randomUUID()}@example.com` });
    const userId = postRes.body.id;
    // Offboard first
    await request(app).patch(`/v1/tenants/users/${userId}`)
      .set('X-Test-Identity', adminHeader(tenant.id, actorId))
      .send({ accessEndsAt: new Date(Date.now() - 1000).toISOString() });
    // Reactivate
    await request(app).patch(`/v1/tenants/users/${userId}`)
      .set('X-Test-Identity', adminHeader(tenant.id, actorId))
      .send({ accessEndsAt: null });
    const { rows } = await withTenant(tenant.id, (client) =>
      client.query<{ operation: string; new_value: string | null }>(`SELECT operation, new_value FROM user_access_audit_log WHERE target_user_id = $1 ORDER BY occurred_at DESC LIMIT 1`, [userId])
    );
    expect(rows[0].operation).toBe('clear_access_ends_at');
    expect(rows[0].new_value).toBeNull();
  });
});
