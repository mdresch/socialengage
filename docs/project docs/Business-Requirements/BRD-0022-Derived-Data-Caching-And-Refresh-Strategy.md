# Business Requirements Document — Derived-Data Caching and Refresh Strategy

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Derived-Data Caching and Refresh Strategy Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | BRD Writer Agent | Initial draft from ADR-0022, Story 4.4, and Story 1.12 |
| 1.0 | 2026-08-19 | BRD Writer Agent | Approved for Phase 4 implementation |

---

## 2. Executive Summary

SocialEngage produces two pieces of derived data whose freshness and performance characteristics have not yet been locked down: `ConnectorHealth`, which is recomputed from `IngestionRun` history every time it is read, and `AuthorTopicSignal`, a periodically-refreshed materialized view with no decided refresh cadence. Without an explicit caching and refresh strategy, frequent polling of connector status and repeated recomputation of author-topic signals waste database resources and create a risk that an over-eager optimization could reintroduce drift between displayed state and underlying facts.

This BRD records the business need to serve these derived values in a fast, consistent, and operationally proportionate way. The solution is to cache `ConnectorHealth` behind a short, 60-second, in-process, read-through cache that is always reconstructable from `IngestionRun`, and to refresh `AuthorTopicSignal` once per hour using `pg_cron`. Both mechanisms preserve the single-source-of-truth principle: the cache is a time-bounded snapshot of a live derivation, not a separately writable record.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce aggregation load from frequent connector-status polling | `GET /connectors` response time stays under target SLA even at high poll frequency |
| 2 | Bound staleness of derived values to an acceptable, explicit tolerance | `ConnectorHealth` is at most 60 seconds stale; `AuthorTopicSignal` is at most 1 hour stale |
| 3 | Preserve single source of truth for health and signal data | No table or cache is ever updated by any path other than recomputation from authoritative source data |
| 4 | Avoid new scheduling infrastructure for `AuthorTopicSignal` refresh | Refresh is implemented with existing Postgres `pg_cron` extension |
| 5 | Keep the platform resilient to Redis or shared-cache outages | `GET /connectors` continues to serve correct results if Redis is unavailable |

---

## 4. Scope

### 4.1 In Scope

- A 60-second time-to-live (TTL), read-through, in-process cache for `ConnectorHealth` derived from `IngestionRun`.
- Hourly scheduled refresh of the `AuthorTopicSignal` materialized view via `pg_cron`.
- Explicit, documented staleness tolerance for `ConnectorHealth` and `AuthorTopicSignal`.
- A safe, non-lossy `flush()` operation for the `ConnectorHealth` cache.
- Continuing to treat cached `ConnectorHealth` as a reconstructable snapshot, not an authoritative source of truth.

### 4.2 Out of Scope

- Event-driven or write-time cache invalidation for `ConnectorHealth`.
- A shared/Redis-backed cache for `ConnectorHealth` as the default implementation.
- Live recomputation of `AuthorTopicSignal` on every request.
- Caching of connector *activation* state from `connector_activations`; activation is read fresh on every `GET /v1/connectors/:platformId` call.
- Defining a new composite expertise score from `AuthorTopicSignal`.

### 4.3 Assumptions

- The current deployment shape is a single `social-listening-core` instance, making an in-process cache acceptable.
- 60 seconds of staleness is tolerable for a status indicator that is not used by automated decision logic.
- Hourly refresh is sufficient for an author-topic signal whose semantics are intentionally long-windowed.
- Postgres `pg_cron` is available in the target database environment.

### 4.4 Constraints

- Any cache must not become a second, independently-updatable copy of health state.
- `ConnectorHealth` cache must degrade gracefully to direct Postgres computation when the cache is absent, flushed, or unavailable.
- TTL and refresh values are initial defaults and may be amended without superseding the ADR.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Operator | Owns platform performance and observability | High | Frequent `GET /connectors` polling must not overload Postgres; health state must remain reliable. |
| Tenant Administrator | Views connector status in the admin UI | High | Connector status is fresh enough to act on, but not misleading due to drift. |
| API Consumer (future Social Selling / Insights) | Reads `AuthorTopicSignal` | Medium | Signal data is periodically refreshed and not opinionated by a hidden composite score. |
| DevOps / SRE | Runs and monitors the service | Medium | Cache must not add a hard Redis dependency or require new scheduling services. |
| Product Owner (Menno) | Decision authority on scope and acceptance | High | Clear trade-off between freshness, cost, and correctness; no hidden drift. |

---

## 6. Current State (As-Is)

**Current process:**

1. `ConnectorHealth` is computed at read time by aggregating `IngestionRun` history. Every call to `GET /connectors` repeats this aggregation.
2. `AuthorTopicSignal` is defined as a periodically-refreshed materialized view, but no refresh schedule has been chosen.
3. The connector status screen and any polling client request health status repeatedly, multiplying the cost of the unbounded live derivation.

**Pain points:**

- Every status read does expensive aggregation work against `IngestionRun`.
- There is no explicit, contractually documented staleness model; clients may assume live data.
- The absence of a caching decision creates pressure to add ad-hoc caches that could become independent sources of truth.
- `AuthorTopicSignal` cannot be relied on until a refresh cadence is set.

---

## 7. Future State (To-Be)

**New or improved process:**

1. `GET /connectors` checks an in-process `ConnectorHealth` cache first. On cache hit, the previously computed snapshot is returned. On miss or expiry, the derivation is recomputed from `IngestionRun`, the cache is populated, and the result is returned.
2. A `pg_cron` job refreshes the `AuthorTopicSignal` materialized view once per hour.
3. Cache flushing is always safe because the cache holds no unique state; after a flush, the next read simply recomputes.
4. `GET /v1/connectors/:platformId` continues to combine the cached `ConnectorHealth` value with a fresh, uncached `isActive` read from `connector_activations`.

**Expected capabilities:**

- Fast, bounded-stale connector health reads.
- A predictable, low-overhead refresh schedule for author-topic signals.
- Continued service correctness during cache outages or single-instance restarts.
- A documented, explicit tolerance for cross-instance display inconsistency.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `ConnectorHealth` reads shall tolerate up to 60 seconds of staleness. | Performance | Must | Documented and contractually tested; no automated decision depends on the cached value. |
| NFR-002 | `AuthorTopicSignal` staleness shall be bounded to one hour. | Performance | Must | Refreshed at least hourly; clients are informed the view is not live. |
| NFR-003 | The caching mechanism shall not degrade during a Redis outage. | Reliability | Must | `GET /connectors` continues to serve correct results with Redis unavailable. |
| NFR-004 | The cache design shall remain a pure optimization, not a source of truth. | Maintainability | Must | All cache contents can be reconstructed from `IngestionRun` at any time. |
| NFR-005 | `AuthorTopicSignal` refresh shall not require a new scheduling service. | Maintainability | Must | Refresh is triggered by `pg_cron` inside the existing Postgres database. |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `IngestionRun` rows | Authoritative execution history used to derive connector health | `ingestion_runs` table | Ingestion subsystem | Operational data |
| `ConnectorHealth` cached snapshot | 60-second read-through cache of derived connector status | Derived from `IngestionRun` | `social-listening-core` instance | Operational data |
| `AuthorTopicSignal` materialized view | Periodically refreshed raw author-topic counts and breakdowns | Derived from enriched `SocialPost` data | `social-listening-core` database | Operational data |
| `connector_activations` | Tenant- or user-scoped connector on/off state | `connector_activations` table | Activation subsystem | Operational data |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| `ConnectorHealth` cache hit / miss rate | Track effectiveness of the 60-second cache | DevOps / SRE | Continuous / dashboard |
| `AuthorTopicSignal` last-refresh timestamp | Confirm hourly schedule is healthy | DevOps / SRE | Hourly check |
| `GET /connectors` p95 / p99 latency | Verify polling performance remains acceptable | Platform Operator | Per release / ongoing |
| Cross-instance staleness observation count | Monitor whether multi-instance inconsistency is occurring | SRE | Ad-hoc or alert-driven |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | 60-second `ConnectorHealth` staleness is later judged too stale for a future use case | Medium | Medium | Keep TTL configurable; any automated decision reads `IngestionRun` directly, not the cache | Product Owner |
| R-002 | Multiple `social-listening-core` instances show inconsistent status within the same 60-second window | High (when multi-instance) | Low | Document as acceptable display inconsistency; revisit only if UX proves it matters | Product Owner |
| R-003 | Hourly `AuthorTopicSignal` refresh is too infrequent for future real-time insights | Medium | Medium | Cadence is an implementation default and can be amended without superseding the ADR | Product Owner |
| R-004 | Engineers implement a writable or event-invalidated cache, reintroducing drift | Medium | High | Code review / contract test enforcing "recompute from `IngestionRun` only" | Technical Lead |
| R-005 | `pg_cron` is not enabled or fails in the target environment | Low | High | Verify Postgres extension provisioning and add monitoring for missed refreshes | DevOps |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- `GET /connectors` returns a value from a 60-second TTL in-process read-through cache; on expiry the value is recomputed from `IngestionRun` only.
- The cache is not backed by Redis; with Redis unavailable, `GET /connectors` still returns correct, freshly computed results.
- Flushing the `ConnectorHealth` cache and immediately re-reading produces the same correct value as before the flush.
- Two different `social-listening-core` instances may show slightly different `ConnectorHealth` values within the same 60-second window; this is documented and accepted.
- `AuthorTopicSignal` is refreshed on an hourly schedule via `pg_cron`; its last-refreshed timestamp advances at least hourly under load.
- `GET /v1/connectors/:platformId` returns `isActive` read fresh from `connector_activations` combined with the cached `ConnectorHealth` value, without folding activation into the 60-second cache.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Derived data | Values computed from raw or authoritative data rather than stored independently, e.g., `ConnectorHealth` from `IngestionRun`. |
| Read-through cache | A cache that, on a miss, recomputes or reloads the value from the authoritative source and then stores it for the TTL. |
| `pg_cron` | A Postgres extension for scheduling periodic jobs directly inside the database. |
| In-process cache | A cache local to a single application process, not shared across instances or backed by a separate service such as Redis. |
| `ConnectorHealth` | A derived status value (`healthy`, `degraded`, `failing`, `disconnected`) computed from `IngestionRun` history. |
| `AuthorTopicSignal` | A materialized view of raw author-topic engagement signals, refreshed periodically rather than queried live. |

---

## 16. Appendices

### Appendix A — Reference Documents

- `docs/adr/0022-derived-data-caching-and-refresh-strategy.md` — source architecture decision.
- `docs/user-stories/epic-4-derived-data-analytics-and-health.md` — Story 4.4 and related derived-data stories.
- `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.12 on combining activation state with cached `ConnectorHealth`.

### Appendix B — Missing or Not-Applicable Sources

- No `docs/product-research/feature-designs/<feature>.md` file exists specifically for the derived-data caching and refresh strategy. ADR-0022 states its source was "Not specified in the design spec" and originates the policy itself. This BRD therefore derives scope directly from the ADR and the related user stories.

### Appendix C — Related Stories

| Story | Epic | Source | Key Intent |
|---|---|---|---|
| Story 4.4 | Epic 4 | ADR-0022 | Add 60-second `ConnectorHealth` cache and hourly `AuthorTopicSignal` refresh. |
| Story 1.12 | Epic 1 | ADR-0051 (with ADR-0022 note) | Combine fresh `isActive` read with cached `ConnectorHealth` on `GET /v1/connectors/:platformId`. |

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
