# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0078 Metric Explainability Endpoint |
| Version | 0.3 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent |
| Reviewer(s) | Menno (Business Sponsor, Product Owner, Technical Lead) |
| Status | Draft / Review |
| Related Documents | ADR-0078, BRD-0078, `docs/product-research/feature-designs/22-metric-explainability.md`, `docs/product-research/feature-adr-scoping.md`, Story 9.2 |

**Note on source status:** ADR-0078 is now **Accepted**. This FDD is a draft for final review and may be refined before implementation.

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0078 and BRD-0078 into a functional design for a **Metric Explainability Endpoint**. The endpoint is `POST /v1/explain`, an on-demand, tenant-scoped, AI-backed service that turns a single dashboard metric and its aggregate context into a short, plain-language explanation with a deterministic confidence grade.

### 2.2 Scope

- **In scope:**
  - The `POST /v1/explain` REST contract, request/response shape, and `metricKey` allowlist validation.
  - Tenant-scoped, RLS-gated access for `tenant_user` and `tenant_admin` application roles.
  - Prompt construction from structured JSON template variables, sending only aggregate data to the existing `AIProviderConnector` / Azure OpenAI provider.
  - Server-side, deterministic confidence grading (`high` / `medium` / `low`) from context completeness.
  - In-process, short-lived response caching (5-minute default TTL) keyed on `(tenantId, metricKey, value, timeRange, locale)`.
  - User-scoped rate limiting (20 rpm per user, max 5 concurrent in-flight explanations per tenant) and `RequestGate.acquireForAiModel()` capacity gating.
  - Tenant-wide `explanations_enabled` flag on the `tenants` table, settable by `tenant_admin`.
  - UI conventions for lazy explanation fetching, latency-bracketed loading states, inline or tooltip display, low-confidence warnings, re-generation, refusal fallback, and per-widget opt-out.
  - Versioned prompt files and a permanent contract test covering representative metrics and refusal paths.

- **Out of scope:**
  - Pre-generating and storing explanations for every dashboard widget on every load.
  - Static, one-size-fits-all help text as the primary explanation mechanism.
  - Client-side explanation generation against a browser-local model.
  - Multi-sentence, analyst-depth explanations in v1 (a future `depth` flag is deferred).
  - Non-English explanation behavior beyond accepting the `locale` parameter in the contract.
  - Shared or persisted cache stores; v1 uses in-process caching only.
  - Sending raw post bodies, `widgetId`, `watchlistId`, or PII to the AI provider.
  - Eager loading of explanations on dashboard render; UI fetches lazily by default.

### 2.3 Target Audience

Backend engineers, UI engineers, QA, product owners, and UX designers involved in building, testing, and consuming the `POST /v1/explain` endpoint.

---

## 3. Context and Background

- **Problem:** Epic 8 (Analytics Dashboard) exposes aggregate metrics such as mention volume, sentiment share, source mix, and reach. `Tenant-Reader` and `Tenant-User` personas often cannot interpret these numbers without asking a `Tenant-Business-Analyst`.
- **Business/user value:** Short, grounded explanations make metrics self-service, increase dashboard trust, reduce analyst dependency, and improve accessibility for screen-reader users and non-technical audiences.
- **Source requirements:**
  - ADR-0078 `metric-explainability-endpoint.md`
  - BRD-0078 `Metric Explainability Endpoint.md`
  - `docs/product-research/feature-designs/22-metric-explainability.md`
  - `docs/product-research/feature-adr-scoping.md`
  - Story 9.2 in `docs/user-stories/epic-9-adr-0077-to-0085.md`
- **Constraints/dependencies:**
  - Depends on the accepted `AIProviderConnector` (ADR-0002) and Azure OpenAI integration (ADR-0038).
  - Depends on the `RequestGate` capacity gate (ADR-0003 / ADR-0020).
  - Depends on Epic 8 widgets already exposing the metrics that need explaining.
  - v1 adds only the `explanations_enabled` column to the existing `tenants` table; no new persisted explanation tables.
  - ADR-0078 is Proposed, so this design is provisional.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Let non-analysts understand a dashboard metric without help | `Tenant-Reader`/`Tenant-User` can read a one- to two-sentence explanation for any allowlisted metric |
| G2 | Keep AI cost bounded and predictable | 5-minute cache, per-widget opt-out, per-user/per-tenant rate limits, and tenant kill switch keep per-tenant call volume under review |
| G3 | Protect tenant data and PII | Prompt audit confirms only `metricName`, `value`, `timeRange`, `previousValue`, and `denominator` reach the AI provider |
| G4 | Deliver a fast, accessible experience | p95 latency under 1 s, p99 under 1.5 s; explanations are real text readable by screen readers |
| G5 | Make explanation quality durable and testable | Prompt is versioned and a permanent contract test exercises representative metrics and refusal paths |

---

## 5. Functional Requirements

### 5.1 Feature: `POST /v1/explain` endpoint

- **Description:** A tenant-scoped, RLS-gated REST endpoint that returns a short, plain-language explanation for a single dashboard metric value, plus a deterministic confidence grade and a client-visible `generationId`.
- **Triggers:** A dashboard widget, post summary, or alert card requests an explanation on hover, click, or view-trigger (lazy UI fetch).
- **Inputs:**
  - `metricKey: string` — allowlisted identifier (e.g. `sentiment-negative-weekly`, `volume-spike`, `platform-mix`).
  - `value: number | string` — current metric value; string only for small labelled enumerations.
  - `context.widgetId?: string` — UI-only, not sent to AI provider.
  - `context.watchlistId?: string` — UI-only, not sent to AI provider.
  - `context.timeRange: { start: ISOString; end: ISOString }` — UTC ISO 8601.
  - `context.previousValue?: number | string` — optional prior-period value.
  - `context.denominator?: number` — optional total for percentage metrics; `>= 1` if present.
  - `locale?: string` — defaults to `en`.
  - Authenticated caller resolved to `tenant_user` or `tenant_admin` under the `app_user` Postgres role.
- **Processing:**
  1. Authenticate and authorize the caller under RLS; enforce the `explanations_enabled` tenant flag; if disabled, return `403 EXPLAINABILITY_DISABLED` without calling the AI provider.
  2. Enforce per-user token-bucket and per-tenant in-flight concurrency limits; on exceed, return `429 TOO_MANY_REQUESTS`.
  3. Validate `metricKey` against the `MetricKey` allowlist; unknown keys return `400 UNKNOWN_METRIC_KEY`.
  4. Validate `value` type and, when string, match `/^[a-z0-9-]+$/`.
  5. Compute the in-process cache key `(tenantId, metricKey, value, timeRange, locale)`; on hit, return the cached explanation.
  6. On cache miss, call `RequestGate.acquireForAiModel()` to acquire capacity.
  7. Build a versioned prompt from structured JSON template variables containing only the resolved `metricName`, `value`, `timeRange`, `previousValue`, and optional `denominator`.
  8. Call `AIProviderConnector` (Azure OpenAI) through the existing interface.
  9. Validate and ground the returned text; if it is refused, unsafe, or fails schema/length validation, return `explanation: null` with `confidence: 'low'` and a `fallbackReason`.
  10. Derive `confidence` deterministically from context completeness.
  11. Write the result to the in-process cache with the configured TTL (default 5 minutes).
- **Outputs (HTTP 200):**
  ```json
  {
    "explanation": "string | null",
    "confidence": "high | medium | low",
    "generationId": "string",
    "fallbackReason?": "content_filtered | insufficient_data | rate_limited | model_error"
  }
  ```
- **Error handling:**
  - Unknown `metricKey` → `400 UNKNOWN_METRIC_KEY`.
  - Tenant disabled → `403 EXPLAINABILITY_DISABLED`.
  - Rate limits exceeded → `429 TOO_MANY_REQUESTS`.
  - Unauthenticated / cross-tenant → standard RLS/authorization rejection.
  - Refusal / unsafe / ungrounded content → still returns `200` with `explanation: null`, `confidence: 'low'`, and `fallbackReason`; UI falls back to a static help link.
- **Edge cases:**
  - Missing optional context fields reduce the achievable confidence but do not fail the request.
  - Repeated identical requests within the TTL window return the cached response and the same `generationId`.
  - Non-English `locale` is accepted in the contract; v1 behavior may remain English.

### 5.2 Feature: Confidence grading

- **Description:** Every explanation carries a deterministic `high` / `medium` / `low` grade computed from input completeness, never from the model's self-assessment.
- **Triggers:** Part of every `POST /v1/explain` call.
- **Inputs:** Request fields and the validity of the model output.
- **Processing:**
  - `high` when `value`, `timeRange`, a meaningful `previousValue`, and (for percentages) a `denominator >= 100` are all present and the response passes validation.
  - `medium` when at least one contextual signal is missing but the response is valid.
  - `low` when the model refuses, the safety/groundedness guardrail rejects the output, required fields are missing, or the output fails schema/length validation.
- **Outputs:** `confidence` field returned with every response.
- **Error handling:** Low-confidence or refusal cases degrade to `explanation: null` plus `fallbackReason` rather than surfacing raw model errors.

### 5.3 Feature: In-process caching

- **Description:** An advisory, tenant-scoped cache that avoids duplicate AI calls for the same metric context within a short window.
- **Inputs:** Cache key `(tenantId, metricKey, value, timeRange, locale)`.
- **Processing:** TTL defaults to 5 minutes and is configurable per metric. Cache misses fall through to live generation. Because the cache is in-process, it is not shared across server instances or restarts.
- **Outputs:** A cache hit returns the same `explanation`, `confidence`, and `generationId`.
- **Error handling:** Cache unavailability is non-fatal and simply triggers a fresh generation.

### 5.4 Feature: UI display conventions and per-widget opt-out

- **Description:** Client-side rules for when and how an explanation appears next to a metric.
- **Inputs:** Call elapsed time, widget opt-out setting, returned `explanation`/`confidence`.
- **Processing:**
  - **< 300 ms:** render explanation instantly; no loading state.
  - **300 ms – 1.5 s:** show a skeleton or shimmer placeholder.
  - **> 1.5 s:** show a brief "Explaining this metric…" message.
  - Per-widget opt-out prevents any call for that widget.
  - `low` confidence renders a warning icon and a user-triggered re-generation control.
  - `explanation: null` renders a static help link.
- **Outputs:** Inline or tooltip text that is real, readable by screen readers, and keyboard accessible.
- **Error handling:** Failed/timed-out calls fall back to the same static help link as the refusal case.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Reader | Primary consumer; views dashboard metrics and reads explanations |
| Tenant-User | Primary consumer; reads explanations on alerts and post summaries |
| Tenant-Business-Analyst | Secondary consumer; may want deeper context in a future version |
| Tenant-Brand-Reputation-Manager | Secondary consumer; reads explanations for sentiment/reach spikes |
| Tenant-Admin | Controls the `explanations_enabled` tenant flag |
| Dashboard/Widget UI (system actor) | Calls `POST /v1/explain` on behalf of the signed-in user |
| AIProviderConnector / Azure OpenAI (system actor) | Generates explanation text from the constrained prompt |

### 6.2 User Stories / Use Cases

| ID | As a … | I want to … | So that … | Acceptance Criteria |
|---|---|---|---|---|
| Story 9.2 | backend engineer | `POST /v1/explain` to return a short, confidence-graded explanation for any dashboard metric | `Tenant-Reader` and `Tenant-User` understand what a number means without asking an analyst | `POST /v1/explain` accepts `metricKey`, `value`, `context`, `locale`; returns `explanation` (`string \| null`), `confidence` (`high` / `medium` / `low`), `generationId`, and optional `fallbackReason`; unknown `metricKey` → `400 UNKNOWN_METRIC_KEY`; string `value`/`previousValue` validated against `/^[a-z0-9-]+$/`; prompt built from structured JSON template variables; only aggregate data sent to AI provider; `confidence` derived deterministically from context completeness; `RequestGate.acquireForAiModel()` called; 20 rpm per user and max 5 concurrent per tenant enforced; `explanations_enabled` flag disables endpoint; in-process cache keyed `(tenantId, metricKey, value, timeRange, locale)` with 5-minute TTL; prompt versioned and covered by permanent contract test; contract tests cover `volume-spike`, `sentiment-share`, `platform-mix`, validation, rate-limit, and refusal paths |

### 6.3 Primary Workflow

1. User sees a dashboard widget, post summary, or alert card that has not opted out.
2. UI triggers `POST /v1/explain` lazily with `metricKey`, `value`, `context`, and `locale`.
3. UI starts the latency-bracketed loading state.
4. Backend validates tenant flag, rate limits, and `metricKey`.
5. Backend checks the in-process cache.
6. On miss, backend acquires `RequestGate` capacity, builds the aggregate-only prompt, and calls `AIProviderConnector`.
7. Backend derives `confidence`, writes to the cache, and returns the response.
8. UI renders the explanation; if `confidence` is `low`, shows a warning and re-generation control; if `explanation` is `null`, shows a static help link.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `metricKey`, `value`, `context` (widget, watchlist, time range, previous value, denominator), and `locale` from the dashboard/analytics UI.
- Authenticated tenant/user identity from existing session/RLS.
- `tenants.explanations_enabled` flag from the existing `tenants` table.

### 7.2 Data Outputs

- `explanation`, `confidence`, `generationId`, and optional `fallbackReason` returned to the UI.
- No new persisted business data; the in-process cache is transient.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| ExplainRequest | `metricKey` (allowlisted string), `value` (number \| string), `context.widgetId?`, `context.watchlistId?`, `context.timeRange` (start/end ISO), `context.previousValue?`, `context.denominator?`, `locale?` (default `en`) | Scoped to `tenantId` via RLS; `context.watchlistId` references an existing watchlist; `context.widgetId` references a dashboard widget |
| ExplainResponse | `explanation` (string \| null), `confidence` (`high` \| `medium` \| `low`), `generationId` (string), `fallbackReason?` | Produced from one `ExplainRequest`; `generationId` is client-visible for support correlation only |
| ExplanationCacheEntry (in-process) | Key = `(tenantId, metricKey, value, timeRange, locale)`; value = `{ explanation, confidence, generationId }`; TTL default 5 minutes | Tenant-scoped; not shared across instances/restarts |
| tenants.explanations_enabled | Boolean flag on the existing `tenants` table; default `true`; settable by `tenant_admin` | Controls whether `POST /v1/explain` is active for the tenant |

### 7.4 Validation Rules

- `metricKey` must be present and in the `MetricKey` allowlist; otherwise `400 UNKNOWN_METRIC_KEY`.
- `value` is required and typed `number | string`; string values must match `/^[a-z0-9-]+$/`.
- `context.timeRange` is required (`start` and `end` ISO 8601 strings); other context fields are optional.
- `context.denominator`, if present, must be `>= 1`.
- `locale` is optional and defaults to `en`.
- The request must resolve to `tenant_user` or `tenant_admin` under RLS.
- The prompt may include only `metricName`, `value`, `timeRange`, `previousValue`, and `denominator`; no raw post bodies, `widgetId`, `watchlistId`, or PII.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Only known `metricKey` values in the allowlist may receive an explanation; unknown keys return `400 UNKNOWN_METRIC_KEY`. | `POST /v1/explain` request validation |
| BR2 | The prompt sent to the AI provider may contain only aggregate data: `metricName`, `value`, `timeRange`, `previousValue`, and optional `denominator`. | Prompt construction |
| BR3 | Every explanation request must be tenant-scoped and RLS-gated to `tenant_user` or `tenant_admin`. | Authorization |
| BR4 | The `explanations_enabled` flag on `tenants` must be `true` for the endpoint to be usable; when `false`, return `403 EXPLAINABILITY_DISABLED`. | Feature gating |
| BR5 | Per-user token bucket allows 20 requests per minute; per-tenant concurrency is capped at 5 in-flight explanations; exceeding either returns `429 TOO_MANY_REQUESTS`. | Rate limiting |
| BR6 | Each AI model call must acquire capacity through `RequestGate.acquireForAiModel()`. | Capacity gating |
| BR7 | Cache keys must include `tenantId` so explanations cannot be returned to a different tenant. | Caching |
| BR8 | `confidence` is derived deterministically on the server from context completeness, never from the model's self-assessment. | Confidence grading |
| BR9 | `high` confidence requires `value`, `timeRange`, a meaningful `previousValue`, and, for percentages, a `denominator >= 100`. | Confidence grading |
| BR10 | Low-confidence explanations must be shown with a warning and a re-generation option; if the model refuses or returns unsafe content, the UI falls back to a static help link. | UI handling |
| BR11 | Per-widget opt-out overrides any default dashboard explainability setting for that metric. | UI configuration |
| BR12 | Explanations are transient and computed on demand; v1 does not persist them as facts. | Data lifecycle |
| BR13 | String `value` and `previousValue` must match `/^[a-z0-9-]+$/` to prevent prompt injection and arbitrary prose in numeric fields. | Input validation |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Dashboard/analytics UI (Epic 8 widgets, post summaries, alert cards) | Inbound to backend | Requests a metric explanation | HTTPS REST, JSON (`POST /v1/explain`) |
| `AIProviderConnector` / Azure OpenAI (ADR-0002, ADR-0038) | Outbound from backend | Generates explanation text from constrained prompt | Existing provider-agnostic connector interface |
| `RequestGate` (ADR-0003 / ADR-0020) | Outbound from backend | Acquires capacity before each AI model call | Existing gating call |
| RLS / tenant authorization layer | Internal | Resolves and enforces `tenantId` and `app_user` role | Existing session/RLS mechanism |
| In-process short-lived cache | Internal | Avoids duplicate AI calls within TTL | Internal read/write, tenant-scoped key |
| Dashboard builder (per-widget opt-out) | Inbound to widget config | Lets a widget disable explanations | Existing dashboard configuration surface |

---

## 10. Non-Functional Considerations

- **Performance:** p95 latency under 1 second, p99 under 1.5 seconds. UI loading states map to the latency brackets in §5.4.
- **Security / access control:** Tenant-scoped, RLS-gated, role-based access; no PII or raw post content sent to the AI provider or stored in cache; cache entries must not leak across tenants.
- **Scalability:** Caching, per-widget opt-out, and per-user/per-tenant rate limits bound AI call volume as dashboard usage grows.
- **Reliability / availability:** Cache is advisory — unavailability falls through to live generation; model refusal degrades to a documented fallback response rather than a hard error.
- **Audit and logging:** `generationId` is client-visible for support correlation. v1 does not include a server-side audit log for the endpoint. Call-volume, latency, cache-hit, low-confidence, rate-limit, and `EXPLAINABILITY_DISABLED` metrics are tracked in the reporting layer per BRD-0078 §11.
- **Accessibility:** Explanations are real text, not tooltip-only, and are navigable and announced correctly by screen readers.
- **Localization / internationalization:** `locale` parameter is accepted and defaults to `en`; non-English generation quality is not guaranteed in v1.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Unknown `metricKey` | Explanation not available for this metric | Backend returns `400 UNKNOWN_METRIC_KEY`; no AI call |
| `explanations_enabled` is `false` | Explainability is disabled for this tenant | Backend returns `403 EXPLAINABILITY_DISABLED`; no AI call |
| Rate limit exceeded | Too many explanations requested; please wait | Backend returns `429 TOO_MANY_REQUESTS` |
| Unauthenticated / cross-tenant request | Standard access-denied handling | Rejected by RLS/authorization before explanation logic |
| Model refusal or unsafe content | Static help link shown | Backend returns `200` with `explanation: null`, `confidence: 'low'`, `fallbackReason` |
| Call exceeds 1.5 s | "Explaining this metric…" progress message | UI keeps the request open; no special backend behavior |
| Cache unavailable | No visible difference | Backend falls through to live generation |
| AI provider hard failure | Static help link shown | UI treats failure/timed-out call same as refusal case |

---

## 12. Assumptions and Dependencies

- `AIProviderConnector` (ADR-0002) and Azure OpenAI wiring (ADR-0038) are available and stable.
- `RequestGate` capacity gating (ADR-0003 / ADR-0020) and `app_user` RLS are available and stable.
- Epic 8 dashboard/analytics widgets already compute and expose the metric values and context this endpoint needs.
- A tenant-scoped, short-lived in-process caching mechanism is available for v1.
- Users prefer a one- to two-sentence explanation over richer analysis in v1.
- ADR-0078 is Proposed; this design is provisional pending acceptance.
- Azure OpenAI availability and quota/cost limits directly affect the feature's reliability and cost profile.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the endpoint support multi-sentence, "analyst-depth" explanations behind a `depth: 'brief' \| 'detailed'` flag? | Menno | Before/at ADR-0078 acceptance |
| Q2 | Should explanations be included in `GET /v1/analytics/dashboard` by default, or fetched lazily by the UI? | Menno | Already decided: lazy UI fetch in v1; confirm at acceptance |
| Q3 | How are explanation prompts versioned and regression-tested over time? | Engineering | Prompt files versioned under `social-listening-core/src/ai/prompts/metric-explain-v{N}.*` and tested per contract test |
| Q4 | Should `Tenant-Admin` be able to disable metric explainability tenant-wide to control cost? | Menno | Already decided: mandatory in v1 via `explanations_enabled`; confirm at acceptance |

---

## 14. Appendix

### Glossary

See BRD-0078 §15 for the shared glossary. Key terms include: **metric explainability**, **metricKey**, **AIProviderConnector**, **RequestGate**, **generationId**, **confidence**, **fallbackReason**, **explanations_enabled**, **RLS**, and **PII**.

### Reference links

- ADR: `docs/adr/0078-metric-explainability-endpoint.md` (Status: Proposed)
- BRD: `docs/project docs/Business-Requirements/BRD-0078-Metric-Explainability-Endpoint.md`
- Feature design: `docs/product-research/feature-designs/22-metric-explainability.md`
- Feature-ADR scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0003` / `ADR-0020` (`RequestGate`), `ADR-0038` (Azure OpenAI enrichment), `ADR-0048` (connector/prompt regression testing)
- Related user story: **Story 9.2 — Metric explainability endpoint** (`docs/user-stories/epic-9-adr-0077-to-0085.md`)
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.3 | 2026-08-23 | FDD Writer Agent | Regenerated from updated BRD-0078 and Story 9.2; removed unrelated Story 13.7 references; aligned confidence, rate limits, and `explanations_enabled` with ADR-0078; clarified no v1 server-side audit log |
