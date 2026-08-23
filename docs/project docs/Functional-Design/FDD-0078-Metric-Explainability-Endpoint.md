# BRD-0078: Metric Explainability Endpoint

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0078: Metric Explainability Endpoint |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0078-metric-explainability-endpoint.md, ../Business-Requirements/BRD-0078-Metric-Explainability-Endpoint.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0078-metric-explainability-endpoint.md and the business requirements in BRD-0078-Metric-Explainability-Endpoint.md into functional design for **Metric Explainability Endpoint**.
Dashboards in the Social Listening / Insights subsystem surface aggregate numbers such as mention volume, sentiment share, source mix, and reach. Many of these metrics are difficult for non-analysts to interpret, forcing `Tenant-Reader` and `Tenant-User` personas to ask a business analyst for help before they can act on a number.

This BRD proposes an on-demand **Metric Explainability Endpoint** that adds a short, plain-language explanation to any dashboard metric. The backend exposes `POST /v1/explain`, which receives a metric key, its value, and a small aggregate context and returns a one- to two-sentence explanation plus a confidence grade. The UI displays the explanation inline, in a tooltip, or on request, with loading states and per-widget opt-out.

By making metrics self-explanatory, the feature is expected to increase dashboard trust, reduce analyst dependency, and improve accessibility for screen readers and non-technical users while keeping AI generation costs bounded through short-lived caching and opt-out controls.

---

### 2.2 Scope
**In scope:**
- A new `POST /v1/explain` REST endpoint and its request/response contract.
- An allowlisted set of `metricKey` values; unknown keys return a clear `400 UNKNOWN_METRIC_KEY` error.
- Generation of one- to two-sentence, plain-language explanations using the existing `AIProviderConnector` and the already-wired Azure OpenAI provider.
- Tenant-scoped, RLS-gated access for `app_user` roles.
- A confidence grade (`high` / `medium` / `low`) returned with every explanation.
- Optional, short-lived server-side caching (5-minute TTL) keyed on `(tenantId, metricKey, value, timeRange, locale)`.
- UI conventions for displaying explanations: no loader for fast calls, skeleton/shimmer for medium calls, detailed progress message for slow calls, inline text or tooltip, and per-widget opt-out.
- Low-confidence handling: warning icon, user-triggered re-generation, and a fallback to a static help link when the model refuses or returns unsafe content.
- English locale as the default; additional locales may be enabled in later versions.

**Out of scope:**
- Pre-generating and storing explanations for every widget on every dashboard load.
- Static, one-size-fits-all help text that cannot reflect the current value or time range.
- Client-side explanation generation against a local browser model.
- Multi-sentence “analyst-depth” explanations in v1 (may be added later via a `depth` flag).
- Multi-language support in v1 beyond the `locale` parameter contract.
- Persisted schema changes; v1 uses request-scoped generation and a short-lived cache only.
- Sending raw post bodies, PII, or other non-aggregate data to the AI provider.
- Tenant-wide on/off toggle for metric explainability in v1.

## 3. Context and Background
See ADR Context.
Dashboards in the Social Listening / Insights subsystem surface aggregate numbers such as mention volume, sentiment share, source mix, and reach. Many of these metrics are difficult for non-analysts to interpret, forcing `Tenant-Reader` and `Tenant-User` personas to ask a business analyst for help before they can act on a number.

This BRD proposes an on-demand **Metric Explainability Endpoint** that adds a short, plain-language explanation to any dashboard metric. The backend exposes `POST /v1/explain`, which receives a metric key, its value, and a small aggregate context and returns a one- to two-sentence explanation plus a confidence grade. The UI displays the explanation inline, in a tooltip, or on request, with loading states and per-widget opt-out.

By making metrics self-explanatory, the feature is expected to increase dashboard trust, reduce analyst dependency, and improve accessibility for screen readers and non-technical users while keeping AI generation costs bounded through short-lived caching and opt-out controls.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Improve dashboard accessibility and self-service insight consumption | `Tenant-Reader` and `Tenant-User` can understand a metric without requesting analyst support |
| 2 | Increase trust in analytics by grounding numbers in plain-language context | Positive user feedback and fewer support requests asking “what does this number mean?” |
| 3 | Reduce time-to-decision for non-analyst users | Users can act on a metric after reading its one-sentence explanation |
| 4 | Keep AI generation cost predictable and bounded | Per-tenant call volume, cache hit rate, and average cost per explained metric are tracked and reviewed |

---

**Positive consequences (from ADR):**
1. **Improved legibility for non-analyst users:** `Tenant-Reader` and `Tenant-User` can understand metrics without asking an analyst.
2. **Additional AI cost per view:** every explained metric costs one LLM call. Caching and opt-out controls are required to keep cost bounded.
3. **No new persisted data:** explanations are generated on demand and do not require a schema migration.
4. **Prompt engineering becomes a durability concern:** the explanation prompt must be versioned and tested like other `AIProviderConnector` contracts.
5. **Foundation for future features:** `24-daily-digest-email.md`, `25-topic-evolution-timeline.md`, and `28-semantic-search-rag.md` can all consume `POST /v1/explain` for grounded summaries.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall expose a `POST /v1/explain` endpoint that accepts `metricKey`, `value`, `context`, and `locale`. | Must | Endpoint contract matches ADR-0078 and returns `200` with `explanation`, `confidence`, and `generationId`. | Engineering |
| BR-002 | The system shall validate `metricKey` against a known allowlist and return `400 UNKNOWN_METRIC_KEY` for unknown keys. | Must | Unknown keys are rejected; allowlisted keys are accepted. | Engineering |
| BR-003 | The system shall send only aggregate, tenant-scoped data to the AI provider; no raw post bodies or PII. | Must | Prompt audit confirms only metric name, value, time range, previous value, and denominator are included. | Engineering |
| BR-004 | The system shall enforce tenant and RLS gating for every explanation request. | Must | Cross-tenant requests are denied; `app_user` authorization is required. | Engineering |
| BR-005 | The system shall return `explanation` as one to two sentences, a `confidence` of `high`, `medium`, or `low`, and a unique `generationId`. | Must | Response shape matches ADR-0078; `generationId` is present. | Engineering |
| BR-006 | The system shall support a `context` containing `widgetId`, `watchlistId`, `timeRange`, `previousValue`, and `denominator`. | Must | All listed context fields are accepted and used in the explanation when provided. | Engineering |
| BR-007 | The system shall cache successful explanations for 5 minutes by default, keyed on `(tenantId, metricKey, value, timeRange, locale)`. | Should | Cache hit returns the same `explanation` and `generationId`; TTL is configurable per metric. | Engineering |
| BR-008 | The UI shall show no loader for calls under 300 ms, a skeleton/shimmer for 300 ms – 1.5 s, and a detailed message for calls over 1.5 s. | Should | Loading states match the latency brackets defined in ADR-0078. | Product / UI |
| BR-009 | The UI shall allow each widget to opt out of explanations if the metric is self-explanatory. | Should | Dashboard builder exposes an opt-out control and hides the explanation when selected. | Product / UI |
| BR-010 | The UI shall surface low-confidence explanations with a warning icon and offer re-generation; when the model refuses, it shall fall back to a static help link. | Should | Low confidence and refusal cases are handled without breaking the dashboard. | Product / UI |
| BR-011 | The system shall support an optional `locale` parameter defaulting to `en`. | Could | Non-English locales are accepted in the contract; v1 behavior can remain English. | Engineering |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader | Primary end user of dashboard explanations | High | Understand any dashboard number quickly without analyst help |
| Tenant-User | Primary end user of alert and post-summary explanations | High | See clear, one-sentence explanations for alerts and KPIs |
| Tenant-Business-Analyst | Secondary user; may review deeper context | Medium | Optional, more detailed drivers and comparison narratives |
| Tenant-Brand-Reputation-Manager | Secondary user tracking sentiment/reach spikes | Medium | Read the reason behind a spike directly from the dashboard |
| Product / Engineering | Build and operate the endpoint and UI | High | Stable contract, bounded cost, testable prompt behavior |
| Menno | Business sponsor, product owner, technical lead | High | Clear scope, traceable requirements, and acceptance criteria |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.2 | epic-9-adr-0077-to-0085.md | As backend engineer, I want `POST /v1/explain` to return a short, confidence-graded explanation for any dashboard metric, so that `Tenant-Reader` and `Tenant... | `POST /v1/explain` accepts `metricKey`, `value`, `context`, and `locale` and returns `explanation`, `confidence`, and `generationId`.; `metricKey` is validat... |


## 7. Data Requirements
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
| `tenantId` | Tenant identifier used for authorization and cache scoping | Auth / RLS | Engineering | High |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Only known `metricKey` values in the allowlist may receive an explanation; unknown keys return `400 UNKNOWN_METRIC_KEY`. |
| BRU-002 | The prompt sent to the AI provider may contain only aggregate data: metric name, current value, time range, previous value, and optional denominator. |
| BRU-003 | Every explanation request must be tenant-scoped and RLS-gated to the calling `app_user`. |
| BRU-004 | Cache keys must include `tenantId` so explanations cannot be returned to a different tenant. |
| BRU-005 | Low-confidence explanations must be shown with a warning and a re-generation option; if the model refuses or returns unsafe content, the UI falls back to a static help link. |
| BRU-006 | Per-widget opt-out overrides any default dashboard explainability setting for that metric. |
| BRU-007 | Explanations are transient and computed on demand; v1 does not persist them as facts. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0002` (`AIProviderConnector` interface) | Internal / Technical | Menno | Accepted |
| D-002 | `ADR-0038` (Azure OpenAI enrichment integration) | Internal / Technical | Menno | Accepted |
| D-003 | Epic 8 Analytics Dashboard built metrics and widgets | Internal / Product | Menno | Built |
| D-004 | `docs/product-research/feature-designs/22-metric-explainability.md` | Internal / Design | Menno | Accepted |
| D-005 | Story 9.2 — Metric explainability endpoint | Internal / Implementation | Engineering | Ready |
| D-006 | Story 13.7 — Metric explainability prompt and caching | Internal / Implementation | Engineering | Ready |

---

- The existing `AIProviderConnector` abstraction and Azure OpenAI integration are available and stable.
- Dashboard and analytics widgets already expose the metrics that need explanation.
- A tenant-scoped, short-lived caching mechanism is available for v1.
- Users prefer a one-sentence explanation over richer, multi-paragraph analysis for the first version.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Explanation requests should complete under 1 second for the 95th percentile and under 1.5 seconds for the 99th percentile. | Performance | Should | Measured in staging and production monitoring. |
| NFR-002 | No PII or raw post content may be sent to the AI provider or stored in the cache. | Security | Must | Prompt and cache audits pass; RLS is enforced. |
| NFR-003 | Cache entries must be tenant-scoped and not leak across tenants. | Security | Must | Cross-tenant cache collision tests pass. |
| NFR-004 | Explanations must be readable by screen readers and available as real text, not tooltips only. | Accessibility | Should | Screen-reader and keyboard navigation tests pass. |
| NFR-005 | The explanation prompt must be versioned and covered by contract tests like other `AIProviderConnector` consumers. | Maintainability | Should | Prompt version is tracked and regression tests exist. |

---

## 11. Error Handling and Exceptions
1. **Improved legibility for non-analyst users:** `Tenant-Reader` and `Tenant-User` can understand metrics without asking an analyst.
2. **Additional AI cost per view:** every explained metric costs one LLM call. Caching and opt-out controls are required to keep cost bounded.
3. **No new persisted data:** explanations are generated on demand and do not require a schema migration.
4. **Prompt engineering becomes a durability concern:** the explanation prompt must be versioned and tested like other `AIProviderConnector` contracts.
5. **Foundation for future features:** `24-daily-digest-email.md`, `25-topic-evolution-timeline.md`, and `28-semantic-search-rag.md` can all consume `POST /v1/explain` for grounded summaries.

---

## 12. Assumptions and Dependencies
- The existing `AIProviderConnector` abstraction and Azure OpenAI integration are available and stable.
- Dashboard and analytics widgets already expose the metrics that need explanation.
- A tenant-scoped, short-lived caching mechanism is available for v1.
- Users prefer a one-sentence explanation over richer, multi-paragraph analysis for the first version.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Azure OpenAI cost grows with dashboard usage | Medium | High | Implement 5-minute cache, per-widget opt-out, and monitor per-tenant call volume | Engineering |
| R-002 | Explanation latency degrades dashboard performance | Medium | High | Use skeleton/progress states, cache, and target p95 under 1 second | Engineering |
| R-003 | Model hallucinates or over-claims causation | Medium | High | Constrain prompts to provided aggregate data, show confidence, allow re-generation, and fall back to help links | Engineering |
| R-004 | Raw posts or PII are accidentally sent to the AI provider | Low | High | Enforce prompt review, contract tests, and data-sensitivity audit; never include `body_markdown` or PII | Engineering |
| R-005 | Prompt drift or model updates change explanation quality | Medium | Medium | Version the prompt and add regression contract tests; pin temperature/seed in later iterations | Engineering |
| R-006 | Low adoption if users do not trust AI-generated text | Medium | Medium | Show confidence, allow re-generation, and keep explanations grounded in visible aggregate data | Product |

---

## 14. Appendix
- ADR: `../../adr/0078-metric-explainability-endpoint.md`
- BRD: `../Business-Requirements/BRD-0078-Metric-Explainability-Endpoint.md`
- Feature design: `docs/product-research/feature-designs/22-metric-explainability.md``
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above