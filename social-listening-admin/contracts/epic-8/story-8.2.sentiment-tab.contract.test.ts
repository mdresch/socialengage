/**
 * Contract: Story 8.2 (ADR-0054) — Sentiment tab.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-82
 *
 * Intent: Story 8.2 — Sentiment tab
 * Scope: social-listening-admin/{
 *   src/app/tenant/analytics/analyticsData.ts (extended — SentimentPost,
 *     flattenForSentiment(), computeSentimentSplitFromFlat(),
 *     computeSentimentHistory(), computeTopAuthorsBySentiment(),
 *     computePhrasesBySentiment(), AnalyticsSummary gains
 *     sentimentHistory/topFans/topCritics/positivePhrases/
 *     negativePhrases/posts),
 *   src/app/tenant/analytics/SentimentTab.tsx (new),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (extended — Sentiment tab
 *     stub replaced with the real component)
 * }. No fetchAnalyticsSummary.ts / route.ts change needed — both already
 * return whatever computeAnalyticsSummary() produces, generically.
 *
 * Contract to encode: a real sentiment donut (positive/neutral/negative,
 *   real enrichment.sentiment, no fallback numbers on an empty result), a
 *   real day-bucketed sentiment-over-time series (every day in the range
 *   represented, zero-post days rendering a real zero, never omitted), Top
 *   Fans/Top Critics ranked by real author + sentiment count (no fallback
 *   to a hardcoded name list — the exact defect found in the uncommitted
 *   SentimentDashboardTab.tsx prototype, ADR-0054 Context), positive/
 *   negative key-phrase clouds bucketed by the sentiment of the posts each
 *   phrase appears on, an author/phrase click that toggles a client-side
 *   filter recomputing every widget on the tab from the filtered post set,
 *   and a posts drawer reusing the existing Slideover component (Story
 *   6.11) — no new post-detail UI.
 *
 * Per this project's own "string-containment checks are not sufficient"
 * lesson and Story 8.1's own established pattern: pure aggregation
 * functions are proven by direct unit tests; component rendering is proven
 * by real renderToStaticMarkup() renders with real data (not
 * JSON.stringify(Page()), which cannot see into a Client Component's own
 * output — confirmed independently during Story 8.1); client-side
 * interactive wiring (onClick handlers, useState) that this repo has no
 * DOM-interaction test runner for yet (no @testing-library/react in
 * package.json) is proven structurally, the same boundary Story 8.1's own
 * contract already accepted.
 *
 * Explicitly out of scope for this contract:
 *   - The "Explain the Spike" AI narrative panel, predictive sentiment
 *     forecasting, and any topic-cluster network graph — speculative
 *     brainstorm content (docs/design/frontend-design-future-devs.md), not
 *     decided or designed by ADR-0054 or this story.
 *   - Overview/Sources tabs' own behavior (Story 8.1's own contract).
 *   - Any change to social-listening-core or GET /v1/posts.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const sentimentTabPath = ['app', 'tenant', 'analytics', 'SentimentTab.tsx'];
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

function post(id: string, providerId: string, publishedAt: string | null, sentiment: string | null, author: string | null, keyPhrases: string[] = []) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases, entities: [] } : null,
    bodyMarkdown: null,
    rawPayload: { providerId, title: `Post ${id}`, author },
  };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-03' };

const FIXTURE_POSTS = [
  post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive', 'Acme Corp', ['great product', 'fast support']),
  post('b', 'gnews', '2026-08-01T10:00:00.000Z', 'positive', 'Acme Corp', ['great product']),
  post('c', 'newswire', '2026-08-02T09:00:00.000Z', 'negative', 'Beta Inc', ['slow response', 'billing issue']),
  post('d', 'newswire', '2026-08-03T09:00:00.000Z', 'neutral', 'Gamma LLC', ['quarterly results']),
  post('e', 'gnews', '2026-08-03T09:00:00.000Z', null, 'Delta Co', []), // unenriched — excluded everywhere
];

describe('Story 8.2 — Sentiment tab', () => {
  describe('analyticsData.ts — pure aggregation (unit)', () => {
    it('flattenForSentiment() extracts real author/sentiment/keyPhrases/title, lowercases sentiment', async () => {
      const { flattenForSentiment } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'Positive', 'Acme Corp', ['x'])]);
      // 2026-08-17, Story 8.5: SentimentPost genuinely gained a `language`
      // field (enrichment.detectedLanguage) — this fixture post has no
      // enrichment.detectedLanguage, so it's real null, not a foreign
      // regression. Narrowed to include it, same as Story 8.2/8.3's own
      // precedent for an anticipated in-epic shape widening.
      // 2026-08-17, Story 8.6: SentimentPost also gained a real providerId
      // (extractProviderBadge()) — this fixture post uses 'gnews', same
      // anticipated in-epic widening precedent as the language fix above.
      expect(flat).toEqual([{ id: 'a', publishedAt: '2026-08-01T09:00:00.000Z', author: 'Acme Corp', sentiment: 'positive', keyPhrases: ['x'], title: 'Post a', language: null, providerId: 'gnews' }]);
    });

    it('computeSentimentHistory() buckets by day across the whole range, including zero-post days, never omitted', async () => {
      const { flattenForSentiment, computeSentimentHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const history = computeSentimentHistory(flattenForSentiment(FIXTURE_POSTS), RANGE);
      expect(history).toEqual([
        { date: '2026-08-01', positive: 2, neutral: 0, negative: 0 },
        { date: '2026-08-02', positive: 0, neutral: 0, negative: 1 },
        { date: '2026-08-03', positive: 0, neutral: 1, negative: 0 },
      ]);
    });

    it('computeSentimentHistory() includes a real zero-value day for a range with no matching posts at all', async () => {
      const { computeSentimentHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const history = computeSentimentHistory([], { startDate: '2026-09-01', endDate: '2026-09-02' });
      expect(history).toEqual([
        { date: '2026-09-01', positive: 0, neutral: 0, negative: 0 },
        { date: '2026-09-02', positive: 0, neutral: 0, negative: 0 },
      ]);
    });

    it('computeTopAuthorsBySentiment() ranks real authors by real count, descending, no fallback list', async () => {
      const { flattenForSentiment, computeTopAuthorsBySentiment } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS);
      expect(computeTopAuthorsBySentiment(flat, 'positive')).toEqual([{ author: 'Acme Corp', count: 2 }]);
      expect(computeTopAuthorsBySentiment(flat, 'negative')).toEqual([{ author: 'Beta Inc', count: 1 }]);
    });

    it('computeTopAuthorsBySentiment() returns an empty array, never a fabricated fallback name, when there is no real match', async () => {
      const { computeTopAuthorsBySentiment } = await import('../../src/app/tenant/analytics/analyticsData');
      expect(computeTopAuthorsBySentiment([], 'positive')).toEqual([]);
      // The exact fabricated names ADR-0054 found in the uncommitted prototype's TOP_FANS/TOP_CRITICS fallback.
      const result = JSON.stringify(computeTopAuthorsBySentiment([], 'positive'));
      expect(result).not.toContain('kiefferphilippe');
      expect(result).not.toContain('Philippe Kieffer');
    });

    it('computePhrasesBySentiment() buckets real keyPhrases by the sentiment of the post(s) they appear on', async () => {
      const { flattenForSentiment, computePhrasesBySentiment } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS);
      expect(computePhrasesBySentiment(flat, 'positive')).toEqual([
        { phrase: 'great product', count: 2 },
        { phrase: 'fast support', count: 1 },
      ]);
      expect(computePhrasesBySentiment(flat, 'negative')).toEqual([
        { phrase: 'slow response', count: 1 },
        { phrase: 'billing issue', count: 1 },
      ]);
    });

    it('computeSentimentSplitFromFlat() applies the identical recognized-sentiment rule as computeSentimentSplit()', async () => {
      const { flattenForSentiment, computeSentimentSplitFromFlat } = await import('../../src/app/tenant/analytics/analyticsData');
      expect(computeSentimentSplitFromFlat(flattenForSentiment(FIXTURE_POSTS))).toEqual({ positive: 2, neutral: 1, negative: 1 });
    });

    it('computeAnalyticsSummary() now also returns real sentimentHistory/topFans/topCritics/phrases/posts, composed once', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const summary = computeAnalyticsSummary(FIXTURE_POSTS, RANGE);
      expect(summary.sentimentHistory).toHaveLength(3);
      expect(summary.topFans).toEqual([{ author: 'Acme Corp', count: 2 }]);
      expect(summary.topCritics).toEqual([{ author: 'Beta Inc', count: 1 }]);
      expect(summary.positivePhrases[0]).toEqual({ phrase: 'great product', count: 2 });
      expect(summary.posts).toHaveLength(5);
      expect(summary.posts.find((p) => p.id === 'e')?.sentiment).toBeNull();
    });
  });

  describe('AC1: sentiment donut — real split, honest empty state, no fallback numbers', () => {
    it('renders real positive/neutral/negative counts from a real AnalyticsSummary', () => {
      const html = renderComponent(
        '../../src/app/tenant/analytics/SentimentTab',
        'SentimentTab',
        { summary: { totalPosts: 4, sentimentSplit: { positive: 2, neutral: 1, negative: 1 }, sources: [], sentimentHistory: [], topFans: [], topCritics: [], positivePhrases: [], negativePhrases: [], posts: [] }, range: RANGE }
      );
      expect(html).toContain('2');
      expect(html).not.toContain('68');
      const donutBlock = html.slice(html.indexOf('widget-sentiment-donut'), html.indexOf('widget-sentiment-history'));
      expect(donutBlock).not.toContain('data-testid="empty-state"');
    });

    it('renders EmptyState, not fabricated 68/22/10 fallback numbers, when nothing is enriched yet', () => {
      const html = renderComponent(
        '../../src/app/tenant/analytics/SentimentTab',
        'SentimentTab',
        { summary: { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [], sentimentHistory: [], topFans: [], topCritics: [], positivePhrases: [], negativePhrases: [], posts: [] }, range: RANGE }
      );
      expect(html).toContain('data-testid="empty-state"');
      expect(html).not.toContain('68');
      expect(html).not.toContain('22');
    });
  });

  describe('AC3: Top Fans / Top Critics — real ranking, no fallback list, honest empty state', () => {
    it('renders real author names and counts', () => {
      const html = renderComponent(
        '../../src/app/tenant/analytics/SentimentTab',
        'SentimentTab',
        {
          summary: {
            totalPosts: 2, sentimentSplit: { positive: 1, neutral: 0, negative: 1 }, sources: [], sentimentHistory: [],
            topFans: [{ author: 'Acme Corp', count: 2 }], topCritics: [{ author: 'Beta Inc', count: 1 }],
            positivePhrases: [], negativePhrases: [], posts: [],
          },
          range: RANGE,
        }
      );
      expect(html).toContain('Acme Corp');
      expect(html).toContain('Beta Inc');
    });

    it('renders EmptyState for Top Fans/Critics, never the fabricated kiefferphilippe/Philippe Kieffer fallback, when there is no real data', () => {
      const html = renderComponent(
        '../../src/app/tenant/analytics/SentimentTab',
        'SentimentTab',
        { summary: { totalPosts: 0, sentimentSplit: { positive: 0, neutral: 0, negative: 0 }, sources: [], sentimentHistory: [], topFans: [], topCritics: [], positivePhrases: [], negativePhrases: [], posts: [] }, range: RANGE }
      );
      expect(html).not.toContain('kiefferphilippe');
      expect(html).not.toContain('Philippe Kieffer');
    });
  });

  describe('AC4: positive/negative key-phrase clouds — real phrases, honest empty state', () => {
    it('renders real phrases with real counts', () => {
      const html = renderComponent(
        '../../src/app/tenant/analytics/SentimentTab',
        'SentimentTab',
        {
          summary: {
            totalPosts: 2, sentimentSplit: { positive: 1, neutral: 0, negative: 1 }, sources: [], sentimentHistory: [],
            topFans: [], topCritics: [],
            positivePhrases: [{ phrase: 'great product', count: 2 }], negativePhrases: [{ phrase: 'slow response', count: 1 }],
            posts: [],
          },
          range: RANGE,
        }
      );
      expect(html).toContain('great product');
      expect(html).toContain('slow response');
    });
  });

  describe('AC5: author/phrase selection filters the tab, recomputing every widget client-side', () => {
    it('SentimentTab wires a real onClick toggle to author/phrase filter state, structurally', () => {
      const source = readSrc(...sentimentTabPath);
      expect(source).toMatch(/useState/);
      expect(source).toMatch(/onClick=\{.*toggleAuthor/);
      expect(source).toMatch(/onClick=\{.*togglePhrase/);
      // A second click on the same value clears the filter (toggle, not a one-way select) —
      // matches this project's established toggle convention elsewhere (AppSidebar/ConnectorsClient).
      expect(source).toMatch(/prev\?\.\s*type\s*===\s*'author'\s*&&\s*prev\.value\s*===\s*author\s*\?\s*null/);
    });

    it('filtering by author recomputes the sentiment split from only that author\'s real posts (unit-level proof of the recomputation the component performs)', async () => {
      const { flattenForSentiment, computeSentimentSplitFromFlat } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS).filter((p) => p.author === 'Acme Corp');
      expect(computeSentimentSplitFromFlat(flat)).toEqual({ positive: 2, neutral: 0, negative: 0 });
    });
  });

  describe('AC6: clicking through to underlying posts reuses the existing Slideover pattern — no new post-detail UI', () => {
    it('SentimentTab imports and renders the shared Slideover component, not a bespoke modal', () => {
      const source = readSrc(...sentimentTabPath);
      expect(source).toContain("from '@/components/ui'");
      expect(source).toContain('Slideover');
      expect(source).not.toMatch(/class(Name)?=.*modal-backdrop/);
    });

    it('a "view matching posts" trigger opens the drawer via real state, structurally — the drawer content maps over the real (filtered) post list, not a fabricated one', () => {
      const source = readSrc(...sentimentTabPath);
      expect(source).toMatch(/setDrawerOpen\(true\)/);
      expect(source).toMatch(/isOpen=\{drawerOpen\}/);
      // The Slideover's own content is built from filteredPosts (the real,
      // already-fetched, possibly author/phrase-filtered set) — never a
      // separately-declared placeholder array.
      const slideoverBlock = source.slice(source.indexOf('<Slideover'));
      expect(slideoverBlock).toMatch(/filteredPosts\.map/);
    });
  });

  describe('AnalyticsClient.tsx wires the real SentimentTab into the tab shell', () => {
    it('imports SentimentTab and renders it for the sentiment tab, replacing the "not built yet" stub', () => {
      const source = readSrc(...clientPath);
      expect(source).toContain('SentimentTab');
      expect(source).not.toMatch(/Sentiment tab is not built yet/);
    });
  });

  it('documents Story 8.2 in the component SKILL.md', () => {
    const skillSource = fs.readFileSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'analytics-dashboard', 'SKILL.md'), 'utf8');
    expect(skillSource).toContain('8.2');
    expect(skillSource).toContain('SentimentTab');
  });
});
