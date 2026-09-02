---
name: ai-sentiment-aspect-schema
description: Aspect-based AI sentiment enrichment schema, confidence tiering, and human-in-the-loop override lineage (ADR-0103)
---

# AI Sentiment Aspect Schema (ADR-0103)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-12/story-12.5.ai-sentiment-aspect-schema.contract.test.ts` — Story 12.5 contract test.

## Overview

Story 12.5 (ADR-0103, BRD-0103, FDD-0103) enhances `enrichment.sentiment` in `social_posts` from a flat string into a rich, structured object with aspect-level sentiment breakdown, confidence scores, detected language, and human override lineage.

## Schema Structure

```ts
export interface SentimentAspect {
  aspect: string;              // e.g. 'product', 'support', 'pricing'
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;          // 0.0 - 1.0
  evidence: string;            // quote/sentence from the text
}

export interface SentimentOverridden {
  by: string;                  // user_id
  at: string;                  // ISO 8601
  reason?: string;
  previousValue?: {
    overall: string;
    confidence: number;
  };
}

export interface PostSentimentEnrichment {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;          // 0.0 - 1.0
  language: string;            // ISO 639-1
  aspects?: SentimentAspect[];
  overridden?: SentimentOverridden;
}
```

## AI Provider Contract

- `AIProviderConnector` provides optional `analyzeSentiment?(text: string, language?: string, credential?: string): Promise<PostSentimentEnrichment>`.
- `AnalyzeResult` includes optional `aspects?: SentimentAspect[]` and `sentimentObject?: PostSentimentEnrichment`.

## Override Semantics (`PATCH /v1/posts/:id/enrichment`)

1. Accepts `sentiment` as a label string (`'positive'`, `'negative'`, `'neutral'`, `'mixed'`) or full `PostSentimentEnrichment` object with `aspects` and `reason`.
2. Captures `previousValue: { overall, confidence }` from the existing AI-derived sentiment prior to manual update.
3. Sets `enrichment.override.isOverridden = true` and writes `sentiment.overridden = { by, at, reason, previousValue }`.

## Backward Compatibility

- Existing flat strings in `enrichment.sentiment` (e.g. `'positive'`) are normalized at read/edit time using `normalizePostSentiment(enrichment)`.
- SQL queries and aggregations access the overall sentiment via `COALESCE(enrichment->'sentiment'->>'overall', enrichment->>'sentiment')`.
