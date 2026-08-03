// Contract: Story 3.4 (ADR-0011) — cursor-based pagination for GET /posts.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-34--cursor-based-pagination-for-the-posts-api
//
// Intent: Story 3.4 — Cursor-based pagination for the posts API (ADR-0011)
// Scope: migrations/0006_add_social_posts_pagination_index.sql, src/posts/cursor.ts,
// src/posts/socialPostStore.ts (listSocialPosts), src/http/versions/v1/postsRouter.ts,
// src/http/versions/v1/router.ts
// Contract to encode: (1) GET /v1/posts accepts a cursor query parameter and
// returns a cursor for the next page; page/offset parameters have no effect on
// what's returned (silently ignored, not rejected — standard REST tolerance for
// unrecognized params, not an error condition); (2) paging through results while
// new posts are ingested concurrently produces no duplicate posts across pages;
// (3) fetching a page near the "end" costs about the same as one near the "start"
// — verified two ways: structurally (the implementation never issues a SQL OFFSET,
// which is what would make cost grow with depth in the first place) and
// empirically at a practical test scale (hundreds of rows, not literally the
// millions ADR-0011 describes — keyset pagination's O(1)-per-page cost is a
// property of the query shape, not of scale, so this is a proxy check, not a
// literal million-row benchmark).
// Explicitly out of scope: GET /posts's other documented filters (watchlistId,
// platformId, from/to, sentiment — none of those fields exist on social_posts yet).
//
// 2026-08-03 — Story 5.10 (ADR-0033): real tenant authentication now exists
// (Entra bearer tokens + resolveIdentity()) — the X-Tenant-Id placeholder this
// note used to describe is retired. Tenant identity below comes from
// X-Test-Identity (via testAuthBypassMiddleware, NODE_ENV==='test' only) — see
// .claude/skills/tenant-auth-middleware/SKILL.md. Business-logic assertions
// are otherwise unchanged.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

jest.setTimeout(30000);

afterAll(async () => {
  await closePool();
});

describe('Story 3.4 — cursor-based pagination contract', () => {
  const app = createApp();

  it('AC1: GET /v1/posts accepts a cursor query parameter and returns a cursor for the next page; page/offset have no effect', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    for (let i = 0; i < 5; i++) {
      await insertSocialPost({ tenantId, authorId: null, acquisitionId: run.id, rawPayload: { i } });
    }

    const first = await request(app).get('/v1/posts?limit=2').set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    expect(first.status).toBe(200);
    expect(first.body.posts).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const withPageOffset = await request(app)
      .get('/v1/posts?limit=2&page=99&offset=999')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    expect(withPageOffset.body.posts.map((p: { id: string }) => p.id)).toEqual(
      first.body.posts.map((p: { id: string }) => p.id)
    );

    const second = await request(app)
      .get(`/v1/posts?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    expect(second.status).toBe(200);
    expect(second.body.posts).toHaveLength(2);
    const firstIds = new Set(first.body.posts.map((p: { id: string }) => p.id));
    for (const post of second.body.posts) {
      expect(firstIds.has(post.id)).toBe(false);
    }
  });

  it('AC2: paging while new posts are ingested concurrently produces no duplicate posts across pages', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    for (let i = 0; i < 6; i++) {
      await insertSocialPost({ tenantId, authorId: null, acquisitionId: run.id, rawPayload: { i } });
    }

    const page1 = await request(app).get('/v1/posts?limit=3').set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    const seenIds = new Set<string>(page1.body.posts.map((p: { id: string }) => p.id));

    // Concurrent insert between page 1 and page 2 — must not shift page 2's results
    // or reappear as a duplicate of something already seen.
    await insertSocialPost({
      tenantId,
      authorId: null,
      acquisitionId: run.id,
      rawPayload: { i: 'mid-pagination' },
    });

    let cursor: string | null = page1.body.nextCursor;
    let pagesWalked = 0;
    while (cursor && pagesWalked < 10) {
      const page = await request(app)
        .get(`/v1/posts?limit=3&cursor=${encodeURIComponent(cursor)}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
      for (const post of page.body.posts as { id: string }[]) {
        expect(seenIds.has(post.id)).toBe(false);
        seenIds.add(post.id);
      }
      cursor = page.body.nextCursor;
      pagesWalked += 1;
    }

    expect(seenIds.size).toBeGreaterThanOrEqual(6);
  });

  it('AC3: the pagination implementation never issues a SQL OFFSET clause', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'src', 'posts', 'socialPostStore.ts'),
      'utf8'
    );
    // Matches an actual SQL OFFSET clause (OFFSET <number-or-param>), not mere
    // mentions of the word in a comment explaining why OFFSET isn't used.
    expect(source).not.toMatch(/\bOFFSET\s+(\$\d+|\d+)/i);
  });

  it('AC3: fetching a page near the "end" costs about the same as one near the "start"', async () => {
    const tenantId = randomUUID();
    const run = await startIngestionRun(tenantId, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });

    const ROW_COUNT = 500;
    const PAGE_SIZE = 20;
    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO social_posts (tenant_id, raw_payload, acquisition_id)
         SELECT $1, jsonb_build_object('i', gs), $2
         FROM generate_series(1, $3) AS gs`,
        [tenantId, run.id, ROW_COUNT]
      );
    });

    const startBegin = process.hrtime.bigint();
    const startPage = await request(app)
      .get(`/v1/posts?limit=${PAGE_SIZE}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    const startMs = Number(process.hrtime.bigint() - startBegin) / 1e6;
    expect(startPage.status).toBe(200);

    // Walk to a page near the end via cursors (each hop itself O(1) — this is just
    // navigation, not part of what's timed below).
    let cursor: string | null = startPage.body.nextCursor;
    let hops = 0;
    const maxHops = Math.floor(ROW_COUNT / PAGE_SIZE) - 2;
    while (cursor && hops < maxHops) {
      const page: request.Response = await request(app)
        .get(`/v1/posts?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`)
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
      cursor = page.body.nextCursor;
      hops += 1;
    }

    const endBegin = process.hrtime.bigint();
    const endPage = await request(app)
      .get(`/v1/posts?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor as string)}`)
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId));
    const endMs = Number(process.hrtime.bigint() - endBegin) / 1e6;
    expect(endPage.status).toBe(200);

    // Generous bound absorbing test-environment jitter, while still catching a
    // real regression to depth-proportional cost (e.g. an accidental
    // OFFSET-based rewrite), which would grow with ROW_COUNT, not stay fixed.
    expect(endMs).toBeLessThan(Math.max(startMs * 5, 100));
  });
});
