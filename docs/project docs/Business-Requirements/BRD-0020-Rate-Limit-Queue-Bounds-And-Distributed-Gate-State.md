# Business Requirements Document (BRD) — Rate-Limit Queue Bounds, Dead-Letter Handling, and Distributed Gate State

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Rate-Limit Queue Bounds and Distributed Gate State — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | Devin (AI BRD Writer Agent) |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Draft / Pending review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | Devin | Initial draft from ADR-0020, feature design `01-multi-source-ingestion.md`, and Story 2.4 |

---

## 2. Executive Summary

**What problem are we solving?**  
ADR-0003 established that rate-limited requests are queued and retried, never dropped silently. However, it left the queue for a given `(tenantId, providerId)` unbounded in both time and count, with no policy for stale requests or repeatedly failing individual requests. It also left `RequestGate` state in local process memory, which silently breaks per-tenant, per-provider correctness the moment more than one `social-listening-core` instance can handle the same tenant-platform pair.

**Who is affected?**  
Platform operators running the core at any scale, tenants whose connectors can back up under over-quota conditions, backend engineers maintaining the gate, and tenant-admins who need visibility into why posts were skipped or refused.

**What is the proposed solution at a glance?**  
Bound every rate-limit queue by a 6-hour time-to-live and a 1,000-request depth ceiling; record every abandonment through the `IngestionRun` audit anchor. Route an individual request that fails 3 consecutive execution attempts to a dead-letter path, separate from connector-level auto-disable. Externalize `RequestGate` counters and queued requests to a shared, atomic store (Redis by default) so that the same rate limit is enforced regardless of which process instance handles a tenant's request.

**What business value do we expect?**  
No unbounded queue growth, no silent drops, no stale post delivery, protection of the worker pool from poisoned requests, and correct multi-instance rate-limit enforcement when the deployment grows beyond a single process.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Eliminate unbounded rate-limit queue growth | Queue depth per `(tenantId, providerId)` is capped and never exceeds the documented ceiling |
| 2 | Prevent delivery of stale queued requests | No queued request older than 6 hours is dispatched; all such abandonments are auditable |
| 3 | Protect the shared worker pool from poisoned requests | A single request is dead-lettered after 3 consecutive execution failures, not retried indefinitely |
| 4 | Maintain rate-limit correctness across process instances | Concurrent `social-listening-core` instances enforce the same `(tenantId, providerId)` limits |
| 5 | Preserve tenant visibility and auditability | Every abandonment, rejection, and dead-letter is recorded in an `IngestionRun` and surfaced in the connector detail view |

---

## 4. Scope

### 4.1 In Scope

- A maximum time-in-queue (TTL) of 6 hours for queued rate-limited requests.
- A maximum queue depth of 1,000 pending requests per `(tenantId, providerId)`.
- Recording of TTL-based abandonment via `IngestionRun.postsSkipped` and `IngestionRun.errorSummary`.
- Rejection of new requests once the depth ceiling is reached, with an auditable record.
- Request-level dead-lettering after 3 consecutive execution failures for the same request.
- Storage of `RequestGate` state in a shared, atomic store (Redis by default) for correct multi-instance enforcement.
- Surfacing queue-depth rejection through the existing `ConnectorHealth` `degraded`/`failing` states, not a new status value.
- Flat numeric defaults for v1 (no per-platform tuning).

### 4.2 Out of Scope

- Per-platform variance of TTL, queue-depth, or dead-letter thresholds in v1.
- A new, dedicated `ConnectorHealth` status for queue-depth rejection.
- Building the Redis-backed distributed gate before a second concurrent `social-listening-core` instance is actually deployed.
- Connector-level auto-disable logic (handled by ADR-0010 / ADR-0023 / Story 2.3 / Story 2.5).
- Global rate limiting that is not scoped to a single tenant.

### 4.3 Assumptions

- The per-tenant `RequestGate` and `IngestionRun` audit mechanism from ADR-0003 and ADR-0005 are already in place.
- Queue bounds and dead-lettering are relevant even on a single instance once real traffic exists.
- Distributed `RequestGate` state is only required when more than one core instance can concurrently handle the same `(tenantId, providerId)`.
- Redis or an equivalent shared store with atomic increment/read semantics will be available when the distributed half is built.

### 4.4 Constraints

- The 6-hour / 1,000-request / 3-failure defaults are launch estimates and will likely need tuning once real traffic patterns exist.
- The single-instance, in-process `RequestGate` ships first; the shared-store implementation is explicitly deferred.
- The distributed half introduces a new operational dependency (shared store) purely for rate-limit bookkeeping.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Runs the core and is responsible for multi-instance correctness | High | No hidden single-process assumptions; visibility into queue depth, abandonments, and dead-letters |
| Tenant-Admin | Manages connectors and needs to understand ingestion health | Medium | Clear reasons when posts are skipped or refused; no silent data loss |
| Core Backend Engineer | Implements and maintains the `RequestGate`, queues, and dead-letter path | High | Clear, testable contracts and bounded queue behavior |
| Tenant-User | Relies on continuous, accurate post ingestion | Low | Ingestion continues to flow; stale posts are not delivered hours later |
| Platform-Admin | Monitors cross-tenant platform health (secondary) | Medium | Cross-tenant queue depth and error rates without accessing tenant data |

---

## 6. Current State (As-Is)

**Current process:**
1. A connector's outbound request is gated by `RequestGate` per `(tenantId, providerId)`.
2. If the request would exceed the current rate limit, it is queued and retried after the window resets.
3. The queue has no maximum age, no maximum depth, and no per-request failure cap.
4. `RequestGate` state (counters and queued requests) lives in the process's local memory.
5. Repeatedly failing individual requests are retried through the normal connector-level error-handling path, which only disables the connector at the aggregate level.

**Pain points:**
- A sustained over-quota condition can cause queue growth without bound for the affected tenant-platform pair.
- Stale requests can be delivered long after their real-time value has degraded.
- Local gate state silently assumes one process handles a given tenant-platform pair; multi-instance deployments lose correctness.
- A single poisoned request can consume worker capacity repeatedly without a separate, request-level dead-letter path.
- Tenants cannot see why a request was never delivered, because the design does not explicitly record abandonment.

---

## 7. Future State (To-Be)

**New or improved process:**
1. Every queued request is stamped with the time it entered the queue.
2. If a queued request reaches 6 hours without being dispatched, it is abandoned and the reason is written to the `IngestionRun` that would have consumed it.
3. A queue for a given `(tenantId, providerId)` cannot exceed 1,000 pending requests; new requests are rejected immediately and auditable once the ceiling is reached.
4. When a request is actually dispatched and fails execution, a per-request consecutive-failure counter increments; after 3 such failures the request is moved to a dead-letter path and not retried again.
5. `RequestGate` counters and queued-request state are held in a shared, atomic store (Redis by default) visible to every `social-listening-core` instance that can handle a tenant's request.
6. Queue-depth rejection surfaces in the existing `degraded`/`failing` `ConnectorHealth` states, and the reason is shown in the connector detail view.

**Expected capabilities:**
- A bounded, auditable queue that never grows unbounded or delivers stale requests.
- A worker pool protected from individual poisoned requests through request-level dead-lettering.
- Rate-limit enforcement that remains correct when the core runs as more than one concurrent instance.
- Clear tenant-visible reasons for any skipped or refused ingestion.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall abandon any queued rate-limited request that has waited longer than 6 hours and record the abandonment | Must | `IngestionRun.postsSkipped` and `errorSummary` contain a clear reason; the request is not delivered | Technical Lead |
| BR-002 | The system shall reject new requests once a `(tenantId, providerId)` queue reaches 1,000 pending entries | Must | New requests are not added beyond 1,000; each rejection is recorded and auditable | Technical Lead |
| BR-003 | The system shall dead-letter an individual request after 3 consecutive execution failures | Must | The request is no longer retried; the dead-letter is auditable and distinct from connector auto-disable | Technical Lead |
| BR-004 | The system shall support externalizing `RequestGate` counters and queued state to a shared, atomic store (Redis default) for multi-instance correctness | Should for single-instance; Must for any multi-instance deployment | A contract test with two concurrent instances proves the same `(tenantId, providerId)` limit is enforced | Technical Lead |
| BR-005 | Queue-depth rejection shall surface through existing `ConnectorHealth` `degraded`/`failing` states, not a new status | Must | No new top-level `ConnectorHealth` enum is introduced; the reason is visible in the connector detail view | Technical Lead |
| BR-006 | Every abandonment, rejection, and dead-letter shall be visible to the tenant and not silently dropped | Must | The relevant `IngestionRun` or connector detail view contains the reason | Technical Lead |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Queue bounds must preserve per-tenant, per-provider isolation | Security / Reliability | Must | One tenant's queue overflow does not affect another tenant's queue for the same provider |
| NFR-002 | Abandonment and rejection records must be immutable and auditable | Reliability / Compliance | Must | Records are written to `IngestionRun` and are not updated after the fact |
| NFR-003 | Distributed gate state must support atomic increment/read and low-latency access | Performance | Must | Two concurrent instances cannot race on the same counter; gate lookup adds <10ms in normal conditions |
| NFR-004 | The system must expose queue depth, TTL abandonment count, dead-letter count, and capacity-rejection count | Maintainability | Should | Platform operator can query these per `(tenantId, providerId)` |
| NFR-005 | Numeric thresholds must be adjustable without superseding the ADR | Maintainability | Should | TTL, depth, and dead-letter count can be changed via documented configuration and Amendment Log |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `RequestGate` queue entry | A pending outbound request keyed by `(tenantId, providerId)` (and `modelId` for AI), with enqueue timestamp and payload | `RequestGate` | Technical Lead | Internal |
| Queue depth per key | The count of pending entries for a `(tenantId, providerId)` pair | `RequestGate` | Technical Lead | Internal |
| `IngestionRun.postsSkipped` | Count of posts skipped in a poll attempt, including TTL abandonments and depth rejections | Ingestion pipeline | Technical Lead | Internal |
| `IngestionRun.errorSummary` | Structured reason string for skipped, rejected, or dead-lettered requests | Ingestion pipeline | Technical Lead | Internal |
| Dead-letter record | A request that exhausted 3 execution attempts, with reason and timestamp | Dead-letter handler | Technical Lead | Internal |
| `ConnectorHealth` state | Derived `degraded`/`failing` status carrying the queue-depth reason | Health derivation | Technical Lead | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Queue depth per `(tenantId, providerId)` | Detect over-quota backpressure and capacity issues | Platform Operator / Tenant-Admin | Real-time / Hourly |
| TTL abandonment count | Track rate of stale queued-request discards | Platform Operator / Tenant-Admin | Hourly / Daily |
| Capacity-rejection count | Identify sustained rate-limit storms and tenant impact | Platform Operator | Real-time / Hourly |
| Dead-letter count | Spot poisoned requests or broken platform payloads | Technical Lead | Hourly |
| Connector health with queue reason | Give tenants a clear, actionable reason in the connector detail view | Tenant-Admin | Real-time |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Sustained over-quota conditions cause queue-depth rejections and tenant-visible ingestion refusal | Medium | Medium | Monitor queue depth; surface clear reasons in `ConnectorHealth`; tune thresholds once real traffic exists | Technical Lead |
| R-002 | The 6-hour / 1,000-request / 3-failure defaults are guesses and may be mis-tuned for real traffic | Medium | Medium | Make thresholds configurable and log changes in the Amendment Log; tune after launch | Technical Lead |
| R-003 | The Redis-backed distributed gate adds a new operational dependency | Medium | Medium | Defer until a second instance is deployed; choose a managed offering and document runbooks | Platform Operator |
| R-004 | A valid but transient request is misclassified as poisoned and dead-lettered | Low | Medium | Count only execution failures for the same specific request; exclude rate-limit and network blips; support manual replay | Technical Lead |
| R-005 | Multi-instance gate state introduces consistency or latency bugs | Low | High | Use a store with atomic increment/read semantics; contract-test with two concurrent instances | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A queued request older than 6 hours is abandoned and recorded in the relevant `IngestionRun`'s `postsSkipped` and `errorSummary`.
- A `(tenantId, providerId)` queue rejects new requests once it reaches 1,000 pending entries, with an auditable record.
- A single request that fails 3 consecutive execution attempts is moved to the dead-letter path and not retried again.
- Two concurrent `social-listening-core` instances enforcing the same `(tenantId, providerId)` limit behave correctly (verified by a test that fails with an in-memory gate).
- Queue-depth rejection does not introduce a new `ConnectorHealth` status; it folds into the existing `degraded`/`failing` states and the reason is visible in the connector detail view.
- No request is silently dropped: every TTL abandonment, depth rejection, and dead-letter leaves an auditable record.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `RequestGate` | The shared, tenant-scoped rate-limit enforcement point in `social-listening-core`. |
| Queue TTL | The maximum time a request may wait in the rate-limit queue before being abandoned (6 hours by default). |
| Queue depth ceiling | The maximum number of pending requests allowed per `(tenantId, providerId)` (1,000 by default). |
| Dead-letter | A path for an individual request that has failed 3 consecutive execution attempts and will not be retried. |
| `IngestionRun` | The immutable audit anchor recording a poll attempt, including `postsSkipped` and `errorSummary`. |
| `ConnectorHealth` | The derived health state of a connector, including `degraded` and `failing`. |
| Distributed gate state | `RequestGate` counters and queued-request state held in a shared, atomic store across instances. |
| Redis | The default shared store chosen for the distributed `RequestGate` state. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0020-rate-limit-queue-bounds-and-distributed-gate-state.md` — the source ADR.
- `docs/adr/0003-per-tenant-per-provider-rate-limiting.md` — the upstream rate-limit decision that this ADR bounds and extends.
- `docs/product-research/feature-designs/01-multi-source-ingestion.md` — the ingestion design that describes the `RequestGate` and `IngestionRun` flow.
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — Story 2.4 (bounded queues, dead-lettering, and distributed gate state).

### 16.2 Missing Source

No `docs/product-research/reports/<feature>-deep-research.md` file was found for rate-limit queue bounds or distributed gate state. This BRD was produced from the ADR, the multi-source ingestion feature design, and the relevant user story.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
