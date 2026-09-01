---
name: ai-sentiment-aspect-ui
description: Aspect-based AI sentiment UI components, confidence tiering, and human-in-the-loop override editing (ADR-0103)
---

# AI Sentiment Aspect UI (ADR-0103)

## Overview

Story 12.6 (ADR-0103, BRD-0103, FDD-0103) introduces rich frontend presentation for aspect-level sentiment analysis, confidence scoring, confidence tiering badges (`strong`, `moderate`, `needs-review`), multi-language badges, and human-in-the-loop override lineage in the social listening admin interface.

## Confidence Tiering (ADR-0103 Section 6)

```ts
export type SentimentConfidenceTier = 'strong' | 'moderate' | 'needs-review';

export function getSentimentConfidenceTier(confidence: number): SentimentConfidenceTier {
  if (confidence >= 0.8) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'needs-review';
}
```

## Key Components

1. **`SentimentBadge` (`src/components/sentiment/SentimentBadge.tsx`):**
   - Displays overall sentiment label (`positive`, `negative`, `neutral`, `mixed`).
   - Displays numeric percentage and tier tag (`strong` / `moderate` / `needs review`).
   - Accessible color contrast and text indicators.

2. **`SentimentAspectsList` (`src/components/sentiment/SentimentAspectsList.tsx`):**
   - Renders aspect-level sentiment breakdown table/cards with aspect name, sentiment pill, confidence %, and supporting evidence phrase.

3. **`EnrichmentEditDrawer` (`src/app/tenant/posts/EnrichmentEditDrawer.tsx`):**
   - Enables `Tenant-Admin` and `Tenant-User` to override overall sentiment, aspect sentiment, and supply an audit reason.
