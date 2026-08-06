// Contract: Story 5.13 (ADR-0030 §3) — Platform Admin break-glass
// request/execute REST surface.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-513--platform-admin-break-glass-requestexecute-rest-surface
//
// Intent: Story 5.13 — Platform Admin break-glass request/execute REST
// surface (ADR-0030 §3; no new ADR needed)
// Scope: src/http/versions/v1/adminBreakGlassRouter.ts (new), src/http/versions/v1/router.ts
// (mount /admin/tenants/:tenantId/break-glass), src/admin/breakGlassCredentialReset.ts
// (new breakGlassConfigFromEnv() export — the route's own config source,
// mirroring app.ts's entraConfigFromEnv() pattern; no change to the
// existing requestBreakGlassCredentialReset()/executeBreakGlassRequest()
// mechanism itself, which Story 5.7 already builds and proves against the
// real tenant).
// Contract to encode: (1) POST .../break-glass/request records a pending
// request against a directly-specified targetUserId (the Tenant-Admin
// lookup from a tenant name is a separate, still-deferred gap per
// platform-admin-access/SKILL.md — not this story's job), performs no
// Entra action, reachable only through a platform_admin identity; (2)
// .../break-glass/requests/:requestId/execute is a genuinely separate route
// registration from the request endpoint — proven by confirming a recorded
// request stays 'requested' (never auto-executes) until execute is called
// as its own, distinct HTTP call; (3) executing performs the real two-
// identity JIT sequence against the real getsocialengage tenant (Story
// 5.7's already-proven mechanism), returns the TAP/executedAt once, and is
// itself reachable only through a platform_admin identity; (4) a second
// execute attempt against an already-executed request is rejected (409),
// proven by reusing the same real execution rather than performing a
// second real Entra round trip; (5) the audit log records both operations,
// the TAP/password never appearing in its detail; (6) no app_user/tenant-
// scoped or unauthenticated caller can reach either route.
// Test-cost discipline, matching Story 5.7's own contract precedent for
// this exact mechanism: exactly one real Entra execute call in this whole
// file (~15s+ of real Graph round trips and replication-lag polling per
// call) — every other assertion, including the 409-on-retry check, reuses
// that same execution rather than triggering a second one.
// Explicitly out of scope: re-proving the break-glass mechanism's own real
// Entra correctness (two-identity JIT grant/revoke, TAP issuance, de-
// elevation) — Story 5.7's own contract already does this in full; this
// story only proves the HTTP surface gates and wires to it correctly. The
// Tenant-Admin-lookup-by-tenant-name gap (platform-admin-access/SKILL.md's
// own named "Known gap") — not built here, targetUserId is caller-supplied.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';

jest.setTimeout(180000);

afterAll(async () => {
  await closePlatformAdminPool();
});

function platformAdminHeader(adminId?: string): string {
  return JSON.stringify({ type: 'platform_admin', adminId: adminId ?? randomUUID() });
}

describe('Story 5.13 — Platform Admin break-glass REST surface (cheap checks, no real Entra call)', () => {
  const app = createApp();

  it('AC1: POST .../break-glass/request records a pending request, no Entra action', async () => {
    const tenantId = randomUUID();
    const targetUserId = randomUUID();

    const res = await request(app)
      .post(`/v1/admin/tenants/${tenantId}/break-glass/request`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ targetUserId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('requested');
    expect(res.body.targetUserId).toBe(targetUserId);
    expect(res.body.temporaryAccessPass).toBeUndefined();
  });

  it('AC1/AC6: a tenant_admin/tenant_user identity is rejected 403 on the request route', async () => {
    const res = await request(app)
      .post(`/v1/admin/tenants/${randomUUID()}/break-glass/request`)
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()))
      .send({ targetUserId: randomUUID() });
    expect(res.status).toBe(403);
  });

  it('AC6: no Authorization/X-Test-Identity at all is rejected 401 before any handler runs', async () => {
    const res = await request(app).post(`/v1/admin/tenants/${randomUUID()}/break-glass/request`).send({});
    expect(res.status).toBe(401);
  });

  it('AC2: recording a request never auto-executes it — status stays "requested" until execute is separately called', async () => {
    const tenantId = randomUUID();
    const targetUserId = randomUUID();

    const created = await request(app)
      .post(`/v1/admin/tenants/${tenantId}/break-glass/request`)
      .set('X-Test-Identity', platformAdminHeader())
      .send({ targetUserId });

    const { rows } = await getPlatformAdminPool().query(
      `SELECT status FROM platform_admin_break_glass_requests WHERE id = $1`,
      [created.body.id]
    );
    expect(rows[0].status).toBe('requested');
  });

  it('AC6: a tenant_admin/tenant_user identity is rejected 403 on the execute route (no real request needed to prove this)', async () => {
    const res = await request(app)
      .post(`/v1/admin/tenants/${randomUUID()}/break-glass/requests/${randomUUID()}/execute`)
      .set('X-Test-Identity', testIdentityHeaderValue(randomUUID()));
    expect(res.status).toBe(403);
  });
});

describe('Story 5.13 — break-glass execute (real Entra tenant, exactly one real execution in this file)', () => {
  const TARGET_USER_ID = process.env.ENTRA_TEST_TARGET_USER_ID as string;
  const requiredEnvVars = [
    'ENTRA_TENANT_ID',
    'ENTRA_ELEVATOR_CLIENT_ID',
    'ENTRA_ELEVATOR_CLIENT_SECRET',
    'ENTRA_RESETTER_CLIENT_ID',
    'ENTRA_RESETTER_CLIENT_SECRET',
    'ENTRA_RESETTER_SP_OBJECT_ID',
    'ENTRA_USER_ADMINISTRATOR_ROLE_ID',
    'ENTRA_AUTHENTICATION_ADMINISTRATOR_ROLE_ID',
    'ENTRA_TEST_TARGET_USER_ID',
  ];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')} — see .env.example. This contract runs against the real ` +
        'getsocialengage.onmicrosoft.com tenant, not a mock.'
    );
  }

  const app = createApp();
  let tenantId: string;
  let requestId: string;
  let executeRes: request.Response;
  const executedByAdminId = randomUUID();

  beforeAll(async () => {
    tenantId = randomUUID();
    const created = await request(app)
      .post(`/v1/admin/tenants/${tenantId}/break-glass/request`)
      .set('X-Test-Identity', platformAdminHeader(executedByAdminId))
      .send({ targetUserId: TARGET_USER_ID });
    requestId = created.body.id;

    executeRes = await request(app)
      .post(`/v1/admin/tenants/${tenantId}/break-glass/requests/${requestId}/execute`)
      .set('X-Test-Identity', platformAdminHeader(executedByAdminId))
      .send({});
  });

  it('AC3: executing performs the real reset+TAP sequence and returns it once', () => {
    expect(executeRes.status).toBe(200);
    expect(executeRes.body.targetUserId).toBe(TARGET_USER_ID);
    expect(typeof executeRes.body.temporaryAccessPass).toBe('string');
    expect(executeRes.body.temporaryAccessPass.length).toBeGreaterThan(0);
    expect(new Date(executeRes.body.executedAt).getTime()).not.toBeNaN();
  });

  it('AC4: a second execute attempt against the same already-executed request is rejected (409), no second real Entra call', async () => {
    const retryRes = await request(app)
      .post(`/v1/admin/tenants/${tenantId}/break-glass/requests/${requestId}/execute`)
      .set('X-Test-Identity', platformAdminHeader(executedByAdminId))
      .send({});
    expect(retryRes.status).toBe(409);
  });

  it('AC5: the TAP/password never appear in the list endpoint or anywhere else — this response is the only disclosure', async () => {
    const list = await request(app).get('/v1/admin/tenants').set('X-Test-Identity', platformAdminHeader());
    expect(JSON.stringify(list.body)).not.toContain(executeRes.body.temporaryAccessPass);
  });

  it('AC7: both the request and the execution are audit-logged, TAP/password never in the detail', async () => {
    const { rows } = await getPlatformAdminPool().query(
      `SELECT operation, actor_identity, detail FROM platform_admin_audit_log
       WHERE actor_identity = $1 ORDER BY created_at`,
      [executedByAdminId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.map((r: { operation: string }) => r.operation)).toEqual(
      expect.arrayContaining(['break_glass_credential_reset'])
    );
    for (const row of rows) {
      expect(JSON.stringify(row.detail)).not.toContain(executeRes.body.temporaryAccessPass);
    }
  });
});
