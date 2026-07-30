// Contract: Story 4.1 (ADR-0007) — AuthorTopicSignal raw signals + GET /topics/:topic/authors.
// See docs/user-stories/epic-4-derived-data-analytics-and-health.md#story-41--raw-author-topic-signals-for-expert-finding
//
// Intent: Story 4.1 — Raw author-topic signals for expert-finding (ADR-0007)
// Scope: migrations/0009_create_author_topic_signals.sql,
// src/topics/authorTopicSignalStore.ts, src/http/versions/v1/topicsRouter.ts,
// src/http/versions/v1/router.ts
// Contract to encode: (1) author_topic_signals has no expertiseScore (or
// equivalent computed) column — only the raw counts/dates/breakdowns ADR-0007
// names (mentionCount, firstMentionAt/lastMentionAt, activeMonthsCount,
// avgEngagement, sentimentBreakdown); (2) GET /v1/topics/:topic/authors accepts
// sortBy=activeMonths|mentionCount and sorts descending accordingly, returning
// each author's raw signal fields with no computed score in the response
// either; an invalid sortBy is rejected, not silently defaulted; (3) the read
// path never queries social_posts — it reads an already-populated signal
// table, not a live per-request aggregation (ADR-0007's "periodically
// refreshed materialized view" framing; the literal refresh mechanism is
// Story 4.4/ADR-0022's scope, not this story's).
// Explicitly out of scope: how author_topic_signals actually gets populated
// from real ingested/enriched posts — that depends on enrichment.entities/
// keyPhrases/sentiment/engagementMetrics existing on social_posts, which is
// Story 4.2 (ADR-0008)/the Phase 2 "also build, not storied" enrichment-pipeline
// wiring, neither built yet. This story proves the schema and the read path are
// correct given rows that already exist in the table (inserted directly here),
// the same "prove the derivation, not the whole pipeline" pattern Story 4.3's
// ConnectorHealth contract used for IngestionRun; the scheduled refresh job
// itself (Story 4.4, ADR-0022 — hourly via pg_cron) is not built here either.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { upsertAuthor } from '../../src/authors/authorStore';

jest.setTimeout(20000);

afterAll(async () => {
  await closePool();
});

interface SignalFixture {
  mentionCount: number;
  activeMonthsCount: number;
  avgEngagement?: number;
  sentimentBreakdown?: unknown;
}

async function insertSignal(
  tenantId: string,
  authorId: string,
  topic: string,
  signal: SignalFixture
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO author_topic_signals
         (tenant_id, author_id, topic, mention_count, first_mention_at, last_mention_at, active_months_count, avg_engagement, sentiment_breakdown)
       VALUES ($1, $2, $3, $4, now(), now(), $5, $6, $7)`,
      [
        tenantId,
        authorId,
        topic,
        signal.mentionCount,
        signal.activeMonthsCount,
        signal.avgEngagement ?? null,
        signal.sentimentBreakdown ? JSON.stringify(signal.sentimentBreakdown) : null,
      ]
    );
  });
}

describe('Story 4.1 — raw author-topic signals contract', () => {
  const app = createApp();

  it('AC1: author_topic_signals has the ADR-0007 raw signal columns and no expertiseScore (or equivalent computed) column', async () => {
    const { rows } = await getPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'author_topic_signals'`
    );
    const columnNames = rows.map((r) => r.column_name);
    expect(columnNames.some((c) => /score/i.test(c))).toBe(false);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'mention_count',
        'first_mention_at',
        'last_mention_at',
        'active_months_count',
        'avg_engagement',
        'sentiment_breakdown',
      ])
    );
  });

  it('AC2: GET /v1/topics/:topic/authors sorts by mentionCount or activeMonths, high to low, with only raw fields in the response', async () => {
    const tenantId = randomUUID();
    const topic = 'acme';
    const authorA = await upsertAuthor(tenantId, 'example-poll', 'ext-a', {});
    const authorB = await upsertAuthor(tenantId, 'example-poll', 'ext-b', {});
    // A has more mentions but fewer active months; B is the reverse — proves
    // sortBy actually changes which author ranks first, not a coincidence.
    await insertSignal(tenantId, authorA.id, topic, { mentionCount: 50, activeMonthsCount: 2 });
    await insertSignal(tenantId, authorB.id, topic, { mentionCount: 10, activeMonthsCount: 8 });

    const byMentionCount = await request(app)
      .get(`/v1/topics/${topic}/authors?sortBy=mentionCount`)
      .set('X-Tenant-Id', tenantId);
    expect(byMentionCount.status).toBe(200);
    expect(byMentionCount.body.authors.map((a: { authorId: string }) => a.authorId)).toEqual([
      authorA.id,
      authorB.id,
    ]);
    expect(byMentionCount.body.authors[0].mentionCount).toBe(50);
    expect(byMentionCount.body.authors[0]).not.toHaveProperty('expertiseScore');

    const byActiveMonths = await request(app)
      .get(`/v1/topics/${topic}/authors?sortBy=activeMonths`)
      .set('X-Tenant-Id', tenantId);
    expect(byActiveMonths.status).toBe(200);
    expect(byActiveMonths.body.authors.map((a: { authorId: string }) => a.authorId)).toEqual([
      authorB.id,
      authorA.id,
    ]);
    expect(byActiveMonths.body.authors[0].activeMonthsCount).toBe(8);
  });

  it('AC2: an invalid sortBy value is rejected, not silently defaulted', async () => {
    const res = await request(app)
      .get('/v1/topics/acme/authors?sortBy=nonsense')
      .set('X-Tenant-Id', randomUUID());
    expect(res.status).toBe(400);
  });

  it('AC3: the read path never queries social_posts — it reads the already-populated signal table, not a live per-request aggregation', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'topics', 'authorTopicSignalStore.ts'),
      'utf8'
    );
    // Matches an actual SQL reference to the table (FROM/JOIN/INTO/UPDATE
    // social_posts), not mere mentions of the name in an explanatory comment —
    // same style as Story 3.4's AC3 OFFSET check.
    expect(source).not.toMatch(/\b(FROM|JOIN|INTO|UPDATE)\s+social_posts\b/i);
  });
});
