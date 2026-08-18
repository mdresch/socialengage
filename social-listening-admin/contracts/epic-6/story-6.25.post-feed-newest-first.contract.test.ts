/**
 * Contract: Story 6.25 — Post feed shows most-recently-ingested posts first.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-625
 *
 * Intent: Story 6.25 — no new ADR (a display-order fix over data ADR-0011's
 * already-Accepted cursor pagination already provides in full; no change to
 * the pagination mechanism itself).
 * Scope: social-listening-admin/{
 *   src/app/tenant/posts/page.tsx (fetchAllPosts() reverses the already-
 *     fully-fetched array once, after paging completes)
 * }. No social-listening-core change of any kind (GET /v1/posts and its
 * ORDER BY seq ASC keyset pagination are both unchanged).
 *
 * Requested directly by Menno, 2026-08-18. Confirmed directly against the
 * real backend: GET /v1/posts (socialPostStore.ts's queryFirstPage/
 * queryAfterCursor) orders every page ORDER BY seq ASC — seq is a
 * monotonic, insertion-ordered identity column (ADR-0011/Story 3.4), so the
 * first page returned is the oldest-ingested posts. fetchAllPosts() (Story
 * 6.18) already pages through the tenant's entire post set into memory
 * before PostsFeedClient renders/filters anything, and hands that array
 * through unmodified — oldest-ingested-first today.
 *
 * A deliberately minimal fix: rather than reversing the backend's own
 * ORDER BY seq ASC to DESC (which would flip the cursor's own keyset
 * comparison direction — a real, non-trivial change to ADR-0011's already-
 * contract-verified mechanism, Story 3.4's own tests), this story reverses
 * the already-fully-fetched, in-memory array once, client-side, after
 * fetchAllPosts() resolves. The backend's pagination mechanism, cursor
 * encoding, and seq ASC ordering are all completely unchanged.
 *
 * Contract to encode:
 * - AC1: fetchAllPosts() returns posts most-recently-ingested-first — the
 *   fully-fetched array is reversed once, after paging completes.
 * - AC2: PostsFeedClient's existing filteredPosts/visiblePosts derivation
 *   (Story 6.18, .filter() + .slice(0, visibleCount), no existing .sort())
 *   preserves that order end to end — a filtered/searched result set keeps
 *   the same relative order as the input, not re-sorted.
 * - Regression: Story 6.18's own full-set search/filter behavior is
 *   unaffected — this story changes order only, never which posts are
 *   fetched or filtered.
 *
 * Explicitly out of scope for this contract:
 *   - Any change to GET /v1/posts's own backend ORDER BY seq ASC or cursor
 *     keyset direction.
 *   - Any change to how visibleCount/"Show more" reveals results.
 *   - Sorting by publishedAt instead of ingestion order (seq) — Menno's own
 *     request specifically named "most recent ingested."
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const listPagePath = ['app', 'tenant', 'posts', 'page.tsx'];
const clientPath = ['app', 'tenant', 'posts', 'PostsFeedClient.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

async function renderPageAs(modulePath: string, fetchImpl: (url: string) => Response, identity: unknown = TENANT_USER) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
  const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

  jest.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
    }),
  }));
  jest.doMock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));
  jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

  const { default: Page } = await import(modulePath);
  return Page;
}

function post(id: string, providerId: string) {
  return {
    id,
    createdAt: '2026-08-12T09:00:00.000Z',
    publishedAt: '2026-08-12T08:00:00.000Z',
    enrichment: null,
    rawPayload: { providerId, title: `Post ${id}` },
  };
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.25 — Post feed shows most-recently-ingested posts first', () => {
  describe('AC1: fetchAllPosts() returns posts most-recently-ingested-first', () => {
    it('reverses the backend\'s own oldest-first (seq ASC) page order — the last-paged-in post (newest) comes first', async () => {
      const Page = await renderPageAs('../../src/app/tenant/posts/page', (url) => {
        if (url.includes('/v1/posts')) {
          // Backend returns ORDER BY seq ASC — page 1 is the oldest posts
          // ('a' ingested before 'b'), page 2 (via cursor) is newer still
          // ('c' most recently ingested of all three).
          if (!url.includes('cursor=')) {
            return new Response(JSON.stringify({ posts: [post('a', 'gnews'), post('b', 'newswire')], nextCursor: 'page-2' }), {
              status: 200,
            });
          }
          return new Response(JSON.stringify({ posts: [post('c', 'wikipedia')], nextCursor: null }), { status: 200 });
        }
        return new Response(JSON.stringify({ watchlists: [] }), { status: 200 });
      });

      const element = await Page({});
      const clientProps = element.props.children.props;
      // Backend arrival order was [a, b, c] (oldest -> newest, seq ASC).
      // The fix reverses this once: most-recently-ingested first, oldest last.
      expect(clientProps.posts.map((p: { id: string }) => p.id)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('AC2: PostsFeedClient preserves the newest-first order through filter/search — no re-sort', () => {
    it('a filtered result set keeps the same relative order as the input', () => {
      const ReactLocal = require('react');
      const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');
      // Newest-first input order, per this story's own AC1 fix — 'zephyr'
      // appears in both, filtering must not disturb their relative order.
      const posts = [
        { ...post('newest', 'gnews'), rawPayload: { providerId: 'gnews', title: 'zephyr breaking news' } },
        post('middle', 'newswire'),
        { ...post('oldest', 'wikipedia'), rawPayload: { providerId: 'wikipedia', title: 'zephyr history article' } },
      ];
      const html = renderLocal(ReactLocal.createElement(PostsFeedClient, { posts, watchlists: [] }));
      // Structural proof: 'newest' (zephyr) renders before 'oldest' (zephyr)
      // in the raw HTML output — both match a text search for "zephyr" and
      // neither is re-sorted relative to the other.
      const newestIdx = html.indexOf('zephyr breaking news');
      const oldestIdx = html.indexOf('zephyr history article');
      expect(newestIdx).toBeGreaterThan(-1);
      expect(oldestIdx).toBeGreaterThan(-1);
      expect(newestIdx).toBeLessThan(oldestIdx);
    });

    it('rewritten 2026-08-18 (Story 6.26 — see that story\'s own dated note): the post list itself is never re-sorted — order is inherited entirely from the posts prop', () => {
      // Story 6.26 added a real, legitimate .sort() to this file — but it
      // sorts providerOptions (the Provider filter's own dropdown entries,
      // alphabetically by label), a completely different array from the
      // post list this AC actually cares about. The original blanket "no
      // .sort() anywhere in this file" check was too broad; narrowed here
      // to what this story's own intent actually is — filteredPosts/
      // visiblePosts (the post-list derivation) contains no .sort() call of
      // its own, checked by name rather than forbidding the token globally.
      const source = readSrc(...clientPath);
      const filteredPostsBlock = source.match(/const filteredPosts = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/);
      expect(filteredPostsBlock).not.toBeNull();
      expect(filteredPostsBlock![0]).not.toMatch(/\.sort\(/);
    });
  });

  describe('Regression: Story 6.18 full-set search/filter behavior is unaffected by this order-only change', () => {
    it('page.tsx still pages through every real GET /v1/posts page until exhausted (no fewer posts fetched)', async () => {
      const requestedUrls: string[] = [];
      const Page = await renderPageAs('../../src/app/tenant/posts/page', (url) => {
        requestedUrls.push(url);
        if (url.includes('/v1/posts')) {
          if (!url.includes('cursor=')) {
            return new Response(JSON.stringify({ posts: [post('a', 'gnews')], nextCursor: 'page-2' }), { status: 200 });
          }
          return new Response(JSON.stringify({ posts: [post('b', 'newswire')], nextCursor: null }), { status: 200 });
        }
        return new Response(JSON.stringify({ watchlists: [] }), { status: 200 });
      });

      const element = await Page({});
      const postsUrls = requestedUrls.filter((u) => u.includes('/v1/posts'));
      expect(postsUrls).toHaveLength(2);
      expect(element.props.children.props.posts).toHaveLength(2);
    });

    it('the post detail Slideover, enrichment display, and empty-state components are all still present in source', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/Slideover/);
      expect(source).toMatch(/EmptyState/);
      expect(source).toMatch(/RunEnrichmentButton/);
    });
  });
});
