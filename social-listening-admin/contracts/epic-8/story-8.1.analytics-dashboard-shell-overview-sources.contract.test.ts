/**
 * Contract: Story 8.1 (ADR-0054) — Analytics dashboard shell, global
 * date-range filter, Overview tab, Sources tab.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-81
 *
 * Intent: Story 8.1 — Analytics dashboard shell, global date-range filter,
 *   Overview tab, Sources tab
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — listPosts() gains an optional
 *     `limit` param, the real, already-server-supported GET /v1/posts
 *     ?limit= query param),
 *   src/app/tenant/analytics/analyticsData.ts (new — pure date-filter and
 *     aggregation functions, no next/* import),
 *   src/app/tenant/analytics/fetchAnalyticsSummary.ts (new — the real,
 *     safety-capped pagination loop over GET /v1/posts),
 *   src/app/tenant/analytics/page.tsx (new),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (new),
 *   src/app/tenant/analytics/OverviewTab.tsx (new),
 *   src/app/tenant/analytics/SourcesTab.tsx (new),
 *   src/app/api/analytics/summary/route.ts (new — same-origin proxy for
 *     client-triggered re-fetches),
 *   src/components/shell/AppSidebar.tsx (extended — one new nav item),
 *   src/app/globals.css (extended — new an-* CSS block)
 * }.
 *
 * Contract to encode: a `/tenant/analytics` screen, gated on the tenant
 *   shell like every other tenant screen (Story 6.2), rendering a 4-tab
 *   shell (Overview, Sentiment, Conversations, Sources — explicitly no
 *   Location tab, ADR-0054 Decision §4) with `?tab=` reflecting the active
 *   tab. The real GlobalDateRangePicker.tsx (already drafted, confirmed
 *   non-fabricated per ADR-0054) drives a real fetch-and-aggregate loop
 *   over GET /v1/posts (paginated via the real, already-supported
 *   ?limit= param, cursored via nextCursor until exhausted or a defensive
 *   500-page safety cap) — no server-side date filter exists, so every
 *   aggregate is computed client-side (in social-listening-admin, per
 *   ADR-0054 Decision §3) from the full fetched set, filtered by
 *   publishedAt. Overview renders total matched posts, a compact sentiment
 *   split, and a compact source breakdown — introducing no aggregation of
 *   its own beyond what Sources already defines (AC7). Sources renders
 *   real per-providerId volume/sentiment for exactly the providers actually
 *   present in the fetched data (this project's real roster — gnews,
 *   newswire, tenant-owned-feed — never a padded/placeholder list). Zero
 *   matched posts renders EmptyState on both tabs, never a fabricated
 *   sample dataset. Nothing in this story's own code path imports the
 *   dead, already-committed src/lib/mockData.ts/types.ts (ADR-0054 Open
 *   Question 4).
 *
 * Per this project's own "string-containment checks are not sufficient"
 * correction lesson (cited in story-6.11's own docblock): behavioral
 * assertions below traverse the real, unstringified React element tree
 * Page() returns (props are real data, not yet rendered by any renderer,
 * so `.props` access is exact — more precise than the JSON.stringify+
 * toContain pattern this project used earlier) and invoke the real GET
 * route handler / pure aggregation functions directly. Structural
 * (source-string) checks are used only for genuinely structural claims:
 * client-side-only interactive wiring this repo has no DOM-interaction
 * test runner for yet (no @testing-library/react in package.json — the
 * same boundary story-6.12's own contract already accepted for
 * TenantOwnedFeedSetup.tsx's router.replace() call), file existence, and
 * absence of a forbidden import.
 *
 * Explicitly out of scope for this contract:
 *   - Sentiment tab and Conversations tab real content (Stories 8.2/8.3) —
 *     AnalyticsClient.tsx renders an honest "not built yet" notice for
 *     both; this contract only proves that notice exists, not any real
 *     widget behind it.
 *   - The Location tab (ADR-0054 Decision §4, no story in this epic).
 *   - Re-proving GET /v1/posts's own cursor-pagination/RLS correctness —
 *     Story 3.4's contract already proves that; this contract only proves
 *     the admin UI pages through it correctly and aggregates what it
 *     returns.
 *   - Per-widget export, any change to social-listening-core.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'analytics', 'page.tsx'];
const clientPath = ['app', 'tenant', 'analytics', 'AnalyticsClient.tsx'];
const overviewPath = ['app', 'tenant', 'analytics', 'OverviewTab.tsx'];
const sourcesPath = ['app', 'tenant', 'analytics', 'SourcesTab.tsx'];
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const fetchSummaryPath = ['app', 'tenant', 'analytics', 'fetchAnalyticsSummary.ts'];
const summaryRoutePath = ['app', 'api', 'analytics', 'summary', 'route.ts'];
const sidebarPath = ['components', 'shell', 'AppSidebar.tsx'];
const locationTabPath = ['app', 'tenant', 'analytics', 'LocationDashboardTab.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

async function renderPageAs(
  modulePath: string,
  fetchImpl: (url: string) => Response,
  identity: unknown = TENANT_USER
) {
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

function post(id: string, providerId: string, publishedAt: string | null, sentiment: string | null) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases: [], entities: [] } : null,
    rawPayload: { providerId, title: `Post ${id}` },
  };
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 8.1 — Analytics dashboard shell, global date-range filter, Overview tab, Sources tab', () => {
  describe('analyticsData.ts — pure aggregation (unit)', () => {
    it('excludes posts with no publishedAt from a date-ranged filter, never coerced into range', async () => {
      const { filterPostsByDateRange } = await import('../../src/app/tenant/analytics/analyticsData');
      const posts = [
        post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive'),
        post('b', 'gnews', null, 'positive'),
        post('c', 'gnews', '2026-07-01T00:00:00.000Z', 'positive'),
      ];
      const filtered = filterPostsByDateRange(posts, { startDate: '2026-08-01', endDate: '2026-08-31' });
      expect(filtered.map((p) => p.id)).toEqual(['a']);
    });

    it('computeSentimentSplit counts only recognized sentiments, never defaults an unenriched post to neutral', async () => {
      const { computeSentimentSplit } = await import('../../src/app/tenant/analytics/analyticsData');
      const posts = [
        post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive'),
        post('b', 'gnews', '2026-08-05T00:00:00.000Z', 'negative'),
        post('c', 'gnews', '2026-08-05T00:00:00.000Z', null),
      ];
      expect(computeSentimentSplit(posts)).toEqual({ positive: 1, neutral: 0, negative: 1 });
    });

    it('computeSourceBreakdown groups by real providerId, no padded/placeholder rows for an absent connector', async () => {
      const { computeSourceBreakdown } = await import('../../src/app/tenant/analytics/analyticsData');
      const posts = [
        post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive'),
        post('b', 'gnews', '2026-08-06T00:00:00.000Z', 'negative'),
        post('c', 'newswire', '2026-08-05T00:00:00.000Z', 'positive'),
      ];
      const breakdown = computeSourceBreakdown(posts);
      expect(breakdown).toHaveLength(2);
      const gnews = breakdown.find((b) => b.providerId === 'gnews');
      expect(gnews).toMatchObject({ label: 'GNews', count: 2, sentiment: { positive: 1, neutral: 0, negative: 1 } });
      expect(breakdown.find((b) => b.providerId === 'tenant-owned-feed')).toBeUndefined();
    });

    it('computeAnalyticsSummary composes filter + both aggregations from one date-ranged post set', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const posts = [
        post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive'),
        post('b', 'newswire', '2026-07-01T00:00:00.000Z', 'positive'), // out of range
      ];
      const summary = computeAnalyticsSummary(posts, { startDate: '2026-08-01', endDate: '2026-08-31' });
      expect(summary.totalPosts).toBe(1);
      expect(summary.sentimentSplit).toEqual({ positive: 1, neutral: 0, negative: 0 });
      expect(summary.sources).toEqual([{ providerId: 'gnews', label: 'GNews', count: 1, sentiment: { positive: 1, neutral: 0, negative: 0 } }]);
    });
  });

  describe('AC5: fetchAnalyticsSummary() pages through every real GET /v1/posts page until exhausted', () => {
    it('follows nextCursor across multiple pages and aggregates the full set, using the real ?limit= param', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));

      const requestedUrls: string[] = [];
      jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestedUrls.push(url);
        if (!url.includes('cursor=')) {
          return new Response(
            JSON.stringify({ posts: [post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive')], nextCursor: 'page-2' }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ posts: [post('b', 'newswire', '2026-08-06T00:00:00.000Z', 'negative')], nextCursor: null }),
          { status: 200 }
        );
      });

      const { fetchAnalyticsSummary } = await import('../../src/app/tenant/analytics/fetchAnalyticsSummary');
      const summary = await fetchAnalyticsSummary({ startDate: '2026-08-01', endDate: '2026-08-31' });

      expect(requestedUrls).toHaveLength(2);
      expect(requestedUrls[0]).toContain('limit=100');
      expect(requestedUrls[1]).toContain('cursor=page-2');
      expect(summary.totalPosts).toBe(2);
      expect(summary.sources.map((s) => s.providerId).sort()).toEqual(['gnews', 'newswire']);
    });
  });

  describe('core-client.ts: listPosts() gains an optional limit param, real GET /v1/posts?limit=', () => {
    it('forwards limit as a real query param, unchanged first-page behavior when omitted', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async () => new Response(JSON.stringify({ posts: [], nextCursor: null }), { status: 200 }));

      const { listPosts } = await import('../../src/lib/core-client');
      await listPosts(undefined, 100);
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('limit=100'), expect.anything());
      expect((fetchSpy.mock.calls[0][0] as string)).not.toContain('cursor=');

      await listPosts();
      expect((fetchSpy.mock.calls[1][0] as string)).not.toContain('limit=');
      expect((fetchSpy.mock.calls[1][0] as string)).not.toContain('cursor=');
    });
  });

  describe('AC1/AC2: the /tenant/analytics screen — gated, 4-tab shell, no Location tab', () => {
    it('creates the route, client shell, both tab components, the pure aggregation module, and the fetch loop', () => {
      for (const segments of [pagePath, clientPath, overviewPath, sourcesPath, analyticsDataPath, fetchSummaryPath, summaryRoutePath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });

    it('gates on the tenant shell like every other tenant screen (Story 6.2)', () => {
      expect(readSrc(...pagePath)).toContain("isShellAllowed(identity, 'tenant')");
    });

    it('the real Page() render passes the real, computed AnalyticsSummary and resolved initial tab to AnalyticsClient', async () => {
      const Page = await renderPageAs('../../src/app/tenant/analytics/page', () =>
        new Response(
          JSON.stringify({ posts: [post('a', 'gnews', new Date().toISOString(), 'positive')], nextCursor: null }),
          { status: 200 }
        )
      );

      const element = await Page({ searchParams: Promise.resolve({ tab: 'sources' }) });
      const clientElement = element.props.children;
      expect(clientElement.props.initialTab).toBe('sources');
      expect(clientElement.props.initialSummary.totalPosts).toBe(1);
      expect(clientElement.props.initialSummary.sources).toEqual([
        { providerId: 'gnews', label: 'GNews', count: 1, sentiment: { positive: 1, neutral: 0, negative: 0 } },
      ]);
    });

    it('an unrecognized ?tab= value falls back to overview, never crashes', async () => {
      const Page = await renderPageAs('../../src/app/tenant/analytics/page', () =>
        new Response(JSON.stringify({ posts: [], nextCursor: null }), { status: 200 })
      );
      const element = await Page({ searchParams: Promise.resolve({ tab: 'location' }) });
      expect(element.props.children.props.initialTab).toBe('overview');
    });

    it('AnalyticsClient.tsx defines all four real tabs and structurally excludes a Location tab', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/id:\s*'overview'/);
      expect(source).toMatch(/id:\s*'sentiment'/);
      expect(source).toMatch(/id:\s*'conversations'/);
      expect(source).toMatch(/id:\s*'sources'/);
      expect(source.toLowerCase()).not.toContain('location');
    });

    it('AnalyticsClient.tsx reflects the active tab in a real ?tab= query-string update', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/router\.replace\(`\?tab=\$\{tab\}`\)/);
    });

    it('AnalyticsClient.tsx wires the real GlobalDateRangePicker to a real re-fetch of /api/analytics/summary', () => {
      const source = readSrc(...clientPath);
      expect(source).toContain('GlobalDateRangePicker');
      expect(source).toContain('/api/analytics/summary');
    });

    // 2026-08-17 (Story 8.2, then Story 8.3, both built same day): this
    // test originally asserted "not built yet" stub text for Sentiment and
    // Conversations — this epic's own text always scoped both tabs' real
    // content out of Story 8.1 specifically because they belonged to
    // Stories 8.2/8.3 (docs/user-stories/epic-8-analytics-dashboard.md), an
    // anticipated in-epic handoff, not a foreign regression each time. Both
    // stubs are now correctly gone — see each story's own dated note in
    // docs/implementation-log.md. Retired: this test has no remaining stub
    // to check; AnalyticsClient.tsx's real wiring of all four tabs is
    // proven directly by each tab's own contract (story-8.1's own Overview/
    // Sources checks above, story-8.2.sentiment-tab, story-8.3.conversations-tab).

    it('the sidebar gains a real Analytics nav item', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { AppSidebar } = require('../../src/components/shell/AppSidebar');
      const html = renderToStaticMarkup(
        React.createElement(AppSidebar, { shellType: 'tenant', identity: TENANT_USER })
      );
      expect(html).toContain('href="/tenant/analytics"');
      expect(html).toContain('Analytics');
    });
  });

  describe('AC7/AC9: Overview tab — total, compact sentiment split, compact source breakdown; honest empty state', () => {
    it('renders real totals, split, and source rows from a real AnalyticsSummary, no widget of its own beyond that', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { OverviewTab } = require('../../src/app/tenant/analytics/OverviewTab');
      const summary = {
        totalPosts: 3,
        sentimentSplit: { positive: 2, neutral: 0, negative: 1 },
        sources: [{ providerId: 'gnews', label: 'GNews', count: 3, sentiment: { positive: 2, neutral: 0, negative: 1 } }],
      };
      const html = renderToStaticMarkup(React.createElement(OverviewTab, { summary }));
      expect(html).toContain('3');
      expect(html).toContain('2 positive');
      expect(html).toContain('1 negative');
      expect(html).toContain('GNews');
    });

    it('renders EmptyState, not a fabricated sample, when zero posts match the range', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { OverviewTab } = require('../../src/app/tenant/analytics/OverviewTab');
      const summary = { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [] };
      const html = renderToStaticMarkup(React.createElement(OverviewTab, { summary }));
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  describe('AC8/AC9: Sources tab — real per-providerId volume/sentiment; honest empty state', () => {
    it('renders only providers actually present, with real counts and sentiment splits', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { SourcesTab } = require('../../src/app/tenant/analytics/SourcesTab');
      const summary = {
        totalPosts: 2,
        sentimentSplit: { positive: 1, neutral: 0, negative: 1 },
        sources: [
          { providerId: 'gnews', label: 'GNews', count: 1, sentiment: { positive: 1, neutral: 0, negative: 0 } },
          { providerId: 'newswire', label: 'Newswire', count: 1, sentiment: { positive: 0, neutral: 0, negative: 1 } },
        ],
      };
      const html = renderToStaticMarkup(React.createElement(SourcesTab, { summary }));
      expect(html).toContain('GNews');
      expect(html).toContain('Newswire');
      expect(html).not.toContain('LinkedIn');
      expect(html).not.toContain('Twitter');
    });

    it('renders EmptyState when no source has any matched posts', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { SourcesTab } = require('../../src/app/tenant/analytics/SourcesTab');
      const summary = { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [] };
      const html = renderToStaticMarkup(React.createElement(SourcesTab, { summary }));
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  describe('AC3/AC5: /api/analytics/summary — the real proxy route driving GlobalDateRangePicker re-fetches', () => {
    it('400s when startDate/endDate are missing, rather than guessing a default silently', async () => {
      jest.resetModules();
      const { GET } = await import('../../src/app/api/analytics/summary/route');
      const response = await GET(new Request('http://localhost/api/analytics/summary'));
      expect(response.status).toBe(400);
    });

    it('paginates the real GET /v1/posts and returns a real, computed AnalyticsSummary for the requested range', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ posts: [post('a', 'gnews', '2026-08-05T00:00:00.000Z', 'positive')], nextCursor: null }),
          { status: 200 }
        )
      );

      const { GET } = await import('../../src/app/api/analytics/summary/route');
      const response = await GET(
        new Request('http://localhost/api/analytics/summary?startDate=2026-08-01&endDate=2026-08-31')
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      // 2026-08-17, Story 8.4: the route's response shape genuinely changed
      // from a bare AnalyticsSummary to { current, previous } (previous:
      // null unless ?compare=true is passed) — a deliberate, in-scope change
      // documented in Story 8.4's own AC and analytics-dashboard/SKILL.md,
      // not a foreign regression. Narrowed to read body.current, same as
      // Story 8.2/8.3's own precedent for an anticipated in-epic handoff
      // against this same contract.
      expect(body.current.totalPosts).toBe(1);
      expect(body.current.sources[0].providerId).toBe('gnews');
      expect(body.previous).toBeNull();
    });

    it('degrades to a real 502, not a crash, when GET /v1/posts itself fails', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));

      const { GET } = await import('../../src/app/api/analytics/summary/route');
      const response = await GET(
        new Request('http://localhost/api/analytics/summary?startDate=2026-08-01&endDate=2026-08-31')
      );
      expect(response.status).toBe(502);
    });
  });

  describe('ADR-0054 Decision §4: the Location tab is not built, its dead prototype file is gone', () => {
    it('LocationDashboardTab.tsx no longer exists — nothing owns fixing a permanently-unused, non-compiling file', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...locationTabPath))).toBe(false);
    });
  });

  describe('ADR-0054 Open Question 4: no dependency on the dead src/lib/mockData.ts / src/lib/types.ts', () => {
    it('no file under src/app/tenant/analytics or src/app/api/analytics imports either module', () => {
      const dirs = [
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics'),
        path.join(ADMIN_ROOT, 'src', 'app', 'api', 'analytics'),
      ];
      const offenders: string[] = [];
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const walk = (d: string) => {
          for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
              walk(full);
              continue;
            }
            if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
            const content = fs.readFileSync(full, 'utf8');
            if (/from ['"].*lib\/(mockData|types)['"]/.test(content) || /require\(['"].*lib\/(mockData|types)['"]\)/.test(content)) {
              offenders.push(full);
            }
          }
        };
        walk(dir);
      }
      expect(offenders).toEqual([]);
    });
  });

  it('documents this component in a SKILL.md', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'analytics-dashboard', 'SKILL.md'))).toBe(true);
  });
});
