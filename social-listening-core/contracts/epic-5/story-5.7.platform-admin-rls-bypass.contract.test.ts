/**
 * Story 5.7 — Platform Admin's audited, narrowly-scoped RLS bypass
 * Source ADR: ADR-0030 (accepted 2026-08-03, revised at review to add a
 * break-glass mechanism)
 *
 * Intent: prove that `platform_admin_role` (a) is granted BYPASSRLS but has
 * zero privileges on every tenant-content table that exists today, (b) every
 * write it performs is durably logged, (c) an ordinary tenant-scoped write
 * runs under `app_user`, never this role, and (d) the break-glass credential-
 * reset mechanism (ADR-0030 §3) genuinely works against a real Entra tenant,
 * including the two-identity JIT elevation/revocation this story's own build
 * discovered was required (a principal cannot remove its own directory role
 * assignment — confirmed directly, not assumed).
 *
 * Explicitly out of scope for this story (per the scope narrowing agreed
 * with Menno before implementation — see this story's own Status note and
 * docs/implementation-plan.md's Phase 4.5 section):
 * - Granting platform_admin_role anything on the `tenants` table — that
 *   table does not exist yet (Story 5.8, ADR-0031). Story 5.8's own
 *   migration adds that grant when it creates the table.
 * - Looking up which Entra user is "a named tenant's Tenant-Admin" — that
 *   requires the `users` table (Story 5.9, ADR-0032). This story proves the
 *   break-glass *mechanism* against a real, directly-specified target user.
 * - Real request-time authentication/authorization gating who may invoke
 *   these functions — Stories 5.6 (done) proves token validation; wiring
 *   role-based authorization into a real route is Story 1.7/5.10's job.
 *
 * AC1: platform_admin_role has BYPASSRLS, and zero grants on every
 *      tenant-content table that exists today (watchlists, social_posts,
 *      platform_credentials, authors, ingestion_runs, author_topic_signals).
 * AC2: a write performed through platform_admin_role is recorded in
 *      platform_admin_audit_log (actor, operation, target tenant, timestamp).
 * AC3: an ordinary tenant-scoped write (withTenant()) runs as app_user, never
 *      platform_admin_role.
 * AC-breakglass-request: requestBreakGlassCredentialReset() records a request
 *      and performs no Entra action at all (ADR-0030 Clarification, 2026-08-03
 *      — two-phase, human-reviewed workflow, never a single automated action).
 * AC-breakglass-execute: executeBreakGlassRequest() against a real, disposable
 *      Entra test user succeeds, is logged, leaves the resetter identity with
 *      no lingering role assignments afterward, and rejects a second attempt
 *      to execute an already-executed request.
 * AC-mfa: the same execution also issues a real Temporary Access Pass (not
 *      only a password reset) — ADR-0030's second Clarification, 2026-08-03,
 *      covering a lost-MFA-device lockout a password reset alone cannot fix.
 *      The TAP code is returned to the caller but never appears in the audit
 *      log's own detail — sensitive, single-disclosure material.
 */

import { randomUUID } from 'crypto';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getPool, closePool } from '../../src/db/pool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { logPlatformAdminAction } from '../../src/admin/platformAdminAuditLog';
import {
  requestBreakGlassCredentialReset,
  executeBreakGlassRequest,
  type BreakGlassConfig,
  type BreakGlassRequest,
  type BreakGlassResult,
} from '../../src/admin/breakGlassCredentialReset';

jest.setTimeout(180000);

const CONTENT_TABLES = [
  'watchlists',
  'social_posts',
  'platform_credentials',
  'authors',
  'ingestion_runs',
  'author_topic_signals',
];

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

describe('Story 5.7 — Platform Admin RLS bypass and audit log', () => {
  it('AC1: platform_admin_role has BYPASSRLS', async () => {
    const { rows } = await getAdminPool().query(
      `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'platform_admin_role'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolbypassrls).toBe(true);
  });

  it.each(CONTENT_TABLES)('AC1: platform_admin_role has zero access to %s', async (table) => {
    await expect(getPlatformAdminPool().query(`SELECT * FROM ${table} LIMIT 1`)).rejects.toThrow(
      /permission denied/i
    );
  });

  it('AC2: a write through platform_admin_role is recorded in the audit log', async () => {
    const actorIdentity = `test-actor-${randomUUID()}`;
    const targetTenantId = randomUUID();

    await logPlatformAdminAction({
      actorIdentity,
      operation: 'test_write',
      targetTenantId,
      detail: { note: 'AC2 contract assertion' },
    });

    const { rows } = await getPlatformAdminPool().query(
      `SELECT actor_identity, operation, target_tenant_id, created_at
       FROM platform_admin_audit_log
       WHERE actor_identity = $1`,
      [actorIdentity]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].operation).toBe('test_write');
    expect(rows[0].target_tenant_id).toBe(targetTenantId);
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it('AC3: an ordinary tenant-scoped write runs as app_user, never platform_admin_role', async () => {
    const tenantId = randomUUID();
    const currentUser = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query('SELECT current_user');
      return rows[0].current_user;
    });

    expect(currentUser).toBe('app_user');
    expect(currentUser).not.toBe('platform_admin_role');
  });

  it('sanity: app_user itself still has zero access to platform_admin_audit_log (not just the reverse)', async () => {
    await expect(getPool().query(`SELECT * FROM platform_admin_audit_log LIMIT 1`)).rejects.toThrow(
      /permission denied/i
    );
  });
});

describe('Story 5.7 — break-glass credential reset (real Entra tenant)', () => {
  const TENANT_ID = process.env.ENTRA_TENANT_ID as string;
  const ELEVATOR_CLIENT_ID = process.env.ENTRA_ELEVATOR_CLIENT_ID as string;
  const ELEVATOR_CLIENT_SECRET = process.env.ENTRA_ELEVATOR_CLIENT_SECRET as string;
  const RESETTER_CLIENT_ID = process.env.ENTRA_RESETTER_CLIENT_ID as string;
  const RESETTER_CLIENT_SECRET = process.env.ENTRA_RESETTER_CLIENT_SECRET as string;
  const RESETTER_SP_ID = process.env.ENTRA_RESETTER_SP_OBJECT_ID as string;
  const USER_ADMIN_ROLE_ID = process.env.ENTRA_USER_ADMINISTRATOR_ROLE_ID as string;
  const AUTH_ADMIN_ROLE_ID = process.env.ENTRA_AUTHENTICATION_ADMINISTRATOR_ROLE_ID as string;
  const TARGET_USER_ID = process.env.ENTRA_TEST_TARGET_USER_ID as string;

  const breakGlassConfig: BreakGlassConfig = {
    tenantId: TENANT_ID,
    elevatorClientId: ELEVATOR_CLIENT_ID,
    elevatorClientSecret: ELEVATOR_CLIENT_SECRET,
    resetterClientId: RESETTER_CLIENT_ID,
    resetterClientSecret: RESETTER_CLIENT_SECRET,
    resetterServicePrincipalId: RESETTER_SP_ID,
    userAdministratorRoleId: USER_ADMIN_ROLE_ID,
    authenticationAdministratorRoleId: AUTH_ADMIN_ROLE_ID,
  };

  // These are declared here and initialized in the beforeAll() so that all
  // `it()` blocks in the nested describe() below can share the results of the
  // single, expensive, real Entra execution.
  let request: BreakGlassRequest;
  let result: BreakGlassResult;

  if (
    !TENANT_ID ||
    !ELEVATOR_CLIENT_ID ||
    !ELEVATOR_CLIENT_SECRET ||
    !RESETTER_CLIENT_ID ||
    !RESETTER_CLIENT_SECRET ||
    !RESETTER_SP_ID ||
    !USER_ADMIN_ROLE_ID ||
    !AUTH_ADMIN_ROLE_ID ||
    !TARGET_USER_ID
  ) {
    throw new Error(
      'Missing ENTRA_* break-glass env vars — see .env.example. This contract runs against ' +
        'the real getsocialengage.onmicrosoft.com tenant, not a mock.'
    );
  }

  async function getElevatorToken(): Promise<string> {
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: ELEVATOR_CLIENT_ID,
        client_secret: ELEVATOR_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  it('AC-breakglass-request: recording a request performs no Entra action at all', async () => {
    const requestedBy = `test-tenant-admin-${randomUUID()}`;
    const targetTenantId = randomUUID();

    const request = await requestBreakGlassCredentialReset(requestedBy, targetTenantId, TARGET_USER_ID);

    expect(request.status).toBe('requested');
    expect(request.targetUserId).toBe(TARGET_USER_ID);

    const { rows } = await getPlatformAdminPool().query(
      `SELECT status, executed_by, executed_at FROM platform_admin_break_glass_requests WHERE id = $1`,
      [request.id]
    );
    expect(rows[0].status).toBe('requested');
    expect(rows[0].executed_by).toBeNull();
    expect(rows[0].executed_at).toBeNull();
  });

  describe('AC-breakglass-execute: picking up a request', () => {
    const requestedBy = `test-tenant-admin-${randomUUID()}`;
    const executedBy = `test-platform-admin-${randomUUID()}`;
    const targetTenantId = randomUUID();

    beforeAll(async () => {
      // Proactive cleanup: Before running the test, ensure the resetter
      // principal has no lingering role assignments from a previous,
      // possibly failed, test run. This addresses the root cause of the
      // "conflicting object" error by ensuring a clean state, rather than
      // reactively waiting for eventual consistency.
      const elevatorToken = await getElevatorToken();
      const assignmentsRes = await fetch(
        `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${RESETTER_SP_ID}'`,
        { headers: { Authorization: `Bearer ${elevatorToken}` } }
      );
      if (assignmentsRes.ok) {
        const { value: existingAssignments } = (await assignmentsRes.json()) as { value: { id: string }[] };
        if (existingAssignments.length > 0) {
          const revokeRes = await fetch(`https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments/${existingAssignments[0].id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${elevatorToken}` } });
          if (revokeRes.ok) await new Promise(r => setTimeout(r, 15000)); // Wait for revoke to propagate
        }
      }

      request = await requestBreakGlassCredentialReset(requestedBy, targetTenantId, TARGET_USER_ID);
      result = await executeBreakGlassRequest(breakGlassConfig, request.id, executedBy);
    });

    it('performs the real reset and issues a Temporary Access Pass', () => {
      expect(result.targetUserId).toBe(TARGET_USER_ID);
      expect(new Date(result.executedAt).getTime()).not.toBeNaN();
      // AC-mfa: a real Temporary Access Pass was issued, covering a lost-MFA-
      // device lockout that the password reset alone cannot solve.
      expect(typeof result.temporaryAccessPass).toBe('string');
      expect(result.temporaryAccessPass.length).toBeGreaterThan(0);
    });

    it('updates the request status to "executed"', async () => {
      const { rows: requestRows } = await getPlatformAdminPool().query(
        `SELECT status, executed_by FROM platform_admin_break_glass_requests WHERE id = $1`,
        [request.id]
      );
      expect(requestRows[0].status).toBe('executed');
      expect(requestRows[0].executed_by).toBe(executedBy);
    });

    it('logs the action to the audit log, without the sensitive TAP code', async () => {
      const { rows } = await getPlatformAdminPool().query(
        `SELECT operation, target_tenant_id, detail FROM platform_admin_audit_log WHERE actor_identity = $1`,
        [executedBy]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].operation).toBe('break_glass_credential_reset');
      expect(rows[0].target_tenant_id).toBe(targetTenantId);
      expect(JSON.stringify(rows[0].detail)).not.toContain(result.temporaryAccessPass);
    });

    it('leaves the resetter identity de-elevated after execution', async () => {
      // Confirm de-elevation genuinely happened — replication lag observed
      // directly during this story's own build (~15s), so poll briefly rather
      // than asserting on a single immediate read.
      const elevatorToken = await getElevatorToken();
      let stillElevated = true;
      for (let attempt = 0; attempt < 6 && stillElevated; attempt += 1) {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${RESETTER_SP_ID}'`,
          { headers: { Authorization: `Bearer ${elevatorToken}` } }
        );
        const json = (await res.json()) as { value: unknown[] };
        stillElevated = json.value.length > 0;
        if (stillElevated) await new Promise((r) => setTimeout(r, 5000));
      }
      expect(stillElevated).toBe(false);
    });

    it('rejects a second attempt to execute the same request', async () => {
      await expect(executeBreakGlassRequest(breakGlassConfig, request.id, executedBy)).rejects.toThrow(
        /not pending/i
      );
    });
  });
});
