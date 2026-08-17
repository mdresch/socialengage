/**
 * Contract: Story 8.3 (ADR-0054) — Conversations tab.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-83
 *
 * Intent: Story 8.3 — Conversations tab
 * Scope: social-listening-admin/{
 *   src/app/tenant/analytics/analyticsData.ts (extended — enumerateDays()
 *     exported, computePhraseFrequency(), PhraseHistoryPoint,
 *     computePhraseHistory(), AnalyticsSummary gains
 *     phraseFrequency/phraseHistory),
 *   src/app/tenant/analytics/ConversationsTab.tsx (new),
 *   src/app/tenant/analytics/AnalyticsClient.tsx (extended — Conversations
 *     tab stub replaced with the real component)
 * }. No fetchAnalyticsSummary.ts / route.ts change needed.
 *
 * Contract to encode: a real key-phrase word cloud (frequency across every
 *   post in the fetched, date-filtered set, not bucketed by sentiment —
 *   replacing the uncommitted prototype's fabricated MAIN_PHRASES
 *   fallback), a real day-bucketed phrase-frequency-over-time chart
 *   tracking only the word cloud's own top phrases (replacing the
 *   prototype's fully-static, sine-wave-generated PHRASES_HISTORY), a
 *   phrase click that toggles a client-side filter recomputing every
 *   widget from the filtered post set (the same interaction Story 8.2
 *   already established), a posts drawer reusing the existing Slideover
 *   component (Story 6.11) — no new post-detail UI — and the explicit
 *   *absence* of any Intentions/Tags widget, since no such field exists
 *   anywhere in this project's real enrichment schema.
 *
 * Per this project's own established pattern (Stories 8.1/8.2): pure
 * aggregation functions are proven by direct unit tests; component
 * rendering is proven by real renderToStaticMarkup() renders with real
 * data (never JSON.stringify(Page()), which cannot see into a Client
 * Component's own output); client-side interactive wiring this repo has no
 * DOM-interaction test runner for yet is proven structurally.
 *
 * Explicitly out of scope for this contract:
 *   - Any interactive force-directed/D3 topic-co-occurrence graph —
 *     speculative brainstorm content (docs/design/frontend-design-future-devs.md),
 *     not decided by ADR-0054 or this story.
 *   - Overview/Sources/Sentiment tabs' own behavior (Stories 8.1/8.2's own
 *     contracts).
 *   - Any change to social-listening-core or GET /v1/posts.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const conversationsTabPath = ['app', 'tenant', 'analytics', 'ConversationsTab.tsx'];
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

function post(id: string, publishedAt: string | null, sentiment: string | null, keyPhrases: string[] = []) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases, entities: [] } : null,
    rawPayload: { providerId: 'gnews', title: `Post ${id}` },
  };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-02' };

const FIXTURE_POSTS = [
  post('a', '2026-08-01T09:00:00.000Z', 'positive', ['cloud migration', 'great support']),
  post('b', '2026-08-01T10:00:00.000Z', 'negative', ['cloud migration']),
  post('c', '2026-08-02T09:00:00.000Z', 'neutral', ['pricing update']),
  post('d', null, 'positive', ['cloud migration']), // no publishedAt — excluded from history, still counted in overall frequency
];

describe('Story 8.3 — Conversations tab', () => {
  describe('analyticsData.ts — pure aggregation (unit)', () => {
    it('computePhraseFrequency() counts real keyPhrases across every post, regardless of sentiment', async () => {
      const { flattenForSentiment, computePhraseFrequency } = await import('../../src/app/tenant/analytics/analyticsData');
      const freq = computePhraseFrequency(flattenForSentiment(FIXTURE_POSTS));
      expect(freq).toEqual([
        { phrase: 'cloud migration', count: 3 },
        { phrase: 'great support', count: 1 },
        { phrase: 'pricing update', count: 1 },
      ]);
    });

    it('computePhraseFrequency() returns an empty array, never a fabricated MAIN_PHRASES-style fallback, when there is no real data', async () => {
      const { computePhraseFrequency } = await import('../../src/app/tenant/analytics/analyticsData');
      expect(computePhraseFrequency([])).toEqual([]);
    });

    it('computePhraseHistory() buckets only the given top phrases by real day, zero-post days and non-tracked phrases both real zeros', async () => {
      const { flattenForSentiment, computePhraseHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS);
      const history = computePhraseHistory(flat, RANGE, ['cloud migration', 'pricing update']);
      expect(history).toEqual([
        { date: '2026-08-01', 'cloud migration': 2, 'pricing update': 0 },
        { date: '2026-08-02', 'cloud migration': 0, 'pricing update': 1 },
      ]);
    });

    it('computePhraseHistory() excludes a post with no publishedAt from the day-bucketed series (cannot honestly place it), even though it is counted in overall frequency', async () => {
      const { flattenForSentiment, computePhraseHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS);
      const history = computePhraseHistory(flat, RANGE, ['cloud migration']);
      const total = history.reduce((sum, point) => sum + (point['cloud migration'] as number), 0);
      expect(total).toBe(2); // posts a + b, not d (no publishedAt)
    });

    it('computeAnalyticsSummary() now also returns real phraseFrequency/phraseHistory, composed once, tracking only its own top phrases', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const summary = computeAnalyticsSummary(FIXTURE_POSTS, RANGE);
      // Post 'd' has no publishedAt — filterPostsByDateRange() (which
      // computeAnalyticsSummary() applies before anything else) excludes it,
      // so the real count here is 2 (posts a + b), not the 3 a standalone
      // computePhraseFrequency() call over the unfiltered fixture set gets.
      expect(summary.phraseFrequency[0]).toEqual({ phrase: 'cloud migration', count: 2 });
      expect(summary.phraseHistory).toHaveLength(2);
      expect(Object.keys(summary.phraseHistory[0])).toContain('cloud migration');
    });
  });

  describe('AC1: key-phrase word cloud — real frequency, honest empty state, no fallback list', () => {
    it('renders real phrases with real counts', () => {
      const html = renderComponent('../../src/app/tenant/analytics/ConversationsTab', 'ConversationsTab', {
        summary: { phraseFrequency: [{ phrase: 'cloud migration', count: 3 }], phraseHistory: [], posts: [] },
        range: RANGE,
      });
      expect(html).toContain('cloud migration');
      expect(html).toContain('3');
    });

    it('renders EmptyState, never a fabricated word list, when there are zero real key phrases', () => {
      const html = renderComponent('../../src/app/tenant/analytics/ConversationsTab', 'ConversationsTab', {
        summary: { phraseFrequency: [], phraseHistory: [], posts: [] },
        range: RANGE,
      });
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  describe('AC2: phrase-frequency-over-time chart — real, day-bucketed', () => {
    it('ConversationsTab renders a real chart driven by summary.phraseHistory, not a static/sine-wave-generated array', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toMatch(/summary\.phraseHistory/);
      expect(source.toLowerCase()).not.toMatch(/sine|math\.sin/);
    });
  });

  describe('AC3: clicking a phrase filters the tab, consistent with Story 8.2\'s own phrase-filter interaction', () => {
    it('wires a real onClick toggle to phrase filter state, structurally, the same toggle convention Story 8.2 established', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toMatch(/useState/);
      expect(source).toMatch(/onClick=\{.*togglePhrase/);
      expect(source).toMatch(/prev\s*===\s*phrase\s*\?\s*null/);
    });

    it('filtering by phrase recomputes phrase frequency from only the matching real posts (unit-level proof of the recomputation the component performs)', async () => {
      const { flattenForSentiment, computePhraseFrequency } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment(FIXTURE_POSTS).filter((p) => p.keyPhrases.includes('cloud migration'));
      const freq = computePhraseFrequency(flat);
      expect(freq.find((p) => p.phrase === 'great support')).toEqual({ phrase: 'great support', count: 1 });
      expect(freq.find((p) => p.phrase === 'pricing update')).toBeUndefined();
    });
  });

  describe('AC4: no Intentions widget, no Tags widget — dropped, not ported or placeholder-ed', () => {
    it('ConversationsTab.tsx contains no Intentions/Tags widget of any kind', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source.toLowerCase()).not.toContain('intention');
      expect(source.toLowerCase()).not.toContain('tag-cloud');
      expect(source).not.toMatch(/\bTAGS\b/);
    });

    it('PostEnrichmentSummary (postDisplay.ts) has no intention/tag field for this tab to have read in the first place', () => {
      const source = readSrc('app', 'tenant', 'posts', 'postDisplay.ts');
      const interfaceMatch = source.match(/export interface PostEnrichmentSummary \{[^}]*\}/);
      expect(interfaceMatch).not.toBeNull();
      expect(interfaceMatch![0].toLowerCase()).not.toMatch(/intention|tag/);
    });
  });

  describe('AC5: clicking through to underlying posts reuses the existing Slideover pattern — no new post-detail UI', () => {
    it('ConversationsTab imports and renders the shared Slideover component, not a bespoke modal', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toContain("from '@/components/ui'");
      expect(source).toContain('Slideover');
      expect(source).not.toMatch(/class(Name)?=.*modal-backdrop/);
    });

    it('the drawer trigger opens via real state and its content maps over the real (filtered) post list', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toMatch(/setDrawerOpen\(true\)/);
      expect(source).toMatch(/isOpen=\{drawerOpen\}/);
      const slideoverBlock = source.slice(source.indexOf('<Slideover'));
      expect(slideoverBlock).toMatch(/filteredPosts\.map/);
    });
  });

  describe('AnalyticsClient.tsx wires the real ConversationsTab into the tab shell', () => {
    it('imports ConversationsTab and renders it for the conversations tab, replacing the "not built yet" stub', () => {
      const source = readSrc(...clientPath);
      expect(source).toContain('ConversationsTab');
      expect(source).not.toMatch(/not built yet/);
    });
  });

  it('documents Story 8.3 in the component SKILL.md', () => {
    const skillSource = fs.readFileSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'analytics-dashboard', 'SKILL.md'), 'utf8');
    expect(skillSource).toContain('8.3');
    expect(skillSource).toContain('ConversationsTab');
  });
});
