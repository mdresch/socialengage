// Contract: Story 4.2 (ADR-0008) — SocialPost captures enrichment.entities,
// enrichment.keyPhrases, and publishedAt; no TopicDailyCount aggregation or
// charting is built in this subsystem.
// See docs/user-stories/epic-4-derived-data-analytics-and-health.md#story-42--deferred-topic-time-series-aggregation
//
// Intent: Story 4.2 — Deferred topic time-series aggregation (ADR-0008)
// Scope: migrations/0010_add_social_posts_enrichment_fields.sql,
// src/posts/socialPostStore.ts (insertSocialPost gains publishedAt/enrichment;
// listSocialPosts/SocialPostSummary return them)
// Contract to encode: (1) a SocialPost inserted with publishedAt and
// enrichment.entities/keyPhrases has both populated and queryable — both via
// a direct SQL read and via listSocialPosts()'s existing read path (ADR-0008's
// own Negative consequences assumes a consumer can already aggregate
// GET /posts results client-side, which requires these fields to round-trip
// through the existing read path, not just exist in the database); (2) no
// topic_daily_count (or similarly named) table/view exists, and no
// charting-style route is mounted in the v1 router; (3) a raw SQL query
// against social_posts, grouping by published_at's day and each
// enrichment.entities value, reconstructs the exact per-day-per-topic counts
// a TopicDailyCount table would have contained — proving the data captured
// here is sufficient, not proving this subsystem computes or stores that
// aggregation itself (which ADR-0008 explicitly rules out).
// Explicitly out of scope: building any aggregation table, materialized view,
// or endpoint that computes topic-volume-over-time (that's exactly what
// ADR-0008 defers to a future subsystem — AC3's query lives only in this test,
// not in shipped application code); the real enrichment pipeline that
// populates these fields from an actual AI provider's output (Phase 2's
// "also build, not storied" scope, not this story's — this story proves the
// schema/read-path are correct given data that exists, the same pattern
// Story 4.1 used for AuthorTopicSignal); sentiment/detectedLanguage/modelUsed
// (named in docs/implementation-plan.md's Phase 2 deliverable but not this
// story's own Acceptance Criteria — they're additive keys the same
// `enrichment` JSONB column can hold later, not added here).

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost, listSocialPosts } from '../../src/posts/socialPostStore';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

describe('Story 4.2 — deferred topic time-series aggregation contract', () => {
  it('AC1: a SocialPost carries publishedAt and enrichment.entities/keyPhrases, queryable directly and via listSocialPosts()', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    const publishedAt = new Date('2026-01-15T12:00:00Z');
    const { id } = await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { text: 'acme is great' },
      publishedAt,
      enrichment: { entities: ['acme'], keyPhrases: ['acme is great'] },
    });

    const { rows } = await withTenant(tenantId, (client) =>
      client.query<{
        published_at: Date;
        enrichment: { entities: string[]; keyPhrases: string[] };
      }>(`SELECT published_at, enrichment FROM social_posts WHERE id = $1`, [id])
    );
    expect(rows[0].published_at.toISOString()).toBe(publishedAt.toISOString());
    expect(rows[0].enrichment.entities).toEqual(['acme']);
    expect(rows[0].enrichment.keyPhrases).toEqual(['acme is great']);

    const page = await listSocialPosts(tenantId, { limit: 10 });
    const post = page.posts.find((p) => p.id === id);
    expect(post?.publishedAt).toBe(publishedAt.toISOString());
    expect(post?.enrichment).toEqual({ entities: ['acme'], keyPhrases: ['acme is great'] });
  });

  it('AC2: no topic_daily_count (or similarly named) table/view exists, and no charting route is mounted', async () => {
    const { rows } = await getPool().query(
      `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%topic_daily_count%' OR table_name ILIKE '%topic%count%'`
    );
    expect(rows).toHaveLength(0);

    const routerSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'http', 'versions', 'v1', 'router.ts'),
      'utf8'
    );
    expect(routerSource).not.toMatch(/chart|topic-?daily|dailyCount/i);
  });

  it('AC3: grouping raw SocialPost rows by day and topic reconstructs exact per-day-per-topic counts', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });

    const fixtures: Array<{ publishedAt: string; entities: string[] }> = [
      { publishedAt: '2026-02-01T09:00:00Z', entities: ['acme'] },
      { publishedAt: '2026-02-01T15:00:00Z', entities: ['acme'] },
      { publishedAt: '2026-02-01T18:00:00Z', entities: ['widgets'] },
      { publishedAt: '2026-02-02T10:00:00Z', entities: ['acme'] },
    ];
    for (const fixture of fixtures) {
      await insertSocialPost({
        tenantId,
        authorId: null,
        acquisitionId: run.id,
        rawPayload: {},
        publishedAt: new Date(fixture.publishedAt),
        enrichment: { entities: fixture.entities, keyPhrases: [] },
      });
    }

    const { rows } = await withTenant(tenantId, (client) =>
      // to_char(..., 'YYYY-MM-DD'), not ::date: node-pg parses the SQL `date`
      // type as local midnight, not UTC midnight, so casting to ::date and
      // reading it back as a JS Date shifts by the test machine's UTC offset —
      // a driver quirk, not anything about this story's own data. A TEXT day
      // string sidesteps that entirely.
      client.query<{ day: string; topic: string; post_count: string }>(
        `SELECT to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, entity AS topic, COUNT(*) AS post_count
         FROM social_posts, jsonb_array_elements_text(enrichment -> 'entities') AS entity
         WHERE tenant_id = $1
         GROUP BY day, entity
         ORDER BY day, entity`,
        [tenantId]
      )
    );

    expect(
      rows.map((r) => ({
        day: r.day,
        topic: r.topic,
        count: Number(r.post_count),
      }))
    ).toEqual([
      { day: '2026-02-01', topic: 'acme', count: 2 },
      { day: '2026-02-01', topic: 'widgets', count: 1 },
      { day: '2026-02-02', topic: 'acme', count: 1 },
    ]);
  });
});
