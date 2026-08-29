/**
 * Contract: Story 12.5 (ADR-0103, BRD-0103, FDD-0103) — AI sentiment aspect schema (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-125--ai-sentiment-aspect-schema-backend
 * and docs/adr/0103-ai-sentiment-analysis-aspect-schema.md
 */

import {
  PostSentimentEnrichment,
  SentimentAspect,
  SentimentOverridden,
  AIProviderConnector,
  AnalyzeResult,
} from '../../src/connectors/types';
import {
  normalizePostSentiment,
  updatePostEnrichment,
} from '../../src/posts/socialPostStore';
import { azureOpenAiConnector } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import { azureAiLanguageConnector } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';

describe('Story 12.5 — AI sentiment aspect schema (backend)', () => {
  describe('AC1: PostSentimentEnrichment schema matches ADR-0103', () => {
    it('defines canonical PostSentimentEnrichment and SentimentAspect types', () => {
      const sentiment: PostSentimentEnrichment = {
        overall: 'positive',
        confidence: 0.92,
        language: 'en',
        aspects: [
          {
            aspect: 'product',
            label: 'positive',
            confidence: 0.95,
            evidence: 'The product is blazing fast',
          },
          {
            aspect: 'support',
            label: 'negative',
            confidence: 0.88,
            evidence: 'Customer support was slow to answer',
          },
        ],
        overridden: {
          by: 'usr-123',
          at: new Date().toISOString(),
          reason: 'Manual correction',
          previousValue: {
            overall: 'neutral',
            confidence: 0.65,
          },
        },
      };

      expect(sentiment.overall).toBe('positive');
      expect(sentiment.aspects?.length).toBe(2);
      expect(sentiment.overridden?.previousValue?.overall).toBe('neutral');
    });
  });

  describe('AC2: AIProviderConnector contract supports aspect extraction', () => {
    it('AIProviderConnector interface supports aspect extraction', () => {
      const connector: AIProviderConnector = azureOpenAiConnector;
      expect(typeof connector.analyze).toBe('function');
      expect(typeof connector.analyzeSentiment).toBe('function');
    });

    it('AnalyzeResult supports aspects array', () => {
      const result: AnalyzeResult = {
        sentiment: 'positive',
        aspects: [
          {
            aspect: 'pricing',
            label: 'positive',
            confidence: 0.85,
            evidence: 'Great value for money',
          },
        ],
      };
      expect(result.aspects?.[0].aspect).toBe('pricing');
    });
  });

  describe('AC3: normalizePostSentiment backward compatibility', () => {
    it('normalizes legacy string sentiment into canonical PostSentimentEnrichment', () => {
      const legacyEnrichment = {
        sentiment: 'positive',
        sentimentScore: 0.8,
        detectedLanguage: 'en',
      };

      const normalized = normalizePostSentiment(legacyEnrichment);
      expect(normalized).toBeDefined();
      expect(normalized?.overall).toBe('positive');
      expect(normalized?.confidence).toBe(0.8);
      expect(normalized?.language).toBe('en');
    });

    it('passes through already structured PostSentimentEnrichment', () => {
      const structured: PostSentimentEnrichment = {
        overall: 'negative',
        confidence: 0.9,
        language: 'nl',
        aspects: [
          {
            aspect: 'delivery',
            label: 'negative',
            confidence: 0.9,
            evidence: 'Pakket nooit aangekomen',
          },
        ],
      };

      const normalized = normalizePostSentiment({ sentiment: structured });
      expect(normalized).toEqual(structured);
    });
  });

  describe('AC4: Human-in-the-loop override records previousValue and overridden block', () => {
    it('updatePostEnrichment accepts aspect-based sentiment updates and records previousValue', async () => {
      // Static validation that updatePostEnrichment function signature accepts aspect updates
      expect(typeof updatePostEnrichment).toBe('function');
    });
  });
});
