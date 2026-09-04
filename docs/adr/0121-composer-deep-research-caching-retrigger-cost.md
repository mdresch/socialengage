# ADR-0121: Composer Deep Research Caching, Re-Trigger, and Cost Justification

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23.** Defines how ADR-0076's Composer Deep Research can cache results, allow users to re-run research, and justify the feature's cost through usage telemetry and tenant-level caps. v1 of ADR-0076 is intentionally cache-free; this ADR is the path to a cheaper, audit-ready v2.

**Source:** ADR-0076 Open Question 5 (Proposed 2026-08-22).

---

## Context

### 1. v1 research is ephemeral and synchronous
ADR-0076 runs the full extraction → search → synthesis pipeline on every `POST /v1/composer/research` call. Results are not persisted and the pipeline makes paid calls to Azure OpenAI and Brave/Bing for every request.

### 2. Users are likely to iterate on a draft
In practice, an author may make several small edits to the same post and run research repeatedly. The text often changes only slightly. Without caching, each run incurs full cost even when the key phrases and search queries are nearly identical.

### 3. Costs are tenant-paid
Per ADR-0027 and ADR-0038, the tenant pays the providers directly. The project must make this cost visible and bounded, not hidden or unlimited.

---

## Decision

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

## Consequences

### Positive
- Reduces redundant cost for users who iterate on a draft.
- Provides an auditable trail of research usage and cost per tenant.
- Makes the feature safe for multi-tenant usage with explicit caps.

### Negative
- Adds a cache table and a telemetry table, increasing storage.
- `text_hash` normalization must be stable and tenant-aware; subtle differences in whitespace or selected providers cause cache misses.
- Cost estimates are approximate and may not match provider invoices.

---

## Alternatives Considered

|| Alternative | Disposition |
|---|---|---|
| Cache in Redis instead of Postgres | Rejected for v2. Postgres is already the tenant-scoped store and RLS is built-in. Redis would add a second tier and complicate isolation. |
| Cache by exact request JSON | Rejected. Whitespace and UI state would cause unnecessary misses. A normalized text hash is more stable. |
| No cost caps, rely on provider-side limits | Rejected. Provider limits protect the provider, not the tenant or the platform. A tenant-facing cap is necessary for a multi-tenant product. |
| Charge tenants per research call | Rejected. SocialEngage is not a billing intermediary (ADR-0027). The tenant pays the provider directly; telemetry and caps are for visibility and safety, not invoicing. |

---

## Open Questions

- [ ] **[Q-0121-1]** Should `research_cache` be pruned by background job or by `expires_at` filtering at query time?
- [ ] **[Q-0121-2]** How should the `text_hash` treat minor edits (punctuation, case, emoji) to maximize useful cache hits without over-matching?
- [ ] **[Q-0121-3]** Which Azure OpenAI cost fields (prompt tokens, completion tokens, reasoning tokens) are actually exposed by the SDK and should be stored?
- [ ] **[Q-0121-4]** Should cost caps be per-user or per-tenant? v1 proposes per-tenant; per-user is a future option.

---

## Related Documents

- ADR-0076: Composer Deep Research Agent
- ADR-0120: SearchProviderConnector
- ADR-0038: AI Enrichment Provider Selection
- ADR-0065: Active Watchlist Sourcing via Brave Search API
- ADR-0066: Active Watchlist Sourcing via Bing Search API
- ADR-0027: Connector Is a Technical Intermediary, Not Contracting Party
- ADR-0015: Tenant Isolation via Postgres Row-Level Security
