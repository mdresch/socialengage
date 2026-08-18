import { withTenant } from '../db/withTenant';

export type ConnectorActivationOwnerType = 'tenant' | 'user';

export interface ConnectorActivationRow {
  isActive: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
}

interface RawActivationRow {
  is_active: boolean;
  activated_at: Date | null;
  deactivated_at: Date | null;
}

function toActivationRow(row: RawActivationRow): ConnectorActivationRow {
  return {
    isActive: row.is_active,
    activatedAt: row.activated_at ? row.activated_at.toISOString() : null,
    deactivatedAt: row.deactivated_at ? row.deactivated_at.toISOString() : null,
  };
}

/**
 * Story 1.11 (ADR-0051): two ownership-scoped, credential-independent
 * activation tables -- connector_activations (tenant-wide, ADR-0028 Tier
 * 2) and connector_user_activations (user-specific, Tier 3). Deliberately
 * two separate query paths per ownerType, never dynamic table-name
 * interpolation, mirroring credentialStore.ts's own
 * getLatestCredentialId()/deleteCredential() if/else-per-ownerType shape.
 * See .claude/skills/connector-activation/SKILL.md.
 */
async function readTenantActivation(tenantId: string, platformId: string): Promise<RawActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawActivationRow>(
      `SELECT is_active, activated_at, deactivated_at FROM connector_activations
       WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

async function readUserActivation(
  tenantId: string,
  platformId: string,
  userId: string
): Promise<RawActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawActivationRow>(
      `SELECT is_active, activated_at, deactivated_at FROM connector_user_activations
       WHERE tenant_id = $1 AND platform_id = $2 AND user_id = $3`,
      [tenantId, platformId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

/**
 * Reads current activation state -- never distinguishes "no row" from
 * "row with is_active = false" (ADR-0051 Decision Section 1's own
 * lazy-creation rule: absence of a row means "never activated," read
 * identically to is_active = false).
 */
export async function isConnectorActive(
  tenantId: string,
  platformId: string,
  ownerType: ConnectorActivationOwnerType,
  userId?: string
): Promise<boolean> {
  const row =
    ownerType === 'user'
      ? await readUserActivation(tenantId, platformId, userId as string)
      : await readTenantActivation(tenantId, platformId);
  return row?.is_active ?? false;
}

/**
 * Story 1.15 (ADR-0061 Decision §2) -- every userId with a real, currently
 * active connector_user_activations row for this (tenantId, platformId).
 * The Tier-3 scheduler's own per-user enumeration -- the only reader in
 * this file that lists everyone rather than checking one specific target;
 * see .claude/skills/connector-activation/SKILL.md.
 */
export async function listActiveUserActivations(tenantId: string, platformId: string): Promise<string[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `SELECT user_id FROM connector_user_activations
       WHERE tenant_id = $1 AND platform_id = $2 AND is_active = true`,
      [tenantId, platformId]
    );
    return rows.map((row) => row.user_id);
  });
}

/**
 * Sets activation state. Idempotent: if the target state already matches,
 * this is a genuine no-op -- no row is inserted just to record an
 * updated_by touch, and activated_at/deactivated_at are never bumped for a
 * call that changes nothing (AC6). A row is created only on the first real
 * state-changing call, per ADR-0051's own lazy-creation rule -- never
 * pre-populated.
 */
export async function setConnectorActivation(
  tenantId: string,
  platformId: string,
  ownerType: ConnectorActivationOwnerType,
  isActive: boolean,
  updatedBy?: string,
  userId?: string
): Promise<ConnectorActivationRow> {
  if (ownerType === 'user') {
    return withTenant(tenantId, async (client) => {
      const existing = await client.query<RawActivationRow>(
        `SELECT is_active, activated_at, deactivated_at FROM connector_user_activations
         WHERE tenant_id = $1 AND platform_id = $2 AND user_id = $3`,
        [tenantId, platformId, userId]
      );
      if (existing.rows.length > 0 && existing.rows[0].is_active === isActive) {
        return toActivationRow(existing.rows[0]);
      }
      if (existing.rows.length === 0) {
        const { rows } = await client.query<RawActivationRow>(
          `INSERT INTO connector_user_activations
             (tenant_id, platform_id, user_id, is_active, activated_at, deactivated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING is_active, activated_at, deactivated_at`,
          [
            tenantId,
            platformId,
            userId,
            isActive,
            isActive ? new Date() : null,
            isActive ? null : new Date(),
            updatedBy ?? null,
          ]
        );
        return toActivationRow(rows[0]);
      }
      const { rows } = await client.query<RawActivationRow>(
        `UPDATE connector_user_activations
         SET is_active = $4,
             activated_at = CASE WHEN $4 THEN now() ELSE activated_at END,
             deactivated_at = CASE WHEN $4 THEN deactivated_at ELSE now() END,
             updated_by = $5
         WHERE tenant_id = $1 AND platform_id = $2 AND user_id = $3
         RETURNING is_active, activated_at, deactivated_at`,
        [tenantId, platformId, userId, isActive, updatedBy ?? null]
      );
      return toActivationRow(rows[0]);
    });
  }

  return withTenant(tenantId, async (client) => {
    const existing = await client.query<RawActivationRow>(
      `SELECT is_active, activated_at, deactivated_at FROM connector_activations
       WHERE tenant_id = $1 AND platform_id = $2`,
      [tenantId, platformId]
    );
    if (existing.rows.length > 0 && existing.rows[0].is_active === isActive) {
      return toActivationRow(existing.rows[0]);
    }
    if (existing.rows.length === 0) {
      const { rows } = await client.query<RawActivationRow>(
        `INSERT INTO connector_activations
           (tenant_id, platform_id, is_active, activated_at, deactivated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING is_active, activated_at, deactivated_at`,
        [tenantId, platformId, isActive, isActive ? new Date() : null, isActive ? null : new Date(), updatedBy ?? null]
      );
      return toActivationRow(rows[0]);
    }
    const { rows } = await client.query<RawActivationRow>(
      `UPDATE connector_activations
       SET is_active = $3,
           activated_at = CASE WHEN $3 THEN now() ELSE activated_at END,
           deactivated_at = CASE WHEN $3 THEN deactivated_at ELSE now() END,
           updated_by = $4
       WHERE tenant_id = $1 AND platform_id = $2
       RETURNING is_active, activated_at, deactivated_at`,
      [tenantId, platformId, isActive, updatedBy ?? null]
    );
    return toActivationRow(rows[0]);
  });
}
