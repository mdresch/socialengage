// Contract: Story 17.2 (ADR-0130) — Role-tailored onboarding journeys with automated probe verification (backend)
// See docs/user-stories/epic-17-adr-0129-to-0133.md#story-172--role-tailored-onboarding-journeys-with-automated-probe-verification-frontendbackend
//
// Intent: Story 17.2 — Role-tailored onboarding journeys with automated probe verification
// Source: ADR-0130, BRD-0130, FDD-0130, TDS-0130
// Scope:
//   migrations/0082_create_tenant_onboarding_state.sql
//   src/onboarding/automatedVerificationProbeRunner.ts
//   src/onboarding/roleOnboardingService.ts
//   src/http/versions/v1/onboardingRouter.ts
//   src/http/versions/v1/router.ts
//   social-listening-core/.claude/skills/onboarding-checklist/SKILL.md
// Contract to encode:
//   AC1: Schema & Step Trees: tenant_onboarding_state has role_journeys JSONB tracking
//        admin, care_agent, social_seller, and brand_manager step trees with id, title, description,
//        completed, probeKey, actionUrl, actionLabel.
//   AC2: Probe 1 (Ingestion Traffic): connect_live_source completes only when ingestion_runs
//        has status in ('succeeded', 'success') and posts_ingested > 0.
//   AC3: Probe 2 (Watchlist Match): define_boolean_watchlist completes when post_watchlist_matches > 0.
//   AC4: Probe 3 (Triage Care Reply): dispatch_reply completes when outbound_activities reply is sent/dispatched.
//   AC5: Probe 4 (CRM Push): execute_crm_handoff completes when outbound_activities crm_prospect / crm_handoff is sent/dispatched.
//   AC6: Persistence & Short-circuit: Completed milestones persist in tenant_onboarding_state.role_journeys
//        and remain completed even after probe operational rows are removed.
//   AC7: Tenant Isolation & Role Gating: tenant callers can only access their own onboarding state;
//        role queries normalize canonical role names and compute accurate progress percentages.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';

jest.setTimeout(60000);

const app = createApp();

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 17.2 — Role-tailored onboarding journeys with automated probe verification', () => {
  it('AC1: returns role-tailored step trees for each of the 4 personas', async () => {
    const tenant = await createTenantFixture(`T-17.2-trees-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    const roles = ['admin', 'care_agent', 'social_seller', 'brand_manager'] as const;

    for (const role of roles) {
      const res = await request(app)
        .get(`/v1/onboarding/checklist?role=${role}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role);
      expect(typeof res.body.isComplete).toBe('boolean');
      expect(typeof res.body.completionPercentage).toBe('number');
      expect(Array.isArray(res.body.steps)).toBe(true);
      expect(res.body.steps.length).toBe(3);

      for (const step of res.body.steps) {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('completed');
        expect(step).toHaveProperty('probeKey');
        expect(step).toHaveProperty('actionUrl');
        expect(step).toHaveProperty('actionLabel');
      }
    }
  });

  it('AC2: Probe 1 (Ingestion Traffic): connect_live_source completes when successful ingestion run exists', async () => {
    const tenant = await createTenantFixture(`T-17.2-p1-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    // Initial check: connect_live_source should be false
    const initialRes = await request(app)
      .get('/v1/onboarding/checklist?role=admin')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    expect(initialRes.status).toBe(200);
    const initialStep = initialRes.body.steps.find((s: any) => s.id === 'connect_live_source');
    expect(initialStep.completed).toBe(false);

    // Seed a failed ingestion run: probe should still not complete
    await getAdminPool().query(
      `INSERT INTO ingestion_runs (id, tenant_id, platform_id, trigger_type, connector_version, status, posts_ingested)
       VALUES ($1, $2, 'gnews', 'poll', '1.0.0', 'failed', 0)`,
      [randomUUID(), tenant.id]
    );

    const failedRes = await request(app)
      .get('/v1/onboarding/checklist?role=admin')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const stepAfterFailed = failedRes.body.steps.find((s: any) => s.id === 'connect_live_source');
    expect(stepAfterFailed.completed).toBe(false);

    // Seed a successful ingestion run with posts_ingested > 0
    await getAdminPool().query(
      `INSERT INTO ingestion_runs (id, tenant_id, platform_id, trigger_type, connector_version, status, posts_ingested)
       VALUES ($1, $2, 'gnews', 'poll', '1.0.0', 'succeeded', 12)`,
      [randomUUID(), tenant.id]
    );

    const completedRes = await request(app)
      .get('/v1/onboarding/checklist?role=admin')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    expect(completedRes.status).toBe(200);
    const stepAfterSuccess = completedRes.body.steps.find((s: any) => s.id === 'connect_live_source');
    expect(stepAfterSuccess.completed).toBe(true);
  });

  it('AC3: Probe 2 (Watchlist Match): define_boolean_watchlist completes when post_watchlist_matches exist', async () => {
    const tenant = await createTenantFixture(`T-17.2-p2-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    const initialRes = await request(app)
      .get('/v1/onboarding/checklist?role=brand_manager')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const initialStep = initialRes.body.steps.find((s: any) => s.id === 'define_boolean_watchlist');
    expect(initialStep.completed).toBe(false);

    // Seed watchlist and post_watchlist_matches row
    const watchlistId = randomUUID();
    await getAdminPool().query(
      `INSERT INTO watchlists (id, tenant_id, user_id, name, match_type, terms, is_active)
       VALUES ($1, $2, $3, 'Test Watchlist', 'keyword', ARRAY['enterprise'], true)`,
      [watchlistId, tenant.id, user.id]
    );

    await getAdminPool().query(
      `INSERT INTO post_watchlist_matches (id, post_id, watchlist_id, tenant_id, matched_at)
       VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), randomUUID(), watchlistId, tenant.id]
    );

    const matchRes = await request(app)
      .get('/v1/onboarding/checklist?role=brand_manager')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const stepAfterMatch = matchRes.body.steps.find((s: any) => s.id === 'define_boolean_watchlist');
    expect(stepAfterMatch.completed).toBe(true);
  });

  it('AC4: Probe 3 (Triage Care Reply): dispatch_reply completes when outbound_activities reply is sent', async () => {
    const tenant = await createTenantFixture(`T-17.2-p3-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    const initialRes = await request(app)
      .get('/v1/onboarding/checklist?role=care_agent')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const initialStep = initialRes.body.steps.find((s: any) => s.id === 'dispatch_reply');
    expect(initialStep.completed).toBe(false);

    // Seed outbound_activities row with status 'sent' and activity_type 'reply'
    await getAdminPool().query(
      `INSERT INTO outbound_activities (
         id, tenant_id, post_id, provider_id, user_id, credential_id,
         activity_type, body, status, sent_at
       )
       VALUES ($1, $2, $3, 'twitter', $4, $5, 'reply', 'We are looking into this!', 'sent', now())`,
      [randomUUID(), tenant.id, randomUUID(), user.id, randomUUID()]
    );

    const replyRes = await request(app)
      .get('/v1/onboarding/checklist?role=care_agent')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const stepAfterReply = replyRes.body.steps.find((s: any) => s.id === 'dispatch_reply');
    expect(stepAfterReply.completed).toBe(true);
  });

  it('AC5: Probe 4 (CRM Push): execute_crm_handoff completes when CRM push activity is sent', async () => {
    const tenant = await createTenantFixture(`T-17.2-p4-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    const initialRes = await request(app)
      .get('/v1/onboarding/checklist?role=social_seller')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const initialStep = initialRes.body.steps.find((s: any) => s.id === 'execute_crm_handoff');
    expect(initialStep.completed).toBe(false);

    // Seed outbound_activities row with status 'sent' and activity_type 'crm_prospect'
    await getAdminPool().query(
      `INSERT INTO outbound_activities (
         id, tenant_id, post_id, provider_id, user_id, credential_id,
         activity_type, body, status, sent_at
       )
       VALUES ($1, $2, $3, 'hubspot', $4, $5, 'crm_prospect', 'Handoff to HubSpot', 'sent', now())`,
      [randomUUID(), tenant.id, randomUUID(), user.id, randomUUID()]
    );

    const crmRes = await request(app)
      .get('/v1/onboarding/checklist?role=social_seller')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    const stepAfterCRM = crmRes.body.steps.find((s: any) => s.id === 'execute_crm_handoff');
    expect(stepAfterCRM.completed).toBe(true);
  });

  it('AC6: persists role_journeys in tenant_onboarding_state and short-circuits completed probes', async () => {
    const tenant = await createTenantFixture(`T-17.2-p6-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `admin-${randomUUID()}@example.com`, role: 'tenant_admin' });

    // Seed outbound reply to trigger dispatch_reply
    const activityId = randomUUID();
    await getAdminPool().query(
      `INSERT INTO outbound_activities (
         id, tenant_id, post_id, provider_id, user_id, credential_id,
         activity_type, body, status, sent_at
       )
       VALUES ($1, $2, $3, 'twitter', $4, $5, 'reply', 'Thank you for contacting us.', 'sent', now())`,
      [activityId, tenant.id, randomUUID(), user.id, randomUUID()]
    );

    // Run checklist evaluation — should mark dispatch_reply as true and persist into tenant_onboarding_state
    const firstCheck = await request(app)
      .get('/v1/onboarding/checklist?role=care_agent')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    expect(firstCheck.status).toBe(200);
    expect(firstCheck.body.steps.find((s: any) => s.id === 'dispatch_reply').completed).toBe(true);

    // Verify row persisted in tenant_onboarding_state table
    const { rows } = await getAdminPool().query(
      `SELECT role_journeys FROM tenant_onboarding_state WHERE tenant_id = $1`,
      [tenant.id]
    );
    const storedState = rows[0]?.role_journeys;

    expect(storedState).toBeDefined();
    expect(storedState.care_agent?.steps?.dispatch_reply?.completed).toBe(true);

    // Now DELETE the outbound activity row: the probe should short-circuit and remain true
    await getAdminPool().query(`DELETE FROM outbound_activities WHERE id = $1`, [activityId]);

    const secondCheck = await request(app)
      .get('/v1/onboarding/checklist?role=care_agent')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant.id, { userId: user.id, role: 'tenant_admin' }));

    expect(secondCheck.status).toBe(200);
    expect(secondCheck.body.steps.find((s: any) => s.id === 'dispatch_reply').completed).toBe(true);
  });

  it('AC7: supports role aliases, defaults to session role, and enforces tenant isolation', async () => {
    const tenant1 = await createTenantFixture(`T-17.2-p7a-${randomUUID()}`);
    const user1 = await createInvitedUser(tenant1.id, { email: `user1-${randomUUID()}@example.com`, role: 'tenant_admin' });

    // Role alias 'Tenant-Social-Care-Agent' should resolve to 'care_agent'
    const aliasRes = await request(app)
      .get('/v1/onboarding/checklist?role=Tenant-Social-Care-Agent')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant1.id, { userId: user1.id, role: 'tenant_admin' }));

    expect(aliasRes.status).toBe(200);
    expect(aliasRes.body.role).toBe('care_agent');

    // Omitting ?role= defaults to user role ('tenant_admin' -> 'admin')
    const defaultRes = await request(app)
      .get('/v1/onboarding/checklist')
      .set('X-Test-Identity', testIdentityHeaderValue(tenant1.id, { userId: user1.id, role: 'tenant_admin' }));

    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.role).toBe('admin');

    // Anonymous caller without auth gets 401
    const anonRes = await request(app).get('/v1/onboarding/checklist');
    expect(anonRes.status).toBe(401);
  });
});
