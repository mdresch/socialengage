// Contract: Story 5.16 (ADR-0037 §8b/§8c) — Same-Domain Invite Assist
// backend surface and Platform-Admin escalation.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-516--same-domain-invite-assist-backend-surface-and-platform-admin-escalation
//
// Intent: Story 5.16 — Same-Domain Invite Assist backend surface and
// Platform-Admin escalation (ADR-0037 §8b/§8c; no new ADR needed — §8b/§8c
// already exhaustively decided the data model, aggregation, and escalation
// mechanics this story exposes)
// Scope: src/tenants/domainSignupAttempts.ts (new — listDomainSignupAttempts(),
// checkAndLogDomainEscalation()), src/http/versions/v1/domainSignupAttemptsRouter.ts
// (new — GET /v1/tenants/domain-signup-attempts), src/http/versions/v1/router.ts
// (mount), src/tenants/selfServiceSignup.ts (Story 5.15's own file — a
// genuine, necessary touch: recordDomainSignupAttempt() is the only place a
// new domain_signup_attempts row is ever inserted, so it's the only place
// "whenever a domain's attempt count crosses the escalation threshold" (AC4)
// can be checked inline, without a background job this solo project has no
// infrastructure for).
// Contract to encode: (1) GET /v1/tenants/domain-signup-attempts is
// RLS-scoped to the caller's own tenant via the ordinary app_user/withTenant()
// path (never a bypass role), reachable by tenant_admin only, 403 for
// tenant_user, 401 unauthenticated; (2) the response aggregates by domain —
// one item per domain with a distinct-verified-email count, not one row per
// attempt; (3) each domain item includes the full list of distinct verified
// emails behind it in the same response (this story's own implementation-time
// resolution of the ADR's "a nested field or a second endpoint" choice — a
// nested field, since the aggregated dataset is small and a client-side
// expand/collapse over already-fetched data satisfies "on demand" without a
// second network round trip or an N+1 query); (4) an escalation flag is true
// once a domain's distinct-email count within the rolling 30-day window
// reaches the template default of 3 (ADR-0037 §8b) — this story's own
// implementation-time resolution of "3 attempts" as 3 *distinct verified
// emails*, not 3 raw rows, consistent with ADR-0037 §8c's own clarification
// that triggering escalation "requires the force of multiple email accounts";
// (5) crossing the threshold writes exactly one distinguishably-labeled
// platform_admin_audit_log entry (operation domain_signup_escalation,
// actorIdentity system:domain-signup-escalation, detail including the
// domain and the verified emails behind the pattern) — proven not to
// duplicate on a 4th, 5th attempt past the threshold; (6) cross-tenant
// isolation — a Tenant-Admin of tenant A cannot see tenant B's
// domain_signup_attempts via this endpoint, enforced by RLS itself, not an
// application-level filter.
// Explicitly out of scope: real-time alerting on the escalation signal
// (Slack/email/on-call) — ADR-0037 §8c's own explicit scope limit, the
// audit-log write is the entire deliverable; Story 6.10's own admin-UI
// screen (the one-click invite action, the visual escalation treatment);
// the domain-match rejection path itself and the initial
// domain_signup_attempts write (Story 5.15's own contract, unchanged here
// except for the one new call this story adds to it).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closeAdminPool } from '../../src/db/adminPool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeTenantSignupPool } from '../../src/db/tenantSignupPool';
import { closeIdentityResolverPool } from '../../src/db/identityResolverPool';
import { closePool } from '../../src/db/pool';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePlatformAdminPool();
  await closeTenantSignupPool();
  await closeIdentityResolverPool();
  await closePool();
});

const TEST_CLAIMS_HEADER = 'X-Test-Claims';

function claimsHeader(sub: string, email: string): string {
  return JSON.stringify({ sub, email });
}

function tenantAdminHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_admin' });
}

function tenantUserHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' });
}

/** Signs up a fresh tenant with the given domain, returning its id and the founder's admin session header. */
async function seedTenantWithDomain(app: ReturnType<typeof createApp>, domain: string): Promise<{ tenantId: string; adminHeader: string }> {
  const sub = randomUUID();
  const email = `founder@${domain}`;
  const res = await request(app)
    .post('/v1/tenants/self-service-signup')
    .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
    .send({ name: `Org-${randomUUID()}` });
  expect(res.status).toBe(201);
  return { tenantId: res.body.id, adminHeader: tenantAdminHeader(res.body.id, res.body.userId) };
}

/** Attempts a (rejected) domain-match signup with a fresh sub/email at the given domain. */
async function attemptDomainMatch(app: ReturnType<typeof createApp>, domain: string): Promise<void> {
  const sub = randomUUID();
  const email = `colleague-${randomUUID()}@${domain}`;
  const res = await request(app)
    .post('/v1/tenants/self-service-signup')
    .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
    .send({ name: `Whatever-${randomUUID()}` });
  expect(res.status).toBe(409);
}

describe('Story 5.16 — Same-Domain Invite Assist backend surface and Platform-Admin escalation', () => {
  const app = createApp();

  it('AC1: a tenant_admin can list their own tenant\'s domain-signup attempts; tenant_user and unauthenticated are rejected', async () => {
    const domain = `list-${randomUUID()}.example`;
    const { tenantId, adminHeader } = await seedTenantWithDomain(app, domain);

    const ok = await request(app).get('/v1/tenants/domain-signup-attempts').set('X-Test-Identity', adminHeader);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.domains)).toBe(true);

    const userRes = await request(app)
      .get('/v1/tenants/domain-signup-attempts')
      .set('X-Test-Identity', tenantUserHeader(tenantId, randomUUID()));
    expect(userRes.status).toBe(403);

    const anon = await request(app).get('/v1/tenants/domain-signup-attempts');
    expect(anon.status).toBe(401);
  });

  it('AC2/AC3/AC4: two attempts do not escalate; a third distinct-email attempt aggregates to one domain item, escalated, with all emails listed', async () => {
    const domain = `escalate-${randomUUID()}.example`;
    const { tenantId, adminHeader } = await seedTenantWithDomain(app, domain);

    await attemptDomainMatch(app, domain);
    await attemptDomainMatch(app, domain);
    const afterTwoTotal = await request(app)
      .get('/v1/tenants/domain-signup-attempts')
      .set('X-Test-Identity', adminHeader);
    const itemAfterTwo = afterTwoTotal.body.domains.find((d: { domain: string }) => d.domain === domain);
    expect(itemAfterTwo).toBeDefined();
    expect(itemAfterTwo.distinctEmailCount).toBe(2);
    expect(itemAfterTwo.escalated).toBe(false);

    await attemptDomainMatch(app, domain);
    const afterThree = await request(app)
      .get('/v1/tenants/domain-signup-attempts')
      .set('X-Test-Identity', adminHeader);
    const domainItems = afterThree.body.domains.filter((d: { domain: string }) => d.domain === domain);
    expect(domainItems).toHaveLength(1);
    const item = domainItems[0];
    expect(item.distinctEmailCount).toBe(3);
    expect(item.escalated).toBe(true);
    expect(item.emails).toHaveLength(3);
    expect(item.emails.every((e: string) => e.endsWith(`@${domain}`))).toBe(true);

    const { rows } = await getPlatformAdminPool().query<{ operation: string; actor_identity: string; detail: { domain: string; emails: string[] } }>(
      `SELECT operation, actor_identity, detail FROM platform_admin_audit_log WHERE target_tenant_id = $1 AND operation = 'domain_signup_escalation'`,
      [tenantId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_identity).toBe('system:domain-signup-escalation');
    expect(rows[0].detail.domain).toBe(domain);
    expect(rows[0].detail.emails).toHaveLength(3);

    // a 4th distinct attempt must not duplicate the escalation entry
    await attemptDomainMatch(app, domain);
    const { rows: rowsAfterFourth } = await getPlatformAdminPool().query(
      `SELECT id FROM platform_admin_audit_log WHERE target_tenant_id = $1 AND operation = 'domain_signup_escalation'`,
      [tenantId]
    );
    expect(rowsAfterFourth).toHaveLength(1);
  });

  it('AC6: cross-tenant isolation — tenant B\'s Tenant-Admin cannot see tenant A\'s domain-signup attempts', async () => {
    const domainA = `isolation-a-${randomUUID()}.example`;
    const { adminHeader: adminHeaderA } = await seedTenantWithDomain(app, domainA);
    await attemptDomainMatch(app, domainA);

    const domainB = `isolation-b-${randomUUID()}.example`;
    const { adminHeader: adminHeaderB } = await seedTenantWithDomain(app, domainB);

    const asA = await request(app).get('/v1/tenants/domain-signup-attempts').set('X-Test-Identity', adminHeaderA);
    expect(asA.body.domains.some((d: { domain: string }) => d.domain === domainA)).toBe(true);

    const asB = await request(app).get('/v1/tenants/domain-signup-attempts').set('X-Test-Identity', adminHeaderB);
    expect(asB.body.domains.some((d: { domain: string }) => d.domain === domainA)).toBe(false);
  });
});
