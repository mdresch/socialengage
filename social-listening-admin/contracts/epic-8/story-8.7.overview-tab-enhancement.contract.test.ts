/**
 * Contract: Story 8.7 (ADR-0062) — Overview Tab Enhancement: 3-column grid,
 * 7-dimension filter model, statistical volume forecast, filter chips,
 * deep-link share state.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-87
 *
 * Intent: Story 8.7 — Overview Tab Enhancement
 * Scope: social-listening-admin/{
 *   src/app/tenant/analytics/analyticsData.ts (extended — OverviewFilters,
 *     applyOverviewFilters(), computeActiveChips(),
 *     parseOverviewFiltersFromSearchParams(),
 *     serializeOverviewFiltersToSearchString(), computeTopAuthorsByVolume(),
 *     computeAuthorsBySource(), computeVolumeForecast(),
 *     computeCrisisAlertRadar(), computeSentimentTrajectory(),
 *     computeSourceBreakdownFromFlat()),
 *   src/app/tenant/analytics/OverviewTab.tsx (rewritten — replaces the
 *     three-KPI-card layout with the 3-column, 8-widget grid),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (extended — passes `range`
 *     and `initialOverviewFilters` to OverviewTab),
 *   src/app/tenant/analytics/page.tsx (extended — parses the six new
 *     deep-link search params server-side, same pattern already
 *     established there for `?tab=`; a scope addition found mid-
 *     implementation, not in the original draft of this Scope note —
 *     necessary because OverviewTab.tsx cannot call next/navigation's
 *     useSearchParams() itself without the Next.js router context this
 *     repo's own contract tests, plain renderToStaticMarkup() with no App
 *     Router provider, don't supply; flagged explicitly per
 *     implementation-methodology.md's Step 2 rather than folded in
 *     silently),
 *   src/app/globals.css (extended — grid/chip/gauge/donut/forecast classes)
 * }. No social-listening-core change — every widget in this story is
 * 100% client-side (ADR-0062 Decision §3's own boundary).
 *
 * Contract to encode: eight widget slots with the exact, verbatim
 *   `widget-` prefixed ids ADR-0062 Decision §2 drafted (AC1); all seven
 *   adopted filter dimensions compose with AND semantics via a single pure
 *   predicate function, `selectedTopic` not wired (AC2); a chips bar
 *   reflecting active dimensions with a clear-all control (AC3); deep-link
 *   parse/serialize round-tripping through URL search params, unknown/
 *   invalid values silently falling back to defaults (AC4); the statistical
 *   forecast formula producing real numbers with no server round-trip
 *   (AC-timeline); Crisis Alert Radar's 48h negative-momentum thresholds,
 *   honest "no data" on either window having zero posts (AC-crisis);
 *   Sentiment Trajectory's per-day −10/+10 series reusing
 *   computeSentimentHistory()'s own day-bucketing, never a single flattened
 *   number (AC-trajectory); the inline SVG Sentiment Gauge (AC-gauge);
 *   Authors by Source's fixed three-real-connector row list with honest
 *   zero rows (AC-authors-by-source); click-to-filter wiring from six
 *   widgets into their corresponding dimension, proven structurally per
 *   this project's own Story 8.2 precedent (no @testing-library/react in
 *   this repo — DOM interaction is proven by source-regex inspection, not
 *   simulated clicks); the filtered-post-count control and drawer entry
 *   point (AC-drawer).
 *
 * Per Story 8.1/8.2's own established testing boundary: pure aggregation/
 * filter/parse functions are proven by direct unit tests; static component
 * output is proven by real renderToStaticMarkup() renders against real
 * fixture data; state-driven interactive wiring (onClick handlers,
 * useState, useSearchParams, window.history.replaceState) has no DOM-
 * interaction test runner in this repo yet and is proven structurally via
 * source-text inspection instead.
 *
 * Explicitly out of scope for this contract:
 *   - Story 8.8's AI Spike Storyteller widget and its backend endpoint —
 *     this story only sets activeDateFilter on a timeline click; Story 8.8
 *     is what reads it and renders the widget.
 *   - Story 8.9's selectedTopic watchlist selector and Watchlist Coverage
 *     widget — reserved slot only, never rendered by this story.
 *   - Sentiment/Conversations/Sources tabs' own existing behavior.
 *   - Any change to social-listening-core or GET /v1/posts.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const overviewTabPath = ['app', 'tenant', 'analytics', 'OverviewTab.tsx'];
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const clientPath = ['app', 'tenant', 'analytics', 'AnalyticsClient.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

import {
  computeSentimentHistory,
  computeVolumeHistory,
  applyOverviewFilters,
  computeActiveChips,
  parseOverviewFiltersFromSearchParams,
  serializeOverviewFiltersToSearchString,
  computeTopAuthorsByVolume,
  computeAuthorsBySource,
  computeVolumeForecast,
  computeCrisisAlertRadar,
  computeSentimentTrajectory,
  EMPTY_OVERVIEW_FILTERS,
  type SentimentPost,
} from '../../src/app/tenant/analytics/analyticsData';

function post(
  id: string,
  providerId: string,
  publishedAt: string | null,
  sentiment: string | null,
  author: string | null,
  keyPhrases: string[] = [],
  language: string | null = 'en'
): SentimentPost {
  return { id, publishedAt, author, sentiment, keyPhrases, title: `Post ${id}`, language, providerId };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-05' };

const FIXTURE: SentimentPost[] = [
  post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive', 'Acme Corp', ['launch', 'growth'], 'en'),
  post('b', 'gnews', '2026-08-01T10:00:00.000Z', 'positive', 'Acme Corp', ['launch'], 'en'),
  post('c', 'newswire', '2026-08-02T09:00:00.000Z', 'negative', 'Beta Inc', ['recall'], 'fr'),
  post('d', 'newswire', '2026-08-03T09:00:00.000Z', 'neutral', 'Gamma LLC', ['results'], 'en'),
  post('e', 'tenant-owned-feed', '2026-08-05T09:00:00.000Z', null, 'Delta Co', [], null),
];

describe('Story 8.7 — Overview Tab Enhancement contract', () => {
  describe('AC2: applyOverviewFilters() — all seven dimensions compose with AND semantics', () => {
    it('an empty filter set returns every post unchanged', () => {
      expect(applyOverviewFilters(FIXTURE, EMPTY_OVERVIEW_FILTERS)).toHaveLength(5);
    });

    it('a single active dimension narrows the set to matching posts only', () => {
      const result = applyOverviewFilters(FIXTURE, { ...EMPTY_OVERVIEW_FILTERS, activeSourceFilter: 'gnews' });
      expect(result.map((p) => p.id).sort()).toEqual(['a', 'b']);
    });

    it('two simultaneously active dimensions narrow further, never replacing one another (AND, not OR)', () => {
      const result = applyOverviewFilters(FIXTURE, {
        ...EMPTY_OVERVIEW_FILTERS,
        activeSourceFilter: 'gnews',
        activeKeywordFilter: 'growth',
      });
      expect(result.map((p) => p.id)).toEqual(['a']);
    });

    it('activeDateFilter narrows to a single day within the already-selected range', () => {
      const result = applyOverviewFilters(FIXTURE, { ...EMPTY_OVERVIEW_FILTERS, activeDateFilter: '2026-08-02' });
      expect(result.map((p) => p.id)).toEqual(['c']);
    });

    it('activeLanguageFilter is a real, independently-wired dimension, not a Story 8.5 pass-through', () => {
      const result = applyOverviewFilters(FIXTURE, { ...EMPTY_OVERVIEW_FILTERS, activeLanguageFilter: 'fr' });
      expect(result.map((p) => p.id)).toEqual(['c']);
    });

    it('a dimension with no matching posts returns an empty result, not an error', () => {
      expect(applyOverviewFilters(FIXTURE, { ...EMPTY_OVERVIEW_FILTERS, activeAuthorFilter: 'Nobody' })).toEqual([]);
    });
  });

  describe('AC3: computeActiveChips() — chip bar reflects only adopted, active dimensions', () => {
    it('no active dimensions produces no chips', () => {
      expect(computeActiveChips(EMPTY_OVERVIEW_FILTERS)).toEqual([]);
    });

    it('multiple active dimensions each produce their own chip, concurrently', () => {
      const chips = computeActiveChips({
        ...EMPTY_OVERVIEW_FILTERS,
        activeSourceFilter: 'gnews',
        activeSentimentFilter: 'positive',
      });
      expect(chips.map((c) => c.type).sort()).toEqual(['activeSentimentFilter', 'activeSourceFilter']);
    });
  });

  describe('AC4: deep-link parse/serialize round-trips through URL search params', () => {
    it('parses recognised params into filter state', () => {
      const params = new URLSearchParams('source=gnews&author=Acme+Corp&keyword=launch&language=en&sentiment=positive');
      const filters = parseOverviewFiltersFromSearchParams(params);
      expect(filters).toEqual({
        activeDateFilter: null,
        activeSourceFilter: 'gnews',
        activeAuthorFilter: 'Acme Corp',
        activeKeywordFilter: 'launch',
        activeLanguageFilter: 'en',
        activeSentimentFilter: 'positive',
        activeWatchlistFilter: null,
      });
    });

    it('an invalid/unrecognised sentiment value silently falls back to the default, never an error', () => {
      const params = new URLSearchParams('sentiment=not-a-real-value');
      expect(parseOverviewFiltersFromSearchParams(params).activeSentimentFilter).toBeNull();
      expect(() => parseOverviewFiltersFromSearchParams(params)).not.toThrow();
    });

    it('missing params fall back to the empty filter set', () => {
      expect(parseOverviewFiltersFromSearchParams(new URLSearchParams(''))).toEqual(EMPTY_OVERVIEW_FILTERS);
    });

    it('serializing then parsing round-trips exactly for a real filter combination', () => {
      const filters = { ...EMPTY_OVERVIEW_FILTERS, activeSourceFilter: 'newswire', activeSentimentFilter: 'negative' as const };
      const search = serializeOverviewFiltersToSearchString(filters);
      expect(parseOverviewFiltersFromSearchParams(new URLSearchParams(search))).toEqual(filters);
    });

    it('the watchlist param is only written when activeWatchlistFilter is set', () => {
      const filters = { ...EMPTY_OVERVIEW_FILTERS, activeSourceFilter: 'gnews' };
      expect(serializeOverviewFiltersToSearchString(filters)).not.toContain('watchlist');
    });
  });

  describe('AC (Volume & Projections Timeline): computeVolumeForecast() — statistical decay, no backend', () => {
    it('computes the exact mean-reversion formula for each projected day', () => {
      const history = computeVolumeHistory(FIXTURE, RANGE);
      const lastVolume = history[history.length - 1].count;
      const forecast = computeVolumeForecast(history, 3);
      expect(forecast).toHaveLength(3);
      const expectedDay1 = Math.round(lastVolume * 0.85 ** 1 + 850 * (1 - 0.85 ** 1));
      expect(forecast[0].projectedVolume).toBe(expectedDay1);
    });

    it('an empty volume history produces an empty forecast, never a fabricated projection', () => {
      expect(computeVolumeForecast([], 7)).toEqual([]);
    });
  });

  describe('AC (Crisis Alert Radar): 48-hour negative-sentiment momentum', () => {
    it('zero posts in either 48h window renders "no data" (null), never a fabricated percentage', () => {
      const sparse: SentimentPost[] = [post('x', 'gnews', '2026-08-01T09:00:00.000Z', 'negative', 'A')];
      expect(computeCrisisAlertRadar(sparse, { startDate: '2026-08-01', endDate: '2026-08-05' })).toBeNull();
    });

    it('a real increase in negative-post count across the two windows produces a real percentage and level', () => {
      const posts: SentimentPost[] = [
        // Previous 48h window (2026-08-02 12:00 -> 2026-08-04 12:00): 1 negative of 2 total
        post('p1', 'gnews', '2026-08-03T00:00:00.000Z', 'negative', 'A'),
        post('p2', 'gnews', '2026-08-03T06:00:00.000Z', 'positive', 'B'),
        // Current 48h window (2026-08-04 12:00 -> 2026-08-06 12:00): 3 negative of 3 total
        post('c1', 'gnews', '2026-08-05T00:00:00.000Z', 'negative', 'A'),
        post('c2', 'gnews', '2026-08-05T06:00:00.000Z', 'negative', 'B'),
        post('c3', 'gnews', '2026-08-05T12:00:00.000Z', 'negative', 'C'),
      ];
      const result = computeCrisisAlertRadar(posts, { startDate: '2026-08-01', endDate: '2026-08-06' });
      expect(result).not.toBeNull();
      expect(result!.changePct).toBeGreaterThan(50);
      expect(result!.level).toBe('crisis');
    });
  });

  describe('AC (Sentiment Trajectory): per-day −10..+10 series, not a single flattened number', () => {
    it('scores each day independently from computeSentimentHistory()\'s own day-bucketing', () => {
      const flat = FIXTURE;
      const history = computeSentimentHistory(flat, RANGE);
      const trajectory = computeSentimentTrajectory(history);
      expect(trajectory.points).toHaveLength(history.length);
      // 2026-08-01: 2 positive, 0 neutral, 0 negative -> (2*10)/2 = 10
      const day1 = trajectory.points.find((p) => p.date === '2026-08-01');
      expect(day1?.score).toBe(10);
      // 2026-08-02: 1 negative -> -10
      const day2 = trajectory.points.find((p) => p.date === '2026-08-02');
      expect(day2?.score).toBe(-10);
    });

    it('a day with zero enriched posts is excluded from the trend, not fabricated as a 0', () => {
      const flat = FIXTURE;
      const history = computeSentimentHistory(flat, RANGE);
      const trajectory = computeSentimentTrajectory(history);
      // 2026-08-04 has no posts at all in the fixture.
      const day4 = trajectory.points.find((p) => p.date === '2026-08-04');
      expect(day4?.score).toBeNull();
    });
  });

  describe('AC (Authors by Source): fixed three-real-connector list, honest zero rows', () => {
    it('always returns exactly the three real connectors, even one with zero matching posts', () => {
      const flat = FIXTURE.filter((p) => p.providerId !== 'tenant-owned-feed');
      const result = computeAuthorsBySource(flat);
      expect(result.bySource.map((s) => s.providerId).sort()).toEqual(['gnews', 'newswire', 'tenant-owned-feed']);
      const feed = result.bySource.find((s) => s.providerId === 'tenant-owned-feed');
      expect(feed?.uniqueAuthorCount).toBe(0);
    });

    it('computes real unique-author counts via Set size, not raw post count', () => {
      const flat = FIXTURE;
      const result = computeAuthorsBySource(flat);
      const gnews = result.bySource.find((s) => s.providerId === 'gnews');
      // posts a+b are both gnews, both authored by "Acme Corp" — one unique author, not two.
      expect(gnews?.uniqueAuthorCount).toBe(1);
    });
  });

  describe('AC (Top Authors Feed): real post-count ranking, not sentiment-bucketed', () => {
    it('ranks authors by total post count descending', () => {
      const flat = FIXTURE;
      const ranking = computeTopAuthorsByVolume(flat);
      expect(ranking[0]).toEqual({ author: 'Acme Corp', count: 2 });
    });
  });

  describe('AC1: rendered widget slots carry the exact, verbatim ADR-0062-drafted ids', () => {
    it('all eight widget-* ids are present, never dynamically generated or renamed', () => {
      const flat = FIXTURE;
      const summary = {
        totalPosts: flat.length,
        sentimentSplit: { positive: 2, neutral: 1, negative: 1 },
        sources: [],
        sentimentHistory: computeSentimentHistory(flat, RANGE),
        topFans: [],
        topCritics: [],
        positivePhrases: [],
        negativePhrases: [],
        phraseFrequency: [],
        phraseHistory: [],
        volumeHistory: computeVolumeHistory(flat, RANGE),
        languages: [],
        sourceVolumeHistory: [],
        posts: flat,
      };
      const html = renderComponent(path.join(ADMIN_ROOT, 'src', ...overviewTabPath), 'OverviewTab', {
        summary,
        previousSummary: null,
        range: RANGE,
      });
      for (const id of [
        'widget-sentiment-gauge',
        'widget-authors-by-source',
        'widget-timeline-volume',
        'widget-wordcloud',
        'widget-languages',
        'widget-sources-volume',
        'widget-top-authors',
        'widget-spike-storyteller',
      ]) {
        expect(html).toContain(`id="${id}"`);
      }
      // Crisis Alert Radar / Sentiment Trajectory render inside widget-timeline-volume, never their own top-level id.
      expect(html).not.toContain('id="crisis-alert-radar"');
      expect(html).not.toContain('id="sentiment-trajectory"');
      // Story 8.9 (ADR-0063) builds widget-watchlist-coverage.
      expect(html).toContain('id="widget-watchlist-coverage"');
    });

    it('a zero-post result renders EmptyState-shaped output, not fabricated widget content', () => {
      const emptySummary = {
        totalPosts: 0,
        sentimentSplit: { positive: 0, neutral: 0, negative: 0 },
        sources: [],
        sentimentHistory: [],
        topFans: [],
        topCritics: [],
        positivePhrases: [],
        negativePhrases: [],
        phraseFrequency: [],
        phraseHistory: [],
        volumeHistory: [],
        languages: [],
        sourceVolumeHistory: [],
        posts: [],
      };
      const html = renderComponent(path.join(ADMIN_ROOT, 'src', ...overviewTabPath), 'OverviewTab', {
        summary: emptySummary,
        previousSummary: null,
        range: RANGE,
      });
      expect(html.toLowerCase()).toContain('no posts');
    });
  });

  describe('Click-to-filter wiring — proven structurally (source inspection), per Story 8.2 precedent', () => {
    const source = readSrc(...overviewTabPath);

    it('six widgets wire a real onClick to their corresponding filter toggle handler', () => {
      expect(source).toMatch(/onClick=\{.*toggleSentimentFilter/s);
      expect(source).toMatch(/onClick=\{.*toggleSourceFilter/s);
      expect(source).toMatch(/onClick=\{.*toggleDateFilter/s);
      expect(source).toMatch(/onClick=\{.*toggleKeywordFilter/s);
      expect(source).toMatch(/onClick=\{.*toggleLanguageFilter/s);
      expect(source).toMatch(/onClick=\{.*toggleAuthorFilter/s);
    });

    it('each toggle handler is a real, second-click-clears (toggle-off) implementation, not a one-way select', () => {
      expect(source).toMatch(/prev\.activeSentimentFilter === value \? null : value/);
      expect(source).toMatch(/prev\.activeSourceFilter === value \? null : value/);
    });

    it('selectedDateRange is never set by a widget click — only GlobalDateRangePicker drives it', () => {
      expect(source).not.toMatch(/onClick=\{.*setSelectedDateRange/s);
      expect(source).not.toMatch(/onClick=\{.*setRange\(/s);
    });

    it('uses window.history.replaceState for deep-link URL sync, not a full navigation', () => {
      expect(source).toMatch(/window\.history\.replaceState/);
    });

    /**
     * 2026-08-19 — superseded the same day, live, at Menno's own explicit
     * request ("when a post is selected it will move the current sidebar to
     * the left of it and open a sidebar with post details as on the post
     * page sidebar similar view"): the filtered-post-count control now opens
     * a custom two-panel stacked drawer (post list + on-demand full post
     * detail via `PostDetailPanel`), not the shared single-panel `Slideover`
     * component — the shared component can't render two panels side by side
     * without breaking its other four-plus call sites (see
     * `PostDetailPanel.tsx`'s own header comment). It still reuses
     * `Slideover`'s own CSS classes (`.slideover-backdrop`,
     * `.slideover-panel`) rather than inventing new chrome, so this
     * assertion checks for that reuse instead of the component import.
     */
    it('the filtered-post-count control opens a stacked two-panel drawer reusing Slideover CSS, not the Slideover component', () => {
      expect(source).not.toMatch(/<Slideover[\s>]/);
      expect(source).not.toMatch(/import\s*\{[^}]*\bSlideover\b[^}]*\}\s*from/);
      expect(source).toMatch(/slideover-backdrop/);
      expect(source).toMatch(/an-drawer-stack/);
      expect(source).toMatch(/an-drawer-post-row/);
      expect(source).toMatch(/openDetail/);
      expect(source).toMatch(/PostDetailPanel/);
    });

    it('no D3 import — Recharts and inline SVG only (ADR-0062 Decision §9)', () => {
      expect(source).not.toMatch(/from ['"]d3['"]/);
    });
  });

  describe('AnalyticsClient.tsx passes range and initialOverviewFilters to OverviewTab', () => {
    it('OverviewTab is invoked with a range prop', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/<OverviewTab[^>]*range=\{range\}/s);
    });

    it('OverviewTab is invoked with initialFilters', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/<OverviewTab[^>]*initialFilters=\{initialOverviewFilters\}/s);
    });
  });

  describe('page.tsx parses deep-link filter params server-side, same pattern as ?tab=', () => {
    it('reads all six filter search params and calls parseOverviewFiltersFromSearchParams()', () => {
      const source = readSrc('app', 'tenant', 'analytics', 'page.tsx');
      expect(source).toMatch(/parseOverviewFiltersFromSearchParams/);
      for (const param of ['date', 'source', 'author', 'keyword', 'language', 'sentiment', 'watchlist']) {
        expect(source).toContain(param);
      }
    });
  });

  describe('No new social-listening-core surface introduced by this story', () => {
    it('analyticsData.ts additions remain pure — no next/* or fetch import', () => {
      const source = readSrc(...analyticsDataPath);
      expect(source).not.toMatch(/from ['"]next\//);
      expect(source).not.toMatch(/\bfetch\(/);
    });
  });
});
