# Business Requirements Document — Preconfigured Analytics Views

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Preconfigured Analytics Views Business Requirements Document |
| Version | 1.1 |
| Date | 2026-08-27 |
| Author(s) | BRD Writer Agent (Product Owner) |
| Approver(s) | Menno, Solo Operator / Product Owner |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0087 and `27-preconfigured-analytics-views.md` |
| 1.1 | 2026-08-27 | Technical Lead | Synced to ADR-0087's accepted revision: fixed the ADR-0008 mischaracterization and three fabricated footnote paths; documented `topic_id` sourcing/merge semantics (ADR-0104), `sum_reach`'s real source and NULL semantics (ADR-0049), and `sum_engagement`'s Facebook-only v1 scope; documented the additive (not replacing) relationship to the existing client-side Analytics Dashboard (ADR-0054) |

---

## 2. Executive Summary

Dashboards, analytics widgets, and time-series charts in SocialEngage currently risk expensive, repeated scans of the large `social_posts` table as tenants accumulate data. ADR-0087 (**Accepted 2026-08-27**) authorizes a family of tenant-scoped, precomputed daily aggregate tables that isolate the analytics workload from the ingestion hot path. This Business Requirements Document captures the business case for building `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`, together with a scheduled `RefreshAnalyticsViews` worker and dashboard query-routing rules that prefer the precomputed tables.

The expected outcome is faster, more predictable dashboard performance, lower per-request database cost, and a foundation for planned analytics features such as topic evolution timelines, ad-hoc querying, and real-time alerts. This is additive to, not a replacement for, the already-shipped client-side Analytics Dashboard (ADR-0054/Epic 8) — see §4.1 and §13 for which specific dashboard widgets are eligible to migrate to these tables.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce dashboard and analytics query latency | 95th percentile chart-response time under 500 ms for full-day aggregates |
| 2 | Lower recurring database compute cost | Eliminate repeated full-table scans of `social_posts` for aggregate dashboard requests |
| 3 | Improve reliability of analytics under load | Dashboard queries do not degrade the ingestion pipeline or other tenants |
| 4 | Enable future analytics capabilities (topic evolution, ad-hoc query, alerts) | `*DailyCount` tables are the documented data source for ADR-0097, ADR-0088, and ADR-0091 |
| 5 | Provide transparently faster UX | Users see the same dashboard endpoints; backend routing chooses the fastest source automatically |

---

## 4. Scope

### 4.1 In Scope

- Five tenant-scoped daily aggregate tables: `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`.
- Composite primary keys, tenant RLS policies, and supporting indexes.
- A `RefreshAnalyticsViews` worker that runs every 15 minutes and recomputes affected `(tenant_id, date)` buckets.
- Late-arriving post handling and provisional current-day aggregation.
- Dashboard and analytics endpoint routing that prefers precomputed tables for full days and falls back to `social_posts` for partial days or drill-down.
- `GET /v1/analytics/:view` endpoint exposing `topics`, `sources`, `authors`, `sentiments`, and `watchlists` views.
- `topic_id` sourced from ADR-0104's `topics` catalog (`TopicClusteringService`); topic merges are not backfilled into historical rows (ADR-0104 §6).
- Documented partial coverage on the two reach/engagement columns: `sum_reach` is computed from `social_posts.author_follower_count_at_publish` (ADR-0049) and is `NULL` for organization-as-Author connectors with no follower concept (Newswire, GNews, Wikipedia); `sum_engagement` is Facebook-only for v1 and `NULL` for every other connector's posts.
- An additive relationship to the existing, already-shipped client-side Analytics Dashboard (ADR-0054/Epic 8) — this ADR does not replace it. ADR-0087 Decision §8 names exactly which Epic 8 widgets (Overview KPIs/comparison, Sentiment donut/trend, Sources volume-over-time, Sentiment Trajectory/Gauge/Authors-by-Source/Top-Authors, Watchlist Coverage) are eligible to migrate to these tables, and which stay client-side because no table here covers phrase, language, per-author-sentiment, or geo data.

### 4.2 Out of Scope

- Native Postgres continuous aggregates or TimescaleDB (rejected alternative).
- Long-term retention policy for aggregate tables (deferred to ADR-0018 alignment).
- Real-time, per-post precomputation at ingestion time.
- Inclusion of raw post bodies, `post_id` lists, or `rawPayload` in aggregate rows.
- Ad-hoc query UI and publishing/composer flows.
- Actually migrating any Epic 8 dashboard widget to these tables — that is separate, not-yet-scheduled follow-up implementation work (ADR-0087 Decision §8), not performed by this ADR.
- Building a universal per-post engagement-capture mechanism across every connector — `sum_engagement` ships Facebook-only for v1 by deliberate decision, not as a placeholder for imminent expansion.

### 4.3 Assumptions

- Existing `social_posts`, `post_watchlist_matches`, `author_topic_signals`, and `SocialPostIngestedEvent` data is complete enough to drive accurate daily aggregates.
- `pg_cron` or an equivalent scheduled worker infrastructure is available in the target environment.
- Dashboard consumers are willing to accept up to a 15-minute freshness delay for the current partial day.
- ADR-0104's `topics` catalog and `TopicClusteringService` are the authoritative source for `topic_id` — not `AIProviderConnector` output and not `watchlists`.

### 4.4 Constraints

- Must preserve tenant isolation through RLS on all aggregate tables.
- Must not couple the refresh pipeline to the ingestion hot path.
- Must remain compatible with the existing `social-listening-core` Postgres schema and RLS model (ADR-0015).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Reader | Daily consumer of dashboards and charts | High | Dashboards load quickly and reliably |
| Tenant-Business-Analyst | Runs time-series and grouped analytics queries | High | Fast aggregation without long waits |
| Sole-Operator | Platform owner and cost controller | High | Avoid runaway database load from ad-hoc queries |
| Platform-Admin | Monitors platform health and storage | Medium | Visibility into view-refresh health and storage growth |
| Performance Review Agent | Verifies non-functional targets | Medium | Expensive analytics no longer scan raw tables at request time |
| Topic-Center-Analyst | Explores topic evolution | Medium | Accurate `TopicDailyCount` over time |
| Tenant-Brand-Reputation-Manager | Monitors crisis metrics | Medium | Near-current crisis metrics with acceptable freshness |

---

## 6. Current State (As-Is)

**Current process:** Dashboard and analytics features (Epic 8, ADR-0054/0055/0062/0063/0064, and the planned topic-evolution timeline) compute time-series or grouped metrics by querying the raw `social_posts` table on every request, entirely client-side in `social-listening-admin`. As tenants ingest more posts, these aggregate queries scan an increasing number of rows, causing variable latency and raising the risk of cross-tenant or cross-feature performance contention.

**Pain points:**
- Dashboard chart load times grow with post volume.
- Repeated identical aggregate queries re-scan the same raw rows.
- Analytics traffic competes with ingestion and real-time processing for database resources.
- `ADR-0008` originally forbade building time-series aggregation inside the `SocialPost` enrichment subsystem, leaving a gap in the analytics layer — a gap this ADR now closes, superseding that specific clause (ADR-0087 Decision §1).

---

## 7. Future State (To-Be)

**New or improved process:**
1. Ingested posts land in `social_posts` and `post_watchlist_matches` as today.
2. A `RefreshAnalyticsViews` worker runs every 15 minutes, identifies affected `(tenant_id, date)` buckets using `published_at` and `updated_at` windows, and idempotently writes daily aggregate rows.
3. Late-arriving posts trigger re-computation for the historical buckets they affect.
4. Dashboard and analytics endpoints route full-day requests to the precomputed tables and only fall back to `social_posts` for the current partial day or small drill-down samples.
5. Users see faster, more reliable dashboards while the analytics workload is decoupled from ingestion. The existing Epic 8 dashboard keeps working exactly as it does today until specific widgets are migrated in a separate follow-up story.

**Expected capabilities:**
- Sub-second aggregate responses for full-day views.
- Bounded, documented freshness (up to 15 minutes behind for the current partial day).
- Transparent query routing with no user-facing API changes for existing dashboards.
- A reusable aggregate layer for downstream features such as ad-hoc query, topic evolution, and real-time alerts.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` tables with tenant-scoped daily aggregates. | Must | All five tables exist with `(tenant_id, date, ...)` primary keys, RLS, and indexes on `(tenant_id, date)` and `(tenant_id, watchlist_id, date)`. | Product Owner |
| BR-002 | The `RefreshAnalyticsViews` worker shall run every 15 minutes and recompute affected buckets idempotently. | Must | Worker executes on schedule; re-running the worker produces the same final counts. | Product Owner |
| BR-003 | The system shall handle late-arriving posts by recomputing the affected `(tenant_id, date)` buckets. | Must | Ingesting a post with a past `published_at` updates the matching historical daily row. | Product Owner |
| BR-004 | The current partial day is computed provisionally and overwritten on the next refresh. | Must | Dashboards querying the current day get a provisional value that is superseded on the next 15-minute run; query-time callers may instead fall back to `social_posts` for that day. | Product Owner |
| BR-005 | Dashboard and analytics endpoints shall prefer precomputed tables for full days and fall back to `social_posts` for partial days or drill-down. | Must | Full-day requests resolve from `*DailyCount` tables; partial-day or small-sample requests fall back to `social_posts` with a limit. | Product Owner |
| BR-006 | The system shall expose `GET /v1/analytics/:view` for `topics`, `sources`, `authors`, `sentiments`, and `watchlists`. | Must | Each view returns tenant-scoped aggregate rows for the requested date range. | Product Owner |
| BR-007 | Aggregate rows shall contain only counts, sums, identifiers, and `watchlist_id`; no raw post content. | Must | `post_id` lists and `rawPayload` are absent from aggregate tables. | Product Owner |
| BR-008 | `TopicDailyCount.topic_id` shall reference ADR-0104's `topics` catalog. | Must | `topic_id` foreign-keys to `topics`, not to any `AIProviderConnector` output or `watchlists` row; a merged topic's historical rows are not backfilled. | Product Owner |
| BR-009 | `sum_reach` and `sum_engagement` shall be documented as partially-covered columns, not silently incomplete. | Must | `sum_reach` is `NULL` for organization-as-Author connectors (ADR-0049); `sum_engagement` is `NULL` for every connector except Facebook. Both facts are stated in this document and in the ADR. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Aggregate queries for full-day dashboard widgets complete in under 500 ms at the 95th percentile. | Performance | Must | Measured via load tests against a representative tenant dataset. |
| NFR-002 | All aggregate tables enforce tenant RLS and never expose cross-tenant data. | Security | Must | Contract tests confirm multi-tenant isolation and 403/404 behavior. |
| NFR-003 | Refresh worker is decoupled from the ingestion hot path and retryable. | Reliability | Must | Ingestion throughput is not degraded during refresh; failed runs can be retried without double-counting. |
| NFR-004 | Data freshness is bounded to 15 minutes for the current partial day. | Performance | Should | Monitoring shows refresh lag under 15 minutes under normal load. |
| NFR-005 | Refresh logic is defined once and reused by ad-hoc queries, avoiding duplicated business logic. | Maintainability | Should | Same aggregation rules are shared between refresh worker and `adHocQueryService`. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Every aggregate table must have a `tenant_id` RLS policy so a tenant can only read its own daily counts. |
| BRU-002 | Primary keys must be composite on `(tenant_id, date, ...)` for each aggregate table. |
| BRU-003 | Refresh must be idempotent: re-running the same refresh window must not produce duplicate or inflated counts. |
| BRU-004 | Aggregate rows must not contain raw post bodies, `post_id` lists, or `rawPayload`. |
| BRU-005 | The current partial-day row may be provisional and is overwritten on the next refresh run. |
| BRU-006 | Late-arriving posts trigger re-computation only for the affected `(tenant_id, date)` bucket. |
| BRU-007 | `topic_id` is sourced from ADR-0104's `topics` catalog only; a topic merge starts a new `topic_id`'s counts from the merge date and does not backfill historical rows under the merged identity. |
| BRU-008 | `sum_reach` is `NULL` for connectors with no follower-count concept (organization-as-Author connectors, ADR-0049); `sum_engagement` is `NULL` for every connector except Facebook in v1. Neither is treated as a data-quality bug. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `TopicDailyCount` | Per-tenant, per-date, per-topic counts, reach, engagement, sentiment, and unique authors. | `social_posts`, `author_topic_signals`; `topic_id` from ADR-0104's `topics` catalog | Analytics subsystem | Tenant-confidential aggregate |
| `SourceDailyCount` | Per-tenant, per-date, per-platform counts, reach, engagement, and sentiment. | `social_posts` | Analytics subsystem | Tenant-confidential aggregate |
| `AuthorDailyCount` | Per-tenant, per-date, per-author, per-platform counts, reach, and engagement. | `social_posts` | Analytics subsystem | Tenant-confidential aggregate |
| `SentimentDailyCount` | Per-tenant, per-date, per-sentiment counts and reach. | `social_posts` sentiment | Analytics subsystem | Tenant-confidential aggregate |
| `WatchlistDailyCount` | Per-tenant, per-date, per-watchlist counts, reach, engagement, and unique authors. | `post_watchlist_matches` | Analytics subsystem | Tenant-confidential aggregate |
| `sum_reach` (all applicable tables) | Add-time reach figure. | `social_posts.author_follower_count_at_publish` (ADR-0049); `NULL` for organization-as-Author connectors | Analytics subsystem | Tenant-confidential aggregate |
| `sum_engagement` (all applicable tables) | Add-time engagement figure. | Facebook Page engagement counts only (Story 2.18); `NULL` for every other connector in v1 | Analytics subsystem | Tenant-confidential aggregate |
| `RefreshAnalyticsViews` worker state | Last refresh window, affected buckets, and run status. | Worker metadata | Platform operations | Operational metadata |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Dashboard aggregate response time | Confirm performance target is met | Product / Platform team | Continuous, reviewed weekly |
| View refresh lag | Track how far behind the current partial day is | Platform-Admin / Sole-Operator | Every 15 minutes |
| Precomputed view hit ratio | Measure how often dashboards use precomputed tables vs. raw fallback | Product / Performance Review Agent | Daily |
| Aggregate storage growth | Track storage cost of `*DailyCount` tables | Platform-Admin / Sole-Operator | Weekly |
| Refresh failure rate | Detect stale or broken analytics | Platform-Admin / Sole-Operator | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Aggregate tables become stale or inconsistent due to refresh failures | Medium | High | Idempotent refresh, per-bucket re-computation, and refresh-lag monitoring; alerting on missed runs | Platform-Admin |
| R-002 | Current partial-day data is confusing or incorrect while provisional | Medium | Medium | Clearly label provisional data or exclude it until the next refresh; document freshness policy | Product Owner |
| R-003 | Storage growth from daily aggregates outpaces raw-payload retention | Medium | Medium | Align aggregate retention with ADR-0018; monitor growth weekly and plan retention policy | Sole-Operator |
| R-004 | ~~Topic/author merges corrupt historical daily counts~~ **Resolved:** merge semantics are decided (ADR-0104 §6) — a merged topic's counts start fresh from the merge date; pre-merge rows keep their original `topic_id`, never rewritten or backfilled. | — | — | Closed | Product Owner |
| R-005 | Cross-tenant data leakage if RLS is misconfigured | Low | High | RLS on every aggregate table; contract tests covering cross-tenant reads; code review of policies | Technical Lead |
| R-006 | A dashboard or endpoint treats `sum_reach`/`sum_engagement` as fully populated and produces a misleading total or average | Medium | Medium | Both columns' partial coverage is documented here and in ADR-0087; any consumer must divide by a coverage-aware denominator, not raw `count` | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0008` (deferred `TopicDailyCount` to a future subsystem) | Architectural | Menno / Technical Lead | Accepted; its aggregation-table clause is now superseded by ADR-0087 (Decision §1) |
| D-002 | `ADR-0015` (tenant RLS) | Architectural | Menno / Technical Lead | Accepted; RLS policy pattern in place |
| D-003 | `ADR-0018` (raw-payload retention) | Architectural | Menno / Product Owner | Accepted; aggregate retention policy to be aligned |
| D-004 | `docs/product-research/feature-designs/27-preconfigured-analytics-views.md` | Design | Product Owner | Available; used as source |
| D-005 | `docs/product-research/feature-adr-scoping.md` | Scoping | Product Owner | Available; used as source |
| D-006 | `docs/product-research/feature-designs/08-dashboards-and-analytics.md` | Consumer | Product Owner | Accepted; primary consumer of precomputed views |
| D-007 | `docs/product-research/feature-designs/25-topic-evolution-timeline.md` | Consumer | Product Owner | Planned; consumes `TopicDailyCount` |
| D-008 | `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` | Consumer | Product Owner | Planned; consumes `*DailyCount` tables |
| D-009 | `ADR-0049` (`author_follower_count_at_publish`) | Architectural | Technical Lead | Accepted; real source of `sum_reach` |
| D-010 | `ADR-0054` (Tenant Analytics Dashboard, client-side architecture) | Architectural | Menno / Technical Lead | Accepted; ADR-0087 partially supersedes its Decision §3 for a named subset of widgets (ADR-0087 Decision §8) |
| D-011 | `ADR-0104` (AI topic clustering post-topics schema) | Architectural | Technical Lead | Proposed; source of `topic_id` and topic-merge semantics |

---

## 14. Acceptance Criteria

- All five `*DailyCount` tables exist with correct columns, primary keys, indexes, and tenant RLS.
- The `RefreshAnalyticsViews` worker runs every 15 minutes and is idempotent.
- Late-arriving posts cause re-computation for the affected `(tenant_id, date)` bucket.
- Dashboard endpoints return full-day aggregate data from precomputed tables and fall back to `social_posts` only for partial days or drill-down.
- `GET /v1/analytics/:view` returns tenant-scoped, correct data for all five views.
- No raw post bodies, `post_id` lists, or `rawPayload` appear in aggregate rows.
- `topic_id` values resolve against ADR-0104's `topics` catalog; a topic merge does not rewrite or backfill pre-merge historical rows.
- `sum_reach` is `NULL` for organization-as-Author connectors; `sum_engagement` is `NULL` for every connector except Facebook — both documented, not treated as defects.
- Contract and performance tests verify sub-second full-day aggregate responses and cross-tenant isolation.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Preconfigured analytics view | A precomputed, tenant-scoped daily aggregate table optimized for dashboard and analytics queries. |
| `*DailyCount` tables | The five aggregate tables: `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`. |
| `RefreshAnalyticsViews` | The scheduled worker responsible for updating the `*DailyCount` tables. |
| Partial day | The current calendar day that has not yet completed; may be represented by a provisional aggregate. |
| Late-arriving post | A post whose `published_at` falls in a previous bucket that is re-ingested or updated after that bucket was first computed. |
| RLS | Row-Level Security; PostgreSQL feature used to enforce tenant isolation. |
| `topic_id` | A reference into ADR-0104's `topics` catalog, populated by `TopicClusteringService` — not an `AIProviderConnector` output, not a `watchlists` row. |

---

## 16. Appendices

### 16.1 Reference documents

- `docs/adr/0087-preconfigured-analytics-views.md` (source ADR, **Accepted** 2026-08-27)
- `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`
- `docs/product-research/feature-adr-scoping.md`
- `docs/adr/0008-defer-topic-time-series-and-charting.md` — deferred `TopicDailyCount`, superseded by ADR-0087
- `docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md`
- `docs/adr/0018-data-retention-and-archival-policy.md`
- `docs/adr/0049-point-in-time-author-follower-count-on-social-post.md` — source of `sum_reach`
- `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md` — partially superseded, see ADR-0087 Decision §8
- `docs/adr/0104-ai-topic-clustering-post-topics-schema.md` — source of `topic_id`

### 16.2 Related user stories

| Epic / Story | Source | Status | One-line intent | Key acceptance criteria |
|---|---|---|---|---|
| Epic 10 — Analytics, operations, and trust | ADR-0087 area | Ready | Analytics, operations, and trust epic | — |
| Story 10.3 — Preconfigured analytics views (backend) | ADR-0087 | Ready | As a backend engineer, I want the five daily-count tables and a refresh worker so dashboards can read fast, precomputed aggregates. | Tables exist with PKs and indexes; `RefreshAnalyticsViews` runs every 15 minutes and is idempotent; late-arriving posts trigger re-computation; current partial day is handled; `topic_id`/reach/engagement sourcing documented; endpoint is additive to Epic 8, not a replacement. |

### 16.3 Missing sources

No deep-research brief was found for `27-preconfigured-analytics-views` in `docs/product-research/reports/`. This is noted; the BRD used the feature design and ADR directly.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
