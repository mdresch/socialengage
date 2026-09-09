import { Pool } from 'pg';
import { withTenant } from '../db/withTenant';
import { getAdminPool } from '../db/adminPool';

/**
 * ADR-0109 (Story 13.1) — `health_check` is the trigger type used by the
 * manual re-enable flow (`POST /v1/connectors/:platformId/enable`). It is a
 * reset marker: `deriveConnectorHealth()` treats the most recent
 * `health_check` run as the start of a new consecutive-failure/success
 * streak, so a failed re-enable attempt resets the counter to 1 and a
 * successful re-enable attempt can immediately restore `healthy`.
 */
export type TriggerType = 'poll' | 'webhook' | 'health_check';
export type IngestionRunStatus = 'running' | 'succeeded' | 'failed';

export interface ReconciledStaleRun {
  id: string;
  tenantId: string;
  platformId: string;
  userId?: string;
  startedAt: string;
}

export const DEFAULT_MAX_RUN_DURATION_MS = 15 * 60 * 1000;

export interface StartIngestionRunInput {
  platformId: string;
  triggerType: TriggerType;
  connectorVersion: string;
  /** Story 1.15 (ADR-0061 Decision §2) — set for a Tier-3 (user-bound) poll's own run; omitted/undefined for a tenant-wide run. */
  userId?: string;
  /** Story 6.27 (ADR-0060 Decision §3) — set for Facebook's own per-Page poll fan-out; NULL for every other connector and every pre-existing Facebook row. */
  pageId?: string;
}

export interface CompleteIngestionRunInput {
  status: IngestionRunStatus;
  postsIngested: number;
  postsSkipped: number;
  errorSummary?: string;
  /** The last error's retryable classification (ADR-0005); null when no error occurred. */
  retryable?: boolean;
  /**
   * Story 2.15 (ADR-0059 Decision §4) — whether the last error was
   * credential-class (isCredentialError(), http_401/http_403); null when
   * no error occurred. Mirrors `retryable`'s own shape exactly. Read by
   * deriveConnectorHealth() to surface the 'reconnect_required' status.
   */
  isCredentialFailure?: boolean;
}

export interface IngestionRunRef {
  id: string;
}

/** Opens an IngestionRun — see .claude/skills/social-post-lineage/SKILL.md. */
export async function startIngestionRun(
  tenantId: string,
  input: StartIngestionRunInput
): Promise<IngestionRunRef> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs (tenant_id, platform_id, trigger_type, connector_version, user_id, page_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, input.platformId, input.triggerType, input.connectorVersion, input.userId ?? null, input.pageId ?? null]
    );
    return { id: rows[0].id };
  });
}

/**
 * Story 1.14 (ADR-0052 Decision §5b) — the status of a (tenantId,
 * platformId) pair's single most recent ingestion_runs row, or null if none
 * exists. Lets the poll scheduler tell "cadence has elapsed" apart from
 * "and the prior run has actually finished" — see
 * .claude/skills/live-ingestion-polling-scheduler/SKILL.md.
 */
export async function getMostRecentRunStatus(
  tenantId: string,
  platformId: string
): Promise<IngestionRunStatus | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ status: IngestionRunStatus }>(
      `SELECT status FROM ingestion_runs WHERE platform_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [platformId]
    );
    return rows.length > 0 ? rows[0].status : null;
  });
}

/**
 * Story 1.15 (ADR-0061 Decision §2) — the status of a specific user's own
 * single most recent ingestion_runs row for a (tenantId, platformId) pair,
 * or null if none exists. Mirrors getMostRecentRunStatus()'s own shape,
 * scoped to one user's own runs so the Tier-3 scheduler's in-flight guard
 * never blends one user's still-running poll with another's.
 */
export async function getMostRecentRunStatusForUser(
  tenantId: string,
  platformId: string,
  userId: string
): Promise<IngestionRunStatus | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ status: IngestionRunStatus }>(
      `SELECT status FROM ingestion_runs WHERE platform_id = $1 AND user_id = $2 ORDER BY started_at DESC LIMIT 1`,
      [platformId, userId]
    );
    return rows.length > 0 ? rows[0].status : null;
  });
}

/** Closes an IngestionRun opened by startIngestionRun(). */
export async function completeIngestionRun(
  tenantId: string,
  runId: string,
  input: CompleteIngestionRunInput
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `UPDATE ingestion_runs
       SET completed_at = now(), status = $2, posts_ingested = $3, posts_skipped = $4, error_summary = $5, retryable = $6, is_credential_failure = $7
       WHERE id = $1`,
      [
        runId,
        input.status,
        input.postsIngested,
        input.postsSkipped,
        input.errorSummary ?? null,
        input.retryable ?? null,
        input.isCredentialFailure ?? null,
      ]
    );
  });
}

/**
 * Story 13.1 (ADR-0109) — changes the trigger type of an already-closed run.
 * Used by the health-check fallback path: when a connector has no dedicated
 * `healthCheck()` method, the re-enable endpoint calls `connector.poll()` /
 * `connector.pollUser()` (which opens a `poll` run) and then rewrites that
 * run's `trigger_type` to `health_check` so `deriveConnectorHealth()` applies
 * the reset boundary.
 */
export async function updateIngestionRunTriggerType(
  tenantId: string,
  runId: string,
  triggerType: TriggerType
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `UPDATE ingestion_runs SET trigger_type = $2 WHERE id = $1`,
      [runId, triggerType]
    );
  });
}

/**
 * Story 1.16 (ADR-0070 §1) — Lock-safe watchdog reconciliation of orphaned
 * or hung `running` ingestion runs. Sweeps `ingestion_runs` using
 * `FOR UPDATE SKIP LOCKED` and transitions stale rows older than
 * `maxDurationMs` to `status = 'failed'`, `retryable = true`, unblocking
 * the Story 1.14/1.15 in-flight guards.
 */
export async function reconcileStaleIngestionRuns(
  maxDurationMs: number = DEFAULT_MAX_RUN_DURATION_MS,
  pool: Pool = getAdminPool()
): Promise<ReconciledStaleRun[]> {
  const client = await pool.connect();
  try {
    const cutoffDate = new Date(Date.now() - maxDurationMs);
    const { rows } = await client.query<{
      id: string;
      tenant_id: string;
      platform_id: string;
      user_id: string | null;
      started_at: Date;
    }>(
      `UPDATE ingestion_runs
       SET status = 'failed',
           completed_at = now(),
           error_summary = 'Ingestion run timed out or aborted (reconciled by watchdog)',
           retryable = true
       WHERE id IN (
         SELECT id FROM ingestion_runs
         WHERE status = 'running'
           AND started_at < $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id, platform_id, user_id, started_at`,
      [cutoffDate]
    );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      platformId: r.platform_id,
      userId: r.user_id ?? undefined,
      startedAt: r.started_at.toISOString(),
    }));
  } finally {
    client.release();
  }
}
