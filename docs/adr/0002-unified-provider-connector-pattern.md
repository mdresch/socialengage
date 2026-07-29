# ADR-0002: Unified `ProviderConnector` contract for social platforms and AI providers

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §3.1 "Generalized Provider Connector Pattern". The `deliveryMode` rationale in Consequences is additionally sourced from the chat conversation that produced the spec (https://claude.ai/share/c7015a31-d8c9-4927-b394-f7fe9130f0be) — see "Note on provenance" at the end.

## Context

The system must integrate with a growing, open-ended set of social platforms (X, Reddit, YouTube, LinkedIn, Meta, RSS/News, Newswire — per §10) and must also support swapping the AI enrichment provider (Azure AI Language today; OpenAI, Claude, or others later, per §2 and §3.1). Both kinds of integration share the same underlying concerns: authenticating, discovering what's available, respecting a provider-imposed rate limit, and executing a request.

## Decision

Define a shared base contract, `ProviderConnector` (`providerId`, `authMode`, `getRateLimitConfig()`, optional `parseRateLimitHeaders()`), and specialize it into `SocialConnector` (poll/push delivery, OAuth/API-key auth, `normalize()`) and `AIProviderConnector` (`listModels`, `getModelRateLimit`, `getModelCapabilities`, `analyze`). Adding a new platform or AI provider means implementing the relevant interface and registering it — no changes to the core pipeline (§3.3).

## Consequences

**Positive**
- Rate limiting, credential handling, and health derivation are written once against the shared contract and apply uniformly to every platform and every AI provider, including ones added later.
- AI providers become swappable using the exact same registration mechanism as social platforms, directly satisfying the "swappable AI provider" requirement in §1.
- New connectors are additive (implement + register), which keeps the core pipeline stable as the platform list grows from the current open question in §10.
- `deliveryMode: 'push' | 'poll'` being a per-connector declared property, rather than a system-wide assumption, reflects a real constraint identified during design: *"Not every platform gives you a choice — X's filtered stream API supports real-time, Meta has webhook subscriptions for pages, but Reddit, YouTube, and most RSS/newswire feeds simply don't offer push at all."* Because the ingestion core dispatches generically on `deliveryMode` rather than hardcoding which platforms get which treatment, it never has to commit to an all-push or all-poll posture that wouldn't match what platforms actually support.

**Negative**
- The shared contract has to accommodate real differences between social platforms (push vs. poll delivery, webhook payloads) and AI providers (per-model rate limits and capabilities), which pushes some optionality into the interfaces (e.g., most `SocialConnector` methods are optional depending on `deliveryMode`/`authMode`). This trades a small amount of type-safety for uniformity.
- A connector author must still understand which optional methods apply to their specific platform/provider; the interface alone doesn't fully constrain valid implementations.
- The base contract's unifying assumption — rate limits belong to a provider (`getRateLimitConfig()`) — already needed one exception at day one: AI providers' limits are typically per-*model*, not per-provider, so `AIProviderConnector` adds `getModelRateLimit(modelId)` one layer deeper (§3.2). This is a reasonable accommodation, not a flaw, but it means the "shared contract" isn't fully flat even at the rate-limiting level; see ADR-0003 for how the enforcement side (`RequestGate`) reflects this by keying AI-provider limits on `(tenantId, providerId, modelId)` instead of `(tenantId, providerId)`.

## Alternatives Considered

- **Separate, unrelated interfaces for social connectors and AI provider connectors** — simpler individual contracts, but duplicates rate-limiting and health-derivation logic across two parallel systems, and doesn't naturally support treating AI providers as swappable the same way social platforms are.
- **A single flat interface with no social/AI specialization** — maximally uniform, but forces every connector to expose irrelevant methods (e.g., `analyze()` on a social connector) and loses the type-level distinction between delivery-mode-based platforms and model-based AI providers.

## Note on provenance

Most of this ADR is sourced directly from Design Spec §3.1/§3.3, like the rest of ADR-0001–0015. One exception: the "not every platform gives you a choice" reasoning behind `deliveryMode` (Consequences, above) is not stated anywhere in the spec document — it's from the chat conversation that produced the spec (linked at the top). That conversation settled on a hybrid push/poll model with per-connector `deliveryMode`, but, same as the Postgres decision (ADR-0016), only the resulting field made it into the written spec — not the platform-by-platform reasoning behind it.
