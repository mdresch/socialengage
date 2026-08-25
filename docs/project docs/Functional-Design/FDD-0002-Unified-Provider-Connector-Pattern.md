# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0002 Unified Provider Connector Pattern — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0002 is Accepted) |
| Related Documents | ADR-0002, ADR-0003, ADR-0028, BRD-0002, Story 2.1, Epic 2 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0002 (Unified `ProviderConnector` contract) and BRD-0002 into a functional design for the connector abstraction that every social platform and AI enrichment provider in SocialEngage implements against. It specifies the base contract, its two specializations, and the behavior the ingestion pipeline relies on to treat every connector generically.

### 2.2 Scope

- **In scope:** the `ProviderConnector` base contract; the `SocialConnector` and `AIProviderConnector` specializations; the registration mechanism that lets a new connector be added without pipeline changes; the per-connector `deliveryMode` declaration and how the pipeline dispatches on it.
- **Out of scope:** specific platform implementations (X, Reddit, YouTube, etc.) beyond the interface contract; specific AI provider implementations beyond the contract; credential ownership/governance (ADR-0028); the rate-limit enforcement engine itself, `RequestGate` (ADR-0003/FDD-0003).

### 2.3 Target Audience

Core backend engineers implementing new connectors, the technical lead reviewing connector additions for pipeline-change risk, and future maintainers deciding whether a new provider category needs a contract change.

---

## 3. Context and Background

- **Problem/opportunity:** SocialEngage must integrate an open-ended, growing set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire) and must keep the AI enrichment provider swappable (Azure AI Language today, OpenAI/Claude potentially later). Both integration kinds share authentication, capability discovery, rate-limit compliance, and request execution concerns; without a shared contract, each new integration would duplicate that logic and risk touching the core ingestion pipeline.
- **Business/user value:** cheaper, lower-risk platform/provider expansion; AI providers become swappable through the same mechanism as social platforms; rate limiting, credential handling, and health derivation are written once and inherited automatically.
- **Source requirements:** ADR-0002; BRD-0002 (BR-001–BR-005, BRU-001–BRU-004); Story 2.1 (Epic 2).
- **Constraints/dependencies:** the contract trades some type safety for uniformity (many `SocialConnector` methods are optional depending on `deliveryMode`/`authMode`); AI-provider rate limits are per-model, one layer deeper than the base contract's per-provider assumption (reconciled by `RequestGate` in ADR-0003 keying on `(tenantId, providerId, modelId)` for AI); credential ownership for `AIProviderConnector` implementations is governed separately by ADR-0028 (tenant-owned, tier-2), not by this ADR.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce cost/time to add a new social platform | A new poll- or push-based platform ships by implementing `SocialConnector` and registering it — no core pipeline edits |
| G2 | Make AI enrichment providers swappable | A new/alternate `AIProviderConnector` implementation registers through the identical mechanism as a social connector |
| G3 | Unify rate limiting, credential handling, and health derivation | These concerns are implemented once against the shared contract and apply uniformly to every current and future connector |
| G4 | Support both push- and poll-capable platforms without a system-wide assumption | The pipeline dispatches generically on each connector's declared `deliveryMode` |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `ProviderConnector` base contract

- **Description:** the shared interface every connector — social or AI — implements. Establishes the minimum surface the ingestion pipeline and rate-limit machinery need to treat any provider generically.
- **Triggers:** implemented once per new connector, at connector-authoring time; consulted by the pipeline whenever it needs a connector's identity, auth mode, or declared rate limit.
- **Inputs:** none at runtime beyond the connector's own configuration/credential; at design time, the connector author supplies `providerId` and `authMode`.
- **Processing:** exposes `providerId` (unique identifier), `authMode` (`oauth` | `apiKey`, or `none` for connectors with no auth), `getRateLimitConfig()` (returns the provider's declared, platform-imposed rate limit — the core never invents a limit per BRU-001), and an optional `parseRateLimitHeaders()` for connectors whose provider communicates live limit state via response headers.
- **Outputs:** a `RateLimitConfig` value object consumed by `RequestGate` (ADR-0003); a stable `providerId` used as a key across credentials, health, and rate-limit state.
- **Error handling:** a connector that fails to declare a rate limit is a contract violation caught at connector registration/contract-test time, not a runtime condition to recover from.
- **Edge cases:** a provider with no meaningful rate limit (rare) still implements `getRateLimitConfig()`, returning a config that reflects "effectively unlimited" rather than omitting the method.

### 5.2 Feature / Capability: `SocialConnector` specialization

- **Description:** specializes `ProviderConnector` for social-platform ingestion, adding delivery-mode declaration, platform-appropriate auth methods, and output normalization.
- **Triggers:** implemented per social platform (e.g., GNews, Newswire, tenant-owned-feed, Wikipedia, Facebook); invoked by the ingestion pipeline on each poll cycle or push event.
- **Inputs:** platform API responses (poll) or webhook/stream payloads (push); the connector's `authMode`-appropriate credential.
- **Processing:** declares `deliveryMode: 'push' | 'poll'` based on what the real platform actually supports (BRU-002) — never forced to one mode by pipeline assumptions; exposes auth methods matching `authMode` (e.g., OAuth token exchange/refresh, or API-key header injection); implements `normalize()` to convert the platform's native payload shape into SocialEngage's canonical post/author representation.
- **Outputs:** normalized post/author records handed to the rest of the ingestion pipeline (storage, enrichment, watchlist matching).
- **Error handling:** a platform response the connector cannot normalize (malformed/unexpected shape) is reported through the connector's own error path, feeding connector health (ADR-0009) rather than crashing the pipeline.
- **Edge cases:** a platform that supports only poll (Reddit, YouTube, most RSS/newswire feeds) declares `deliveryMode: 'poll'` and implements no push-only methods; a platform with genuine push support (X filtered stream, Meta webhooks) declares `deliveryMode: 'push'` and implements the corresponding subscribe/webhook-handling methods instead of, or in addition to, poll.

### 5.3 Feature / Capability: `AIProviderConnector` specialization

- **Description:** specializes `ProviderConnector` for AI enrichment providers, adding model discovery, per-model rate limits and capabilities, and the analysis call itself.
- **Triggers:** implemented per AI provider (Azure AI Language today; OpenAI/Claude potential future registrations); invoked by the enrichment stage of the pipeline for sentiment/topic analysis.
- **Inputs:** normalized post content to be analyzed; the provider's credential; a target model identifier.
- **Processing:** `listModels()` enumerates models the provider currently offers; `getModelRateLimit(modelId)` returns the per-model rate limit (BRU-003 — AI limits are typically model-scoped, not provider-scoped, which is why this sits one level below the base contract's `getRateLimitConfig()`); `getModelCapabilities(modelId)` describes what a given model can do (e.g., sentiment vs. topic extraction); `analyze()` performs the actual enrichment call.
- **Outputs:** enrichment results (e.g., sentiment score, topic signal) attached to the analyzed content; per-model capability/rate-limit metadata consumed by `RequestGate` and by any UI surfacing available models.
- **Error handling:** a model rate-limit or capability call failing is treated as a provider-health signal, not silently ignored; `analyze()` failures propagate to the enrichment stage's own error handling rather than being swallowed inside the connector.
- **Edge cases:** a provider that changes its available model roster between `listModels()` calls — callers must not cache model lists indefinitely; a model with no meaningful capability overlap with the current enrichment need is simply not selected, not an error condition.

### 5.4 Feature / Capability: Additive connector registration

- **Description:** the mechanism by which a new connector (social or AI) becomes usable by the ingestion pipeline without any change to core pipeline code.
- **Triggers:** a developer finishing a new `SocialConnector` or `AIProviderConnector` implementation.
- **Inputs:** the new connector's implementation, registered under its `providerId`.
- **Processing:** the pipeline discovers and dispatches to connectors generically — by contract, not by a hardcoded per-platform branch — so registering a new `providerId` is sufficient for the pipeline to start using it (subject to tenant/credential activation elsewhere, e.g., ADR-0028/ADR-0051).
- **Outputs:** a newly available connector that participates in ingestion, rate limiting, and health derivation identically to every pre-existing connector.
- **Error handling:** if registering a connector requires editing core pipeline orchestration code, that is itself a design defect relative to this ADR (BRU-004) and should be treated as a gap to close, not a one-off exception.
- **Edge cases:** two connectors registering the same `providerId` — must be prevented/rejected at registration time, since `providerId` is the key used across credentials, rate limits, and health.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Core Backend Engineer | Implements new `SocialConnector`/`AIProviderConnector` instances and registers them |
| Ingestion Pipeline (system actor) | Dispatches generically to any registered connector based on its declared contract fields |
| Tenant Admin | Activates a connector/credential for their tenant once it exists (downstream of this ADR, per ADR-0028/ADR-0051) |
| Technical Lead / Product Owner | Reviews new connectors for contract compliance and pipeline-change risk |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 2.1) | core backend engineer | have a shared `ProviderConnector` base contract specialized into `SocialConnector` and `AIProviderConnector` | adding a new social platform or swapping the AI enrichment provider means implementing and registering one interface, with no core pipeline changes | (1) base contract exposes `providerId`, `authMode`, `getRateLimitConfig()`, optional `parseRateLimitHeaders()`; (2) `SocialConnector` and `AIProviderConnector` specializations exist per §5.2/§5.3; (3) registering a new connector requires no pipeline edits |

### 6.3 Workflow Diagrams / Steps

**Workflow: Adding a new social platform connector**

1. Engineer implements `SocialConnector` for the new platform: sets `providerId`, `authMode`, `deliveryMode`, `getRateLimitConfig()`, and `normalize()`, plus auth methods matching `authMode`.
2. Engineer registers the connector under its `providerId`.
3. The ingestion pipeline discovers the connector generically (poll scheduler picks it up if `deliveryMode: 'poll'`; webhook/stream registration if `'push'`).
4. On each ingestion cycle, the pipeline calls the connector's fetch/handle method, then `normalize()`, then hands normalized output downstream (storage/enrichment/watchlist matching).
5. Rate limiting (`RequestGate`, ADR-0003), credential resolution (ADR-0028), and health derivation (ADR-0009) apply automatically because they operate against the shared contract, not platform-specific code.

**Workflow: Swapping/adding an AI enrichment provider**

1. Engineer implements `AIProviderConnector`: `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, `analyze()`.
2. Engineer registers the connector under its `providerId`, using the identical registration mechanism as a social connector.
3. The enrichment stage of the pipeline can now target this provider/model for analysis, subject to tenant credential activation.

---

## 7. Data Requirements

### 7.1 Data Inputs

Platform API responses or webhook/stream payloads (social connectors); content to be analyzed plus a target model identifier (AI connectors); connector configuration (`providerId`, `authMode`, `deliveryMode`) supplied at implementation time.

### 7.2 Data Outputs

Normalized post/author records (social connectors) handed to storage/enrichment; enrichment results plus model capability/rate-limit metadata (AI connectors) handed to the enrichment stage and to `RequestGate`.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `ProviderConnector` | `providerId`, `authMode`, `getRateLimitConfig()`, optional `parseRateLimitHeaders()` | Base contract; specialized by `SocialConnector` and `AIProviderConnector` |
| `SocialConnector` | all `ProviderConnector` fields + `deliveryMode` (`push`\|`poll`), auth methods per `authMode`, `normalize()` | One per registered social platform (GNews, Newswire, tenant-owned-feed, Wikipedia, Facebook, future platforms) |
| `AIProviderConnector` | all `ProviderConnector` fields + `listModels()`, `getModelRateLimit(modelId)`, `getModelCapabilities(modelId)`, `analyze()` | One per registered AI enrichment provider (Azure AI Language today) |
| `RateLimitConfig` | provider-declared limit parameters (window, max requests, etc.) | Produced by `getRateLimitConfig()`; consumed by `RequestGate` (ADR-0003) |
| `ModelInfo` / `ModelCapabilities` | model id, supported capabilities, per-model rate limit | Produced by `AIProviderConnector.listModels()`/`getModelCapabilities()`; consumed by enrichment stage and `RequestGate` |

### 7.4 Validation Rules

- Every connector must declare a real, platform-imposed rate limit via `getRateLimitConfig()` — the core never fabricates one (BRU-001).
- Every `SocialConnector` must declare `deliveryMode` matching what the platform actually supports (BRU-002), not an assumed default.
- Every `AIProviderConnector` must expose per-model rate limits and capabilities, since AI limits are model-scoped (BRU-003).
- `providerId` must be unique across all registered connectors.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A connector must declare its own platform-imposed rate limits; the core may not invent limits. | All connectors |
| BR2 | A `SocialConnector` must declare `deliveryMode` as `push` or `poll` based on what the real platform supports. | `SocialConnector` |
| BR3 | An `AIProviderConnector` must expose per-model rate limits and capabilities. | `AIProviderConnector` |
| BR4 | Registering a new connector must be additive — it may not require edits to the core ingestion pipeline. | All connectors |
| BR5 | AI-provider credential ownership follows ADR-0028's tier-2 (tenant-owned) model, distinct from this ADR's interface-shape decision. | `AIProviderConnector` credentials |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Social platform APIs (GNews, Newswire, tenant-owned-feed, Wikipedia, Facebook, future) | Inbound to core | Source data for `SocialConnector.normalize()` | Platform-specific REST/RSS/webhook |
| AI enrichment provider (Azure AI Language today) | Outbound from core | Sentiment/topic analysis via `AIProviderConnector.analyze()` | Provider-specific REST |
| `RequestGate` (ADR-0003) | Consumes connector output | Enforces `RateLimitConfig`/per-model limits per tenant | In-process |
| Credential store (ADR-0014/ADR-0028) | Consumes connector `authMode` | Resolves the credential a connector's auth methods need | In-process / Key Vault |
| Connector health derivation (ADR-0009) | Consumes connector error signals | Derives health status from connector-reported failures | In-process |

---

## 10. Non-Functional Considerations

- **Performance:** the pipeline's generic dispatch on `deliveryMode` must not add materially more overhead than a hypothetical hardcoded per-platform branch.
- **Security/access control:** `authMode` ties each connector to the correct credential-resolution path; the contract itself carries no credential material.
- **Scalability:** the roster of connectors is expected to keep growing (five real social connectors as of this writing, more platforms still an open question); the contract must not need to change to accommodate ordinary new registrations.
- **Reliability/availability:** connector-level failures (bad response shape, auth failure) must not take down the shared pipeline; they route into per-connector health/error handling.
- **Audit and logging:** connector-reported errors feed the health-derivation mechanism (ADR-0009), giving operators visibility into which specific connector is degraded.
- **Accessibility/localization:** not applicable — this is an internal backend contract with no UI surface.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Connector fails to declare a valid `getRateLimitConfig()` | N/A (caught in contract tests) | Registration/contract test failure; connector cannot ship |
| Social connector receives an unparseable platform response | N/A (internal) | Reported through connector error path; feeds connector health, does not crash the pipeline |
| AI connector's `analyze()` call fails | Enrichment marked unavailable for that content/run, surfaced per enrichment-stage error handling | Error propagates to enrichment stage; not silently swallowed |
| Two connectors register the same `providerId` | N/A (caught at registration) | Registration rejected/prevented — `providerId` collisions are invalid |
| New connector registration requires a core pipeline code change | N/A (design-time) | Treated as a defect relative to BR4/BRU-004, not shipped as-is |

---

## 12. Assumptions and Dependencies

- All connectors declare platform-imposed rate limits; the core never invents limits (shared assumption with ADR-0003).
- AI-provider rate limits are typically per-model, justifying `getModelRateLimit(modelId)` as a deeper method than the base contract's `getRateLimitConfig()`.
- Connector authors understand which optional `SocialConnector`/`AIProviderConnector` methods apply for their declared `authMode`/`deliveryMode`.
- Dependency: ADR-0003 (`RequestGate`) consumes `RateLimitConfig`/per-model limits produced here.
- Dependency: ADR-0028 governs credential ownership for both connector kinds (tenant-owned tier-2 for `AIProviderConnector`, ownership-tier-aware generally).
- Dependency: ADR-0009 (connector health derived, not stored) consumes connector-reported error signals.
- Dependency: Epic 2 stories implement each concrete connector against this contract.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What is the full eventual platform roster (X, Reddit, YouTube, LinkedIn, Meta) and in what order will each be added? | Product Owner | Tracked per-platform via its own ADR at build time (per §10 of the design spec) |
| Q2 | Will a future provider category (beyond social/AI) require a third `ProviderConnector` specialization? | Technical Lead | Revisit if/when such a category is proposed |

---

## 14. Appendix

- **Glossary:** see BRD-0002 §15 (`ProviderConnector`, `SocialConnector`, `AIProviderConnector`, `deliveryMode`, `authMode`, `RequestGate`).
- **Reference links:** `docs/adr/0002-unified-provider-connector-pattern.md`; `docs/project docs/Business-Requirements/BRD-0002-Unified-Provider-Connector-Pattern.md`; `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` (Story 2.1); `docs/adr/0003-per-tenant-per-provider-rate-limiting.md`; `docs/adr/0028-credential-creation-authority-scoped-by-ownership-tier.md`.
- **Feature design/deep research:** none found — BRD-0002 Appendix D confirms no dedicated `docs/product-research/feature-designs/` or `reports/` file exists for ADR-0002; the rationale is captured directly in the design spec (§3.1/§3.3) and the ADR.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0002/BRD-0002/Story 2.1 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
