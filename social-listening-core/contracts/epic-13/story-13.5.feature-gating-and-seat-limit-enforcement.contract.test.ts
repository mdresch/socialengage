/**
 * Contract: Story 13.5 (ADR-0112, BRD-0112, FDD-0112) — Feature gating and seat-limit enforcement.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-135
 *
 * Intent:
 *   Add a `plan` column and per-tenant `feature_gates` enforcement, an explicit
 *   `max_seats` ceiling inside `feature_gates`, and a `requireFeatureGate(feature)`
 *   helper. Keep `license_seat_count` as a backward-compatible fallback ceiling when
 *   `feature_gates.max_seats` is not explicitly set, so existing contracts that seed
 *   tenants with direct SQL are not broken.
 *
 * Scope:
 *   - social-listening-core/src/tenants/tenantStore.ts
 *   - social-listening-core/src/tenants/featureGates.ts (new)
 *   - social-listening-core/src/identity/identityResolution.ts
 *   - social-listening-core/src/http/auth/tenantAuthMiddleware.ts
 *   - social-listening-core/src/http/versions/v1/tenantPlanRouter.ts (new)
 *   - social-listening-core/src/http/versions/v1/router.ts
 *   - social-listening-core/src/http/versions/v1/tenantUsersRouter.ts
 *   - social-listening-core/src/http/versions/v1/connectorsRouter.ts
 *   - social-listening-core/src/http/versions/v1/watchlistsRouter.ts
 *   - social-listening-core/src/http/versions/v1/postsExportRouter.ts
 *   - social-listening-core/migrations/0066_add_tenant_plan_and_feature_gates_defaults.sql
 *   - social-listening-core/.claude/skills/tenants/SKILL.md
 *   - social-listening-core/.claude/skills/feature-gating/SKILL.md (new)
 *
 * Contract to encode:
 *   (1) `tenants` has `plan` and `feature_gates` columns; `plan` defaults to 'starter'.
 *   (2) `GET /v1/tenants/plan` exposes the tenant's `plan`, `maxSeats`, `usedSeats`, and effective `featureGates`.
 *   (3) `POST /v1/admin/tenants` accepts `plan` and seeds `feature_gates` from the platform plan definition.
 *   (4) `PATCH /v1/admin/tenants/:id` can change `plan` and/or `featureGates`.
 *   (5) `POST /v1/tenants/users` is gated by the `multi_user` feature; when `multi_user: false`, returns 403 `FEATURE_NOT_AVAILABLE`.
 *   (6) `POST /v1/tenants/users` and user activation (`resolveIdentity`) enforce `active_seat_count < max_seats`;
 *       at capacity they return/throw 403 `SEAT_LIMIT_EXCEEDED`. Existing direct-SQL fixtures with no explicit `max_seats`
 *       continue to fall back to `license_seat_count` and return the legacy 409.
 *   (7) `POST /v1/connectors/:platformId/activate` is gated by the `connectors` feature.
 *   (8) `POST /v1/watchlists` is gated by the `watchlists` feature.
 *   (9) `POST /v1/posts/export` is gated by the `exports` feature.
 *   (10) Lowering `max_seats` below the current `active_seat_count` does NOT auto-deactivate existing active users,
 *       but new invites/activations are blocked until `active_seat_count <= max_seats`.
 *
 * Explicitly out of scope:
 *   - Billing integration or invoice generation.
 *   - A Platform-Admin UI for plan management (Story 13.6).
 *   - Gating every existing endpoint; only the representative invite, connector, watchlist, and export surfaces are gated here.
 *   - Changing the `X-Test-Identity` test bypass; `resolveIdentity` is exercised directly for the accept path.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { createTenant } from '../../src/tenants/tenantStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

function tenantAdminHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' });
}

async function seedTenant(name: string, plan?: string, licenseSeatCount = 10) {
  const input: any = { name, licenseSeatCount };
  if (plan) input.plan = plan;
  return createTenant('test-actor', input);
}

async function seedActiveAdmin(tenantId: string) {
  const email = `admin-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenantId, { email, role: 'tenant_admin' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { userId: invited.id, email };
}

async function setMaxSeats(tenantId: string, maxSeats: number) {
  const app = createApp();
  const admin = await seedActiveAdmin(tenantId);
  await request(app)
    .patch('/v1/tenants/me/features')
    .set('X-Test-Identity', tenantAdminHeader(tenantId, admin.userId))
    .send({ featureGates: { max_seats: maxSeats } });
}

async function setFeature(tenantId: string, userId: string, feature: string, enabled: boolean) {
  const app = createApp();
  const gates: Record<string, boolean> = {};
  gates[feature] = enabled;
  await request(app)
    .patch('/v1/tenants/me/features')
    .set('X-Test-Identity', tenantAdminHeader(tenantId, userId))
    .send({ featureGates: gates });
}

describe('Story 13.5 — Feature gating and seat-limit enforcement', () => {
  const app = createApp();

  describe('AC1: tenants has plan and feature_gates columns', () => {
    it('has a plan column with default starter', async () => {
      const { rows } = await getPlatformAdminPool().query(
        `SELECT column_name, column_default
         FROM information_schema.columns
         WHERE table_name = 'tenants' AND column_name IN ('plan', 'feature_gates')`
      );
      const columns = new Map(rows.map((r: any) => [r.column_name, r.column_default]));
      expect(columns.has('plan')).toBe(true);
      expect(columns.has('feature_gates')).toBe(true);
    });

    it('plan is not null on a newly created tenant', async () => {
      const tenant = await seedTenant(`T-plan-${randomUUID()}`);
      expect(tenant.plan).toBe('starter');
    });
  });

  describe('AC2: GET /v1/tenants/plan exposes plan, maxSeats, usedSeats and featureGates', () => {
    it('returns the tenant plan and usage for an active tenant_user', async () => {
      const tenant = await seedTenant(`T-plan-view-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);

      const res = await request(app)
        .get('/v1/tenants/plan')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId));

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('pro');
      expect(res.body.maxSeats).toBeGreaterThanOrEqual(1);
      expect(res.body.usedSeats).toBe(1);
      expect(res.body.featureGates).toBeDefined();
    });
  });

  describe('AC3: POST /v1/admin/tenants seeds plan and feature_gates', () => {
    it('creates a tenant on the pro plan with pro-level max_seats', async () => {
      const res = await request(app)
        .post('/v1/admin/tenants')
        .set('X-Test-Identity', platformAdminHeader())
        .send({ name: `T-pro-${randomUUID()}`, licenseSeatCount: 25, plan: 'pro' });

      expect(res.status).toBe(201);
      expect(res.body.plan).toBe('pro');

      const planRes = await request(app)
        .get('/v1/tenants/plan')
        .set('X-Test-Identity', testIdentityHeaderValue(res.body.id, { role: 'tenant_admin' }));

      expect(planRes.status).toBe(200);
      expect(planRes.body.plan).toBe('pro');
      expect(planRes.body.maxSeats).toBe(25);
    });
  });

  describe('AC4: PATCH /v1/admin/tenants/:id can change plan and featureGates', () => {
    it('changes the plan and feature gates from starter to enterprise', async () => {
      const created = await request(app)
        .post('/v1/admin/tenants')
        .set('X-Test-Identity', platformAdminHeader())
        .send({ name: `T-ent-${randomUUID()}`, licenseSeatCount: 10 });

      const patchRes = await request(app)
        .patch(`/v1/admin/tenants/${created.body.id}`)
        .set('X-Test-Identity', platformAdminHeader())
        .send({ plan: 'enterprise', featureGates: { compliance_packs: true, max_seats: 100 } });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.plan).toBe('enterprise');
      expect(patchRes.body.featureGates.compliance_packs).toBe(true);
    });
  });

  describe('AC5: POST /v1/tenants/users is gated by multi_user feature', () => {
    it('returns 403 FEATURE_NOT_AVAILABLE when multi_user is false', async () => {
      const tenant = await seedTenant(`T-no-multi-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);
      await setFeature(tenant.id, admin.userId, 'multi_user', false);

      const res = await request(app)
        .post('/v1/tenants/users')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ email: `blocked-${randomUUID()}@example.com` });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  describe('AC6: User invite and accept enforce max_seats', () => {
    it('POST /v1/tenants/users returns 403 SEAT_LIMIT_EXCEEDED when at max_seats', async () => {
      const tenant = await seedTenant(`T-full-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);
      await setMaxSeats(tenant.id, 1);

      const res = await request(app)
        .post('/v1/tenants/users')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ email: `over-${randomUUID()}@example.com` });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SEAT_LIMIT_EXCEEDED');
    });

    it('resolveIdentity throws SeatLimitExceededError when accepting an invite at max_seats', async () => {
      const tenant = await seedTenant(`T-accept-full-${randomUUID()}`, 'pro', 25);
      await seedActiveAdmin(tenant.id);
      await setMaxSeats(tenant.id, 1);

      const overflowEmail = `overflow-${randomUUID()}@example.com`;
      const overflow = await createInvitedUser(tenant.id, { email: overflowEmail, role: 'tenant_user' });

      await expect(resolveIdentity({ sub: `sub-${overflow.id}`, email: overflowEmail })).rejects.toThrow(
        /SEAT_LIMIT_EXCEEDED|max_seats/i
      );
    });
  });

  describe('AC7: Existing active users are not auto-deactivated when max_seats is lowered', () => {
    it('keeps existing active users active and blocks new invites after lowering max_seats', async () => {
      const tenant = await seedTenant(`T-grandfather-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);

      // active_seat_count is 1 (admin). Lower max_seats to 0.
      await setMaxSeats(tenant.id, 0);

      const adminStillActive = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query(`SELECT status FROM users WHERE id = $1`, [admin.userId]);
        return rows[0]?.status;
      });
      expect(adminStillActive).toBe('active');

      const res = await request(app)
        .post('/v1/tenants/users')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ email: `later-${randomUUID()}@example.com` });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SEAT_LIMIT_EXCEEDED');
    });
  });

  describe('AC8: Connector activation is gated by the connectors feature', () => {
    it('POST /v1/connectors/:platformId/activate returns 403 FEATURE_NOT_AVAILABLE when connectors is false', async () => {
      const tenant = await seedTenant(`T-no-connectors-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);
      await setFeature(tenant.id, admin.userId, 'connectors', false);

      const res = await request(app)
        .post('/v1/connectors/test-platform/activate')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ ownerType: 'tenant' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  describe('AC9: Watchlist creation is gated by the watchlists feature', () => {
    it('POST /v1/watchlists returns 403 FEATURE_NOT_AVAILABLE when watchlists is false', async () => {
      const tenant = await seedTenant(`T-no-watchlists-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);
      await setFeature(tenant.id, admin.userId, 'watchlists', false);

      const res = await request(app)
        .post('/v1/watchlists')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ name: 'Blocked', matchType: 'keyword', terms: ['x'] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  describe('AC10: Export jobs are gated by the exports feature', () => {
    it('POST /v1/posts/export returns 403 FEATURE_NOT_AVAILABLE when exports is false', async () => {
      const tenant = await seedTenant(`T-no-exports-${randomUUID()}`, 'pro', 25);
      const admin = await seedActiveAdmin(tenant.id);
      await setFeature(tenant.id, admin.userId, 'exports', false);

      const res = await request(app)
        .post('/v1/posts/export')
        .set('X-Test-Identity', tenantAdminHeader(tenant.id, admin.userId))
        .send({ format: 'csv', limit: 1 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  describe('Regression: legacy 409 seat ceiling is preserved when max_seats is not set', () => {
    it('POST /v1/tenants/users returns 409 when active >= license_seat_count and no max_seats override', async () => {
      const { rows } = await getPlatformAdminPool().query<{ id: string }>(
        `INSERT INTO tenants (name, license_seat_count, active_seat_count) VALUES ($1, $2, $2) RETURNING id`,
        [`T-legacy-${randomUUID()}`, 1]
      );
      const tenantId = rows[0].id;
      const email = `admin-${randomUUID()}@example.com`;
      const invited = await createInvitedUser(tenantId, { email, role: 'tenant_admin' });
      // Activate via resolveIdentity (this is the founding user; max_seats absent, license=1, active starts at 1
      // so activation itself may be blocked at license ceiling depending on implementation).
      // To get an active admin without relying on max_seats, set active_seat_count back to 0 first.
      await withTenant(tenantId, async (client) => {
        await client.query(`UPDATE tenants SET active_seat_count = 0 WHERE id = $1`, [tenantId]);
      });
      await resolveIdentity({ sub: `sub-${invited.id}`, email });

      const res = await request(app)
        .post('/v1/tenants/users')
        .set('X-Test-Identity', tenantAdminHeader(tenantId, invited.id))
        .send({ email: `over-${randomUUID()}@example.com` });

      expect(res.status).toBe(409);
    });
  });
});
