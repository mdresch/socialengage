import { Pool, PoolClient } from 'pg';
import { getPlatformAdminPool } from '../db/platformAdminPool';
import { encodeAuditLogCursor, decodeAuditLogCursor } from './auditLogCursor';

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

/**
 * `pool` defaults to `getPlatformAdminPool()` — every pre-Story-5.15 caller
 * is unaffected. Story 5.15 (ADR-0037 §2) was the first caller to pass
 * `getTenantSignupPool()` explicitly: that write must run under
 * `tenant_signup_role`'s own connection (which has its own, separate
 * `INSERT` grant on this table), not `platform_admin_role`'s — the two
 * roles' blast radii must stay independent even though they share this one
 * audit table. Story 3.8 (ADR-0043 §7) is the first caller to pass a
 * `PoolClient` (from `withTenant()`) rather than a `Pool` — the same
 * reasoning, one level narrower: that write must run under `app_user`'s own
 * RLS-scoped connection so it can never be confused with either role's own
 * bypass.
 */
import { randomUUID } from 'crypto';
import { computeRecordHash, GENESIS_HASH } from '../compliance/auditHashChaining';

export async function logPlatformAdminAction(
  entry: PlatformAdminAuditEntry,
  pool: Pool | PoolClient = getPlatformAdminPool()
): Promise<void> {
  const lastRow = await pool.query<{ record_hash: string }>(
    `SELECT record_hash FROM platform_admin_audit_log
     WHERE (target_tenant_id = $1 OR ($1 IS NULL AND target_tenant_id IS NULL))
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [entry.targetTenantId ?? null]
  );
  const previousRecordHash = lastRow.rows[0]?.record_hash || GENESIS_HASH;
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const recordHash = computeRecordHash({
    id,
    tenantId: entry.targetTenantId ?? null,
    actorId: entry.actorIdentity,
    action: entry.operation,
    timestamp,
    payload: entry.detail ?? null,
    previousRecordHash,
  });

  await pool.query(
    `INSERT INTO platform_admin_audit_log (id, actor_identity, operation, target_tenant_id, detail, previous_record_hash, record_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      entry.actorIdentity,
      entry.operation,
      entry.targetTenantId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
      previousRecordHash,
      recordHash,
      timestamp,
    ]
  );
}

/** REST shape for a queried audit-log entry — camelCase fields, ISO 8601 timestamp. */
export interface PlatformAdminAuditLogEntry {
  id: string;
  actorIdentity: string;
  operation: string;
  targetTenantId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogQueryFilters {
  tenantId?: string;
  actorIdentity?: string;
  operation?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface AuditLogPage {
  entries: PlatformAdminAuditLogEntry[];
  nextCursor: string | null;
}

interface AuditLogRow {
  id: string;
  actor_identity: string;
  operation: string;
  target_tenant_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: Date;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function mapRowToEntry(row: AuditLogRow): PlatformAdminAuditLogEntry {
  return {
    id: row.id,
    actorIdentity: row.actor_identity,
    operation: row.operation,
    targetTenantId: row.target_tenant_id,
    detail: row.detail,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Story 5.14 (ADR-0030 §5): a read-only, cursor-paginated (ADR-0011
 * convention) query over the audit log logPlatformAdminAction() above
 * already writes. Keyset pagination orders by (created_at, id) DESC —
 * created_at alone isn't guaranteed unique across rows, so id breaks ties
 * deterministically, the same tuple-ordering idea posts/cursor.ts uses a
 * single monotonic seq for (this table has no such column). See
 * .claude/skills/platform-admin-audit-log/SKILL.md.
 */
export async function queryPlatformAdminAuditLog(filters: AuditLogQueryFilters = {}): Promise<AuditLogPage> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.tenantId) {
    params.push(filters.tenantId);
    conditions.push(`target_tenant_id = $${params.length}`);
  }
  if (filters.actorIdentity) {
    params.push(filters.actorIdentity);
    conditions.push(`actor_identity = $${params.length}`);
  }
  if (filters.operation) {
    params.push(filters.operation);
    conditions.push(`operation = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`created_at <= $${params.length}`);
  }
  if (filters.cursor) {
    const { createdAt, id } = decodeAuditLogCursor(filters.cursor);
    const createdAtParam = params.length + 1;
    const idParam = params.length + 2;
    params.push(createdAt, id);
    conditions.push(`(created_at < $${createdAtParam} OR (created_at = $${createdAtParam} AND id < $${idParam}))`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit + 1);

  const { rows } = await getPlatformAdminPool().query<AuditLogRow>(
    `SELECT id, actor_identity, operation, target_tenant_id, detail, created_at
     FROM platform_admin_audit_log
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length}`,
    params
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    entries: page.map(mapRowToEntry),
    nextCursor:
      hasMore && last ? encodeAuditLogCursor({ createdAt: last.created_at.toISOString(), id: last.id }) : null,
  };
}
