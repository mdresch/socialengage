// Contract: Story 3.5 (ADR-0018) — tiered data retention and archival.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-35--tiered-data-retention-and-archival
//
// Intent: Story 3.5 — Tiered data retention and archival (ADR-0018)
// Scope: migrations/0011_partition_ingestion_runs.sql,
// migrations/0012_partition_social_posts.sql, src/archival/retentionConfig.ts,
// src/archival/blobArchiveClient.ts, src/archival/socialPostArchival.ts,
// src/archival/ingestionRunArchival.ts, src/posts/socialPostStore.ts
// (insertSocialPost resolves acquisition_started_at for the new composite FK)
// Contract to encode: (1) a SocialPost older than the configured rawPayload
// retention window has rawPayload replaced by a blob-storage pointer after
// archiveAgedRawPayloads() runs, while tenantId/authorId/publishedAt/
// enrichment remain unchanged and live-queryable; (2) an IngestionRun older
// than the configured retention window is genuinely removed from the live
// table after archiveAgedIngestionRuns() runs (not hard-deleted via a bare
// DELETE — exported to blob first), and resolveIngestionRun() still resolves
// it afterward via the blob fallback — proving social_posts.acquisitionId
// "continues to resolve" per this story's own AC2 wording; (3) both
// retention windows are read from environment configuration, defaulting to
// 90 days / 18 months, not hardcoded; (4) both tables are genuinely
// partitioned (verified via pg_partitioned_table), and the archival
// functions structurally use DETACH/ATTACH PARTITION (social_posts) and
// DETACH PARTITION + DROP TABLE (ingestion_runs) rather than a bare
// UPDATE/DELETE sweep across the live table; (5) the exact rawPayload
// content is recoverable byte-for-byte via the archived pointer's blob path,
// confirming §4.2's "never discarded" guarantee survives archival.
// Explicitly out of scope: scheduling/automating when archival actually
// runs (no pg_cron or job scheduler wiring — these functions are proven
// correct when invoked, not wired to a schedule, matching every other
// "prove the mechanism, not the whole pipeline" story this session);
// tenant offboarding/right-to-erasure (explicitly out of ADR-0018's own
// scope); partition-maintenance automation for *creating* new future
// partitions on an ongoing basis (a maintenance function is provided —
// ensure_ingestion_runs_partition()/ensure_social_posts_partition() — but
// nothing schedules it periodically).
//
// 2026-07-30 (dated note, ADR-0018 Amendment Log): social_posts is
// partitioned by created_at, not published_at as ADR-0018's implementation
// default literally names. published_at is nullable (Story 4.2 — only
// enriched posts have it), and Postgres requires a partitioned table's
// partition key to be NOT NULL (it must be part of the primary key). Given
// retention is conceptually about hot-storage age since *ingestion*, not
// the source platform's original publish date, created_at (always
// NOT NULL DEFAULT now()) is both the technically necessary and the more
// conceptually correct choice. Logged here per the Amendment Log's own
// convention for implementation-default changes — not a decision this file
// makes on its own; see the ADR's own dated entry.

import { randomUUID } from 'crypto';
import { getPool, closePool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import fs from 'fs';
import path from 'path';
import {
  rawPayloadRetentionDays,
  ingestionRunRetentionMonths,
} from '../../src/archival/retentionConfig';
import { downloadArchiveBlob, __deleteArchiveBlobForTests } from '../../src/archival/blobArchiveClient';
import { archiveAgedRawPayloads } from '../../src/archival/socialPostArchival';
import { archiveAgedIngestionRuns, resolveIngestionRun } from '../../src/archival/ingestionRunArchival';

jest.setTimeout(120000);

// This story's contract is the only one that writes to the real archive
// container (Key Vault's/Service Bus's contracts delete their own test
// fixtures too) — tracked here and cleaned up so runs don't accumulate
// leftover blobs.
const blobPathsToClean: string[] = [];

afterAll(async () => {
  for (const blobPath of blobPathsToClean) {
    await __deleteArchiveBlobForTests(blobPath).catch(() => undefined);
  }
  await closePool();
  await closeAdminPool();
});

async function insertAgedPost(
  tenantId: string,
  acquisitionId: string,
  ageInDays: number,
  rawPayload: unknown,
  extra: { publishedAt?: string; enrichment?: unknown } = {}
): Promise<string> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO social_posts (tenant_id, raw_payload, acquisition_id, acquisition_started_at, created_at, published_at, enrichment)
       VALUES ($1, $2, $3, (SELECT started_at FROM ingestion_runs WHERE id = $3), now() - ($4 || ' days')::interval, $5, $6)
       RETURNING id`,
      [
        tenantId,
        JSON.stringify(rawPayload),
        acquisitionId,
        String(ageInDays),
        extra.publishedAt ?? null,
        extra.enrichment ? JSON.stringify(extra.enrichment) : null,
      ]
    );
    return rows[0].id;
  });
}

async function insertAgedIngestionRun(tenantId: string, ageInMonths: number): Promise<string> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO ingestion_runs (tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped)
       VALUES ($1, 'example-poll', 'poll', '1.0.0', 'succeeded', now() - ($2 || ' months')::interval, now() - ($2 || ' months')::interval, 1, 0)
       RETURNING id`,
      [tenantId, String(ageInMonths)]
    );
    return rows[0].id;
  });
}

describe('Story 3.5 — tiered data retention and archival contract', () => {
  it('AC3: retention windows default to 90 days / 18 months and read from environment configuration', () => {
    const priorRaw = process.env.RAW_PAYLOAD_RETENTION_DAYS;
    const priorRun = process.env.INGESTION_RUN_RETENTION_MONTHS;
    try {
      delete process.env.RAW_PAYLOAD_RETENTION_DAYS;
      delete process.env.INGESTION_RUN_RETENTION_MONTHS;
      expect(rawPayloadRetentionDays()).toBe(90);
      expect(ingestionRunRetentionMonths()).toBe(18);

      process.env.RAW_PAYLOAD_RETENTION_DAYS = '45';
      process.env.INGESTION_RUN_RETENTION_MONTHS = '6';
      expect(rawPayloadRetentionDays()).toBe(45);
      expect(ingestionRunRetentionMonths()).toBe(6);
    } finally {
      if (priorRaw === undefined) delete process.env.RAW_PAYLOAD_RETENTION_DAYS;
      else process.env.RAW_PAYLOAD_RETENTION_DAYS = priorRaw;
      if (priorRun === undefined) delete process.env.INGESTION_RUN_RETENTION_MONTHS;
      else process.env.INGESTION_RUN_RETENTION_MONTHS = priorRun;
    }
  });

  it('AC4: social_posts and ingestion_runs are genuinely partitioned tables, and archival is implemented via DETACH/ATTACH PARTITION, not a bare UPDATE/DELETE sweep', async () => {
    const { rows } = await getPool().query<{ relname: string }>(
      `SELECT c.relname FROM pg_partitioned_table pt JOIN pg_class c ON c.oid = pt.partrelid
       WHERE c.relname IN ('social_posts', 'ingestion_runs')`
    );
    expect(rows.map((r) => r.relname).sort()).toEqual(['ingestion_runs', 'social_posts']);

    const socialPostArchivalSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'archival', 'socialPostArchival.ts'),
      'utf8'
    );
    expect(socialPostArchivalSource).toMatch(/DETACH PARTITION/i);
    expect(socialPostArchivalSource).toMatch(/ATTACH PARTITION/i);
    expect(socialPostArchivalSource).not.toMatch(/\bUPDATE\s+social_posts\b/i);

    const ingestionRunArchivalSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'archival', 'ingestionRunArchival.ts'),
      'utf8'
    );
    expect(ingestionRunArchivalSource).toMatch(/DETACH PARTITION/i);
    expect(ingestionRunArchivalSource).toMatch(/DROP TABLE/i);
    expect(ingestionRunArchivalSource).not.toMatch(/\bDELETE FROM\s+ingestion_runs\b/i);
  });

  it('AC1 + AC5: a SocialPost older than the retention window has rawPayload replaced by a resolvable blob pointer; other fields are unchanged', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const originalPayload = { text: 'a post from long ago', id: randomUUID() };
    const postId = await insertAgedPost(tenantId, run.id, 100, originalPayload, {
      publishedAt: '2026-01-01T00:00:00Z',
      enrichment: { entities: ['acme'] },
    });

    await archiveAgedRawPayloads();

    const after = await withTenant(tenantId, (client) =>
      client.query<{
        raw_payload: { archived: boolean; blobPath: string };
        tenant_id: string;
        published_at: Date;
        enrichment: { entities: string[] };
      }>(
        `SELECT raw_payload, tenant_id, published_at, enrichment FROM social_posts WHERE id = $1`,
        [postId]
      )
    );
    const row = after.rows[0];
    expect(row.raw_payload.archived).toBe(true);
    expect(typeof row.raw_payload.blobPath).toBe('string');
    blobPathsToClean.push(row.raw_payload.blobPath);
    expect(row.tenant_id).toBe(tenantId);
    expect(row.published_at.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(row.enrichment.entities).toEqual(['acme']);

    // AC5: the original content is recoverable byte-for-byte via the pointer.
    const recovered = JSON.parse(await downloadArchiveBlob(row.raw_payload.blobPath));
    expect(recovered).toEqual(originalPayload);
  });

  it('AC1 (negative): a SocialPost within the retention window is untouched', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const originalPayload = { text: 'a recent post' };
    const postId = await insertAgedPost(tenantId, run.id, 5, originalPayload);

    await archiveAgedRawPayloads();

    const after = await withTenant(tenantId, (client) =>
      client.query<{ raw_payload: unknown }>(`SELECT raw_payload FROM social_posts WHERE id = $1`, [postId])
    );
    expect(after.rows[0].raw_payload).toEqual(originalPayload);
  });

  it('AC2: an IngestionRun older than the retention window is removed from the live table (not via a bare DELETE) and still resolves via the blob fallback', async () => {
    const tenantId = randomUUID();
    const runId = await insertAgedIngestionRun(tenantId, 20);
    await insertAgedPost(tenantId, runId, 5, { text: 'linked to an old run' });

    await archiveAgedIngestionRuns();
    blobPathsToClean.push(`ingestion-runs/${runId}.json`);

    const liveLookup = await withTenant(tenantId, (client) =>
      client.query(`SELECT id FROM ingestion_runs WHERE id = $1`, [runId])
    );
    expect(liveLookup.rows).toHaveLength(0);

    const resolved = await resolveIngestionRun(tenantId, runId);
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(runId);
    expect(resolved?.platformId).toBe('example-poll');
  });

  it('AC2 (negative): an IngestionRun within the retention window stays live and is not archived', async () => {
    const tenantId = randomUUID();
    const runId = await insertAgedIngestionRun(tenantId, 2);

    await archiveAgedIngestionRuns();

    const liveLookup = await withTenant(tenantId, (client) =>
      client.query(`SELECT id FROM ingestion_runs WHERE id = $1`, [runId])
    );
    expect(liveLookup.rows).toHaveLength(1);
  });
});
