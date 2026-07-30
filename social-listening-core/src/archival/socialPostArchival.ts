import { getAdminPool } from '../db/adminPool';
import { uploadArchiveBlob } from './blobArchiveClient';
import { rawPayloadRetentionDays } from './retentionConfig';

const PARTITION_NAME_PATTERN = /^social_posts_y(\d{4})m(\d{2})$/;

interface EligiblePartition {
  name: string;
  monthStart: string;
  monthEnd: string;
}

async function findEligiblePartitions(cutoff: Date): Promise<EligiblePartition[]> {
  const { rows } = await getAdminPool().query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'social_posts_y%'`
  );
  const eligible: EligiblePartition[] = [];
  for (const { table_name } of rows) {
    const match = table_name.match(PARTITION_NAME_PATTERN);
    if (!match) continue; // never matches "social_posts_default" — that partition is never archival-eligible
    const [, year, month] = match;
    const monthStartDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const monthEndDate = new Date(Date.UTC(Number(year), Number(month), 1));
    if (monthEndDate <= cutoff) {
      eligible.push({
        name: table_name,
        monthStart: monthStartDate.toISOString().slice(0, 10),
        monthEnd: monthEndDate.toISOString().slice(0, 10),
      });
    }
  }
  return eligible;
}

export interface SocialPostArchivalResult {
  partitionsProcessed: string[];
  rowsArchived: number;
}

/**
 * Detaches each fully-aged-out monthly social_posts partition, replaces
 * every not-yet-archived row's rawPayload with a blob-storage pointer (the
 * row itself stays — only the bulky, rarely-re-read field is tiered out,
 * per ADR-0018's field-level tiering decision), then reattaches the
 * partition. Operating on the detached partition (not a live UPDATE across
 * the whole table) is what "detach and export the oldest partition, not a
 * row-by-row delete/update sweep" (Story 3.5 AC4) actually means. See
 * .claude/skills/data-retention-and-archival/SKILL.md.
 */
export async function archiveAgedRawPayloads(): Promise<SocialPostArchivalResult> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - rawPayloadRetentionDays());

  const partitions = await findEligiblePartitions(cutoff);
  const partitionsProcessed: string[] = [];
  let rowsArchived = 0;

  for (const partition of partitions) {
    await getAdminPool().query(`ALTER TABLE social_posts DETACH PARTITION ${partition.name}`);

    const { rows } = await getAdminPool().query<{ id: string; raw_payload: unknown }>(
      `SELECT id, raw_payload FROM ${partition.name} WHERE raw_payload ->> 'archived' IS DISTINCT FROM 'true'`
    );
    for (const row of rows) {
      const blobPath = `social-posts/${row.id}.json`;
      await uploadArchiveBlob(blobPath, JSON.stringify(row.raw_payload));
      await getAdminPool().query(
        `UPDATE ${partition.name} SET raw_payload = jsonb_build_object('archived', true, 'blobPath', $2::text) WHERE id = $1`,
        [row.id, blobPath]
      );
      rowsArchived += 1;
    }

    await getAdminPool().query(
      `ALTER TABLE social_posts ATTACH PARTITION ${partition.name} FOR VALUES FROM ('${partition.monthStart}') TO ('${partition.monthEnd}')`
    );
    partitionsProcessed.push(partition.name);
  }

  return { partitionsProcessed, rowsArchived };
}
