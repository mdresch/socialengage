# BRD-0113: Metric Explainability Prompt and Caching

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Metric Explainability Prompt and Caching Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent (Product) |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft for Review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0113 and feature design `22-metric-explainability` |

**Note:** ADR-0113 is currently `Proposed`; this BRD is a draft for review and may change pending ADR acceptance.

---

## 2. Executive Summary

The `POST /v1/explain` endpoint (ADR-0078) is already authorized, but its value depends on the quality, consistency, and cost of the explanations it returns. Today, the endpoint would generate an explanation on every call with an unspecified prompt and no caching, leading to inconsistent language, unbounded cost, and slow dashboard refreshes. This BRD defines the business need for a versioned prompt template, structured confidence-graded output, a short-lived deterministic cache, and an audit log to make metric explanations trustworthy, fast, and affordable for Tenant-Readers, Tenant-Users, and Tenant-Business-Analysts.

The proposed solution is to lock the prompt template and version, force the model to `temperature=0` with a fixed `seed`, cache the result for five minutes using a SHA-256 key that includes the tenant, metric, value, time range, filters, and prompt version, and log every call for cost and performance review. This makes each metric's explanation materially the same when requested repeatedly, protects against runaway LLM spend on frequently-refreshed dashboards, and gives users a clear confidence signal when data is too sparse to trust.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Provide consistent, plain-language explanations for every dashboard metric | Repeated calls for the same metric return materially the same explanation within the 5-minute cache window |
| 2 | Control and predict the cost of AI-generated explanations | 90%+ of repeated `POST /v1/explain` requests within a 5-minute TTL are served from cache |
| 3 | Increase user trust in AI explanations | 100% of explanations carry a `high`/`medium`/`low` confidence grade aligned to data completeness |
| 4 | Enable platform-level cost and performance auditing | Every `explain` call is recorded in `platform_admin_audit_log` with `metricKey` and `cache_hit` |

---

## 4. Scope

### 4.1 In Scope

- Versioned prompt template v1 for `POST /v1/explain`
- Structured JSON response with `explanation` and `confidence`
- Determinism controls: `temperature=0`, fixed `seed` per prompt version, `promptVersion` field
- 5-minute TTL cache keyed by `SHA256(tenantId + metricKey + value + timeRange + filters + promptVersion)`
- Cache store in Redis or Postgres `metric_explanation_cache`
- Confidence grading rules (`high` / `medium` / `low`) tied to data completeness and sample size
- Audit logging to `platform_admin_audit_log` with `metricKey` and `cache_hit`
- Prompt change management (version bump invalidates prior cache)

### 4.2 Out of Scope

- Multi-language/locale support in the prompt or cache key (open question)
- Pre-computing explanations for every possible metric/filter combination during analytics refresh
- Model-calibrated probability / logprobs in `confidence` (open question)
- UI changes to display explanations or confidence badges (covered by Epic 9/13 UI stories)
- Cross-tenant cache sharing (open question)

### 4.3 Assumptions

- The `AIProviderConnector` (ADR-0002) supports a `temperature` and `seed` parameter and JSON output mode.
- A Redis or Postgres short-lived cache is available in the target environment.
- The dashboard/analytics view has already resolved `tenantId`, `metricKey`, `value`, `previousValue`, `timeRange`, and `filters`.
- Users can see a confidence badge even if the explanation is generated; low confidence is not hidden.

### 4.4 Constraints

- ADR-0113 is `Proposed`; this BRD may not be finalized until the ADR is accepted.
- Cache TTL is 5 minutes by default, configurable per metric but not per tenant in v1.
- Explanations must not include raw post bodies or PII in the prompt.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader (primary) | Views dashboard widgets and KPIs | High | Understand any number without asking an analyst; see confidence at a glance |
| Tenant-User (primary) | Receives alerts and post summaries | High | Get a clear, one-sentence explanation for alerts and post-summary metrics |
| Tenant-Business-Analyst (secondary) | Deeper analysis of drivers | Medium | Trust that explanations are deterministic and not hallucinated |
| Tenant-Brand-Reputation-Manager (secondary) | Monitors sentiment/reach spikes | Medium | Quickly read the reason behind a metric change |
| Platform Admin | Cost and performance oversight | Medium | Audit every `explain` call, cache hit, and associated spend |
| Backend Engineer | Builds and maintains the prompt/caching layer | High | Stable, versioned prompt with deterministic output and clear cache invalidation rules |

---

## 6. Current State (As-Is)

`POST /v1/explain` is authorized (ADR-0078) but the prompt template, caching strategy, determinism rules, and confidence grading are undefined. Without this ADR, each dashboard refresh would call the LLM with an unconstrained prompt, producing answers that vary in length, tone, and speculation. There is no cache, so repeated views of the same metric generate repeated charges. There is no explicit confidence grade, so users cannot tell when an explanation is unreliable because of sparse data. There is no centralized logging for `explain` calls, making cost and performance review difficult.

---

## 7. Future State (To-Be)

When a dashboard widget, post summary, or alert card needs an explanation, the frontend calls `POST /v1/explain` with the metric, value, time range, and context. The backend builds a versioned prompt from a stored template, fills in the metric and context fields, and calls the AI provider with `temperature=0` and a fixed `seed` tied to the prompt version. The model returns JSON containing a one-to-two-sentence `explanation` and a `confidence` value. Before calling the model, the backend checks a short-lived cache; if a matching result is found, it is returned without an LLM call. Every call—cache hit or miss—is logged in `platform_admin_audit_log` with the `metricKey` and `cache_hit` flag. When the prompt template changes, `promptVersion` increments, the cache key changes, and old cached results are naturally invalidated.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The prompt must not include raw post bodies or PII unless explicitly added by the user | Security | Must | Prompt review confirms only tenant-scoped aggregate data, metric name, value, previous value, time range, and context are sent to the AI provider |
| NFR-002 | Cache keys must include `tenantId` so explanations are not shared across tenants | Security | Must | Contract tests assert a request for tenant A does not return a cached result from tenant B |
| NFR-003 | The same metric with the same inputs must return materially the same explanation within the cache TTL | Reliability | Must | Determinism smoke test: 10 identical calls produce the same `explanation` and `confidence` |
| NFR-004 | `POST /v1/explain` must be available for dashboard widgets, post summaries, and alert cards | Usability | Should | Endpoint is reachable from the `MetricExplanation` / `ExplanationTooltip` components |
| NFR-005 | Prompt changes must be versioned and must not silently alter behavior for existing dashboard views | Maintainability | Must | `promptVersion` is exposed in the API or logged; a change to the template increments the version and busts the cache |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| `explain` call count (cache hit + cache miss) | Track LLM usage and cost | Platform Admin / Performance Review Agent | Continuous (per call) |
| Cache hit rate | Validate caching cost savings | Platform Admin | Hourly / Daily |
| Confidence distribution (`high`/`medium`/`low`) | Monitor explanation quality and data gaps | Product / QA | Daily |
| `promptVersion` change log | Track prompt drift and cache-bust events | Technical Lead | On change |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | LLM output still varies despite `temperature=0`, undermining consistency | Medium | Medium | Lock prompt template, use fixed seed, add determinism smoke test; investigate model provider-specific behavior | Technical Lead |
| R-002 | Caching at 5 minutes causes stale explanations on fast-changing metrics | Medium | Low | Cache is advisory; allow `no-cache` request and per-metric TTL override; dashboards can opt out for volatile metrics | Technical Lead |
| R-003 | Prompt version changes are not tracked, silently altering cache behavior or output | Medium | High | Enforce versioned prompt template; `promptVersion` must be in cache key and audit log; tests fail if unversioned prompt is deployed | Technical Lead |
| R-004 | Cost overruns from dashboards auto-calling `explain` for every widget | Medium | High | Cache, 5-minute TTL, and audit logging give platform admin visibility; future gating can be added (ADR-0112) | Product Owner |
| R-005 | Multi-tenant cache leakage if `tenantId` is omitted or substituted | Low | High | Cache key unit tests cover cross-tenant collision; static code review requires `tenantId` in key | Technical Lead |
| R-006 | Confidence grades mislead users because the model ignores the data-completeness instruction | Medium | Medium | Parse and validate model output; log confidence and data-point count to compare; support overrides in v2 | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0078 `POST /v1/explain` endpoint contract | Internal / Architectural | Technical Lead | Accepted before implementation of ADR-0113 |
| D-002 | `AIProviderConnector` (ADR-0002) with `temperature`, `seed`, and JSON output support | Internal / Architectural | Technical Lead | Accepted and implemented |
| D-003 | Feature design `22-metric-explainability.md` | Internal / Product | Product Owner | Draft, baseline for v1 scope |
| D-004 | `platform_admin_audit_log` table and write path | Internal / Backend | Technical Lead | Existing from previous stories |
| D-005 | Epic 9 / Epic 13 UI stories that consume `POST /v1/explain` | Internal / Frontend | Product Owner | Implemented after backend contract is stable |

---

## 14. Acceptance Criteria

- The prompt template v1 is stored and versioned; the `promptVersion` is `1` and increments only when the template changes.
- The model is called with `temperature=0` and a fixed seed per `promptVersion`.
- The JSON response contains an `explanation` of one to two sentences and a `confidence` of `high`, `medium`, or `low`.
- The cache key uses `SHA256(tenantId + metricKey + value + timeRange + filters + promptVersion)`.
- A cached response is returned for the same inputs within the TTL; a `cache_hit` is recorded in the audit log.
- Every `explain` call is logged in `platform_admin_audit_log` with `metricKey` and `cache_hit`.
- Cross-tenant cache isolation is verified by contract tests.
- Determinism is verified by repeated calls returning materially the same explanation.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `AIProviderConnector` | The project's abstraction over AI/LLM providers (ADR-0002). |
| `confidence` | The model's self-assessment of how reliable an explanation is, constrained to `high`, `medium`, or `low`. |
| `context` | The denominator, filters, and watchlist name that accompany a metric in the prompt. |
| `metric_explanation_cache` | The short-lived cache table or store that holds generated explanations keyed by a SHA-256 hash. |
| `metricKey` | A machine-readable identifier for a metric, validated by the `POST /v1/explain` allowlist (ADR-0078). |
| `promptVersion` | An integer version of the prompt template; changes to the template or confidence rules increment it. |
| `POST /v1/explain` | The endpoint authorized by ADR-0078 that returns a plain-language explanation for a dashboard metric. |
| `temperature` | An LLM sampling parameter; `0` makes output as deterministic as possible. |
| `TTL` | Time-to-live for a cached explanation, defaulting to 5 minutes. |

---

## 16. Appendices

### Appendix A — Related ADRs

- ADR-0113: Metric explainability prompt and caching (source for this BRD; status: `Proposed`)
- ADR-0078: `POST /v1/explain` endpoint contract
- ADR-0002: `AIProviderConnector` abstraction

### Appendix B — Feature Design and Scoping

- `docs/product-research/feature-designs/22-metric-explainability.md` — high-level product design and persona acceptance
- `docs/product-research/feature-adr-scoping.md` — chunking plan that split `22-metric-explainability` into ADR-0078 and ADR-0113

### Appendix C — Deep Research

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for `22-metric-explainability`. This section should be updated if a research brief is produced later.

### Appendix D — User Stories

- **Story 9.2** — Metric explainability endpoint (Epic 9, ADR-0078): creates the `POST /v1/explain` contract and initial caching.
- **Story 13.7** — Metric explainability prompt and caching (Epic 13, ADR-0113): versioned prompt, deterministic output, 5-minute cache, and audit logging.

### Appendix E — Open Questions Carried from ADR-0113

- Should the prompt support multiple languages, and how would `locale` be included in the cache key?
- Should `confidence` also reflect model-calibrated probabilities (e.g., logprobs)?
- How are prompt version changes rolled out without breaking existing cached results?
- Should the cache be per-tenant only, or can tenants with identical metric values share cache entries?

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
