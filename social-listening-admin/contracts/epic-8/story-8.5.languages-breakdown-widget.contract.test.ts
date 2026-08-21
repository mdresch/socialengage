/**
 * Contract: Story 8.5 (ADR-0055) — Languages breakdown widget.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-85
 *
 * Intent: Story 8.5 — Languages breakdown widget
 * Scope: social-listening-admin/{
 *   src/app/tenant/posts/postDisplay.ts (extended — PostEnrichmentSummary
 *     gains language: string | null, read from enrichment.detectedLanguage,
 *     the same field both real AIProviderConnectors already compute and
 *     persist, per ADR-0055 Context — zero social-listening-core change),
 *   src/app/tenant/analytics/analyticsData.ts (extended — SentimentPost
 *     gains language, LanguageBreakdownEntry, computeLanguageBreakdown(),
 *     AnalyticsSummary gains languages),
 *   src/app/tenant/analytics/ConversationsTab.tsx (extended — a Languages
 *     breakdown widget, reusing the existing client-side filter-and-
 *     recompute + Slideover pattern Story 8.3 already established for
 *     phrase filtering, now generalized to phrase-or-language)
 * }. No social-listening-core change of any kind (ADR-0055 Decision §1).
 *
 * Contract to encode: a real, per-language post count aggregated from
 *   enrichment.detectedLanguage across the fetched, date-filtered post set
 *   — never a fabricated language list; posts with no enrichment at all are
 *   excluded from the aggregation entirely, not shown as an "unknown"
 *   bucket (consistent with how computeSentimentSplit()/computeSourceBreakdown()
 *   already treat un-enriched posts); a real ISO-639-1-to-display-name
 *   mapping for at least the languages this project's real enrichment can
 *   plausibly produce, falling back to the raw code for anything unmapped
 *   (never silently dropped); a zero-result range renders the existing
 *   EmptyState; clicking a language filters the currently displayed post
 *   set, consistent with Story 8.2/8.3's own filter-by-attribute pattern.
 *
 * Per this project's established pattern (Stories 8.1-8.4): pure
 * aggregation functions are proven by direct unit tests; component
 * rendering is proven by real renderToStaticMarkup() renders with real
 * data; client-side interactive wiring is proven structurally.
 *
 * Explicitly out of scope for this contract:
 *   - GNews's own rawPayload.lang/rawPayload.source.country fields
 *     (ADR-0055 Context/Decision §2 — named, not built, not a Location
 *     substitute).
 *   - Any change to social-listening-core or GET /v1/posts.
 *   - Surfacing `language` on the existing post feed/detail view (Story
 *     6.11/6.16) — ADR-0055 Open Question 4, a reasonable future follow-up,
 *     not this story.
 *   - Overview/Sources/Sentiment tabs' own behavior (Stories 8.1/8.2's own
 *     contracts) and Conversations' own phrase-cloud/phrase-history
 *     behavior (Story 8.3's own contract) — unaffected by this story.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const postDisplayPath = ['app', 'tenant', 'posts', 'postDisplay.ts'];
const analyticsDataPath = ['app', 'tenant', 'analytics', 'analyticsData.ts'];
const conversationsTabPath = ['app', 'tenant', 'analytics', 'ConversationsTab.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

function post(id: string, publishedAt: string | null, sentiment: string | null, detectedLanguage?: string) {
  return {
    id,
    createdAt: '2026-08-01T00:00:00.000Z',
    publishedAt,
    enrichment: sentiment ? { sentiment, keyPhrases: [], entities: [], detectedLanguage } : null,
    bodyMarkdown: null,
    rawPayload: { providerId: 'gnews', title: `Post ${id}` },
  };
}

const RANGE = { startDate: '2026-08-01', endDate: '2026-08-02' };

describe('Story 8.5 — Languages breakdown widget', () => {
  describe('postDisplay.ts — extractEnrichmentSummary() gains a real language field', () => {
    it('reads enrichment.detectedLanguage into PostEnrichmentSummary.language', async () => {
      const { extractEnrichmentSummary } = await import('../../src/app/tenant/posts/postDisplay');
      const summary = extractEnrichmentSummary({ sentiment: 'positive', keyPhrases: [], entities: [], detectedLanguage: 'en' });
      expect(summary?.language).toBe('en');
    });

    it('returns language: null when enrichment.detectedLanguage is absent — never fabricated', async () => {
      const { extractEnrichmentSummary } = await import('../../src/app/tenant/posts/postDisplay');
      const summary = extractEnrichmentSummary({ sentiment: 'positive', keyPhrases: [], entities: [] });
      expect(summary?.language).toBeNull();
    });
  });

  describe('analyticsData.ts — pure aggregation (unit)', () => {
    it('computeLanguageBreakdown() counts real posts per language, ranked descending', async () => {
      const { flattenForSentiment, computeLanguageBreakdown } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([
        post('a', '2026-08-01T09:00:00.000Z', 'positive', 'en'),
        post('b', '2026-08-01T10:00:00.000Z', 'negative', 'en'),
        post('c', '2026-08-02T09:00:00.000Z', 'neutral', 'fr'),
      ]);
      expect(computeLanguageBreakdown(flat)).toEqual([
        { code: 'en', label: 'English', count: 2 },
        { code: 'fr', label: 'French', count: 1 },
      ]);
    });

    it('excludes un-enriched posts entirely — never an "unknown language" bucket', async () => {
      const { flattenForSentiment, computeLanguageBreakdown } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([post('a', '2026-08-01T09:00:00.000Z', null)]);
      expect(computeLanguageBreakdown(flat)).toEqual([]);
    });

    it('falls back to the raw code for an unmapped language, never silently dropping it', async () => {
      const { flattenForSentiment, computeLanguageBreakdown } = await import('../../src/app/tenant/analytics/analyticsData');
      const flat = flattenForSentiment([post('a', '2026-08-01T09:00:00.000Z', 'positive', 'xx')]);
      expect(computeLanguageBreakdown(flat)).toEqual([{ code: 'xx', label: 'xx', count: 1 }]);
    });

    it('computeAnalyticsSummary() now also returns real languages, composed once', async () => {
      const { computeAnalyticsSummary } = await import('../../src/app/tenant/analytics/analyticsData');
      const summary = computeAnalyticsSummary(
        [post('a', '2026-08-01T09:00:00.000Z', 'positive', 'en'), post('b', '2026-08-01T09:00:00.000Z', 'negative', 'de')],
        RANGE
      );
      expect(summary.languages.map((l) => l.code).sort()).toEqual(['de', 'en']);
    });
  });

  describe('AC2/AC3: ConversationsTab renders a real Languages widget, honest empty state', () => {
    it('source is driven by summary.languages, not a new independent computation', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toMatch(/summary\.languages/);
    });

    it('renders real language labels/counts for a non-empty summary', () => {
      const summary = {
        phraseFrequency: [],
        phraseHistory: [],
        posts: [],
        languages: [{ code: 'en', label: 'English', count: 3 }],
      };
      const html = renderComponent('../../src/app/tenant/analytics/ConversationsTab', 'ConversationsTab', { summary, range: RANGE });
      expect(html).toContain('English');
      expect(html).toContain('3');
    });

    it('renders EmptyState for the Languages widget, never a fabricated list, when there are zero real languages', () => {
      const summary = { phraseFrequency: [{ phrase: 'x', count: 1 }], phraseHistory: [], posts: [], languages: [] };
      const html = renderComponent('../../src/app/tenant/analytics/ConversationsTab', 'ConversationsTab', { summary, range: RANGE });
      expect(html).toContain('id="widget-languages"');
      expect(html).toContain('data-testid="empty-state"');
    });
  });

  describe('AC4: clicking a language filters the currently displayed post set', () => {
    it('wires a real onClick toggle to a language filter, structurally, the same toggle convention Story 8.2/8.3 established', () => {
      const source = readSrc(...conversationsTabPath);
      expect(source).toMatch(/toggleLanguage|type:\s*['"]language['"]/);
    });
  });

  describe('Structural: every scoped file exists', () => {
    it('postDisplay.ts, analyticsData.ts, and ConversationsTab.tsx all exist', () => {
      for (const segments of [postDisplayPath, analyticsDataPath, conversationsTabPath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });
  });
});
