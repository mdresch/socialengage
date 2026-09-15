---
name: metric-explainability
description: Metric explainability endpoint (Story 9.2 + Story 13.7 + Story 17.5, ADR-0078 + ADR-0113 + ADR-0133) — on-demand plain-language metric explanations with a versioned prompt template, deterministic model output, a Postgres-backed cache, audit logging, and a statistical significance gate (p < 0.05) with root-cause factor decomposition that saves LLM tokens on background noise. Read this before touching src/ai/metricExplainabilityService.ts, src/ai/significanceGate.ts, src/ai/metricExplanationCache.ts, src/ai/prompts/metricExplainPromptV1.ts, src/http/versions/v1/explainRouter.ts, src/connectors/azureOpenAi/azureOpenAiConnector.ts, or migrations 0045 and 0067.
---

# Metric Explainability Endpoint (`POST /v1/explain`)

## What this is

A lightweight, on-demand AI explanation service that provides plain-language, confidence-graded summaries for any dashboard metric (e.g. volume spike, sentiment split, platform mix). Story 13.7 hardened the service with a versioned prompt template, deterministic model parameters (temperature=0, fixed seed), a persistent 5-minute `metric_explanation_cache`, and audit logging for every call. Story 17.5 (ADR-0133, TDS-0133) added a pre-generation statistical significance gate — the observed delta `|value − previousValue|` is Z-scored against the tenant's own rolling 30-day baseline of absolute day-over-day post-count deltas; non-significant shifts (p ≥ 0.05) return a deterministic 200 response (`tokenCostSaved: true`, `generationId: 'none'`) without invoking Azure OpenAI, while significant shifts get a real root-cause `factorDecomposition` injected into the prompt.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0078 | Metric explainability endpoint — allowlist validation, deterministic confidence, tenant kill switch, user token bucket rate limiting, short-lived caching | 9.2 (backend) |
| ADR-0113 | Versioned prompt template v1, temperature=0, fixed seed per prompt version, structured JSON output, 5-minute cache in `metric_explanation_cache`, `platform_admin_audit_log` logging | 13.7 (backend) |
| ADR-0133 / TDS-0133 | Statistical significance gate (Z = \|Δ−μ\|/σ, p < 0.05) before LLM spend; multi-factor root-cause decomposition injected into the prompt on significance | 17.5 (backend) |
| ADR-0003 / ADR-0020 | RequestGate rate limiting and AI model acquisition | 9.2, 13.7 |
| ADR-0015 | Multi-tenant RLS isolation | 9.2, 13.7 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.2.metric-explainability.contract.test.ts` — verifies:
  - Unknown metric keys return `400 UNKNOWN_METRIC_KEY`.
  - String values not matching `/^[a-z0-9-]+$/` return `400 BAD_REQUEST`.
  - Confidence is derived deterministically (`high`, `medium`, `low`).
  - Tenant kill switch (`explanations_enabled = false`) returns `403 EXPLAINABILITY_DISABLED`.
  - User rate limiting returns `429 TOO_MANY_REQUESTS` if >20 requests in 1 minute.
  - In-process caching returns identical explanation on cache hit without AI call.

- `contracts/epic-13/story-13.7.metric-explainability-prompt-and-caching.contract.test.ts` — verifies:
  - The response exposes the current `promptVersion` (v1).
  - Azure OpenAI is called with the rendered v1 prompt, `temperature=0`, and a fixed seed.
  - Identical requests within TTL are served from cache (`cacheHit=true`, same `generationId`).
  - The cache key includes tenant, metric, value, timeRange, filters, and promptVersion.
  - Cross-tenant cache isolation is enforced.
  - `noCache` bypasses the cache for a single call.
  - Every call is written to `platform_admin_audit_log` with `metricKey` and `cacheHit`.
  - Expired cache entries are not returned; TTL defaults to 5 minutes.

- `contracts/epic-17/story-17.5.metric-anomaly-significance-gate.contract.test.ts` — verifies:
  - `evaluateStatisticalSignificance` math: Z = \|Δ−μ\|/σ, p = 2·(1−Φ(Z)), σ=0 → not significant (TDS §4.1 literal).
  - p ≥ 0.05 → 200 with `isStatisticallySignificant: false`, `zScore`, `pValue`, deterministic explanation, `tokenCostSaved: true`, `generationId: 'none'`, and the Azure OpenAI `explain()` is never called.
  - p < 0.05 → `factorDecomposition` (volumeDeltaPercent, sentimentShiftContribution, dominantPlatform, topContributingTopic, topAuthorImpactRatio) in the response and its telemetry inside the rendered prompt.
  - <7 historical samples → gate defaults open (TDS §8).
  - Baseline and decomposition are computed strictly from the caller's tenant data.

## Key Invariants

1. **Zero Raw Post Bodies or PII:** Only aggregate numbers, metric names, time windows, and watchlist names are sent to the AI provider. No raw post bodies, internal IDs, or PII.
2. **Versioned Prompt:** The prompt lives in `src/ai/prompts/metricExplainPromptV1.ts`. Any template, output instruction, or confidence rule change must bump `METRIC_EXPLAIN_PROMPT_VERSION`, which changes the cache key and naturally invalidates prior cache rows.
3. **Deterministic Output:** The model is called with `temperature=0` and `seed` fixed per prompt version. Cache hits return the stored response without an LLM call.
4. **Tenant-Scoped Cache:** `metric_explanation_cache` is RLS-scoped by `tenant_id`. The cache key includes `tenantId`; two tenants with the same metric inputs cannot share entries.
5. **Audit Every Call:** Every `POST /v1/explain` creates a `metric_explain` row in `platform_admin_audit_log` with `metricKey`, `cacheHit`, `promptVersion`, and `generationId`.
6. **Advisory Cache:** A cache miss or an explicit `noCache: true` request regenerates the explanation.
7. **Tenant Kill Switch:** `tenants.explanations_enabled` (default `true`) allows immediate shutdown of LLM explanation calls per tenant.
8. **Significance Gate Before LLM Spend (Story 17.5):** after validation, kill-switch, cache miss, and the user rate limit — but before the concurrency slot and any model call — `explainMetric` evaluates `|value − previousValue|` against the tenant's 30-day baseline distribution of absolute daily count deltas (days ending before `context.timeRange.start`). Skipped (gate open) when `value`/`previousValue` aren't both numeric or when fewer than 7 baseline days have posts. σ=0 follows TDS-0133 §4.1 literally: not significant, p=1.0. Gated responses are deterministic and are *not* written to `metric_explanation_cache` (nothing expensive to amortize); they are still audit-logged.
9. **Factor Decomposition on Significance:** significant requests compute `volumeDeltaPercent` (from the request's value/previousValue), `sentimentShiftContribution` (window negative-share minus baseline negative-share, clamped [−1,1]), `dominantPlatform`, `topContributingTopic` (from `post_topics`/`topics`, `'none'` when empty), and `topAuthorImpactRatio` (max author share of window posts) — all real per-tenant SQL inside `withTenant()`. The factors ride into the prompt via the existing `context` string — **the v1 prompt template is unchanged and `METRIC_EXPLAIN_PROMPT_VERSION` stays 1**, so the Story 13.7 cache-key contract is unaffected.

## Files that implement this component

- `src/ai/metricExplainabilityService.ts` — orchestration, validation, confidence, fallback, logging, significance-gate placement.
- `src/ai/significanceGate.ts` — Story 17.5: `evaluateStatisticalSignificance()` (+ `normalCdf`), `getBaselineDistribution()` (30-day daily counts → |delta| distribution), `decomposeFactors()` (window-scoped root-cause factors), `FactorDecomposition`.
- `src/ai/metricExplanationCache.ts` — SHA-256 cache key, cache read/write, hit-count tracking.
- `src/ai/prompts/metricExplainPromptV1.ts` — versioned v1 prompt template, seed, default TTL.
- `src/http/versions/v1/explainRouter.ts` — HTTP surface (`POST /v1/explain`).
- `src/connectors/azureOpenAi/azureOpenAiConnector.ts` — `explain()` method with `temperature=0`, fixed seed, and structured JSON output.
- `src/connectors/types.ts` — `AIProviderConnector.explain?()` extension.
- `migrations/0067_create_metric_explanation_cache.sql` — cache table, RLS, grants.

## How to extend this safely

- **Changing the prompt template:** bump `METRIC_EXPLAIN_PROMPT_VERSION` and `METRIC_EXPLAIN_SEED` in `src/ai/prompts/metricExplainPromptV1.ts`. This automatically busts the cache because `promptVersion` is part of the cache key.
- **Adding a per-metric TTL override:** add the metric to `METRIC_EXPLAIN_TTL_OVERRIDES` in the same file. The default remains 300 seconds (5 minutes).
- **Wiring a new AI provider:** implement `explain?()` on the provider, return `{ explanation: string; confidence: 'high'|'medium'|'low' }`, and call `acquireForAiModel(tenantId, provider, 'explain')` before the model call.
- **Adding a no-cache request header:** the body already accepts `noCache?: boolean`. Do not change the default cache behavior for requests without the flag.
