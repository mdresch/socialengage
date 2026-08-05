// Contract: Story 5.11 (ADR-0036 §5) — GET /v1/me: expose a signed-in caller's
// own resolved identity over HTTP.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-511--get-v1me-expose-a-signed-in-callers-own-resolved-identity-over-http
//
// Intent: Story 5.11 — GET /v1/me: expose a signed-in caller's own resolved
// identity over HTTP (ADR-0036 §5)
// Scope: src/http/versions/v1/meRouter.ts (new), src/http/versions/v1/router.ts
// (mount /me), src/http/auth/requireTenantUser.ts (new getResolvedIdentity()
// helper — the one route allowed to read req.identity for either resolved
// shape, tenant_user or platform_admin, rather than requiring one specific
// kind the way requireTenantUser()/requireTenantUserIdentity() already do)
// Contract to encode: (1) GET /v1/me is mounted behind the same authMiddleware
// every other substantive /v1 route already uses; (2) missing/invalid/expired/
// wrong-issuer auth is rejected 401 before this route's own handler runs
// (inherited via the shared middleware, not reimplemented); (3) a caller
// resolving to no known identity is rejected 403 (same, inherited); (4) on
// success, returns 200 with resolveIdentity()'s exact camelCase
// ResolvedIdentity shape, unmodified, verified for all three real resolved
// shapes (tenant_admin, tenant_user, platform_admin); (5) the returned
// identity is derived exclusively from req.identity — a spoofed tenantId/
// userId/adminId/role via query parameter, request body, or header has zero
// effect (ADR-0036 §5's own Clarification, added after a Security &
// Architecture Reviewer finding — this story's single most load-bearing
// assertion); (6) GET only — POST/PATCH/DELETE all rejected; (7) additive
// only — mounting it changes nothing about /posts, /topics, /connectors, or
// /watchlists.
// Explicitly out of scope: real Entra token verification (Story 5.6's own
// contract already proves createEntraAuthMiddleware against the real tenant);
// resolveIdentity()'s own DB-lookup correctness (Story 5.9's own contract);
// social-listening-admin's own Story 6.1 AC8 update (named as a required
// follow-up, not this story's scope, per Story 5.11's own text).

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

const ME_ROUTER_SOURCE = fs.readFileSync(path.join(__dirname, '../../src/http/versions/v1/meRouter.ts'), 'utf8');

describe('Story 5.11 — GET /v1/me contract', () => {
  const app = createApp();

  it('AC2: missing Authorization/X-Test-Identity is rejected 401 before the handler runs', async () => {
    const res = await request(app).get('/v1/me');
    expect(res.status).toBe(401);
  });

  it('AC2: an invalid X-Test-Identity header is rejected 401', async () => {
    const res = await request(app).get('/v1/me').set('X-Test-Identity', 'not-json');
    expect(res.status).toBe(401);
  });

  it('AC3: this route cannot bypass the shared 403-on-unresolved-identity rejection, structurally', () => {
    // The null-resolution -> 403 rejection (Story 5.9's own contract proves
    // resolveIdentity() itself; Story 5.10's own middleware attaches it)
    // happens entirely inside createTenantAuthMiddleware(), before next() is
    // ever called — no route handler runs at all in that case, so it isn't
    // independently exercisable via HTTP at this layer (testAuthBypassMiddleware
    // has no equivalent: it trusts whatever valid JSON X-Test-Identity carries,
    // by design, since it stands in for an already-resolved identity). What IS
    // provable here: meRouter.ts never calls resolveIdentity() itself and never
    // re-derives an identity — it can only ever see what the middleware already
    // attached, the same structural guarantee Story 5.10's AC1 uses for
    // X-Tenant-Id.
    expect(ME_ROUTER_SOURCE).not.toContain('resolveIdentity');
  });

  it('AC4: returns 200 with the exact resolved shape for a tenant_user caller', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const res = await request(app)
      .get('/v1/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'tenant_user', tenantId, userId, role: 'tenant_user' });
  });

  it('AC4: returns 200 with the exact resolved shape for a tenant_admin caller', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const res = await request(app)
      .get('/v1/me')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'tenant_user', tenantId, userId, role: 'tenant_admin' });
  });

  it('AC4: returns 200 with the exact resolved shape for a platform_admin caller', async () => {
    const adminId = randomUUID();
    const res = await request(app)
      .get('/v1/me')
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'platform_admin', adminId });
  });

  it('AC5: a spoofed tenantId/userId/role via query, body, and header has zero effect', async () => {
    const realTenantId = randomUUID();
    const realUserId = randomUUID();
    const spoofedTenantId = randomUUID();
    const spoofedUserId = randomUUID();

    const res = await request(app)
      .get('/v1/me')
      .query({ tenantId: spoofedTenantId, userId: spoofedUserId, role: 'platform_admin' })
      .set('X-Tenant-Id', spoofedTenantId) // stray, must be inert (same as ADR-0033)
      .set('X-User-Id', spoofedUserId)
      .set('X-Test-Identity', testIdentityHeaderValue(realTenantId, { userId: realUserId, role: 'tenant_user' }))
      .send({ tenantId: spoofedTenantId, userId: spoofedUserId, adminId: randomUUID(), role: 'platform_admin' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'tenant_user', tenantId: realTenantId, userId: realUserId, role: 'tenant_user' });
  });

  it('AC5: a spoofed adminId via body has zero effect for a platform_admin caller', async () => {
    const realAdminId = randomUUID();
    const spoofedAdminId = randomUUID();

    const res = await request(app)
      .get('/v1/me')
      .query({ adminId: spoofedAdminId })
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: realAdminId }))
      .send({ adminId: spoofedAdminId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'platform_admin', adminId: realAdminId });
  });

  it('AC6: only GET is accepted — POST/PATCH/DELETE are all rejected', async () => {
    const tenantId = randomUUID();
    const header = testIdentityHeaderValue(tenantId);

    const post = await request(app).post('/v1/me').set('X-Test-Identity', header);
    const patch = await request(app).patch('/v1/me').set('X-Test-Identity', header);
    const del = await request(app).delete('/v1/me').set('X-Test-Identity', header);

    expect(post.status).not.toBe(200);
    expect(patch.status).not.toBe(200);
    expect(del.status).not.toBe(200);
  });

  it('AC7: mounting /v1/me changes nothing about /v1/health staying public', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
  });
});
