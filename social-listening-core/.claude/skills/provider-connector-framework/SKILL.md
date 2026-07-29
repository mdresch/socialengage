---
name: provider-connector-framework
description: The shared ProviderConnector/SocialConnector/AIProviderConnector interfaces and connector registry for social-listening-core. Read this before implementing any real social platform or AI provider connector.
---

# Provider connector framework

## What this is

The unifying abstraction every social platform integration and every AI enrichment provider implements against: `ProviderConnector` (`src/connectors/types.ts`), specialized into `SocialConnector` (poll/push delivery, `normalize()`) and `AIProviderConnector` (`listModels`, per-model rate limits/capabilities, `analyze()`). `src/connectors/registry.ts` is where connectors register themselves; `src/connectors/rateLimitResolution.ts` is the first piece of genuinely generic "core ingestion orchestration" logic built on top of it. It exists so adding a new platform or swapping the AI provider is additive (implement + register), never a change to shared pipeline code.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0002 | Shared `ProviderConnector` base, specialized into `SocialConnector`/`AIProviderConnector`; new connectors are additive, no core pipeline edits | 2.1 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.1.provider-connector-framework.contract.test.ts` — the three interfaces' required shape; a poll-mode and a push-mode `SocialConnector` both normalize correctly with no delivery-mode-specific pipeline branching; two `AIProviderConnector`s (including one with differing per-model rate limits) both resolve through the same generic dispatcher; live parsed rate-limit headers take priority over static declared config.

## How to extend this safely

- **Implementing a real social platform connector** (RSS/News, Reddit, ...): implement `SocialConnector` from `types.ts`, register it via `registerSocialConnector()`, and don't touch `registry.ts` or `rateLimitResolution.ts` — if you find yourself needing to, that's a sign the new connector needs a capability the shared interface doesn't have yet, which is a scope decision to surface explicitly (per ADR-0002's Negative consequences), not to work around locally.
- **Implementing a real AI provider connector** (Azure AI Language, ...): same pattern via `AIProviderConnector`/`registerAIProviderConnector()`.
- **`src/connectors/examples/*.ts`** are reference/test-fixture connectors proving the framework generalizes (this story's own AC4 verification mechanism) — not real platform integrations. A real connector lives in its own file (e.g. `src/connectors/rss/rssConnector.ts`, once Phase 1's RSS work lands), not in `examples/`.
- **`resolveRateLimitConfig()`** is the first "core pipeline" consumer of the framework — Story 2.2's `RequestGate` builds on it next. Keep it dispatching purely on the `ProviderConnector`/`SocialConnector`/`AIProviderConnector` interfaces, never on a specific `providerId`.

## Load-bearing constraints — do not change casually

- **`resolveRateLimitConfig()` (and any future shared orchestration function) must never branch on a specific `providerId`.** The moment a pipeline function needs an `if (providerId === 'reddit')`, ADR-0002's "additive, no pipeline edits" guarantee is broken — that need belongs inside the connector's own implementation (e.g., a smarter `parseRateLimitHeaders()`), not the shared dispatcher.
- **`parseRateLimitHeaders` stays optional.** Not every platform reports live rate-limit state; `resolveRateLimitConfig` falls back to the declared `RateLimitConfig` when a connector doesn't implement it or no live headers are given. Don't make it required — that would force connectors without this capability to fake one.
- **The registry is a simple in-memory `Map`, not persisted.** `__resetRegistryForTests()` exists solely for test isolation between contract files that both register connectors under potentially-colliding `providerId`s — never call it from non-test code.

## Known gaps / deferred work

- No real connector exists yet — `examples/` fixtures only. RSS/News (Phase 1's first real connector) needs `Author` (Story 3.1), `IngestionRun` (Story 3.2), and watchlist matching (Story 3.3) to have somewhere to normalize *into*; those land before or alongside the real connector, not as part of this story.
- `SocialConnector.getAuthHeaders?()` is a minimal, `authMode`-agnostic hook — no real OAuth token-exchange flow exists yet (that's a specific connector's concern once one needs it, likely Reddit or a later OAuth-capable platform, not RSS/News which is API-key-only per spec §10).
- `RequestGate` (Story 2.2) is the next consumer of `resolveRateLimitConfig()` — this story only builds the resolution logic, not the enforcement/queuing built on top of it.
