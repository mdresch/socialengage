import { withTenant } from '../db/withTenant';
import { getIdentityResolverPool } from '../db/identityResolverPool';

/**
 * Database row shape for the users table — matches
 * migrations/0018_create_users_and_platform_admins.sql. See
 * .claude/skills/identity-resolution/SKILL.md.
 */
export interface UserRow {
  id: string;
  tenant_id: string;
  external_subject: string | null;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  invited_at: Date;
  activated_at: Date | null;
  access_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * REST shape for User — camelCase fields, ISO 8601 timestamps.
 */
export interface User {
  id: string;
  tenantId: string;
  externalSubject: string | null;
  email: string;
  displayName: string | null;
  role: 'tenant_admin' | 'tenant_user';
  status: 'invited' | 'active';
  invitedAt: string;
  activatedAt: string | null;
  accessEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvitedUserInput {
  email: string;
  role?: 'tenant_admin' | 'tenant_user';
}

/**
 * Result of resolving an authenticated request's token claims — the
 * request-time bootstrap ADR-0032 §5 describes. `null` means reject
 * (401/403) — a `sub` matching no `users` row and no Platform Admin row, or
 * matching a `users` row that isn't currently active (ADR-0032 §9).
 */
export type ResolvedIdentity =
  | { type: 'tenant_user'; tenantId: string; userId: string; role: string }
  | { type: 'platform_admin'; adminId: string };

export interface AuthClaims {
  sub: string;
  email: string;
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    externalSubject: row.external_subject,
    email: row.email,
    displayName: row.display_name,
    role: row.role as 'tenant_admin' | 'tenant_user',
    status: row.status as 'invited' | 'active',
    invitedAt: row.invited_at.toISOString(),
    activatedAt: row.activated_at ? row.activated_at.toISOString() : null,
    accessEndsAt: row.access_ends_at ? row.access_ends_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isCurrentlyActive(status: string, accessEndsAt: Date | null): boolean {
  return status === 'active' && (accessEndsAt === null || accessEndsAt.getTime() > Date.now());
}

/**
 * Tenant-Admin creates an invited user — an ordinary tenant-scoped write
 * (app_user via withTenant()), never platform_admin_role or
 * identity_resolver_role. `status` starts 'invited', `external_subject` is
 * NULL until the user's first successful sign-in links it (see
 * resolveIdentity()).
 */
export async function createInvitedUser(tenantId: string, input: CreateInvitedUserInput): Promise<User> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (tenant_id, email, role) VALUES ($1, $2, $3) RETURNING *`,
      [tenantId, input.email, input.role ?? 'tenant_user']
    );
    return mapRowToUser(rows[0]);
  });
}

/**
 * List all users for a tenant — RLS-scoped, includes both 'invited' and
 * 'active' rows, ordered by invited_at descending. Story 1.9 (ADR-0032 §2).
 */
export async function listUsers(tenantId: string): Promise<User[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<UserRow>(
      `SELECT * FROM users ORDER BY invited_at DESC`
    );
    return rows.map(mapRowToUser);
  });
}

/**
 * Set (or clear, with null) a user's access_ends_at — an ordinary
 * tenant-scoped write. Writes an audit row to user_access_audit_log per
 * ADR-0032 §9 (Story 1.9 is the first caller of that table; migration
 * 0024 creates it). actorUserId is the tenant_admin who made the change.
 */
export async function setAccessEndsAt(
  tenantId: string,
  userId: string,
  accessEndsAt: string | null,
  /** The tenant_admin making the change. Story 1.9's HTTP route supplies the real userId
   *  from the resolved identity. Test callers that manipulate access_ends_at directly
   *  must pass a valid UUID (e.g. randomUUID()). */
  actorUserId: string
): Promise<User | null> {
  return withTenant(tenantId, async (client) => {
    // Read the current value for the audit log before/after pair.
    const { rows: current } = await client.query<Pick<UserRow, 'access_ends_at'>>(
      `SELECT access_ends_at FROM users WHERE id = $1`,
      [userId]
    );
    if (current.length === 0) return null;
    const oldValue = current[0].access_ends_at ? current[0].access_ends_at.toISOString() : null;

    const { rows } = await client.query<UserRow>(
      `UPDATE users SET access_ends_at = $1 WHERE id = $2 RETURNING *`,
      [accessEndsAt, userId]
    );
    if (rows.length === 0) return null;

    const operation = accessEndsAt === null ? 'clear_access_ends_at' : 'set_access_ends_at';
    await client.query(
      `INSERT INTO user_access_audit_log
         (tenant_id, target_user_id, actor_user_id, operation, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, userId, actorUserId, operation, oldValue, accessEndsAt]
    );

    return mapRowToUser(rows[0]);
  });
}

/**
 * The request-time identity-resolution bootstrap (ADR-0032 §5). Reads
 * exclusively through identity_resolver_role (BYPASSRLS, column-scoped
 * SELECT-only, no write grant at all) — the one deliberate exception to
 * "every query runs through withTenant()" in this codebase, and only for
 * this single lookup.
 *
 * Resolution order: (1) an already-linked users row by sub, checked for
 * current activeness; (2) a platform_admins row by sub; (3) an unlinked
 * 'invited' users row by email — first sign-in. Case (3) is the one place
 * this function performs a write, and it does so through the *ordinary*
 * withTenant(tenantId, ...) app_user path, once identity_resolver_role's
 * own read has revealed which tenant the invited row belongs to — never
 * identity_resolver_role itself, which cannot write at all. See
 * .claude/skills/identity-resolution/SKILL.md's "Load-bearing constraints"
 * for why this split exists.
 */
export async function resolveIdentity(claims: AuthClaims): Promise<ResolvedIdentity | null> {
  const pool = getIdentityResolverPool();

  const { rows: bySub } = await pool.query<
    Pick<UserRow, 'id' | 'tenant_id' | 'role' | 'status' | 'access_ends_at'>
  >(`SELECT id, tenant_id, role, status, access_ends_at FROM users WHERE external_subject = $1`, [
    claims.sub,
  ]);
  if (bySub.length > 0) {
    const row = bySub[0];
    if (isCurrentlyActive(row.status, row.access_ends_at)) {
      return { type: 'tenant_user', tenantId: row.tenant_id, userId: row.id, role: row.role };
    }
    return null;
  }

  const { rows: adminRows } = await pool.query<{ id: string }>(
    `SELECT id FROM platform_admins WHERE external_subject = $1`,
    [claims.sub]
  );
  if (adminRows.length > 0) {
    return { type: 'platform_admin', adminId: adminRows[0].id };
  }

  const { rows: invitedRows } = await pool.query<{ id: string; tenant_id: string; role: string }>(
    `SELECT id, tenant_id, role FROM users WHERE email = $1 AND external_subject IS NULL AND status = 'invited'`,
    [claims.email]
  );
  if (invitedRows.length > 0) {
    const invited = invitedRows[0];
    await withTenant(invited.tenant_id, (client) =>
      client.query(
        `UPDATE users SET external_subject = $1, status = 'active', activated_at = now() WHERE id = $2`,
        [claims.sub, invited.id]
      )
    );
    return { type: 'tenant_user', tenantId: invited.tenant_id, userId: invited.id, role: invited.role };
  }

  return null;
}
