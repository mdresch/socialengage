# ADR-0103: AI sentiment analysis aspect schema

**Status:** Proposed (2026-08-23)

**Authorizes:** an `enrichment.sentiment` schema with optional aspect-based sentiment and per-language support, plus a confidence grade and a human-override path.

**Source:** `docs/product-research/feature-designs/03-ai-sentiment-analysis.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Sentiment is more than a single label
`docs/product-research/feature-designs/03-ai-sentiment-analysis.md` describes sentiment analysis. The current `enrichment` JSONB has a `sentiment` string. The product needs richer, aspect-based sentiment (e.g. positive about product, negative about support) and multi-language support.

### 2. Human-in-the-loop overrides exist
`ADR-0071` already added `PATCH /v1/posts/:id/enrichment` for human overrides. The sentiment schema must support overrides without breaking the downstream pipeline.

### 3. Downstream features consume sentiment
`09-real-time-alerts`, `08-dashboards-and-analytics`, and `24-daily-digest-email` all use `sentiment`. The new schema must remain queryable and aggregatable.

---

## Decision

### 1. New `enrichment.sentiment` schema
```ts
{
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;            // 0.0–1.0
  language: string;              // ISO 639-1, e.g. 'en'
  aspects?: Array<{
    aspect: string;              // e.g. 'product', 'support', 'price'
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    confidence: number;
    evidence: string;            // the sentence or phrase supporting the label
  }>;
  overridden?: {
    by: string;                  // user_id
    at: string;                  // ISO 8601
    reason?: string;
  };
}
```

### 2. AI provider contract
- `AIProviderConnector.analyzeSentiment(text: string, language?: string)` returns the schema above.
- `Azure AI Language` and `Azure OpenAI` are both valid providers; the schema is provider-agnostic.
- The provider should detect language if not provided.
- If the provider cannot analyze the text, it returns `overall: 'neutral'`, `confidence: 0`, and `language: 'unknown'`.

### 3. Override semantics
- `PATCH /v1/posts/:id/enrichment` can update `sentiment.overall` or `sentiment.aspects`.
- When overridden, the `overridden` block is added and `enrichment.override` is set to `true`.
- Dashboards and alerts use the overridden value.
- Re-enrichment (if ever re-run) should not overwrite an overridden field unless explicitly requested.

### 4. Backwards compatibility
- Existing `enrichment.sentiment` strings are migrated to the new object as `{ overall: <old>, confidence: 0.5 }`.
- Code that reads `enrichment.sentiment` as a string should be updated to read `enrichment.sentiment.overall`.
- Queries that filter by `sentiment` use `enrichment->'sentiment'->>'overall'`.

### 5. Aspect aggregation
- Aspect labels are stored in `sentiment.aspects[].label`.
- Dashboards can group by `overall` or by aspect.
- `SentimentDailyCount` (ADR-0087) counts `overall` only. Aspect-level counts can be added later.

---

## Consequences

1. **Richer sentiment signal:** users can see not just positive/negative, but what the post is positive or negative about.
2. **Multi-language support:** `language` field enables per-language dashboards and model selection.
3. **Override path:** analysts can correct sentiment without breaking downstream features.
4. **Migration required:** existing data and queries must be updated to the new shape.

---

## Alternatives considered

1. **Keep a single `sentiment` string and store aspects in a separate `enrichment.aspects` array.**
   - *Rejected:* it fragments the sentiment signal. Aspects are part of the sentiment analysis and belong in the same object.

2. **Support continuous sentiment scores (-1 to +1) instead of labels.**
   - *Rejected:* users and downstream features expect discrete labels. The score can be added later if needed.

3. **Store the full AI provider response in `enrichment` for debugging.**
   - *Rejected:* it bloats the row and may contain provider-specific noise. Only the canonical schema is stored.

---

## Open questions

- How many aspect categories should the provider return in v1? A fixed set or free-form?
- Should the AI provider be asked to return aspects in the post language or a canonical set?
- How is `confidence` thresholded for `overall` label assignment? 0.6? 0.7?
- Should `SentimentDailyCount` include aspect-level rollups now or in v2?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0071` (human-in-the-loop enrichment overrides), `ADR-0087` (precomputed sentiment counts), `ADR-0002` (`AIProviderConnector`)
