# ADR-0078: Metric explainability endpoint

**Status:** Accepted (2026-08-23)

**Acceptance note (2026-08-23).** Accepted per the structured review in this session; the input-sanitization, rate-limiting, deterministic confidence, and tenant kill-switch criteria were incorporated.

**Authorizes:** a `POST /v1/explain` endpoint that returns a short, plain-language explanation for any dashboard metric, plus the UI conventions for when and how those explanations are shown.

**Source:** `docs/product-research/feature-designs/22-metric-explainability.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Dashboards contain numbers users may not interpret
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and the built Epic 8 (Analytics Dashboard) expose metrics such as mention volume, sentiment share, source mix, and reach. Feature design `22-metric-explainability.md` identifies a `Tenant-Reader` and `Tenant-User` *persona* need: a short, one-sentence explanation of what a number means, why it changed, and why it matters, without requiring an analyst. The actual application roles that may call this endpoint are `tenant_user` and `tenant_admin`.

### 2. The project already has an `AIProviderConnector` abstraction
`ADR-0002` and `ADR-0038` established a provider-agnostic `AIProviderConnector` for enrichment (sentiment, key phrases) and generation. `Azure OpenAI` is already wired through this interface and is the natural provider for metric explanations. `Azure AI Language` is intentionally not used for free-text generation.

### 3. Explanations are transient, not primary data
An explanation is a derived, disposable view over aggregate data. It should not be stored as a fact and should not expose raw post bodies to the AI provider. It is a good fit for on-demand generation with short-lived in-memory caching, not pre-computation.

---

## Decision

### 1. New `POST /v1/explain` endpoint
```ts
// Request
{
  metricKey: string;             // e.g. "sentiment-negative-weekly"; see allowlist below
  value: number | string;         // current metric value; string only for labelled enumerations
  context: {
    widgetId?: string;            // UI analytics widget id; not sent to the AI provider
    watchlistId?: string;         // filters the underlying metric; not sent to the AI provider
    timeRange: { start: ISOString; end: ISOString }; // UTC ISO 8601; tenant timezone is a UI concern
    previousValue?: number | string;
    denominator?: number;         // e.g. total mentions for a percentage; must be >= 1 if present
  };
  locale?: string;                // default 'en'
}

// Response (HTTP 200)
{
  explanation: string | null;     // one to two sentences, or null on refusal/unsafe content
  confidence: 'high' | 'medium' | 'low';
  generationId: string;           // client-visible correlation id; no server-side audit log in v1
  fallbackReason?: 'content_filtered' | 'insufficient_data' | 'rate_limited' | 'model_error';
}
```

- The endpoint is tenant-scoped, accessible to the resolved `tenant_user` or `tenant_admin` application role, and RLS-enforced through the `app_user` Postgres role.
- `metricKey` is allowlisted against a core-maintained `MetricKey` enum in `social-listening-core`. The allowlist doubles as the metric-name registry: the prompt resolves a human-readable `metricName` from the matching entry. Unknown keys return `400 UNKNOWN_METRIC_KEY` with the project's standard error envelope.
- The prompt sent to `AIProviderConnector` contains only aggregate data: `metricName`, `value`, `timeRange`, `previousValue`, and optional `denominator`. No raw post bodies, `widgetId`, `watchlistId`, or PII are sent.
- `value` is `number` for counts, percentages, and rates; `string` only for small, labelled enumerations such as trend direction (e.g. `"trending-up"`). Percentages are passed as decimals (`0.42`) with `denominator`. `previousValue` follows the same type rule as `value`. String values are validated against `/^[a-z0-9-]+$/` to prevent prompt injection and arbitrary prose in numeric fields.
- `confidence` is derived **deterministically on the server** from context completeness, never from the model's own self-assessment. `high` when all of `value`, `timeRange`, a meaningful `previousValue`, and (for percentages) a `denominator >= 100` are present; `medium` when at least one contextual signal is missing but the response is valid; `low` when the model refuses, the safety/groundedness guardrail rejects the output, required fields are missing, or the output fails schema/length validation. The model is not asked to rate its own confidence.
- The endpoint must call `acquireForAiModel()` through the existing `RequestGate` per `ADR-0003`/`ADR-0020`, so each tenant's LLM usage is bounded and cannot exhaust shared capacity or the provider's per-model rate limit.
- In addition to `RequestGate`, the endpoint is protected by a dedicated user-scoped token bucket: **20 requests per minute per user**, and **max 5 concurrent in-flight explanations per tenant**. This prevents buggy UI loops and "denial-of-wallet" abuse. Exceeding either returns `429 TOO_MANY_REQUESTS`.
- The `tenants` table exposes an `explanations_enabled` feature flag (default `true`), settable by `tenant_admin`. When `false`, the endpoint returns `403 EXPLAINABILITY_DISABLED` without calling the AI provider. The flag is the tenant-wide kill switch for cost and compliance governance.

### 2. UI conventions for displaying explanations (non-normative product guidance)
The following are product conventions for `social-listening-admin`, not API-level requirements:
- **Cache hit:** render the explanation instantly; no loading state is needed.
- **Cache miss / initial fetch:** show a subtle inline skeleton or shimmer immediately upon trigger; on a successful response, fade in the one to two sentence explanation. Do not leave the user-facing metric without feedback, since a cache-miss LLM round-trip is typically 600 ms – 1.8 s.
- **Slow calls (> 1.5 s):** show a brief "Explaining this metric..." message; most calls should not need this.
- **Inline text or tooltip** next to the metric, accessible to screen readers.
- **Per-widget opt-out:** each widget can disable explanations if the metric is self-explanatory.

### 3. Optional, short-lived in-memory caching (v1)
- v1 cache is in-process only. No shared cache store and no schema migration is authorized.
- Cache key: `(tenantId, metricKey, value, timeRange, locale)`.
- TTL: 5 minutes by default, configurable per metric.
- Cache is advisory; a cache miss regenerates the explanation.
- Because the cache is in-process, it is not shared across server instances or restarts. This is a deliberate v1 cost-vs-complexity trade-off; a shared cache would require a new persistence tier and is not decided here.

### 4. Determinism and guardrails
- The prompt is constructed as a JSON system message with structured template variables, not by concatenating user input strings. This prevents prompt injection even if a string `value` slips through validation.
- The prompt instructs the model to explain only the data provided and to avoid speculation about causation beyond what is in the context.
- Low-confidence explanations are shown with a warning icon and the user can request a re-generation.
- If the model refuses or returns unsafe/groundless content, the endpoint returns `200` with `explanation: null`, `confidence: 'low'`, and a `fallbackReason` describing why, and the UI falls back to a static help link.

### 5. Prompt versioning and regression testing
- Explanation prompt templates are versioned files under `social-listening-core/src/ai/prompts/metric-explain-v{N}.json` (or equivalent TypeScript module). A `promptVersion` field is not exposed to clients in v1.
- The component `SKILL.md` for this endpoint (`social-listening-core/.claude/skills/metric-explainability/`) owns the prompt, the guardrail criteria, and the `confidence` rules.
- A permanent contract test exercises a fixed set of mock metric inputs through the prompt, asserting on output length (1–2 sentences), non-speculation, and safety (`explanation` is not `null` for valid inputs). The contract test may use a real or mocked `AIProviderConnector` per the project's existing convention.

---

## Consequences

### Positive
1. **Improved legibility for non-analyst users:** `Tenant-Reader` and `Tenant-User` personas can understand metrics without asking an analyst.
2. **No persisted explanation data:** explanations are generated on demand; the result is never stored as a primary fact.
3. **Foundation for future features:** `24-daily-digest-email.md`, `25-topic-evolution-timeline.md`, and `28-semantic-search-rag.md` can all consume `POST /v1/explain` for grounded summaries.

### Negative
1. **Additional AI cost per view:** every explained metric costs one LLM call. Caching, opt-out controls, per-tenant/per-user rate limiting, and the `explanations_enabled` tenant flag are required to keep cost bounded.
2. **Prompt engineering becomes a durability concern:** the explanation prompt must be versioned and tested like other `AIProviderConnector` contracts. The component `SKILL.md` for this endpoint and a permanent regression contract test are mandatory before the story ships, per `docs/implementation-methodology.md`.
3. **Tenant feature flag requires a small `tenants` schema addition:** the `explanations_enabled` column is new persisted tenant configuration, not an explanation itself. It is the cost/compliance kill switch and is acceptable as v1 scope.

---

## Alternatives considered

1. **Pre-generate and store explanations for every widget on every dashboard load.**
   - *Rejected:* it adds write load and storage for data that may never be read, and explanations are context-sensitive (time range, filters).

2. **Static help text per metric instead of AI-generated prose.**
   - *Rejected:* it does not answer the actual user question, which is usually "why is this number what it is right now?" Static text cannot reflect the current value or change.

3. **Generate explanations entirely client-side against a small local model.**
   - *Rejected:* it duplicates the provider abstraction, introduces a new model into the browser, and is inconsistent with the project's existing `AIProviderConnector` pattern.

---

## Open Questions

- [x] **[Q-0078-1]** ~~Should the endpoint support multi-sentence, "analyst-depth" explanations behind a `depth: 'brief' | 'detailed'` flag?~~ **Resolved by ADR-0133:** Brief vs detailed explanation tiers and response contracts locked; v1 is brief only.
- [ ] **[Q-0078-2]** Should explanations be included in `GET /v1/analytics/dashboard` by default, or fetched lazily by the UI? **Strictly lazy UI fetch (hover/click/view-triggered) by default; eager loading is rejected for v1 because a 10–15 widget dashboard would spawn 10–15 parallel LLM calls on every page load.**
- [ ] **[Q-0078-3]** How are explanation prompts versioned and regression-tested? **Versioned prompt files under `src/ai/prompts/metric-explain-v{N}.*`, owned by the component `SKILL.md`, with a permanent contract test that checks length, groundedness, and safety against mock metric inputs.**
- [ ] **[Q-0078-4]** Should `Tenant-Admin` be able to disable metric explainability tenant-wide to control cost? **Yes, mandatory in v1 via the `explanations_enabled` tenant flag.**

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/22-metric-explainability.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0003`/`ADR-0020` (`RequestGate`), `ADR-0038` (Azure OpenAI enrichment), `ADR-0048` (connector/prompt regression testing)
- Distinct from `ADR-0062` (`POST /v1/posts/explain-spike`): this endpoint explains dashboard metric values from aggregate data; `ADR-0062` explains post-volume spikes from raw post data. They may share the same `AIProviderConnector` but serve different consumers and consume different inputs.

### Pending supersession note (2026-08-28)

If ADR-0133 (Proposed, 2026-08-28) is accepted, this ADR's Decision §1 would be refined by ADR-0133's own §1–§3 — specifically statistical significance gating (p < 0.05 anomaly gate) and multi-turn conversational drill-downs. This is a pending note only: ADR-0133 is currently Proposed, not accepted.