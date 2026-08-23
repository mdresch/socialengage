# Business Requirements Document — Derived-Data Caching and Refresh Strategy

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Derived-Data Caching and Refresh Strategy |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0022-derived-data-caching-and-refresh-strategy.md, ../Business-Requirements/BRD-0022-Derived-Data-Caching-And-Refresh-Strategy.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0022-derived-data-caching-and-refresh-strategy.md and the business requirements in BRD-0022-Derived-Data-Caching-And-Refresh-Strategy.md into functional design for **Derived Data Caching And Refresh Strategy**.
SocialEngage produces two pieces of derived data whose freshness and performance characteristics have not yet been locked down: `ConnectorHealth`, which is recomputed from `IngestionRun` history every time it is read, and `AuthorTopicSignal`, a periodically-refreshed materialized view with no decided refresh cadence. Without an explicit caching and refresh strategy, frequent polling of connector status and repeated recomputation of author-topic signals waste database resources and create a risk that an over-eager optimization could reintroduce drift between displayed state and underlying facts.

This BRD records the business need to serve these derived values in a fast, consistent, and operationally proportionate way. The solution is to cache `ConnectorHealth` behind a short, 60-second, in-process, read-through cache that is always reconstructable from `IngestionRun`, and to refresh `AuthorTopicSignal` once per hour using `pg_cron`. Both mechanisms preserve the single-source-of-truth principle: the cache is a time-bounded snapshot of a live derivation, not a separately writable record.

---

### 2.2 Scope
**In scope:**
- A 60-second time-to-live (TTL), read-through, in-process cache for `ConnectorHealth` derived from `IngestionRun`.
- Hourly scheduled refresh of the `AuthorTopicSignal` materialized view via `pg_cron`.
- Explicit, documented staleness tolerance for `ConnectorHealth` and `AuthorTopicSignal`.
- A safe, non-lossy `flush()` operation for the `ConnectorHealth` cache.
- Continuing to treat cached `ConnectorHealth` as a reconstructable snapshot, not an authoritative source of truth.

**Out of scope:**
- Event-driven or write-time cache invalidation for `ConnectorHealth`.
- A shared/Redis-backed cache for `ConnectorHealth` as the default implementation.
- Live recomputation of `AuthorTopicSignal` on every request.
- Caching of connector *activation* state from `connector_activations`; activation is read fresh on every `GET /v1/connectors/:platformId` call.
- Defining a new composite expertise score from `AuthorTopicSignal`.

## 3. Context and Background
Two pieces of derived data have an unresolved freshness/performance question, for different reasons:

- **`ConnectorHealth`** (ADR-0009) is deliberately *not* stored — it's computed from `IngestionRun` history at read time, specifically so there is exactly one source of truth with no drift risk. That ADR's own Negative consequences already note this means every health read does aggregation work, and flags caching as a likely future need "if `GET /connectors` is polled frequently."
- **`AuthorTopicSignal`** (ADR-0007) is explicitly a periodically-refreshed materialized view, not a live query — but no refresh cadence was ever decided; ADR-0007 states outright that this "needs to be decided during implementation."

These are different mechanisms (a read cache in front of a derived value, vs. a scheduled materialized-view refresh) but the same underlying question: how fresh does derived data need to be, and what's the cheapest way to keep it that fresh without reintroducing the drift risk ADR-0009 specifically designed around.

**The constraint this ADR must respect:** any caching layer for `ConnectorHealth` must not become a second, independently-updatable copy of health state. ADR-0009's entire rationale is "no possibility of drift" because nothing is stored — a cache that's updated by anything other than recomputing from `IngestionRun` would quietly reintroduce the exact problem ADR-0009 exists to avoid.
SocialEngage produces two pieces of derived data whose freshness and performance characteristics have not yet been locked down: `ConnectorHealth`, which is recomputed from `IngestionRun` history every time it is read, and `AuthorTopicSignal`, a periodically-refreshed materialized view with no decided refresh cadence. Without an explicit caching and refresh strategy, frequent polling of connector status and repeated recomputation of author-topic signals waste database resources and create a risk that an over-eager optimization could reintroduce drift between displayed state and underlying facts.

This BRD records the business need to serve these derived values in a fast, consistent, and operationally proportionate way. The solution is to cache `ConnectorHealth` behind a short, 60-second, in-process, read-through cache that is always reconstructable from `IngestionRun`, and to refresh `AuthorTopicSignal` once per hour using `pg_cron`. Both mechanisms preserve the single-source-of-truth principle: the cache is a time-bounded snapshot of a live derivation, not a separately writable record.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce aggregation load from frequent connector-status polling | `GET /connectors` response time stays under target SLA even at high poll frequency |
| 2 | Bound staleness of derived values to an acceptable, explicit tolerance | `ConnectorHealth` is at most 60 seconds stale; `AuthorTopicSignal` is at most 1 hour stale |
| 3 | Preserve single source of truth for health and signal data | No table or cache is ever updated by any path other than recomputation from authoritative source data |
| 4 | Avoid new scheduling infrastructure for `AuthorTopicSignal` refresh | Refresh is implemented with existing Postgres `pg_cron` extension |
| 5 | Keep the platform resilient to Redis or shared-cache outages | `GET /connectors` continues to serve correct results if Redis is unavailable |

---

**Positive consequences (from ADR):**
**Positive**
- Closes both gaps ADR-0007 and ADR-0009 already flagged as open, with a mechanism that's proportionate to how fresh each actually needs to be.
- Preserves ADR-0009's core property: the cache is provably reconstructable from `IngestionRun` alone at any moment, so "single source of truth" still holds — the cache is an optimization, not a second fact.
- `pg_cron` for `AuthorTopicSignal` avoids introducing a new scheduling service just for one periodic job.

**Negative**
- A `ConnectorHealth` read can be up to 60 seconds stale — acceptable for a status indicator, but worth being explicit that `GET /connectors` is no longer a strictly live view, which is a small behavior change from what ADR-0009 implies (a live-computed derivation) even though the underlying derivation logic doesn't change.
- Two different refresh mechanisms (TTL-based read cache vs. scheduled materialized-view refresh) for two pieces of derived data adds a small amount of conceptual overhead — a future reader needs to know which pattern applies to which entity rather than one uniform rule.
- Both numbers (1 hour, 60 seconds) are guesses, not derived from any stated requirement or real read-frequency data.
- With an in-process cache and more than one `social-listening-core` instance, two simultaneous `GET /connectors` calls hitting different instances can show slightly different results within the same TTL window (e.g., one instance's cache just refreshed, another's is about to expire). Both are individually correct derivations at their own computation time — this is display inconsistency, not a correctness bug — but it's a real, user-visible property worth stating explicitly rather than discovering in a bug report.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall serve `GET /connectors` from a `ConnectorHealth` cache with a 60-second TTL. | Must | After population, repeated reads within 60 seconds return the cached value without recomputing. | Product Owner |
| BR-002 | On cache miss or TTL expiry, the system shall recompute `ConnectorHealth` solely from `IngestionRun`. | Must | No other stored state is read or written to produce the derived value. | Product Owner |
| BR-003 | The `ConnectorHealth` cache shall be in-process (per `social-listening-core` instance) and not require Redis. | Must | With Redis unavailable, `GET /connectors` still returns correct, freshly computed results. | Product Owner |
| BR-004 | The system shall provide a safe, non-lossy flush operation for the `ConnectorHealth` cache. | Must | After `flush()`, the next `GET /connectors` recomputes and returns the same value it would have if the cache had simply expired. | Product Owner |
| BR-005 | The system shall refresh the `AuthorTopicSignal` materialized view every hour using `pg_cron`. | Must | The view's last-refreshed timestamp advances at least once per hour under normal operation. | Product Owner |
| BR-006 | `AuthorTopicSignal` shall remain a raw-signal view with no composite expertise score. | Must | The view exposes only counts, dates, and breakdowns; no hidden ranking formula is added. | Product Owner |
| BR-007 | The system shall keep connector activation state separate from `ConnectorHealth` caching. | Must | `GET /v1/connectors/:platformId` reads `isActive` fresh on every call and combines it with the cached `ConnectorHealth` value. | Product Owner |
| BR-008 | The system shall document cross-instance cache inconsistency as acceptable display behavior. | Should | A test hitting two different instances in the same 60-second window may observe different ages, both individually correct. | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

Both `AuthorTopicSignal` and `ConnectorHealth` get periodic-refresh treatment rather than always-live computation on every request, because neither needs second-by-second accuracy — `AuthorTopicSignal` by explicit design intent (the original design conversation: "an expert is not created in an hour"), `ConnectorHealth` because it's a status indicator, not a transactional read. For `ConnectorHealth` specifically: the cache is strictly a time-bounded snapshot of the same derivation ADR-0009 defines, rebuildable at any time from `IngestionRun` with no other state to reconcile — never a value updated by any path other than recomputation. A cache flush is always safe, never lossy, and never a source of truth in its own right.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **`AuthorTopicSignal`**: refreshed via a scheduled background job every **1 hour**, using `pg_cron` (keeps the refresh logic in the database layer rather than requiring a separate scheduling service to run and monitor).
- **`ConnectorHealth`**: a read-through cache with a **60-second TTL** — recomputed from `IngestionRun` on cache miss or expiry. No explicit invalidation on `IngestionRun` write; the TTL alone bounds staleness to at most 60 seconds, which is an acceptable tolerance for a status indicator and avoids the complexity of wiring cache invalidation into every code path that writes an `IngestionRun`.
- **Cache locality: in-process (per-instance), not shared/Redis-backed.** This is deliberately different from ADR-0020's `RequestGate` state, and for a specific reason: `RequestGate` correctness *requires* every process instance to see the same counters, or rate-limit enforcement is actually wrong (a tenant could exceed a platform's declared limit). `ConnectorHealth` has no equivalent correctness requirement — every instance can independently recompute the exact same value straight from `IngestionRun` at any time, so an in-process cache never risks *incorrectness*, only brief cross-instance display inconsistency (two instances might show a status computed a few seconds apart, both individually correct). Given that, this read shouldn't take on a hard dependency on Redis being available just because Redis exists elsewhere in the system for a different, correctness-critical reason — `GET /connectors` should keep working (just slower) through a Redis outage.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Owns platform performance and observability | High | Frequent `GET /connectors` polling must not overload Postgres; health state must remain reliable. |
| Tenant Administrator | Views connector status in the admin UI | High | Connector status is fresh enough to act on, but not misleading due to drift. |
| API Consumer (future Social Selling / Insights) | Reads `AuthorTopicSignal` | Medium | Signal data is periodically refreshed and not opinionated by a hidden composite score. |
| DevOps / SRE | Runs and monitors the service | Medium | Cache must not add a hard Redis dependency or require new scheduling services. |
| Product Owner (Menno) | Decision authority on scope and acceptance | High | Clear trade-off between freshness, cost, and correctness; no hidden drift. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.12 | epic-1-repository-and-api-foundation.md | As Tenant-Admin or tenant user viewing a connector's status, I want `GET /v1/connectors/:platformId` to tell me whether the connector is actually turned on, ... | `GET /v1/connectors/:platformId`'s response gains an `isActive` field (`boolean`), read via `isConnectorActive()` (`connectorActivationStore.ts`) for `ownerT... |
| Story 4.4 | epic-4-derived-data-analytics-and-health.md | As platform operator supporting frequent `GET /connectors` polling from the admin UI, I want `ConnectorHealth` served from a short-TTL read-through cache tha... | `GET /connectors` reads are served from a cache with a 60-second TTL (implementation default); on expiry, the cache recomputes from `IngestionRun`, not from ... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun` rows | Authoritative execution history used to derive connector health | `ingestion_runs` table | Ingestion subsystem | Operational data |
| `ConnectorHealth` cached snapshot | 60-second read-through cache of derived connector status | Derived from `IngestionRun` | `social-listening-core` instance | Operational data |
| `AuthorTopicSignal` materialized view | Periodically refreshed raw author-topic counts and breakdowns | Derived from enriched `SocialPost` data | `social-listening-core` database | Operational data |
| `connector_activations` | Tenant- or user-scoped connector on/off state | `connector_activations` table | Activation subsystem | Operational data |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `ConnectorHealth` may never be updated by any path other than recomputing from `IngestionRun`. |
| BRU-002 | The 60-second `ConnectorHealth` cache is a time-bounded snapshot, not an authoritative state record. |
| BRU-003 | Cache invalidation shall be TTL-based; no write-time invalidation on `IngestionRun` inserts is required. |
| BRU-004 | Flushing the `ConnectorHealth` cache is always safe and never lossy. |
| BRU-005 | `connector_activations` state is read fresh on every `GET /v1/connectors/:platformId` call and is not cached by this mechanism. |
| BRU-006 | Cross-instance differences in `ConnectorHealth` display within the TTL window are acceptable because each value is independently correct at its own compute time. |
| BRU-007 | `AuthorTopicSignal` refresh is scheduled hourly, regardless of the signal's long-window semantics. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0007 (`AuthorTopicSignal` raw signals) | Decision | Product Owner | Already Accepted |
| D-002 | ADR-0009 (`ConnectorHealth` derivation) | Decision | Product Owner | Already Accepted |
| D-003 | ADR-0020 (Redis-backed `RequestGate`) | Decision | Product Owner | Already Accepted; used only as contrast, not dependency |
| D-004 | ADR-0051 (connector activation) | Decision | Product Owner | Already Accepted; activation read remains uncached |
| D-005 | Story 4.1 — `AuthorTopicSignal` raw author-topic signals | Story | Product Owner | Ready |
| D-006 | Story 4.3 — derived connector health from `IngestionRun` | Story | Product Owner | Ready |
| D-007 | Story 4.4 — derived-data caching and refresh strategy | Story | Product Owner | Ready |
| D-008 | Story 1.12 — `GET /v1/connectors/:platformId` combines activation with cached health | Story | Product Owner | Built 2026-08-12 |
| D-009 | Postgres `pg_cron` extension | Infrastructure | DevOps | Available in target environment |

---

- The current deployment shape is a single `social-listening-core` instance, making an in-process cache acceptable.
- 60 seconds of staleness is tolerable for a status indicator that is not used by automated decision logic.
- Hourly refresh is sufficient for an author-topic signal whose semantics are intentionally long-windowed.
- Postgres `pg_cron` is available in the target database environment.

**The durable decision — this is what would need superseding, not just amending:**

Both `AuthorTopicSignal` and `ConnectorHealth` get periodic-refresh treatment rather than always-live computation on every request, because neither needs second-by-second accuracy — `AuthorTopicSignal` by explicit design intent (the original design conversation: "an expert is not created in an hour"), `ConnectorHealth` because it's a status indicator, not a transactional read. For `ConnectorHealth` specifically: the cache is strictly a time-bounded snapshot of the same derivation ADR-0009 defines, rebuildable at any time from `IngestionRun` with no other state to reconcile — never a value updated by any path other than recomputation. A cache flush is always safe, never lossy, and never a source of truth in its own right.

**Implementation defaults (adjustable — see Amendment Log; does not require superseding this ADR on its own):**

- **`AuthorTopicSignal`**: refreshed via a scheduled background job every **1 hour**, using `pg_cron` (keeps the refresh logic in the database layer rather than requiring a separate scheduling service to run and monitor).
- **`ConnectorHealth`**: a read-through cache with a **60-second TTL** — recomputed from `IngestionRun` on cache miss or expiry. No explicit invalidation on `IngestionRun` write; the TTL alone bounds staleness to at most 60 seconds, which is an acceptable tolerance for a status indicator and avoids the complexity of wiring cache invalidation into every code path that writes an `IngestionRun`.
- **Cache locality: in-process (per-instance), not shared/Redis-backed.** This is deliberately different from ADR-0020's `RequestGate` state, and for a specific reason: `RequestGate` correctness *requires* every process instance to see the same counters, or rate-limit enforcement is actually wrong (a tenant could exceed a platform's declared limit). `ConnectorHealth` has no equivalent correctness requirement — every instance can independently recompute the exact same value straight from `IngestionRun` at any time, so an in-process cache never risks *incorrectness*, only brief cross-instance display inconsistency (two instances might show a status computed a few seconds apart, both individually correct). Given that, this read shouldn't take on a hard dependency on Redis being available just because Redis exists elsewhere in the system for a different, correctness-critical reason — `GET /connectors` should keep working (just slower) through a Redis outage.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `ConnectorHealth` reads shall tolerate up to 60 seconds of staleness. | Performance | Must | Documented and contractually tested; no automated decision depends on the cached value. |
| NFR-002 | `AuthorTopicSignal` staleness shall be bounded to one hour. | Performance | Must | Refreshed at least hourly; clients are informed the view is not live. |
| NFR-003 | The caching mechanism shall not degrade during a Redis outage. | Reliability | Must | `GET /connectors` continues to serve correct results with Redis unavailable. |
| NFR-004 | The cache design shall remain a pure optimization, not a source of truth. | Maintainability | Must | All cache contents can be reconstructed from `IngestionRun` at any time. |
| NFR-005 | `AuthorTopicSignal` refresh shall not require a new scheduling service. | Maintainability | Must | Refresh is triggered by `pg_cron` inside the existing Postgres database. |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Closes both gaps ADR-0007 and ADR-0009 already flagged as open, with a mechanism that's proportionate to how fresh each actually needs to be.
- Preserves ADR-0009's core property: the cache is provably reconstructable from `IngestionRun` alone at any moment, so "single source of truth" still holds — the cache is an optimization, not a second fact.
- `pg_cron` for `AuthorTopicSignal` avoids introducing a new scheduling service just for one periodic job.

**Negative**
- A `ConnectorHealth` read can be up to 60 seconds stale — acceptable for a status indicator, but worth being explicit that `GET /connectors` is no longer a strictly live view, which is a small behavior change from what ADR-0009 implies (a live-computed derivation) even though the underlying derivation logic doesn't change.
- Two different refresh mechanisms (TTL-based read cache vs. scheduled materialized-view refresh) for two pieces of derived data adds a small amount of conceptual overhead — a future reader needs to know which pattern applies to which entity rather than one uniform rule.
- Both numbers (1 hour, 60 seconds) are guesses, not derived from any stated requirement or real read-frequency data.
- With an in-process cache and more than one `social-listening-core` instance, two simultaneous `GET /connectors` calls hitting different instances can show slightly different results within the same TTL window (e.g., one instance's cache just refreshed, another's is about to expire). Both are individually correct derivations at their own computation time — this is display inconsistency, not a correctness bug — but it's a real, user-visible property worth stating explicitly rather than discovering in a bug report.

## 12. Assumptions and Dependencies
- The current deployment shape is a single `social-listening-core` instance, making an in-process cache acceptable.
- 60 seconds of staleness is tolerable for a status indicator that is not used by automated decision logic.
- Hourly refresh is sufficient for an author-topic signal whose semantics are intentionally long-windowed.
- Postgres `pg_cron` is available in the target database environment.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | 60-second `ConnectorHealth` staleness is later judged too stale for a future use case | Medium | Medium | Keep TTL configurable; any automated decision reads `IngestionRun` directly, not the cache | Product Owner |
| R-002 | Multiple `social-listening-core` instances show inconsistent status within the same 60-second window | High (when multi-instance) | Low | Document as acceptable display inconsistency; revisit only if UX proves it matters | Product Owner |
| R-003 | Hourly `AuthorTopicSignal` refresh is too infrequent for future real-time insights | Medium | Medium | Cadence is an implementation default and can be amended without superseding the ADR | Product Owner |
| R-004 | Engineers implement a writable or event-invalidated cache, reintroducing drift | Medium | High | Code review / contract test enforcing "recompute from `IngestionRun` only" | Technical Lead |
| R-005 | `pg_cron` is not enabled or fails in the target environment | Low | High | Verify Postgres extension provisioning and add monitoring for missed refreshes | DevOps |

---

## 14. Appendix
- ADR: `../../adr/0022-derived-data-caching-and-refresh-strategy.md`
- BRD: `../Business-Requirements/BRD-0022-Derived-Data-Caching-And-Refresh-Strategy.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Deep research: _No deep-research report found._
- User stories: see extracted stories above