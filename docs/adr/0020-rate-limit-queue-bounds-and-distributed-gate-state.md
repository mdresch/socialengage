# ADR-0020: Rate-limit queue bounds, dead-letter handling, and distributed gate state

**Status:** Proposed (2026-07-28) — awaiting decision, not yet accepted
**Source:** Not specified in the design spec. Flagged in ADR-0003's own Negative consequences ("needs monitoring/backpressure that isn't detailed in this spec") and expanded on in a third-party architectural review. This ADR originates the policy; it does not document a prior decision.

## Context

ADR-0003 established that requests exceeding a tenant-platform's rate limit are queued and retried after window reset, "never dropped silently." That ADR's own Negative consequences already acknowledge the gap: under sustained over-quota conditions, the queue for a given `(tenantId, providerId)` can grow without bound, and nothing in the design says how large it can get, how long a request can sit in it, or what happens to a request that keeps failing once it's finally dispatched.

Separately, nothing in ADR-0003 or the spec states where `RequestGate`'s state (current usage counters, queued requests) physically lives. If it's local to a single process's memory, correctness of "per `(tenantId, providerId)`" enforcement silently breaks the moment more than one process instance can handle requests for the same tenant-platform pair concurrently — a realistic scenario even at modest scale (e.g., a worker pool with more than one ingestion worker), not only under deliberate horizontal scaling.

## Decision

**The durable decision — this is what would need superseding, not just amending:**

Queued requests are bounded in both time and count, not infinite: a request that cannot be dispatched within a maximum time-in-queue is abandoned rather than delivered stale, and a queue has a maximum depth beyond which new requests are rejected outright rather than queued. Abandonment is always recorded through the `IngestionRun` that would have consumed the request (as `postsSkipped` / a specific `errorSummary`), consistent with ADR-0005's "immutable audit anchor" — this is what keeps a bounded queue consistent with ADR-0003's "never dropped silently": a logged, auditable abandonment is not a silent drop.

Separately: requests that fail repeatedly once actually dispatched (not while waiting in the rate-limit queue) route to a dead-letter path, distinct from the queue-bound mechanism above and distinct from ADR-0010's connector-level auto-disable — this operates at individual-request granularity to stop a single poisoned request from repeatedly consuming worker capacity, whereas ADR-0010 acts on the aggregate failure pattern for a whole tenant-platform pair.

`RequestGate` state must live in storage shared and visible across every process instance capable of handling a given tenant's ingestion — not in a single process's local memory — since correctness of the per-`(tenantId, providerId)` limit depends on every instance observing the same counters, and nothing in the current design guarantees only one process ever handles a given tenant-platform pair.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Queue TTL: **6 hours**. Beyond this, a queued post is old enough that its "real-time" value has materially degraded; abandon and log rather than deliver.
- Max queue depth per `(tenantId, providerId)`: **1,000** pending requests, beyond which new requests are rejected immediately (a circuit-breaker ceiling) rather than added to an already-backed-up queue. *(This specific number is this ADR's own addition, not from the originating review, which named a TTL but not a depth bound — a TTL alone doesn't prevent unbounded queue growth during the TTL window if arrivals keep coming.)*
- Dead-letter threshold for an individual request: **3 consecutive execution failures** for that specific request, distinct from ADR-0010's 10-consecutive-run threshold for auto-disabling a connector entirely.
- Distributed gate backing store: **Redis**, using the sliding-window or token-bucket counters ADR-0003 already names as supported strategies — chosen for low-latency atomic increment/read semantics, not architecturally mandated; any shared store with equivalent atomicity guarantees would satisfy the underlying requirement.

## Consequences

**Positive**
- Directly closes the gap ADR-0003 already flagged as unresolved: queue growth is now bounded and monitorable, not an open-ended risk.
- Logging abandonment through `IngestionRun` means a tenant can see *why* a post never arrived (queue TTL exceeded) rather than it simply never showing up with no trace.
- Request-level dead-lettering protects the shared worker pool from one poisoned request degrading throughput for every tenant sharing that pool, independent of whether that tenant's connector ever crosses ADR-0010's auto-disable threshold.
- Externalizing gate state removes a hidden assumption (single-process-per-tenant) that the current design doesn't actually guarantee, closing a correctness gap that would otherwise surface unpredictably under load.

**Negative**
- Introduces a new operational dependency (Redis or equivalent) purely for rate-limit bookkeeping — a new component to run, monitor, and keep available, where none existed before.
- Three new numeric thresholds (TTL, queue depth, dead-letter count) are guesses at this stage, not derived from real traffic patterns — likely to need tuning once real tenant/platform volume exists.
- A rejected-at-capacity queue (depth ceiling) means a tenant can now experience "ingestion refused" during a sustained platform outage or rate-limit storm, which is a new user-visible failure mode that needs surfacing in `ConnectorHealth`/the admin UI, not just logged internally.

## Alternatives Considered

- **In-memory gate with sticky routing** (always route a given tenant's requests to the same process instance) — avoids needing external shared state, but constrains deployment topology (no free load-balancing across instances) and loses all gate state on a process restart, which a shared store doesn't.
- **Unbounded queue, status quo** — simplest, but is the exact problem this ADR exists to close.

## Open questions for decision

- Are 6 hours / 1,000 / 3 the right numbers, or should they vary by platform (a slow-moving RSS feed vs. a high-volume X watchlist)?
- Should queue-depth rejection surface as a distinct `ConnectorHealth` status, or fold into the existing `degraded`/`failing` states (ADR-0009)?

## Amendment Log

- 2026-07-28 — Initial proposal: 6-hour queue TTL, 1,000-request depth ceiling, 3-failure dead-letter threshold, Redis-backed distributed gate state.
- 2026-07-29 — Context note (not a change to the proposal): confirmed this is a solo-developer personal project. The distributed-gate-state half of this ADR is only load-bearing once more than one `social-listening-core` instance runs concurrently — a condition with no team-driven scaling pressure behind it here, and which may not arise for a long time, if ever. The queue-TTL/depth/dead-letter half is unaffected by this and remains relevant even single-instance. See `docs/implementation-plan.md` Phase 4.
