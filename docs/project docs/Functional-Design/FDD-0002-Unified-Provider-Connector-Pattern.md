# Business Requirements Document — Unified Provider Connector Pattern

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Unified Provider Connector Pattern |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0002-unified-provider-connector-pattern.md, ../Business-Requirements/BRD-0002-Unified-Provider-Connector-Pattern.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0002-unified-provider-connector-pattern.md and the business requirements in BRD-0002-Unified-Provider-Connector-Pattern.md into functional design for **Unified Provider Connector Pattern**.
SocialEngage must integrate with an open-ended set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire) and must be able to swap AI enrichment providers (Azure AI Language today; OpenAI, Claude, or others later). Today, each new integration risks duplicating authentication, rate-limit enforcement, and health-derivation logic, and changing the core ingestion pipeline for every new platform. The Unified Provider Connector Pattern solves this by defining a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`. A new social platform or AI provider is added by implementing the relevant interface and registering it — no changes to the core pipeline. This keeps the platform roster cheap to extend, makes AI providers swappable on the same registration path, and unifies rate-limit enforcement and credential handling across every provider.

---

### 2.2 Scope
**In scope:**
- A shared base contract `ProviderConnector` with `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`.
- `SocialConnector` specialization: `deliveryMode: 'push' | 'poll'`, OAuth/API-key auth methods, and `normalize()`.
- `AIProviderConnector` specialization: `listModels`, `getModelRateLimit`, `getModelCapabilities`, and `analyze`.
- Connector registration mechanism that requires no core pipeline changes when adding a new platform or AI provider.
- Per-connector `deliveryMode` declaration so the pipeline dispatches generically on push/poll rather than hardcoding platform behavior.

**Out of scope:**
- Specific platform implementations (e.g., X, Reddit, YouTube) beyond the interface contract; these are separate stories/ADRs.
- Specific AI provider implementations beyond the interface contract.
- Credential ownership and governance rules; these are addressed in ADR-0028 and its own BRD.
- The enforcement engine (`RequestGate`); this is covered by ADR-0003 and its own BRD.

## 3. Context and Background
The system must integrate with a growing, open-ended set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire — per §10) and must also support swapping the AI enrichment provider (Azure AI Language today; OpenAI, Claude, or others later, per §2 and §3.1). Both kinds of integration share the same underlying concerns: authenticating, discovering what's available, respecting a provider-imposed rate limit, and executing a request.
SocialEngage must integrate with an open-ended set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire) and must be able to swap AI enrichment providers (Azure AI Language today; OpenAI, Claude, or others later). Today, each new integration risks duplicating authentication, rate-limit enforcement, and health-derivation logic, and changing the core ingestion pipeline for every new platform. The Unified Provider Connector Pattern solves this by defining a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`. A new social platform or AI provider is added by implementing the relevant interface and registering it — no changes to the core pipeline. This keeps the platform roster cheap to extend, makes AI providers swappable on the same registration path, and unifies rate-limit enforcement and credential handling across every provider.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce cost and time to add new social platforms | A new poll- or push-based platform ships without touching the core ingestion orchestration. |
| 2 | Make AI enrichment providers swappable | Azure AI Language, OpenAI, or Claude can be registered and substituted using the same mechanism as social connectors. |
| 3 | Unify operational concerns across all providers | Rate limiting, credential handling, and health derivation are authored once and apply uniformly to every new connector. |
| 4 | Preserve tenant isolation | Per-tenant, per-provider rate-limit enforcement is inherited automatically by every new connector. |

---

**Positive consequences (from ADR):**
**Positive**
- Rate limiting, credential handling, and health derivation are written once against the shared contract and apply uniformly to every platform and every AI provider, including ones added later.
- AI providers become swappable using the exact same registration mechanism as social platforms, directly satisfying the "swappable AI provider" requirement in §1.
- New connectors are additive (implement + register), which keeps the core pipeline stable as the platform list grows from the current open question in §10.
- `deliveryMode: 'push' | 'poll'` being a per-connector declared property, rather than a system-wide assumption, reflects a real constraint identified during design: *"Not every platform gives you a choice — X's filtered stream API supports real-time, Meta has webhook subscriptions for pages, but Reddit, YouTube, and most RSS/newswire feeds simply don't offer push at all."* Because the ingestion core dispatches generically on `deliveryMode` rather than hardcoding which platforms get which treatment, it never has to commit to an all-push or all-poll posture that wouldn't match what platforms actually support.

**Negative**
- The shared contract has to accommodate real differences between social platforms (push vs. poll delivery, webhook payloads) and AI providers (per-model rate limits and capabilities), which pushes some optionality into the interfaces (e.g., most `SocialConnector` methods are optional depending on `deliveryMode`/`authMode`). This trades a small amount of type-safety for uniformity.
- A connector author must still understand which optional methods apply to their specific platform/provider; the interface alone doesn't fully constrain valid implementations.
- The base contract's unifying assumption — rate limits belong to a provider (`getRateLimitConfig()`) — already needed one exception at day one: AI providers' limits are typically per-*model*, not per-provider, so `AIProviderConnector` adds `getModelRateLimit(modelId)` one layer deeper (§3.2). This is a reasonable accommodation, not a flaw, but it means the "shared contract" isn't fully flat even at the rate-limiting level; see ADR-0003 for how the enforcement side (`RequestGate`) reflects this by keying AI-provider limits on `(tenantId, providerId, modelId)` instead of `(tenantId, providerId)`.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall define a shared `ProviderConnector` base contract. | Must | Contract exposes `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`. | Technical Lead |
| BR-002 | The system shall specialize `ProviderConnector` into `SocialConnector`. | Must | Adds `deliveryMode: 'push' | 'poll'`, auth methods appropriate to `authMode`, and `normalize()`; platforms without push support can declare `deliveryMode: 'poll'`. | Technical Lead |
| BR-003 | The system shall specialize `ProviderConnector` into `AIProviderConnector`. | Must | Adds `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, and `analyze()`. | Technical Lead |
| BR-004 | The system shall support adding a new connector without changing core pipeline code. | Must | A second reference connector of each kind can be added and verified without touching the ingestion orchestration. | Core Backend Engineer |
| BR-005 | The system shall treat AI providers as swappable using the same registration mechanism as social platforms. | Must | A new AI provider implementation can be registered in the same manner as a new social platform. | Product Owner |

### 5.1 Architecture Decision
Define a shared base contract, `ProviderConnector` (`providerId`, `authMode`, `getRateLimitConfig()`, optional `parseRateLimitHeaders()`), and specialize it into `SocialConnector` (poll/push delivery, OAuth/API-key auth, `normalize()`) and `AIProviderConnector` (`listModels`, `getModelRateLimit`, `getModelCapabilities`, `analyze`). Adding a new platform or AI provider means implementing the relevant interface and registering it — no changes to the core pipeline (§3.3).

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Core Backend Engineer | Implements the connector framework and new connectors | High | A stable contract and registration path that isolates connector logic from core pipeline changes. |
| Tenant-Admin | Activates connectors and credentials for their tenant | Medium | New platforms or AI providers become available through the existing connector activation flow. |
| Platform Operator | Runs multi-tenant ingestion and rate limiting | High | Uniform rate-limit and health behavior across every provider and tenant. |
| Product Owner | Prioritizes platform/AI provider coverage | Medium | Fast, low-risk addition of new integrations. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.1 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer, I want a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`, so that adding a ne... | `ProviderConnector` exposes `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`.; `SocialConnector` adds `deliveryMode: ... |
| Story 2.17 | epic-2-ingestion-connectors-and-rate-limits.md | As developer or future UI consumer of `SocialPost.enrichment`, I want a concise, LLM-generated summary of a post's content captured as part of the same struc... | `AnalyzeResult` (`types.ts`) gains an optional `summary?: string` field — additive, matching every prior widening of this interface; `azureAiLanguageConnecto... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `providerId` | Unique identifier for a registered social platform or AI provider. | Connector implementation | Core Backend | Public / configuration |
| `authMode` | Authentication mode declared by a connector (`oauth` or `apiKey`). | Connector implementation | Core Backend | Public / configuration |
| `deliveryMode` | Ingestion dispatch mode for social connectors (`push` or `poll`). | Connector implementation | Core Backend | Public / configuration |
| `RateLimitConfig` | Declared rate-limit parameters for a provider/model. | Connector implementation | Core Backend | Public / configuration |
| `ModelInfo` / `ModelCapabilities` | Available models and their capabilities for an AI provider. | AI provider API | Tenant credential owner | Tenant data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A connector must declare its own platform-imposed rate limits; the core may not invent limits. |
| BRU-002 | A `SocialConnector` must declare `deliveryMode` as either `push` or `poll` based on what the real platform supports. |
| BRU-003 | An `AIProviderConnector` must expose per-model rate limits and capabilities because AI limits are typically model-scoped. |
| BRU-004 | Registering a new connector is additive; it may not require edits to the core ingestion pipeline. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Design Spec §3.1/§3.3 — Generalized Provider Connector Pattern and registration guidance. | Internal — reference | Product Owner | Accepted (2026-07-28) |
| D-002 | ADR-0003 — Per-tenant, per-provider rate limiting (`RequestGate`). | Internal — related BRD | Technical Lead | Accepted |
| D-003 | ADR-0028 — Credential ownership tiers. | Internal — related BRD | Product Owner | Accepted |
| D-004 | Epic 2 user stories — Story 2.1 and downstream connector stories. | Internal — implementation | Core Backend Engineer | Ready |

---

- All connectors declare platform-imposed rate limits; the core never invents limits.
- AI-provider rate limits are typically per-model, justifying the extra `getModelRateLimit(modelId)` method.
- Connector authors understand which optional methods apply for their `authMode` and `deliveryMode`.

Define a shared base contract, `ProviderConnector` (`providerId`, `authMode`, `getRateLimitConfig()`, optional `parseRateLimitHeaders()`), and specialize it into `SocialConnector` (poll/push delivery, OAuth/API-key auth, `normalize()`) and `AIProviderConnector` (`listModels`, `getModelRateLimit`, `getModelCapabilities`, `analyze`). Adding a new platform or AI provider means implementing the relevant interface and registering it — no changes to the core pipeline (§3.3).

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Rate-limit, credential, and health logic is shared across all connectors. | Maintainability | Must | New connectors inherit the same rate-limit and health behavior without reimplementation. |
| NFR-002 | The contract accommodates push and poll delivery modes without a system-wide assumption. | Scalability | Must | The pipeline dispatches on `deliveryMode` without knowing the concrete platform. |
| NFR-003 | Optional methods are clearly tied to `authMode` and `deliveryMode` to guide connector authors. | Usability | Should | A connector author can determine which methods to implement from the declared modes. |

---

## 11. Error Handling and Exceptions
**Positive**
- Rate limiting, credential handling, and health derivation are written once against the shared contract and apply uniformly to every platform and every AI provider, including ones added later.
- AI providers become swappable using the exact same registration mechanism as social platforms, directly satisfying the "swappable AI provider" requirement in §1.
- New connectors are additive (implement + register), which keeps the core pipeline stable as the platform list grows from the current open question in §10.
- `deliveryMode: 'push' | 'poll'` being a per-connector declared property, rather than a system-wide assumption, reflects a real constraint identified during design: *"Not every platform gives you a choice — X's filtered stream API supports real-time, Meta has webhook subscriptions for pages, but Reddit, YouTube, and most RSS/newswire feeds simply don't offer push at all."* Because the ingestion core dispatches generically on `deliveryMode` rather than hardcoding which platforms get which treatment, it never has to commit to an all-push or all-poll posture that wouldn't match what platforms actually support.

**Negative**
- The shared contract has to accommodate real differences between social platforms (push vs. poll delivery, webhook payloads) and AI providers (per-model rate limits and capabilities), which pushes some optionality into the interfaces (e.g., most `SocialConnector` methods are optional depending on `deliveryMode`/`authMode`). This trades a small amount of type-safety for uniformity.
- A connector author must still understand which optional methods apply to their specific platform/provider; the interface alone doesn't fully constrain valid implementations.
- The base contract's unifying assumption — rate limits belong to a provider (`getRateLimitConfig()`) — already needed one exception at day one: AI providers' limits are typically per-*model*, not per-provider, so `AIProviderConnector` adds `getModelRateLimit(modelId)` one layer deeper (§3.2). This is a reasonable accommodation, not a flaw, but it means the "shared contract" isn't fully flat even at the rate-limiting level; see ADR-0003 for how the enforcement side (`RequestGate`) reflects this by keying AI-provider limits on `(tenantId, providerId, modelId)` instead of `(tenantId, providerId)`.

## 12. Assumptions and Dependencies
- All connectors declare platform-imposed rate limits; the core never invents limits.
- AI-provider rate limits are typically per-model, justifying the extra `getModelRateLimit(modelId)` method.
- Connector authors understand which optional methods apply for their `authMode` and `deliveryMode`.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The shared contract's optional methods may be misapplied by connector authors. | Medium | Medium | Provide clear documentation and contract tests showing which methods are required for each `authMode`/`deliveryMode`. | Technical Lead |
| R-002 | The `ProviderConnector` contract may not cleanly accommodate future provider differences. | Low | High | Keep the base contract minimal and allow additive specializations; revisit contract shape when a new category of provider emerges. | Product Owner |
| R-003 | AI per-model rate limits could be confused with per-provider limits. | Medium | Medium | Document the distinction in the contract and enforce `(tenantId, providerId, modelId)` gating on the `RequestGate` side (ADR-0003). | Core Backend Engineer |

---

## 14. Appendix
- ADR: `../../adr/0002-unified-provider-connector-pattern.md`
- BRD: `../Business-Requirements/BRD-0002-Unified-Provider-Connector-Pattern.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above