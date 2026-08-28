# ADR-0113: Metric explainability prompt and caching

**Status:** Accepted (2026-08-28)

**Authorizes:** the prompt template, caching strategy, determinism rules, and confidence grading for `POST /v1/explain` (ADR-0078).

**Source:** `docs/product-research/feature-designs/22-metric-explainability.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Prompt engineering is a durability concern
`ADR-0078` established the `POST /v1/explain` endpoint. The endpoint is only as good as the prompt and the caching that keeps it fast and affordable. This ADR makes the prompt and cache explicit.

### 2. Dashboard users need consistent explanations
If the same metric is explained twice, the answer should be materially the same. Caching and structured prompts prevent surprise.

### 3. Confidence must reflect data quality
A metric with missing context should not claim certainty. The prompt and response must signal low confidence when data is sparse.

---

## Decision

### 1. Prompt template
```text
You are a concise data analyst explaining a dashboard metric to a non-technical user.

Metric: {metricName}
Current value: {value}
Previous value: {previousValue}
Time range: {start} to {end}
Context: {context}

Explain in one to two sentences why this metric matters and what may have caused the current value.
Do not speculate beyond the data. Do not mention internal systems. Use the metric name and time range in your answer.
Confidence: high if the data is complete and the change is clear; medium if the data is partial; low if the data is too sparse to draw a conclusion.
```

- `metricName` is human-readable (e.g. "Mentions this week").
- `context` includes the denominator, filters, and watchlist name.
- The prompt instructs the model to avoid speculation.

### 2. Structured output
```ts
{
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}
```

- The model returns JSON with `explanation` and `confidence`.
- `explanation` is one to two sentences.
- `confidence` is the model's self-assessment, not a computed score.

### 3. Caching
- Cache key: `SHA256(tenantId + metricKey + value + timeRange + filters + promptVersion)`.
- Cache store: Redis or Postgres `metric_explanation_cache`.
- TTL: 5 minutes by default, configurable per metric.
- Cache is advisory; a cache miss or `no-cache` request regenerates.

### 4. Determinism
- `temperature` is set to `0` for the explain call.
- `seed` is fixed per prompt version.
- `promptVersion` is `1` in v1 and is incremented when the template changes.

### 5. Confidence rules
- `high` — data is complete, change is clear, and the metric has at least 30 data points in the range.
- `medium` — data is partial, or the change is small, or there are 10-29 data points.
- `low` — data is sparse (< 10 points) or the metric is new/undefined.

### 6. Logging
- Every `explain` call is logged in `platform_admin_audit_log` with `metricKey` and `cache_hit`.
- This supports the Performance Review Agent and cost auditing.

---

## Consequences

1. **Consistent explanations:** same metric, same explanation, bounded time.
2. **Fast/cheap:** caching reduces LLM calls for repeated views.
3. **Trustworthy confidence:** users can see when the explanation is weak.
4. **Versioned prompts:** changing the template bumps `promptVersion` and busts the cache.

---

## Alternatives considered

1. **No caching; generate every time.**
   - *Rejected:* it is too expensive for a frequently refreshed dashboard. Caching is essential.

2. **Use the model's own explanation free-form without a template.**
   - *Rejected:* it leads to inconsistent length, tone, and speculation. The template constrains output.

3. **Precompute explanations for every metric in the analytics refresh.**
   - *Rejected:* many metric/filter combinations are never viewed. On-demand generation is cheaper.

---

## Open questions

- Should the prompt support multiple languages? If so, how is `locale` included in the cache key?
- Should `confidence` also reflect model-calibrated probabilities (e.g. logprobs)?
- How are prompt version changes rolled out without breaking existing cached results?
- Should the cache be per-tenant, or can tenants with the same metric values share cache?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/22-metric-explainability.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0078` (explain endpoint), `ADR-0002` (`AIProviderConnector`)
