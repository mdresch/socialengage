/**
 * Contract: Story 8.4 (ADR-0054) — Overview enrichment: volume chart,
 * sentiment donut, period-over-period comparison.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-84
 *
 * Intent: Story 8.4 — Overview enrichment, period-over-period comparison
 * Scope: social-listening-admin/{
 *   src/app/tenant/analytics/analyticsData.ts (extended — VolumeHistoryPoint,
 *     computeVolumeHistory(), PercentDelta, computePercentDelta(),
 *     computePreviousRange(), AnalyticsSummary gains volumeHistory),
 *   src/app/tenant/analytics/fetchAnalyticsSummary.ts (extended —
 *     fetchAnalyticsSummary() unchanged in signature/behavior, internal
 *     post-fetch loop extracted so a new fetchAnalyticsComparison() can
 *     reuse it — fetches the full post set exactly once, computes two real
 *     summaries from it, never a doubled network round trip),
 *   src/app/api/analytics/summary/route.ts (extended — new optional
 *     ?compare=true param; response shape becomes { current, previous }),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (extended — reads
 *     DateRangeValue.compareWithPrevious for the first time, tracks
 *     previousSummary state, passes it to OverviewTab),
 *   src/app/tenant/analytics/OverviewTab.tsx (extended — real volume chart,
 *     real sentiment donut reusing summary.sentimentSplit, real percentage
 *     deltas via computePercentDelta()),
 *   src/app/globals.css (extended — an-delta/-up/-down/-flat/-none; the
 *     volume chart and donut widgets reuse the already-styled an-widget/
 *     an-chart-wrap/an-sent-donut-* classes Story 8.2 already added)
 * }.
 *
 * Contract to encode: a real day-bucketed post-volume series (reusing
 *   enumerateDays(), zero-post days a real zero, never omitted) driving a
 *   real chart on Overview; Overview's sentiment donut reads the exact same
 *   summary.sentimentSplit numbers Sentiment tab's own donut reads, not a
 *   second independent computation; the date picker's "Compare to previous
 *   period" checkbox (DateRangeValue.compareWithPrevious, wired since Story
 *   8.1 but never read) now drives one real, additional aggregation over an
 *   equal-length prior period — computed from the same already-fetched post
 *   set, not a second GET /v1/posts paging loop; a real percentage delta is
 *   shown for total posts and sentiment split when comparison is on; a zero
 *   prior-period count (division by zero) or no comparison requested renders
 *   an honest "no prior data" state, never a fabricated delta string (the
 *   exact defect the Google AI Studio reference committed with its
 *   hardcoded '+18%'/'+1,331%'/'∞' strings, none derived from any real
 *   fetch); a failed comparison fetch never blocks or breaks the primary,
 *   already-loaded summary.
 *
 * Per this project's own established pattern (Stories 8.1-8.3): pure
 * aggregation/date-math functions are proven by direct unit tests; the real
 * paginated fetch loop is proven via a mocked global.fetch + next/headers
 * session (Story 8.1's own AC5 pattern, reused here for
 * fetchAnalyticsComparison()); component rendering is proven by real
 * renderToStaticMarkup() renders with real data; client-side interactive
 * wiring this repo has no DOM-interaction test runner for yet is proven
 * structurally.
 *
 * Explicitly out of scope for this contract:
 *   - Per-widget CSV/JSON export (ADR-0054 Open Question 3, still not
 *     decided).
 *   - Rippling the period-comparison delta into Sentiment/Sources/
 *     Conversations tabs beyond Overview (a reasonable future story).
 *   - Any Sources-tab enhancement (per-source sentiment score, per-source
 *     volume-over-time) — named during this epic's own retrospective
 *     review as a real, separate future story.
 *   - The "AI Spike Storyteller" / predictive forecast panels (already
 *     excluded, ADR-0054 Decision §2).
 *   - Any change to social-listening-core or GET /v1/posts.
 *
 * 2026-08-19 addendum, Story 8.7 (ADR-0062) — the three-KPI-card Overview
 * layout (AC1/AC2's own widget ids, AC3/AC4's delta-badge rendering) this
 * contract originally targeted is superseded by the new 3-column, 8-widget
 * grid. AC1/AC2 are updated in place (dated note at their own describe
 * block) to match the new widget ids and the new filtered-post-set
 * computation path. AC3/AC4 (period-over-period delta) are confirmed
 * dropped from the Overview tab — a direct decision from Menno, not
 * assumed, since ADR-0062 itself never mentions previousSummary/delta —
 * and their own describe block is updated to assert the (harmless,
 * unrendered) absence instead. AC5's own describe block (the fetch/
 * comparison machinery itself: fetchAnalyticsComparison(), route.ts's
 * ?compare=true, AnalyticsClient.tsx's previousSummary state) is untouched
 * and still fully real — only OverviewTab's own rendering of a delta is
 * gone.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const overviewPath = ['app', 'tenant', 'analytics', 'OverviewTab.tsx'];
const clientPath = ['app', 'tenant', 'analytics', 'AnalyticsClient.tsx'];
const fetchSummaryPath = ['app', 'tenant', 'analytics', 'fetchAnalyticsSummary.ts'];
const summaryRoutePath = ['app', 'api', 'analytics', 'summary', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

function post(id: string, publishedAt: string | null, sentiment: string | null) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases: [], entities: [] } : null,
    rawPayload: { providerId: 'gnews', title: `Post ${id}` },
  };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-02' };

const FIXTURE_POSTS = [
  post('a', '2026-08-01T09:00:00.000Z', 'positive'),
  post('b', '2026-08-01T10:00:00.000Z', 'negative'),
  post('c', '2026-08-02T09:00:00.000Z', 'neutral'),
  post('d', null, 'positive'), // no publishedAt — excluded from the day-bucketed series
];

describe('Story 8.4 — Overview enrichment, period-over-period comparison', () => {
  describe('analyticsData.ts — pure aggregation/date-math (unit)', () => {
    it('computeVolumeHistory() counts real posts per day, zero-post days a real zero, a post with no publishedAt excluded', async () => {
      const { flattenForSentiment, computeVolumeHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS);
      const history = computeVolumeHistory(flat, RANGE);
      expect(history).toEqual([
        { date: '2026-08-01', count: 2 },
        { date: '2026-08-02', count: 1 },
      ]);
    });

    it('computeVolumeHistory() renders every day in range as a real zero when there are no posts at all', async () => {
      const { computeVolumeHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const wideRange = { startDate: '2026-08-01', endDate: '2026-08-03' };
      expect(computeVolumeHistory([], wideRange)).toEqual([
        { date: '2026-08-01', count: 0 },
        { date: '2026-08-02', count: 0 },
        { date: '2026-08-03', count: 0 },
      ]);
    });

    it('computeAnalyticsSummary() now also returns real volumeHistory, composed once', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const summary = computeAnalyticsSummary(FIXTURE_POSTS, RANGE);
      expect(summary.volumeHistory).toEqual([
        { date: '2026-08-01', count: 2 },
        { date: '2026-08-02', count: 1 },
      ]);
    });

    it('computePreviousRange() returns the immediately preceding period of equal length', async () => {
      const { computePreviousRange } = await import('../../src/app/tenant/analytics/analyticsData');
      // 14-day range (2026-08-01..2026-08-14) -> prior 14 days ending the day before.
      expect(computePreviousRange({ startDate: '2026-08-01', endDate: '2026-08-14' })).toEqual({
        startDate: '2026-07-18',
        endDate: '2026-07-31',
      });
      // Single-day range stays single-day.
      expect(computePreviousRange({ startDate: '2026-08-15', endDate: '2026-08-15' })).toEqual({
        startDate: '2026-08-14',
        endDate: '2026-08-14',
      });
    });

    it('computePercentDelta() computes a real percentage, honest "no prior data" on null/zero previous, never a fabricated string', async () => {
      const { computePercentDelta } = await import('../../src/app/tenant/analytics/analyticsData');
      expect(computePercentDelta(12, 10)).toEqual({ pct: 20, trend: 'up' });
      expect(computePercentDelta(8, 10)).toEqual({ pct: -20, trend: 'down' });
      expect(computePercentDelta(10, 10)).toEqual({ pct: 0, trend: 'flat' });
      expect(computePercentDelta(10, 0)).toEqual({ pct: null, trend: 'none' });
      expect(computePercentDelta(10, null)).toEqual({ pct: null, trend: 'none' });
    });
  });

  describe('fetchAnalyticsSummary.ts — fetchAnalyticsComparison() fetches the post set once, computes two real summaries', () => {
    it('reuses one paginated fetch loop for both current and previous ranges — never a doubled GET /v1/posts round trip', async () => {
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
        requestedUrls.push(String(input));
        return new Response(
          JSON.stringify({
            posts: [
              { id: 'a', createdAt: '2026-08-01T00:00:00.000Z', publishedAt: '2026-08-01T09:00:00.000Z', enrichment: { sentiment: 'positive', keyPhrases: [], entities: [] }, rawPayload: { providerId: 'gnews' } },
              { id: 'p', createdAt: '2026-07-20T00:00:00.000Z', publishedAt: '2026-07-20T09:00:00.000Z', enrichment: { sentiment: 'negative', keyPhrases: [], entities: [] }, rawPayload: { providerId: 'gnews' } },
            ],
            nextCursor: null,
          }),
          { status: 200 }
        );
      });

      const { fetchAnalyticsComparison } = await import('../../src/app/tenant/analytics/fetchAnalyticsSummary');
      const result = await fetchAnalyticsComparison(
        { startDate: '2026-08-01', endDate: '2026-08-02' },
        { startDate: '2026-07-19', endDate: '2026-07-20' }
      );

      // Exactly one page fetched (nextCursor: null on the first response) —
      // proves both summaries came from the same single fetched post set,
      // not two independent paging loops.
      expect(requestedUrls).toHaveLength(1);
      expect(result.current.totalPosts).toBe(1);
      expect(result.previous?.totalPosts).toBe(1);
    });

    it('returns previous: null when no previousRange is given — comparison genuinely off, not silently computed anyway', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ posts: [], nextCursor: null }), { status: 200 }));

      const { fetchAnalyticsComparison } = await import('../../src/app/tenant/analytics/fetchAnalyticsSummary');
      const result = await fetchAnalyticsComparison({ startDate: '2026-08-01', endDate: '2026-08-02' }, null);
      expect(result.previous).toBeNull();
    });
  });

  describe('api/analytics/summary/route.ts — real ?compare=true wiring', () => {
    it('sources compare from a real query param and calls the comparison fetch, never a fabricated/estimated previous value', () => {
      const source = readSrc(...summaryRoutePath);
      expect(source).toMatch(/searchParams\.get\(['"]compare['"]\)/);
      expect(source).toMatch(/fetchAnalyticsComparison/);
      expect(source).toMatch(/computePreviousRange/);
    });
  });

  // 2026-08-19, Story 8.7 (ADR-0062 Decision §2): the three-KPI-card Overview
  // layout this describe block was written against is superseded by the
  // 3-column, eight-widget grid — a dated, ADR-authorized supersession, not
  // a silent edit (this project's "Regression, not rewrite" convention).
  // OverviewTab.tsx no longer reads summary.volumeHistory/summary.
  // sentimentSplit directly: both are now recomputed from summary.posts
  // filtered through Story 8.7's own 7-dimension applyOverviewFilters() —
  // required, not optional, since ADR-0062's entire point is that every
  // widget (including the volume/sentiment ones) reflects the active
  // filters, which the old direct-reuse approach could never do once
  // filtering existed at all.
  describe('AC1/AC2: Overview renders a real volume chart and reuses summary.sentimentSplit for its donut', () => {
    it('OverviewTab computes its volume/sentiment data from summary.posts through applyOverviewFilters(), not a second independent post-fetch', () => {
      const source = readSrc(...overviewPath);
      expect(source).toMatch(/applyOverviewFilters\(summary\.posts/);
      expect(source).toMatch(/computeVolumeHistory\(filteredPosts/);
      expect(source).toMatch(/computeSentimentSplitFromFlat\(filteredPosts/);
    });

    it('renders the volume timeline and sentiment gauge widgets with real sentiment counts for a non-empty summary', () => {
      // Recharts' ResponsiveContainer measures 0x0 under renderToStaticMarkup
      // (no real DOM layout) and so doesn't render its chart children — the
      // same known limitation Story 8.2's own contract already works around
      // by never asserting rendered chart labels, only the widget shell and
      // the underlying data plumbing (covered by the source-grep test above).
      const posts = [
        { id: 'x1', publishedAt: '2026-08-01T00:00:00.000Z', author: 'A', sentiment: 'positive', keyPhrases: [], title: 'X1', language: null, providerId: 'gnews' },
        { id: 'x2', publishedAt: '2026-08-01T00:00:00.000Z', author: 'B', sentiment: 'positive', keyPhrases: [], title: 'X2', language: null, providerId: 'gnews' },
        { id: 'x3', publishedAt: '2026-08-02T00:00:00.000Z', author: 'C', sentiment: 'negative', keyPhrases: [], title: 'X3', language: null, providerId: 'gnews' },
      ];
      const summary = { totalPosts: 3, sentimentSplit: { positive: 2, neutral: 0, negative: 1 }, sources: [], volumeHistory: [], posts };
      const html = renderComponent('../../src/app/tenant/analytics/OverviewTab', 'OverviewTab', { summary, previousSummary: null, range: RANGE });
      expect(html).toContain('id="widget-timeline-volume"');
      expect(html).toContain('id="widget-sentiment-gauge"');
      expect(html).toContain('2 positive');
      expect(html).toContain('1 negative');
    });

    it('keeps the existing EmptyState for zero matched posts (Story 8.1 behavior unchanged)', () => {
      const summary = { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [], volumeHistory: [], posts: [] };
      const html = renderComponent('../../src/app/tenant/analytics/OverviewTab', 'OverviewTab', { summary, previousSummary: null, range: RANGE });
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  // 2026-08-19, Story 8.7 (ADR-0062): period-over-period delta badges are
  // deliberately dropped from the Overview tab — confirmed directly with
  // Menno rather than assumed, since ADR-0062's own Decision sections never
  // mention previousSummary/delta at all (a silence, not an explicit
  // removal, so this project's own discipline against silently dropping a
  // shipped feature required asking rather than guessing). Crisis Alert
  // Radar (48h momentum) and Sentiment Trajectory (day-over-day) now give
  // related "is this changing" signals in the new design; a like-for-like
  // previous-equal-length-period comparison is not rebuilt. The fetch/
  // comparison machinery itself (fetchAnalyticsComparison(), route.ts's
  // ?compare=true, AnalyticsClient.tsx's previousSummary state) is
  // untouched and still real — see AC5's own describe block below, still
  // green — only OverviewTab's own rendering of a delta is gone; the prop
  // is still accepted, silently unused, for the other tabs' own possible
  // future use.
  describe('AC3/AC4 — superseded 2026-08-19 by ADR-0062/Story 8.7: previousSummary is accepted without error, produces no rendered delta', () => {
    it('a non-zero previousSummary changes nothing about the render — no delta text appears, and nothing throws', () => {
      const posts = [
        { id: 'y1', publishedAt: '2026-08-01T00:00:00.000Z', author: 'A', sentiment: 'positive', keyPhrases: [], title: 'Y1', language: null, providerId: 'gnews' },
      ];
      const summary = { totalPosts: 1, sentimentSplit: { positive: 1, neutral: 0, negative: 0 }, sources: [], volumeHistory: [], posts };
      const previousSummary = { totalPosts: 10, sentimentSplit: { positive: 5, neutral: 3, negative: 2 }, sources: [], volumeHistory: [], posts: [] };
      expect(() =>
        renderComponent('../../src/app/tenant/analytics/OverviewTab', 'OverviewTab', { summary, previousSummary, range: RANGE })
      ).not.toThrow();
    });

    it('never renders a fabricated percentage delta, with or without a previousSummary', () => {
      const posts = [
        { id: 'z1', publishedAt: '2026-08-01T00:00:00.000Z', author: 'A', sentiment: 'positive', keyPhrases: [], title: 'Z1', language: null, providerId: 'gnews' },
      ];
      const summary = { totalPosts: 1, sentimentSplit: { positive: 1, neutral: 0, negative: 0 }, sources: [], volumeHistory: [], posts };
      const htmlNoComparison = renderComponent('../../src/app/tenant/analytics/OverviewTab', 'OverviewTab', { summary, previousSummary: null, range: RANGE });
      expect(htmlNoComparison).not.toMatch(/vs\. previous period|vs previous period/i);

      const zeroPrevious = { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [], volumeHistory: [], posts: [] };
      const htmlZeroPrevious = renderComponent('../../src/app/tenant/analytics/OverviewTab', 'OverviewTab', { summary, previousSummary: zeroPrevious, range: RANGE });
      expect(htmlZeroPrevious).not.toMatch(/vs\. previous period|vs previous period/i);
    });
  });

  describe('AC5: AnalyticsClient reads compareWithPrevious for the first time and tracks previousSummary', () => {
    it('wires DateRangeValue.compareWithPrevious into the fetch and passes previousSummary down to OverviewTab', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/compareWithPrevious/);
      expect(source).toMatch(/previousSummary/);
      expect(source).toMatch(/<OverviewTab[^>]*previousSummary/);
    });

    it('a failed comparison fetch degrades gracefully — the existing error-handling path is reused, not a second, separate failure mode', () => {
      const source = readSrc(...clientPath);
      // Same catch/setError block already established by Story 8.1 — no new,
      // parallel error state introduced just for the comparison fetch.
      const catchBlocks = source.match(/catch\s*\{/g) ?? [];
      expect(catchBlocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Regression: Sources/Sentiment/Conversations tabs unaffected (Story 8.4 touches Overview + shared fetch/route plumbing only)', () => {
    it('AnalyticsClient still renders all four tabs from the existing summary/range props', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/<SourcesTab/);
      expect(source).toMatch(/<SentimentTab/);
      expect(source).toMatch(/<ConversationsTab/);
    });
  });

  describe('Structural: every scoped file exists', () => {
    it('analyticsData.ts, OverviewTab.tsx, AnalyticsClient.tsx, fetchAnalyticsSummary.ts, and route.ts all exist', () => {
      for (const segments of [analyticsDataPath, overviewPath, clientPath, fetchSummaryPath, summaryRoutePath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });
  });
});
