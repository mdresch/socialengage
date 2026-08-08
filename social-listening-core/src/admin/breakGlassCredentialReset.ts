import { getPlatformAdminPool } from '../db/platformAdminPool';
import { logPlatformAdminAction } from './platformAdminAuditLog';

/**
 * Story 5.7 (ADR-0030 §3, Clarifications 2026-08-03) — break-glass recovery
 * for a tenant's Tenant-Admin: a password reset AND a Temporary Access Pass
 * (TAP), covering both a forgotten-password lockout and a lost-MFA-device
 * lockout — a password reset alone does not touch MFA at all (verified
 * directly against Microsoft's own documentation), so a TAP is issued in the
 * same JIT execution per Menno's own direct instruction: "the break the
 * glass would need to turn off MFA for that Tenant Admin and Reset The
 * password in a single JiT request."
 *
 * Two explicit, separately-recorded phases, never one automated action
 * chaining them (first Clarification, same day) — per Menno's own direct
 * instruction: "the Tenant Admin Requests a JiT with his request to regain
 * access, the Jit request is picked up for execution, never self automate...
 * then remove the jit."
 *
 * 1. requestBreakGlassCredentialReset() — records a request. Performs no
 *    Entra-side action at all.
 * 2. executeBreakGlassRequest() — a Platform Admin explicitly picks up a
 *    pending request and triggers it: one JIT elevation window covering
 *    both the password reset and the TAP issuance, then de-elevation. Only
 *    this step touches Entra.
 *
 * Two-identity JIT elevation within step 2 (discovered and confirmed against
 * the real tenant during this story's own build — see
 * .claude/skills/platform-admin-access/SKILL.md's Known gaps for the full
 * account):
 *
 * - The "elevator" identity holds ONLY `RoleManagement.ReadWrite.Directory`
 *   (standing) — it grants and revokes both "User Administrator" and
 *   "Authentication Administrator" on the "resetter" identity, together,
 *   around each execution. It never performs the reset/TAP itself and is
 *   never itself granted either role.
 * - The "resetter" identity holds ONLY `User-PasswordProfile.ReadWrite.All`
 *   and `UserAuthMethod-TAP.ReadWrite.All` (standing) — it performs the
 *   actual password reset and TAP creation while it holds JIT-granted roles,
 *   but can never grant or revoke those roles for itself: Microsoft Graph
 *   rejects a principal removing its own directory role assignment,
 *   confirmed directly against the real tenant. Per Menno's own direct
 *   instruction, the resetter is also deliberately never granted
 *   `RoleManagement.ReadWrite.Directory` at all, so it cannot even request
 *   its own elevation in the first place.
 * - "Authentication Administrator" is scoped to non-admin users only — an
 *   Entra directory role restriction. Sufficient here because SocialEngage's
 *   Tenant-Admins hold no Entra directory role at all (they are ordinary
 *   External ID tenant users) — not to be assumed true for any other target.
 *
 * Platform Admin never learns or sets the Tenant-Admin's actual new
 * credential value (ADR-0030 §3) — the generated password is thrown away
 * immediately after the reset call; `forceChangePasswordNextSignIn: true`
 * means the Tenant-Admin must set their own new one at next sign-in. The
 * TAP code is different: it MUST reach the real Tenant-Admin to be useful,
 * so it is returned once, here, to the caller — never logged, never written
 * to the audit trail, never persisted anywhere by this module. How it's
 * actually delivered through a verified, out-of-band channel is not decided
 * here (ADR-0030's own Open Questions).
 */

export interface BreakGlassConfig {
  tenantId: string;
  elevatorClientId: string;
  elevatorClientSecret: string;
  resetterClientId: string;
  resetterClientSecret: string;
  resetterServicePrincipalId: string;
  userAdministratorRoleId: string;
  authenticationAdministratorRoleId: string;
}

/**
 * Story 5.13: reads real Entra credentials from environment variables at
 * call time, never cached at module load — mirrors app.ts's own
 * entraConfigFromEnv() pattern. See
 * .claude/skills/platform-admin-break-glass-rest/SKILL.md.
 */
export function breakGlassConfigFromEnv(): BreakGlassConfig {
  return {
    tenantId: process.env.ENTRA_TENANT_ID as string,
    elevatorClientId: process.env.ENTRA_ELEVATOR_CLIENT_ID as string,
    elevatorClientSecret: process.env.ENTRA_ELEVATOR_CLIENT_SECRET as string,
    resetterClientId: process.env.ENTRA_RESETTER_CLIENT_ID as string,
    resetterClientSecret: process.env.ENTRA_RESETTER_CLIENT_SECRET as string,
    resetterServicePrincipalId: process.env.ENTRA_RESETTER_SP_OBJECT_ID as string,
    userAdministratorRoleId: process.env.ENTRA_USER_ADMINISTRATOR_ROLE_ID as string,
    authenticationAdministratorRoleId: process.env.ENTRA_AUTHENTICATION_ADMINISTRATOR_ROLE_ID as string,
  };
}

export interface BreakGlassRequest {
  id: string;
  requestedBy: string;
  targetTenantId: string;
  targetUserId: string;
  status: 'requested' | 'executed' | 'denied';
}

export interface BreakGlassResult {
  requestId: string;
  targetUserId: string;
  executedAt: string;
  /** Sensitive, single-disclosure — do not log or persist this value. */
  temporaryAccessPass: string;
}

/**
 * Phase 1: records a break-glass request. No Entra-side action — this is
 * deliberately inert beyond the durable record itself.
 */
export async function requestBreakGlassCredentialReset(
  requestedBy: string,
  targetTenantId: string,
  targetUserId: string
): Promise<BreakGlassRequest> {
  const { rows } = await getPlatformAdminPool().query(
    `INSERT INTO platform_admin_break_glass_requests
       (requested_by, target_tenant_id, target_user_id)
     VALUES ($1, $2, $3)
     RETURNING id, requested_by, target_tenant_id, target_user_id, status`,
    [requestedBy, targetTenantId, targetUserId]
  );
  return {
    id: rows[0].id,
    requestedBy: rows[0].requested_by,
    targetTenantId: rows[0].target_tenant_id,
    targetUserId: rows[0].target_user_id,
    status: rows[0].status,
  };
}

async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!res.ok) {
    throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function randomTempPassword(): string {
  // Thrown away immediately after the reset call below — never logged, never
  // returned, never stored. Only forceChangePasswordNextSignIn matters to
  // the Tenant-Admin, who sets their own real password at next sign-in.
  return `Tmp${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!9`;
}

/** Matches revokeRoles()'s own already-documented replication-lag signature — see this module's own doc comment and platform-admin-access/SKILL.md's Load-bearing constraint. */
function isConflictingObjectError(status: number, bodyText: string): boolean {
  return status === 400 && /conflicting object/i.test(bodyText);
}

/**
 * Retries a "conflicting object... already present in the directory" 400,
 * mirroring revokeRoles()'s own already-documented handling of the mirror-
 * image case (a DELETE 404ing immediately after a very recent create) —
 * both are the same real, observed Entra directory replication lag
 * (~15s in testing, platform-admin-access/SKILL.md's own Load-bearing
 * constraint), not a logic error on either side. A conflict here means a
 * previous run's assignment for this exact (principal, role, scope) triple
 * hadn't finished propagating its own deletion yet — waiting and retrying
 * resolves it; treating it as a hard failure does not.
 */
async function grantRoles(
  elevatorToken: string,
  resetterServicePrincipalId: string,
  roleDefinitionIds: string[],
  maxAttempts = 8 // With exponential backoff, this provides a generous window.
): Promise<string[]> {
  const assignmentIds: string[] = [];
  for (const roleDefinitionId of roleDefinitionIds) {
    let assignment: { id: string } | undefined
    let lastError = ''
    for (let attempt = 1; attempt <= maxAttempts && !assignment; attempt += 1) {
      if (attempt > 1) {
        // Exponential backoff with jitter: 2^attempt * 1000ms, with some randomness.
        const delay = Math.random() * Math.pow(2, attempt) * 1000
        // Cap delay at 30s to avoid excessively long waits in edge cases.
        await new Promise((r) => setTimeout(r, Math.min(delay, 30000)))
      }

      const res = await fetch(
        'https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${elevatorToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            principalId: resetterServicePrincipalId,
            roleDefinitionId,
            directoryScopeId: '/',
          }),
        },
      )

      if (res.ok) {
        assignment = (await res.json()) as { id: string }
      } else {
        const bodyText = await res.text()
        if (isConflictingObjectError(res.status, bodyText) && attempt < maxAttempts) {
          lastError = `${res.status} ${bodyText}`
        } else {
          throw new Error(`JIT role grant failed (${roleDefinitionId}): ${res.status} ${bodyText}`)
        }
      }
    }
    if (!assignment) {
      throw new Error(`JIT role grant failed (${roleDefinitionId}) after retries: ${lastError}`);
    }
    assignmentIds.push(assignment.id);
  }
  return assignmentIds;
}

/**
 * Revokes every assignment, retrying 404s with backoff — confirmed directly
 * against the real tenant that a DELETE immediately following a successful
 * (201) role-assignment POST can itself 404 with "does not exist": real
 * Entra directory replication lag on the create side, not a logic error.
 * Attempts every assignment even if one fails, so a transient issue on one
 * role never leaves a different role silently un-revoked.
 */
async function revokeRoles(elevatorToken: string, assignmentIds: string[]): Promise<void> {
  const maxAttempts = 8; // Matches grantRoles's own resilience buffer.
  const errors: string[] = [];
  for (const assignmentId of assignmentIds) {
    let revoked = false;
    let lastError = '';
    for (let attempt = 1; attempt <= maxAttempts && !revoked; attempt += 1) {
      if (attempt > 1) {
        // Exponential backoff with jitter, matching grantRoles.
        const delay = Math.random() * Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, Math.min(delay, 30000)));
      }
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments/${assignmentId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${elevatorToken}` } }
      );
      if (res.ok) {
        revoked = true;
      } else if (res.status === 404 && attempt < maxAttempts) {
        lastError = `${res.status} ${await res.text()}`;
      } else {
        lastError = `${res.status} ${await res.text()}`;
        break;
      }
    }
    if (!revoked) errors.push(`${assignmentId}: ${lastError}`);
  }
  if (errors.length > 0) {
    throw new Error(`JIT role revoke failed for: ${errors.join('; ')}`);
  }
}

/**
 * Phase 2: a Platform Admin explicitly picks up a `requested` request and
 * executes it — the only step that touches Entra. Rejects a request that
 * isn't in `requested` status (no re-executing, no executing a denied
 * request). One JIT elevation window covers both actions below.
 */
export async function executeBreakGlassRequest(
  config: BreakGlassConfig,
  requestId: string,
  executedBy: string
): Promise<BreakGlassResult> {
  const pool = getPlatformAdminPool();

  const { rows } = await pool.query(
    `SELECT id, target_tenant_id, target_user_id, status
     FROM platform_admin_break_glass_requests WHERE id = $1`,
    [requestId]
  );
  if (rows.length === 0) {
    throw new Error(`Break-glass request ${requestId} not found`);
  }
  const request = rows[0];
  if (request.status !== 'requested') {
    throw new Error(`Break-glass request ${requestId} is not pending (status: ${request.status})`);
  }

  const targetUserId = request.target_user_id as string;
  const targetTenantId = request.target_tenant_id as string;

  const elevatorToken = await getGraphToken(
    config.elevatorClientId,
    config.elevatorClientSecret,
    config.tenantId
  );

  const assignmentIds = await grantRoles(elevatorToken, config.resetterServicePrincipalId, [
    config.userAdministratorRoleId,
    config.authenticationAdministratorRoleId,
  ]);

  let temporaryAccessPass = '';
  try {
    const resetterToken = await getGraphToken(
      config.resetterClientId,
      config.resetterClientSecret,
      config.tenantId
    );

    const resetRes = await fetch(`https://graph.microsoft.com/v1.0/users/${targetUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${resetterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passwordProfile: {
          forceChangePasswordNextSignIn: true,
          password: randomTempPassword(),
        },
      }),
    });
    if (!resetRes.ok) {
      throw new Error(`Credential reset failed: ${resetRes.status} ${await resetRes.text()}`);
    }

    const tapRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${targetUserId}/authentication/temporaryAccessPassMethods`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${resetterToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifetimeInMinutes: 60, isUsableOnce: true }),
      }
    );
    if (!tapRes.ok) {
      throw new Error(`Temporary Access Pass creation failed: ${tapRes.status} ${await tapRes.text()}`);
    }
    const tap = (await tapRes.json()) as { temporaryAccessPass: string };
    temporaryAccessPass = tap.temporaryAccessPass;
  } finally {
    // Revoke even if either step above failed — never leave the resetter
    // elevated. Uses the elevator's own token, not the resetter's — the
    // resetter cannot remove its own role assignments (see module doc above).
    await revokeRoles(elevatorToken, assignmentIds);
  }

  const executedAt = new Date().toISOString();

  await pool.query(
    `UPDATE platform_admin_break_glass_requests
     SET status = 'executed', executed_by = $1, executed_at = $2
     WHERE id = $3`,
    [executedBy, executedAt, requestId]
  );

  // Never include temporaryAccessPass in the audit log — sensitive,
  // single-disclosure material, returned to the caller only, below.
  await logPlatformAdminAction({
    actorIdentity: executedBy,
    operation: 'break_glass_credential_reset',
    targetTenantId,
    detail: { requestId, targetUserId, executedAt },
  });

  return { requestId, targetUserId, executedAt, temporaryAccessPass };
}
