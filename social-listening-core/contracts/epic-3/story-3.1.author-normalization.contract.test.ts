// Contract: Story 3.1 (ADR-0004) — Author normalized once per (tenant, platform,
// externalAuthorId), upserted as new posts arrive.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-31--normalized-author-entity
//
// Intent: Story 3.1 — Normalized author entity (ADR-0004)
// Scope: migrations/0004_create_authors.sql, src/authors/authorStore.ts
// Contract to encode: (1) ingesting two posts from the same external author within
// a tenant results in exactly one Author row, with lastSeenAt updated on the second
// ingest; (2) social_posts has no embedded author display fields, only author_id;
// (3) postGeoLocation lives on SocialPost (per-event), profileLocation lives on
// Author (per-account) — verified by schema inspection.
// Explicitly out of scope: the real ingestion pipeline that calls upsertAuthor()
// during actual post ingestion (Phase 1's "also build, not storied" connector
// work); AuthorTopicSignal (Story 4.1, builds on Author later); expert-finder query
// (GET /topics/:topic/authors, not this story's scope).

import { randomUUID } from 'crypto';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { upsertAuthor } from '../../src/authors/authorStore';

afterAll(async () => {
  await closePool();
});

describe('Story 3.1 — Author normalization contract', () => {
  it('AC1: ingesting two posts from the same external author yields exactly one Author row, lastSeenAt updated', async () => {
    const tenantId = randomUUID();
    const platformId = 'example-poll';
    const externalAuthorId = 'ext-author-1';

    const first = await upsertAuthor(tenantId, platformId, externalAuthorId, {
      handle: '@example',
      displayName: 'Example Author',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await upsertAuthor(tenantId, platformId, externalAuthorId, {
      handle: '@example',
      displayName: 'Example Author',
    });

    expect(second.id).toBe(first.id);

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        'SELECT id, first_seen_at, last_seen_at FROM authors WHERE tenant_id = $1 AND platform_id = $2 AND external_author_id = $3',
        [tenantId, platformId, externalAuthorId]
      );
      return rows;
    });

    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].last_seen_at).getTime()).toBeGreaterThan(
      new Date(rows[0].first_seen_at).getTime()
    );
  });

  it('AC2: social_posts has no embedded author display fields, only author_id', async () => {
    const { rows } = await getPool().query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'social_posts'`
    );
    const columnNames = rows.map((r: { column_name: string }) => r.column_name);

    expect(columnNames).toContain('author_id');
    for (const forbidden of ['handle', 'display_name', 'follower_count', 'author_handle']) {
      expect(columnNames).not.toContain(forbidden);
    }
  });

  it('AC3: postGeoLocation lives on social_posts (per-event), profileLocation lives on authors (per-account)', async () => {
    const pool = getPool();
    const [postCols, authorCols] = await Promise.all([
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'social_posts'`),
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'authors'`),
    ]);

    expect(postCols.rows.map((r: { column_name: string }) => r.column_name)).toContain(
      'post_geo_location'
    );
    expect(authorCols.rows.map((r: { column_name: string }) => r.column_name)).toContain(
      'profile_location'
    );
    expect(authorCols.rows.map((r: { column_name: string }) => r.column_name)).not.toContain(
      'post_geo_location'
    );
  });
});
