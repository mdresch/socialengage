import { getAdminPool } from '../db/adminPool';
import { withTenant } from '../db/withTenant';
import { uploadArchiveBlob, downloadArchiveBlob } from './blobArchiveClient';
import { ingestionRunRetentionMonths } from './retentionConfig';

const PARTITION_NAME_PATTERN = /^ingestion_runs_y(\d{4})m(\d{2})$/;

interface EligiblePartition {
  name: string;
}

async function findEligiblePartitions(cutoff: Date): Promise<EligiblePartition[]> {
  const { rows } = await getAdminPool().query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'ingestion_runs_y%'`
  );
  const eligible: EligiblePartition[] = [];
  for (const { table_name } of rows) {
    const match = table_name.match(PARTITION_NAME_PATTERN);
    if (!match) continue; // never matches "ingestion_runs_default" — that partition is never archival-eligible
    const [, year, month] = match;
    const monthEnd = new Date(Date.UTC(Number(year), Number(month), 1));
    if (monthEnd <= cutoff) {
      eligible.push({ name: table_name });
    }
  }
  return eligible;
}

export interface IngestionRunArchivalResult {
  partitionsProcessed: string[];
  rowsArchived: number;
}

/**
 * Detaches each fully-aged-out monthly ingestion_runs partition, exports
 * every row's full JSON to blob storage, then drops the partition — the
 * whole row genuinely leaves Postgres (Story 3.5, ADR-0018's "move to the
 * archival tier"), per the accepted design: unlike SocialPost's rawPayload
 * tiering, ingestion_runs has no bulky field to strip in place, and leaving
 * every row in Postgres forever wouldn't bound the table growth this ADR
 * exists to address. resolveIngestionRun() is the read-side fallback that
 * makes an archived run still resolvable — never a bare DELETE, which
 * would either violate the FK from social_posts or require an unacceptable
 * cascade (ADR-0018's own Decision text). See
 * .claude/skills/data-retention-and-archival/SKILL.md.
 */
export async function archiveAgedIngestionRuns(): Promise<IngestionRunArchivalResult> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ingestionRunRetentionMonths());

  const partitions = await findEligiblePartitions(cutoff);
  const partitionsProcessed: string[] = [];
  let rowsArchived = 0;

  for (const partition of partitions) {
    await getAdminPool().query(`ALTER TABLE ingestion_runs DETACH PARTITION ${partition.name}`);

    const { rows } = await getAdminPool().query(`SELECT * FROM ${partition.name}`);
    for (const row of rows) {
      await uploadArchiveBlob(`ingestion-runs/${row.id}.json`, JSON.stringify(row));
      rowsArchived += 1;
    }

    await getAdminPool().query(`DROP TABLE ${partition.name}`);
    partitionsProcessed.push(partition.name);
  }

  return { partitionsProcessed, rowsArchived };
}

export interface ResolvedIngestionRun {
  id: string;
  tenantId: string;
  platformId: string;
  triggerType: string;
  connectorVersion: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  postsIngested: number;
  postsSkipped: number;
  errorSummary: string | null;
  archived: boolean;
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 404
  );
}

/**
 * Resolves an IngestionRun by id: live table first, falling back to the
 * blob archive if it's aged out. This is what "SocialPost.acquisitionId
 * continues to resolve" (Story 3.5 AC2) actually means once a run has left
 * Postgres — never a live JOIN alone.
 */
export async function resolveIngestionRun(
  tenantId: string,
  runId: string
): Promise<ResolvedIngestionRun | null> {
  const live = await withTenant(tenantId, (client) =>
    client.query<{
      id: string;
      tenant_id: string;
      platform_id: string;
      trigger_type: string;
      connector_version: string;
      status: string;
      started_at: Date;
      completed_at: Date | null;
      posts_ingested: number;
      posts_skipped: number;
      error_summary: string | null;
    }>(
      `SELECT id, tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary
       FROM ingestion_runs WHERE id = $1`,
      [runId]
    )
  );
  if (live.rows.length > 0) {
    const row = live.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      platformId: row.platform_id,
      triggerType: row.trigger_type,
      connectorVersion: row.connector_version,
      status: row.status,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
      postsIngested: row.posts_ingested,
      postsSkipped: row.posts_skipped,
      errorSummary: row.error_summary,
      archived: false,
    };
  }

  try {
    const content = await downloadArchiveBlob(`ingestion-runs/${runId}.json`);
    const archived = JSON.parse(content) as {
      id: string;
      tenant_id: string;
      platform_id: string;
      trigger_type: string;
      connector_version: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      posts_ingested: number;
      posts_skipped: number;
      error_summary: string | null;
    };
    if (archived.tenant_id !== tenantId) return null; // never resolve another tenant's archived run
    return {
      id: archived.id,
      tenantId: archived.tenant_id,
      platformId: archived.platform_id,
      triggerType: archived.trigger_type,
      connectorVersion: archived.connector_version,
      status: archived.status,
      startedAt: archived.started_at,
      completedAt: archived.completed_at,
      postsIngested: archived.posts_ingested,
      postsSkipped: archived.posts_skipped,
      errorSummary: archived.error_summary,
      archived: true,
    };
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}
