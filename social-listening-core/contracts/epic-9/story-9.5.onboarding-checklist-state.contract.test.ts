// Contract: Story 9.5 (ADR-0080) — Onboarding checklist state (backend)
// See docs/user-stories/epic-9-adr-0077-to-0085.md#story-95
//
// Intent: Story 9.5 — tenants.onboarding_checklist + GET/PATCH
//   /v1/tenants/:id/onboarding-checklist (ADR-0080, Accepted 2026-08-24)
// Scope:
//   migrations/0043_add_tenants_onboarding_checklist.sql (new — onboarding_checklist
//     JSONB column + column-scoped app_user UPDATE grant),
//   src/tenants/onboardingChecklist.ts (new — bundled-EXISTS derivation, one-way
//     JSONB milestone caching, dismiss/reset/hidden-advanced-steps mutation),
//   src/http/versions/v1/onboardingChecklistRouter.ts (new — GET/PATCH route handlers),
//   src/http/versions/v1/router.ts (mount /tenants/:id/onboarding-checklist),
//   .claude/skills/onboarding-checklist/SKILL.md (new)
// Contract to encode:
//   AC1: tenants.onboarding_checklist is a JSONB column (NOT NULL DEFAULT the
//        pending shape) with steps.{connect_source,build_watchlist,invite_user,
//        verify_posts} and advanced_steps.{enable_enrichment,configure_alerts} —
//        every existing/newly-created tenant has it populated, never null.
//   AC2: GET /v1/tenants/:id/onboarding-checklist returns 200 with
//        OnboardingChecklistResponse (isComplete, progressPercentage, dismissed,
//        dismissedAt, steps, advancedSteps) for a tenant_admin OR tenant_user of
//        that tenant; a cross-tenant caller (identity.tenantId !== :id) gets 404.
//   AC3: core-step completion is derived from real underlying data via a single
//        bundled SELECT EXISTS query (connect_source <- connector_activations
//        is_active=true, build_watchlist <- watchlists, invite_user <- users
//        other than caller, verify_posts <- social_posts) — proven by seeding
//        each underlying table independently and observing the corresponding
//        step (and only that step) flip to completed.
//   AC4: one-way milestone caching — once a core step is observed complete, it
//        stays completed:true (with a stable completedAt) on a subsequent GET
//        even after the underlying row is deleted (proven for build_watchlist).
//   AC5: PATCH /v1/tenants/:id/onboarding-checklist with { dismissed: true } is
//        tenant_admin-only (tenant_user gets 403), sets dismissed/dismissedAt,
//        records dismissed_by_user_id; { dismissed: false } (and { reset: true })
//        reopens it (dismissed:false, dismissedAt:null) — the checklist can be
//        dismissed and reopened, proven round-trip via GET.
//   AC6: PATCH never allows manually setting a core (or advanced) step's
//        completed value — any body carrying a key other than dismissed/reset/
//        hiddenAdvancedSteps (e.g. attempting to set `steps`) is rejected 400,
//        not silently accepted or ignored; { hiddenAdvancedSteps: [...] } is the
//        only supported way to hide/show advanced steps (enable_enrichment,
//        configure_alerts), applied and reflected on the next GET.
// Explicitly out of scope:
//   - configure_alerts derivation from real data — no alert_rules table exists
//     yet anywhere in this codebase (it is introduced by the concurrently-built
//     Story 9.3/ADR-0079, not merged at the time of this story); configure_alerts
//     is therefore always completed:false in v1, documented as a known gap in
//     .claude/skills/onboarding-checklist/SKILL.md rather than pulling Story
//     9.3's schema into this story's scope.
//   - The ADR-0080 Open-Questions auto-dismiss-for-pre-existing-tenants
//     reconciliation ("existing active tenants... automatically set to
//     dismissed: true") — not named by any of Story 9.5's own six Acceptance
//     Criteria, and would require an arbitrary time-based "existed before this
//     shipped" heuristic the ADR never specifies. A brand-new tenant that
//     completes all core steps normally shows a fully-checked, still-dismissible
//     (not auto-dismissed) checklist, matching FDD-0080 §5.4's own edge case.
//   - Story 9.6 (frontend OnboardingChecklist UI) — a separate, dependent story.
//   - PATCH request-shape ambiguity: FDD-0080 §5.2 describes an
//     `{ action: 'dismiss' | 'reset' | 'set_advanced_visibility', ... }` request
//     shape that contradicts ADR-0080 Decision §3's own literal
//     PatchOnboardingChecklistRequest TypeScript interface
//     (`{ dismissed?, reset?, hiddenAdvancedSteps? }`). Per this project's
//     documented ADR > BRD/FDD hierarchy, this contract encodes the ADR's
//     literal shape; the FDD's `action`-discriminated shape is not implemented.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

/** Helper: create a real tenant via platform_admin_role pool for test fixtures. */
async function createTenantFixture(name: string, licenseSeatCount = 10): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, licenseSeatCount]
  );
  return rows[0];
}

/** Helper: insert a minimal social_posts row via withTenant (RLS-scoped, matching story-5.4's own fixture pattern). */
async function insertPost(tenantId: string): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query("INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, '{}'::jsonb)", [tenantId]);
  });
}

describe('Story 9.5 — onboarding checklist state contract', () => {
  const app = createApp();

  it('AC1: a freshly-created tenant has a fully-populated, non-null onboarding_checklist default', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac1-${randomUUID()}`);
    const { rows } = await getPlatformAdminPool().query<{ onboarding_checklist: unknown }>(
      `SELECT onboarding_checklist FROM tenants WHERE id = $1`,
      [tenant.id]
    );
    expect(rows).toHaveLength(1);
    const checklist = rows[0].onboarding_checklist as any;
    expect(checklist).not.toBeNull();
    expect(checklist.steps.connect_source).toEqual({ completed: false, completed_at: null });
    expect(checklist.steps.build_watchlist.completed).toBe(false);
    expect(checklist.steps.invite_user.completed).toBe(false);
    expect(checklist.steps.verify_posts.completed).toBe(false);
    expect(checklist.advanced_steps.enable_enrichment.completed).toBe(false);
    expect(checklist.advanced_steps.configure_alerts.completed).toBe(false);
    expect(checklist.dismissed_at).toBeNull();
  });

  it('AC2: GET returns 200 with the checklist shape for a tenant_admin', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac2-admin-${randomUUID()}`);
    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isComplete: false,
      progressPercentage: 0,
      dismissed: false,
      dismissedAt: null,
    });
    expect(res.body.steps.connect_source).toMatchObject({ completed: false, completedAt: null });
    expect(typeof res.body.steps.connect_source.deepLink).toBe('string');
    expect(res.body.advancedSteps.enable_enrichment).toMatchObject({ completed: false });
    expect(res.body.advancedSteps.configure_alerts).toMatchObject({ completed: false });
  });

  it('AC2: GET returns 200 for a tenant_user (read-only role) of the same tenant', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac2-user-${randomUUID()}`);
    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_user' }));
    expect(res.status).toBe(200);
  });

  it('AC2: a cross-tenant caller (identity.tenantId !== :id) gets 404, not another tenant\'s data', async () => {
    const tenantA = await createTenantFixture(`T-9.5-ac2-crossA-${randomUUID()}`);
    const tenantB = await createTenantFixture(`T-9.5-ac2-crossB-${randomUUID()}`);

    const res = await request(app)
      .get(`/v1/tenants/${tenantB.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantA.id, { role: 'tenant_admin' }));
    expect(res.status).toBe(404);
  });

  it('AC2: missing X-Test-Identity is rejected 401 before the handler runs', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac2-401-${randomUUID()}`);
    const res = await request(app).get(`/v1/tenants/${tenant.id}/onboarding-checklist`);
    expect(res.status).toBe(401);
  });

  it('AC2: a platform_admin identity gets 403 (zero-tenant-content boundary, ADR-0030 §2)', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac2-platform-${randomUUID()}`);
    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }));
    expect(res.status).toBe(403);
  });

  it('AC3: connect_source flips complete when connector_activations has an active row for the tenant, and only that step', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac3-connector-${randomUUID()}`);
    await setConnectorActivation(tenant.id, 'gnews', 'tenant', true);

    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body.steps.connect_source.completed).toBe(true);
    expect(typeof res.body.steps.connect_source.completedAt).toBe('string');
    expect(res.body.steps.build_watchlist.completed).toBe(false);
    expect(res.body.steps.invite_user.completed).toBe(false);
    expect(res.body.steps.verify_posts.completed).toBe(false);
  });

  it('AC3: build_watchlist flips complete when the tenant has a watchlist', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac3-watchlist-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `wl-${randomUUID()}@example.com` });
    await createWatchlist(tenant.id, user.id, { name: 'Brand mentions', matchType: 'keyword', terms: ['acme'] });

    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin', userId: user.id }));

    expect(res.status).toBe(200);
    expect(res.body.steps.build_watchlist.completed).toBe(true);
    expect(res.body.steps.connect_source.completed).toBe(false);
  });

  it('AC3: invite_user flips complete when a second user (other than the caller) exists for the tenant', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac3-invite-${randomUUID()}`);
    const caller = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' });
    const callerIdentity = JSON.parse(caller);

    // No other user yet — should be incomplete.
    const before = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', caller);
    expect(before.body.steps.invite_user.completed).toBe(false);

    await createInvitedUser(tenant.id, { email: `invitee-${randomUUID()}@example.com` });

    const after = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin', userId: callerIdentity.userId }));
    expect(after.body.steps.invite_user.completed).toBe(true);
  });

  it('AC3: verify_posts flips complete when the tenant has at least one social_posts row', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac3-posts-${randomUUID()}`);
    await insertPost(tenant.id);

    const res = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' }));

    expect(res.status).toBe(200);
    expect(res.body.steps.verify_posts.completed).toBe(true);
  });

  it('AC4: one-way milestone locking — a completed step stays completed after its underlying row is deleted', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac4-lock-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `lock-${randomUUID()}@example.com` });
    const userId = user.id;
    const watchlist = await createWatchlist(tenant.id, userId, {
      name: 'Temp',
      matchType: 'keyword',
      terms: ['temp'],
    });

    const identityHeader = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin', userId });

    const firstRes = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', identityHeader);
    expect(firstRes.body.steps.build_watchlist.completed).toBe(true);
    const cachedCompletedAt = firstRes.body.steps.build_watchlist.completedAt;

    // Delete the only watchlist directly (bypassing the API, matching the AC's
    // "even if underlying resources are later deleted" framing).
    await getPool().query('DELETE FROM watchlists WHERE id = $1', [watchlist.id]);

    const secondRes = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', identityHeader);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.steps.build_watchlist.completed).toBe(true);
    expect(secondRes.body.steps.build_watchlist.completedAt).toBe(cachedCompletedAt);
  });

  it('AC5: PATCH { dismissed: true } is tenant_admin-only — a tenant_user attempt gets 403', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac5-role-${randomUUID()}`);
    const res = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_user' }))
      .send({ dismissed: true });
    expect(res.status).toBe(403);
  });

  it('AC5: PATCH { dismissed: true } dismisses, and { dismissed: false } reopens — round-tripped via GET', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac5-dismiss-${randomUUID()}`);
    const userId = randomUUID();
    const header = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin', userId });

    const dismissRes = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ dismissed: true });
    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.dismissed).toBe(true);
    expect(typeof dismissRes.body.dismissedAt).toBe('string');

    const getRes = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header);
    expect(getRes.body.dismissed).toBe(true);

    const reopenRes = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ dismissed: false });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.dismissed).toBe(false);
    expect(reopenRes.body.dismissedAt).toBeNull();
  });

  it('AC5: PATCH { reset: true } also clears a dismissed state', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac5-reset-${randomUUID()}`);
    const header = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' });

    await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ dismissed: true });

    const resetRes = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ reset: true });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.dismissed).toBe(false);
    expect(resetRes.body.dismissedAt).toBeNull();
  });

  it('AC6: a PATCH body attempting to directly set a core step\'s completed value is rejected 400, not ignored', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac6-reject-${randomUUID()}`);
    const header = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' });

    const res = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ steps: { connect_source: { completed: true } } });
    expect(res.status).toBe(400);

    // Confirm it truly had no effect (not silently accepted).
    const getRes = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header);
    expect(getRes.body.steps.connect_source.completed).toBe(false);
  });

  it('AC6: PATCH { hiddenAdvancedSteps: [...] } hides/shows advanced steps, reflected on the next GET', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac6-hide-${randomUUID()}`);
    const header = testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' });

    const patchRes = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header)
      .send({ hiddenAdvancedSteps: ['enable_enrichment'] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.advancedSteps.enable_enrichment.hidden).toBe(true);
    expect(patchRes.body.advancedSteps.configure_alerts.hidden).toBe(false);

    const getRes = await request(app)
      .get(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', header);
    expect(getRes.body.advancedSteps.enable_enrichment.hidden).toBe(true);
    expect(getRes.body.advancedSteps.configure_alerts.hidden).toBe(false);
  });

  it('AC6: PATCH { hiddenAdvancedSteps: [...] } with an unknown step name is rejected 400', async () => {
    const tenant = await createTenantFixture(`T-9.5-ac6-hide-invalid-${randomUUID()}`);
    const res = await request(app)
      .patch(`/v1/tenants/${tenant.id}/onboarding-checklist`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { role: 'tenant_admin' }))
      .send({ hiddenAdvancedSteps: ['not_a_real_step'] });
    expect(res.status).toBe(400);
  });
});
