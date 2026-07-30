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
| ADR-0020 | Queued requests are bounded by TTL and depth ceiling, not infinite; `RequestGate` state must eventually live in shared storage across process instances (deferred — see Known gaps) | 2.4 (queue-bound half only) |

## Contracts that constrain this component

- `contracts/epic-2/story-2.1.provider-connector-framework.contract.test.ts` — the three interfaces' required shape; a poll-mode and a push-mode `SocialConnector` both normalize correctly with no delivery-mode-specific pipeline branching; two `AIProviderConnector`s (including one with differing per-model rate limits) both resolve through the same generic dispatcher; live parsed rate-limit headers take priority over static declared config.
- `contracts/epic-2/story-2.2.per-tenant-rate-limiting.contract.test.ts` — two tenants on the same platform are gated independently; live headers win over static config in enforcement, not just resolution; a request past the limit is queued and retried after window reset, never dropped; AI requests are gated per model, not per provider.
- `contracts/epic-2/story-2.4.bounded-queues-and-dead-lettering.contract.test.ts` — a gate wait exceeding its TTL abandons with `QueueTtlExceededError` rather than waiting forever; a queue at its depth ceiling rejects a new request immediately with `QueueDepthExceededError`, without affecting requests already under the ceiling.

## How to extend this safely

- **Implementing a real social platform connector** (RSS/News, Reddit, ...): implement `SocialConnector` from `types.ts`, register it via `registerSocialConnector()`, and don't touch `registry.ts`, `rateLimitResolution.ts`, or `requestGate.ts` — if you find yourself needing to, that's a sign the new connector needs a capability the shared interface doesn't have yet, which is a scope decision to surface explicitly (per ADR-0002's Negative consequences), not to work around locally.
- **Implementing a real AI provider connector** (Azure AI Language, ...): same pattern via `AIProviderConnector`/`registerAIProviderConnector()`.
- **`src/connectors/examples/*.ts`** are reference/test-fixture connectors proving the framework generalizes (this story's own AC4 verification mechanism) — not real platform integrations. A real connector lives in its own file (e.g. `src/connectors/rss/rssConnector.ts`, once Phase 1's RSS work lands), not in `examples/`.
- **Gating an outbound request:** call `acquireForProvider(tenantId, connector, liveHeaders?)` (social) or `acquireForAiModel(tenantId, connector, modelId, liveHeaders?)` (AI) before making the actual platform/model call — never call a connector's own HTTP logic without going through the gate first.

## Load-bearing constraints — do not change casually

- **`resolveRateLimitConfig()`, `requestGate.ts`, and any future shared orchestration function must never branch on a specific `providerId`.** The moment a pipeline function needs an `if (providerId === 'reddit')`, ADR-0002's "additive, no pipeline edits" guarantee is broken — that need belongs inside the connector's own implementation (e.g., a smarter `parseRateLimitHeaders()`), not the shared dispatcher/gate.
- **`parseRateLimitHeaders` stays optional.** Not every platform reports live rate-limit state; `resolveRateLimitConfig` falls back to the declared `RateLimitConfig` when a connector doesn't implement it or no live headers are given. Don't make it required — that would force connectors without this capability to fake one.
- **`RequestGate` bounds a wait by TTL and depth ceiling (Story 2.4, ADR-0020) — it still never blindly drops a request that's within bounds.** Exceeding the rate limit itself still queues and retries after window reset (ADR-0003, unchanged); only a wait that's actually exceeded its TTL, or arrives when the queue is already at its depth ceiling, ends in a thrown `QueueTtlExceededError`/`QueueDepthExceededError` — a logged, auditable abandonment (once a real connector reclassifies and records it via `runIngestionAttempt`), not a silent one. Don't add a reject/drop path for merely exceeding the rate limit itself — that guarantee (ADR-0003) is unchanged.
- **Per-key acquisitions are serialized (`withKeyLock`)** so concurrent callers never race on a shared bucket's `remaining` counter across an `await` boundary (the window-reset wait). Removing this serialization would reopen exactly the race it exists to close — see `requestGate.ts`'s own comment.
- **The registry and gate state (including the new queue-depth counter) are all simple in-memory structures, not persisted.** `__resetRegistryForTests()`/`__resetGateForTests()` exist solely for test isolation between contract files — never call either from non-test code. Distributed gate state across more than one process instance (Story 2.4's other half) is explicitly deferred, not built here — see Known gaps.

## Known gaps / deferred work

- **RSS/News still has no real connector implementation** — Phase 1's first real connector (per spec §10's platform order) remains "also build, not storied" work. The Newswire connector (Story 2.6, ADR-0024) shipped first — architecturally out of order relative to spec §10's platform priority, but explicitly sanctioned that way by ADR-0024's own Context section (it only selects a provider/modeling approach ahead of when a Story would build it, the same ahead-of-schedule pattern ADR-0017/0019 used). See `.claude/skills/newswire-connector/SKILL.md` for the first real, non-`examples/`-fixture `SocialConnector`.
- `SocialConnector.getAuthHeaders?()` is a minimal, `authMode`-agnostic hook — no real OAuth token-exchange flow exists yet (that's a specific connector's concern once one needs it, likely Reddit or a later OAuth-capable platform; Newswire is `authMode: 'none'`, RSS/News is API-key-only per spec §10 — neither needs this hook either).
- **Distributed (Redis-backed) `RequestGate` state across more than one `social-listening-core` process instance (Story 2.4's other half, ADR-0020) is deliberately not built.** ADR-0020's own 2026-07-29 Amendment Log entry and `docs/implementation-plan.md`'s Phase 4 solo-project note both say this is only load-bearing once a second concurrent instance actually runs — a single-instance in-process gate (already built) satisfies ADR-0003 correctly on its own. Build it when that need is real, not speculatively; it may be the last story in the whole plan to actually land, or never.
- **A real connector now calls `acquireForProvider()` (Story 2.6's Newswire connector, before each feed fetch) and reclassifies its gate-exhaustion errors,** per this SKILL.md's own prescribed pattern (see "How to extend this safely" in `connector-health-and-error-handling`'s SKILL.md): a `QueueTtlExceededError`/`QueueDepthExceededError` from `acquireForProvider()` becomes `ClassifiableError('queue_ttl_exceeded' | 'queue_depth_exceeded', ...)` before it can reach `runIngestionAttempt()` (see `pollNewswireFeeds.ts`'s `gatedAcquire()`). Not independently exercised by Story 2.6's own contract — under the default queue bounds (6h TTL, 1,000 depth) a single low-volume connector's test run never actually exhausts them; Story 2.4's own contract already proves the reclassification pattern in the abstract via a synthetic `attempt()`.
