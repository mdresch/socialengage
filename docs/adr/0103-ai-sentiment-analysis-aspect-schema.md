# ADR-0103: AI sentiment analysis aspect schema

**Status:** Accepted (2026-08-28)

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

### 6. Revision (2026-08-28) — confidence tiering for `overall`

This ADR's own Open Questions section (below) left the confidence threshold for `overall` label assignment unresolved ("0.6? 0.7?"). Competitive research (`03-ai-sentiment-analysis-deep-research.md`) found a concrete, published precedent: Sprout Social's BERT-based sentiment model treats a score above 80% as "strong" and flags anything below 50% as needing review (https://support.sproutsocial.com/hc/en-us/articles/18814496971533-How-does-Sprout-determine-sentiment). This resolves the open question with a documented industry baseline rather than an invented number:

`enrichment.sentiment` gains a derived (not separately stored) confidence tier, computed from `confidence` at read time by the post feed and dashboard:
- `confidence >= 0.8` → `strong`
- `0.5 <= confidence < 0.8` → `moderate`
- `confidence < 0.5` → `needs-review`

This is a UI/consumption-layer addition — the stored schema (§1) is unchanged; `confidence` remains the single stored numeric field, and the tiering is a presentation convention for the `SentimentBadge` (Story 12.6), not a new database column.

### 7. Revision (2026-08-28) — capture pre-override value for future model-quality signal

Competitive research found that Meltwater treats manual sentiment corrections as a retraining signal (its GloVe+CNN model upgrade, informed partly by tracked corrections, cut override volume by over 50% — https://underthehood.meltwater.com/blog/2019/08/22/deep-learning-models-for-sentiment-analysis/), while Brandwatch explicitly does not feed corrections back into its model (https://social-media-management-help.brandwatch.com/en/articles/12767975-sentiment-and-emotion-analysis). This ADR did not previously make an explicit choice between these two postures.

SocialEngage adopts a low-cost middle path for v1: capture the AI-derived value at the moment of override, without committing to any retraining pipeline. The `overridden` block (§1, §3) gains one additional field:

```ts
overridden?: {
  by: string;
  at: string;
  reason?: string;
  previousValue: { overall: string; confidence: number };  // the AI-derived value at the moment of override
}
```

This preserves the correction as a durable, queryable signal (`enrichment.sentiment.overridden.previousValue`) for a future retraining or model-evaluation pipeline, at near-zero implementation cost — `PATCH /v1/posts/:id/enrichment` already reads the existing `sentiment.overall`/`confidence` before applying the update (§3), so capturing it costs one additional field write, not a new code path.

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

## Open Questions

- [ ] **[Q-0103-1]** How many aspect categories should the provider return in v1? A fixed set or free-form?
- [ ] **[Q-0103-2]** Should the AI provider be asked to return aspects in the post language or a canonical set?
- [ ] **[Q-0103-3]** How is `confidence` thresholded for `overall` label assignment? 0.6? 0.7?
- [ ] **[Q-0103-4]** Should `SentimentDailyCount` include aspect-level rollups now or in v2?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/03-ai-sentiment-analysis.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0071` (human-in-the-loop enrichment overrides), `ADR-0087` (precomputed sentiment counts), `ADR-0002` (`AIProviderConnector`)
