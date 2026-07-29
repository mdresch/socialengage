# ADR-0022: Derived-data caching and refresh strategy (`ConnectorHealth` read cache, `AuthorTopicSignal` refresh cadence)

**Status:** Accepted (2026-07-29) — see Acceptance note below
**Source:** Not specified in the design spec. Flagged in ADR-0009's own Negative consequences ("may warrant caching if `GET /connectors` is polled frequently") and ADR-0007's own text ("refresh cadence isn't specified here and needs to be decided during implementation"), expanded on in a third-party architectural review. This ADR originates the policy; it does not document a prior decision.
**Acceptance note:** accepted with both numbers unchanged — 60-second `ConnectorHealth` cache TTL and hourly `AuthorTopicSignal` refresh. The 60s figure is a status indicator's staleness, not an input to any automated decision (auto-disable logic reads `IngestionRun` directly, not the cache), so it's acceptable as-is; a `?fresh=true` bypass param for troubleshooting is a cheap optional addition, not required for acceptance. Hourly `AuthorTopicSignal` refresh stands: "an expert isn't created in an hour" describes the *signal's* semantics (it should aggregate over a long window), not how often it's safe to recompute that aggregate — hourly just bounds staleness of a long-window value, cheaply, via `pg_cron`. In-process cache locality for `ConnectorHealth` is accepted as-is too: single-instance is the real deployment shape right now, and this ADR's own analysis already shows cross-instance display inconsistency (not incorrectness) is the only cost — no Redis dependency taken on for this until multi-instance is real. See the Amendment Log.

## Context

Two pieces of derived data have an unresolved freshness/performance question, for different reasons:

- **`ConnectorHealth`** (ADR-0009) is deliberately *not* stored — it's computed from `IngestionRun` history at read time, specifically so there is exactly one source of truth with no drift risk. That ADR's own Negative consequences already note this means every health read does aggregation work, and flags caching as a likely future need "if `GET /connectors` is polled frequently."
- **`AuthorTopicSignal`** (ADR-0007) is explicitly a periodically-refreshed materialized view, not a live query — but no refresh cadence was ever decided; ADR-0007 states outright that this "needs to be decided during implementation."

These are different mechanisms (a read cache in front of a derived value, vs. a scheduled materialized-view refresh) but the same underlying question: how fresh does derived data need to be, and what's the cheapest way to keep it that fresh without reintroducing the drift risk ADR-0009 specifically designed around.

**The constraint this ADR must respect:** any caching layer for `ConnectorHealth` must not become a second, independently-updatable copy of health state. ADR-0009's entire rationale is "no possibility of drift" because nothing is stored — a cache that's updated by anything other than recomputing from `IngestionRun` would quietly reintroduce the exact problem ADR-0009 exists to avoid.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

Both `AuthorTopicSignal` and `ConnectorHealth` get periodic-refresh treatment rather than always-live computation on every request, because neither needs second-by-second accuracy — `AuthorTopicSignal` by explicit design intent (the original design conversation: "an expert is not created in an hour"), `ConnectorHealth` because it's a status indicator, not a transactional read. For `ConnectorHealth` specifically: the cache is strictly a time-bounded snapshot of the same derivation ADR-0009 defines, rebuildable at any time from `IngestionRun` with no other state to reconcile — never a value updated by any path other than recomputation. A cache flush is always safe, never lossy, and never a source of truth in its own right.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **`AuthorTopicSignal`**: refreshed via a scheduled background job every **1 hour**, using `pg_cron` (keeps the refresh logic in the database layer rather than requiring a separate scheduling service to run and monitor).
- **`ConnectorHealth`**: a read-through cache with a **60-second TTL** — recomputed from `IngestionRun` on cache miss or expiry. No explicit invalidation on `IngestionRun` write; the TTL alone bounds staleness to at most 60 seconds, which is an acceptable tolerance for a status indicator and avoids the complexity of wiring cache invalidation into every code path that writes an `IngestionRun`.
- **Cache locality: in-process (per-instance), not shared/Redis-backed.** This is deliberately different from ADR-0020's `RequestGate` state, and for a specific reason: `RequestGate` correctness *requires* every process instance to see the same counters, or rate-limit enforcement is actually wrong (a tenant could exceed a platform's declared limit). `ConnectorHealth` has no equivalent correctness requirement — every instance can independently recompute the exact same value straight from `IngestionRun` at any time, so an in-process cache never risks *incorrectness*, only brief cross-instance display inconsistency (two instances might show a status computed a few seconds apart, both individually correct). Given that, this read shouldn't take on a hard dependency on Redis being available just because Redis exists elsewhere in the system for a different, correctness-critical reason — `GET /connectors` should keep working (just slower) through a Redis outage.

## Consequences

**Positive**
- Closes both gaps ADR-0007 and ADR-0009 already flagged as open, with a mechanism that's proportionate to how fresh each actually needs to be.
- Preserves ADR-0009's core property: the cache is provably reconstructable from `IngestionRun` alone at any moment, so "single source of truth" still holds — the cache is an optimization, not a second fact.
- `pg_cron` for `AuthorTopicSignal` avoids introducing a new scheduling service just for one periodic job.

**Negative**
- A `ConnectorHealth` read can be up to 60 seconds stale — acceptable for a status indicator, but worth being explicit that `GET /connectors` is no longer a strictly live view, which is a small behavior change from what ADR-0009 implies (a live-computed derivation) even though the underlying derivation logic doesn't change.
- Two different refresh mechanisms (TTL-based read cache vs. scheduled materialized-view refresh) for two pieces of derived data adds a small amount of conceptual overhead — a future reader needs to know which pattern applies to which entity rather than one uniform rule.
- Both numbers (1 hour, 60 seconds) are guesses, not derived from any stated requirement or real read-frequency data.
- With an in-process cache and more than one `social-listening-core` instance, two simultaneous `GET /connectors` calls hitting different instances can show slightly different results within the same TTL window (e.g., one instance's cache just refreshed, another's is about to expire). Both are individually correct derivations at their own computation time — this is display inconsistency, not a correctness bug — but it's a real, user-visible property worth stating explicitly rather than discovering in a bug report.

## Alternatives Considered

- **Invalidate-on-write instead of TTL for `ConnectorHealth`** — would give always-fresh reads, but requires wiring cache invalidation into every path that writes an `IngestionRun` (poll completion, webhook handling, retry logic), adding coupling for a value where 60 seconds of staleness is already acceptable.
- **Live computation always, no cache** — status quo; rejected only because ADR-0009 already flagged the performance concern as real, not because live computation is wrong in principle.
- **Shared/Redis-backed cache for `ConnectorHealth`** (reusing ADR-0020's Redis instance) — would eliminate the cross-instance display inconsistency noted above, at the cost of making a read that doesn't need strong consistency dependent on a component (Redis) whose availability then matters for a code path that would otherwise degrade gracefully to slightly-slower-but-still-correct Postgres reads. Rejected as the default for that reason; worth revisiting if cross-instance inconsistency turns out to matter more in practice than expected.
- **Event-driven `AuthorTopicSignal` refresh** (recompute on every matching post ingested) — most accurate, but directly contradicts the "expertise isn't built in an hour" design intent from the original conversation, and would be far more expensive at ingestion volume than a periodic batch refresh.

## Open questions for decision

- ~~Is 60 seconds the right `ConnectorHealth` staleness tolerance, or does the admin UI's connector-status view need tighter freshness?~~ **Resolved at acceptance:** yes, keep 60s — it's a status indicator, not an input to any automated decision. A `?fresh=true` bypass param for troubleshooting is optional, not required.
- ~~Is hourly sufficient for `AuthorTopicSignal`, or should it be daily given the "sustained engagement over years" framing from the original design discussion?~~ **Resolved at acceptance:** keep hourly — that framing describes the signal's aggregation window, not its safe recompute cadence; hourly just bounds staleness of that long-window aggregate, cheaply, via `pg_cron`.
- ~~Is in-process cache locality actually acceptable, or does the admin UI need a single consistent view regardless of which `social-listening-core` instance serves a given request?~~ **Resolved at acceptance:** yes, in-process is acceptable — single-instance is the real deployment shape now, and the only cost is cross-instance display inconsistency (not incorrectness); don't take on a Redis dependency for this until multi-instance is real.

## Amendment Log

- 2026-07-28 — Initial proposal: `AuthorTopicSignal` hourly via `pg_cron`; `ConnectorHealth` 60-second TTL read-through cache.
- 2026-07-28 — Added explicit cache-locality decision after a review round flagged it as unspecified: `ConnectorHealth` cache is in-process, not Redis/shared, distinguishing it from ADR-0020's correctness-critical `RequestGate` state.
- 2026-07-29 — Accepted: both numbers (60s TTL, hourly refresh) and in-process cache locality confirmed as-is; optional `?fresh=true` bypass noted as a cheap, non-required addition.
