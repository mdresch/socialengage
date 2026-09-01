// Contract: Story 13.6 (ADR-0112) — Platform-Admin tenant plan read surface.
// See docs/user-stories/epic-13-adr-0109-to-0117.md#story-136
//
// Intent: Story 13.6 adds the admin UI for plan and seat management. The
// frontend needs a backend read of a specific tenant's plan, max_seats, used
// seats, and effective feature gates, so this contract proves GET
// /v1/admin/tenants/:id/plan.
//
// Scope: src/http/versions/v1/adminTenantsRouter.ts, src/tenants/tenantStore.ts.
//
// Contract to encode:
//   (1) A platform_admin identity can GET /v1/admin/tenants/:id/plan and
//       receive plan, maxSeats, usedSeats, licenseSeatCount, featureGates.
//   (2) A tenant_admin/tenant_user identity receives 403.
//   (3) A missing tenant receives 404.
//   (4) No identity at all receives 401.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

describe('Story 13.6 — Platform-Admin tenant plan read', () => {
  const app = createApp();

  it('GET /v1/admin/tenants/:id/plan returns plan, seat usage, and feature gates', async () => {
    const created = await request(app)
      .post('/v1/admin/tenants')
      .set('X-Test-Identity', platformAdminHeader())
      .send({ name: `T-${randomUUID()}`, licenseSeatCount: 5, plan: 'pro' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/v1/admin/tenants/${created.body.id}/plan`)
      .set('X-Test-Identity', platformAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.maxSeats).toBeGreaterThanOrEqual(5);
    expect(res.body.licenseSeatCount).toBe(5);
    expect(res.body.usedSeats).toBe(0);
    expect(res.body.featureGates).toBeDefined();
    expect(typeof res.body.featureGates).toBe('object');
  });

  it('GET /v1/admin/tenants/:id/plan returns 403 for a tenant identity', async () => {
    const res = await request(app)
      .get(`/v1/admin/tenants/${randomUUID()}/plan`)
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()));
    expect(res.status).toBe(403);
  });

  it('GET /v1/admin/tenants/:id/plan returns 404 for an unknown tenant', async () => {
    const res = await request(app)
      .get(`/v1/admin/tenants/${randomUUID()}/plan`)
      .set('X-Test-Identity', platformAdminHeader());
    expect(res.status).toBe(404);
  });

  it('GET /v1/admin/tenants/:id/plan returns 401 without an identity header', async () => {
    const res = await request(app).get(`/v1/admin/tenants/${randomUUID()}/plan`);
    expect(res.status).toBe(401);
  });
});
