---
name: provider-connector-framework
description: The shared ProviderConnector/SocialConnector/AIProviderConnector interfaces and connector registry for social-listening-core. Read this before implementing any real social platform or AI provider connector.
---

# Provider connector framework

## What this is

The unifying abstraction every social platform integration and every AI enrichment provider implements against: `ProviderConnector` (`src/connectors/types.ts`), specialized into `SocialConnector` (poll/push delivery, `normalize()`) and `AIProviderConnector` (`listModels`, per-model rate limits/capabilities, `analyze()`). `src/connectors/registry.ts` is where connectors register themselves; `src/connectors/rateLimitResolution.ts` resolves the effective rate limit for any connector; `src/connectors/requestGate.ts` enforces it, per `(tenantId, providerId)` — or `(tenantId, providerId, modelId)` for AI — never globally. It exists so adding a new platform or swapping the AI provider is additive (implement + register), never a change to shared pipeline code, and so one tenant's usage can never throttle another's.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0002 | Shared `ProviderConnector` base, specialized into `SocialConnector`/`AIProviderConnector`; new connectors are additive, no core pipeline edits | 2.1 |
| ADR-0003 | Rate limits enforced per `(tenantId, providerId)` (and per-model for AI) via a shared `RequestGate`; live header state takes priority over static config; exceeding the limit queues and retries, never drops | 2.2 |
| ADR-0006 | `SocialConnector` gains an optional `translateWatchlistQuery()` — see `.claude/skills/watchlist-matching/SKILL.md` for the matching mechanism built on it | 3.3 (types.ts touched, mechanism lives elsewhere) |

## Contracts that constrain this component

- `contracts/epic-2/story-2.1.provider-connector-framework.contract.test.ts` — the three interfaces' required shape; a poll-mode and a push-mode `SocialConnector` both normalize correctly with no delivery-mode-specific pipeline branching; two `AIProviderConnector`s (including one with differing per-model rate limits) both resolve through the same generic dispatcher; live parsed rate-limit headers take priority over static declared config.
- `contracts/epic-2/story-2.2.per-tenant-rate-limiting.contract.test.ts` — two tenants on the same platform are gated independently; live headers win over static config in enforcement, not just resolution; a request past the limit is queued and retried after window reset, never dropped; AI requests are gated per model, not per provider.

## How to extend this safely

- **Implementing a real social platform connector** (RSS/News, Reddit, ...): implement `SocialConnector` from `types.ts`, register it via `registerSocialConnector()`, and don't touch `registry.ts`, `rateLimitResolution.ts`, or `requestGate.ts` — if you find yourself needing to, that's a sign the new connector needs a capability the shared interface doesn't have yet, which is a scope decision to surface explicitly (per ADR-0002's Negative consequences), not to work around locally.
- **Implementing a real AI provider connector** (Azure AI Language, ...): same pattern via `AIProviderConnector`/`registerAIProviderConnector()`.
- **`src/connectors/examples/*.ts`** are reference/test-fixture connectors proving the framework generalizes (this story's own AC4 verification mechanism) — not real platform integrations. A real connector lives in its own file (e.g. `src/connectors/rss/rssConnector.ts`, once Phase 1's RSS work lands), not in `examples/`.
- **Gating an outbound request:** call `acquireForProvider(tenantId, connector, liveHeaders?)` (social) or `acquireForAiModel(tenantId, connector, modelId, liveHeaders?)` (AI) before making the actual platform/model call — never call a connector's own HTTP logic without going through the gate first.

## Load-bearing constraints — do not change casually

- **`resolveRateLimitConfig()`, `requestGate.ts`, and any future shared orchestration function must never branch on a specific `providerId`.** The moment a pipeline function needs an `if (providerId === 'reddit')`, ADR-0002's "additive, no pipeline edits" guarantee is broken — that need belongs inside the connector's own implementation (e.g., a smarter `parseRateLimitHeaders()`), not the shared dispatcher/gate.
- **`parseRateLimitHeaders` stays optional.** Not every platform reports live rate-limit state; `resolveRateLimitConfig` falls back to the declared `RateLimitConfig` when a connector doesn't implement it or no live headers are given. Don't make it required — that would force connectors without this capability to fake one.
- **`RequestGate` has no reject/drop code path — only wait-and-retry.** ADR-0003 requires exceeding the limit to queue and retry after window reset, never drop silently; this is structural (there is no `throw`/rejection branch in `acquireOnce`), not a policy an incoming change could accidentally weaken by adding one without noticing the guarantee it breaks.
- **Per-key acquisitions are serialized (`withKeyLock`)** so concurrent callers never race on a shared bucket's `remaining` counter across an `await` boundary (the window-reset wait). Removing this serialization would reopen exactly the race it exists to close — see `requestGate.ts`'s own comment.
- **The registry and gate state are both simple in-memory structures, not persisted.** `__resetRegistryForTests()`/`__resetGateForTests()` exist solely for test isolation between contract files — never call either from non-test code. Distributed gate state across more than one process instance is Story 2.4 (ADR-0020), explicitly deferred, not built here.

## Known gaps / deferred work

- No real connector exists yet — `examples/` fixtures only. RSS/News (Phase 1's first real connector) needs `Author` (Story 3.1), `IngestionRun` (Story 3.2), and watchlist matching (Story 3.3) to have somewhere to normalize *into*; those land before or alongside the real connector, not as part of this story.
- `SocialConnector.getAuthHeaders?()` is a minimal, `authMode`-agnostic hook — no real OAuth token-exchange flow exists yet (that's a specific connector's concern once one needs it, likely Reddit or a later OAuth-capable platform, not RSS/News which is API-key-only per spec §10).
- Bounded queue depth/TTL and dead-lettering (Story 2.4, ADR-0020, Blocked pending acceptance) aren't built — `RequestGate` currently waits unboundedly for a window reset, with no queue-depth ceiling or per-request TTL yet.
- Retryable-error classification around a gate wait (Story 2.3) isn't built — this story only gates the request itself, not what happens if the eventual platform call still fails.
