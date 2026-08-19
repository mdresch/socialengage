// Contract: Story 3.11 (ADR-0063) — Post-watchlist match persistence:
// post_watchlist_matches junction table, ingestion write, and
// GET /v1/posts?watchlistId filter.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-311
// and docs/adr/0063-post-watchlist-matches-junction-table-and-server-side-watchlist-filter.md.
//
// Intent: persist the (post, watchlist) match pairs ADR-0058's event
// publishing already computes at ingestion time, in a real, queryable
// junction table, so GET /v1/posts can filter server-side by watchlistId
// instead of the client-side bodyMarkdown approximation ADR-0062 Decision §3
// adopted as a stepping stone.
// Scope: migrations/0036_create_post_watchlist_matches.sql (new),
// src/watchlists/postWatchlistMatchStore.ts (new — insertPostWatchlistMatches()),
// src/events/publishSocialPostIngestedEvents.ts (calls
// insertPostWatchlistMatches() with the same matched-watchlist set it already
// computes for event publishing — see the deviation note below),
// src/posts/socialPostStore.ts (ListSocialPostsOptions.watchlistId, JOIN in
// queryFirstPage/queryAfterCursor), src/http/versions/v1/postsRouter.ts
// (watchlistId query param: UUID validation, watchlist-existence check,
// 400/404 mapping).
// Contract to encode: (1) the table/indexes/UNIQUE constraint/RLS policy all
// exist after migrations run; (2) insertPostWatchlistMatches() is idempotent
// on retry (ON CONFLICT DO NOTHING); (3) publishSocialPostIngestedEvents()
// persists the match pairs it already computes, best-effort — a store-layer
// failure is swallowed, never blocks or fails the surrounding ingestion
// attempt; (4) GET /v1/posts?watchlistId=<id>: a valid id returns only
// matched posts; a cross-tenant or another-user's-in-the-same-tenant id
// returns 404 WATCHLIST_NOT_FOUND (same RLS-backed split as ADR-0044 §5c); a
// malformed string returns 400 INVALID_WATCHLIST_ID; cursor pagination
// (seq-ordered, ADR-0011) is unchanged with watchlistId present;
// SocialPostSummary's shape is unchanged; (5) no change to
// matchesWatchlist()/matchesAst() themselves — a smoke check only, since
// this story writes match results, it does not change how they're computed;
// (6) a post with no match row (the historical-gap case, ADR-0063 Decision §5)
// returns an honest empty result via the filter, not an error.
// Explicitly out of scope: retroactive backfill of historical posts (ADR-0063
// Open Question 1); re-matching on watchlist update (Open Question 2);
// GET /v1/watchlists' postCount field (Open Question 4, left to Story 8.9);
// any social-listening-admin change (Story 8.9).
//
// 2026-08-19 — deviation from ADR-0063 Decision §2's own literal text, found
// and confirmed before writing any code (not assumed): the ADR's own snippet
// says "Inside runIngestionAttempt(), the watchlist-match call already
// happens for ADR-0058's event publishing" and shows
// insertPostWatchlistMatches() being called there. Verified directly against
// runIngestionAttempt.ts (a generic, connector-agnostic attempt/retry state
// machine with no knowledge of posts or watchlists at all — it only calls the
// caller-supplied options.attempt(runId) closure) and
// publishSocialPostIngestedEvents.ts (the actual, real function that already
// loops over watchlists, calls matchesAst(), and is what every connector's
// own per-post loop calls after insertSocialPost() resolves). The real,
// single choke point where match pairs are already computed is
// publishSocialPostIngestedEvents() itself, not runIngestionAttempt() —
// every connector that already calls the former (GNews, Newswire, Facebook,
// tenant-owned-feed, Wikipedia) gets match persistence automatically, for
// free, with no per-connector wiring, the same "computed once, extended
// once" precedent facebook-connector/SKILL.md's own is_credential_failure
// note already established. insertPostWatchlistMatches() is therefore called
// from publishSocialPostIngestedEvents(), not runIngestionAttempt.ts, which
// this story's own Scope list above reflects.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { withTenant } from '../../src/db/withTenant';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { createWatchlist } from '../../src/watchlists/watchlistStore';
import { insertPostWatchlistMatches } from '../../src/watchlists/postWatchlistMatchStore';
import { publishSocialPostIngestedEvents } from '../../src/events/publishSocialPostIngestedEvents';
import { runIngestionAttempt } from '../../src/ingestion/runIngestionAttempt';
import { matchesWatchlist, matchesAst } from '../../src/watchlists/matcher';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import * as postWatchlistMatchStoreModule from '../../src/watchlists/postWatchlistMatchStore';

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePool();
});

/** A tenant plus one real, activated user — same makeTenantWithUser() pattern story-1.5 established. */
async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

function identityHeader(tenantId: string, userId: string, role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): string {
  return testIdentityHeaderValue(tenantId, { userId, role });
}

async function makePost(tenantId: string, rawPayload: unknown = { i: randomUUID() }): Promise<string> {
  const run = await startIngestionRun(tenantId, {
    platformId: 'example-poll',
    triggerType: 'poll',
    connectorVersion: '1.0.0',
  });
  const post = await insertSocialPost({ tenantId, authorId: null, acquisitionId: run.id, rawPayload });
  return post.id;
}

describe('Story 3.11 — post-watchlist match persistence contract', () => {
  const app = createApp();

  it('AC1: post_watchlist_matches has the ADR-0063 columns, both named indexes, its UNIQUE constraint, and the tenant_isolation RLS policy', async () => {
    const { rows: columns } = await getPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'post_watchlist_matches'`
    );
    const columnNames = columns.map((r) => r.column_name);
    expect(columnNames).toEqual(
      expect.arrayContaining(['id', 'post_id', 'watchlist_id', 'tenant_id', 'matched_at'])
    );

    const { rows: indexes } = await getPool().query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'post_watchlist_matches'`
    );
    const indexNames = indexes.map((r) => r.indexname);
    expect(indexNames).toContain('idx_pwm_watchlist_id');
    expect(indexNames).toContain('idx_pwm_post_id');

    const { rows: constraints } = await getPool().query<{ constraint_type: string }>(
      `SELECT constraint_type FROM information_schema.table_constraints
       WHERE table_name = 'post_watchlist_matches' AND constraint_type = 'UNIQUE'`
    );
    expect(constraints.length).toBeGreaterThan(0);

    const { rows: policies } = await getPool().query<{ policyname: string; qual: string }>(
      `SELECT policyname, qual FROM pg_policies WHERE tablename = 'post_watchlist_matches'`
    );
    const tenantIsolation = policies.find((p) => p.policyname === 'tenant_isolation');
    expect(tenantIsolation).toBeDefined();
    expect(tenantIsolation?.qual).toContain('tenant_id');
  });

  it('AC2: insertPostWatchlistMatches() is idempotent — calling it twice with the same pairs does not grow the row count', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const watchlist = await createWatchlist(tenantId, userId, {
      name: 'Idempotency watchlist',
      matchType: 'keyword',
      terms: ['acme'],
      platformIds: ['example-poll'],
    });
    const postId = await makePost(tenantId);
    const pairs = [{ postId, watchlistId: watchlist.id }];

    await insertPostWatchlistMatches(tenantId, pairs);
    await insertPostWatchlistMatches(tenantId, pairs);

    const { rows } = await withTenant(tenantId, (client) =>
      client.query(`SELECT id FROM post_watchlist_matches WHERE post_id = $1 AND watchlist_id = $2`, [
        postId,
        watchlist.id,
      ])
    );
    expect(rows).toHaveLength(1);
  });

  describe('AC3: publishSocialPostIngestedEvents() persists match records, best-effort', () => {
    it('a real matching watchlist produces a real post_watchlist_matches row', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const watchlist = await createWatchlist(tenantId, userId, {
        name: 'Real match watchlist',
        matchType: 'keyword',
        terms: ['zzyzx'],
        platformIds: ['example-poll'],
      });
      const postId = await makePost(tenantId, { title: 'Zzyzx breaking update' });

      await publishSocialPostIngestedEvents(tenantId, 'example-poll', [watchlist], {
        postId,
        text: 'Zzyzx breaking update',
      });

      const { rows } = await withTenant(tenantId, (client) =>
        client.query(`SELECT watchlist_id FROM post_watchlist_matches WHERE post_id = $1`, [postId])
      );
      expect(rows.map((r) => r.watchlist_id)).toEqual([watchlist.id]);
    });

    it('a store-layer failure is logged but never thrown, and never fails the surrounding ingestion attempt', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const watchlist = await createWatchlist(tenantId, userId, {
        name: 'Failure-injection watchlist',
        matchType: 'keyword',
        terms: ['zzyzx'],
        platformIds: ['example-poll'],
      });

      const insertSpy = jest
        .spyOn(postWatchlistMatchStoreModule, 'insertPostWatchlistMatches')
        .mockRejectedValueOnce(new Error('simulated store failure'));

      let insertedPostId = '';
      const result = await runIngestionAttempt({
        tenantId,
        connectorInfo: { platformId: 'example-poll', triggerType: 'poll', connectorVersion: '1.0.0' },
        attempt: async (runId) => {
          const post = await insertSocialPost({
            tenantId,
            authorId: null,
            acquisitionId: runId,
            rawPayload: { title: 'Zzyzx breaking update' },
          });
          insertedPostId = post.id;
          await publishSocialPostIngestedEvents(tenantId, 'example-poll', [watchlist], {
            postId: post.id,
            text: 'Zzyzx breaking update',
          });
          return { postsIngested: 1, postsSkipped: 0 };
        },
      });

      expect(result.status).toBe('succeeded');
      insertSpy.mockRestore();

      const response = await request(app)
        .get('/v1/posts')
        .set('X-Test-Identity', identityHeader(tenantId, userId));
      expect(response.body.posts.map((p: { id: string }) => p.id)).toContain(insertedPostId);
    });
  });

  describe('AC4: GET /v1/posts?watchlistId=<id>', () => {
    it('a valid watchlistId returns only the matched posts, with SocialPostSummary\'s shape unchanged', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const watchlist = await createWatchlist(tenantId, userId, {
        name: 'Filter watchlist',
        matchType: 'keyword',
        terms: ['acme'],
        platformIds: ['example-poll'],
      });
      const matchedPostId = await makePost(tenantId, { title: 'matched' });
      await makePost(tenantId, { title: 'unmatched' }); // no match row — must not appear
      await insertPostWatchlistMatches(tenantId, [{ postId: matchedPostId, watchlistId: watchlist.id }]);

      const response = await request(app)
        .get(`/v1/posts?watchlistId=${watchlist.id}`)
        .set('X-Test-Identity', identityHeader(tenantId, userId));

      expect(response.status).toBe(200);
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].id).toBe(matchedPostId);
      expect(Object.keys(response.body.posts[0]).sort()).toEqual(
        ['id', 'createdAt', 'rawPayload', 'publishedAt', 'enrichment', 'bodyMarkdown'].sort()
      );
    });

    it('a watchlistId belonging to a different tenant returns 404 WATCHLIST_NOT_FOUND', async () => {
      const owner = await makeTenantWithUser();
      const watchlist = await createWatchlist(owner.tenantId, owner.userId, {
        name: 'Owned elsewhere',
        matchType: 'keyword',
        terms: ['acme'],
        platformIds: ['example-poll'],
      });
      const caller = await makeTenantWithUser();

      const response = await request(app)
        .get(`/v1/posts?watchlistId=${watchlist.id}`)
        .set('X-Test-Identity', identityHeader(caller.tenantId, caller.userId));

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('WATCHLIST_NOT_FOUND');
    });

    it('a watchlistId belonging to another user in the same tenant returns 404 WATCHLIST_NOT_FOUND (ADR-0044 §5c — no Tenant-Admin oversight override)', async () => {
      const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
      const ownerEmail = `owner-${randomUUID()}@example.com`;
      const owner = await createInvitedUser(tenant.id, { email: ownerEmail, role: 'tenant_user' });
      await resolveIdentity({ sub: `sub-${owner.id}`, email: ownerEmail });
      const watchlist = await createWatchlist(tenant.id, owner.id, {
        name: "Owner's private watchlist",
        matchType: 'keyword',
        terms: ['acme'],
        platformIds: ['example-poll'],
      });

      const adminEmail = `admin-${randomUUID()}@example.com`;
      const admin = await createInvitedUser(tenant.id, { email: adminEmail, role: 'tenant_admin' });
      await resolveIdentity({ sub: `sub-${admin.id}`, email: adminEmail });

      const response = await request(app)
        .get(`/v1/posts?watchlistId=${watchlist.id}`)
        .set('X-Test-Identity', identityHeader(tenant.id, admin.id, 'tenant_admin'));

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('WATCHLIST_NOT_FOUND');
    });

    it('a malformed watchlistId returns 400 INVALID_WATCHLIST_ID', async () => {
      const { tenantId, userId } = await makeTenantWithUser();

      const response = await request(app)
        .get('/v1/posts?watchlistId=not-a-uuid')
        .set('X-Test-Identity', identityHeader(tenantId, userId));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_WATCHLIST_ID');
    });

    it('cursor pagination is preserved when watchlistId is present — no duplicates, no OFFSET-shaped behavior', async () => {
      const { tenantId, userId } = await makeTenantWithUser();
      const watchlist = await createWatchlist(tenantId, userId, {
        name: 'Pagination watchlist',
        matchType: 'keyword',
        terms: ['acme'],
        platformIds: ['example-poll'],
      });
      const postIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const postId = await makePost(tenantId, { i });
        postIds.push(postId);
        await insertPostWatchlistMatches(tenantId, [{ postId, watchlistId: watchlist.id }]);
      }

      const first = await request(app)
        .get(`/v1/posts?watchlistId=${watchlist.id}&limit=2`)
        .set('X-Test-Identity', identityHeader(tenantId, userId));
      expect(first.status).toBe(200);
      expect(first.body.posts).toHaveLength(2);
      expect(first.body.nextCursor).toBeTruthy();

      const second = await request(app)
        .get(`/v1/posts?watchlistId=${watchlist.id}&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .set('X-Test-Identity', identityHeader(tenantId, userId));
      expect(second.status).toBe(200);
      expect(second.body.posts).toHaveLength(2);

      const firstIds = new Set(first.body.posts.map((p: { id: string }) => p.id));
      for (const post of second.body.posts) {
        expect(firstIds.has(post.id)).toBe(false);
      }
    });
  });

  it('AC5/AC6: no change to the matching engine itself — matchesWatchlist()/matchesAst() behave exactly as already established', () => {
    expect(matchesWatchlist({ keywords: ['acme'] }, { id: 'p1', text: 'Acme just launched a product' })).toBe(true);
    expect(matchesWatchlist({ keywords: ['acme'] }, { id: 'p2', text: 'Nothing relevant here' })).toBe(false);
    expect(matchesAst(parseBooleanQuery('acme AND launch'), { id: 'p3', text: 'Acme launch today' })).toBe(true);
    expect(matchesAst(parseBooleanQuery('acme AND launch'), { id: 'p4', text: 'Acme only, no launch word' })).toBe(
      false
    );
  });

  it('AC7: a post ingested before this table existed (no match row) returns an honest empty filtered result, not an error', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    const watchlist = await createWatchlist(tenantId, userId, {
      name: 'Historical-gap watchlist',
      matchType: 'keyword',
      terms: ['acme'],
      platformIds: ['example-poll'],
    });
    await makePost(tenantId, { title: 'a pre-existing post with no match row' });

    const response = await request(app)
      .get(`/v1/posts?watchlistId=${watchlist.id}`)
      .set('X-Test-Identity', identityHeader(tenantId, userId));

    expect(response.status).toBe(200);
    expect(response.body.posts).toEqual([]);
    expect(response.body.nextCursor).toBeNull();
  });
});
