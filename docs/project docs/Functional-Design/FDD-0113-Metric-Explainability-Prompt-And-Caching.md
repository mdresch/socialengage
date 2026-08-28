# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0113 Metric Explainability Prompt and Caching — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for Review) |
| Related Documents | ADR-0113, BRD-0113, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

The `POST /v1/explain` endpoint (ADR-0078) is already authorized, but its value depends on the quality, consistency, and cost of the explanations it returns. Today, the endpoint would generate an explanation on every call with an unspecified prompt and no caching, leading to inconsistent language, unbounded cost, and slow dashboard refreshes. This BRD defines the business need for a versioned prompt template, structured confidence-graded output, a short-lived deterministic cache, and an audit log to make metric explanations trustworthy, fast, and affordable for Tenant-Readers, Tenant-Users, and Tenant-Business-Analysts.

This FDD translates the accepted architecture and business requirements from ADR-0113 and BRD-0113 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Versioned prompt template v1 for `POST /v1/explain`
- Structured JSON response with `explanation` and `confidence`
- Determinism controls: `temperature=0`, fixed `seed` per prompt version, `promptVersion` field
- 5-minute TTL cache keyed by `SHA256(tenantId + metricKey + value + timeRange + filters + promptVersion)`
- Cache store in Redis or Postgres `metric_explanation_cache`
- Confidence grading rules (`high` / `medium` / `low`) tied to data completeness and sample size
- Audit logging to `platform_admin_audit_log` with `metricKey` and `cache_hit`
- Prompt change management (version bump invalidates prior cache)
- **Out of scope:** - Multi-language/locale support in the prompt or cache key (open question)
- Pre-computing explanations for every possible metric/filter combination during analytics refresh
- Model-calibrated probability / logprobs in `confidence` (open question)
- UI changes to display explanations or confidence badges (covered by Epic 9/13 UI stories)
- Cross-tenant cache sharing (open question)
- **Assumptions and constraints:** - The `AIProviderConnector` (ADR-0002) supports a `temperature` and `seed` parameter and JSON output mode.
- A Redis or Postgres short-lived cache is available in the target environment.
- The dashboard/analytics view has already resolved `tenantId`, `metricKey`, `value`, `previousValue`, `timeRange`, and `filters`.
- Users can see a confidence badge even if the explanation is generated; low confidence is not hidden.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Prompt engineering is a durability concern
`ADR-0078` established the `POST /v1/explain` endpoint. The endpoint is only as good as the prompt and the caching that keeps it fast and affordable. This ADR makes the prompt and cache explicit.

### 2. Dashboard users need consistent explanations
If the same metric is explained twice, the answer should be materially the same. Caching and structured prompts prevent surprise.

### 3. Confidence must reflect data quality
A metric with missing context should not claim certainty. The prompt and response must signal low confidence when data is sparse.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide consistent, plain-language explanations for every dashboard metric | Repeated calls for the same metric return materially the same explanation within the 5-minute cache window |
| 2 | Control and predict the cost of AI-generated explanations | 90%+ of repeated `POST /v1/explain` requests within a 5-minute TTL are served from cache |
| 3 | Increase user trust in AI explanations | 100% of explanations carry a `high`/`medium`/`low` confidence grade aligned to data completeness |
| 4 | Enable platform-level cost and performance auditing | Every `explain` call is recorded in `platform_admin_audit_log` with `metricKey` and `cache_hit` |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall generate a one-to-two-sentence plain-language explanation for a requested metric using a stored, versioned prompt template | Must | Prompt template v1 is stored; `explanation` field is returned in JSON and contains 1–2 sentences | Product Owner |
| BR-002 | The system shall grade each explanation with `high`, `medium`, or `low` confidence based on data completeness and sample size | Must | `confidence` is included in every response; rules are: high (≥30 data points, complete, clear change), medium (partial or small change or 10–29 points), low (<10 points or new/undefined) | Product Owner |
| BR-003 | The system shall make explain generation deterministic for the same inputs by using `temperature=0` and a fixed `seed` per prompt version | Must | Every `POST /v1/explain` with identical inputs uses `temperature=0` and a seed derived from `promptVersion`; output remains materially the same across repeated calls | Technical Lead |
| BR-004 | The system shall cache generated explanations for 5 minutes using a key of `SHA256(tenantId + metricKey + value + timeRange + filters + promptVersion)` | Must | Cache store is configured; TTL is 5 minutes by default; cache hit returns the stored `explanation` and `confidence` without an LLM call | Technical Lead |
| BR-005 | The system shall support cache invalidation when the prompt template version changes | Must | Incrementing `promptVersion` changes the cache key, so prior cached entries are not returned for new calls | Technical Lead |
| BR-006 | The system shall log every `explain` call to `platform_admin_audit_log` with `metricKey` and `cache_hit` | Must | Each call produces one audit row; `metricKey` and `cache_hit` are present | Product Owner |
| BR-007 | The system shall allow a per-metric TTL configuration, defaulting to 5 minutes | Should | A metric-level TTL override can be read by the cache layer; default remains 5 minutes | Product Owner |
| BR-008 | The system shall treat cache as advisory, regenerating on cache miss or explicit `no-cache` request | Could | `no-cache` header or equivalent bypasses the cache for a single call | Technical Lead |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader (primary) | Views dashboard widgets and KPIs | High | Understand any number without asking an analyst; see confidence at a glance |
| Tenant-User (primary) | Receives alerts and post summaries | High | Get a clear, one-sentence explanation for alerts and post-summary metrics |
| Tenant-Business-Analyst (secondary) | Deeper analysis of drivers | Medium | Trust that explanations are deterministic and not hallucinated |
| Tenant-Brand-Reputation-Manager (secondary) | Monitors sentiment/reach spikes | Medium | Quickly read the reason behind a metric change |
| Platform Admin | Cost and performance oversight | Medium | Audit every `explain` call, cache hit, and associated spend |
| Backend Engineer | Builds and maintains the prompt/caching layer | High | Stable, versioned prompt with deterministic output and clear cache invalidation rules |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.7 | backend engineer | a versioned prompt, deterministic output, and 5-minute caching for `POST /v1/explain`, | metric explanations are consistent and affordable. | Prompt template v1 is versioned and stored.; Model is called with `temperature=0` and a fixed seed.; JSON output contains `explanation` and `confidence`. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenantId` | Tenant identifier for RLS and cache isolation | Auth / tenant context | Backend | Internal |
| `metricKey` | Machine-readable metric identifier | Dashboard / analytics query | Product | Internal |
| `metricName` | Human-readable label (e.g. "Mentions this week") | Metric catalog | Product | None |
| `value` | Current metric value | Analytics aggregation | Backend | Aggregate |
| `previousValue` | Prior-period metric value | Analytics aggregation | Backend | Aggregate |
| `start` / `end` | Time range of the metric | Dashboard filter | Backend | Internal |
| `filters` | Applied watchlist, platform, topic, etc. filters | Dashboard state | Backend | Internal |
| `watchlistName` | Name of the watchlist providing context | Watchlist record | Product | Internal |
| `context` | Denominator, filters, and watchlist name bundled for the prompt | `MetricExplainabilityService` | Backend | Aggregate |
| `promptVersion` | Integer version of the prompt template | Prompt configuration | Backend | Internal |
| `explanation` | One-to-two-sentence natural-language explanation | AI model output | Backend | None |
| `confidence` | `high` / `medium` / `low` self-assessment | AI model output | Backend | None |
| `cache_hit` | Boolean indicating whether the response came from cache | Cache layer | Backend | Internal |
| `platform_admin_audit_log` | Record of every `explain` call with `metricKey` and `cache_hit` | Audit service | Platform Admin | Audit |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A prompt template must be versioned (`promptVersion`); any change to the template text, output instructions, or confidence rules increments the version. |
| BRU-002 | The model call for `explain` must always use `temperature=0` and a fixed `seed` derived from the current `promptVersion`. |
| BRU-003 | The cache key must include `tenantId`, `metricKey`, `value`, `timeRange`, `filters`, and `promptVersion`; a change to any component produces a cache miss. |
| BRU-004 | Confidence is the model's self-assessment, not a computed score, but it must be constrained by the data-completeness thresholds in the prompt. |
| BRU-005 | Every `explain` call, whether cache hit or miss, must be written to `platform_admin_audit_log` with `metricKey` and `cache_hit`. |
| BRU-006 | Cache is advisory; a cache miss or an explicit `no-cache` request must regenerate the explanation. |
| BRU-007 | Explanations must use only the metric name, value, previous value, time range, and supplied context; they must not speculate beyond the data or mention internal systems. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The prompt must not include raw post bodies or PII unless explicitly added by the user | Security | Must | Prompt review confirms only tenant-scoped aggregate data, metric name, value, previous value, time range, and context are sent to the AI provider |
| NFR-002 | Cache keys must include `tenantId` so explanations are not shared across tenants | Security | Must | Contract tests assert a request for tenant A does not return a cached result from tenant B |
| NFR-003 | The same metric with the same inputs must return materially the same explanation within the cache TTL | Reliability | Must | Determinism smoke test: 10 identical calls produce the same `explanation` and `confidence` |
| NFR-004 | `POST /v1/explain` must be available for dashboard widgets, post summaries, and alert cards | Usability | Should | Endpoint is reachable from the `MetricExplanation` / `ExplanationTooltip` components |
| NFR-005 | Prompt changes must be versioned and must not silently alter behavior for existing dashboard views | Maintainability | Must | `promptVersion` is exposed in the API or logged; a change to the template increments the version and busts the cache |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | LLM output still varies despite `temperature=0`, undermining consistency | Medium | Medium | Lock prompt template, use fixed seed, add determinism smoke test; investigate model provider-specific behavior | Technical Lead |
| R-002 | Caching at 5 minutes causes stale explanations on fast-changing metrics | Medium | Low | Cache is advisory; allow `no-cache` request and per-metric TTL override; dashboards can opt out for volatile metrics | Technical Lead |
| R-003 | Prompt version changes are not tracked, silently altering cache behavior or output | Medium | High | Enforce versioned prompt template; `promptVersion` must be in cache key and audit log; tests fail if unversioned prompt is deployed | Technical Lead |
| R-004 | Cost overruns from dashboards auto-calling `explain` for every widget | Medium | High | Cache, 5-minute TTL, and audit logging give platform admin visibility; future gating can be added (ADR-0112) | Product Owner |
| R-005 | Multi-tenant cache leakage if `tenantId` is omitted or substituted | Low | High | Cache key unit tests cover cross-tenant collision; static code review requires `tenantId` in key | Technical Lead |
| R-006 | Confidence grades mislead users because the model ignores the data-completeness instruction | Medium | Medium | Parse and validate model output; log confidence and data-point count to compare; support overrides in v2 | Product Owner |

---

---

## 12. Assumptions and Dependencies

- The `AIProviderConnector` (ADR-0002) supports a `temperature` and `seed` parameter and JSON output mode.
- A Redis or Postgres short-lived cache is available in the target environment.
- The dashboard/analytics view has already resolved `tenantId`, `metricKey`, `value`, `previousValue`, `timeRange`, and `filters`.
- Users can see a confidence badge even if the explanation is generated; low confidence is not hidden.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0078 `POST /v1/explain` endpoint contract | Internal / Architectural | Technical Lead | Accepted before implementation of ADR-0113 |
| D-002 | `AIProviderConnector` (ADR-0002) with `temperature`, `seed`, and JSON output support | Internal / Architectural | Technical Lead | Accepted and implemented |
| D-003 | Feature design `22-metric-explainability.md` | Internal / Product | Product Owner | Draft, baseline for v1 scope |
| D-004 | `platform_admin_audit_log` table and write path | Internal / Backend | Technical Lead | Existing from previous stories |
| D-005 | Epic 9 / Epic 13 UI stories that consume `POST /v1/explain` | Internal / Frontend | Product Owner | Implemented after backend contract is stable |

---

---

## 13. Open Questions

- Should the prompt support multiple languages? If so, how is `locale` included in the cache key?
- Should `confidence` also reflect model-calibrated probabilities (e.g. logprobs)?
- How are prompt version changes rolled out without breaking existing cached results?
- Should the cache be per-tenant, or can tenants with the same metric values share cache?

---

---

## 14. Appendix

### Reference Documents

- ADR-0113: `docs/adr/0113-metric-explainability-prompt-and-caching.md`
- BRD-0113: `docs/project docs/Business-Requirements/BRD-0113-Metric-Explainability-Prompt-And-Caching.md`
- Feature design: `docs/product-research/feature-designs/22-metric-explainability.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0113 and BRD-0113. |