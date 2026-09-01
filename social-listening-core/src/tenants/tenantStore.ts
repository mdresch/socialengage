import { withTenant } from '../db/withTenant';
import { getPlatformAdminPool } from '../db/platformAdminPool';
import { logPlatformAdminAction } from '../admin/platformAdminAuditLog';
import {
  getPlanFeatureGates,
  getEffectiveFeatureGates,
  getEffectiveMaxSeats,
  isFeatureEnabled,
  PLANS,
} from './featureGates';

/**
 * Database row shape for the tenants table — matches migrations/0017 and 0066.
 * See .claude/skills/tenants/SKILL.md.
 */
export interface TenantRow {
  id: string;
  name: string;
  status: string;
  license_seat_count: number;
  active_seat_count: number;
  domain: string | null;
  plan: string;
  feature_gates: Record<string, any>;
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
  /** Present on create, update, and self-view; omitted from admin list. */
  plan?: string;
  /** Present on create, update, and self-view; omitted from admin list. */
  featureGates?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  name: string;
  licenseSeatCount: number;
  domain?: string;
  plan?: string;
  featureGates?: Record<string, any>;
}

export interface UpdateTenantAdminInput {
  /** Deliberately excludes 'deleting' (Story 3.7, ADR-0039 §5). */
  status?: 'active' | 'suspended';
  licenseSeatCount?: number;
  /** `undefined` = don't touch; `null` = clear it; string = set it (ADR-0037 §9). */
  domain?: string | null;
  /** Enhancement, 2026-08-12. */
  name?: string;
  /** Story 13.5 (ADR-0112). */
  plan?: string;
  /** Story 13.5 (ADR-0112). */
  featureGates?: Record<string, any>;
}

/** Exported for Story 5.15's selfServiceSignup.ts. */
export function mapRowToTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    status: row.status as 'active' | 'suspended' | 'deleting',
    licenseSeatCount: row.license_seat_count,
    activeSeatCount: row.active_seat_count,
    domain: row.domain,
    plan: row.plan ?? 'starter',
    featureGates: row.feature_gates || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function buildFeatureGatesForCreate(
  plan: string | undefined,
  licenseSeatCount: number,
  overrides: Record<string, any> | undefined
): Record<string, any> {
  const base = getPlanFeatureGates(plan ?? 'starter');
  // The provided licenseSeatCount becomes the concrete max_seats for this
  // tenant, so existing contracts that drive seat behaviour through
  // license_seat_count keep working while the new feature_gates path is
  // also populated.
  const withLicenseMax = { ...base, max_seats: licenseSeatCount };
  return { ...withLicenseMax, ...(overrides || {}) };
}

function buildFeatureGatesForUpdate(
  currentPlan: string,
  currentFeatureGates: Record<string, any>,
  input: UpdateTenantAdminInput
): Record<string, any> {
  const nextPlan = input.plan ?? currentPlan;
  const planGates = getPlanFeatureGates(nextPlan);
  // Start from the plan defaults, then apply any stored overrides the tenant
  // already had, then apply the explicit update (if any). This preserves
  // tenant-level overrides like a disabled feature when the plan changes.
  const merged = { ...planGates, ...currentFeatureGates, ...(input.featureGates || {}) };

  if (input.licenseSeatCount !== undefined && input.featureGates?.max_seats === undefined) {
    merged.max_seats = input.licenseSeatCount;
  }

  return merged;
}

/**
 * Create a new tenant — platform_admin_role only (ADR-0031 §2). Every write
 * through this role is audit-logged (ADR-0030 §5).
 */
export async function createTenant(actorIdentity: string, input: CreateTenantInput): Promise<Tenant> {
  const plan = input.plan ?? 'starter';
  const featureGates = buildFeatureGatesForCreate(plan, input.licenseSeatCount, input.featureGates);

  const { rows } = await getPlatformAdminPool().query<TenantRow>(
    `INSERT INTO tenants (name, license_seat_count, domain, plan, feature_gates)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.licenseSeatCount, input.domain ?? null, plan, JSON.stringify(featureGates)]
  );
  const tenant = mapRowToTenant(rows[0]);

  await logPlatformAdminAction({
    actorIdentity,
    operation: 'create_tenant',
    targetTenantId: tenant.id,
    detail: { name: input.name, licenseSeatCount: input.licenseSeatCount, plan, featureGates },
  });

  return tenant;
}

/**
 * Update a tenant's status, license_seat_count, domain, name, plan, and/or
 * feature_gates — platform_admin_role only. Cannot touch active_seat_count.
 */
export async function updateTenantAdmin(
  actorIdentity: string,
  tenantId: string,
  input: UpdateTenantAdminInput
): Promise<Tenant | null> {
  // Read current row so we can merge feature_gates and plan correctly.
  const { rows: currentRows } = await getPlatformAdminPool().query<TenantRow>(
    `SELECT * FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (currentRows.length === 0) {
    return null;
  }
  const current = currentRows[0];

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
  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }
  if (input.plan !== undefined) {
    updates.push(`plan = $${paramIndex++}`);
    params.push(input.plan);
  }
  if (input.plan !== undefined || input.featureGates !== undefined || input.licenseSeatCount !== undefined) {
    const nextFeatureGates = buildFeatureGatesForUpdate(
      input.plan ?? current.plan ?? 'starter',
      current.feature_gates || {},
      input
    );
    updates.push(`feature_gates = $${paramIndex++}`);
    params.push(JSON.stringify(nextFeatureGates));
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
 * List every tenant — platform_admin_role only (Story 5.12). Returns the
 * legacy admin-facing shape to keep contract 5.12's exact-key assertion green.
 */
function mapRowToAdminListTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    status: row.status as 'active' | 'suspended' | 'deleting',
    licenseSeatCount: row.license_seat_count,
    activeSeatCount: row.active_seat_count,
    domain: row.domain,
    // Story 5.12's admin list response is intentionally stable: plan and
    // featureGates are not included here. They are exposed on the individual
    // tenant view (GET /v1/tenants/plan) and on create/patch responses.
    plan: row.plan ?? 'starter',
    featureGates: row.feature_gates || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const { rows } = await getPlatformAdminPool().query<TenantRow>(`SELECT * FROM tenants ORDER BY created_at`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status as 'active' | 'suspended' | 'deleting',
    licenseSeatCount: row.license_seat_count,
    activeSeatCount: row.active_seat_count,
    domain: row.domain,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

/**
 * Read the caller's own tenant row through the ordinary tenant-scoped
 * session (app_user, RLS-confined to exactly this id — ADR-0031 §2).
 */
export async function getOwnTenant(tenantId: string): Promise<Tenant | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    return rows.length > 0 ? mapRowToTenant(rows[0]) : null;
  });
}

export interface TenantPlanView {
  plan: string;
  maxSeats: number;
  usedSeats: number;
  licenseSeatCount: number;
  featureGates: Record<string, any>;
}

/**
 * Story 13.5 (ADR-0112): tenant-facing plan and usage view.
 */
export async function getTenantPlan(tenantId: string): Promise<TenantPlanView | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    if (rows.length === 0) return null;
    const row = rows[0];
    const effectiveGates = getEffectiveFeatureGates(row.plan, row.feature_gates);
    return {
      plan: row.plan ?? 'starter',
      maxSeats: getEffectiveMaxSeats(row.feature_gates, row.license_seat_count),
      usedSeats: row.active_seat_count,
      licenseSeatCount: row.license_seat_count,
      featureGates: effectiveGates,
    };
  });
}

/**
 * Story 13.6 (ADR-0112): Platform-Admin plan and usage view for a specific tenant.
 * Mirrors getTenantPlan but uses the platform_admin pool so it can read any tenant row.
 */
export async function getAdminTenantPlan(tenantId: string): Promise<TenantPlanView | null> {
  const { rows } = await getPlatformAdminPool().query<TenantRow>(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  if (rows.length === 0) return null;
  const row = rows[0];
  const effectiveGates = getEffectiveFeatureGates(row.plan, row.feature_gates);
  return {
    plan: row.plan ?? 'starter',
    maxSeats: getEffectiveMaxSeats(row.feature_gates, row.license_seat_count),
    usedSeats: row.active_seat_count,
    licenseSeatCount: row.license_seat_count,
    featureGates: effectiveGates,
  };
}

export interface SeatAndGateStatus {
  activeSeatCount: number;
  maxSeats: number;
  licenseSeatCount: number;
  hasExplicitMaxSeats: boolean;
  featureGates: Record<string, any>;
}

/**
 * Story 13.5: a single read that returns seat-ceiling and feature-gate state
 * for a tenant. Used by invite, reactivation, and accept paths.
 */
export async function getTenantSeatAndGateStatus(tenantId: string): Promise<SeatAndGateStatus | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      active_seat_count: number;
      license_seat_count: number;
      feature_gates: Record<string, any>;
      has_max_seats: boolean;
    }>(
      `SELECT active_seat_count,
              license_seat_count,
              feature_gates,
              (feature_gates ? 'max_seats')::boolean AS has_max_seats
       FROM tenants
       WHERE id = $1`,
      [tenantId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    const hasExplicitMaxSeats = row.has_max_seats;
    const maxSeats = hasExplicitMaxSeats
      ? Number(row.feature_gates.max_seats)
      : row.license_seat_count;
    return {
      activeSeatCount: row.active_seat_count,
      maxSeats,
      licenseSeatCount: row.license_seat_count,
      hasExplicitMaxSeats,
      featureGates: row.feature_gates || {},
    };
  });
}

/**
 * Reserve a seat for a tenant, atomically. Uses `feature_gates.max_seats` when
 * explicitly set, otherwise falls back to `license_seat_count`.
 */
export async function incrementActiveSeatCount(tenantId: string): Promise<Tenant | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantRow>(
      `UPDATE tenants
       SET active_seat_count = active_seat_count + 1
       WHERE id = $1
         AND active_seat_count < COALESCE((feature_gates->>'max_seats')::int, license_seat_count)
       RETURNING *`,
      [tenantId]
    );
    return rows.length > 0 ? mapRowToTenant(rows[0]) : null;
  });
}

/**
 * Release a seat for a tenant, atomically, floored at zero.
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

/**
 * Story 12.13 (ADR-0107): Reads stored feature gates for a tenant.
 */
export async function getTenantFeatureGates(tenantId: string): Promise<Record<string, any>> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ feature_gates: Record<string, any> }>(
      `SELECT feature_gates FROM tenants WHERE id = $1`,
      [tenantId]
    );
    return rows[0]?.feature_gates || {};
  });
}

/**
 * Story 12.13 (ADR-0107) + 13.5: Updates stored feature gates for a tenant.
 * The update is a tenant-scoped write under app_user.
 */
export async function updateTenantFeatureGates(
  tenantId: string,
  featureGates: Record<string, any>
): Promise<Record<string, any>> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ feature_gates: Record<string, any> }>(
      `UPDATE tenants
       SET feature_gates = $2
       WHERE id = $1
       RETURNING feature_gates`,
      [tenantId, JSON.stringify(featureGates)]
    );
    return rows[0]?.feature_gates || {};
  });
}

/**
 * Convenience helper for route-level code that already has a tenant row in hand.
 */
export function checkFeatureGate(featureGates: Record<string, any> | undefined, feature: string): boolean {
  return isFeatureEnabled(featureGates, feature);
}
