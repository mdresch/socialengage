# ADR-0003: Rate limiting enforced per `(tenantId, providerId)` via a shared `RequestGate`

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §3.2 "Rate Limiting"

## Context

Each tenant connects platforms and AI providers using their own credentials, so each tenant carries independent, platform-imposed rate limits (X's per-tier windows, YouTube's daily quota-cost model, Reddit's per-minute cap, and per-model limits for AI providers). A shared enforcement point is needed so one tenant's usage can't affect another's, and so limits reflect what each platform actually documents rather than values invented by the core.

## Decision

- Every connector declares its own limits via `getRateLimitConfig()`, reflecting the platform's documented limits only.
- A shared `RequestGate` in the core enforces limits **per `(tenantId, providerId)`**, never globally.
- Where a platform returns live rate-limit state in response headers, `parseRateLimitHeaders()` updates the gate's live state, which takes priority over the static declared config.
- Requests that would exceed the limit are **queued and retried after window reset**, never dropped silently.
- AI providers extend this one level deeper: limits are enforced per-model via `getModelRateLimit(modelId)`, not just per-provider.

## Consequences

**Positive**
- Rate-limit isolation directly satisfies the multi-tenancy requirement in §8: one tenant's usage never throttles another's, even though all tenants may be hitting the same third-party platform.
- Preferring live header state over static config means the gate adapts to a platform tightening or loosening its limits without a code change.
- Queue-and-retry (rather than drop) means transient rate-limit hits don't silently lose data — consistent with the retryable-error handling in §5.

**Negative**
- A queued request that waits for window reset adds latency to that tenant's ingestion; under sustained over-quota conditions, the queue for a given `(tenantId, providerId)` can grow and needs monitoring/backpressure that isn't detailed in this spec.
- Per-model limits for AI providers mean the gate's key space is effectively `(tenantId, providerId, modelId)` for enrichment traffic, which is more granular bookkeeping than social connectors need.

## Alternatives Considered

- **Global per-provider rate limiting (not tenant-scoped)** — simpler to reason about, but a single heavy tenant would throttle every other tenant sharing that platform, violating the per-tenant isolation goal in §8.
- **Drop requests that exceed the limit instead of queuing** — avoids unbounded queue growth, but silently loses ingestion data, which conflicts with the design's general stance that failures should be visible, not silent (§5 error handling).
