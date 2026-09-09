# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0121 Composer Deep Research Caching, Re-Trigger, and Cost Justification — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft — ADR-0121 is Proposed and may change) |
| Related Documents | ADR-0121, BRD-0121, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

ADR-0076 introduced the Composer Deep Research Agent as an on-demand, synchronous capability for Polypost Composer authors. In its v1 form, every `POST /v1/composer/research` call runs the full extraction, search, and synthesis pipeline and pays the associated Azure OpenAI and Brave/Bing costs, with no persistence of results. In practice, authors iterate on a draft and rerun research several times for only minor text changes, which causes redundant spend on nearly identical queries.

This FDD translates the accepted architecture and business requirements from ADR-0121 and BRD-0121 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A new `research_cache` table scoped by `tenant_id` and keyed by a stable `text_hash` covering normalized request text plus active AI/search provider ids.
- Cache hit logic on `POST /v1/composer/research` that returns a stored `ResearchResult` when the hash exists and has not expired.
- A `?refresh=true` query parameter that bypasses the cache, re-runs the pipeline, and overwrites the prior cache row.
- A new `research_runs` telemetry table recording every research request, including `cache_hit`, token counts, and `estimated_cost_usd`.
- Two new `tenant_settings` fields: `research_cache_ttl_hours` and `research_daily_request_cap`, plus an optional `research_monthly_cost_cap_usd`.
- User-initiated re-trigger semantics through the Composer UI (e.g., a "Research again" / "Refresh" button).
- **Out of scope:** - v1 implementation of ADR-0076 (cache-free pipeline) — this BRD covers the v2 enhancement only.
- Background re-scheduling or automatic re-triggering of research.
- Cross-tenant or global cache sharing.
- Billing or invoicing; `estimated_cost_usd` is telemetry, not a ledger.
- Exact reconciliation of telemetry against provider invoices.
- **Assumptions and constraints:** - ADR-0076 v1 is already in place and returns a stable `ResearchResult` shape.
- Tenant credentials for Azure OpenAI and Brave/Bing search are already configured via existing provider connectors.
- Postgres Row-Level Security is active and will be applied to `research_cache` and `research_runs`.
- Cost inputs (token counts, provider rates) are available to compute an `estimated_cost_usd`.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. v1 research is ephemeral and synchronous
ADR-0076 runs the full extraction → search → synthesis pipeline on every `POST /v1/composer/research` call. Results are not persisted and the pipeline makes paid calls to Azure OpenAI and Brave/Bing for every request.

### 2. Users are likely to iterate on a draft
In practice, an author may make several small edits to the same post and run research repeatedly. The text often changes only slightly. Without caching, each run incurs full cost even when the key phrases and search queries are nearly identical.

### 3. Costs are tenant-paid
Per ADR-0027 and ADR-0038, the tenant pays the providers directly. The project must make this cost visible and bounded, not hidden or unlimited.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce redundant research cost for iterative drafting | Measurable increase in `cache_hit` rate and lower average `estimated_cost_usd` per research request |
| 2 | Make research cost visible and auditable per tenant | `research_runs` table provides complete, queryable request/cost history within a tenant |
| 3 | Protect tenants from unbounded research spend | Daily request cap and optional monthly cost cap enforced at the API before provider calls |
| 4 | Preserve tenant isolation and RLS guarantees | All cache and telemetry rows are scoped to a single `tenant_id` and protected by existing Postgres RLS |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Composer Author | End user who runs deep research | High | Fast, iterative research without paying for every minor edit |
| Tenant Admin | Budget and settings owner | High | Cost visibility, predictable caps, and control over cache TTL |
| Platform Admin | Platform-wide oversight | Medium | Assurance that tenant costs are bounded and isolated |
| Engineering | Builds and maintains the feature | High | Clear, RLS-compatible data model and simple re-trigger semantics |
| Finance / Operations | Cost governance | Low | Audit trail of per-tenant usage for reconciliation |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 | | | | |

### 6.3 Workflow Diagrams / Steps

### 1. Cache by text hash, per tenant
A new `research_cache` table is RLS-scoped by `tenant_id`:

```sql
CREATE TABLE research_cache (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  text_hash text NOT NULL,  -- sha256 of the normalized request text + selected providers
  result_json jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `text_hash` covers the normalized `text` plus the active AI and search provider ids, so different tenants with the same text do not share cache rows.
- `result_json` stores the full `ResearchResult` response shape from ADR-0076.
- `expires_at` is set from `tenant_settings.research_cache_ttl_hours` (default 24, max 168).

### 2. `?refresh=true` bypasses the cache
The API accepts a `refresh` boolean on `POST /v1/composer/research`. When `true`, the cache is ignored, the pipeline re-runs, and the new result overwrites the old cache row for the same `text_hash`.

### 3. Cost telemetry table
A new `research_runs` table records every research request for cost transparency:

```sql
CREATE TABLE research_runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text_hash text NOT NULL,
  ai_provider_id text NOT NULL,
  search_provider_ids text[] NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  tokens_in int,
  tokens_out int,
  estimated_cost_usd numeric(10,6),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `estimated_cost_usd` is a best-effort, provider-reported or self-calculated estimate; it is not a billing ledger.
- `cache_hit` makes the cost savings of caching visible to the tenant.

### 4. Tenant-level caps
Add two settings to `tenant_settings`:

- `research_daily_request_cap` — default 50, max 500. A `429 RESEARCH_DAILY_CAP_EXCEEDED` is returned when the cap is hit.
- `research_monthly_cost_cap_usd` — optional, default `null` (unlimited). When set, `POST /v1/composer/research` returns `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` if `sum(estimated_cost_usd)` for the tenant in the current calendar month would exceed the cap. v1 may ship without this cap and add it later.

### 5. Re-trigger semantics
A "re-trigger" is simply a fresh `POST /v1/composer/research` call. The UI may offer a "Research again" or "Refresh" button that calls the endpoint with `?refresh=true`. There is no background re-scheduler; re-trigger is user-initiated.

### 6. Cost justification model
Caching is justified when the same or nearly identical draft is researched more than once within the TTL. The telemetry in `research_runs` is the evidence: a high `cache_hit` rate and a lower average `estimated_cost_usd` per research request prove the savings. The feature remains user-triggered, so cost is opt-in and bounded.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. Cache by text hash, per tenant
A new `research_cache` table is RLS-scoped by `tenant_id`:

```sql
CREATE TABLE research_cache (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  text_hash text NOT NULL,  -- sha256 of the normalized request text + selected providers
  result_json jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `text_hash` covers the normalized `text` plus the active AI and search provider ids, so different tenants with the same text do not share cache rows.
- `result_json` stores the full `ResearchResult` response shape from ADR-0076.
- `expires_at` is set from `tenant_settings.research_cache_ttl_hours` (default 24, max 168).

### 2. `?refresh=true` bypasses the cache
The API accepts a `refresh` boolean on `POST /v1/composer/research`. When `true`, the cache is ignored, the pipeline re-runs, and the new result overwrites the old cache row for the same `text_hash`.

### 3. Cost telemetry table
A new `research_runs` table records every research request for cost transparency:

```sql
CREATE TABLE research_runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text_hash text NOT NULL,
  ai_provider_id text NOT NULL,
  search_provider_ids text[] NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  tokens_in int,
  tokens_out int,
  estimated_cost_usd numeric(10,6),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- `estimated_cost_usd` is a best-effort, provider-reported or self-calculated estimate; it is not a billing ledger.
- `cache_hit` makes the cost savings of caching visible to the tenant.

### 4. Tenant-level caps
Add two settings to `tenant_settings`:

- `research_daily_request_cap` — default 50, max 500. A `429 RESEARCH_DAILY_CAP_EXCEEDED` is returned when the cap is hit.
- `research_monthly_cost_cap_usd` — optional, default `null` (unlimited). When set, `POST /v1/composer/research` returns `422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED` if `sum(estimated_cost_usd)` for the tenant in the current calendar month would exceed the cap. v1 may ship without this cap and add it later.

### 5. Re-trigger semantics
A "re-trigger" is simply a fresh `POST /v1/composer/research` call. The UI may offer a "Research again" or "Refresh" button that calls the endpoint with `?refresh=true`. There is no background re-scheduler; re-trigger is user-initiated.

### 6. Cost justification model
Caching is justified when the same or nearly identical draft is researched more than once within the TTL. The telemetry in `research_runs` is the evidence: a high `cache_hit` rate and a lower average `estimated_cost_usd` per research request prove the savings. The feature remains user-triggered, so cost is opt-in and bounded.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `research_cache` and `research_runs` must be RLS-scoped by `tenant_id` with the same guarantees as existing tenant tables. | Security | Must | Contract tests demonstrate a tenant cannot read or write another tenant's rows. |
| NFR-002 | Cache lookup must complete within the same request lifecycle and not add a separate network call. | Performance | Must | No additional cache tier; lookup is a single indexed Postgres query. |
| NFR-003 | `estimated_cost_usd` must be computed from available provider-reported or self-calculated values and stored to six decimal places. | Accuracy | Should | Telemetry values are deterministic for the same inputs. |
| NFR-004 | Cap checks must occur before any provider calls to avoid incurring cost on rejected requests. | Cost Control | Must | Rejected-cap requests create `research_runs` rows only if needed for audit; no paid provider traffic is generated. |
| NFR-005 | `text_hash` normalization must ignore minor formatting differences while remaining stable for the same normalized inputs. | Maintainability | Should | Documented normalization rules and contract tests cover whitespace and casing. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `text_hash` normalization is too strict, causing many cache misses. | Medium | Medium | Document and contract-test normalization rules; tune hash input to ignore minor formatting. | Engineering |
| R-002 | `text_hash` normalization is too loose, returning stale results for meaningfully different drafts. | Medium | High | Hash must include provider ids and normalize text conservatively; rely on `?refresh=true` for explicit re-computation. | Engineering |
| R-003 | `research_cache` and `research_runs` tables grow unbounded, increasing storage cost. | Medium | Medium | Enforce TTL expiry; decide on explicit pruning or query-time filtering per Open Question 1. | Engineering |
| R-004 | `estimated_cost_usd` does not match provider invoices, causing tenant confusion. | Medium | Medium | Label estimates clearly; never present telemetry as a bill; provide per-tenant CSV/JSON export for reconciliation. | Product / Engineering |
| R-005 | Monthly cost cap is set too low and blocks legitimate research use. | Low | Medium | Default cap is unset (unlimited) and daily cap is high enough for normal usage; Tenant Admin can adjust. | Product |

---

---

## 12. Assumptions and Dependencies

- ADR-0076 v1 is already in place and returns a stable `ResearchResult` shape.
- Tenant credentials for Azure OpenAI and Brave/Bing search are already configured via existing provider connectors.
- Postgres Row-Level Security is active and will be applied to `research_cache` and `research_runs`.
- Cost inputs (token counts, provider rates) are available to compute an `estimated_cost_usd`.

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

---

## 13. Open Questions

1. Should `research_cache` be pruned by background job or by `expires_at` filtering at query time?
2. How should the `text_hash` treat minor edits (punctuation, case, emoji) to maximize useful cache hits without over-matching?
3. Which Azure OpenAI cost fields (prompt tokens, completion tokens, reasoning tokens) are actually exposed by the SDK and should be stored?
4. Should cost caps be per-user or per-tenant? v1 proposes per-tenant; per-user is a future option.

---

---

## 14. Appendix

### Reference Documents

- ADR-0121: `docs/adr/0121-composer-deep-research-caching-retrigger-cost.md`
- BRD-0121: `docs/project docs/Business-Requirements/BRD-0121-Composer-Deep-Research-Caching-Retrigger-Cost.md`
- Feature design: `docs/product-research/feature-designs/13-composed-post-author-mention-suggestions.md`
- Feature design: `docs/product-research/feature-designs/ai-enhancements.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.
- No matching user stories found in `docs/user-stories/epic-*.md` for ADR-0121.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0121 and BRD-0121. |