# Business Requirements Document (BRD) — Rate-Limit Queue Bounds, Dead-Letter Handling, and Distributed Gate State

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Rate-Limit Queue Bounds, Dead-Letter Handling, and Distributed Gate State |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md, ../Business-Requirements/BRD-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0020-rate-limit-queue-bounds-and-distributed-gate-state.md and the business requirements in BRD-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md into functional design for **Rate Limit Queue Bounds And Distributed Gate State**.
**What problem are we solving?**  
ADR-0003 established that rate-limited requests are queued and retried, never dropped silently. However, it left the queue for a given `(tenantId, providerId)` unbounded in both time and count, with no policy for stale requests or repeatedly failing individual requests. It also left `RequestGate` state in local process memory, which silently breaks per-tenant, per-provider correctness the moment more than one `social-listening-core` instance can handle the same tenant-platform pair.

**Who is affected?**  
Platform operators running the core at any scale, tenants whose connectors can back up under over-quota conditions, backend engineers maintaining the gate, and tenant-admins who need visibility into why posts were skipped or refused.

**What is the proposed solution at a glance?**  
Bound every rate-limit queue by a 6-hour time-to-live and a 1,000-request depth ceiling; record every abandonment through the `IngestionRun` audit anchor. Route an individual request that fails 3 consecutive execution attempts to a dead-letter path, separate from connector-level auto-disable. Externalize `RequestGate` counters and queued requests to a shared, atomic store (Redis by default) so that the same rate limit is enforced regardless of which process instance handles a tenant's request.

**What business value do we expect?**  
No unbounded queue growth, no silent drops, no stale post delivery, protection of the worker pool from poisoned requests, and correct multi-instance rate-limit enforcement when the deployment grows beyond a single process.

---

### 2.2 Scope
**In scope:**
- A maximum time-in-queue (TTL) of 6 hours for queued rate-limited requests.
- A maximum queue depth of 1,000 pending requests per `(tenantId, providerId)`.
- Recording of TTL-based abandonment via `IngestionRun.postsSkipped` and `IngestionRun.errorSummary`.
- Rejection of new requests once the depth ceiling is reached, with an auditable record.
- Request-level dead-lettering after 3 consecutive execution failures for the same request.
- Storage of `RequestGate` state in a shared, atomic store (Redis by default) for correct multi-instance enforcement.
- Surfacing queue-depth rejection through the existing `ConnectorHealth` `degraded`/`failing` states, not a new status value.
- Flat numeric defaults for v1 (no per-platform tuning).

**Out of scope:**
- Per-platform variance of TTL, queue-depth, or dead-letter thresholds in v1.
- A new, dedicated `ConnectorHealth` status for queue-depth rejection.
- Building the Redis-backed distributed gate before a second concurrent `social-listening-core` instance is actually deployed.
- Connector-level auto-disable logic (handled by ADR-0010 / ADR-0023 / Story 2.3 / Story 2.5).
- Global rate limiting that is not scoped to a single tenant.

## 3. Context and Background
ADR-0003 established that requests exceeding a tenant-platform's rate limit are queued and retried after window reset, "never dropped silently." That ADR's own Negative consequences already acknowledge the gap: under sustained over-quota conditions, the queue for a given `(tenantId, providerId)` can grow without bound, and nothing in the design says how large it can get, how long a request can sit in it, or what happens to a request that keeps failing once it's finally dispatched.

Separately, nothing in ADR-0003 or the spec states where `RequestGate`'s state (current usage counters, queued requests) physically lives. If it's local to a single process's memory, correctness of "per `(tenantId, providerId)`" enforcement silently breaks the moment more than one process instance can handle requests for the same tenant-platform pair concurrently — a realistic scenario even at modest scale (e.g., a worker pool with more than one ingestion worker), not only under deliberate horizontal scaling.
**What problem are we solving?**  
ADR-0003 established that rate-limited requests are queued and retried, never dropped silently. However, it left the queue for a given `(tenantId, providerId)` unbounded in both time and count, with no policy for stale requests or repeatedly failing individual requests. It also left `RequestGate` state in local process memory, which silently breaks per-tenant, per-provider correctness the moment more than one `social-listening-core` instance can handle the same tenant-platform pair.

**Who is affected?**  
Platform operators running the core at any scale, tenants whose connectors can back up under over-quota conditions, backend engineers maintaining the gate, and tenant-admins who need visibility into why posts were skipped or refused.

**What is the proposed solution at a glance?**  
Bound every rate-limit queue by a 6-hour time-to-live and a 1,000-request depth ceiling; record every abandonment through the `IngestionRun` audit anchor. Route an individual request that fails 3 consecutive execution attempts to a dead-letter path, separate from connector-level auto-disable. Externalize `RequestGate` counters and queued requests to a shared, atomic store (Redis by default) so that the same rate limit is enforced regardless of which process instance handles a tenant's request.

**What business value do we expect?**  
No unbounded queue growth, no silent drops, no stale post delivery, protection of the worker pool from poisoned requests, and correct multi-instance rate-limit enforcement when the deployment grows beyond a single process.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate unbounded rate-limit queue growth | Queue depth per `(tenantId, providerId)` is capped and never exceeds the documented ceiling |
| 2 | Prevent delivery of stale queued requests | No queued request older than 6 hours is dispatched; all such abandonments are auditable |
| 3 | Protect the shared worker pool from poisoned requests | A single request is dead-lettered after 3 consecutive execution failures, not retried indefinitely |
| 4 | Maintain rate-limit correctness across process instances | Concurrent `social-listening-core` instances enforce the same `(tenantId, providerId)` limits |
| 5 | Preserve tenant visibility and auditability | Every abandonment, rejection, and dead-letter is recorded in an `IngestionRun` and surfaced in the connector detail view |

---

**Positive consequences (from ADR):**
**Positive**
- Directly closes the gap ADR-0003 already flagged as unresolved: queue growth is now bounded and monitorable, not an open-ended risk.
- Logging abandonment through `IngestionRun` means a tenant can see *why* a post never arrived (queue TTL exceeded) rather than it simply never showing up with no trace.
- Request-level dead-lettering protects the shared worker pool from one poisoned request degrading throughput for every tenant sharing that pool, independent of whether that tenant's connector ever crosses ADR-0010's auto-disable threshold.
- Externalizing gate state removes a hidden assumption (single-process-per-tenant) that the current design doesn't actually guarantee, closing a correctness gap that would otherwise surface unpredictably under load.

**Negative**
- Introduces a new operational dependency (Redis or equivalent) purely for rate-limit bookkeeping — a new component to run, monitor, and keep available, where none existed before.
- Three new numeric thresholds (TTL, queue depth, dead-letter count) are guesses at this stage, not derived from real traffic patterns — likely to need tuning once real tenant/platform volume exists.
- A rejected-at-capacity queue (depth ceiling) means a tenant can now experience "ingestion refused" during a sustained platform outage or rate-limit storm, which is a new user-visible failure mode that needs surfacing in `ConnectorHealth`/the admin UI, not just logged internally.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall abandon any queued rate-limited request that has waited longer than 6 hours and record the abandonment | Must | `IngestionRun.postsSkipped` and `errorSummary` contain a clear reason; the request is not delivered | Technical Lead |
| BR-002 | The system shall reject new requests once a `(tenantId, providerId)` queue reaches 1,000 pending entries | Must | New requests are not added beyond 1,000; each rejection is recorded and auditable | Technical Lead |
| BR-003 | The system shall dead-letter an individual request after 3 consecutive execution failures | Must | The request is no longer retried; the dead-letter is auditable and distinct from connector auto-disable | Technical Lead |
| BR-004 | The system shall support externalizing `RequestGate` counters and queued state to a shared, atomic store (Redis default) for multi-instance correctness | Should for single-instance; Must for any multi-instance deployment | A contract test with two concurrent instances proves the same `(tenantId, providerId)` limit is enforced | Technical Lead |
| BR-005 | Queue-depth rejection shall surface through existing `ConnectorHealth` `degraded`/`failing` states, not a new status | Must | No new top-level `ConnectorHealth` enum is introduced; the reason is visible in the connector detail view | Technical Lead |
| BR-006 | Every abandonment, rejection, and dead-letter shall be visible to the tenant and not silently dropped | Must | The relevant `IngestionRun` or connector detail view contains the reason | Technical Lead |

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Queued requests are bounded in both time and count, not infinite: a request that cannot be dispatched within a maximum time-in-queue is abandoned rather than delivered stale, and a queue has a maximum depth beyond which new requests are rejected outright rather than queued. Abandonment is always recorded through the `IngestionRun` that would have consumed the request (as `postsSkipped` / a specific `errorSummary`), consistent with ADR-0005's "immutable audit anchor" — this is what keeps a bounded queue consistent with ADR-0003's "never dropped silently": a logged, auditable abandonment is not a silent drop.

Separately: requests that fail repeatedly once actually dispatched (not while waiting in the rate-limit queue) route to a dead-letter path, distinct from the queue-bound mechanism above and distinct from ADR-0010's connector-level auto-disable — this operates at individual-request granularity to stop a single poisoned request from repeatedly consuming worker capacity, whereas ADR-0010 acts on the aggregate failure pattern for a whole tenant-platform pair.

`RequestGate` state must live in storage shared and visible across every process instance capable of handling a given tenant's ingestion — not in a single process's local memory — since correctness of the per-`(tenantId, providerId)` limit depends on every instance observing the same counters, and nothing in the current design guarantees only one process ever handles a given tenant-platform pair.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Queue TTL: **6 hours**. Beyond this, a queued post is old enough that its "real-time" value has materially degraded; abandon and log rather than deliver.
- Max queue depth per `(tenantId, providerId)`: **1,000** pending requests, beyond which new requests are rejected immediately (a circuit-breaker ceiling) rather than added to an already-backed-up queue. *(This specific number is this ADR's own addition, not from the originating review, which named a TTL but not a depth bound — a TTL alone doesn't prevent unbounded queue growth during the TTL window if arrivals keep coming.)*
- Dead-letter threshold for an individual request: **3 consecutive execution failures** for that specific request, distinct from ADR-0010's 10-consecutive-run threshold for auto-disabling a connector entirely.
- Distributed gate backing store: **Redis**, using the sliding-window or token-bucket counters ADR-0003 already names as supported strategies — chosen for low-latency atomic increment/read semantics, not architecturally mandated; any shared store with equivalent atomicity guarantees would satisfy the underlying requirement.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Runs the core and is responsible for multi-instance correctness | High | No hidden single-process assumptions; visibility into queue depth, abandonments, and dead-letters |
| Tenant-Admin | Manages connectors and needs to understand ingestion health | Medium | Clear reasons when posts are skipped or refused; no silent data loss |
| Core Backend Engineer | Implements and maintains the `RequestGate`, queues, and dead-letter path | High | Clear, testable contracts and bounded queue behavior |
| Tenant-User | Relies on continuous, accurate post ingestion | Low | Ingestion continues to flow; stale posts are not delivered hours later |
| Platform-Admin | Monitors cross-tenant platform health (secondary) | Medium | Cross-tenant queue depth and error rates without accessing tenant data |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.4 | epic-2-ingestion-connectors-and-rate-limits.md | As platform operator running `social-listening-core` across more than one process instance, I want queued rate-limited requests bounded by TTL and depth, ind... | A queued request older than its TTL (default 6 hours) is abandoned, not delivered, and the abandonment is recorded via the relevant `IngestionRun`'s `postsSk... |
| Story 5.18 | epic-5-security-isolation-and-messaging.md | As platform operator exposing the one unauthenticated-until-resolved endpoint in this project, I want sign-up attempts rate-limited by IP address and by veri... | A new, dedicated rate-limiting mechanism — structurally independent of `RequestGate` (ADR-0003/ADR-0020), which stays scoped to `(tenantId, providerId)` — re... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `RequestGate` queue entry | A pending outbound request keyed by `(tenantId, providerId)` (and `modelId` for AI), with enqueue timestamp and payload | `RequestGate` | Technical Lead | Internal |
| Queue depth per key | The count of pending entries for a `(tenantId, providerId)` pair | `RequestGate` | Technical Lead | Internal |
| `IngestionRun.postsSkipped` | Count of posts skipped in a poll attempt, including TTL abandonments and depth rejections | Ingestion pipeline | Technical Lead | Internal |
| `IngestionRun.errorSummary` | Structured reason string for skipped, rejected, or dead-lettered requests | Ingestion pipeline | Technical Lead | Internal |
| Dead-letter record | A request that exhausted 3 execution attempts, with reason and timestamp | Dead-letter handler | Technical Lead | Internal |
| `ConnectorHealth` state | Derived `degraded`/`failing` status carrying the queue-depth reason | Health derivation | Technical Lead | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A queued request older than the 6-hour TTL is abandoned and recorded; it is never dispatched stale. |
| BRU-002 | A queue for a given `(tenantId, providerId)` may not exceed 1,000 pending requests; new requests at the ceiling are rejected and recorded. |
| BRU-003 | A request that fails 3 consecutive execution attempts is dead-lettered and no longer retried, independent of the connector-level auto-disable threshold. |
| BRU-004 | Every abandonment, rejection, and dead-letter is recorded through the `IngestionRun` that would have consumed the request. |
| BRU-005 | Queue-depth rejection must fold into the existing `ConnectorHealth` `degraded`/`failing` states; no new top-level status is introduced for v1. |
| BRU-006 | `RequestGate` state for a `(tenantId, providerId)` pair must be visible and consistent across every `social-listening-core` instance that can handle that pair. |
| BRU-007 | Threshold defaults are flat across platforms for v1; per-platform variance must be logged in the ADR Amendment Log before implementation. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0003 — Per-tenant, per-provider rate limiting and `RequestGate` | Internal | Technical Lead | Already accepted |
| D-002 | ADR-0005 — `IngestionRun` as immutable audit anchor | Internal | Technical Lead | Already accepted |
| D-003 | ADR-0009 — `ConnectorHealth` derived not stored with `degraded`/`failing` states | Internal | Technical Lead | Already accepted |
| D-004 | ADR-0010 / ADR-0023 — Retryable/non-retryable errors and connector auto-disable | Internal | Technical Lead | Already accepted |
| D-005 | Story 2.2 — Per-tenant, per-provider rate limiting | Internal | Technical Lead | Ready |
| D-006 | Story 2.4 — Bounded queues, dead-lettering, and distributed gate state | Internal | Technical Lead | Ready |
| D-007 | Redis or an equivalent shared, atomic store | External / Internal | Platform Operator | When a second `social-listening-core` instance is deployed |

---

- The per-tenant `RequestGate` and `IngestionRun` audit mechanism from ADR-0003 and ADR-0005 are already in place.
- Queue bounds and dead-lettering are relevant even on a single instance once real traffic exists.
- Distributed `RequestGate` state is only required when more than one core instance can concurrently handle the same `(tenantId, providerId)`.
- Redis or an equivalent shared store with atomic increment/read semantics will be available when the distributed half is built.

**The durable decision — this is what would need superseding, not just amending:**

Queued requests are bounded in both time and count, not infinite: a request that cannot be dispatched within a maximum time-in-queue is abandoned rather than delivered stale, and a queue has a maximum depth beyond which new requests are rejected outright rather than queued. Abandonment is always recorded through the `IngestionRun` that would have consumed the request (as `postsSkipped` / a specific `errorSummary`), consistent with ADR-0005's "immutable audit anchor" — this is what keeps a bounded queue consistent with ADR-0003's "never dropped silently": a logged, auditable abandonment is not a silent drop.

Separately: requests that fail repeatedly once actually dispatched (not while waiting in the rate-limit queue) route to a dead-letter path, distinct from the queue-bound mechanism above and distinct from ADR-0010's connector-level auto-disable — this operates at individual-request granularity to stop a single poisoned request from repeatedly consuming worker capacity, whereas ADR-0010 acts on the aggregate failure pattern for a whole tenant-platform pair.

`RequestGate` state must live in storage shared and visible across every process instance capable of handling a given tenant's ingestion — not in a single process's local memory — since correctness of the per-`(tenantId, providerId)` limit depends on every instance observing the same counters, and nothing in the current design guarantees only one process ever handles a given tenant-platform pair.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- Queue TTL: **6 hours**. Beyond this, a queued post is old enough that its "real-time" value has materially degraded; abandon and log rather than deliver.
- Max queue depth per `(tenantId, providerId)`: **1,000** pending requests, beyond which new requests are rejected immediately (a circuit-breaker ceiling) rather than added to an already-backed-up queue. *(This specific number is this ADR's own addition, not from the originating review, which named a TTL but not a depth bound — a TTL alone doesn't prevent unbounded queue growth during the TTL window if arrivals keep coming.)*
- Dead-letter threshold for an individual request: **3 consecutive execution failures** for that specific request, distinct from ADR-0010's 10-consecutive-run threshold for auto-disabling a connector entirely.
- Distributed gate backing store: **Redis**, using the sliding-window or token-bucket counters ADR-0003 already names as supported strategies — chosen for low-latency atomic increment/read semantics, not architecturally mandated; any shared store with equivalent atomicity guarantees would satisfy the underlying requirement.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Queue bounds must preserve per-tenant, per-provider isolation | Security / Reliability | Must | One tenant's queue overflow does not affect another tenant's queue for the same provider |
| NFR-002 | Abandonment and rejection records must be immutable and auditable | Reliability / Compliance | Must | Records are written to `IngestionRun` and are not updated after the fact |
| NFR-003 | Distributed gate state must support atomic increment/read and low-latency access | Performance | Must | Two concurrent instances cannot race on the same counter; gate lookup adds <10ms in normal conditions |
| NFR-004 | The system must expose queue depth, TTL abandonment count, dead-letter count, and capacity-rejection count | Maintainability | Should | Platform operator can query these per `(tenantId, providerId)` |
| NFR-005 | Numeric thresholds must be adjustable without superseding the ADR | Maintainability | Should | TTL, depth, and dead-letter count can be changed via documented configuration and Amendment Log |

---

## 11. Error Handling and Exceptions
**Positive**
- Directly closes the gap ADR-0003 already flagged as unresolved: queue growth is now bounded and monitorable, not an open-ended risk.
- Logging abandonment through `IngestionRun` means a tenant can see *why* a post never arrived (queue TTL exceeded) rather than it simply never showing up with no trace.
- Request-level dead-lettering protects the shared worker pool from one poisoned request degrading throughput for every tenant sharing that pool, independent of whether that tenant's connector ever crosses ADR-0010's auto-disable threshold.
- Externalizing gate state removes a hidden assumption (single-process-per-tenant) that the current design doesn't actually guarantee, closing a correctness gap that would otherwise surface unpredictably under load.

**Negative**
- Introduces a new operational dependency (Redis or equivalent) purely for rate-limit bookkeeping — a new component to run, monitor, and keep available, where none existed before.
- Three new numeric thresholds (TTL, queue depth, dead-letter count) are guesses at this stage, not derived from real traffic patterns — likely to need tuning once real tenant/platform volume exists.
- A rejected-at-capacity queue (depth ceiling) means a tenant can now experience "ingestion refused" during a sustained platform outage or rate-limit storm, which is a new user-visible failure mode that needs surfacing in `ConnectorHealth`/the admin UI, not just logged internally.

## 12. Assumptions and Dependencies
- The per-tenant `RequestGate` and `IngestionRun` audit mechanism from ADR-0003 and ADR-0005 are already in place.
- Queue bounds and dead-lettering are relevant even on a single instance once real traffic exists.
- Distributed `RequestGate` state is only required when more than one core instance can concurrently handle the same `(tenantId, providerId)`.
- Redis or an equivalent shared store with atomic increment/read semantics will be available when the distributed half is built.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Sustained over-quota conditions cause queue-depth rejections and tenant-visible ingestion refusal | Medium | Medium | Monitor queue depth; surface clear reasons in `ConnectorHealth`; tune thresholds once real traffic exists | Technical Lead |
| R-002 | The 6-hour / 1,000-request / 3-failure defaults are guesses and may be mis-tuned for real traffic | Medium | Medium | Make thresholds configurable and log changes in the Amendment Log; tune after launch | Technical Lead |
| R-003 | The Redis-backed distributed gate adds a new operational dependency | Medium | Medium | Defer until a second instance is deployed; choose a managed offering and document runbooks | Platform Operator |
| R-004 | A valid but transient request is misclassified as poisoned and dead-lettered | Low | Medium | Count only execution failures for the same specific request; exclude rate-limit and network blips; support manual replay | Technical Lead |
| R-005 | Multi-instance gate state introduces consistency or latency bugs | Low | High | Use a store with atomic increment/read semantics; contract-test with two concurrent instances | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md`
- BRD: `../Business-Requirements/BRD-0020-Rate-Limit-Queue-Bounds-And-Distributed-Gate-State.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above