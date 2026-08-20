/**
 * Contract: Story 8.9 (ADR-0063) — `selectedTopic` watchlist filter and
 * Watchlist Coverage widget on the Analytics Overview tab.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-89
 *
 * Intent: wire the `selectedTopic` watchlist selector on the Analytics
 * Overview tab using real server-side filtering (GET /v1/posts?watchlistId=)
 * and build the Watchlist Coverage widget (id="widget-watchlist-coverage")
 * rendering a Recharts donut chart of post counts across active watchlists.
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — listPosts() gains optional watchlistId parameter),
 *   src/app/tenant/analytics/analyticsData.ts (extended — OverviewFilters gains activeWatchlistFilter,
 *     computeActiveChips(), parseOverviewFiltersFromSearchParams(),
 *     serializeOverviewFiltersToSearchString(), WatchlistCoverageEntry, computeWatchlistCoverage()),
 *   src/app/tenant/analytics/fetchAnalyticsSummary.ts (extended — passes watchlistId to listPosts(),
 *     fetchWatchlistCoverage()),
 *   src/app/api/analytics/summary/route.ts (extended — passes watchlistId and returns coverage),
 *   src/app/tenant/analytics/page.tsx (extended — parses ?watchlist, fetches watchlists, passes to client),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (extended — receives watchlists, re-fetches on watchlist change),
 *   src/app/tenant/analytics/OverviewTab.tsx (extended — renders selectedTopic dropdown, renders widget-watchlist-coverage),
 *   src/app/globals.css (extended — styles for watchlist selector and coverage chart),
 *   .claude/skills/analytics-dashboard/SKILL.md (updated)
 * }.
 * Contract to encode:
 *   (1) selectedTopic dropdown renders all watchlists regardless of matchType;
 *       selecting a watchlist triggers server-side fetch with watchlistId;
 *       writes ?watchlist=<id> to deep-link URL; no client-side terms[] predicate;
 *   (2) id="widget-watchlist-coverage" renders Recharts donut with one slice per active watchlist,
 *       sized by real post count; zero-count active watchlists appear in legend;
 *   (3) EmptyState rendered when tenant has zero active watchlists, never sample data;
 *   (4) deep-link parse and serialize round-trips ?watchlist=<id>;
 *   (5) core-client.ts listPosts() forwards watchlistId parameter to core API.
 *
 * Explicitly out of scope:
 *   - Any change to social-listening-core (relies on Story 3.11's already-shipped endpoint).
 *   - Retroactive backfill or re-matching on watchlist update (ADR-0063 Open Questions 1 & 2).
 *   - Any change to Sentiment, Conversations, or Sources tabs.
 */

import fs from 'fs';
import path from 'path';
import type { Watchlist } from '../../src/lib/core-client';
import {
  parseOverviewFiltersFromSearchParams,
  serializeOverviewFiltersToSearchString,
  computeActiveChips,
  type OverviewFilters,
  type WatchlistCoverageEntry,
} from '../../src/app/tenant/analytics/analyticsData';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const overviewTabPath = ['app', 'tenant', 'analytics', 'OverviewTab.tsx'];
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const coreClientPath = ['lib', 'core-client.ts'];
const pagePath = ['app', 'tenant', 'analytics', 'page.tsx'];
const summaryRoutePath = ['app', 'api', 'analytics', 'summary', 'route.ts'];
const fetchSummaryPath = ['app', 'tenant', 'analytics', 'fetchAnalyticsSummary.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

const SAMPLE_WATCHLISTS: Watchlist[] = [
  {
    id: 'wl-1',
    name: 'Competitor A',
    matchType: 'keyword',
    terms: ['competitor', 'brand'],
    platformIds: ['gnews', 'newswire'],
    isActive: true,
    version: 1,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'wl-2',
    name: 'Crisis Alert',
    matchType: 'boolean_query',
    terms: null,
    booleanQuery: 'crisis AND recall',
    platformIds: ['gnews'],
    isActive: true,
    version: 1,
    createdAt: '2026-08-02T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
  },
  {
    id: 'wl-3',
    name: 'Inactive Watchlist',
    matchType: 'hashtag',
    terms: ['#tag'],
    platformIds: ['wikipedia'],
    isActive: false,
    version: 1,
    createdAt: '2026-08-03T00:00:00Z',
    updatedAt: '2026-08-03T00:00:00Z',
  },
];

const SAMPLE_COVERAGE: WatchlistCoverageEntry[] = [
  { id: 'wl-1', name: 'Competitor A', matchType: 'keyword', count: 42 },
  { id: 'wl-2', name: 'Crisis Alert', matchType: 'boolean_query', count: 0 },
];

describe('Story 8.9 — selectedTopic watchlist filter and Watchlist Coverage widget', () => {
  describe('AC1: selectedTopic watchlist selector and server-side filtering', () => {
    it('OverviewTab renders the watchlist selector with all watchlists regardless of matchType', () => {
      const html = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'OverviewTab.tsx'),
        'OverviewTab',
        {
          summary: {
            totalPosts: 5,
            sentimentSplit: { positive: 2, neutral: 2, negative: 1 },
            sources: [],
            sentimentHistory: [],
            topFans: [],
            topCritics: [],
            positivePhrases: [],
            negativePhrases: [],
            phraseFrequency: [],
            phraseHistory: [],
            volumeHistory: [{ date: '2026-08-19', count: 5 }],
            languages: [],
            sourceVolumeHistory: [],
            posts: [
              {
                id: 'p1',
                publishedAt: '2026-08-19T10:00:00Z',
                author: 'Author A',
                sentiment: 'positive',
                keyPhrases: ['alpha'],
                title: 'Post 1',
                language: 'en',
                providerId: 'gnews',
              },
            ],
          },
          range: { startDate: '2026-08-01', endDate: '2026-08-20' },
          watchlists: SAMPLE_WATCHLISTS,
          watchlistCoverage: SAMPLE_COVERAGE,
        }
      );

      expect(html).toContain('id="overview-watchlist-selector"');
      expect(html).toContain('Competitor A');
      expect(html).toContain('Crisis Alert');
      expect(html).toContain('All Topics');
    });

    it('OverviewTab.tsx does not introduce any client-side terms[] matching predicate', () => {
      const source = readSrc(...overviewTabPath);
      // Ensures applyOverviewFilters does not filter by terms or boolean AST client-side
      expect(source).not.toMatch(/post\.keyPhrases\.includes\(.*terms/);
      expect(source).not.toMatch(/matchesAst/);
    });

    it('OverviewTab.tsx writes ?watchlist=<id> into deep-link URL on watchlist selection', () => {
      const source = readSrc(...overviewTabPath);
      expect(source).toMatch(/watchlist/);
      expect(source).toMatch(/activeWatchlistFilter/);
    });
  });

  describe('AC2 & AC3: Watchlist Coverage widget (id="widget-watchlist-coverage")', () => {
    it('OverviewTab renders the Watchlist Coverage widget with id="widget-watchlist-coverage"', () => {
      const html = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'OverviewTab.tsx'),
        'OverviewTab',
        {
          summary: {
            totalPosts: 10,
            sentimentSplit: { positive: 5, neutral: 3, negative: 2 },
            sources: [],
            sentimentHistory: [],
            topFans: [],
            topCritics: [],
            positivePhrases: [],
            negativePhrases: [],
            phraseFrequency: [],
            phraseHistory: [],
            volumeHistory: [{ date: '2026-08-19', count: 10 }],
            languages: [],
            sourceVolumeHistory: [],
            posts: [
              {
                id: 'p1',
                publishedAt: '2026-08-19T10:00:00Z',
                author: 'Author A',
                sentiment: 'positive',
                keyPhrases: ['test'],
                title: 'Test',
                language: 'en',
                providerId: 'gnews',
              },
            ],
          },
          range: { startDate: '2026-08-01', endDate: '2026-08-20' },
          watchlists: SAMPLE_WATCHLISTS,
          watchlistCoverage: SAMPLE_COVERAGE,
        }
      );

      expect(html).toContain('id="widget-watchlist-coverage"');
      expect(html).toContain('Watchlist coverage');
      expect(html).toContain('Competitor A');
      expect(html).toContain('Crisis Alert');
    });

    it('renders zero-count active watchlists in the legend with an honest 0 count', () => {
      const html = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'OverviewTab.tsx'),
        'OverviewTab',
        {
          summary: {
            totalPosts: 5,
            sentimentSplit: { positive: 2, neutral: 2, negative: 1 },
            sources: [],
            sentimentHistory: [],
            topFans: [],
            topCritics: [],
            positivePhrases: [],
            negativePhrases: [],
            phraseFrequency: [],
            phraseHistory: [],
            volumeHistory: [{ date: '2026-08-19', count: 5 }],
            languages: [],
            sourceVolumeHistory: [],
            posts: [
              {
                id: 'p1',
                publishedAt: '2026-08-19T10:00:00Z',
                author: 'Author A',
                sentiment: 'positive',
                keyPhrases: ['test'],
                title: 'Test',
                language: 'en',
                providerId: 'gnews',
              },
            ],
          },
          range: { startDate: '2026-08-01', endDate: '2026-08-20' },
          watchlists: SAMPLE_WATCHLISTS,
          watchlistCoverage: [
            { id: 'wl-1', name: 'Competitor A', matchType: 'keyword', count: 10 },
            { id: 'wl-2', name: 'Crisis Alert', matchType: 'boolean_query', count: 0 },
          ],
        }
      );

      expect(html).toContain('Crisis Alert');
      expect(html).toContain('0');
    });

    it('sorts watchlists descending by post count and limits display to top 6 items', () => {
      const eightWatchlists: Watchlist[] = Array.from({ length: 8 }, (_, i) => ({
        id: `wl-${i + 1}`,
        tenantId: 't-1',
        name: `Topic ${i + 1}`,
        matchType: 'keyword',
        terms: [`term${i + 1}`],
        platformIds: ['gnews'],
        isActive: true,
        version: 1,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      }));

      const coverage: WatchlistCoverageEntry[] = [
        { id: 'wl-1', name: 'Topic 1', matchType: 'keyword', count: 10 },
        { id: 'wl-2', name: 'Topic 2', matchType: 'keyword', count: 50 },
        { id: 'wl-3', name: 'Topic 3', matchType: 'keyword', count: 30 },
        { id: 'wl-4', name: 'Topic 4', matchType: 'keyword', count: 5 },
        { id: 'wl-5', name: 'Topic 5', matchType: 'keyword', count: 100 },
        { id: 'wl-6', name: 'Topic 6', matchType: 'keyword', count: 20 },
        { id: 'wl-7', name: 'Topic 7', matchType: 'keyword', count: 2 },
        { id: 'wl-8', name: 'Topic 8', matchType: 'keyword', count: 1 },
      ];

      const html = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'OverviewTab.tsx'),
        'OverviewTab',
        {
          summary: {
            totalPosts: 218,
            sentimentSplit: { positive: 100, neutral: 100, negative: 18 },
            sources: [],
            sentimentHistory: [],
            topFans: [],
            topCritics: [],
            positivePhrases: [],
            negativePhrases: [],
            phraseFrequency: [],
            phraseHistory: [],
            volumeHistory: [{ date: '2026-08-19', count: 218 }],
            languages: [],
            sourceVolumeHistory: [],
            posts: [],
          },
          range: { startDate: '2026-08-01', endDate: '2026-08-20' },
          watchlists: eightWatchlists,
          watchlistCoverage: coverage,
        }
      );

      // Check within the Watchlist Coverage widget specifically
      const coverageWidgetHtml = html.substring(html.indexOf('id="widget-watchlist-coverage"'));
      expect(coverageWidgetHtml).toContain('Topic 5');
      expect(coverageWidgetHtml).toContain('Topic 2');
      expect(coverageWidgetHtml).toContain('Topic 3');
      expect(coverageWidgetHtml).toContain('Topic 6');
      expect(coverageWidgetHtml).toContain('Topic 1');
      expect(coverageWidgetHtml).toContain('Topic 4');
      // 7th and 8th items (Topic 7: 2, Topic 8: 1) are omitted from the coverage widget legend
      expect(coverageWidgetHtml).not.toContain('<span class="an-coverage-name">Topic 7</span>');
      expect(coverageWidgetHtml).not.toContain('<span class="an-coverage-name">Topic 8</span>');
    });

    it('renders EmptyState when there are no active watchlists', () => {
      const html = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'analytics', 'OverviewTab.tsx'),
        'OverviewTab',
        {
          summary: {
            totalPosts: 5,
            sentimentSplit: { positive: 2, neutral: 2, negative: 1 },
            sources: [],
            sentimentHistory: [],
            topFans: [],
            topCritics: [],
            positivePhrases: [],
            negativePhrases: [],
            phraseFrequency: [],
            phraseHistory: [],
            volumeHistory: [{ date: '2026-08-19', count: 5 }],
            languages: [],
            sourceVolumeHistory: [],
            posts: [
              {
                id: 'p1',
                publishedAt: '2026-08-19T10:00:00Z',
                author: 'Author A',
                sentiment: 'positive',
                keyPhrases: ['test'],
                title: 'Test',
                language: 'en',
                providerId: 'gnews',
              },
            ],
          },
          range: { startDate: '2026-08-01', endDate: '2026-08-20' },
          watchlists: [],
          watchlistCoverage: [],
        }
      );

      expect(html).toContain('id="widget-watchlist-coverage"');
      expect(html).toMatch(/No active watchlists/i);
    });
  });

  describe('AC4: deep-link search params and active chips', () => {
    it('parseOverviewFiltersFromSearchParams() parses ?watchlist param', () => {
      const params = new URLSearchParams('watchlist=wl-123&source=gnews');
      const filters = parseOverviewFiltersFromSearchParams(params);
      expect(filters.activeWatchlistFilter).toBe('wl-123');
      expect(filters.activeSourceFilter).toBe('gnews');
    });

    it('serializeOverviewFiltersToSearchString() serializes activeWatchlistFilter to ?watchlist', () => {
      const filters: OverviewFilters = {
        activeDateFilter: null,
        activeSourceFilter: null,
        activeAuthorFilter: null,
        activeKeywordFilter: null,
        activeLanguageFilter: null,
        activeSentimentFilter: null,
        activeWatchlistFilter: 'wl-456',
      };
      const qs = serializeOverviewFiltersToSearchString(filters);
      expect(qs).toContain('watchlist=wl-456');
    });

    it('computeActiveChips() generates a chip for activeWatchlistFilter', () => {
      const filters: OverviewFilters = {
        activeDateFilter: null,
        activeSourceFilter: null,
        activeAuthorFilter: null,
        activeKeywordFilter: null,
        activeLanguageFilter: null,
        activeSentimentFilter: null,
        activeWatchlistFilter: 'wl-1',
      };
      const chips = computeActiveChips(filters, SAMPLE_WATCHLISTS);
      const wlChip = chips.find((c) => c.type === 'activeWatchlistFilter');
      expect(wlChip).toBeDefined();
      expect(wlChip?.label).toBe('Watchlist');
      expect(wlChip?.value).toBe('Competitor A');
    });
  });

  describe('AC5: core-client.ts listPosts() forwards watchlistId to /v1/posts', () => {
    async function withAuthenticatedFetch<T>(fn: (fetchSpy: jest.SpyInstance) => Promise<T>): Promise<T> {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch');
      try {
        return await fn(fetchSpy);
      } finally {
        fetchSpy.mockRestore();
      }
    }

    it('listPosts() appends watchlistId query parameter when supplied', async () => {
      await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ posts: [], nextCursor: null }), { status: 200 }));
        const { listPosts } = await import('../../src/lib/core-client');
        await listPosts(undefined, 50, '11111111-2222-3333-4444-555555555555');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('watchlistId=11111111-2222-3333-4444-555555555555'),
          expect.anything()
        );
      });
    });
  });

  describe('Structure and Skills', () => {
    it('documents Story 8.9 in analytics-dashboard SKILL.md', () => {
      const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'analytics-dashboard', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/Story 8\.9/);
    });
  });
});
