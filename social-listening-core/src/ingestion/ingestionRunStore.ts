import { withTenant } from '../db/withTenant';

export type TriggerType = 'poll' | 'webhook';
export type IngestionRunStatus = 'running' | 'succeeded' | 'failed';

export interface StartIngestionRunInput {
  platformId: string;
  triggerType: TriggerType;
  connectorVersion: string;
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
      `INSERT INTO ingestion_runs (tenant_id, platform_id, trigger_type, connector_version)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, input.platformId, input.triggerType, input.connectorVersion]
    );
    return { id: rows[0].id };
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
