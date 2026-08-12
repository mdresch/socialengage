// Contract: Story 3.9 (ADR-0049) — point-in-time author follower count on
// `SocialPost`, a scoped exception to ADR-0004's normalized Author model.
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-39--point-in-time-author-follower-count-on-socialpost
//
// Intent: SocialPost gains one nullable field, author_follower_count_at_publish,
// populated once at ingest time from whatever the connector's normalize()
// output reports, never updated afterward and never derived from/reconciled
// against Author.followerCount (which continues exactly as ADR-0004 already
// specifies — Story 3.1's own contract is unmodified and re-proves this on
// every full-suite run, not re-asserted here).
// Scope: migrations/0027_add_social_posts_author_follower_count_at_publish.sql
// (new), src/connectors/types.ts (NormalizedPost.authorFollowerCountAtPublish,
// SocialConnector.canProvideFollowerCountAtPublish — the Open Question 5
// capability-declaration shape, resolved here as a boolean flag analogous to
// supportedQueryFeatures), src/posts/socialPostStore.ts
// (InsertSocialPostInput gains the field; written to the new column;
// deliberately NOT added to SocialPostFull/SocialPostSummary — no API
// surface change, per ADR-0049's own explicit statement).
// Contract to encode, per AC: (1) schema has the one new nullable INTEGER
// column, no other author field added to SocialPost; (2) populated once,
// unaffected by a later post from the same author with a different
// reported value; (3) never touched by a later Author.followerCount
// upsert; (4) Author.followerCount itself is unchanged — cross-referenced
// to Story 3.1, not re-tested; (5) Newswire and GNews (neither reports
// this) leave it NULL, proven via their own real, unmodified poll
// functions; (6) the three-way NULL interpretation is documented as a
// real, queryable Postgres column comment; (7) pre-existing/not-explicitly-
// set rows are NULL, and the migration itself contains no backfill UPDATE;
// (8) GET /posts and GET /topics/:topic/authors response shapes are
// unchanged — no API surface change is mandated by this story.
// Explicitly out of scope: any real individual-account connector (Reddit
// doesn't exist yet — the capability-flag mechanism is proven with an
// inline, local test connector, not a real platform); BIGINT vs INTEGER
// (Open Question 2, deferred); sortBy=followerCountAtPublish on the
// expert-finder endpoint (Open Question 3, deferred); historical backfill
// from platform APIs (Open Question 4, deferred).

import { randomUUID } from 'crypto';
import { closePool, getPool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { insertSocialPost, getSocialPostById, listSocialPosts } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { NormalizedPost, SocialConnector } from '../../src/connectors/types';
import { pollNewswireFeeds } from '../../src/connectors/newswire/pollNewswireFeeds';
import { NEWSWIRE_PROVIDER_ID } from '../../src/connectors/newswire/newswireConnector';
import { pollGNewsSearch } from '../../src/connectors/gnews/pollGNewsSearch';
import { GNEWS_PROVIDER_ID } from '../../src/connectors/gnews/gnewsConnector';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';

jest.setTimeout(60000);

afterAll(async () => {
  await closePool();
});

async function makeRun(tenantId: string, platformId: string): Promise<string> {
  const run = await startIngestionRun(tenantId, { platformId, triggerType: 'poll', connectorVersion: '1.0.0' });
  await completeIngestionRun(tenantId, run.id, { status: 'succeeded', postsIngested: 0, postsSkipped: 0 });
  return run.id;
}

async function getColumn(tenantId: string, postId: string, column: string): Promise<unknown> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(`SELECT ${column} FROM social_posts WHERE id = $1`, [postId]);
    return rows[0][column];
  });
}

describe('Story 3.9 — point-in-time author follower count on SocialPost', () => {
  it('AC1: schema — one new nullable INTEGER column; no other author field added to social_posts', async () => {
    const client = await getPool().connect();
    try {
      const { rows } = await client.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_name = 'social_posts' ORDER BY ordinal_position`
      );
      const column = rows.find((r: { column_name: string }) => r.column_name === 'author_follower_count_at_publish');
      expect(column).toBeDefined();
      expect(column.data_type).toBe('integer');
      expect(column.is_nullable).toBe('YES');

      const columnNames = rows.map((r: { column_name: string }) => r.column_name);
      expect(columnNames).not.toContain('handle');
      expect(columnNames).not.toContain('display_name');
      expect(columnNames).not.toContain('profile_location');
      expect(columnNames).not.toContain('verified_status');
    } finally {
      client.release();
    }
  });

  it('AC2: populated once at ingest — a second post from the same author with a different reported value leaves the first post\'s value unchanged', async () => {
    const tenantId = randomUUID();
    const runId = await makeRun(tenantId, 'example-social');
    const author = await upsertAuthor(tenantId, 'example-social', 'acct-1', { followerCount: 500 });

    const post1 = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { text: 'first post' },
      authorFollowerCountAtPublish: 1000,
    });
    const post2 = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { text: 'second post' },
      authorFollowerCountAtPublish: 2500,
    });

    expect(await getColumn(tenantId, post1.id, 'author_follower_count_at_publish')).toBe(1000);
    expect(await getColumn(tenantId, post2.id, 'author_follower_count_at_publish')).toBe(2500);
  });

  it('AC3: never derived from or reconciled against a later Author.followerCount upsert', async () => {
    const tenantId = randomUUID();
    const runId = await makeRun(tenantId, 'example-social');
    const author = await upsertAuthor(tenantId, 'example-social', 'acct-2', { followerCount: 500 });

    const post = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { text: 'a post' },
      authorFollowerCountAtPublish: 1000,
    });

    // A newer post's own upsert changes Author.followerCount materially.
    await upsertAuthor(tenantId, 'example-social', 'acct-2', { followerCount: 999999 });

    const authorRow = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ follower_count: number }>(`SELECT follower_count FROM authors WHERE id = $1`, [
        author.id,
      ]);
      return rows[0];
    });
    expect(authorRow.follower_count).toBe(999999);
    // The earlier post's own point-in-time snapshot is untouched.
    expect(await getColumn(tenantId, post.id, 'author_follower_count_at_publish')).toBe(1000);
  });

  it('AC4: Author.followerCount continues exactly as ADR-0004 specifies (cross-referenced to Story 3.1\'s own unmodified contract, not re-tested here)', () => {
    // Deliberately not re-asserted — Story 3.1's own contract
    // (contracts/epic-3/story-3.1.author-model.contract.test.ts, unmodified
    // by this story) already proves this, and the full accumulated suite
    // re-runs it on every merge.
    expect(true).toBe(true);
  });

  it('AC5: Newswire and GNews (neither reports this value) leave the column NULL via their own real, unmodified poll functions', async () => {
    const newswireTenantId = randomUUID();
    const newswireResult = await pollNewswireFeeds(newswireTenantId, [
      'https://www.globenewswire.com/RssFeed/industry/1-Energy/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Energy',
    ]);
    expect(newswireResult.status).toBe('succeeded');
    const newswireRows = await withTenant(newswireTenantId, async (client) => {
      const { rows } = await client.query<{ author_follower_count_at_publish: number | null }>(
        `SELECT author_follower_count_at_publish FROM social_posts WHERE raw_payload->>'providerId' = $1`,
        [NEWSWIRE_PROVIDER_ID]
      );
      return rows;
    });
    expect(newswireRows.length).toBeGreaterThan(0);
    expect(newswireRows.every((r) => r.author_follower_count_at_publish === null)).toBe(true);

    const gnewsTenantId = randomUUID();
    const testKeyName = `test-key-story39-${randomUUID()}`;
    const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
    try {
      await storeCredential(gnewsTenantId, GNEWS_PROVIDER_ID, process.env.GNEWS_API_KEY ?? 'test-key', key.id as string);
      const gnewsResult = await pollGNewsSearch(gnewsTenantId, 'technology');
      expect(gnewsResult.status).toBe('succeeded');
      const gnewsRows = await withTenant(gnewsTenantId, async (client) => {
        const { rows } = await client.query<{ author_follower_count_at_publish: number | null }>(
          `SELECT author_follower_count_at_publish FROM social_posts WHERE raw_payload->>'providerId' = $1`,
          [GNEWS_PROVIDER_ID]
        );
        return rows;
      });
      expect(gnewsRows.length).toBeGreaterThan(0);
      expect(gnewsRows.every((r) => r.author_follower_count_at_publish === null)).toBe(true);
    } finally {
      const poller = await getKeyClient().beginDeleteKey(testKeyName);
      await poller.pollUntilDone();
    }
  });

  it('AC6: the three-way NULL interpretation is documented as a real, queryable Postgres column comment', async () => {
    const client = await getPool().connect();
    try {
      const { rows } = await client.query<{ description: string }>(
        `SELECT col_description('social_posts'::regclass, ordinal_position) AS description
         FROM information_schema.columns
         WHERE table_name = 'social_posts' AND column_name = 'author_follower_count_at_publish'`
      );
      const description = rows[0].description;
      expect(description).toBeTruthy();
      expect(description.toLowerCase()).toContain('connector-type null');
      expect(description.toLowerCase()).toContain('platform-omitted null');
      expect(description.toLowerCase()).toContain('pre-migration null');
    } finally {
      client.release();
    }
  });

  it('AC7: not backfilled — a post inserted without the field set is NULL, and the migration itself contains no backfill UPDATE', async () => {
    const tenantId = randomUUID();
    const runId = await makeRun(tenantId, 'example-social');
    const author = await upsertAuthor(tenantId, 'example-social', 'acct-3', {});

    const post = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { text: 'no follower count supplied' },
      // authorFollowerCountAtPublish deliberately omitted.
    });
    expect(await getColumn(tenantId, post.id, 'author_follower_count_at_publish')).toBeNull();

    const migrationSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../migrations/0027_add_social_posts_author_follower_count_at_publish.sql'),
      'utf8'
    );
    expect(migrationSource.toUpperCase()).not.toContain('UPDATE SOCIAL_POSTS');
  });

  it('AC8: no API surface change — GET-shaped reads (getSocialPostById, listSocialPosts) do not expose the new field', async () => {
    const tenantId = randomUUID();
    const runId = await makeRun(tenantId, 'example-social');
    const author = await upsertAuthor(tenantId, 'example-social', 'acct-4', {});
    const post = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: { text: 'api shape check' },
      authorFollowerCountAtPublish: 42,
    });

    const fetched = await getSocialPostById(tenantId, post.id);
    expect(fetched).not.toBeNull();
    expect(Object.keys(fetched as object)).not.toContain('authorFollowerCountAtPublish');

    const page = await listSocialPosts(tenantId);
    expect(page.posts.length).toBeGreaterThan(0);
    for (const p of page.posts) {
      expect(Object.keys(p)).not.toContain('authorFollowerCountAtPublish');
    }
  });

  it('Open Question 5\'s capability-flag mechanism: a connector declaring canProvideFollowerCountAtPublish can round-trip a real value end to end (no real individual-account connector exists yet, so an inline local connector proves the mechanism)', async () => {
    const exampleReachConnector: SocialConnector = {
      providerId: 'example-reach-connector',
      authMode: 'none',
      deliveryMode: 'poll',
      getRateLimitConfig: () => ({ requestsPerWindow: 10, windowSeconds: 60 }),
      canProvideFollowerCountAtPublish: true,
      normalize: (rawItem): NormalizedPost => {
        const item = rawItem as { id: string; author: string; followers: number };
        return {
          externalId: item.id,
          authorExternalId: item.author,
          publishedAt: new Date().toISOString(),
          rawPayload: item,
          authorFollowerCountAtPublish: item.followers,
        };
      },
    };

    expect(exampleReachConnector.canProvideFollowerCountAtPublish).toBe(true);

    const normalized = exampleReachConnector.normalize({ id: 'post-1', author: 'acct-5', followers: 87654 });
    expect(normalized.authorFollowerCountAtPublish).toBe(87654);

    const tenantId = randomUUID();
    const runId = await makeRun(tenantId, exampleReachConnector.providerId);
    const author = await upsertAuthor(tenantId, exampleReachConnector.providerId, normalized.authorExternalId, {});
    const post = await insertSocialPost({
      tenantId,
      authorId: author.id,
      acquisitionId: runId,
      rawPayload: normalized.rawPayload,
      authorFollowerCountAtPublish: normalized.authorFollowerCountAtPublish,
    });

    expect(await getColumn(tenantId, post.id, 'author_follower_count_at_publish')).toBe(87654);
  });
});
