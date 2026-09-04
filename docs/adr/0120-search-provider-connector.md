# ADR-0120: SearchProviderConnector — Shared One-Off Search Abstraction

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23.** Generalizes the one-off search helpers used by ADR-0076's Composer Deep Research into a first-class `SearchProviderConnector` abstraction, so Brave Search, Bing Search, and future search providers can be called on demand without duplicating query building and rate-limit logic across features.

**Source:** ADR-0076 Open Question 2 (Proposed 2026-08-22).

---

## Context

### 1. One-off search first appeared as an internal helper
ADR-0076's Composer Deep Research introduced internal `searchForResearch(query, limit)` helpers inside the existing Brave and Bing `SocialConnector` implementations. This keeps v1 small and avoids modifying the `SocialConnector` interface, but the code is not reusable for other features.

### 2. Active watchlist sourcing already does similar work
ADR-0065 and ADR-0066 define `poll()`-based watchlist sourcing for Brave and Bing. The query building, credential loading, and result parsing are conceptually the same as one-off search, but `poll()` is tuned for recurring ingestion, not ad-hoc research questions.

### 3. The abstraction is not needed for v1
ADR-0076 intentionally defers the interface decision. This ADR captures the shape for the moment it is needed, which may be the second on-demand search feature.

---

## Decision

### 1. A new optional `SearchProviderConnector` interface
```ts
interface SearchProviderConnector {
  providerId: string;  // e.g. 'brave-search', 'bing-search'

  search?(
    ctx: ConnectorContext,
    request: SearchRequest
  ): Promise<SearchResponse>;
}

interface SearchRequest {
  q: string;
  limit?: number;      // default 5, hard cap 10
  freshness?: 'any' | 'day' | 'week' | 'month';
  market?: string;     // optional ISO country/language hint
}

interface SearchResponse {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedAt?: string;  // optional, when the search API provides it
  }>;
}
```

- `search?()` is optional. A connector that does not implement it returns `search_not_supported` when called.
- It is distinct from `SocialConnector` and `AIProviderConnector` because the result shape, rate-limit semantics, and credential kinds are different.

### 2. Registration and bootstrapping
- Search providers are registered in the connector registry (ADR-0048) the same way social and AI providers are.
- `bootstrapConnectors.ts` loads them alongside `SocialConnector` and `AIProviderConnector` instances.
- The connector must be activated (`connector_activations`, ADR-0051) and have a tenant-level or user-level credential (ADR-0028) before it is callable.

### 3. Tenant credential and RLS model
- Search connectors reuse the existing `platform_credentials` store (ADR-0014).
- Calls are tenant-scoped through `withTenant()` (ADR-0015).
- The caller must have access to the credential used for the search.

### 4. Rate gate and cost
- One-off search uses a `RequestGate` key per `(tenantId, providerId, 'search')`.
- The gate is separate from ingestion `poll()` (ADR-0003), outbound posts (ADR-0075), and research (ADR-0076), so research spikes cannot starve production ingestion.
- Per-provider rate-limit config is stored in the connector's own `getRateLimitConfig()` or `getSearchRateLimitConfig()?()` method.

### 5. v1 consumers
- `POST /v1/composer/research` (ADR-0076) is the first consumer.
- Future consumers (RAG search, active watchlist count preview, metric explainability) can call the same abstraction.

---

## Consequences

### Positive
- Eliminates duplicated query building and credential loading for on-demand search.
- Gives new features a clear, tenant-credential-gated path to search the public web.
- Keeps the `SocialConnector` and `AIProviderConnector` contracts clean.

### Negative
- Adds a third connector interface to the registry, increasing surface area.
- Requires refactoring ADR-0076's internal `searchForResearch` helpers once this ADR is accepted and implemented.

---

## Open Questions

- [ ] **[Q-0120-1]** Should `SearchProviderConnector` be a top-level `SearchConnector` under `SocialConnector.search?()` instead of a separate interface?
- [ ] **[Q-0120-2]** What is the exact Bing `freshness` parameter mapping and does it support a `market` hint in the free/news tiers?
- [ ] **[Q-0120-3]** Should Brave and Bing share a common query-normalization step or keep it per-connector?
- [ ] **[Q-0120-4]** Does this abstraction also cover internal `tenant-owned-feed` search? Probably not — that is content already owned by the tenant, not public web search.

---

## Related Documents

- ADR-0076: Composer Deep Research Agent
- ADR-0065: Active Watchlist Sourcing via Brave Search API
- ADR-0066: Active Watchlist Sourcing via Bing Search API
- ADR-0048: No-Core-Pipeline-Change Verification for New Connector Registration
- ADR-0028: Credential Creation Authority by Ownership Tier
- ADR-0003: Per-Tenant Per-Provider Rate Limiting
