// Contract: Story 5.15 (ADR-0037 §1–§9) — Self-service tenant sign-up
// backend endpoint.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-515--self-service-tenant-sign-up-backend-endpoint
//
// Intent: Story 5.15 — Self-service tenant sign-up backend endpoint
// (ADR-0037; no new ADR needed — §1–§9 already exhaustively designed this
// endpoint's behavior, schema, and role)
// Scope: src/http/versions/v1/selfServiceSignupRouter.ts (new), src/tenants/selfServiceSignup.ts
// (new — provisionTenantViaSignup(), the public-email-provider denylist),
// src/db/tenantSignupPool.ts (new — tenant_signup_role's own pool, mirroring
// platformAdminPool.ts/identityResolverPool.ts's existing pattern),
// src/http/auth/testClaimsBypassMiddleware.ts (new — a claims-level test
// bypass, X-Test-Claims: {sub, email}, distinct from the existing
// X-Test-Identity pre-resolved-identity bypass; this route's whole point is
// to be reachable by a caller resolveIdentity() finds nothing for, which
// the identity-level bypass structurally cannot simulate), migrations/0021
// (new tenant_signup_role — BYPASSRLS, INSERT-only on tenants, a narrow
// column-scoped SELECT(id) on tenants found necessary while building this
// story to resolve a domain-match's matched tenant id since a unique-
// violation error doesn't carry it, INSERT-only on platform_admin_audit_log),
// migrations/0022 (new domain_signup_attempts table, ADR-0037 §8b, ordinary
// tenant-scoped RLS, INSERT-only via tenant_signup_role), src/http/versions/v1/router.ts
// (mount /tenants/self-service-signup with a second, claims-level auth
// middleware — this route cannot use the shared authMiddleware, which
// already rejects a null-resolving caller before any handler runs, exactly
// the one caller this route must accept), src/http/app.ts (selects the new
// claims-level middleware the same way it already selects authMiddleware),
// src/admin/platformAdminAuditLog.ts (logPlatformAdminAction() gains an
// optional pool parameter, defaulting to getPlatformAdminPool() so every
// existing caller is unaffected — ADR-0037 §2 requires this exact write to
// run under tenant_signup_role's own connection, which needs its own
// INSERT grant, so the hardcoded pool couldn't be reused as-is),
// src/tenants/tenantStore.ts (mapRowToTenant exported so the new module can
// reuse the same Tenant-shape mapping rather than duplicating it).
// Contract to encode: (1) POST /v1/tenants/self-service-signup accepts a
// validly-signed-but-unmatched caller (resolveIdentity() returns null) and
// provisions a tenant + first tenant_admin user; every other route's
// existing unauthenticated-rejection behavior is unaffected (regression
// check against GET /v1/posts); (2) a caller with an existing, unlinked
// invited row for their email is routed through resolveIdentity()'s own
// existing invite-link mechanism (ADR-0032 §6) rather than getting a new
// tenant — proven by confirming the invited row gets linked and no tenant
// is created for the attempt; (3) a caller whose sub already resolves
// (directly, or freshly linked per (2)) is rejected 409 "already belongs to
// a tenant"; (4) a denylisted email domain leaves tenants.domain null,
// while a real domain is captured; (5)/(7)/(8) a successful signup runs the
// tenants INSERT via tenant_signup_role and the first users row via the
// ordinary app_user/withTenant() path, both verified directly against the
// database, not just the HTTP response; (6) a domain already claimed by an
// existing tenant is rejected with ADR-0037 §3's vague, non-org-naming
// message, and writes a domain_signup_attempts row scoped to the matched
// tenant; (8) the tenant_signup_role write is durably audited via the
// existing platform_admin_audit_log/logPlatformAdminAction() mechanism,
// actorIdentity = self-service-signup:<sub>; (9) a genuine partial failure
// (tenant INSERT succeeds, first-user INSERT fails) surfaces a real,
// actionable error rather than a silent 200/500 with no trace — reproduced
// via a real, deterministic external_subject UNIQUE-constraint collision
// (a pre-seeded, inactive users row already holding that sub), not a mock.
// Explicitly out of scope: §7's rate-limiting/abuse-prevention mechanism
// (Story 5.18, named as a required follow-up, not this story's own AC);
// §8c's repeated-domain escalation-threshold detection (ADR-0037's own
// "Named as required, not designed here" list — the escalation-detection
// logic itself is separate application code this story does not build,
// only the raw per-attempt domain_signup_attempts row); Story 5.16's own
// Tenant-Admin-facing read of domain_signup_attempts (this story is sole
// writer only); Story 6.7's admin-UI sign-up screen; re-proving
// resolveIdentity()'s own DB-lookup correctness beyond what this story's
// own HTTP wiring needs (Story 5.9's own contract already does this).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
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

async function seedTenant(): Promise<string> {
  const { rows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [`Seed-${randomUUID()}`, 5]
  );
  return rows[0].id;
}

async function seedActiveUser(sub: string, email: string): Promise<string> {
  const tenantId = await seedTenant();
  await getAdminPool().query(
    `INSERT INTO users (tenant_id, email, external_subject, role, status, activated_at)
     VALUES ($1, $2, $3, 'tenant_admin', 'active', now())`,
    [tenantId, email, sub]
  );
  return tenantId;
}

async function seedInvitedUser(email: string): Promise<string> {
  const tenantId = await seedTenant();
  await getAdminPool().query(
    `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'invited')`,
    [tenantId, email]
  );
  return tenantId;
}

/**
 * A legitimately-reachable, if unusual, real database state: a users row
 * whose external_subject is already set but whose status isn't 'active' —
 * resolveIdentity() returns null for this sub (not currently active), so
 * the signup endpoint proceeds to provisioning, but the users table's own
 * UNIQUE(external_subject) constraint then genuinely fails the second
 * insert after the first (tenants) insert has already succeeded. Real
 * infrastructure, not a mock — see AC9.
 */
async function seedInactivePhantomUser(sub: string): Promise<void> {
  const tenantId = await seedTenant();
  await getAdminPool().query(
    `INSERT INTO users (tenant_id, email, external_subject, role, status)
     VALUES ($1, $2, $3, 'tenant_user', 'invited')`,
    [tenantId, `phantom-${randomUUID()}@example.com`, sub]
  );
}

describe('Story 5.15 — Self-service tenant sign-up backend endpoint', () => {
  const app = createApp();

  it('AC1: an unmatched-but-validly-authenticated caller provisions a tenant and a first tenant_admin user', async () => {
    const sub = randomUUID();
    const domain = `acme-${randomUUID()}.example`;
    const email = `founder@${domain}`;
    const name = `Acme-${randomUUID()}`;

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(res.body.status).toBe('active');
    expect(res.body.domain).toBe(domain);
    expect(typeof res.body.userId).toBe('string');

    const { rows } = await getAdminPool().query<{ role: string; status: string; external_subject: string }>(
      `SELECT role, status, external_subject FROM users WHERE tenant_id = $1`,
      [res.body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('tenant_admin');
    expect(rows[0].status).toBe('active');
    expect(rows[0].external_subject).toBe(sub);
  });

  it('AC1: mounting this route changes nothing about an existing protected route still rejecting an unauthenticated caller', async () => {
    const res = await request(app).get('/v1/posts');
    expect(res.status).toBe(401);
  });

  it('AC1: no Authorization/X-Test-Claims at all is rejected 401 before any handler runs', async () => {
    const res = await request(app).post('/v1/tenants/self-service-signup').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });

  it('AC2/AC3: an existing, unlinked invited row for the caller\'s email is linked via resolveIdentity()\'s own mechanism, not a new tenant', async () => {
    const email = `colleague-${randomUUID()}@example.org`;
    const invitedTenantId = await seedInvitedUser(email);
    const sub = randomUUID();

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name: `Should-Not-Be-Created-${randomUUID()}` });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already belong/i);

    const { rows } = await getAdminPool().query<{ external_subject: string; status: string }>(
      `SELECT external_subject, status FROM users WHERE tenant_id = $1 AND email = $2`,
      [invitedTenantId, email]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].external_subject).toBe(sub);
    expect(rows[0].status).toBe('active');
  });

  it('AC3: a caller whose sub already resolves to an active user is rejected 409, never reaching tenant creation', async () => {
    const sub = randomUUID();
    const email = `already-${randomUUID()}@example.org`;
    await seedActiveUser(sub, email);

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name: `Should-Not-Be-Created-${randomUUID()}` });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already belong/i);
  });

  it('AC1/AC3: a caller resolving to an existing platform_admin is also rejected 409, never reaching tenant creation', async () => {
    const sub = randomUUID();
    const email = `platformadmin-${randomUUID()}@example.org`;
    await getAdminPool().query(`INSERT INTO platform_admins (external_subject, email) VALUES ($1, $2)`, [sub, email]);

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name: `Should-Not-Be-Created-${randomUUID()}` });

    expect(res.status).toBe(409);
  });

  it('AC4: a denylisted public-email-provider domain leaves tenants.domain null', async () => {
    const sub = randomUUID();
    const email = `person-${randomUUID()}@gmail.com`;
    const name = `Personal-${randomUUID()}`;

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name });

    expect(res.status).toBe(201);
    expect(res.body.domain).toBeNull();
  });

  it("AC6: a second sign-up whose domain already matches an existing tenant is rejected with a vague, non-org-naming message and records a domain_signup_attempts row", async () => {
    const domain = `target-${randomUUID()}.example`;
    const firstSub = randomUUID();
    const firstEmail = `founder@${domain}`;
    const firstName = `Target-Org-${randomUUID()}`;

    const first = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(firstSub, firstEmail))
      .send({ name: firstName });
    expect(first.status).toBe(201);
    const matchedTenantId = first.body.id;

    const secondSub = randomUUID();
    const secondEmail = `colleague@${domain}`;

    const second = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(secondSub, secondEmail))
      .send({ name: `Whatever-${randomUUID()}` });

    expect(second.status).toBe(409);
    const bodyText = JSON.stringify(second.body);
    expect(bodyText).not.toContain(firstName);
    expect(bodyText).not.toContain(matchedTenantId);

    const { rows } = await getAdminPool().query<{ email: string }>(
      `SELECT email FROM domain_signup_attempts WHERE tenant_id = $1`,
      [matchedTenantId]
    );
    expect(rows.some((r) => r.email === secondEmail)).toBe(true);
  });

  it('AC8: a successful signup is audited via platform_admin_audit_log, actorIdentity self-service-signup:<sub>', async () => {
    const sub = randomUUID();
    const email = `audited-${randomUUID()}@auditcorp.example`;
    const name = `AuditCorp-${randomUUID()}`;

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name });
    expect(res.status).toBe(201);

    const { rows } = await getPlatformAdminPool().query<{ operation: string; actor_identity: string }>(
      `SELECT operation, actor_identity FROM platform_admin_audit_log WHERE target_tenant_id = $1`,
      [res.body.id]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].actor_identity).toBe(`self-service-signup:${sub}`);
  });

  it('AC9: a genuine partial failure (tenant created, first-user insert fails) surfaces a real, actionable error, not a silent success', async () => {
    const sub = randomUUID();
    await seedInactivePhantomUser(sub);
    const domain = `partialfail-${randomUUID()}.example`;
    const email = `partial@${domain}`;

    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(sub, email))
      .send({ name: `PartialFail-${randomUUID()}` });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(typeof res.body.error).toBe('string');

    const { rows } = await getAdminPool().query<{ id: string }>(`SELECT id FROM tenants WHERE domain = $1`, [domain]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('AC1: a request body missing name is rejected 400', async () => {
    const res = await request(app)
      .post('/v1/tenants/self-service-signup')
      .set(TEST_CLAIMS_HEADER, claimsHeader(randomUUID(), `noname-${randomUUID()}@example.org`))
      .send({});
    expect(res.status).toBe(400);
  });
});
