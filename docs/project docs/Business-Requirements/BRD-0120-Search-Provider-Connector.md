# Business Requirements Document — ADR-0120: SearchProviderConnector

> **Note:** ADR-0120 is currently **Proposed** (2026-08-23). This BRD is a draft for review and will be updated when the ADR is accepted or revised.

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SearchProviderConnector — Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Business Sponsor / Product Owner |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0120 and related user stories |

---

## 2. Executive Summary

On-demand web search has emerged as a recurring need across the product. ADR-0076's Composer Deep Research is the first feature to perform one-off searches, but it does so through internal `searchForResearch` helpers that live inside the Brave and Bing connector code. These helpers are not reusable for other planned capabilities such as RAG, active watchlist count preview, or metric explainability, and they risk duplicating query building, credential loading, rate-limit handling, and result parsing across the codebase.

The **SearchProviderConnector** introduces a first-class, optional connector interface for one-off public web search. Providers such as Brave Search and Bing Search can implement an optional `search?()` method with a standardized `SearchRequest` and `SearchResponse` shape. The connector is registered in the existing connector registry, loaded by the existing bootstrap mechanism, and governed by the existing tenant credential, activation, row-level security, and rate-gating models. This keeps the `SocialConnector` and `AIProviderConnector` contracts clean while giving every future on-demand search feature a single, tenant-safe path to the public web.

Because ADR-0120 is Proposed, this BRD captures the intended business requirements and is expected to evolve before implementation begins.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate duplicated query, credential, and rate-limit logic for on-demand search | New one-off search features call `SearchProviderConnector` rather than re-implementing per-provider helpers |
| 2 | Provide a tenant-safe, reusable public web search capability for research, RAG, and future features | A feature can add one-off search by calling a registered provider without changing the ingestion pipeline |
| 3 | Preserve tenant data ownership and cost control | All search calls use the tenant's own credentials and a per-tenant, per-provider `RequestGate` |
| 4 | Keep the connector ecosystem clean and extensible | `SocialConnector` and `AIProviderConnector` contracts remain unchanged; the new interface is optional |

---

## 4. Scope

### 4.1 In Scope

- A new optional `SearchProviderConnector` interface with a `providerId` and an optional `search?()` method.
- Standardized `SearchRequest` and `SearchResponse` shapes for one-off public web search.
- Registration and bootstrapping of search providers in the connector registry using the same pattern as `SocialConnector` and `AIProviderConnector`.
- Activation and credential gating: search providers require `connector_activations` and a tenant-level or user-level `platform_credentials` record.
- Tenant scoping through `withTenant()` and caller access to the credential used.
- A dedicated `RequestGate` key per `(tenantId, providerId, 'search')`, separate from ingestion, reply, publish, and research gates.
- Per-provider rate-limit configuration support.
- Refactoring ADR-0076's internal `searchForResearch` helpers to use the new abstraction once accepted.
- The first consumer: `POST /v1/composer/research` (ADR-0076).

### 4.2 Out of Scope

- Recurring active watchlist `poll()` semantics (already specified by ADR-0065 and ADR-0066).
- Changes to the `SocialConnector` or `AIProviderConnector` contracts beyond the addition of the new optional interface.
- Mandatory `search()` implementation for every provider; the method is optional.
- Internal `tenant-owned-feed` search (tenant-owned content, not public web search).
- Per-consumer UI design (handled by the individual feature ADR or user story).
- Real-time streaming, persistence, or history of search results.

### 4.3 Assumptions

- ADR-0076 and its internal one-off search helpers already exist.
- The Brave and Bing connectors can support both `poll()` and `search()` patterns.
- The connector registry (ADR-0048), activation (ADR-0051), credential model (ADR-0028 / ADR-0034), and row-level security (ADR-0015) are already accepted and built.
- One or more future features will need ad-hoc public web search beyond Composer Deep Research.

### 4.4 Constraints

- The new abstraction must preserve the no-core-pipeline-change discipline (ADR-0048).
- One-off search traffic must be isolated from ingestion, reply, and publish traffic.
- Multi-tenant isolation and tenant-owned credentials must be preserved.
- Implementation is gated on ADR-0120 acceptance.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User (primary) | Uses composer research and future on-demand search features | High | Reliable results, clear errors, fast enough for a synchronous workflow |
| Tenant Admin | Manages connector activation and credentials | Medium | Familiar connector setup, activation, and status patterns |
| Product / Engineering | Owns the connector roadmap and abstraction | High | Reusable interface, less duplication, clean extension path |
| Platform Admin | Monitors cost, rate limits, and tenant isolation | Medium | Search traffic isolated from production ingestion; costs remain with tenants |
| Connector Maintainer | Implements and supports provider-specific `search()` | Medium | Clear interface, optional method, documented normalization rules |

---

## 6. Current State (As-Is)

**Current process:**

1. ADR-0076's Composer Deep Research is the first feature that needs one-off public web search.
2. The feature uses internal `searchForResearch(query, limit)` helpers embedded in the Brave and Bing connector code.
3. These helpers reuse the existing credential retrieval, query builder, HTTP fetch, and error classification from the active watchlist connectors.
4. The `SocialConnector` interface is unchanged; the helpers are not a public contract.

**Pain points:**

- The internal helpers are not reusable for RAG, watchlist count preview, metric explainability, or any other future on-demand search feature.
- Each new feature would need to duplicate query building, credential loading, rate-limit handling, and result parsing.
- Internal helpers blur the boundary between the `SocialConnector` contract and ad-hoc search behavior.
- One-off search rate limits are at risk of being conflated with ingestion, reply, and publish limits if not explicitly separated.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A `SearchProviderConnector` interface is added as a first-class, optional connector kind alongside `SocialConnector` and `AIProviderConnector`.
2. Search providers are registered in the connector registry and loaded by `bootstrapConnectors.ts` using the same pattern as other connectors.
3. A provider that supports one-off search implements `search?(ctx, request)` and returns a standardized `SearchResponse`.
4. A tenant activates the provider and supplies a tenant-level or user-level credential before search can be called.
5. Each call is scoped to the tenant through `withTenant()`, checked against the caller's credential access, and gated by a dedicated `RequestGate` key.
6. ADR-0076's `searchForResearch` helpers are refactored to call the new abstraction.
7. Future features needing one-off search can call `SearchProviderConnector` without re-implementing provider-specific logic or changing `SocialConnector`.

**Expected capabilities:**

- A single, reusable way to run one-off public web searches for any tenant-scoped feature.
- Clear separation between recurring ingestion (`poll()`) and ad-hoc search (`search?()`).
- Tenant-owned credentials and isolated rate limits for search traffic.
- Optional adoption: providers that do not support search return `search_not_supported`.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All search calls shall be tenant-scoped through `withTenant()` and require access to the credential used | Security | Must | Penetration/contract tests assert no cross-tenant access |
| NFR-002 | Search traffic shall use a `RequestGate` key distinct from ingestion, reply, publish, and research | Reliability / Scalability | Must | Load tests show research spikes do not affect ingestion success rates |
| NFR-003 | Search errors shall be classifiable using the same taxonomy as the polling connectors (`http_401`, `http_403`, `rate_limited`, `http_5xx`) | Reliability | Should | Contract tests map each error class cleanly |
| NFR-004 | Adding a new search provider shall require only registration and implementation of the optional `SearchProviderConnector` interface | Maintainability | Must | A new provider can be added without changing `SocialConnector` or `AIProviderConnector` |
| NFR-005 | One-off search calls should complete within a synchronous request window, targeting a p95 latency under 5 seconds per provider for typical queries | Performance | Should | Monitoring confirms p95 latency over 30 days |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Search provider usage by tenant | Track adoption of `brave-search` vs `bing-search` vs future providers | Product / Engineering | Weekly |
| Search rate-limit hits per provider | Detect quota pressure and cost spikes | Operations | Real-time / Daily |
| Search error rate by classification | Spot credential, quota, or connectivity issues | Engineering / Operations | Real-time / Daily |
| Average search response time per provider | Monitor provider performance and user experience | Engineering | Daily |
| Number of features consuming `SearchProviderConnector` | Measure reuse of the abstraction | Product | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A third connector interface increases registry surface area and cognitive load | Medium | Medium | Keep the interface optional; document the pattern and migration path; use existing bootstrap and activation mechanics | Engineering |
| R-002 | Refactoring ADR-0076's `searchForResearch` helpers may introduce regressions in Composer Deep Research | Medium | High | Maintain the same request/response shapes and error taxonomy; run the full contract suite before and after refactor | Engineering |
| R-003 | Bing and Brave freshness or market parameters may require provider-specific mapping or normalization | High | Medium | Define a per-provider query-normalization step while keeping the public `SearchRequest` shape generic | Engineering |
| R-004 | Search traffic could starve ingestion if rate gates are misconfigured | Low | High | Enforce a dedicated `RequestGate` key for `search` and validate in load tests | Engineering |
| R-005 | ADR-0120 is Proposed and may change before acceptance | High | Medium | Treat this BRD as a draft; revisit and update immediately on ADR status change | Product Owner |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- The `SearchProviderConnector` interface, `SearchRequest`, and `SearchResponse` shapes are defined and documented.
- Brave and Bing connectors optionally implement `search?()` and pass contract tests for request shape, response shape, and error mapping.
- Search calls require an activated connector and a valid tenant-level or user-level credential.
- Search calls are RLS-scoped and the caller must have access to the credential used.
- A dedicated `RequestGate` key per `(tenantId, providerId, 'search')` is enforced and does not overlap with other gates.
- A provider that does not implement `search?()` returns `search_not_supported` with a clear message.
- ADR-0076's `searchForResearch` helpers can be refactored to call the new abstraction without changing the public `POST /v1/composer/research` contract.
- A future on-demand search feature can use `SearchProviderConnector` without modifying `SocialConnector` or `AIProviderConnector`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SearchProviderConnector` | A first-class, optional connector interface for one-off public web search. |
| `SearchRequest` | The payload for a one-off search call, containing `q`, `limit`, `freshness`, and `market`. |
| `SearchResponse` | The result of a one-off search call, containing an array of search results. |
| One-off search | An ad-hoc, read-only web search, distinct from recurring ingestion `poll()`. |
| Provider | A search API such as Brave Search or Bing Search. |
| Activation | The tenant-level enabling of a connector through `connector_activations`. |
| Credential | A tenant or user-level secret stored in `platform_credentials` and used to call a provider. |
| `RequestGate` | The per-tenant, per-provider rate-limit gate. |

---

## 16. Appendices

### Reference Documents

- ADR-0120: SearchProviderConnector — Shared One-Off Search Abstraction (`docs/adr/0120-search-provider-connector.md`) — **Proposed**
- ADR-0076: Composer Deep Research Agent (`docs/adr/0076-composer-deep-research-agent.md`)
- ADR-0065: Active Watchlist Sourcing via Brave Search API (`docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md`)
- ADR-0066: Active Watchlist Sourcing via Bing Search API (`docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md`)
- ADR-0048: No-Core-Pipeline-Change Verification for New Connector Registration (`docs/adr/0048-no-core-pipeline-change-verification-for-new-connector-registration.md`)
- ADR-0028: Credential Creation Authority by Ownership Tier (`docs/adr/0028-credential-creation-authority-by-ownership-tier.md`)
- ADR-0003: Per-Tenant Per-Provider Rate Limiting (`docs/adr/0003-per-tenant-per-provider-rate-limiting.md`)

### Related User Stories

- **Story 2.31 — Brave and Bing one-off research search helpers** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 2.32 — Azure OpenAI `research?()` capability** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 3.17 — Composer deep research REST endpoint** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`)
- **Story 6.41 — Composer Deep Research panel UI** (`docs/user-stories/epic-6-tenant-admin-ui.md`)

### Missing Source Note

No dedicated `docs/product-research/feature-designs/<feature>.md` file or `docs/product-research/reports/<feature>-deep-research.md` brief was found for the `SearchProviderConnector` abstraction at the time of writing. The business requirements above are derived directly from ADR-0120, ADR-0076, and the related user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
