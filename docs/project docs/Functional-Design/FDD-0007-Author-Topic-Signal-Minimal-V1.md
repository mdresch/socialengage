# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0007 AuthorTopicSignal Minimal V1 — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0007 is Accepted) |
| Related Documents | ADR-0007, ADR-0004, ADR-0022, BRD-0007, Story 4.1, Story 4.4 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0007 (`AuthorTopicSignal` ships with raw signals only, no computed expertise score) and BRD-0007 into a functional design for the minimal v1 "expert finder" capability: a periodically refreshed, tenant-scoped view of raw author/topic activity, exposed via one sortable API endpoint.

### 2.2 Scope

- **In scope:** the `AuthorTopicSignal` materialized view (keyed by `(tenantId, authorId, topic)`), its raw fields, the periodic refresh mechanism, and `GET /topics/:topic/authors?sortBy=activeMonths|mentionCount`.
- **Out of scope:** any computed `expertiseScore`/`influenceScore`/composite ranking metric; live on-request aggregation against the full `SocialPost` table; UI/charting for expert or influencer discovery; topic-time-series aggregation/trend charting; ML-based or engagement-weighted scoring in the core data model. Future layering of an `influence_score` on top of these raw signals is explicitly deferred (see `docs/product-research/feature-designs/05-influencer-discovery.md`).

### 2.3 Target Audience

Backend engineers implementing the materialized view and refresh job; API consumers (admin UI, future Social Selling subsystem) building their own ranking on top of the raw signals; the technical lead validating the "raw only" boundary is held.

---

## 3. Context and Background

- **Problem/opportunity:** the system needs to answer "who is knowledgeable about topic X" — an expert-finder query exposed via `GET /topics/:topic/authors?sortBy=activeMonths|mentionCount`. There are many plausible ways to rank expertise (recency-weighted, engagement-weighted, decayed, ML-scored), and this is the first version of this capability; committing to one formula now would be premature.
- **Business/user value:** downstream consumers (including future Social Selling) can apply their own weighting without the core needing to anticipate every ranking strategy up front; a raw-signal view is straightforward to refresh periodically and extend later (additive fields) without a breaking schema change; avoids prematurely committing to a scoring formula that would be expensive to change once downstream systems depend on its output ranking.
- **Source requirements:** ADR-0007; BRD-0007 (BR-001–BR-006, BRU-001–BRU-005); Story 4.1 (built `social-listening-core@16d6fea`); Story 4.4 (refresh cadence, ADR-0022).
- **Constraints/dependencies:** API consumers that want "the best expert" must implement their own composite ranking rather than calling a single sorted endpoint — more work pushed to every consumer, by design; because it's a periodically refreshed materialized view rather than a live query, `AuthorTopicSignal` is eventually consistent with the underlying `SocialPost`/enrichment data — refresh cadence (decided in Story 4.4/ADR-0022) governs freshness.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable topic-level author discovery without premature scoring lock-in | `GET /topics/:topic/authors` ships with `sortBy=activeMonths\|mentionCount` and no stored composite score |
| G2 | Provide transparent, reusable raw signals to downstream consumers | Raw fields (`mentionCount`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown`) are documented, queryable, tenant-scoped |
| G3 | Support eventual-consistency refresh without live recomputation | `AuthorTopicSignal` refreshes periodically and serves reads without recomputing per request |
| G4 | Lay a foundation for future influencer/expert-ranking features | Future features (e.g., a v2 `influence_score`) can consume `AuthorTopicSignal` and apply their own weighting without core schema changes |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `AuthorTopicSignal` materialized view

- **Description:** a tenant-scoped materialized view aggregating, per `(tenantId, authorId, topic)`, raw activity signals derived from ingested `SocialPost` data.
- **Triggers:** populated/updated by the periodic refresh job (5.2), not by individual post ingestion events.
- **Inputs:** the full set of `SocialPost` rows (with topic linkage, `publishedAt`, engagement, and sentiment enrichment) and their linked `Author` rows (ADR-0004) for a given tenant.
- **Processing:** for each `(tenantId, authorId, topic)` combination present in the post data, compute: `mentionCount` (number of matching posts), `firstMentionAt`/`lastMentionAt` (earliest/latest post timestamps), `activeMonthsCount` (distinct calendar months with at least one mention), `avgEngagement` (average engagement value across the author's posts on that topic), and `sentimentBreakdown` (distribution of positive/neutral/negative posts). No composite score is computed or stored.
- **Outputs:** one row per author/topic/tenant combination, holding only these raw fields.
- **Error handling:** a refresh that fails partway must not leave the view in a half-updated, internally inconsistent state readable by queries — the existing (stale but consistent) data should remain servable until the next successful refresh.
- **Edge cases:** an author with mentions of a topic in only one calendar month has `activeMonthsCount = 1`; a topic with zero enrichment-derived sentiment data for some posts still computes `sentimentBreakdown` over whatever sentiment data is available, not blocked by missing values.

### 5.2 Feature / Capability: Scheduled refresh (not live recomputation)

- **Description:** `AuthorTopicSignal` is refreshed on a scheduled cadence rather than computed live per request.
- **Triggers:** a scheduled job (default cadence decided during implementation per Story 4.4/ADR-0022, described there as hourly via `pg_cron`).
- **Inputs:** the current state of `SocialPost`/`Author`/enrichment data at refresh time.
- **Processing:** recompute the view's aggregates per 5.1; advance a last-refreshed marker; the refresh must not block concurrent reads (NFR-002).
- **Outputs:** an updated, internally consistent `AuthorTopicSignal` view; an observable last-successful-refresh timestamp (NFR-004).
- **Error handling:** a failed refresh is logged/surfaced as an operational signal; reads continue to serve the last successful refresh's data rather than failing.
- **Edge cases:** a refresh that runs long on a large post table — reads during that window continue to serve the prior refresh's data (no blocking), consistent with "brief staleness is acceptable" (NFR-002).

### 5.3 Feature / Capability: `GET /topics/:topic/authors` endpoint

- **Description:** the sole API surface for this capability — returns authors associated with a topic, sorted by one of two supported dimensions, drawing directly from `AuthorTopicSignal`'s raw fields.
- **Triggers:** an API consumer (admin UI, future subsystem) requesting authors for a given topic.
- **Inputs:** the `topic` path parameter; an optional `sortBy` query parameter, one of `activeMonths` or `mentionCount`.
- **Processing:** query `AuthorTopicSignal` filtered to the requesting tenant and the given topic; sort results by the requested dimension (a documented default applies when `sortBy` is omitted); return the raw fields directly — no derived ranking is computed server-side.
- **Outputs:** a list of author/topic raw-signal rows for the requesting tenant, in the requested sort order.
- **Error handling:** an unsupported `sortBy` value is rejected with a clear validation error, not silently defaulted or ignored.
- **Edge cases:** a topic with no matching authors returns an empty result set, not an error; a tenant querying a topic it has never observed behaves identically to one with zero mentions.

### 5.4 Feature / Capability: Tenant isolation on reads

- **Description:** `AuthorTopicSignal` reads (both the view and the endpoint) are strictly tenant-scoped.
- **Triggers:** every read of the view, directly or via the endpoint.
- **Inputs:** the requesting tenant's identity (resolved per the platform's existing auth mechanism).
- **Processing:** RLS (ADR-0015) restricts every row read to the requesting tenant's `tenant_id`; no code path can return another tenant's author/topic signals.
- **Outputs:** a result set containing only rows belonging to the requesting tenant.
- **Error handling:** an attempt to read across tenants is structurally prevented by RLS, not caught after the fact by application logic.
- **Edge cases:** none beyond the standard RLS boundary already established for every other tenant-scoped entity in this system.

### 5.5 Feature / Capability: Additive raw-signal schema

- **Description:** the raw-signal schema is designed to accept new fields (e.g., a future computed score) without breaking existing consumers.
- **Triggers:** a future decision to add a new signal or scoring field to `AuthorTopicSignal`.
- **Inputs:** the proposed new field.
- **Processing:** new fields are added as additional columns; existing fields, their names, and their semantics are never removed or repurposed to accommodate the new field.
- **Outputs:** a schema that grows additively over time.
- **Error handling:** any change that would remove or alter an existing field's meaning is a breaking change requiring its own ADR — not a change this ADR's "raw only" decision sanctions implicitly (per BRU-005, enforced by review/contract tests rather than automatically).
- **Edge cases:** a future v2 scoring layer (e.g., `influence_score`, referenced in the influencer-discovery feature design) — explicitly deferred, and when it arrives, must be additive to this schema, not a replacement of it.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| API Consumer (admin UI, future Social Selling subsystem) | Calls `GET /topics/:topic/authors` and applies its own ranking on the raw signals |
| Scheduled Refresh Job (system actor) | Recomputes `AuthorTopicSignal` on the configured cadence |
| Platform Operator | Monitors refresh success/failure and latency |
| Backend Engineer | Maintains the view's aggregation logic and the endpoint |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 4.1) | API consumer (e.g., a future Social Selling subsystem) | have `GET /topics/:topic/authors` backed by a periodically refreshed `AuthorTopicSignal` view exposing raw signals — `mentionCount`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown` — with no baked-in composite score | I can apply my own ranking logic (e.g. weighting sustained engagement over burst activity) instead of being locked into one opinionated formula | (1) view contains no `expertiseScore`/equivalent; (2) endpoint accepts `sortBy=activeMonths\|mentionCount`; (3) view refreshed on schedule, not live per request; (4) signals are tenant-scoped, no cross-tenant access; (5) row shape stable as new fields are added later |

### 6.3 Workflow Diagrams / Steps

**Workflow: Scheduled refresh**

1. Scheduled job fires (cadence per Story 4.4/ADR-0022).
2. Job aggregates `SocialPost`/`Author`/enrichment data per `(tenantId, authorId, topic)` into raw signals (5.1).
3. Job writes the recomputed view, advancing the last-refreshed marker; reads continue uninterrupted during this process.
4. If the refresh fails, the prior successful state remains servable and the failure is logged/surfaced (NFR-004).

**Workflow: Consumer expert-finder query**

1. Consumer calls `GET /topics/:topic/authors?sortBy=mentionCount` (or `activeMonths`, or omits it for the default).
2. Endpoint resolves the requesting tenant, queries `AuthorTopicSignal` filtered to that tenant and topic, sorted as requested.
3. Endpoint returns the raw-signal rows; the consumer applies its own composite ranking logic on top, if desired.

---

## 7. Data Requirements

### 7.1 Data Inputs

`SocialPost` rows (topic linkage, `publishedAt`, engagement, sentiment enrichment); `Author` rows (ADR-0004) providing the author anchor; tenant identity for scoping.

### 7.2 Data Outputs

`AuthorTopicSignal` view rows (raw signals per author/topic/tenant); `GET /topics/:topic/authors` API responses (sorted raw-signal rows).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `AuthorTopicSignal` | `tenantId`, `authorId`, `topic` (composite key); `mentionCount`, `firstMentionAt`, `lastMentionAt`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown` | Aggregates `SocialPost` rows linked to `Author` (ADR-0004); refreshed periodically, not live |
| `Author` (referenced) | normalized author entity | Anchor for each `AuthorTopicSignal` row; owned by ADR-0004 |
| `SocialPost` (referenced) | topic linkage, `publishedAt`, engagement, sentiment enrichment | Source data aggregated into `AuthorTopicSignal`; owned by earlier ADRs |

### 7.4 Validation Rules

- `AuthorTopicSignal` stores only raw, tenant-scoped, author/topic signals; no computed expertise or influence score is stored (BRU-001).
- `GET /topics/:topic/authors` supports exactly two sorting options: `activeMonths` and `mentionCount` (BRU-002); any other value is rejected.
- Author-topic signals are eventually consistent with the underlying post/enrichment data — the refresh cadence is the source of truth for freshness (BRU-003).
- Cross-tenant access to any author/topic signal is prohibited by RLS (BRU-004).
- Any future scoring or weighting is the consumer's responsibility, not the core `AuthorTopicSignal` view's (BRU-005).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `AuthorTopicSignal` stores only raw signals; no computed expertise/influence score is stored. | `AuthorTopicSignal` |
| BR2 | `GET /topics/:topic/authors` supports exactly `sortBy=activeMonths` and `sortBy=mentionCount`, nothing else. | API endpoint |
| BR3 | The view is refreshed on a schedule, never recomputed live per request. | Refresh mechanism |
| BR4 | Cross-tenant access to any author/topic signal is prohibited. | All reads |
| BR5 | Any composite ranking/weighting is the consumer's responsibility, not the core view's. | API consumers |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `Author` model (ADR-0004) | Inbound to view | Provides the author anchor for each signal row | In-process / Postgres |
| `SocialPost` + enrichment | Inbound to view | Source data aggregated into raw signals | In-process / Postgres |
| Derived-data refresh strategy (ADR-0022) | Scheduling | Governs the refresh cadence and mechanism (e.g., `pg_cron`) | Postgres scheduled job |
| `GET /topics/:topic/authors` | Outbound | Public REST surface for this capability | HTTPS REST / JSON |
| RLS (ADR-0015) | Enforcement | Tenant isolation on all reads | Postgres row-level security |
| Future influencer-discovery layer (out of scope here) | Future consumer | Would layer a computed score on top of these raw signals | REST / JSON (future) |

---

## 10. Non-Functional Considerations

- **Performance:** `GET /topics/:topic/authors` must respond within acceptable latency for pre-aggregated data — p95 under 500ms for typical tenant topic queries (NFR-001).
- **Security/access control:** RLS enforces tenant isolation on both the view and the endpoint (NFR-003).
- **Scalability:** using a periodically refreshed materialized view instead of live aggregation avoids recomputing `activeMonthsCount`/`avgEngagement`/`sentimentBreakdown` per request against a high-volume, unbounded post table.
- **Reliability/availability:** refresh must not block reads (NFR-002); brief staleness between refreshes is an accepted tradeoff.
- **Audit and logging:** refresh schedule and last-refresh timestamp must be observable, including refresh failures (NFR-004).
- **Extensibility:** the schema must remain additive — new fields (including a possible future score) must not break existing consumers (BR-006).
- **Accessibility/localization:** not applicable — this is a backend/API capability with no direct UI in this iteration.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Unsupported `sortBy` value requested | Clear validation error naming the two supported values | Request rejected, not silently defaulted |
| Scheduled refresh fails partway | N/A (operator-facing, via logs/metrics) | Prior successful refresh's data remains servable; failure logged for NFR-004 |
| Topic with no matching authors queried | Empty result set | Not treated as an error |
| A consumer expects a single "best expert" field | N/A (documented limitation) | Consumer must compose its own ranking from raw fields — a deliberate design choice, not a gap to patch silently |
| Cross-tenant read attempted | N/A (structurally prevented) | RLS blocks the read; never reaches application-level handling |

---

## 12. Assumptions and Dependencies

- `Author` already exists as a normalized, tenant-scoped entity per ADR-0004.
- `SocialPost` records carry topic linkage and tenant-scoped `publishedAt`, engagement, and sentiment data.
- Downstream consumers (including future subsystems) are willing and able to compose their own ranking from raw signals.
- Hourly refresh latency (or whatever cadence Story 4.4/ADR-0022 settles on) is acceptable for this first version.
- Dependency: ADR-0004 (`Author` normalization) is a hard predecessor.
- Dependency: ADR-0022 (derived-data caching and refresh strategy) governs the actual refresh cadence and mechanism — not decided by this ADR.
- Dependency: ADR-0015/ADR-0032 (RLS/tenant isolation) provide the enforcement mechanism for tenant-scoped reads.
- Related, deferred: `docs/product-research/feature-designs/05-influencer-discovery.md` describes how a future `influence_score` could be layered on these raw signals — explicitly out of scope for this v1.
- Related: `docs/product-research/feature-designs/04-ai-topic-clustering.md` references this view's refresh pattern and topic-level exploration.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What is the actual chosen refresh cadence (hourly via `pg_cron` was the design-time example, not a hard requirement of this ADR)? | Technical Lead | Resolved by Story 4.4/ADR-0022 |
| Q2 | When (if ever) does a v2 computed scoring layer get built, and does it live inside `AuthorTopicSignal` (additive column) or as a separate consumer-side artifact? | Product Owner | Deferred — revisit once real demand is validated, per BRD-0007 R-001 mitigation |

---

## 14. Appendix

- **Glossary:** see BRD-0007 §15 (`AuthorTopicSignal`, Raw signal, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown`, Expert finder).
- **Reference links:** `docs/adr/0007-author-topic-signal-minimal-v1.md`; `docs/project docs/Business-Requirements/BRD-0007-Author-Topic-Signal-Minimal-V1.md`; `docs/user-stories/epic-4-derived-data-analytics-and-health.md` (Story 4.1, Story 4.4); `docs/adr/0004-author-normalized-separately-from-post.md`; `docs/adr/0022-derived-data-caching-and-refresh-strategy.md`.
- **Feature design/deep research:** `docs/product-research/feature-designs/05-influencer-discovery.md` (describes a future `influence_score` layered on these raw signals — deferred, not built here); `docs/product-research/feature-designs/04-ai-topic-clustering.md` (references this view's refresh pattern). No `docs/product-research/reports/<feature>-deep-research.md` file was found for this capability, per BRD-0007 Appendix E.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0007/BRD-0007/Story 4.1 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
