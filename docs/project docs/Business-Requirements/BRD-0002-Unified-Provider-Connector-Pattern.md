# Business Requirements Document — Unified Provider Connector Pattern

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Unified Provider Connector Pattern Business Requirements |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno — Business Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial BRD produced from ADR-0002, design spec §3.1/§3.3, and Epic 2 user stories. |

---

## 2. Executive Summary

SocialEngage must integrate with an open-ended set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire) and must be able to swap AI enrichment providers (Azure AI Language today; OpenAI, Claude, or others later). Today, each new integration risks duplicating authentication, rate-limit enforcement, and health-derivation logic, and changing the core ingestion pipeline for every new platform. The Unified Provider Connector Pattern solves this by defining a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`. A new social platform or AI provider is added by implementing the relevant interface and registering it — no changes to the core pipeline. This keeps the platform roster cheap to extend, makes AI providers swappable on the same registration path, and unifies rate-limit enforcement and credential handling across every provider.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce cost and time to add new social platforms | A new poll- or push-based platform ships without touching the core ingestion orchestration. |
| 2 | Make AI enrichment providers swappable | Azure AI Language, OpenAI, or Claude can be registered and substituted using the same mechanism as social connectors. |
| 3 | Unify operational concerns across all providers | Rate limiting, credential handling, and health derivation are authored once and apply uniformly to every new connector. |
| 4 | Preserve tenant isolation | Per-tenant, per-provider rate-limit enforcement is inherited automatically by every new connector. |

---

## 4. Scope

### 4.1 In Scope

- A shared base contract `ProviderConnector` with `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`.
- `SocialConnector` specialization: `deliveryMode: 'push' | 'poll'`, OAuth/API-key auth methods, and `normalize()`.
- `AIProviderConnector` specialization: `listModels`, `getModelRateLimit`, `getModelCapabilities`, and `analyze`.
- Connector registration mechanism that requires no core pipeline changes when adding a new platform or AI provider.
- Per-connector `deliveryMode` declaration so the pipeline dispatches generically on push/poll rather than hardcoding platform behavior.

### 4.2 Out of Scope

- Specific platform implementations (e.g., X, Reddit, YouTube) beyond the interface contract; these are separate stories/ADRs.
- Specific AI provider implementations beyond the interface contract.
- Credential ownership and governance rules; these are addressed in ADR-0028 and its own BRD.
- The enforcement engine (`RequestGate`); this is covered by ADR-0003 and its own BRD.

### 4.3 Assumptions

- All connectors declare platform-imposed rate limits; the core never invents limits.
- AI-provider rate limits are typically per-model, justifying the extra `getModelRateLimit(modelId)` method.
- Connector authors understand which optional methods apply for their `authMode` and `deliveryMode`.

### 4.4 Constraints

- The shared contract trades some type safety for uniformity; many `SocialConnector` methods are optional depending on `deliveryMode`/`authMode`.
- The base contract is not perfectly flat: AI provider rate limits live one level deeper than social provider limits.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Core Backend Engineer | Implements the connector framework and new connectors | High | A stable contract and registration path that isolates connector logic from core pipeline changes. |
| Tenant-Admin | Activates connectors and credentials for their tenant | Medium | New platforms or AI providers become available through the existing connector activation flow. |
| Platform Operator | Runs multi-tenant ingestion and rate limiting | High | Uniform rate-limit and health behavior across every provider and tenant. |
| Product Owner | Prioritizes platform/AI provider coverage | Medium | Fast, low-risk addition of new integrations. |

---

## 6. Current State (As-Is)

Social and AI integrations currently share common concerns — authentication, discovery of available endpoints/models, rate-limit compliance, and request execution — but no shared contract exists. Each new platform or provider would require custom glue in the ingestion pipeline, duplicating rate-limit and credential handling logic. The AI enrichment path is separate from the social-connector path, so swapping Azure AI Language for another provider would not naturally reuse the same registration and rate-limit infrastructure.

**Pain points:**
- Adding a new platform risks pipeline changes and duplicated operational code.
- AI provider swappability is not structurally supported.
- Rate limits, retries, and health derivation would be reimplemented per provider.

---

## 7. Future State (To-Be)

A single `ProviderConnector` base contract is specialized into `SocialConnector` and `AIProviderConnector`. The ingestion pipeline treats connectors generically: it asks a connector for its rate limit, dispatch style, and normalized output, without knowing the concrete platform or AI provider. Adding a new integration becomes a matter of implementing the interface and registering the connector. AI providers are first-class connectors, so replacing or adding an enrichment provider follows the exact same path as adding Reddit or GNews.

**Expected capabilities:**
- New social platforms are added without core pipeline changes.
- New AI enrichment providers are added and swapped using the same registration mechanism.
- Rate limiting, credential handling, and health derivation are authored once and inherited by all connectors.
- The pipeline respects per-connector `deliveryMode` (push or poll) rather than assuming all platforms support one or the other.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall define a shared `ProviderConnector` base contract. | Must | Contract exposes `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`. | Technical Lead |
| BR-002 | The system shall specialize `ProviderConnector` into `SocialConnector`. | Must | Adds `deliveryMode: 'push' | 'poll'`, auth methods appropriate to `authMode`, and `normalize()`; platforms without push support can declare `deliveryMode: 'poll'`. | Technical Lead |
| BR-003 | The system shall specialize `ProviderConnector` into `AIProviderConnector`. | Must | Adds `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, and `analyze()`. | Technical Lead |
| BR-004 | The system shall support adding a new connector without changing core pipeline code. | Must | A second reference connector of each kind can be added and verified without touching the ingestion orchestration. | Core Backend Engineer |
| BR-005 | The system shall treat AI providers as swappable using the same registration mechanism as social platforms. | Must | A new AI provider implementation can be registered in the same manner as a new social platform. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Rate-limit, credential, and health logic is shared across all connectors. | Maintainability | Must | New connectors inherit the same rate-limit and health behavior without reimplementation. |
| NFR-002 | The contract accommodates push and poll delivery modes without a system-wide assumption. | Scalability | Must | The pipeline dispatches on `deliveryMode` without knowing the concrete platform. |
| NFR-003 | Optional methods are clearly tied to `authMode` and `deliveryMode` to guide connector authors. | Usability | Should | A connector author can determine which methods to implement from the declared modes. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A connector must declare its own platform-imposed rate limits; the core may not invent limits. |
| BRU-002 | A `SocialConnector` must declare `deliveryMode` as either `push` or `poll` based on what the real platform supports. |
| BRU-003 | An `AIProviderConnector` must expose per-model rate limits and capabilities because AI limits are typically model-scoped. |
| BRU-004 | Registering a new connector is additive; it may not require edits to the core ingestion pipeline. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `providerId` | Unique identifier for a registered social platform or AI provider. | Connector implementation | Core Backend | Public / configuration |
| `authMode` | Authentication mode declared by a connector (`oauth` or `apiKey`). | Connector implementation | Core Backend | Public / configuration |
| `deliveryMode` | Ingestion dispatch mode for social connectors (`push` or `poll`). | Connector implementation | Core Backend | Public / configuration |
| `RateLimitConfig` | Declared rate-limit parameters for a provider/model. | Connector implementation | Core Backend | Public / configuration |
| `ModelInfo` / `ModelCapabilities` | Available models and their capabilities for an AI provider. | AI provider API | Tenant credential owner | Tenant data |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Connector registration count | Track how many social and AI providers are registered. | Product team | Per sprint |
| New connector time-to-integrate | Measure the time from interface implementation to first successful poll/push. | Engineering lead | Per connector |
| Rate-limit violations per provider | Ensure shared rate-limit logic works uniformly across connectors. | Platform operator | Daily |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The shared contract's optional methods may be misapplied by connector authors. | Medium | Medium | Provide clear documentation and contract tests showing which methods are required for each `authMode`/`deliveryMode`. | Technical Lead |
| R-002 | The `ProviderConnector` contract may not cleanly accommodate future provider differences. | Low | High | Keep the base contract minimal and allow additive specializations; revisit contract shape when a new category of provider emerges. | Product Owner |
| R-003 | AI per-model rate limits could be confused with per-provider limits. | Medium | Medium | Document the distinction in the contract and enforce `(tenantId, providerId, modelId)` gating on the `RequestGate` side (ADR-0003). | Core Backend Engineer |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Design Spec §3.1/§3.3 — Generalized Provider Connector Pattern and registration guidance. | Internal — reference | Product Owner | Accepted (2026-07-28) |
| D-002 | ADR-0003 — Per-tenant, per-provider rate limiting (`RequestGate`). | Internal — related BRD | Technical Lead | Accepted |
| D-003 | ADR-0028 — Credential ownership tiers. | Internal — related BRD | Product Owner | Accepted |
| D-004 | Epic 2 user stories — Story 2.1 and downstream connector stories. | Internal — implementation | Core Backend Engineer | Ready |

---

## 14. Acceptance Criteria

- `ProviderConnector` exposes `providerId`, `authMode`, `getRateLimitConfig()`, and optional `parseRateLimitHeaders()`.
- `SocialConnector` adds `deliveryMode: 'push' | 'poll'`, auth methods appropriate to `authMode`, and `normalize()`.
- `AIProviderConnector` adds `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, and `analyze()`.
- Registering a new connector (social or AI) requires no edits to core ingestion orchestration code.
- A poll-only platform (e.g., RSS/News, Reddit, YouTube) and a push-capable platform (e.g., X filtered stream, Meta webhooks) can both be supported by the same pipeline through per-connector `deliveryMode` declaration.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `ProviderConnector` | Shared base contract for any external provider — social platform or AI enrichment service. |
| `SocialConnector` | Specialization of `ProviderConnector` for social-platform ingestion. |
| `AIProviderConnector` | Specialization of `ProviderConnector` for AI enrichment providers. |
| `deliveryMode` | Connector-declared ingestion style: `push` (webhook/stream) or `poll` (scheduled fetch). |
| `authMode` | Connector-declared authentication style: `oauth` or `apiKey`. |
| `RequestGate` | The core rate-limit enforcement component; scope is `(tenantId, providerId)` or `(tenantId, providerId, modelId)` for AI. |

---

## 16. Appendices

### Appendix A — Source ADR

- [ADR-0002: Unified `ProviderConnector` contract for social platforms and AI providers](../../adr/0002-unified-provider-connector-pattern.md) — Accepted 2026-07-28.

### Appendix B — Design Specification Reference

- [`docs/project docs/2026-07-28-social-listening-ingestion-design.md`](../2026-07-28-social-listening-ingestion-design.md), §3.1 "Generalized Provider Connector Pattern" and §3.3 "Adding a New Platform or AI Provider".

### Appendix C — Related User Stories

- [Epic 2 — Ingestion, Connectors & Rate Limits](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
  - **Story 2.1 — Unified provider connector framework** (Source: ADR-0002; Status: Ready)
    - As a core backend engineer, I want a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector`, so that adding a new social platform or swapping the AI enrichment provider means implementing and registering one interface, with no changes to the core ingestion pipeline.
    - Key acceptance criteria: base contract fields and methods; `SocialConnector` and `AIProviderConnector` specializations; no pipeline changes required when registering new connectors.

### Appendix D — Missing or Not-Applicable Source Documents

- No standalone `docs/product-research/feature-designs/<feature>.md` file or `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for ADR-0002. The feature rationale and contract are captured directly in the design specification (§3.1/§3.3) and the ADR itself.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | — | | |
