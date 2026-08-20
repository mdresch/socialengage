/**
 * Contract: Story 8.10 (ADR-0064) — Location & Geospatial Insights: Country aggregation,
 * Top Countries widget, and SVG Choropleth Map.
 * See docs/user-stories/epic-8-analytics-dashboard.md#story-810
 *
 * Intent: Display country-level conversation volume, regional sentiment distribution,
 * and an interactive country choropleth map on the Analytics Overview tab (id="widget-location-insights")
 * with a 7th interactive filter dimension (activeCountryFilter / ?country=).
 * Scope: social-listening-admin/{
 *   src/app/tenant/posts/postDisplay.ts (extended — PostEnrichmentSummary and extractEnrichmentSummary()
 *     widen to extract geoCountry, geoCountryName, geoRegion, geoSource, geoConfidence; FlatPost),
 *   src/app/tenant/analytics/analyticsData.ts (extended — SentimentPost gains geo fields,
 *     computeCountryBreakdown(), CountryBreakdownItem with suppression threshold and UNKNOWN bucket,
 *     OverviewFilters gains activeCountryFilter, computeActiveChips, parseOverviewFiltersFromSearchParams,
 *     serializeOverviewFiltersToSearchString),
 *   src/app/tenant/analytics/CountryWorldMap.tsx (new — SVG world choropleth map with interactive tooltips),
 *   src/app/tenant/analytics/OverviewTab.tsx (extended — renders id="widget-location-insights",
 *     handles country click-to-filter toggle, integrates with filter chips and deep-link),
 *   src/app/globals.css (extended — styles for location insights widget, map paths, choropleth palette),
 *   .claude/skills/analytics-dashboard/SKILL.md (updated)
 * }.
 * Contract to encode:
 *   (1) PostEnrichmentSummary and extractEnrichmentSummary() in postDisplay.ts return
 *       geoCountry, geoCountryName, geoRegion, geoSource, geoConfidence;
 *   (2) computeCountryBreakdown() groups posts by geoCountry, calculates volume share,
 *       and ranks countries descending by post count;
 *   (3) computeCountryBreakdown() explicitly accounts for posts with null geoCountry in an
 *       honest "UNKNOWN" bucket ({ countryCode: 'UNKNOWN', name: 'Unknown / Unmapped' }),
 *       never hiding or discarding unmapped volume;
 *   (4) Suppression threshold: countries with < 3 posts have sentiment: null and sentimentIndex: null
 *       to prevent small-sample bias (ADR-0064 §4);
 *   (5) id="widget-location-insights" in OverviewTab.tsx renders the Top Countries list and SVG Map;
 *   (6) Click-to-filter interaction sets activeCountryFilter with AND semantics in applyOverviewFilters(),
 *       toggles off on second click, emits dismissible chip, and round-trips ?country= search param;
 *   (7) Zero matching posts renders standard EmptyState.
 *
 * Explicitly out of scope:
 *   - Sub-national / city-level point coordinates (stored in post_geo_location in future).
 *   - External paid geocoding APIs.
 *   - Any change to social-listening-core (delivered in Story 2.20).
 *   - Modifying Sentiment, Conversations, or Sources tabs.
 */

import fs from 'fs';
import path from 'path';
import {
  extractEnrichmentSummary,
  flattenPost,
} from '../../src/app/tenant/posts/postDisplay';
import {
  computeCountryBreakdown,
  flattenForSentiment,
  applyOverviewFilters,
  computeActiveChips,
  parseOverviewFiltersFromSearchParams,
  serializeOverviewFiltersToSearchString,
  EMPTY_OVERVIEW_FILTERS,
  type CountryBreakdownItem,
  type OverviewFilters,
  type SentimentPost,
} from '../../src/app/tenant/analytics/analyticsData';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderOverviewTab(props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const OverviewTab = require('../../src/app/tenant/analytics/OverviewTab').OverviewTab;
  return renderLocal(ReactLocal.createElement(OverviewTab, props));
}

describe('Story 8.10 Contract: Location & Geospatial Insights', () => {
  describe('AC1: PostEnrichmentSummary & extractEnrichmentSummary geospatial widening', () => {
    it('extracts geoCountry, geoCountryName, geoRegion, geoSource, geoConfidence from enrichment payload', () => {
      const enrichment = {
        sentiment: 'positive',
        sentimentScores: { positive: 0.9, neutral: 0.1, negative: 0.0 },
        entities: [{ text: 'London' }],
        keyPhrases: ['fintech innovation'],
        modelUsed: 'azure-ai-language:2025-01-01',
        detectedLanguage: 'en',
        geoCountry: 'GB',
        geoCountryName: 'United Kingdom',
        geoRegion: 'Northern Europe',
        geoSource: 'source',
        geoConfidence: 'high',
      };

      const summary = extractEnrichmentSummary(enrichment);
      expect(summary).not.toBeNull();
      expect(summary?.geoCountry).toBe('GB');
      expect(summary?.geoCountryName).toBe('United Kingdom');
      expect(summary?.geoRegion).toBe('Northern Europe');
      expect(summary?.geoSource).toBe('source');
      expect(summary?.geoConfidence).toBe('high');
    });

    it('returns null geo fields when enrichment omits geospatial properties', () => {
      const enrichment = {
        sentiment: 'neutral',
        entities: [],
        keyPhrases: ['test'],
        modelUsed: 'azure-openai:2025-08-07',
      };

      const summary = extractEnrichmentSummary(enrichment);
      expect(summary).not.toBeNull();
      expect(summary?.geoCountry).toBeNull();
      expect(summary?.geoCountryName).toBeNull();
      expect(summary?.geoRegion).toBeNull();
      expect(summary?.geoSource).toBeNull();
      expect(summary?.geoConfidence).toBeNull();
    });

    it('propagates geo fields through flattenPost and flattenForSentiment', () => {
      const rawPost = {
        id: 'post-1',
        tenantId: 'tenant-1',
        providerId: 'gnews',
        publishedAt: '2026-08-20T12:00:00Z',
        createdAt: '2026-08-20T12:00:00Z',
        rawPayload: { title: 'US Markets Today', url: 'https://example.com/1' },
        enrichment: {
          sentiment: 'positive',
          detectedLanguage: 'en',
          geoCountry: 'US',
          geoCountryName: 'United States',
          geoSource: 'source',
          geoConfidence: 'high',
        },
      };

      const flat = flattenPost(rawPost as any);
      expect(flat.enrichmentSummary?.geoCountry).toBe('US');
      expect(flat.enrichmentSummary?.geoCountryName).toBe('United States');

      const sentimentPosts = flattenForSentiment([rawPost as any]);
      expect(sentimentPosts.length).toBe(1);
      expect(sentimentPosts[0].geoCountry).toBe('US');
      expect(sentimentPosts[0].geoCountryName).toBe('United States');
      expect(sentimentPosts[0].geoSource).toBe('source');
      expect(sentimentPosts[0].geoConfidence).toBe('high');
    });
  });

  describe('AC2, AC3, AC4: computeCountryBreakdown aggregation, UNKNOWN bucket, & suppression threshold', () => {
    const samplePosts: SentimentPost[] = [
      // 4 US posts (positive, positive, neutral, negative) -> >= 3 threshold: sentiment calculated
      { id: '1', publishedAt: '2026-08-20', author: 'Author 1', sentiment: 'positive', keyPhrases: [], title: 'P1', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
      { id: '2', publishedAt: '2026-08-20', author: 'Author 2', sentiment: 'positive', keyPhrases: [], title: 'P2', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
      { id: '3', publishedAt: '2026-08-20', author: 'Author 3', sentiment: 'neutral', keyPhrases: [], title: 'P3', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
      { id: '4', publishedAt: '2026-08-20', author: 'Author 4', sentiment: 'negative', keyPhrases: [], title: 'P4', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },

      // 3 GB posts (positive, positive, positive) -> >= 3 threshold: sentiment calculated
      { id: '5', publishedAt: '2026-08-20', author: 'Author 5', sentiment: 'positive', keyPhrases: [], title: 'P5', language: 'en', providerId: 'newswire', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'post', geoConfidence: 'high' },
      { id: '6', publishedAt: '2026-08-20', author: 'Author 6', sentiment: 'positive', keyPhrases: [], title: 'P6', language: 'en', providerId: 'newswire', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'post', geoConfidence: 'high' },
      { id: '7', publishedAt: '2026-08-20', author: 'Author 7', sentiment: 'positive', keyPhrases: [], title: 'P7', language: 'en', providerId: 'newswire', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'post', geoConfidence: 'high' },

      // 2 NL posts (positive, negative) -> < 3 threshold: sentiment SUPPRESSED (sentiment: null, sentimentIndex: null)
      { id: '8', publishedAt: '2026-08-20', author: 'Author 8', sentiment: 'positive', keyPhrases: [], title: 'P8', language: 'nl', providerId: 'tenant-owned-feed', geoCountry: 'NL', geoCountryName: 'Netherlands', geoRegion: null, geoSource: 'post', geoConfidence: 'high' },
      { id: '9', publishedAt: '2026-08-20', author: 'Author 9', sentiment: 'negative', keyPhrases: [], title: 'P9', language: 'nl', providerId: 'tenant-owned-feed', geoCountry: 'NL', geoCountryName: 'Netherlands', geoRegion: null, geoSource: 'post', geoConfidence: 'high' },

      // 1 DE post -> < 3 threshold: sentiment SUPPRESSED
      { id: '10', publishedAt: '2026-08-20', author: 'Author 10', sentiment: 'positive', keyPhrases: [], title: 'P10', language: 'de', providerId: 'gnews', geoCountry: 'DE', geoCountryName: 'Germany', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },

      // 2 UNKNOWN posts (null geoCountry) -> explicitly grouped into UNKNOWN bucket
      { id: '11', publishedAt: '2026-08-20', author: 'Author 11', sentiment: 'neutral', keyPhrases: [], title: 'P11', language: 'en', providerId: 'facebook', geoCountry: null, geoCountryName: null, geoRegion: null, geoSource: null, geoConfidence: null },
      { id: '12', publishedAt: '2026-08-20', author: 'Author 12', sentiment: 'negative', keyPhrases: [], title: 'P12', language: 'en', providerId: 'facebook', geoCountry: null, geoCountryName: null, geoRegion: null, geoSource: null, geoConfidence: null },
    ];

    it('groups posts by country, ranks descending by volume, and calculates volume share', () => {
      const breakdown = computeCountryBreakdown(samplePosts);
      expect(breakdown.length).toBe(5); // US (4), GB (3), NL (2), UNKNOWN (2), DE (1)

      expect(breakdown[0].countryCode).toBe('US');
      expect(breakdown[0].name).toBe('United States');
      expect(breakdown[0].count).toBe(4);
      expect(breakdown[0].share).toBeCloseTo((4 / 12) * 100, 1);

      expect(breakdown[1].countryCode).toBe('GB');
      expect(breakdown[1].name).toBe('United Kingdom');
      expect(breakdown[1].count).toBe(3);
      expect(breakdown[1].share).toBeCloseTo((3 / 12) * 100, 1);
    });

    it('explicitly creates an UNKNOWN bucket for unmapped posts without omitting or averaging them away (AC3)', () => {
      const breakdown = computeCountryBreakdown(samplePosts);
      const unknownBucket = breakdown.find((b) => b.countryCode === 'UNKNOWN');
      expect(unknownBucket).toBeDefined();
      expect(unknownBucket?.name).toContain('Unknown');
      expect(unknownBucket?.count).toBe(2);
      expect(unknownBucket?.share).toBeCloseTo((2 / 12) * 100, 1);
    });

    it('suppresses sentiment scores for countries with fewer than 3 posts (AC4)', () => {
      const breakdown = computeCountryBreakdown(samplePosts);

      const us = breakdown.find((b) => b.countryCode === 'US')!;
      expect(us.count).toBe(4);
      expect(us.sentiment).not.toBeNull();
      expect(us.sentiment?.positive).toBe(2);
      expect(us.sentiment?.neutral).toBe(1);
      expect(us.sentiment?.negative).toBe(1);
      expect(us.sentimentIndex).toBeDefined();
      expect(us.sentimentIndex).not.toBeNull();

      const nl = breakdown.find((b) => b.countryCode === 'NL')!;
      expect(nl.count).toBe(2);
      expect(nl.sentiment).toBeNull();
      expect(nl.sentimentIndex).toBeNull();

      const de = breakdown.find((b) => b.countryCode === 'DE')!;
      expect(de.count).toBe(1);
      expect(de.sentiment).toBeNull();
      expect(de.sentimentIndex).toBeNull();
    });

    it('returns empty array when post list is empty', () => {
      expect(computeCountryBreakdown([])).toEqual([]);
    });
  });

  describe('AC5: Location & Geospatial Insights widget in OverviewTab.tsx', () => {
    it('declares and renders id="widget-location-insights" on the Overview tab', () => {
      const overviewSrc = readSrc('app', 'tenant', 'analytics', 'OverviewTab.tsx');
      expect(overviewSrc).toContain('id="widget-location-insights"');
      expect(overviewSrc).toContain('CountryWorldMap');
      expect(overviewSrc).toContain('computeCountryBreakdown');
    });

    it('renders top countries ranking and interactive SVG map in static markup', () => {
      const summary = {
        totalPosts: 5,
        sentimentSplit: { positive: 3, neutral: 1, negative: 1 },
        sentimentIndex: 7.0,
        volumeHistory: [{ date: '2026-08-20', count: 5 }],
        sourceBreakdown: [{ providerId: 'gnews', label: 'GNews', count: 5, sentiment: { positive: 3, neutral: 1, negative: 1 }, sentimentIndex: 7.0 }],
        sentimentPosts: [
          { id: '1', publishedAt: '2026-08-20', author: 'A1', sentiment: 'positive', keyPhrases: [], title: 'US 1', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
          { id: '2', publishedAt: '2026-08-20', author: 'A2', sentiment: 'positive', keyPhrases: [], title: 'US 2', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
          { id: '3', publishedAt: '2026-08-20', author: 'A3', sentiment: 'positive', keyPhrases: [], title: 'US 3', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
          { id: '4', publishedAt: '2026-08-20', author: 'A4', sentiment: 'neutral', keyPhrases: [], title: 'GB 1', language: 'en', providerId: 'gnews', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
          { id: '5', publishedAt: '2026-08-20', author: 'A5', sentiment: 'negative', keyPhrases: [], title: 'GB 2', language: 'en', providerId: 'gnews', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
        ],
      };

      const html = renderOverviewTab({
        summary,
        range: { startDate: '2026-08-20', endDate: '2026-08-20' },
      });

      expect(html).toContain('id="widget-location-insights"');
      expect(html).toContain('United States');
      expect(html).toContain('United Kingdom');
      expect(html).toContain('<svg');
    });
  });

  describe('AC6: Filter model integration, click-to-filter, & URL deep-linking', () => {
    it('filters posts by activeCountryFilter with AND semantics in applyOverviewFilters', () => {
      const posts: SentimentPost[] = [
        { id: '1', publishedAt: '2026-08-20', author: 'A1', sentiment: 'positive', keyPhrases: ['ai'], title: 'P1', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
        { id: '2', publishedAt: '2026-08-20', author: 'A2', sentiment: 'positive', keyPhrases: ['ai'], title: 'P2', language: 'en', providerId: 'gnews', geoCountry: 'GB', geoCountryName: 'United Kingdom', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
        { id: '3', publishedAt: '2026-08-20', author: 'A3', sentiment: 'negative', keyPhrases: ['cloud'], title: 'P3', language: 'en', providerId: 'gnews', geoCountry: 'US', geoCountryName: 'United States', geoRegion: null, geoSource: 'source', geoConfidence: 'high' },
        { id: '4', publishedAt: '2026-08-20', author: 'A4', sentiment: 'neutral', keyPhrases: ['ai'], title: 'P4', language: 'en', providerId: 'facebook', geoCountry: null, geoCountryName: null, geoRegion: null, geoSource: null, geoConfidence: null },
      ];

      // Filter by US only -> matches P1 and P3
      const usFilters: OverviewFilters = { ...EMPTY_OVERVIEW_FILTERS, activeCountryFilter: 'US' };
      const usFiltered = applyOverviewFilters(posts, usFilters);
      expect(usFiltered.map((p) => p.id)).toEqual(['1', '3']);

      // Filter by US AND positive sentiment -> matches P1 only
      const usPositiveFilters: OverviewFilters = { ...EMPTY_OVERVIEW_FILTERS, activeCountryFilter: 'US', activeSentimentFilter: 'positive' };
      const usPositiveFiltered = applyOverviewFilters(posts, usPositiveFilters);
      expect(usPositiveFiltered.map((p) => p.id)).toEqual(['1']);

      // Filter by UNKNOWN country -> matches P4 only
      const unknownFilters: OverviewFilters = { ...EMPTY_OVERVIEW_FILTERS, activeCountryFilter: 'UNKNOWN' };
      const unknownFiltered = applyOverviewFilters(posts, unknownFilters);
      expect(unknownFiltered.map((p) => p.id)).toEqual(['4']);
    });

    it('emits Country chip in computeActiveChips when activeCountryFilter is set', () => {
      const filters: OverviewFilters = { ...EMPTY_OVERVIEW_FILTERS, activeCountryFilter: 'US' };
      const chips = computeActiveChips(filters);
      expect(chips.length).toBe(1);
      expect(chips[0].type).toBe('activeCountryFilter');
      expect(chips[0].label).toBe('Country');
      expect(chips[0].value).toBe('United States');

      const unknownFilters: OverviewFilters = { ...EMPTY_OVERVIEW_FILTERS, activeCountryFilter: 'UNKNOWN' };
      const unknownChips = computeActiveChips(unknownFilters);
      expect(unknownChips.length).toBe(1);
      expect(unknownChips[0].value).toBe('Unknown / Unmapped');
    });

    it('round-trips ?country= parameter through parseOverviewFiltersFromSearchParams and serializeOverviewFiltersToSearchString', () => {
      const searchParams = new URLSearchParams('country=GB&sentiment=positive');
      const parsed = parseOverviewFiltersFromSearchParams(searchParams);
      expect(parsed.activeCountryFilter).toBe('GB');
      expect(parsed.activeSentimentFilter).toBe('positive');

      const serialized = serializeOverviewFiltersToSearchString(parsed);
      expect(serialized).toContain('country=GB');
      expect(serialized).toContain('sentiment=positive');
    });
  });

  describe('AC7: Zero matching posts renders standard EmptyState', () => {
    it('renders EmptyState within widget when no geographic data matches', () => {
      const summaryWithoutGeo = {
        totalPosts: 2,
        sentimentSplit: { positive: 1, neutral: 1, negative: 0 },
        sentimentIndex: 7.5,
        volumeHistory: [{ date: '2026-08-20', count: 2 }],
        sourceBreakdown: [{ providerId: 'facebook', label: 'Facebook', count: 2, sentiment: { positive: 1, neutral: 1, negative: 0 }, sentimentIndex: 7.5 }],
        posts: [], // 0 posts after filter
      };

      const html = renderOverviewTab({
        summary: summaryWithoutGeo,
        range: { startDate: '2026-08-20', endDate: '2026-08-20' },
      });

      expect(html).toContain('id="widget-location-insights"');
      expect(html).toContain('No geographic data');
    });
  });
});
