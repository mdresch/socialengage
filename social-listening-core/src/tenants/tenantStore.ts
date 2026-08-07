import { withTenant } from '../db/withTenant';
import { getPlatformAdminPool } from '../db/platformAdminPool';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';

/**
 * Database row shape for the tenants table — matches migrations/0017_create_tenants.sql.
 * See .claude/skills/tenants/SKILL.md.
 */
export interface TenantRow {
  id: string;
  name: string;
  status: string;
  license_seat_count: number;
  active_seat_count: number;
  domain: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * REST shape for Tenant — camelCase fields, ISO 8601 timestamps.
 * See .claude/skills/tenants/SKILL.md.
 */
export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'deleting';
  licenseSeatCount: number;
  activeSeatCount: number;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  name: string;
  licenseSeatCount: number;
  domain?: string;
}

export interface UpdateTenantAdminInput {
  /** Deliberately excludes 'deleting' (Story 3.7, ADR-0039 §5) — that transition is never a side effect of this ordinary PATCH path; only the dedicated deletion confirmation flow (tenantDeletion.ts) sets it. */
  status?: 'active' | 'suspended';
  licenseSeatCount?: number;
  /** `undefined` = don't touch; `null` = clear it; string = set it (ADR-0037 §9). */
  domain?: string | null;
}

/** Exported for Story 5.15's selfServiceSignup.ts, which inserts via a different pool but the same Tenant shape. */
export function mapRowToTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    status: row.status as 'active' | 'suspended' | 'deleting',
    licenseSeatCount: row.license_seat_count,
    activeSeatCount: row.active_seat_count,
    domain: row.domain,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Create a new tenant — platform_admin_role only (ADR-0031 §2). Every write
 * through this role is audit-logged (ADR-0030 §5). Real request-time
 * authorization (which caller may invoke this) is Story 1.7/5.10's job —
 * this function only proves the mechanics, it does not check who's calling.
 */
export async function createTenant(actorIdentity: string, input: CreateTenantInput): Promise<Tenant> {
  const { rows } = await getPlatformAdminPool().query<TenantRow>(
    `INSERT INTO tenants (name, license_seat_count, domain)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.name, input.licenseSeatCount, input.domain ?? null]
  );
  const tenant = mapRowToTenant(rows[0]);

  await logPlatformAdminAction({
    actorIdentity,
    operation: 'create_tenant',
    targetTenantId: tenant.id,
    detail: { name: input.name, licenseSeatCount: input.licenseSeatCount },
  });

  return tenant;
}

/**
 * Update a tenant's status, license_seat_count, and/or domain —
 * platform_admin_role only. Deliberately cannot touch active_seat_count: the
 * database itself enforces this (migrations/0017's column-scoped GRANT), not
 * just this function's own SQL — see .claude/skills/tenants/SKILL.md's
 * "Load-bearing constraints". domain support (migrations/0020) is ADR-0037
 * §9's own audited recovery path for a wrong/squatted domain value — see
 * .claude/skills/platform-admin-tenant-management/SKILL.md.
 */
export async function updateTenantAdmin(
  actorIdentity: string,
  tenantId: string,
  input: UpdateTenantAdminInput
): Promise<Tenant | null> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(input.status);
  }
  if (input.licenseSeatCount !== undefined) {
    updates.push(`license_seat_count = $${paramIndex++}`);
    params.push(input.licenseSeatCount);
  }
  if (input.domain !== undefined) {
    updates.push(`domain = $${paramIndex++}`);
    params.push(input.domain);
  }

  if (updates.length === 0) {
    return null;
  }

  params.push(tenantId);

  const { rows } = await getPlatformAdminPool().query<TenantRow>(
    `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (rows.length === 0) {
    return null;
  }
  const tenant = mapRowToTenant(rows[0]);

  await logPlatformAdminAction({
    actorIdentity,
    operation: 'update_tenant_admin',
    targetTenantId: tenant.id,
    detail: { ...input },
  });

  return tenant;
}

/**
 * List every tenant — platform_admin_role only (Story 5.12). No pagination
 * yet; see .claude/skills/platform-admin-tenant-management/SKILL.md's
 * "Known gaps" for why that's deferred, not an oversight.
 */
export async function listTenants(): Promise<Tenant[]> {
  const { rows } = await getPlatformAdminPool().query<TenantRow>(`SELECT * FROM tenants ORDER BY created_at`);
  return rows.map(mapRowToTenant);
}

/**
 * Read the caller's own tenant row through the ordinary tenant-scoped
 * session (app_user, RLS-confined to exactly this id — ADR-0031 §2). No
 * Platform Admin bypass needed for this self-service case.
 */
export async function getOwnTenant(tenantId: string): Promise<Tenant | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    return rows.length > 0 ? mapRowToTenant(rows[0]) : null;
  });
}

/**
 * Reserve a seat for a tenant, atomically. A single `UPDATE ... WHERE
 * active_seat_count < license_seat_count RETURNING *` statement — this is
 * ADR-0031 §3's own suggested fix for its named race condition (two
 * concurrent invites both reading a stale count and both passing a
 * separate check), not a SELECT-then-UPDATE. Returns null if the tenant is
 * already at its seat ceiling. Runs as app_user via withTenant(), never
 * platform_admin_role — the database itself denies platform_admin_role this
 * write (migrations/0017's column-scoped GRANT).
 *
 * Not yet wired into a real user-invitation flow — no `users` table exists
 * (Story 5.9's job). Call this inside the same transaction that
 * inserts/activates a users row once that exists.
 */
export async function incrementActiveSeatCount(tenantId: string): Promise<Tenant | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(
      `UPDATE tenants
       SET active_seat_count = active_seat_count + 1
       WHERE id = $1 AND active_seat_count < license_seat_count
       RETURNING *`,
      [tenantId]
    );
    return rows.length > 0 ? mapRowToTenant(rows[0]) : null;
  });
}

/**
 * Release a seat for a tenant, atomically, floored at zero. Runs as
 * app_user via withTenant(), never platform_admin_role. Call this when a
 * user is removed/offboarded (Story 5.9's job to wire up for real).
 */
export async function decrementActiveSeatCount(tenantId: string): Promise<Tenant | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(
      `UPDATE tenants
       SET active_seat_count = GREATEST(active_seat_count - 1, 0)
       WHERE id = $1
       RETURNING *`,
      [tenantId]
    );
    return rows.length > 0 ? mapRowToTenant(rows[0]) : null;
  });
}
