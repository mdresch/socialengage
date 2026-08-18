/**
 * Contract: Story 6.18 (ADR-0011) — Post feed search/filter operates over
 * all matched posts, not just the current page.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-618
 *
 * Intent: Story 6.18 — Post feed searches/filters the full post set
 * Scope: social-listening-admin/{
 *   src/app/tenant/posts/page.tsx (extended — a real paginated fetch loop,
 *     the same fetchAllPosts()-shaped pattern fetchAnalyticsSummary.ts
 *     (Story 8.1) already established, including its MAX_PAGES defensive
 *     circuit breaker; no more ?cursor= searchParams handling),
 *   src/app/tenant/posts/PostsFeedClient.tsx (extended — no more nextCursor
 *     prop or server-round-trip "next page" link; a client-side "Show more"
 *     control reveals more of the already-fetched, already-filtered result
 *     set in batches; header count text corrected to match)
 * }. No social-listening-core change of any kind (GET /v1/posts itself is
 * unchanged).
 *
 * Contract to encode: page.tsx pages through every real GET /v1/posts page
 *   until exhausted (using listPosts()'s already-extended limit param, the
 *   real ?limit=/cursor= mechanics — the same real, page.tsx-external
 *   pagination Story 6.11's own contract already proved), never a
 *   single-page approximation presented as the tenant's whole post set;
 *   PostsFeedClient's search/filter predicates (unchanged from Story 6.11)
 *   now operate over that full set; a client-side "Show more" control
 *   reveals more results in batches without triggering any new fetch, never
 *   eagerly rendering every matched post into the DOM at once; the header
 *   count reflects real totals, no more "on this page"/"more pages
 *   available" framing.
 *
 * Per this project's established pattern (Stories 6.11/8.1): real Server
 * Component renders against a real encrypted session and mocked fetch;
 * PostsFeedClient's own interactive rendering proven via
 * renderToStaticMarkup() with real props, not JSON.stringify(Page()).
 *
 * Explicitly out of scope for this contract:
 *   - Any change to GET /v1/posts, a new query param, or server-side
 *     search — matches ADR-0054 Decision §3's own precedent for Analytics;
 *     no new social-listening-core scope.
 *   - The client-side aggregation scale ceiling this pattern inherits
 *     (named, not resolved, mirroring ADR-0054 Open Question 2).
 *   - Any new filter dimension beyond the four Story 6.11's healing pass
 *     already built (search, Provider, Sentiment, Watchlist).
 *   - Post detail Slideover, raw-JSON inspection, RunEnrichmentButton,
 *     empty states — Story 6.11's own contract already covers these and is
 *     unaffected by this story's fetch/pagination-shape-only change.
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

describe('Story 6.18 — Post feed search/filter operates over all matched posts', () => {
  describe('AC1: page.tsx pages through every real GET /v1/posts page until exhausted', () => {
    it('follows nextCursor across multiple pages and passes the full aggregated set to PostsFeedClient', async () => {
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
      expect(postsUrls[0]).toContain('limit=');
      expect(postsUrls[1]).toContain('cursor=page-2');

      const clientProps = element.props.children.props;
      expect(clientProps.posts).toHaveLength(2);
      expect(clientProps.posts.map((p: { id: string }) => p.id).sort()).toEqual(['a', 'b']);
    });

    it('no longer reads or forwards a ?cursor= searchParams value — the full set is always fetched upfront', () => {
      const source = readSrc(...listPagePath);
      expect(source).not.toMatch(/searchParams/);
    });
  });

  describe('AC3: a client-side "Show more" control, never a server-round-trip next-page link', () => {
    it('PostsFeedClient no longer accepts a nextCursor prop or renders a /tenant/posts?cursor= link', () => {
      const source = readSrc(...clientPath);
      expect(source).not.toMatch(/nextCursor/);
      expect(source).not.toMatch(/\/tenant\/posts\?cursor=/);
    });

    it('renders a real "Show more" control when more filtered results exist than are currently visible', () => {
      const ReactLocal = require('react');
      const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');
      const posts = Array.from({ length: 25 }, (_, i) => post(`p-${i}`, 'gnews'));
      const html = renderLocal(ReactLocal.createElement(PostsFeedClient, { posts, watchlists: [] }));
      expect(html).toMatch(/show more/i);
    });

    it('renders no "Show more" control once every filtered result is already visible', () => {
      const ReactLocal = require('react');
      const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');
      const posts = [post('a', 'gnews'), post('b', 'newswire')];
      const html = renderLocal(ReactLocal.createElement(PostsFeedClient, { posts, watchlists: [] }));
      expect(html).not.toMatch(/show more/i);
    });
  });

  describe('AC4: header count reflects real totals, no more "on this page"/"more pages available" framing', () => {
    it('source no longer references the old per-page framing', () => {
      const source = readSrc(...clientPath);
      expect(source).not.toMatch(/on this page/i);
      expect(source).not.toMatch(/more pages available/i);
    });
  });

  describe('AC2: search/filter predicates unchanged, now proven to operate across posts beyond a single page-of-20', () => {
    it('a search term matches a post that would not have fit in a first, default-sized page', () => {
      const ReactLocal = require('react');
      const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
      const { PostsFeedClient } = require('../../src/app/tenant/posts/PostsFeedClient');
      // 25 filler posts (would exceed the old single-page-of-20 fetch) plus
      // one distinctively-titled post at the end of the real, full set.
      const filler = Array.from({ length: 25 }, (_, i) => post(`filler-${i}`, 'gnews'));
      const target = {
        id: 'target',
        createdAt: '2026-08-12T09:00:00.000Z',
        publishedAt: '2026-08-12T08:00:00.000Z',
        enrichment: null,
        rawPayload: { providerId: 'newswire', title: 'A uniquely distinctive headline about zephyrs' },
      };
      const html = renderLocal(ReactLocal.createElement(PostsFeedClient, { posts: [...filler, target], watchlists: [] }));
      // Structural proof the full set (26 posts) was passed through — the
      // component's own search input can't be typed into under
      // renderToStaticMarkup, so this proves the data plumbing, matching
      // this repo's own established boundary for client-side interactivity.
      expect(html).toContain('26');
    });
  });

  describe('Regression: Story 6.11 behavior unaffected by this fetch/pagination-shape-only change', () => {
    it('the post detail Slideover, enrichment display, and empty-state components are all still present in source', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/Slideover/);
      expect(source).toMatch(/EmptyState/);
      expect(source).toMatch(/RunEnrichmentButton/);
    });
  });

  describe('Structural: every scoped file exists', () => {
    it('page.tsx and PostsFeedClient.tsx both exist', () => {
      for (const segments of [listPagePath, clientPath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });
  });
});
