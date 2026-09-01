/**
 * Contract: Story 12.6 (ADR-0103, BRD-0103, FDD-0103) — AI sentiment aspect UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-126--ai-sentiment-aspect-ui-frontend
 * and docs/adr/0103-ai-sentiment-analysis-aspect-schema.md
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  extractEnrichmentSummary,
  getSentimentConfidenceTier,
  type SentimentAspectSummary,
} from '../../src/app/tenant/posts/postDisplay';
import { SentimentBadge } from '../../src/components/sentiment/SentimentBadge';
import { SentimentAspectsList } from '../../src/components/sentiment/SentimentAspectsList';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 12.6 — AI sentiment aspect UI (frontend)', () => {
  describe('AC1: Sentiment confidence tiering and extraction', () => {
    it('computes correct confidence tiers per ADR-0103 Section 6', () => {
      expect(getSentimentConfidenceTier(0.95)).toBe('strong');
      expect(getSentimentConfidenceTier(0.80)).toBe('strong');
      expect(getSentimentConfidenceTier(0.79)).toBe('moderate');
      expect(getSentimentConfidenceTier(0.50)).toBe('moderate');
      expect(getSentimentConfidenceTier(0.49)).toBe('needs-review');
      expect(getSentimentConfidenceTier(0.10)).toBe('needs-review');
    });

    it('extracts aspect-based sentiment structures and sets tier', () => {
      const enrichment = {
        sentiment: {
          overall: 'positive',
          confidence: 0.88,
          language: 'en',
          aspects: [
            {
              aspect: 'speed',
              label: 'positive',
              confidence: 0.92,
              evidence: 'Loads in milliseconds',
            },
            {
              aspect: 'pricing',
              label: 'neutral',
              confidence: 0.65,
              evidence: 'Standard industry pricing',
            },
          ],
        },
        detectedLanguage: 'en',
      };

      const summary = extractEnrichmentSummary(enrichment);
      expect(summary).toBeDefined();
      expect(summary?.sentiment).toBe('positive');
      expect(summary?.sentimentConfidence).toBe(0.88);
      expect(summary?.sentimentTier).toBe('strong');
      expect(summary?.sentimentAspects?.length).toBe(2);
      expect(summary?.sentimentAspects?.[0].aspect).toBe('speed');
    });

    it('gracefully handles legacy string sentiment', () => {
      const legacyEnrichment = {
        sentiment: 'negative',
        sentimentScore: 0.45,
        detectedLanguage: 'nl',
      };

      const summary = extractEnrichmentSummary(legacyEnrichment);
      expect(summary?.sentiment).toBe('negative');
      expect(summary?.sentimentConfidence).toBe(0.45);
      expect(summary?.sentimentTier).toBe('needs-review');
      expect(summary?.sentimentAspects).toBeUndefined();
    });
  });

  describe('AC2: SentimentBadge component', () => {
    it('renders overall sentiment label, confidence percentage, and tier badge', () => {
      const html = renderToStaticMarkup(
        React.createElement(SentimentBadge, {
          sentiment: 'positive',
          confidence: 0.92,
          tier: 'strong',
        })
      );

      expect(html).toContain('positive');
      expect(html).toContain('92%');
      expect(html).toContain('Strong');
    });

    it('renders mixed and neutral sentiments with appropriate tier labels', () => {
      const mixedHtml = renderToStaticMarkup(
        React.createElement(SentimentBadge, {
          sentiment: 'mixed',
          confidence: 0.62,
          tier: 'moderate',
        })
      );

      expect(mixedHtml).toContain('mixed');
      expect(mixedHtml).toContain('62%');
      expect(mixedHtml).toContain('Moderate');

      const negHtml = renderToStaticMarkup(
        React.createElement(SentimentBadge, {
          sentiment: 'negative',
          confidence: 0.35,
          tier: 'needs-review',
        })
      );

      expect(negHtml).toContain('negative');
      expect(negHtml).toContain('35%');
      expect(negHtml).toContain('Needs review');
    });
  });

  describe('AC3: SentimentAspectsList component', () => {
    it('renders list of aspects with labels, confidence, and evidence quotes', () => {
      const aspects: SentimentAspectSummary[] = [
        {
          aspect: 'customer support',
          label: 'negative',
          confidence: 0.85,
          evidence: 'Support took 3 days to reply',
        },
        {
          aspect: 'ui design',
          label: 'positive',
          confidence: 0.94,
          evidence: 'The new interface is gorgeous',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SentimentAspectsList, { aspects })
      );

      expect(html).toContain('customer support');
      expect(html).toContain('Support took 3 days to reply');
      expect(html).toContain('ui design');
      expect(html).toContain('The new interface is gorgeous');
      expect(html).toContain('94%');
    });

    it('renders empty fallback message when no aspects are present', () => {
      const html = renderToStaticMarkup(
        React.createElement(SentimentAspectsList, { aspects: [] })
      );
      expect(html).toContain('No aspect-level sentiment detected');
    });
  });

  describe('AC4: PostDetailPanel and EnrichmentEditDrawer integration', () => {
    it('integrates SentimentBadge and SentimentAspectsList into PostDetailPanel', () => {
      const panelSrc = readSrc('app', 'tenant', 'posts', 'PostDetailPanel.tsx');
      expect(panelSrc).toContain('SentimentBadge');
      expect(panelSrc).toContain('SentimentAspectsList');
      expect(panelSrc).toContain('Aspect-Level Sentiment Breakdown');
    });

    it('EnrichmentEditDrawer supports mixed sentiment and override reason', () => {
      const drawerSrc = readSrc('app', 'tenant', 'posts', 'EnrichmentEditDrawer.tsx');
      expect(drawerSrc).toContain("'mixed'");
      expect(drawerSrc).toContain('reason');
      expect(drawerSrc).toContain('Override Reason');
    });
  });
});
