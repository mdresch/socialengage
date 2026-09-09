# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0087 Preconfigured Analytics Views — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-27 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Approved |
| Related Documents | ADR-0087 (preconfigured analytics views, Accepted 2026-08-27), ADR-0008 (deferred `TopicDailyCount` to a future subsystem, now superseded), ADR-0015 (tenant RLS), ADR-0018 (retention), ADR-0049 (source of `sum_reach`), ADR-0054 (Tenant Analytics Dashboard, client-side architecture, partially superseded), ADR-0104 (source of `topic_id`), BRD-0087, `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`, `docs/product-research/feature-designs/08-dashboards-and-analytics.md`, `docs/product-research/feature-designs/25-topic-evolution-timeline.md`, Story 10.3 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0087's accepted decision — five tenant-scoped precomputed daily aggregate tables, a scheduled refresh worker, and query-routing rules that prefer them over scanning `social_posts` — into a functional design covering table refresh behavior, query routing, and the data these views expose.

**Note:** ADR-0087 was **Accepted** on 2026-08-27, as revised through architectural review. Story 10.3 is Ready. This FDD reflects the accepted decision, not the original 2026-08-23 draft.

### 2.2 Scope

- **In scope:** the five `*DailyCount` tables (`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`); the `RefreshAnalyticsViews` worker and its 15-minute schedule; late-arriving-post recomputation; provisional current-day handling; `GET /v1/analytics/:view` query routing between precomputed tables and `social_posts` fallback; the no-raw-content constraint on aggregate rows; `topic_id` sourcing and merge semantics (ADR-0104); the documented partial coverage of `sum_reach` (ADR-0049) and `sum_engagement` (Facebook-only, v1); the additive relationship to the existing client-side Analytics Dashboard (ADR-0054).
- **Out of scope:** native Postgres continuous aggregates/TimescaleDB (rejected alternative); long-term retention policy for aggregate tables (deferred, to align with ADR-0018); per-post precomputation at ingestion time; ad-hoc query UI (ADR-0088) and publishing/composer flows; a universal per-post engagement-capture mechanism beyond Facebook; actually migrating any Epic 8 dashboard widget to these tables (separate follow-up work, ADR-0087 Decision §8).

### 2.3 Target Audience

Backend engineers implementing the schema and refresh worker, engineers building dashboard/analytics endpoints that consume these views, QA authoring contract and performance tests, and the Product Owner.

---

## 3. Context and Background

Dashboards and analytics widgets need time-series and grouped metrics over post volumes that grow without bound as tenants ingest more content; computing these by scanning `social_posts` on every page load becomes slow and expensive. `ADR-0008` ("Defer `TopicDailyCount` aggregation and all charting to a future subsystem," Accepted 2026-07-28) explicitly declined to build this aggregation inside the `SocialPost` ingestion subsystem, reserving it for a future analytics layer once real dashboard requirements existed. ADR-0087 is that layer, and formally supersedes ADR-0008's aggregation-table clause (ADR-0087 Decision §1) — existing tables and events (`social_posts`, `post_watchlist_matches`, `author_topic_signals`, `SocialPostIngestedEvent`) already contain everything needed to compute daily counts, so a decoupled scheduled worker (not the ingestion hot path) maintains them.

Separately, `ADR-0054` (Accepted 2026-08-17) already shipped a Tenant Analytics Dashboard (Epic 8) computed entirely client-side from paginated `GET /v1/posts`. ADR-0087 does not replace that dashboard — it partially supersedes ADR-0054's "no new backend endpoint" clause for a named subset of widgets only (ADR-0087 Decision §8), while several widgets (word cloud, languages, Top Fans/Critics, Spike Storyteller, Location) remain client-side because no table here carries phrase, language, per-author-sentiment, or geo data.

Source requirements: ADR-0087, BRD-0087, Story 10.3 (`docs/user-stories/epic-10-adr-0086-to-0094.md`). This is foundational for planned downstream features: topic evolution timeline (ADR-0097), ad-hoc query (ADR-0088), and real-time alerts (ADR-0091) — both ADR-0097 and ADR-0104 are already Proposed ADRs written directly against this one.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make dashboard/analytics queries fast and predictable | Full-day aggregate queries complete under 500ms at p95 |
| G2 | Decouple analytics workload from ingestion | Refresh runs as a separate, retryable, idempotent worker that does not touch the ingestion hot path |
| G3 | Bound and document freshness | Current-day data is at most ~15 minutes behind real-time ingestion |
| G4 | Provide a reusable aggregate layer for future features | `*DailyCount` tables are the documented data source for topic evolution, ad-hoc query, and alerts |
| G5 | Supplement, not replace, the existing Epic 8 dashboard | Named widgets (ADR-0087 Decision §8) are eligible to migrate; everything else keeps working exactly as ADR-0054 shipped it |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: The Five `*DailyCount` Aggregate Tables

- **Description:** Five tenant-scoped tables holding precomputed daily counts/sums for topics, sources (platforms), authors, sentiment, and watchlists.
- **Triggers:** Populated/updated by the refresh worker (Section 5.2); read by dashboard/analytics endpoints (Section 5.3).
- **Inputs:** `social_posts` (counts, `published_at`), `social_posts.author_follower_count_at_publish` (ADR-0049, source of `sum_reach`), Facebook Page engagement counts (Story 2.18, source of `sum_engagement`), `post_watchlist_matches` (watchlist association), ADR-0104's `topics` catalog (source of `topic_id`).
- **Processing:** Each table is keyed by `(tenant_id, date, <dimension>)` with a composite primary key and `tenant_id` RLS. Columns hold only counts/sums/averages/identifiers:
  - `TopicDailyCount(tenant_id, date, topic_id, count, sum_reach, sum_engagement, avg_sentiment_score, unique_authors)`
  - `SourceDailyCount(tenant_id, date, platform_id, count, sum_reach, sum_engagement, avg_sentiment_score)`
  - `AuthorDailyCount(tenant_id, date, author_id, platform_id, count, sum_reach, sum_engagement)`
  - `SentimentDailyCount(tenant_id, date, sentiment, count, sum_reach)` — `sentiment ∈ {positive, negative, neutral, mixed}`
  - `WatchlistDailyCount(tenant_id, date, watchlist_id, count, sum_reach, sum_engagement, unique_authors)`
  - Indexes on `(tenant_id, date)` and `(tenant_id, watchlist_id, date)`.
  - `topic_id` foreign-keys to ADR-0104's `topics` catalog, populated by `TopicClusteringService` — not `AIProviderConnector` output, not `watchlists`. A topic merge is **not backfilled**: the merged topic's counts start from the merge date; pre-merge rows keep their original `topic_id` (ADR-0104 §6).
  - `sum_reach` is `NULL` wherever `author_follower_count_at_publish` is `NULL` — by design, for organization-as-Author connectors with no follower-count concept (Newswire, GNews, Wikipedia). `SUM()` already skips these; do not divide by `count` to get an average — a `count_with_known_reach`-style denominator would be needed for that.
  - `sum_engagement` is Facebook-only for v1 — `NULL` for every other connector's posts. This is a deliberate v1 scope decision, not a placeholder for imminent expansion.
- **Outputs:** Queryable rows consumed by `GET /v1/analytics/:view` and, in future, other analytics features.
- **Error handling:** A read against another tenant's rows is blocked by RLS, not by application-level filtering alone.
- **Edge cases:** A `(tenant_id, date, dimension)` combination with zero matching posts simply has no row (not a zero-valued row), unless the refresh worker's design explicitly writes zero rows for continuity — this should be a consistent, documented choice.

### 5.2 Feature / Capability: `RefreshAnalyticsViews` Worker

- **Description:** A scheduled worker that (re)computes daily aggregate rows from source tables, decoupled from ingestion.
- **Triggers:** Runs on a fixed schedule (every 15 minutes) via `pg_cron` or an equivalent scheduler.
- **Inputs:** `social_posts` rows with `published_at` in the relevant window and `updated_at` after the worker's last successful refresh; `post_watchlist_matches`; ADR-0104's `topics`/`post_topics` tables.
- **Processing:**
  1. Identify the set of `(tenant_id, date)` buckets affected since the last run — both newly-published posts and late-arriving posts (a post whose `published_at` falls in an already-computed historical bucket but was ingested/updated afterward).
  2. For each affected bucket and each of the five dimensions, recompute the aggregate row(s) from scratch (or via an equivalent idempotent incremental method) so re-running the same window never double-counts.
  3. Write/upsert the recomputed rows; this write is idempotent — running the same refresh window twice produces the same final counts.
  4. For the current, still-in-progress calendar day, the worker writes a provisional row that gets overwritten on the next run rather than treating the day as immutable.
- **Outputs:** Updated/inserted rows in the five `*DailyCount` tables; worker run metadata (last refresh window, affected buckets, run status).
- **Error handling:** A failed run is retryable without producing duplicate or inflated counts (idempotency is the safety net); failures should be observable (surfaced to the refresh-failure-rate metric, BRD-0087 Section 11).
- **Edge cases:** A late-arriving post that lands in a bucket from weeks or months ago must still trigger recomputation of exactly that bucket, not a full table rebuild. A burst of late-arriving posts across many buckets should not overwhelm a single 15-minute run — batching/prioritization is an implementation concern but must not silently drop buckets.

### 5.3 Feature / Capability: `GET /v1/analytics/:view` Query Routing

- **Description:** Serves aggregate data for one of the five views, preferring the precomputed tables and falling back to `social_posts` only when necessary. **This endpoint is additive to Epic 8's existing client-side dashboard (ADR-0054) — it does not replace `GET /v1/posts` for any widget not named in ADR-0087 Decision §8.**
- **Triggers:** A dashboard/analytics client requests `GET /v1/analytics/:view` where `:view ∈ {topics, sources, authors, sentiments, watchlists}`.
- **Inputs:** `:view`, a requested date range, the caller's `tenant_id`, and optional dimension filters (e.g., a specific `watchlist_id`).
- **Processing:**
  - For any full (completed) day within the requested range, the endpoint reads from the corresponding `*DailyCount` table.
  - For the current, still-in-progress day, or when the caller needs individual-post drill-down, the endpoint falls back to querying `social_posts` directly, bounded by a small limit to avoid an expensive scan.
  - Results across the date range are assembled from the mix of precomputed (historical) and live-fallback (current partial day) sources as needed.
  - Click-to-filter/drill-down into the actual matching posts is never served from this endpoint — it always requires `GET /v1/posts`, since these tables carry no `post_id` list (§5.4).
- **Outputs:** A tenant-scoped, date-ranged aggregate response for the requested view.
- **Error handling:** An unrecognized `:view` value is a validation error. A date range spanning data the tenant does not have RLS visibility into simply returns nothing for those dates (RLS-enforced), not an error.
- **Edge cases:** A date range entirely within "today" relies solely on the `social_posts` fallback and never touches the aggregate tables at all. A range spanning historical + current-day mixes both sources and must present a single coherent response.

### 5.4 Feature / Capability: PII/Content Minimization on Aggregate Rows

- **Description:** Aggregate rows are restricted to counts, sums, and identifiers — never raw post content.
- **Triggers:** Applies continuously to every write in the refresh worker (Section 5.2).
- **Inputs:** N/A — a constraint on what gets written, not a separate trigger.
- **Processing:** No column in any `*DailyCount` table holds a `post_id` list or `rawPayload`; `WatchlistDailyCount` may reference `watchlist_id` (a configuration identifier, not content) but nothing more granular per-post.
- **Outputs:** Aggregate rows safe to retain/query without re-exposing individual post content.
- **Error handling:** A schema/contract check should reject any refresh-worker write that includes a disallowed column (defense in depth).
- **Edge cases:** None beyond the general constraint — this is a structural guarantee of the schema itself.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Backend Engineer | Implements the schema and refresh worker |
| Dashboard/analytics endpoints (system consumer) | Query the views via `GET /v1/analytics/:view` |
| Tenant-Reader / Tenant-Business-Analyst | End users experiencing faster dashboards as a result |
| Platform-Admin / Sole-Operator | Monitors refresh health, lag, and storage growth |
| Performance Review Agent | Verifies the non-functional performance target is met |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 10.3) | Backend engineer | Have the five daily-count tables and a refresh worker | Dashboards can read fast, precomputed aggregates | Tables exist with PKs and indexes; `RefreshAnalyticsViews` runs every 15 minutes and is idempotent; late-arriving posts trigger re-computation; current partial day is handled; `topic_id`/reach/engagement sourcing documented; endpoint is additive to Epic 8, not a replacement |

### 6.3 Workflow Diagrams / Steps

**Refresh cycle (every 15 minutes):**
1. Worker wakes on schedule.
2. Determines the set of `(tenant_id, date)` buckets touched since the last run — new posts plus late-arriving posts landing in older buckets.
3. Recomputes and idempotently upserts the affected rows across all five tables.
4. Writes/overwrites the provisional current-day row.
5. Records run status/metadata for monitoring.

**Dashboard query:**
1. Client requests `GET /v1/analytics/:view` with a date range and tenant context.
2. For each full day in range, the endpoint reads the matching `*DailyCount` rows.
3. For the current partial day (or a drill-down request), the endpoint queries `social_posts` directly with a bounded limit.
4. The endpoint assembles and returns a single tenant-scoped response.

---

## 7. Data Requirements

### 7.1 Data Inputs

`social_posts` (post counts, `published_at`, `updated_at`); `social_posts.author_follower_count_at_publish` (ADR-0049, `sum_reach` source); Facebook Page engagement counts (Story 2.18, `sum_engagement` source, Facebook-only); `post_watchlist_matches` (watchlist association); ADR-0104's `topics`/`post_topics` (topic relevance and `topic_id`); `SocialPostIngestedEvent` stream (signals new/changed posts driving refresh scope).

### 7.2 Data Outputs

Rows in the five `*DailyCount` tables; `GET /v1/analytics/:view` responses; refresh worker run metadata for operational monitoring.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `TopicDailyCount` | `tenant_id`, `date`, `topic_id`, `count`, `sum_reach`, `sum_engagement`, `avg_sentiment_score`, `unique_authors` | Composite PK `(tenant_id, date, topic_id)`; `topic_id` references ADR-0104's `topics` catalog, not merged/backfilled on topic merge |
| `SourceDailyCount` | `tenant_id`, `date`, `platform_id`, `count`, `sum_reach`, `sum_engagement`, `avg_sentiment_score` | Composite PK `(tenant_id, date, platform_id)`; derived from `social_posts` |
| `AuthorDailyCount` | `tenant_id`, `date`, `author_id`, `platform_id`, `count`, `sum_reach`, `sum_engagement` | Composite PK `(tenant_id, date, author_id, platform_id)`; derived from `social_posts` |
| `SentimentDailyCount` | `tenant_id`, `date`, `sentiment`, `count`, `sum_reach` | Composite PK `(tenant_id, date, sentiment)`; derived from `social_posts` sentiment field |
| `WatchlistDailyCount` | `tenant_id`, `date`, `watchlist_id`, `count`, `sum_reach`, `sum_engagement`, `unique_authors` | Composite PK `(tenant_id, date, watchlist_id)`; derived from `post_watchlist_matches` |
| `RefreshAnalyticsViews` worker state | Last refresh window, affected buckets, run status | Operational metadata, not tenant-scoped |

### 7.4 Validation Rules

- Every `*DailyCount` table enforces `tenant_id` RLS; no cross-tenant read is possible.
- Primary keys are composite on `(tenant_id, date, <dimension>)` for each table — no duplicate rows for the same key.
- `sentiment` in `SentimentDailyCount` must be one of `positive`/`negative`/`neutral`/`mixed`.
- No column may hold a `post_id` list or `rawPayload`.
- `topic_id` must resolve against ADR-0104's `topics` catalog; there is no other valid source.
- Refresh writes are idempotent: re-running the same window must not change the final state beyond correctly reflecting the latest source data.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Every aggregate table has a `tenant_id` RLS policy so a tenant can only read its own daily counts. | All five tables |
| BR2 | Primary keys are composite on `(tenant_id, date, ...)` for each aggregate table. | All five tables |
| BR3 | Refresh is idempotent: re-running the same refresh window must not produce duplicate or inflated counts. | `RefreshAnalyticsViews` |
| BR4 | Aggregate rows must not contain raw post bodies, `post_id` lists, or `rawPayload`. | All five tables |
| BR5 | The current partial-day row may be provisional and is overwritten on the next refresh run. | `RefreshAnalyticsViews` |
| BR6 | Late-arriving posts trigger re-computation only for the affected `(tenant_id, date)` bucket, not a full rebuild. | `RefreshAnalyticsViews` |
| BR7 | Dashboard/analytics endpoints prefer precomputed tables for full days and fall back to `social_posts` (with a limit) for partial days or drill-down. | `GET /v1/analytics/:view` |
| BR8 | `topic_id` is sourced from ADR-0104's `topics` catalog only; a topic merge is not backfilled into pre-merge historical rows. | `TopicDailyCount` |
| BR9 | `sum_reach` is `NULL` for organization-as-Author connectors; `sum_engagement` is `NULL` for every connector except Facebook in v1. | All applicable tables |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `social_posts` | Inbound (read) | Primary source for counts, `published_at` | SQL (Postgres, RLS-scoped) |
| `social_posts.author_follower_count_at_publish` (ADR-0049) | Inbound (read) | Source of `sum_reach`; `NULL` for organization-as-Author connectors | SQL |
| Facebook Page engagement counts (Story 2.18) | Inbound (read) | Source of `sum_engagement`; Facebook-only in v1 | SQL |
| `post_watchlist_matches` | Inbound (read) | Source for `WatchlistDailyCount` | SQL |
| ADR-0104's `topics`/`post_topics` | Inbound (read) | Source for `TopicDailyCount.topic_id` and merge semantics | SQL |
| `SocialPostIngestedEvent` | Inbound (signal) | Indicates new/changed posts that may affect refresh scope | Internal event stream |
| `pg_cron` (or equivalent scheduler) | Trigger | Runs `RefreshAnalyticsViews` every 15 minutes | Postgres scheduled job |
| Epic 8 dashboard (ADR-0054, additive relationship) | Outbound | Named widgets (ADR-0087 Decision §8) are eligible to read `*DailyCount` via `GET /v1/analytics/:view`; all other widgets keep reading `GET /v1/posts` | REST / JSON over HTTPS + internal SQL |
| Future consumers: topic evolution timeline (ADR-0097), ad-hoc query (ADR-0088), real-time alerts (ADR-0091) | Outbound | Reuse `*DailyCount` as their data source | Internal SQL / service call |

---

## 10. Non-Functional Considerations

- **Performance:** Full-day aggregate queries complete under 500ms at p95 (NFR-001).
- **Security / access control:** All aggregate tables enforce tenant RLS; cross-tenant data is never exposed (NFR-002).
- **Reliability:** The refresh worker is decoupled from the ingestion hot path and is retryable without degrading ingestion throughput or double-counting on retry (NFR-003).
- **Freshness:** Current-partial-day data is bounded to roughly 15 minutes behind real-time ingestion (NFR-004).
- **Maintainability:** Refresh/aggregation logic should be defined once and reused by future ad-hoc query features rather than duplicated (NFR-005).
- **Storage:** Aggregate tables are far smaller than raw posts but still accumulate over time; retention policy is explicitly deferred (see Open Questions), to be aligned with ADR-0018.
- **Data completeness:** `sum_reach` and `sum_engagement` are partially covered by design (ADR-0049 NULL semantics; Facebook-only engagement) — any dashboard consuming them must account for this, not assume full coverage.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Refresh worker run fails partway | N/A (operational alert) | Logged; retried on next schedule without double-counting due to idempotency |
| Unrecognized `:view` value on `GET /v1/analytics/:view` | Validation error (400) | Request rejected before any query executes |
| Request for a tenant's aggregate outside RLS visibility | Empty result / not found | Enforced by RLS at the database layer, not application filtering alone |
| Late-arriving post lands in a very old bucket | N/A (transparent to caller) | Recomputation scoped to that specific bucket on the next refresh run |
| Current-day drill-down request | N/A | Served via `social_posts` fallback, bounded by a small limit |

---

## 12. Assumptions and Dependencies

- `social_posts`, `post_watchlist_matches`, ADR-0104's `topics`/`post_topics`, and `SocialPostIngestedEvent` data are complete enough to drive accurate daily aggregates.
- `pg_cron` or equivalent scheduled-worker infrastructure is available.
- Dashboard consumers accept up to a 15-minute freshness delay for the current partial day.
- Must remain compatible with the existing `social-listening-core` Postgres schema and RLS model (ADR-0015).
- ADR-0008's aggregation-table clause is superseded by this ADR (Decision §1); its charting-UI clause remains governed by ADR-0054's earlier, separate supersession.
- ADR-0054's Epic 8 dashboard keeps working unchanged except for the specific widgets named in ADR-0087 Decision §8, which are *eligible* to migrate in separate follow-up work — not migrated by this ADR itself.
- Aggregate retention policy will be aligned with ADR-0018 raw-payload retention, but that alignment is deferred past this ADR's scope.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| ~~Q1~~ | ~~Should the current partial-day row be computed in real time (provisional) or excluded entirely until the next refresh?~~ | — | **Resolved:** provisional, overwritten on the next run, with query-time fallback to `social_posts` for the partial day (ADR-0087 Decision §4/§5). |
| Q2 | How far back should daily aggregates be retained, and how does that relate to ADR-0018's raw-payload retention policy? | Technical Lead | Still open — before implementation |
| ~~Q3~~ | ~~Should `TopicDailyCount` derive topic IDs from `AIProviderConnector` output or from user-defined `watchlists`?~~ | — | **Resolved:** neither — from ADR-0104's `topics` catalog (ADR-0087 Decision §7). |
| ~~Q4~~ | ~~How are topic merges reflected in historical daily counts — backfill, versioning, or left as-is?~~ | — | **Resolved:** left as-is, not backfilled; the merged topic's counts start from the merge date (ADR-0104 §6, ADR-0087 Decision §7). |

---

## 14. Appendix

- **ADR:** `docs/adr/0087-preconfigured-analytics-views.md` (Status: **Accepted**, 2026-08-27)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0087-Preconfigured-Analytics-Views.md`
- **Feature design:** `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`; consumers: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`, `docs/product-research/feature-designs/25-topic-evolution-timeline.md`, `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** `ADR-0008` (deferred `TopicDailyCount`, now superseded — `docs/adr/0008-defer-topic-time-series-and-charting.md`), `ADR-0015` (tenant RLS), `ADR-0018` (retention), `ADR-0049` (source of `sum_reach` — `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md`), `ADR-0054` (Tenant Analytics Dashboard, partially superseded — `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md`), `ADR-0104` (source of `topic_id` — `docs/adr/0104-ai-topic-clustering-post-topics-schema.md`)
- **User stories:** Story 10.3 (`docs/user-stories/epic-10-adr-0086-to-0094.md`) — Ready
- **Glossary:**
  - *Preconfigured analytics view* — a precomputed, tenant-scoped daily aggregate table optimized for dashboard/analytics queries.
  - *`*DailyCount` tables* — the five aggregate tables authorized by this ADR.
  - *Partial day* — the current calendar day, not yet complete, represented by a provisional aggregate.
  - *Late-arriving post* — a post whose `published_at` falls in an already-computed bucket but is ingested/updated afterward.
  - *`topic_id`* — a reference into ADR-0104's `topics` catalog; not sourced from `AIProviderConnector` or `watchlists`.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0087/BRD-0087. v0.2, 2026-08-27 — synced to ADR-0087's accepted revision: corrected the ADR-0008 mischaracterization, added ADR-0049/0054/0104 as real dependencies, documented `topic_id` sourcing/merge semantics and `sum_reach`/`sum_engagement` partial coverage, documented the additive (not replacing) relationship to ADR-0054's Epic 8 dashboard, and resolved three of four Open Questions.
