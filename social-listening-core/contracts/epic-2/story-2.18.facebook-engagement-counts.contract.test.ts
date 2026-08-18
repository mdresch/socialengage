// Contract: Story 2.18 (ADR-0059 Decision §2) — Facebook connector: capture
// post-level engagement counts (reactions, comments, shares).
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-218
//
// Intent: ADR-0059 Decision §2's own text explicitly named engagement counts
// ("reactions, comments, shares") as v1 scope for the Facebook connector, but
// Story 2.15's actual implementation never requested those Graph API fields
// — confirmed live this session (fetchFacebookPagePosts() only requested
// id,message,created_time,permalink_url). This story completes that
// already-decided scope: widens the Graph API request, extends
// FacebookPagePost with the new optional fields, and relies on the existing
// rawPayload: post spread in normalize() (unchanged) to carry them into
// storage — no schema change, no migration, matching ADR-0018's "full
// original platform JSON, never discarded" precedent every other
// connector's own extra fields already rely on.
//
// A real, live-verified nuance (checked directly against the real test Page
// before drafting, not assumed): Meta's Graph API omits the `shares` field
// from the response entirely when a post has zero shares — never
// `shares: { count: 0 }`. This contract proves that case is handled as
// genuinely optional/absent, not defaulted or crashed on.
//
// Scope: src/connectors/facebook/facebookConnector.ts (fetchFacebookPagePosts()'s
// fields parameter widened; FacebookPagePost gains optional reactions/
// comments/shares fields). No other file changes — normalize()/
// insertSocialPost()/any schema is untouched.
//
// Contract to encode: AC1 the real Graph API request includes the widened
// fields parameter and a real call against the real test Page returns
// populated reactions/comments; AC2 FacebookPagePost's new fields are all
// optional; AC3 rawPayload carries the new fields' real values with zero
// other code path touched; AC4 a response shaped like the real, confirmed
// zero-shares case (shares field entirely absent) ingests successfully
// without shares being defaulted to null/0 or crashing.
//
// Explicitly out of scope, per the story's own boundary (not tested): any
// structured/queryable exposure of these counts (new column, SocialPostSummary
// widening, Analytics Dashboard consumption); extending this to any other
// connector; comment/mention content ingestion (still deferred, ADR-0059
// Decision §5) — this story captures only aggregate counts, never comment
// text/authors.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { fetchFacebookPagePosts, FacebookPagePost, facebookConnector } from '../../src/connectors/facebook/facebookConnector';
import { createTenant } from '../../src/tenants/tenantStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { getSocialPostById } from '../../src/posts/socialPostStore';
import { upsertAuthor } from '../../src/authors/authorStore';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { FACEBOOK_PROVIDER_ID } from '../../src/connectors/facebook/facebookConnector';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

const REAL_TEST_PAGE_ID = process.env.FACEBOOK_TEST_PAGE_ID;
const REAL_TEST_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_TEST_PAGE_ACCESS_TOKEN;

async function makeTenant(): Promise<string> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  return tenant.id;
}

describe('Story 2.18 — Facebook connector captures post-level engagement counts', () => {
  describe('AC1 (ADR-0059 §2): the real Graph API request includes the widened fields and returns populated counts', () => {
    it('a real call against the real test Page returns reactions/comments with a real total_count', async () => {
      if (!REAL_TEST_PAGE_ID || !REAL_TEST_PAGE_ACCESS_TOKEN) {
        throw new Error('FACEBOOK_TEST_PAGE_ID/FACEBOOK_TEST_PAGE_ACCESS_TOKEN must be set for this real-infrastructure contract.');
      }
      const posts = await fetchFacebookPagePosts(REAL_TEST_PAGE_ID, REAL_TEST_PAGE_ACCESS_TOKEN, 3);
      expect(posts.length).toBeGreaterThan(0);
      for (const post of posts) {
        expect(post.reactions).toBeDefined();
        expect(typeof post.reactions?.summary.total_count).toBe('number');
        expect(post.comments).toBeDefined();
        expect(typeof post.comments?.summary.total_count).toBe('number');
        // shares is confirmed, live, to be entirely absent at zero shares —
        // asserting it's either undefined or a real { count: number } shape,
        // never null or a placeholder.
        if (post.shares !== undefined) {
          expect(typeof post.shares.count).toBe('number');
        }
      }
    });
  });

  describe('AC2: FacebookPagePost\'s new fields are all optional', () => {
    it('a minimal post object with no reactions/comments/shares is a structurally valid FacebookPagePost', () => {
      const minimal: FacebookPagePost = {
        id: 'x',
        created_time: new Date().toISOString(),
      };
      expect(minimal.reactions).toBeUndefined();
      expect(minimal.comments).toBeUndefined();
      expect(minimal.shares).toBeUndefined();
    });
  });

  describe('AC3: rawPayload carries the new fields\' real values, zero other code path touched', () => {
    it('a post normalized and inserted carries its real engagement counts in rawPayload', async () => {
      const tenantId = await makeTenant();
      const run = await startIngestionRun(tenantId, {
        platformId: FACEBOOK_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      const author = await upsertAuthor(tenantId, FACEBOOK_PROVIDER_ID, 'page-1', { displayName: 'Test Page' });

      const fixturePost: FacebookPagePost & { pageId: string } = {
        id: 'post-1',
        message: 'hello',
        created_time: new Date().toISOString(),
        pageId: 'page-1',
        reactions: { summary: { total_count: 42 } },
        comments: { summary: { total_count: 7 } },
        shares: { count: 3 },
      };

      const normalized = facebookConnector.normalize(fixturePost);
      const inserted = await insertSocialPost({
        tenantId,
        authorId: author.id,
        acquisitionId: run.id,
        rawPayload: normalized.rawPayload as Record<string, unknown>,
        publishedAt: normalized.publishedAt,
      });

      const stored = await getSocialPostById(tenantId, inserted.id);
      const rawPayload = stored?.rawPayload as typeof fixturePost;
      expect(rawPayload.reactions?.summary.total_count).toBe(42);
      expect(rawPayload.comments?.summary.total_count).toBe(7);
      expect(rawPayload.shares?.count).toBe(3);
    });
  });

  describe('AC4: a real, confirmed zero-shares response (shares field entirely absent) ingests without defaulting or crashing', () => {
    it('a post with no shares field at all normalizes and inserts cleanly, rawPayload.shares stays absent', async () => {
      const tenantId = await makeTenant();
      const run = await startIngestionRun(tenantId, {
        platformId: FACEBOOK_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });
      const author = await upsertAuthor(tenantId, FACEBOOK_PROVIDER_ID, 'page-2', { displayName: 'Test Page 2' });

      // Shaped exactly like the real, live-verified zero-shares response —
      // no `shares` key present at all.
      const fixturePost: FacebookPagePost & { pageId: string } = {
        id: 'post-2',
        message: 'no shares yet',
        created_time: new Date().toISOString(),
        pageId: 'page-2',
        reactions: { summary: { total_count: 0 } },
        comments: { summary: { total_count: 0 } },
      };

      const normalized = facebookConnector.normalize(fixturePost);
      const inserted = await insertSocialPost({
        tenantId,
        authorId: author.id,
        acquisitionId: run.id,
        rawPayload: normalized.rawPayload as Record<string, unknown>,
        publishedAt: normalized.publishedAt,
      });

      const stored = await getSocialPostById(tenantId, inserted.id);
      const rawPayload = stored?.rawPayload as typeof fixturePost;
      expect(rawPayload.shares).toBeUndefined();
      expect(rawPayload).not.toHaveProperty('shares');
    });
  });
});
