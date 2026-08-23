# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0022 Derived-Data Caching and Refresh Strategy — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (Claude) |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0022 is Accepted; documents shipped design — Story 4.4) |
| Related Documents | ADR-0022, BRD-0022, ADR-0007, ADR-0009, ADR-0020, ADR-0051, Story 4.4, Story 1.12 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0022 (Derived-data caching and refresh strategy) and BRD-0022 into the functional design for how two pieces of derived data — `ConnectorHealth` (a read-time derivation from `IngestionRun`) and `AuthorTopicSignal` (a periodically-refreshed materialized view) — are kept fast to read without becoming a second, independently-updatable copy of the facts they derive from. ADR-0022 is Accepted (2026-07-29); Story 4.4 shipped it (`social-listening-core@56385ba`, 2026-07-30). This FDD documents the shipped design, not a draft.

### 2.2 Scope

**In scope:**
- A 60-second TTL, in-process, read-through cache for `ConnectorHealth`, recomputed from `IngestionRun` on miss/expiry.
- A safe, non-lossy `flush()` operation for that cache.
- Hourly scheduled refresh of the `AuthorTopicSignal` materialized view via `pg_cron`.
- The explicit rule that connector activation state (`connector_activations`, ADR-0051) is read fresh on every call and is never folded into the `ConnectorHealth` cache.
- Documented, accepted cross-instance display inconsistency for the in-process cache.

**Out of scope:**
- Event-driven or write-time invalidation of the `ConnectorHealth` cache.
- A shared/Redis-backed cache as the default for `ConnectorHealth`.
- Live (uncached) recomputation of `AuthorTopicSignal` on every request.
- Caching connector activation state.
- Any new composite "expertise score" derived from `AuthorTopicSignal`.

### 2.3 Target Audience

Backend engineers (connector health, materialized-view refresh), DevOps/SRE (pg_cron, Redis-outage resilience), admin UI engineers consuming `GET /connectors` and `GET /v1/connectors/:platformId`, QA.

---

## 3. Context and Background

Two unresolved freshness/performance questions existed for different reasons. `ConnectorHealth` (ADR-0009) is deliberately never stored — computed at read time from `IngestionRun` specifically so there is exactly one source of truth with no drift risk — but ADR-0009's own Negative consequences flagged that every health read repeats aggregation work and that caching would likely be needed "if `GET /connectors` is polled frequently." `AuthorTopicSignal` (ADR-0007) is explicitly a periodically-refreshed materialized view, not a live query, but ADR-0007 left the refresh cadence undecided ("needs to be decided during implementation"). ADR-0022 resolves both, under one hard constraint: any caching layer for `ConnectorHealth` must remain strictly reconstructable from `IngestionRun` alone — never a value updated by any path other than recomputation, or ADR-0009's "no possibility of drift" rationale would be quietly reintroduced as a bug.

ADR-0051 (2026-08-12, connector activation) later added a new, separate `connector_activations` table; ADR-0022's own dated note clarifies this cache mechanism is unaffected, and activation is read fresh alongside the cached health value rather than folded into it (implemented by Story 1.12).

Source requirements: BRD-0022 §§6–7, Story 4.4 (Epic 4, shipped 2026-07-30), Story 1.12 (Epic 1, shipped 2026-08-12).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce aggregation load from frequent connector-status polling | `GET /connectors` served from cache within the TTL window without recomputation |
| G2 | Bound staleness of both derived values to an explicit, documented tolerance | `ConnectorHealth` ≤ 60s stale; `AuthorTopicSignal` ≤ 1 hour stale |
| G3 | Preserve single source of truth | Cache/view contents fully reconstructable from `IngestionRun`/enriched posts at any time; no independently-writable copy |
| G4 | Avoid new scheduling infrastructure | `AuthorTopicSignal` refresh runs via existing Postgres `pg_cron`, not a new service |
| G5 | Stay resilient to a Redis outage | `GET /connectors` continues to serve correct (if slower) results with Redis unavailable |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `ConnectorHealth` Read-Through Cache

- **Description:** A 60-second TTL, in-process cache sitting in front of the existing `ConnectorHealth` derivation (ADR-0009), so repeated `GET /connectors` polling does not repeat the full `IngestionRun` aggregation on every call.
- **Triggers:** Any call to `GET /connectors` or `GET /v1/connectors/:platformId`.
- **Inputs:** Cache key (connector/tenant scope as applicable), current cache state (present/expired/absent), `IngestionRun` history on miss.
- **Processing:**
  - On a cache hit within the 60-second TTL, return the previously computed snapshot without touching `IngestionRun`.
  - On a miss or TTL expiry, recompute `ConnectorHealth` solely from `IngestionRun` (the same derivation ADR-0009 defines — no other stored state is read or written), then populate the cache with the fresh value and a new TTL window.
  - No explicit invalidation is wired to `IngestionRun` writes (poll completion, webhook handling, retry logic); the TTL alone bounds staleness. This is a deliberate simplicity trade-off over invalidate-on-write.
  - Cache is in-process (per `social-listening-core` instance) — not Redis or any shared store — by deliberate contrast with ADR-0020's `RequestGate`, which requires shared state for correctness. `ConnectorHealth` has no equivalent correctness requirement: every instance can independently recompute the identical value from `IngestionRun` at any time.
- **Outputs:** A `ConnectorHealth` value (`healthy`/`degraded`/`failing`/`disconnected`) served to the caller, at most 60 seconds old.
- **Error handling:** If the cache mechanism itself is unavailable or Redis (used elsewhere in the system) is down, `GET /connectors` is unaffected — the cache is purely in-process and has no dependency on Redis; the endpoint continues to work, just without the performance benefit of a warm cache.
- **Edge cases:** Two different `social-listening-core` instances may return different `ConnectorHealth` values for the same connector within the same 60-second window (one instance's cache just refreshed, another's is about to expire) — both are individually correct at their own compute time; this is documented, accepted display inconsistency, not a correctness bug.

### 5.2 Feature / Capability: `ConnectorHealth` Cache Flush

- **Description:** A safe, non-lossy operation to clear the cache, always producing the same result as if the cache had simply expired.
- **Triggers:** Operational/administrative need to force a fresh read (e.g. troubleshooting), or as a building block for future features.
- **Inputs:** None required beyond the flush call itself.
- **Processing:** Clears all cached entries; does not write anything. Because the cache holds no unique state, flushing can never lose data — the next read simply recomputes from `IngestionRun`.
- **Outputs:** An empty cache; the next `GET /connectors` triggers a fresh recomputation.
- **Error handling:** Flush has no failure mode that leaves the system in an incorrect state — worst case is simply "next read recomputes," identical to a natural TTL expiry.
- **Edge cases:** Flushing during an in-flight read does not corrupt the cache; the next read after flush is guaranteed to equal what a natural expiry-then-recompute would have produced.

### 5.3 Feature / Capability: `AuthorTopicSignal` Hourly Refresh

- **Description:** A scheduled background job that refreshes the `AuthorTopicSignal` materialized view (ADR-0007) once per hour, keeping refresh logic inside the database layer rather than a separate scheduling service.
- **Triggers:** `pg_cron`-scheduled job, once per hour.
- **Inputs:** Current enriched `SocialPost` data (entities, key phrases, authors) the view aggregates over.
- **Processing:** Recomputes the materialized view's rows from underlying enriched post data on the configured hourly cadence. Hourly bounds staleness of a deliberately long-window aggregate (the signal's "sustained engagement" semantics describe *what window* it aggregates over, not how often it is safe to recompute that aggregate) — it does not conflict with the signal's long-window design intent.
- **Outputs:** A refreshed `AuthorTopicSignal` materialized view with an advanced last-refreshed timestamp.
- **Error handling:** A missed or failed `pg_cron` run leaves the view at its prior refreshed state (stale, not incorrect); operational monitoring (BRD-0022 Reporting) tracks the last-refreshed timestamp to detect a stalled schedule.
- **Edge cases:** Under load, the refresh job may take non-trivial time to complete — the view remains queryable with its previous contents throughout the refresh, per standard materialized-view refresh semantics; no separate real-time or event-driven recompute path exists (explicitly rejected — see §8 BR3).

### 5.4 Feature / Capability: Activation State Kept Uncached and Combined With Cached Health

- **Description:** `GET /v1/connectors/:platformId` combines two now-separate signals into one response: connector activation state (from `connector_activations`, ADR-0051) and derived health (from the 60-second `ConnectorHealth` cache, this ADR).
- **Triggers:** Any call to `GET /v1/connectors/:platformId`.
- **Inputs:** `getCachedConnectorHealth()` result (may be cached or freshly recomputed); `isConnectorActive()` read against `connector_activations` for `ownerType: 'tenant'`.
- **Processing:** The route handler reads `isActive` fresh on every call (never cached by this ADR's mechanism, since `connector_activations` is a small, directly-queryable table with no equivalent aggregation cost to `deriveConnectorHealth()`), and combines it with the (possibly cached) `ConnectorHealth` value into a single response object.
- **Outputs:** A response containing both `isActive: boolean` and the derived health fields, where `isActive` is always current and health may be up to 60 seconds stale.
- **Error handling:** A platform with no `connector_activations` row (never activated) returns `isActive: false`, never `null`/`undefined`, per the activation subsystem's lazy-creation rule.
- **Edge cases:** Every existing consumer of this endpoint's response shape continues to work — `isActive` is a purely additive field, not a rename or removal of any prior field.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Platform Operator | Owns platform performance/observability; cares that polling doesn't overload Postgres |
| Tenant-Admin / tenant user | Views connector status in the admin UI; needs fresh-enough, non-misleading status |
| API Consumer (future subsystem) | Reads `AuthorTopicSignal` |
| DevOps / SRE | Runs and monitors `pg_cron` refresh and cache behavior |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 4.4) | Platform operator supporting frequent `GET /connectors` polling | `ConnectorHealth` served from a short-TTL cache always reconstructable from `IngestionRun`, and `AuthorTopicSignal` refreshed hourly | Reads stay fast without a second, independently-updatable copy of either value | 60s TTL cache; in-process only; safe flush; hourly `pg_cron` refresh; cross-instance staleness documented as acceptable |
| US2 (Story 1.12) | Tenant-Admin or tenant user viewing connector status | `GET /v1/connectors/:platformId` to tell me whether the connector is actually on, not just how healthy it's been | The connector status screen shows real activation state without a second round trip | `isActive` read fresh every call, never folded into the 60s cache; no-row case returns `false`, not `null` |

### 6.3 Workflow Diagrams / Steps

**`ConnectorHealth` read flow:**
1. Client calls `GET /connectors` (or `GET /v1/connectors/:platformId`).
2. Cache checked for the relevant key.
3. Hit within TTL → return cached snapshot.
4. Miss/expired → recompute from `IngestionRun` (ADR-0009 derivation) → populate cache with new TTL → return fresh value.
5. For the single-connector endpoint, `isActive` is read fresh from `connector_activations` in the same call and merged into the response alongside whichever health value (cached or fresh) step 3/4 produced.

**`AuthorTopicSignal` refresh flow:**
1. `pg_cron` fires on the hourly schedule.
2. Materialized view recomputed from current enriched `SocialPost` data.
3. Last-refreshed timestamp advances.
4. Consumers reading the view between refreshes see the previous hour's snapshot.

**Cache flush flow:**
1. Flush invoked (operational/troubleshooting need).
2. Cache cleared entirely.
3. Next read behaves exactly as a miss — recompute from `IngestionRun`, repopulate.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `IngestionRun` history (authoritative source for `ConnectorHealth` derivation).
- Enriched `SocialPost` fields (`enrichment.entities`, `enrichment.keyPhrases`, author) — authoritative source for `AuthorTopicSignal`.
- `connector_activations` rows — authoritative source for `isActive`.

### 7.2 Data Outputs

- Cached `ConnectorHealth` snapshot (in-process, per-instance, TTL-bound).
- Refreshed `AuthorTopicSignal` materialized view rows.
- Combined `GET /v1/connectors/:platformId` response (`isActive` + health fields).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `IngestionRun` (existing, authoritative) | run outcome, connector/platform id, tenant scope, timestamp | Source data for `ConnectorHealth` derivation; not modified by this ADR |
| `ConnectorHealth` cache entry (in-process, ephemeral) | cache key (connector/tenant scope), derived status value, populated-at timestamp, TTL (60s, configurable via `CONNECTOR_HEALTH_CACHE_TTL_MS`) | Read-through cache in front of `ConnectorHealth`; not a persisted table; reconstructable at any time |
| `AuthorTopicSignal` (materialized view, ADR-0007) | author, topic/entity, counts, date breakdowns, last-refreshed timestamp | Refreshed hourly via `pg_cron`; derived from enriched `SocialPost` rows |
| `connector_activations` (ADR-0051, existing) | `tenant_id`, `platformId`, `ownerType`, `is_active` | Read fresh (uncached) on every `GET /v1/connectors/:platformId` call; combined with cached health in the response |

### 7.4 Validation Rules

- The `ConnectorHealth` cache must never be written by any path other than recomputation from `IngestionRun` — no separate write API exists for it.
- `isActive` must never be `null`/`undefined` when no `connector_activations` row exists — absence reads as `false`.
- `AuthorTopicSignal` exposes only raw counts/breakdowns — no hidden composite "expertise score" is computed or stored.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `ConnectorHealth` may never be updated by any path other than recomputing from `IngestionRun`. | Cache (5.1) |
| BR2 | The 60-second cache is a time-bounded snapshot, not an authoritative state record; cache invalidation is TTL-based only, with no write-time invalidation on `IngestionRun` inserts. | Cache (5.1) |
| BR3 | Flushing the `ConnectorHealth` cache is always safe and never lossy. | Flush (5.2) |
| BR4 | `AuthorTopicSignal` refresh is scheduled hourly regardless of the signal's long-window semantics; no event-driven recompute is used. | Refresh (5.3) |
| BR5 | `connector_activations` state is read fresh on every `GET /v1/connectors/:platformId` call and is never folded into the 60-second `ConnectorHealth` cache. | Activation combination (5.4) |
| BR6 | Cross-instance differences in `ConnectorHealth` display within the TTL window are acceptable — each value is independently correct at its own compute time. | Cache locality (5.1) |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `GET /connectors` | Inbound | Serve cached or freshly-derived `ConnectorHealth` | REST / JSON |
| `GET /v1/connectors/:platformId` | Inbound | Serve combined `isActive` + cached health | REST / JSON |
| `IngestionRun` table (Postgres) | Inbound (read) | Authoritative source for health derivation on cache miss | SQL |
| `connector_activations` table (Postgres) | Inbound (read) | Authoritative, always-fresh activation source | SQL |
| `pg_cron` (Postgres extension) | Internal scheduling | Hourly `AuthorTopicSignal` refresh trigger | Postgres scheduled job |
| Admin UI connector status screen (Story 6.5) | Outbound | Consumes `GET /connectors` and `GET /v1/connectors/:platformId` | REST / JSON |

---

## 10. Non-Functional Considerations

- **Performance:** In-process cache eliminates repeated `IngestionRun` aggregation for polling clients within the 60-second window; hourly `pg_cron` refresh keeps `AuthorTopicSignal` recompute cost bounded and predictable.
- **Reliability:** `GET /connectors` degrades gracefully (slower, not incorrect) if the in-process cache is cold or Redis (used elsewhere) is unavailable — no hard dependency on Redis for this specific read path, by deliberate contrast with ADR-0020's `RequestGate`.
- **Maintainability:** All cached/derived content remains reconstructable from `IngestionRun` alone; `AuthorTopicSignal` refresh needs no new scheduling service beyond `pg_cron`.
- **Scalability:** In-process cache locality is accepted only because the current deployment shape is single-instance; multi-instance would introduce cross-instance display inconsistency (documented as acceptable, not a correctness defect) rather than requiring an immediate Redis migration.
- **Observability:** Cache hit/miss rate, `AuthorTopicSignal` last-refresh timestamp, `GET /connectors` p95/p99 latency, and cross-instance staleness observations are the operational signals this design should support monitoring for (BRD-0022 §11).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Cache miss/expiry on `GET /connectors` | None (transparent) | Recompute from `IngestionRun`; repopulate cache; return fresh value |
| Redis outage (used elsewhere in the system) | None (transparent) | `GET /connectors` unaffected — no dependency on Redis for this cache |
| Cache flushed mid-session | None (transparent) | Next read recomputes exactly as a natural expiry would |
| `pg_cron` job fails or is delayed | None to end users directly | `AuthorTopicSignal` remains at its previous refreshed state; monitoring should flag a stalled last-refreshed timestamp |
| No `connector_activations` row for a platform | Connector shown as inactive | `isActive: false` returned, never `null`/`undefined` |
| Two instances observed with different `ConnectorHealth` values in the same window | None — documented as expected | Both values individually correct at their own compute time; not treated as a bug |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- Current deployment shape is a single `social-listening-core` instance, making an in-process cache acceptable.
- 60 seconds of staleness is tolerable for a status indicator not used by any automated decision (auto-disable logic reads `IngestionRun` directly, never the cache).
- Hourly refresh is sufficient for a signal whose semantics are intentionally long-windowed.
- `pg_cron` is available in the target Postgres environment.

**Dependencies:**
- ADR-0007 (`AuthorTopicSignal` raw signals) — Accepted.
- ADR-0009 (`ConnectorHealth` derivation) — Accepted; this ADR caches, but does not change, that derivation.
- ADR-0020 (Redis-backed `RequestGate`) — cited only as a correctness-critical contrast, not a dependency of this design.
- ADR-0051 (connector activation) — Accepted; activation read remains uncached per this ADR's own dated note.
- Story 4.4 (shipped 2026-07-30, `social-listening-core@56385ba`) — implements this ADR's cache and refresh mechanism.
- Story 1.12 (shipped 2026-08-12) — combines activation with cached health on `GET /v1/connectors/:platformId`.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Is 60 seconds the right `ConnectorHealth` staleness tolerance long-term? | Product Owner | Resolved at acceptance as acceptable for v1; revisit only if a use case emerges needing tighter freshness |
| Q2 | Is hourly sufficient for `AuthorTopicSignal`, or should cadence tighten for future real-time insight needs? | Product Owner | Cadence is an implementation default, amendable without superseding the ADR |
| Q3 | Does cross-instance display inconsistency matter enough in practice to justify a shared/Redis-backed cache? | Product Owner | Deferred until multi-instance deployment is real |

---

## 14. Appendix

**Glossary:** see BRD-0022 §15 for derived data, read-through cache, `pg_cron`, in-process cache, `ConnectorHealth`, and `AuthorTopicSignal` definitions.

**Reference links:**
- [ADR-0022: Derived-data caching and refresh strategy](../../adr/0022-derived-data-caching-and-refresh-strategy.md)
- [BRD-0022](../Business-Requirements/BRD-0022-Derived-Data-Caching-And-Refresh-Strategy.md)
- [ADR-0007: `AuthorTopicSignal` raw signals] (referenced; not independently re-verified in this pass)
- [ADR-0009: `ConnectorHealth` derivation] (referenced; not independently re-verified in this pass)
- [ADR-0020: Redis-backed `RequestGate`] (referenced as contrast; not independently re-verified in this pass)
- [ADR-0051: Connector activation] (referenced; not independently re-verified in this pass)
- [Story 4.4 — Derived-data caching and refresh strategy](../../user-stories/epic-4-derived-data-analytics-and-health.md)
- [Story 1.12 — `GET /v1/connectors/:platformId` combines activation state with derived health](../../user-stories/epic-1-repository-and-api-foundation.md)

**Missing sources:** No `docs/product-research/feature-designs/<feature>.md` or deep-research report exists for this ADR — ADR-0022 itself states its source is "Not specified in the design spec" and originates the policy directly; BRD-0022's own Appendix B confirms the same absence.

**Revision history:**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (Claude) | Full regeneration: correct H1, real per-capability Section 5 breakdown, real Section 7.3 data model, replacing the prior defective BRD-shaped draft |
