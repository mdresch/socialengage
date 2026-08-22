# ADR-0078: Metric explainability endpoint

**Status:** Proposed (2026-08-23)

**Authorizes:** a `POST /v1/explain` endpoint that returns a short, plain-language explanation for any dashboard metric, plus the UI conventions for when and how those explanations are shown.

**Source:** `docs/product-research/feature-designs/22-metric-explainability.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Dashboards contain numbers users may not interpret
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and the built Epic 8 (Analytics Dashboard) expose metrics such as mention volume, sentiment share, source mix, and reach. Feature design `22-metric-explainability.md` identifies a `Tenant-Reader` and `Tenant-User` need: a short, one-sentence explanation of what a number means, why it changed, and why it matters, without requiring an analyst.

### 2. The project already has an `AIProviderConnector` abstraction
`ADR-0002` and `ADR-0038` established a provider-agnostic `AIProviderConnector` for enrichment (sentiment, key phrases) and generation. `Azure OpenAI` is already wired through this interface and is the natural provider for metric explanations. `Azure AI Language` is intentionally not used for free-text generation.

### 3. Explanations are transient, not primary data
An explanation is a derived, disposable view over aggregate data. It should not be stored as a fact and should not expose raw post bodies to the AI provider. It is a good fit for on-demand generation with short-lived caching, not pre-computation.

---

## Decision

### 1. New `POST /v1/explain` endpoint
```ts
// Request
{
  metricKey: string;             // e.g. "sentiment-negative-weekly"
  value: number | string;         // the current metric value
  context: {
    widgetId?: string;
    watchlistId?: string;
    timeRange: { start: ISOString; end: ISOString };
    previousValue?: number | string;
    denominator?: number;         // e.g. total mentions for a percentage
  };
  locale?: string;                // default 'en'
}

// Response (HTTP 200)
{
  explanation: string;            // one to two sentences
  confidence: 'high' | 'medium' | 'low';
  generationId: string;           // for support/audit, not for caching by client
}
```

- The endpoint is tenant-scoped and `app_user` / RLS-gated.
- `metricKey` is a known, allowlisted key; unknown keys return `400 UNKNOWN_METRIC_KEY`.
- The prompt sent to `AIProviderConnector` contains only aggregate data: metric name, value, time range, previous value, and optional denominator. No raw post bodies or PII are sent.
- `confidence` is derived from the model's own assessment and the quality of the input context.

### 2. UI conventions for displaying explanations
- **No loader** for fast calls (< 300 ms).
- **Skeleton or shimmer** for medium-latency calls (300 ms – 1.5 s).
- **Detailed message / progress bar** for slow calls (> 1.5 s); in practice most explanations should complete well under 1 s.
- **Inline text or tooltip** next to the metric, accessible to screen readers.
- **Per-widget opt-out:** each widget can disable explanations if the metric is self-explanatory.

### 3. Optional, short-lived server-side caching
- Cache key: `(tenantId, metricKey, value, timeRange, locale)`.
- TTL: 5 minutes by default, configurable per metric.
- Cache is advisory; a cache miss regenerates the explanation.
- RLS means cache entries are scoped by `tenant_id` and cannot leak across tenants.

### 4. Determinism and guardrails
- The prompt instructs the model to explain only the data provided and to avoid speculation about causation beyond what is in the context.
- Low-confidence explanations are shown with a warning icon and the user can request a re-generation.
- If the model refuses or returns unsafe content, the endpoint returns `200` with `explanation: null` and `confidence: 'low'`, and the UI falls back to a static help link.

---

## Consequences

1. **Improved legibility for non-analyst users:** `Tenant-Reader` and `Tenant-User` can understand metrics without asking an analyst.
2. **Additional AI cost per view:** every explained metric costs one LLM call. Caching and opt-out controls are required to keep cost bounded.
3. **No new persisted data:** explanations are generated on demand and do not require a schema migration.
4. **Prompt engineering becomes a durability concern:** the explanation prompt must be versioned and tested like other `AIProviderConnector` contracts.
5. **Foundation for future features:** `24-daily-digest-email.md`, `25-topic-evolution-timeline.md`, and `28-semantic-search-rag.md` can all consume `POST /v1/explain` for grounded summaries.

---

## Alternatives considered

1. **Pre-generate and store explanations for every widget on every dashboard load.**
   - *Rejected:* it adds write load and storage for data that may never be read, and explanations are context-sensitive (time range, filters).

2. **Static help text per metric instead of AI-generated prose.**
   - *Rejected:* it does not answer the actual user question, which is usually "why is this number what it is right now?" Static text cannot reflect the current value or change.

3. **Generate explanations entirely client-side against a small local model.**
   - *Rejected:* it duplicates the provider abstraction, introduces a new model into the browser, and is inconsistent with the project's existing `AIProviderConnector` pattern.

---

## Open questions

- Should the endpoint support multi-sentence, "analyst-depth" explanations behind an `depth: 'brief' | 'detailed'` flag?
- Should explanations be included in `GET /v1/analytics/dashboard` by default, or fetched lazily by the UI?
- How are explanation prompts versioned and regression-tested?
- Should `Tenant-Admin` be able to disable metric explainability tenant-wide to control cost?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/22-metric-explainability.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0038` (Azure OpenAI enrichment)
