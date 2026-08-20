/**
 * Contract: Story 8.6 (ADR-0054) — Sources tab enrichment: per-source
 * sentiment score, per-source volume-over-time.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-86
 *
 * Intent: Story 8.6 — Sources tab enrichment
 * Scope: social-listening-admin/{
 *   src/app/tenant/analytics/analyticsData.ts (extended — SentimentPost
 *     gains providerId; computeSentimentIndex(); SourceBreakdownEntry gains
 *     sentimentIndex; computeSourceVolumeHistory(); AnalyticsSummary gains
 *     sourceVolumeHistory),
 *   src/app/tenant/analytics/SourcesTab.tsx (extended — renders each
 *     source's real sentimentIndex alongside its existing counts, and a new
 *     multi-line "Source volume over time" chart)
 * }. No social-listening-core change of any kind (ADR-0054 Decision §3).
 *
 * Contract to encode: a real, transparent 0-10 weighted sentiment index per
 *   source (positive=10, neutral=5, negative=0, averaged over the enriched
 *   total) — honestly null, never a fabricated default, when a source has
 *   zero enriched posts (closing the same category of defect Story 8.4
 *   already closed for Overview's delta: the Google AI Studio reference's
 *   sentiment gauge fell back to a hardcoded 7.6/68% when real data was
 *   sparse); a real day-and-source-bucketed volume series, a
 *   source/day combination with zero posts is a real zero, never omitted;
 *   only real, currently-present providerIds get a line in the chart, never
 *   a placeholder line for an unconnected platform.
 *
 * Per this project's established pattern (Stories 8.1-8.5): pure
 * aggregation functions are proven by direct unit tests; component
 * rendering is proven by real renderToStaticMarkup() renders with real
 * data; the widget shell is proven structurally.
 *
 * Explicitly out of scope for this contract:
 *   - Click-to-filter-by-source interaction (Sources tab stays
 *     presentational, as it already is today).
 *   - "Volume Change by Source" (a delta vs. a prior period, per source) —
 *     a real extension of Story 8.4's own period-comparison mechanism, a
 *     separate future story.
 *   - Per-widget CSV/JSON export (ADR-0054 Open Question 3, still not
 *     decided).
 *   - Any change to social-listening-core or GET /v1/posts.
 *   - Overview/Sentiment/Conversations tabs' own behavior (Stories
 *     8.1/8.2/8.4/8.5's own contracts) — unaffected by this story.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const sourcesTabPath = ['app', 'tenant', 'analytics', 'SourcesTab.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

function post(id: string, providerId: string, publishedAt: string | null, sentiment: string | null) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases: [], entities: [] } : null,
    bodyMarkdown: null,
    rawPayload: { providerId, title: `Post ${id}` },
  };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-02' };

describe('Story 8.6 — Sources tab enrichment', () => {
  describe('analyticsData.ts — pure aggregation (unit)', () => {
    it('flattenForSentiment() now also extracts real providerId', async () => {
      const { flattenForSentiment } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive')]);
      expect(flat[0].providerId).toBe('gnews');
    });

    it('computeSentimentIndex() computes a real weighted 0-10 score (positive=10, neutral=5, negative=0)', async () => {
      const { computeSentimentIndex } = await import('../../src/app/tenant/analytics/analyticsData');
      // 2 positive, 1 neutral, 1 negative -> (2*10 + 1*5 + 1*0) / 4 = 6.25
      expect(computeSentimentIndex({ positive: 2, neutral: 1, negative: 1 })).toBe(6.25);
      expect(computeSentimentIndex({ positive: 0, neutral: 0, negative: 0 })).toBeNull();
    });

    it('computeSourceBreakdown() now also returns a real sentimentIndex per source, null when that source has zero enriched posts', async () => {
      const { computeSourceBreakdown } = await import('../../src/app/tenant/analytics/analyticsData');
      const breakdown = computeSourceBreakdown([
        post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive'),
        post('b', 'gnews', '2026-08-01T09:00:00.000Z', 'positive'),
        post('c', 'newswire', '2026-08-01T09:00:00.000Z', null),
      ]);
      const gnews = breakdown.find((s) => s.providerId === 'gnews')!;
      const newswire = breakdown.find((s) => s.providerId === 'newswire')!;
      expect(gnews.sentimentIndex).toBe(10);
      expect(newswire.sentimentIndex).toBeNull();
    });

    it('computeSourceVolumeHistory() buckets real post counts per day and per source, zero combinations real zeros', async () => {
      const { flattenForSentiment, computeSourceVolumeHistory } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([
        post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive'),
        post('b', 'gnews', '2026-08-01T10:00:00.000Z', 'positive'),
        post('c', 'newswire', '2026-08-02T09:00:00.000Z', 'neutral'),
      ]);
      const history = computeSourceVolumeHistory(flat, RANGE, ['gnews', 'newswire']);
      expect(history).toEqual([
        { date: '2026-08-01', gnews: 2, newswire: 0 },
        { date: '2026-08-02', gnews: 0, newswire: 1 },
      ]);
    });

    it('computeAnalyticsSummary() now also returns real sourceVolumeHistory and per-source sentimentIndex, composed once', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const summary = computeAnalyticsSummary(
        [post('a', 'gnews', '2026-08-01T09:00:00.000Z', 'positive'), post('b', 'newswire', '2026-08-01T09:00:00.000Z', 'negative')],
        RANGE
      );
      expect(summary.sourceVolumeHistory.length).toBeGreaterThan(0);
      expect(summary.sources.find((s) => s.providerId === 'gnews')?.sentimentIndex).toBe(10);
      expect(summary.sources.find((s) => s.providerId === 'newswire')?.sentimentIndex).toBe(0);
    });
  });

  describe('AC4: SourcesTab renders real per-source sentimentIndex and a real volume-over-time chart', () => {
    it('source is driven by source.sentimentIndex and summary.sourceVolumeHistory, not a new independent computation', () => {
      const source = readSrc(...sourcesTabPath);
      expect(source).toMatch(/\.sentimentIndex/);
      expect(source).toMatch(/summary\.sourceVolumeHistory/);
    });

    it('renders a real sentiment index number for a non-empty summary', () => {
      const summary = {
        sources: [{ providerId: 'gnews', label: 'GNews', count: 2, sentiment: { positive: 2, neutral: 0, negative: 0 }, sentimentIndex: 10 }],
        sourceVolumeHistory: [{ date: '2026-08-01', gnews: 2 }],
      };
      const html = renderComponent('../../src/app/tenant/analytics/SourcesTab', 'SourcesTab', { summary });
      expect(html).toContain('10');
    });

    it('keeps the existing EmptyState for zero matched posts (Story 8.1 behavior unchanged)', () => {
      const summary = { sources: [], sourceVolumeHistory: [] };
      const html = renderComponent('../../src/app/tenant/analytics/SourcesTab', 'SourcesTab', { summary });
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  describe('Structural: every scoped file exists', () => {
    it('analyticsData.ts and SourcesTab.tsx both exist', () => {
      for (const segments of [analyticsDataPath, sourcesTabPath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });
  });
});
