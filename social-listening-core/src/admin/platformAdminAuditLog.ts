import { getPlatformAdminPool } from '../db/platformAdminPool';

/**
 * Story 5.7 (ADR-0030 §5): every write performed through `platform_admin_role`
 * must be recorded in a durable, queryable log — actor identity, operation,
 * target tenant, timestamp. This is the single, shared logging call every
 * Platform Admin action (tenant creation/suspension, break-glass resets, and
 * whatever Story 5.8 adds) must go through — never an application log line
 * alone.
 */
export interface PlatformAdminAuditEntry {
  actorIdentity: string;
  operation: string;
  targetTenantId?: string;
  detail?: Record<string, unknown>;
}

export async function logPlatformAdminAction(entry: PlatformAdminAuditEntry): Promise<void> {
  await getPlatformAdminPool().query(
    `INSERT INTO platform_admin_audit_log (actor_identity, operation, target_tenant_id, detail)
     VALUES ($1, $2, $3, $4)`,
    [
      entry.actorIdentity,
      entry.operation,
      entry.targetTenantId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
    ]
  );
}
