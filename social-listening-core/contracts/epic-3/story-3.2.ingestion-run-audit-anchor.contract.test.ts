// Contract: Story 3.2 (ADR-0005) — IngestionRun as the immutable acquisition/audit
// anchor for every SocialPost.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-32--ingestionrun-as-the-audit-anchor-for-every-post
//
// Intent: Story 3.2 — IngestionRun as the audit anchor for every post (ADR-0005)
// Scope: migrations/0005_create_ingestion_runs.sql, src/ingestion/ingestionRunStore.ts,
// src/posts/socialPostStore.ts
// Contract to encode: (1) every SocialPost inserted via the sanctioned
// insertSocialPost() helper has a non-null acquisitionId referencing a real
// IngestionRun — enforced by that helper's required TypeScript parameter, not a DB
// NOT NULL constraint (see Story 3.1's migration note on why the column itself
// stays nullable); (2) IngestionRun records triggerType, connectorVersion,
// startedAt/completedAt, status, postsIngested, postsSkipped, and errorSummary; (3)
// given a SocialPost ID, its originating run's connectorVersion and triggerType are
// retrievable in a single JOIN query.
// Explicitly out of scope: the real connector/pipeline code that actually calls
// startIngestionRun()/completeIngestionRun() during a real poll (Phase 1's "also
// build, not storied" connector work); ConnectorHealth derivation from IngestionRun
// history (Story 4.3); retryable classification (Story 2.3, ADR-0010).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost, getIngestionRunForPost } from '../../src/posts/socialPostStore';

afterAll(async () => {
  await closePool();
});

describe('Story 3.2 — IngestionRun audit-anchor contract', () => {
  it('AC1: a SocialPost inserted via insertSocialPost() has a non-null acquisitionId referencing a real IngestionRun', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });

    const post = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { text: 'hello' },
    });

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        'SELECT acquisition_id FROM social_posts WHERE id = $1',
        [post.id]
      );
      return rows[0];
    });

    expect(row.acquisition_id).toBe(run.id);
  });

  it('AC2: IngestionRun records triggerType, connectorVersion, timestamps, status, counts, and errorSummary', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.2.3',
    });

    await completeIngestionRun(tenantId, run.id, {
      status: 'failed',
      postsIngested: 3,
      postsSkipped: 1,
      errorSummary: 'rate limited',
    });

    const row = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query('SELECT * FROM ingestion_runs WHERE id = $1', [run.id]);
      return rows[0];
    });

    expect(row.trigger_type).toBe('poll');
    expect(row.connector_version).toBe('1.2.3');
    expect(row.started_at).toBeTruthy();
    expect(row.completed_at).toBeTruthy();
    expect(row.status).toBe('failed');
    expect(row.posts_ingested).toBe(3);
    expect(row.posts_skipped).toBe(1);
    expect(row.error_summary).toBe('rate limited');
  });

  it('AC3: a SocialPost ID resolves its originating run\'s connectorVersion and triggerType in a single query', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'webhook',
      connectorVersion: '2.0.0',
    });
    const post = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { text: 'hi' },
    });

    const lineage = await getIngestionRunForPost(tenantId, post.id);

    expect(lineage).toEqual({ connectorVersion: '2.0.0', triggerType: 'webhook' });
  });
});
