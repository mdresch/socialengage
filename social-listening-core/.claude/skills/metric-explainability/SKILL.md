---
name: metric-explainability
description: Metric explainability endpoint (Story 9.2, ADR-0078, BRD-0078, FDD-0078) — on-demand plain-language metric explanations with deterministic confidence scoring, allowlist validation, and rate limiting. Read this before touching src/ai/metricExplainabilityService.ts, src/http/versions/v1/explainRouter.ts, or migration 0045.
---

# Metric Explainability Endpoint (`POST /v1/explain`)

## What this is

A lightweight, on-demand AI explanation service that provides plain-language, confidence-graded summaries for any dashboard metric (e.g. volume spike, sentiment split, platform mix).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0078 | Metric explainability endpoint — allowlist validation, deterministic confidence, tenant kill switch, user token bucket rate limiting, in-memory caching | 9.2 (backend) |
| ADR-0003 / ADR-0020 | RequestGate rate limiting and AI model acquisition | 9.2 |
| ADR-0015 | Multi-tenant RLS isolation | 9.2 |

## Contracts that constrain this component

- `contracts/epic-9/story-9.2.metric-explainability.contract.test.ts` — verifies:
  - Unknown metric keys return `400 UNKNOWN_METRIC_KEY`.
  - String values not matching `/^[a-z0-9-]+$/` return `400 BAD_REQUEST`.
  - Confidence is derived deterministically (`high`, `medium`, `low`).
  - Tenant kill switch (`explanations_enabled = false`) returns `403 EXPLAINABILITY_DISABLED`.
  - User rate limiting returns `429 TOO_MANY_REQUESTS` if >20 requests in 1 minute.
  - In-process caching returns identical explanation on cache hit without AI call.

## Key Invariants

1. **Zero Raw Post Bodies or PII:** Only aggregate numbers, metric names, and time windows are sent to the AI provider.
2. **Deterministic Confidence:** Confidence is computed from context completeness on the server, never from the model's self-assessment.
3. **Structured JSON Templates:** Prompts are serialized JSON payloads rather than raw string concatenation to prevent prompt injection.
4. **Tenant Kill Switch:** `tenants.explanations_enabled` (default `true`) allows immediate shutdown of LLM explanation calls per tenant.
