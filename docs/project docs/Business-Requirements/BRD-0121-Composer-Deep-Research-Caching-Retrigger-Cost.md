# Business Requirements Document — ADR-0121: Composer Deep Research Caching, Re-Trigger, and Cost Justification

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Composer Deep Research Caching, Re-Trigger, and Cost Justification — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft — ADR-0121 is Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0121 |

---

## 2. Executive Summary

ADR-0076 introduced the Composer Deep Research Agent as an on-demand, synchronous capability for Polypost Composer authors. In its v1 form, every `POST /v1/composer/research` call runs the full extraction, search, and synthesis pipeline and pays the associated Azure OpenAI and Brave/Bing costs, with no persistence of results. In practice, authors iterate on a draft and rerun research several times for only minor text changes, which causes redundant spend on nearly identical queries.

ADR-0121 proposes a v2 enhancement: persist per-tenant, time-bounded research results keyed by a normalized text hash; allow a user-initiated `?refresh=true` bypass to re-run the pipeline; record every request in a cost-telemetry table; and enforce tenant-level daily and monthly cost caps. The goal is to make the feature cheaper, transparent, and safe for multi-tenant use without turning SocialEngage into a billing intermediary.

This initiative is expected to reduce redundant provider spend, give tenants an auditable view of research usage, and protect both the tenant and the platform from runaway costs.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce redundant research cost for iterative drafting | Measurable increase in `cache_hit` rate and lower average `estimated_cost_usd` per research request |
| 2 | Make research cost visible and auditable per tenant | `research_runs` table provides complete, queryable request/cost history within a tenant |
| 3 | Protect tenants from unbounded research spend | Daily request cap and optional monthly cost cap enforced at the API before provider calls |
| 4 | Preserve tenant isolation and RLS guarantees | All cache and telemetry rows are scoped to a single `tenant_id` and protected by existing Postgres RLS |

---

## 4. Scope

### 4.1 In Scope

- A new `research_cache` table scoped by `tenant_id` and keyed by a stable `text_hash` covering normalized request text plus active AI/search provider ids.
- Cache hit logic on `POST /v1/composer/research` that returns a stored `ResearchResult` when the hash exists and has not expired.
- A `?refresh=true` query parameter that bypasses the cache, re-runs the pipeline, and overwrites the prior cache row.
- A new `research_runs` telemetry table recording every research request, including `cache_hit`, token counts, and `estimated_cost_usd`.
- Two new `tenant_settings` fields: `research_cache_ttl_hours` and `research_daily_request_cap`, plus an optional `research_monthly_cost_cap_usd`.
- User-initiated re-trigger semantics through the Composer UI (e.g., a "Research again" / "Refresh" button).

### 4.2 Out of Scope

- v1 implementation of ADR-0076 (cache-free pipeline) — this BRD covers the v2 enhancement only.
- Background re-scheduling or automatic re-triggering of research.
- Cross-tenant or global cache sharing.
- Billing or invoicing; `estimated_cost_usd` is telemetry, not a ledger.
- Exact reconciliation of telemetry against provider invoices.

### 4.3 Assumptions

- ADR-0076 v1 is already in place and returns a stable `ResearchResult` shape.
- Tenant credentials for Azure OpenAI and Brave/Bing search are already configured via existing provider connectors.
- Postgres Row-Level Security is active and will be applied to `research_cache` and `research_runs`.
- Cost inputs (token counts, provider rates) are available to compute an `estimated_cost_usd`.

### 4.4 Constraints

- Cache and telemetry must live in the existing Postgres tenant database; no new cache tier is introduced.
- `text_hash` normalization must be stable across equivalent drafts but avoid over-broad matching.
- Cost caps must not depend on real-time billing systems; they are based on telemetry estimates.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Composer Author | End user who runs deep research | High | Fast, iterative research without paying for every minor edit |
| Tenant Admin | Budget and settings owner | High | Cost visibility, predictable caps, and control over cache TTL |
| Platform Admin | Platform-wide oversight | Medium | Assurance that tenant costs are bounded and isolated |
| Engineering | Builds and maintains the feature | High | Clear, RLS-compatible data model and simple re-trigger semantics |
| Finance / Operations | Cost governance | Low | Audit trail of per-tenant usage for reconciliation |

---

## 6. Current State (As-Is)

ADR-0076 v1 runs the full extraction → search → synthesis pipeline on every `POST /v1/composer/research` call. Results are not persisted. Because authors typically iterate on a post draft, the same or nearly identical text is researched multiple times, each call incurring the full cost of Azure OpenAI and Brave/Bing usage. There is no visibility into how often research is run, no cache, and no tenant-level limit on volume or spend. For a multi-tenant product where the tenant pays providers directly, this lack of boundaries and telemetry creates both cost and trust risk.

**Pain points:**
- Redundant provider cost for repeated or minor-draft research runs.
- No audit trail of research usage per tenant.
- No protection against accidental or excessive research calls.
- No user-visible control to refresh stale or unwanted cached research.

---

## 7. Future State (To-Be)

After this initiative, the Composer Deep Research endpoint first computes a tenant-scoped `text_hash` from normalized draft text and active provider ids. If a non-expired `research_cache` row exists, the stored `ResearchResult` is returned immediately and `research_runs` records a `cache_hit=true` event with no provider spend. If the user explicitly requests a refresh, or no matching cache row exists, the pipeline re-runs, the new result is stored, and a `cache_hit=false` row is recorded with the estimated cost.

Every request is written to `research_runs`, giving tenants an auditable history. A `research_daily_request_cap` returns `429 RESEARCH_DAILY_CAP_EXCEEDED` when exceeded. An optional `research_monthly_cost_cap_usd` returns `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` if a new call would push the current calendar month over the cap.

**Expected capabilities:**
- Cached research results that save cost on repeated or near-identical drafts.
- A user-initiated refresh/re-trigger path for explicit re-computation.
- Per-tenant research usage and estimated-cost telemetry.
- Tenant-level daily and monthly cost limits.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall cache Composer Deep Research results per tenant, keyed by a hash of normalized text plus active AI and search provider ids. | Must | A second identical request within the TTL returns the stored `ResearchResult` and records `cache_hit=true`. | Engineering |
| BR-002 | The system shall support a `?refresh=true` parameter on `POST /v1/composer/research` that bypasses the cache and overwrites the existing cache row. | Must | With `?refresh=true`, the pipeline runs even when a matching cache row exists, and the cache is updated with the new result. | Engineering |
| BR-003 | The system shall record every research request in `research_runs` with tenant, user, text hash, providers, cache hit, token counts, and estimated cost. | Must | Each request creates a row containing the fields specified in ADR-0121 Decision §3. | Engineering |
| BR-004 | The system shall enforce `research_daily_request_cap` per tenant and return `429 RESEARCH_DAILY_CAP_EXCEEDED` when the cap is hit. | Must | Requests beyond the daily cap are rejected with the documented code for that calendar day. | Engineering |
| BR-005 | The system shall support an optional `research_monthly_cost_cap_usd` per tenant and return `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` if the call would exceed the cap. | Should | A request whose estimated cost would push the month over the configured cap is rejected before provider calls are made. | Engineering |
| BR-006 | The system shall expire cache rows based on `tenant_settings.research_cache_ttl_hours` (default 24, max 168). | Must | Cache rows are not returned after `expires_at`; fresh calls recompute. | Engineering |
| BR-007 | The Composer UI shall provide a user-initiated "Research again" / "Refresh" control that calls the endpoint with `?refresh=true`. | Should | Users can trigger a fresh research run from the composer without editing the draft. | Product / Engineering |
| BR-008 | The system shall expose cache hit status and estimated cost to the tenant in telemetry, not as a billing invoice. | Should | `research_runs` is queryable per tenant and clearly labeled as estimated, not final. | Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `research_cache` and `research_runs` must be RLS-scoped by `tenant_id` with the same guarantees as existing tenant tables. | Security | Must | Contract tests demonstrate a tenant cannot read or write another tenant's rows. |
| NFR-002 | Cache lookup must complete within the same request lifecycle and not add a separate network call. | Performance | Must | No additional cache tier; lookup is a single indexed Postgres query. |
| NFR-003 | `estimated_cost_usd` must be computed from available provider-reported or self-calculated values and stored to six decimal places. | Accuracy | Should | Telemetry values are deterministic for the same inputs. |
| NFR-004 | Cap checks must occur before any provider calls to avoid incurring cost on rejected requests. | Cost Control | Must | Rejected-cap requests create `research_runs` rows only if needed for audit; no paid provider traffic is generated. |
| NFR-005 | `text_hash` normalization must ignore minor formatting differences while remaining stable for the same normalized inputs. | Maintainability | Should | Documented normalization rules and contract tests cover whitespace and casing. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | All `research_cache` and `research_runs` rows are scoped to one `tenant_id`; no cross-tenant access is permitted. |
| BRU-002 | The cache key (`text_hash`) is derived from normalized request text plus the active AI provider and search provider ids; changes to any of these must produce a different hash. |
| BRU-003 | When `?refresh=true` is provided, the cache is ignored and the matching cache row, if any, is overwritten with the new result. |
| BRU-004 | When `research_daily_request_cap` is reached, the API returns `429 RESEARCH_DAILY_CAP_EXCEEDED` for the remainder of the calendar day. |
| BRU-005 | When `research_monthly_cost_cap_usd` is set and a new request would push the tenant over the cap for the current calendar month, the API returns `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` before calling providers. |
| BRU-006 | `estimated_cost_usd` in `research_runs` is a best-effort estimate for visibility only; it is not a billing ledger or invoice. |
| BRU-007 | Re-trigger is user-initiated only; there is no background re-scheduler for research refresh. |
| BRU-008 | Cache TTL is controlled by `tenant_settings.research_cache_ttl_hours`, defaulting to 24 and capped at 168 hours. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `research_cache.id` | UUID primary key | System-generated | Engineering | Tenant-scoped |
| `research_cache.tenant_id` | Owning tenant | `tenants` | Engineering | Tenant-scoped, RLS-protected |
| `research_cache.text_hash` | SHA-256 of normalized text + active provider ids | Derived from request | Engineering | Tenant-scoped |
| `research_cache.result_json` | Full `ResearchResult` as returned by ADR-0076 | Deep research pipeline | Engineering | Tenant content |
| `research_cache.expires_at` | Cache row expiry timestamp | `tenant_settings.research_cache_ttl_hours` | Engineering | Operational |
| `research_cache.created_at` | Cache row creation timestamp | System clock | Engineering | Operational |
| `research_runs.id` | UUID primary key | System-generated | Engineering | Tenant-scoped |
| `research_runs.tenant_id` | Owning tenant | `tenants` | Engineering | RLS-protected |
| `research_runs.user_id` | User who initiated the research | Authenticated session | Engineering | Tenant-scoped |
| `research_runs.text_hash` | Hash of the request that was run or served from cache | Derived from request | Engineering | Tenant-scoped |
| `research_runs.ai_provider_id` | Active AI provider used | Request / `AIProviderConnector` | Engineering | Operational |
| `research_runs.search_provider_ids` | Active search providers used | Request / `SearchProviderConnector` | Engineering | Operational |
| `research_runs.cache_hit` | Whether the result was served from cache | Cache lookup | Engineering | Operational |
| `research_runs.tokens_in` | Input tokens reported by AI provider | Azure OpenAI | Engineering | Operational |
| `research_runs.tokens_out` | Output tokens reported by AI provider | Azure OpenAI | Engineering | Operational |
| `research_runs.estimated_cost_usd` | Best-effort cost estimate | Derived from token counts and rates | Engineering | Financial/tenant |
| `research_runs.created_at` | Request timestamp | System clock | Engineering | Operational |
| `tenant_settings.research_cache_ttl_hours` | Cache TTL in hours | Tenant Admin / default | Tenant Admin | Configuration |
| `tenant_settings.research_daily_request_cap` | Max research calls per day | Tenant Admin / default | Tenant Admin | Configuration |
| `tenant_settings.research_monthly_cost_cap_usd` | Optional monthly cost cap | Tenant Admin | Tenant Admin | Configuration |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Cache hit rate | Measure cost-avoidance effectiveness | Product / Engineering | Weekly |
| Average estimated cost per research request | Track spend efficiency and impact of caching | Product / Finance | Monthly |
| Daily research request volume per tenant | Monitor utilization and cap thresholds | Operations / Tenant Admin | Daily |
| Monthly estimated research spend per tenant | Provide cost visibility and cap forecasting | Finance / Tenant Admin | Monthly |
| Cap rejection rate | Detect tenants hitting limits and tune defaults | Product / Operations | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `text_hash` normalization is too strict, causing many cache misses. | Medium | Medium | Document and contract-test normalization rules; tune hash input to ignore minor formatting. | Engineering |
| R-002 | `text_hash` normalization is too loose, returning stale results for meaningfully different drafts. | Medium | High | Hash must include provider ids and normalize text conservatively; rely on `?refresh=true` for explicit re-computation. | Engineering |
| R-003 | `research_cache` and `research_runs` tables grow unbounded, increasing storage cost. | Medium | Medium | Enforce TTL expiry; decide on explicit pruning or query-time filtering per Open Question 1. | Engineering |
| R-004 | `estimated_cost_usd` does not match provider invoices, causing tenant confusion. | Medium | Medium | Label estimates clearly; never present telemetry as a bill; provide per-tenant CSV/JSON export for reconciliation. | Product / Engineering |
| R-005 | Monthly cost cap is set too low and blocks legitimate research use. | Low | Medium | Default cap is unset (unlimited) and daily cap is high enough for normal usage; Tenant Admin can adjust. | Product |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0076 Composer Deep Research Agent v1 | Decision / Code | Engineering | Accepted and built |
| D-002 | ADR-0120 SearchProviderConnector | Decision / Code | Engineering | Proposed |
| D-003 | ADR-0038 AI Enrichment Provider Selection | Decision | Engineering | Accepted |
| D-004 | ADR-0065 / ADR-0066 Brave and Bing one-off search helpers | Implementation | Engineering | Built or proposed |
| D-005 | ADR-0027 Connector as Technical Intermediary | Decision | Product / Engineering | Accepted |
| D-006 | ADR-0015 Tenant Isolation via Postgres RLS | Decision / Infrastructure | Engineering | Built |
| D-007 | `tenant_settings` schema and admin surface for new fields | Implementation | Engineering | To be extended |
| D-008 | Composer UI "Research again" / "Refresh" button design | UX | Product | Proposed |

---

## 14. Acceptance Criteria

- A repeated, identical `POST /v1/composer/research` within the TTL returns the cached `ResearchResult` and writes a `research_runs` row with `cache_hit=true`.
- `POST /v1/composer/research?refresh=true` always re-runs the pipeline and updates the cache row for the same `text_hash`.
- A tenant hitting the daily cap receives `429 RESEARCH_DAILY_CAP_EXCEEDED`.
- A tenant with a monthly cost cap receives `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` only when the next call would exceed the cap.
- `research_cache` and `research_runs` rows are inaccessible to users from other tenants under RLS contract tests.
- Cache rows expire according to `tenant_settings.research_cache_ttl_hours` and are not used after `expires_at`.
- The Composer UI provides a visible control to re-trigger research with `?refresh=true`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Cache hit | A research request whose `text_hash` matches a non-expired row in `research_cache`. |
| Composer Deep Research | The on-demand extraction, search, and synthesis feature described in ADR-0076. |
| `estimated_cost_usd` | A best-effort, provider-reported or self-calculated cost value stored for telemetry; not an invoice. |
| Refresh | A user-initiated re-run of research using `?refresh=true`, bypassing and overwriting the cache. |
| Re-trigger | A fresh `POST /v1/composer/research` call, typically triggered by a UI action such as "Research again." |
| `text_hash` | A SHA-256 hash of normalized request text plus active AI and search provider ids, used as the cache key. |
| TTL | Time-to-live for a cached research result, configured in hours per tenant. |

---

## 16. Appendices

### Related ADRs

- [ADR-0121: Composer Deep Research Caching, Re-Trigger, and Cost Justification](../../../docs/adr/0121-composer-deep-research-caching-retrigger-cost.md)
- [ADR-0076: Composer Deep Research Agent](../../../docs/adr/0076-composer-deep-research-agent.md)
- [ADR-0120: SearchProviderConnector](../../../docs/adr/0120-search-provider-connector.md)
- [ADR-0038: AI Enrichment Provider Selection](../../../docs/adr/0038-ai-enrichment-provider-selection.md)
- [ADR-0065: Active Watchlist Sourcing via Brave Search API](../../../docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md)
- [ADR-0066: Active Watchlist Sourcing via Bing Search API](../../../docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md)
- [ADR-0027: Connector Is a Technical Intermediary, Not Contracting Party](../../../docs/adr/0027-connector-is-a-technical-intermediary-not-contracting-party.md)
- [ADR-0015: Tenant Isolation via Postgres Row-Level Security](../../../docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md)

### Related user stories

No user stories explicitly referencing ADR-0121 were found in `docs/user-stories/epic-*.md` at the time of drafting. The closest related stories are those for the parent ADR-0076 feature:
- [Story 2.32 — Azure OpenAI `research?()` capability](../../../docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
- [Story 3.17 — Composer deep research REST endpoint](../../../docs/user-stories/epic-3-data-model-storage-and-archival.md)
- [Story 6.41 — Composer Deep Research panel UI](../../../docs/user-stories/epic-6-tenant-admin-ui.md)

### Consulted product-research files

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file for ADR-0121 was found. The related ADR-0076 BRD consulted:
- [Composed post author mention suggestions](../../../docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md)
- [AI enhancement opportunities](../../../docs/product-research/feature-designs/ai-enhancements.md)
- [Semantic search / RAG](../../../docs/product-research/feature-designs/28-semantic-search-rag.md)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
