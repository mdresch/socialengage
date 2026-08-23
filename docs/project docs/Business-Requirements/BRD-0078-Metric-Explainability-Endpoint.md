# BRD-0078: Metric Explainability Endpoint

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Metric Explainability Endpoint – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor, Product Owner, Technical Lead) |
| Status | Draft / Review – ADR-0078 is Accepted; BRD is ready for final review/approval |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0078, feature design `22-metric-explainability.md`, and Story 9.2 |

---

## 2. Executive Summary

Dashboards in the Social Listening / Insights subsystem surface aggregate numbers such as mention volume, sentiment share, source mix, and reach. Many of these metrics are difficult for non-analysts to interpret, forcing `Tenant-Reader` and `Tenant-User` personas to ask a business analyst for help before they can act on a number.

This BRD proposes an on-demand **Metric Explainability Endpoint** that adds a short, plain-language explanation to any dashboard metric. The backend exposes `POST /v1/explain`, which receives a metric key, its value, and a small aggregate context and returns a one- to two-sentence explanation plus a confidence grade. The UI displays the explanation inline, in a tooltip, or on request, with loading states and per-widget opt-out. A tenant-wide `explanations_enabled` flag lets `Tenant-Admin` disable the feature for cost or compliance reasons.

By making metrics self-explanatory, the feature is expected to increase dashboard trust, reduce analyst dependency, and improve accessibility for screen readers and non-technical users while keeping AI generation costs bounded through short-lived caching, rate limiting, and opt-out controls.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Improve dashboard accessibility and self-service insight consumption | `Tenant-Reader` and `Tenant-User` can understand a metric without requesting analyst support |
| 2 | Increase trust in analytics by grounding numbers in plain-language context | Positive user feedback and fewer support requests asking “what does this number mean?” |
| 3 | Reduce time-to-decision for non-analyst users | Users can act on a metric after reading its one-sentence explanation |
| 4 | Keep AI generation cost predictable and bounded | Per-tenant call volume, cache hit rate, rate-limit compliance, and average cost per explained metric are tracked and reviewed |

---

## 4. Scope

### 4.1 In Scope

- A new `POST /v1/explain` REST endpoint and its request/response contract.
- An allowlisted set of `metricKey` values; unknown keys return a clear `400 UNKNOWN_METRIC_KEY` error.
- Generation of one- to two-sentence, plain-language explanations using the existing `AIProviderConnector` and the already-wired Azure OpenAI provider.
- Tenant-scoped, RLS-gated access for `tenant_user` and `tenant_admin` application roles.
- A deterministic confidence grade (`high` / `medium` / `low`) returned with every explanation.
- A `tenants.explanations_enabled` feature flag, settable by `tenant_admin`, that disables the endpoint with `403 EXPLAINABILITY_DISABLED` when `false`.
- Rate limiting through a dedicated user-scoped token bucket: 20 requests per minute per user and a maximum of 5 concurrent in-flight explanations per tenant, returning `429 TOO_MANY_REQUESTS` when exceeded.
- Integration with the existing `RequestGate.acquireForAiModel()` capacity gate per `ADR-0003` / `ADR-0020`.
- Optional, short-lived in-process caching with a 5-minute default TTL, keyed on `(tenantId, metricKey, value, timeRange, locale)`.
- UI conventions for displaying explanations: instant render on cache hit, skeleton/shimmer for medium calls, a progress message for slow calls, inline text or tooltip, and per-widget opt-out.
- Low-confidence handling: warning icon, user-triggered re-generation, and a fallback to a static help link when the model refuses or returns unsafe content.
- English locale as the default; additional locales may be enabled in later versions.
- Versioned prompt files and a permanent contract test covering representative metrics and refusal paths.

### 4.2 Out of Scope

- Pre-generating and storing explanations for every widget on every dashboard load.
- Static, one-size-fits-all help text that cannot reflect the current value or time range.
- Client-side explanation generation against a local browser model.
- Multi-sentence “analyst-depth” explanations in v1 (may be added later via a `depth` flag).
- Multi-language support in v1 beyond the `locale` parameter contract.
- Shared or persisted cache stores; v1 uses in-process caching only.
- Sending raw post bodies, PII, or other non-aggregate data to the AI provider.
- Eager loading of explanations on dashboard render; UI fetches lazily by default.

### 4.3 Assumptions

- The existing `AIProviderConnector` abstraction and Azure OpenAI integration are available and stable.
- The `RequestGate` capacity gate and `app_user` RLS enforcement are available and stable.
- Dashboard and analytics widgets already expose the metrics that need explanation.
- A tenant-scoped, short-lived caching mechanism is available for v1.
- Users prefer a one- to two-sentence explanation over richer, multi-paragraph analysis for the first version.

### 4.4 Constraints

- Each explained metric incurs a separate Azure OpenAI call; cost and latency must be controlled.
- v1 does not add new persisted tables beyond the `explanations_enabled` column on `tenants`.
- Explanations must not leak raw post content, PII, or tenant data to the AI provider or across tenants.
- Response latency should remain under 1.5 seconds in the slow path.
- Rate limits must not degrade the dashboard to the point of unusability.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader | Primary end user of dashboard explanations | High | Understand any dashboard number quickly without analyst help |
| Tenant-User | Primary end user of alert and post-summary explanations | High | See clear, one-sentence explanations for alerts and KPIs |
| Tenant-Business-Analyst | Secondary user; may review deeper context | Medium | Optional, more detailed drivers and comparison narratives |
| Tenant-Brand-Reputation-Manager | Secondary user tracking sentiment/reach spikes | Medium | Read the reason behind a spike directly from the dashboard |
| Tenant-Admin | Controls tenant-wide feature enablement and cost | Medium | Can disable explainability for the tenant |
| Product / Engineering | Build and operate the endpoint and UI | High | Stable contract, bounded cost, testable prompt behavior |
| Menno | Business sponsor, product owner, technical lead | High | Clear scope, traceable requirements, and acceptance criteria |

---

## 6. Current State (As-Is)

Dashboards and analytics views already expose metrics such as mention volume, sentiment share, source mix, and reach. Users currently interpret these numbers manually or ask a business analyst for clarification.

**Pain points:**

- Non-analyst users often do not know what a metric means or why it changed.
- Users delay decisions while they wait for analyst input.
- Visual charts alone are not always accessible to screen-reader users or non-technical audiences.
- No on-demand, data-grounded explanation is available in the product today.

---

## 7. Future State (To-Be)

When a user sees a metric in a dashboard widget, post summary, or alert card, an inline explanation icon or tooltip is available. The UI calls `POST /v1/explain` lazily with the metric key, current value, aggregate context, and optional locale. The backend validates the request, enforces tenant and rate limits, builds a structured prompt containing only aggregate data, and calls `AIProviderConnector` through the existing `RequestGate`. The returned explanation is one to two sentences long and carries a confidence grade.

**Expected capabilities:**

- One-click or hover access to a plain-language explanation for any supported metric.
- Confidence grading so users know when to trust or re-request an explanation.
- Fast, medium, and slow loading patterns that match call latency.
- Per-widget opt-out for metrics that are self-explanatory.
- Tenant-wide kill switch for cost and compliance governance.
- Short-lived caching to reduce duplicate AI calls for the same metric context.
- Clear fallback to a static help link when an explanation cannot be generated safely.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose a `POST /v1/explain` endpoint that accepts `metricKey`, `value`, `context`, and `locale`. | Must | Endpoint contract matches ADR-0078 and returns `200` with `explanation`, `confidence`, and `generationId`. | Engineering |
| BR-002 | The system shall validate `metricKey` against a known allowlist and return `400 UNKNOWN_METRIC_KEY` for unknown keys. | Must | Unknown keys are rejected; allowlisted keys are accepted. | Engineering |
| BR-003 | The system shall send only aggregate, tenant-scoped data to the AI provider; no raw post bodies or PII. | Must | Prompt audit confirms only metric name, value, time range, previous value, and denominator are included. | Engineering |
| BR-004 | The system shall enforce tenant and RLS gating for every explanation request. | Must | Cross-tenant requests are denied; `tenant_user` or `tenant_admin` authorization is required. | Engineering |
| BR-005 | The system shall return `explanation` as one to two sentences, a `confidence` of `high`, `medium`, or `low`, and a unique `generationId`. | Must | Response shape matches ADR-0078; `generationId` is present. | Engineering |
| BR-006 | The system shall support a `context` containing `widgetId`, `watchlistId`, `timeRange`, `previousValue`, and `denominator`. | Must | All listed context fields are accepted and used in the explanation when provided. | Engineering |
| BR-007 | The system shall call `acquireForAiModel()` through the existing `RequestGate` for every AI call. | Must | Capacity gate is exercised before the AI provider is invoked. | Engineering |
| BR-008 | The system shall enforce a per-user and per-tenant rate limit (20 rpm per user, max 5 concurrent per tenant) and return `429` when exceeded. | Must | Rate-limit tests pass; concurrent throttling does not affect unrelated tenants. | Engineering |
| BR-009 | The system shall respect a tenant `explanations_enabled` flag and return `403 EXPLAINABILITY_DISABLED` when `false`. | Must | Flag default is `true`; `tenant_admin` can set it; disabled tenants are blocked without calling the AI provider. | Engineering |
| BR-010 | The system shall cache successful explanations for 5 minutes by default, keyed on `(tenantId, metricKey, value, timeRange, locale)`. | Should | Cache hit returns the same `explanation` and `generationId`; TTL is configurable per metric. | Engineering |
| BR-011 | The UI shall show no loader for calls under 300 ms, a skeleton/shimmer for 300 ms – 1.5 s, and a detailed message for calls over 1.5 s. | Should | Loading states match the latency brackets defined in ADR-0078. | Product / UI |
| BR-012 | The UI shall allow each widget to opt out of explanations if the metric is self-explanatory. | Should | Dashboard builder exposes an opt-out control and hides the explanation when selected. | Product / UI |
| BR-013 | The UI shall surface low-confidence explanations with a warning icon and offer re-generation; when the model refuses, it shall fall back to a static help link. | Should | Low confidence and refusal cases are handled without breaking the dashboard. | Product / UI |
| BR-014 | The system shall support an optional `locale` parameter defaulting to `en`. | Could | Non-English locales are accepted in the contract; v1 behavior can remain English. | Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Explanation requests should complete under 1 second for the 95th percentile and under 1.5 seconds for the 99th percentile. | Performance | Should | Measured in staging and production monitoring. |
| NFR-002 | No PII or raw post content may be sent to the AI provider or stored in the cache. | Security | Must | Prompt and cache audits pass; RLS is enforced. |
| NFR-003 | Cache entries must be tenant-scoped and not leak across tenants. | Security | Must | Cross-tenant cache collision tests pass. |
| NFR-004 | Explanations must be readable by screen readers and available as real text, not tooltips only. | Accessibility | Should | Screen-reader and keyboard navigation tests pass. |
| NFR-005 | The explanation prompt must be versioned and covered by contract tests like other `AIProviderConnector` consumers. | Maintainability | Should | Prompt version is tracked and regression tests exist. |
| NFR-006 | `explanations_enabled` must be tenant-scoped and only settable by `tenant_admin`. | Security | Must | Role-based access control tests pass. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only known `metricKey` values in the allowlist may receive an explanation; unknown keys return `400 UNKNOWN_METRIC_KEY`. |
| BRU-002 | The prompt sent to the AI provider may contain only aggregate data: metric name, current value, time range, previous value, and optional denominator. |
| BRU-003 | Every explanation request must be tenant-scoped and RLS-gated to the calling `tenant_user` or `tenant_admin`. |
| BRU-004 | Cache keys must include `tenantId` so explanations cannot be returned to a different tenant. |
| BRU-005 | `confidence` is derived deterministically on the server from context completeness, never from the model's self-assessment. |
| BRU-006 | `high` confidence requires `value`, `timeRange`, a meaningful `previousValue`, and, for percentages, a `denominator >= 100`. |
| BRU-007 | Low-confidence explanations must be shown with a warning and a re-generation option; if the model refuses or returns unsafe content, the UI falls back to a static help link. |
| BRU-008 | Per-widget opt-out overrides any default dashboard explainability setting for that metric. |
| BRU-009 | Explanations are transient and computed on demand; v1 does not persist them as facts. |
| BRU-010 | When `tenants.explanations_enabled` is `false`, the endpoint returns `403 EXPLAINABILITY_DISABLED` without calling the AI provider. |
| BRU-011 | String `value` and `previousValue` values must match `/^[a-z0-9-]+$/` to prevent prompt injection and arbitrary prose in numeric fields. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `metricKey` | Allowlisted identifier for the metric being explained, e.g. `sentiment-negative-weekly` | UI / dashboard widget | Engineering | Low |
| `value` | Current metric value, numeric or string | Dashboard aggregate | Engineering | Low |
| `context.widgetId` | Optional dashboard widget identifier | UI | Engineering | Low |
| `context.watchlistId` | Optional watchlist that produced the metric | Dashboard context | Engineering | Low |
| `context.timeRange` | Start and end ISO timestamps for the metric | Dashboard context | Engineering | Low |
| `context.previousValue` | Optional prior-period value for comparison | Dashboard aggregate | Engineering | Low |
| `context.denominator` | Optional total for percentage metrics | Dashboard aggregate | Engineering | Low |
| `locale` | Requested language for the explanation; defaults to `en` | UI / user preference | Engineering | Low |
| `explanation` | One- to two-sentence plain-language explanation | Azure OpenAI via `AIProviderConnector` | Engineering | Low |
| `confidence` | `high`, `medium`, or `low` grade for the explanation | Backend assessment | Engineering | Low |
| `generationId` | Unique audit/support identifier for the explanation | Backend | Engineering | Low |
| `fallbackReason` | Optional reason when `explanation` is `null` | Backend | Engineering | Low |
| `explanations_enabled` | Tenant feature flag controlling endpoint availability | `tenants` table | Engineering | Medium |
| `tenantId` | Tenant identifier used for authorization and cache scoping | Auth / RLS | Engineering | High |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Explanations requested per tenant and widget | Track adoption and cost drivers | Product / Engineering | Daily |
| Cache hit rate for `POST /v1/explain` | Measure caching effectiveness | Engineering | Daily |
| Average and p95 explanation latency | Ensure UI responsiveness | Engineering | Daily |
| Low-confidence explanation rate | Monitor model reliability and prompt quality | Product / Engineering | Weekly |
| Rate-limit and `EXPLAINABILITY_DISABLED` events | Monitor abuse and kill-switch usage | Product / Engineering | Daily |
| Estimated AI cost per explained metric | Keep spending bounded | Product / Finance | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure OpenAI cost grows with dashboard usage | Medium | High | Implement 5-minute cache, per-widget opt-out, per-user and per-tenant rate limits, tenant kill switch, and monitor per-tenant call volume | Engineering |
| R-002 | Explanation latency degrades dashboard performance | Medium | High | Use skeleton/progress states, cache, capacity gate, and target p95 under 1 second | Engineering |
| R-003 | Model hallucinates or over-claims causation | Medium | High | Constrain prompts to provided aggregate data, show confidence, allow re-generation, and fall back to help links | Engineering |
| R-004 | Raw posts or PII are accidentally sent to the AI provider | Low | High | Enforce prompt review, contract tests, and data-sensitivity audit; never include `body_markdown` or PII | Engineering |
| R-005 | Prompt drift or model updates change explanation quality | Medium | Medium | Version the prompt and add regression contract tests; pin temperature/seed in later iterations | Engineering |
| R-006 | Low adoption if users do not trust AI-generated text | Medium | Medium | Show confidence, allow re-generation, and keep explanations grounded in visible aggregate data | Product |
| R-007 | A buggy UI loop triggers excessive explanation calls | Medium | High | Enforce 20 rpm per user and max 5 concurrent per tenant; make calls lazy by default | Engineering |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0002` (`AIProviderConnector` interface) | Internal / Technical | Menno | Accepted |
| D-002 | `ADR-0038` (Azure OpenAI enrichment integration) | Internal / Technical | Menno | Accepted |
| D-003 | `ADR-0003` / `ADR-0020` (`RequestGate` capacity gate) | Internal / Technical | Menno | Accepted |
| D-004 | `ADR-0048` (connector/prompt regression testing) | Internal / Technical | Menno | Accepted |
| D-005 | Epic 8 Analytics Dashboard built metrics and widgets | Internal / Product | Menno | Built |
| D-006 | `docs/product-research/feature-designs/22-metric-explainability.md` | Internal / Design | Menno | Accepted |
| D-007 | `docs/product-research/feature-adr-scoping.md` | Internal / Scoping | Menno | Accepted |
| D-008 | Story 9.2 — Metric explainability endpoint | Internal / Implementation | Engineering | Ready |

---

## 14. Acceptance Criteria

- `POST /v1/explain` accepts `metricKey`, `value`, `context`, and `locale` and returns `explanation` (`string | null`), `confidence` (`high` | `medium` | `low`), `generationId`, and optional `fallbackReason`.
- Unknown `metricKey` values return `400 UNKNOWN_METRIC_KEY`.
- String `value` and `previousValue` values are validated against `/^[a-z0-9-]+$/`; the prompt is built from structured JSON template variables, not raw string concatenation.
- Only aggregate data (`metricName`, `value`, `timeRange`, `previousValue`, `denominator`) is sent to the AI provider; no raw post bodies, `widgetId`, `watchlistId`, or PII are included.
- `confidence` is derived deterministically from context completeness on the server, never from the model's self-assessment.
- The endpoint calls `acquireForAiModel()` through the existing `RequestGate` per `ADR-0003` / `ADR-0020`.
- A dedicated user-scoped token bucket enforces 20 requests per minute per user and a maximum of 5 concurrent in-flight explanations per tenant, returning `429` when exceeded.
- A tenant `explanations_enabled` flag (default `true`, settable by `tenant_admin`) disables the endpoint with `403 EXPLAINABILITY_DISABLED` when `false`.
- Response caching is in-process only, keyed on `(tenantId, metricKey, value, timeRange, locale)` with a 5-minute TTL.
- The explanation prompt is versioned in `social-listening-core/.claude/skills/metric-explainability/SKILL.md` and covered by a permanent contract test.
- Contract tests cover `volume-spike`, `sentiment-share`, and `platform-mix` metrics, plus the validation, rate-limit, and refusal paths.
- The UI shows no loader for calls under 300 ms, a skeleton/shimmer for 300 ms – 1.5 s, and a detailed message for calls over 1.5 s.
- Explanations are accessible as real text and can be read by screen readers.
- Low-confidence explanations show a warning and a re-generation control.
- When the model refuses or returns unsafe content, the UI falls back to a static help link.
- Per-widget opt-out is available in the dashboard builder.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Metric explainability | The capability to generate a short, plain-language explanation of what a dashboard metric means and why it matters. |
| `metricKey` | An allowlisted string that identifies the metric being explained. |
| `AIProviderConnector` | The provider-agnostic abstraction used for AI enrichment and generation in the project. |
| `RequestGate` | The existing capacity-gating mechanism that throttles AI model calls per tenant. |
| `generationId` | A unique identifier for a single explanation, used for support and audit. |
| `confidence` | A `high`, `medium`, or `low` grade indicating how complete the input context is. |
| `fallbackReason` | An optional reason such as `content_filtered`, `insufficient_data`, `rate_limited`, or `model_error` when no explanation can be returned. |
| `explanations_enabled` | A tenant-wide feature flag that controls whether the explainability endpoint is active. |
| RLS | Row-level security; the mechanism that scopes data access to the current tenant. |
| PII | Personally identifiable information. |

---

## 16. Appendices

### Reference Documents

- `docs/adr/0078-metric-explainability-endpoint.md` — source ADR (Proposed).
- `docs/product-research/feature-designs/22-metric-explainability.md` — parent feature design.
- `docs/product-research/feature-adr-scoping.md` — feature-to-ADR scoping plan.

### Related User Stories

- **Story 9.2 — Metric explainability endpoint** (`docs/user-stories/epic-9-adr-0077-to-0085.md`): Backend contract for `POST /v1/explain`, allowlist validation, `RequestGate` integration, per-user/per-tenant rate limits, tenant `explanations_enabled` flag, in-process cache, prompt versioning, and contract tests for `volume-spike`, `sentiment-share`, `platform-mix`, validation, rate-limit, and refusal paths.

### Missing Sources

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature; competitive or market deep-research brief is not included.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
