# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SearchProviderConnector — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0120, BRD-0120, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

On-demand web search has emerged as a recurring need across the product. ADR-0076's Composer Deep Research is the first feature to perform one-off searches, but it does so through internal `searchForResearch` helpers that live inside the Brave and Bing connector code. These helpers are not reusable for other planned capabilities such as RAG, active watchlist count preview, or metric explainability, and they risk duplicating query building, credential loading, rate-limit handling, and result parsing across the codebase.

This FDD translates the accepted architecture and business requirements from ADR-0120 and BRD-0120 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A new optional `SearchProviderConnector` interface with a `providerId` and an optional `search?()` method.
- Standardized `SearchRequest` and `SearchResponse` shapes for one-off public web search.
- Registration and bootstrapping of search providers in the connector registry using the same pattern as `SocialConnector` and `AIProviderConnector`.
- Activation and credential gating: search providers require `connector_activations` and a tenant-level or user-level `platform_credentials` record.
- Tenant scoping through `withTenant()` and caller access to the credential used.
- A dedicated `RequestGate` key per `(tenantId, providerId, 'search')`, separate from ingestion, reply, publish, and research gates.
- Per-provider rate-limit configuration support.
- Refactoring ADR-0076's internal `searchForResearch` helpers to use the new abstraction once accepted.
- The first consumer: `POST /v1/composer/research` (ADR-0076).
- **Out of scope:** - Recurring active watchlist `poll()` semantics (already specified by ADR-0065 and ADR-0066).
- Changes to the `SocialConnector` or `AIProviderConnector` contracts beyond the addition of the new optional interface.
- Mandatory `search()` implementation for every provider; the method is optional.
- Internal `tenant-owned-feed` search (tenant-owned content, not public web search).
- Per-consumer UI design (handled by the individual feature ADR or user story).
- Real-time streaming, persistence, or history of search results.
- **Assumptions and constraints:** - ADR-0076 and its internal one-off search helpers already exist.
- The Brave and Bing connectors can support both `poll()` and `search()` patterns.
- The connector registry (ADR-0048), activation (ADR-0051), credential model (ADR-0028 / ADR-0034), and row-level security (ADR-0015) are already accepted and built.
- One or more future features will need ad-hoc public web search beyond Composer Deep Research.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. One-off search first appeared as an internal helper
ADR-0076's Composer Deep Research introduced internal `searchForResearch(query, limit)` helpers inside the existing Brave and Bing `SocialConnector` implementations. This keeps v1 small and avoids modifying the `SocialConnector` interface, but the code is not reusable for other features.

### 2. Active watchlist sourcing already does similar work
ADR-0065 and ADR-0066 define `poll()`-based watchlist sourcing for Brave and Bing. The query building, credential loading, and result parsing are conceptually the same as one-off search, but `poll()` is tuned for recurring ingestion, not ad-hoc research questions.

### 3. The abstraction is not needed for v1
ADR-0076 intentionally defers the interface decision. This ADR captures the shape for the moment it is needed, which may be the second on-demand search feature.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate duplicated query, credential, and rate-limit logic for on-demand search | New one-off search features call `SearchProviderConnector` rather than re-implementing per-provider helpers |
| 2 | Provide a tenant-safe, reusable public web search capability for research, RAG, and future features | A feature can add one-off search by calling a registered provider without changing the ingestion pipeline |
| 3 | Preserve tenant data ownership and cost control | All search calls use the tenant's own credentials and a per-tenant, per-provider `RequestGate` |
| 4 | Keep the connector ecosystem clean and extensible | `SocialConnector` and `AIProviderConnector` contracts remain unchanged; the new interface is optional |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall define a `SearchProviderConnector` interface with `providerId` and an optional `search?(ctx, request)` method | Must | Interface documented; optional method signature matches `SearchRequest`/`SearchResponse` | Product Owner |
| BR-002 | The system shall support `SearchRequest` with `q`, optional `limit` (default 5, hard cap 10), optional `freshness`, and optional `market` | Must | Request shape is enforced; cap violations are rejected with a clear error | Product Owner |
| BR-003 | The system shall support `SearchResponse` containing an array of results, each with `title`, `url`, `snippet`, and optional `publishedAt` | Must | Response shape is consistent across providers; contract tests pass | Product Owner |
| BR-004 | The system shall register and bootstrap search providers in the connector registry the same way as `SocialConnector` and `AIProviderConnector` | Must | New providers appear in bootstrap output and pass registry contract tests | Engineering |
| BR-005 | The system shall require connector activation and a valid credential before a search call is allowed | Must | Inactive or uncredentialed providers return a clear `search_not_available` or equivalent error | Product Owner |
| BR-006 | The system shall enforce tenant row-level security and caller credential access on every search call | Must | Calls outside the tenant scope or without credential access are denied | Engineering |
| BR-007 | The system shall use a dedicated `RequestGate` key per `(tenantId, providerId, 'search')` | Must | Search calls do not consume ingestion, reply, publish, or research quota | Engineering |
| BR-008 | The system shall return `search_not_supported` when a provider does not implement `search?()` | Must | Contract test asserts the error code and message | Product Owner |
| BR-009 | The system shall support per-provider search rate-limit configuration | Should | Rate-limit config is loaded and enforced per provider without affecting other gates | Engineering |
| BR-010 | The system shall allow `POST /v1/composer/research` (ADR-0076) to call search providers through the new abstraction once accepted | Should | ADR-0076's `searchForResearch` helpers are refactored and all contract tests still pass | Product Owner |
| BR-011 | The system shall enable future features such as RAG, watchlist count preview, and metric explainability to use the same abstraction | Should | New features can call `SearchProviderConnector` without modifying `SocialConnector` or `AIProviderConnector` | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User (primary) | Uses composer research and future on-demand search features | High | Reliable results, clear errors, fast enough for a synchronous workflow |
| Tenant Admin | Manages connector activation and credentials | Medium | Familiar connector setup, activation, and status patterns |
| Product / Engineering | Owns the connector roadmap and abstraction | High | Reusable interface, less duplication, clean extension path |
| Platform Admin | Monitors cost, rate limits, and tenant isolation | Medium | Search traffic isolated from production ingestion; costs remain with tenants |
| Connector Maintainer | Implements and supports provider-specific `search()` | Medium | Clear interface, optional method, documented normalization rules |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 | | | | |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `providerId` | Stable identifier for the search provider, e.g. `brave-search` or `bing-search` | Connector registry | Engineering | Low |
| `SearchRequest.q` | Search query string | Caller | Tenant User | Business content |
| `SearchRequest.limit` | Maximum number of results (default 5, hard cap 10) | Caller / Default | Engineering | Low |
| `SearchRequest.freshness` | Optional recency filter (`any`, `day`, `week`, `month`) | Caller | Tenant User | Low |
| `SearchRequest.market` | Optional ISO country/language hint | Caller | Tenant User | Low |
| `SearchResponse.results` | Array of search results with `title`, `url`, `snippet`, `publishedAt?` | Provider API | Provider | Public web content |
| `platform_credentials` record | Tenant or user-level credential for the provider | Existing table | Tenant Admin | High (encrypted) |
| `connector_activations` record | Activation status of the provider for the tenant | Existing table | Tenant Admin | Low |
| `RequestGate` key | Rate-limit gate key `(tenantId, providerId, 'search')` | Existing gate service | Engineering | Low |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A search provider must be activated for the tenant before `search?()` can be invoked. |
| BRU-002 | A search call is denied if the caller does not have access to the credential used for the provider. |
| BRU-003 | `search?()` is optional; calling a provider that does not implement it returns `search_not_supported`. |
| BRU-004 | One-off search uses a `RequestGate` key per `(tenantId, providerId, 'search')`, separate from `poll()`, `reply()`, `publish()`, and `research()`. |
| BRU-005 | `SearchRequest.limit` defaults to 5 and is hard-capped at 10. |
| BRU-006 | `SearchRequest.freshness` values are `any`, `day`, `week`, or `month`. |
| BRU-007 | One-off search connectors return read-only, ephemeral results and must not persist posts or emit ingestion events. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All search calls shall be tenant-scoped through `withTenant()` and require access to the credential used | Security | Must | Penetration/contract tests assert no cross-tenant access |
| NFR-002 | Search traffic shall use a `RequestGate` key distinct from ingestion, reply, publish, and research | Reliability / Scalability | Must | Load tests show research spikes do not affect ingestion success rates |
| NFR-003 | Search errors shall be classifiable using the same taxonomy as the polling connectors (`http_401`, `http_403`, `rate_limited`, `http_5xx`) | Reliability | Should | Contract tests map each error class cleanly |
| NFR-004 | Adding a new search provider shall require only registration and implementation of the optional `SearchProviderConnector` interface | Maintainability | Must | A new provider can be added without changing `SocialConnector` or `AIProviderConnector` |
| NFR-005 | One-off search calls should complete within a synchronous request window, targeting a p95 latency under 5 seconds per provider for typical queries | Performance | Should | Monitoring confirms p95 latency over 30 days |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A third connector interface increases registry surface area and cognitive load | Medium | Medium | Keep the interface optional; document the pattern and migration path; use existing bootstrap and activation mechanics | Engineering |
| R-002 | Refactoring ADR-0076's `searchForResearch` helpers may introduce regressions in Composer Deep Research | Medium | High | Maintain the same request/response shapes and error taxonomy; run the full contract suite before and after refactor | Engineering |
| R-003 | Bing and Brave freshness or market parameters may require provider-specific mapping or normalization | High | Medium | Define a per-provider query-normalization step while keeping the public `SearchRequest` shape generic | Engineering |
| R-004 | Search traffic could starve ingestion if rate gates are misconfigured | Low | High | Enforce a dedicated `RequestGate` key for `search` and validate in load tests | Engineering |
| R-005 | ADR-0120 is Proposed and may change before acceptance | High | Medium | Treat this BRD as a draft; revisit and update immediately on ADR status change | Product Owner |

---

---

## 12. Assumptions and Dependencies

- ADR-0076 and its internal one-off search helpers already exist.
- The Brave and Bing connectors can support both `poll()` and `search()` patterns.
- The connector registry (ADR-0048), activation (ADR-0051), credential model (ADR-0028 / ADR-0034), and row-level security (ADR-0015) are already accepted and built.
- One or more future features will need ad-hoc public web search beyond Composer Deep Research.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0076 Composer Deep Research Agent (first consumer and source of internal helpers) | ADR / Feature | Engineering | Accepted |
| D-002 | ADR-0048 No-Core-Pipeline-Change Verification for New Connector Registration | Architecture | Engineering | Accepted |
| D-003 | ADR-0051 Connector Activation Decoupled From Credential | Architecture | Engineering | Accepted |
| D-004 | ADR-0028 Credential Creation Authority by Ownership Tier | Architecture | Engineering | Accepted |
| D-005 | ADR-0003 Per-Tenant Per-Provider Rate Limiting | Architecture | Engineering | Accepted |
| D-006 | ADR-0065 / ADR-0066 Brave and Bing active watchlist connectors | Existing connectors | Engineering | Accepted |
| D-007 | Future consumer feature designs (RAG, watchlist count preview, metric explainability) | Product / External | Product Owner | TBD |

---

---

## 13. Open Questions

1. Should `SearchProviderConnector` be a top-level `SearchConnector` under `SocialConnector.search?()` instead of a separate interface?
2. What is the exact Bing `freshness` parameter mapping and does it support a `market` hint in the free/news tiers?
3. Should Brave and Bing share a common query-normalization step or keep it per-connector?
4. Does this abstraction also cover internal `tenant-owned-feed` search? Probably not — that is content already owned by the tenant, not public web search.

---

---

## 14. Appendix

### Reference Documents

- ADR-0120: `docs/adr/0120-search-provider-connector.md`
- BRD-0120: `docs/project docs/Business-Requirements/BRD-0120-Search-Provider-Connector.md`

### Missing Sources Noted

- No matching feature design found in `docs/product-research/feature-designs/`.
- No matching deep-research report found in `docs/product-research/reports/`.
- No matching user stories found in `docs/user-stories/epic-*.md` for ADR-0120.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0120 and BRD-0120. |