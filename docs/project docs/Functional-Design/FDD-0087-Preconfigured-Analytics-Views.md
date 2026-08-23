# Business Requirements Document — Preconfigured Analytics Views

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Preconfigured Analytics Views |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0087-preconfigured-analytics-views.md, ../Business-Requirements/BRD-0087-Preconfigured-Analytics-Views.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0087-preconfigured-analytics-views.md and the business requirements in BRD-0087-Preconfigured-Analytics-Views.md into functional design for **Preconfigured Analytics Views**.
Dashboards, analytics widgets, and time-series charts in SocialEngage currently risk expensive, repeated scans of the large `social_posts` table as tenants accumulate data. ADR-0087 proposes a family of tenant-scoped, precomputed daily aggregate tables that isolate the analytics workload from the ingestion hot path. This Business Requirements Document captures the business case for building `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`, together with a scheduled `RefreshAnalyticsViews` worker and dashboard query-routing rules that prefer the precomputed tables.

The expected outcome is faster, more predictable dashboard performance, lower per-request database cost, and a foundation for planned analytics features such as topic evolution timelines, ad-hoc querying, and real-time alerts. Because the source ADR is still **Proposed**, this BRD should be treated as a draft for review and may change.

---

### 2.2 Scope
**In scope:**
- Five tenant-scoped daily aggregate tables: `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`.
- Composite primary keys, tenant RLS policies, and supporting indexes.
- A `RefreshAnalyticsViews` worker that runs every 15 minutes and recomputes affected `(tenant_id, date)` buckets.
- Late-arriving post handling and provisional current-day aggregation.
- Dashboard and analytics endpoint routing that prefers precomputed tables for full days and falls back to `social_posts` for partial days or drill-down.
- `GET /v1/analytics/:view` endpoint exposing `topics`, `sources`, `authors`, `sentiments`, and `watchlists` views.

**Out of scope:**
- Native Postgres continuous aggregates or TimescaleDB (rejected alternative).
- Long-term retention policy for aggregate tables (deferred to ADR-0018 alignment).
- Real-time, per-post precomputation at ingestion time.
- Inclusion of raw post bodies, `post_id` lists, or `rawPayload` in aggregate rows.
- Ad-hoc query UI and publishing/composer flows.

## 3. Context and Background
See ADR Context.
Dashboards, analytics widgets, and time-series charts in SocialEngage currently risk expensive, repeated scans of the large `social_posts` table as tenants accumulate data. ADR-0087 proposes a family of tenant-scoped, precomputed daily aggregate tables that isolate the analytics workload from the ingestion hot path. This Business Requirements Document captures the business case for building `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount`, together with a scheduled `RefreshAnalyticsViews` worker and dashboard query-routing rules that prefer the precomputed tables.

The expected outcome is faster, more predictable dashboard performance, lower per-request database cost, and a foundation for planned analytics features such as topic evolution timelines, ad-hoc querying, and real-time alerts. Because the source ADR is still **Proposed**, this BRD should be treated as a draft for review and may change.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce dashboard and analytics query latency | 95th percentile chart-response time under 500 ms for full-day aggregates |
| 2 | Lower recurring database compute cost | Eliminate repeated full-table scans of `social_posts` for aggregate dashboard requests |
| 3 | Improve reliability of analytics under load | Dashboard queries do not degrade the ingestion pipeline or other tenants |
| 4 | Enable future analytics capabilities (topic evolution, ad-hoc query, alerts) | `*DailyCount` tables are the documented data source for ADR-0097, ADR-0088, and ADR-0091 |
| 5 | Provide transparently faster UX | Users see the same dashboard endpoints; backend routing chooses the fastest source automatically |

---

**Positive consequences (from ADR):**
1. **Faster dashboards:** chart data loads from small, indexed tables instead of scanning large post tables.
2. **Predictable cost:** aggregation is done once at refresh time, not on every page view.
3. **Bounded freshness:** data may be up to 15 minutes behind real-time ingestion for the current day.
4. **Storage growth:** aggregate tables are much smaller than raw posts but still accumulate over time. Retention policy is deferred.
5. **Foundation for v2:** `25-topic-evolution-timeline`, `21-ad-hoc-query-endpoint`, and `08-dashboards-and-analytics` all consume these views.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` tables with tenant-scoped daily aggregates. | Must | All five tables exist with `(tenant_id, date, ...)` primary keys, RLS, and indexes on `(tenant_id, date)` and `(tenant_id, watchlist_id, date)`. | Product Owner |
| BR-002 | The `RefreshAnalyticsViews` worker shall run every 15 minutes and recompute affected buckets idempotently. | Must | Worker executes on schedule; re-running the worker produces the same final counts. | Product Owner |
| BR-003 | The system shall handle late-arriving posts by recomputing the affected `(tenant_id, date)` buckets. | Must | Ingesting a post with a past `published_at` updates the matching historical daily row. | Product Owner |
| BR-004 | The current partial day may be computed provisionally and overwritten on the next refresh. | Should | Dashboards can request current-day data; the value is clearly provisional or is excluded until the next refresh. | Product Owner |
| BR-005 | Dashboard and analytics endpoints shall prefer precomputed tables for full days and fall back to `social_posts` for partial days or drill-down. | Must | Full-day requests resolve from `*DailyCount` tables; partial-day or small-sample requests fall back to `social_posts` with a limit. | Product Owner |
| BR-006 | The system shall expose `GET /v1/analytics/:view` for `topics`, `sources`, `authors`, `sentiments`, and `watchlists`. | Must | Each view returns tenant-scoped aggregate rows for the requested date range. | Product Owner |
| BR-007 | Aggregate rows shall contain only counts, sums, identifiers, and `watchlist_id`; no raw post content. | Must | `post_id` lists and `rawPayload` are absent from aggregate tables. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
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

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 10.3 | epic-10-adr-0086-to-0094.md | As backend engineer, I want `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, and `WatchlistDailyCount` tables and a refresh ... | All five daily-count tables exist with `(tenant_id, date, ...)` primary keys and indexes.; A `RefreshAnalyticsViews` worker runs every 15 minutes and is idem... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `TopicDailyCount` | Per-tenant, per-date, per-topic counts, reach, engagement, sentiment, and unique authors. | `social_posts`, `author_topic_signals` | Analytics subsystem | Tenant-confidential aggregate |
| `SourceDailyCount` | Per-tenant, per-date, per-platform counts, reach, engagement, and sentiment. | `social_posts` | Analytics subsystem | Tenant-confidential aggregate |
| `AuthorDailyCount` | Per-tenant, per-date, per-author, per-platform counts, reach, and engagement. | `social_posts` | Analytics subsystem | Tenant-confidential aggregate |
| `SentimentDailyCount` | Per-tenant, per-date, per-sentiment counts and reach. | `social_posts` sentiment | Analytics subsystem | Tenant-confidential aggregate |
| `WatchlistDailyCount` | Per-tenant, per-date, per-watchlist counts, reach, engagement, and unique authors. | `post_watchlist_matches` | Analytics subsystem | Tenant-confidential aggregate |
| `RefreshAnalyticsViews` worker state | Last refresh window, affected buckets, and run status. | Worker metadata | Platform operations | Operational metadata |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Every aggregate table must have a `tenant_id` RLS policy so a tenant can only read its own daily counts. |
| BRU-002 | Primary keys must be composite on `(tenant_id, date, ...)` for each aggregate table. |
| BRU-003 | Refresh must be idempotent: re-running the same refresh window must not produce duplicate or inflated counts. |
| BRU-004 | Aggregate rows must not contain raw post bodies, `post_id` lists, or `rawPayload`. |
| BRU-005 | The current partial-day row may be provisional and is overwritten on the next refresh run. |
| BRU-006 | Late-arriving posts trigger re-computation only for the affected `(tenant_id, date)` bucket. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0008` (SocialPost enrichment boundary) | Architectural | Menno / Technical Lead | Accepted; must not place aggregation in `SocialPost` subsystem |
| D-002 | `ADR-0015` (tenant RLS) | Architectural | Menno / Technical Lead | Accepted; RLS policy pattern in place |
| D-003 | `ADR-0018` (raw-payload retention) | Architectural | Menno / Product Owner | Accepted; aggregate retention policy to be aligned |
| D-004 | `docs/product-research/feature-designs/27-preconfigured-analytics-views.md` | Design | Product Owner | Available; used as source |
| D-005 | `docs/product-research/feature-adr-scoping.md` | Scoping | Product Owner | Available; used as source |
| D-006 | `docs/product-research/feature-designs/08-dashboards-and-analytics.md` | Consumer | Product Owner | Accepted; primary consumer of precomputed views |
| D-007 | `docs/product-research/feature-designs/25-topic-evolution-timeline.md` | Consumer | Product Owner | Planned; consumes `TopicDailyCount` |
| D-008 | `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md` | Consumer | Product Owner | Planned; consumes `*DailyCount` tables |

---

- Existing `social_posts`, `post_watchlist_matches`, `author_topic_signals`, and `SocialPostIngestedEvent` data is complete enough to drive accurate daily aggregates.
- `pg_cron` or an equivalent scheduled worker infrastructure is available in the target environment.
- Dashboard consumers are willing to accept up to a 15-minute freshness delay for the current partial day.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Aggregate queries for full-day dashboard widgets complete in under 500 ms at the 95th percentile. | Performance | Must | Measured via load tests against a representative tenant dataset. |
| NFR-002 | All aggregate tables enforce tenant RLS and never expose cross-tenant data. | Security | Must | Contract tests confirm multi-tenant isolation and 403/404 behavior. |
| NFR-003 | Refresh worker is decoupled from the ingestion hot path and retryable. | Reliability | Must | Ingestion throughput is not degraded during refresh; failed runs can be retried without double-counting. |
| NFR-004 | Data freshness is bounded to 15 minutes for the current partial day. | Performance | Should | Monitoring shows refresh lag under 15 minutes under normal load. |
| NFR-005 | Refresh logic is defined once and reused by ad-hoc queries, avoiding duplicated business logic. | Maintainability | Should | Same aggregation rules are shared between refresh worker and `adHocQueryService`. |

---

## 11. Error Handling and Exceptions
1. **Faster dashboards:** chart data loads from small, indexed tables instead of scanning large post tables.
2. **Predictable cost:** aggregation is done once at refresh time, not on every page view.
3. **Bounded freshness:** data may be up to 15 minutes behind real-time ingestion for the current day.
4. **Storage growth:** aggregate tables are much smaller than raw posts but still accumulate over time. Retention policy is deferred.
5. **Foundation for v2:** `25-topic-evolution-timeline`, `21-ad-hoc-query-endpoint`, and `08-dashboards-and-analytics` all consume these views.

---

## 12. Assumptions and Dependencies
- Existing `social_posts`, `post_watchlist_matches`, `author_topic_signals`, and `SocialPostIngestedEvent` data is complete enough to drive accurate daily aggregates.
- `pg_cron` or an equivalent scheduled worker infrastructure is available in the target environment.
- Dashboard consumers are willing to accept up to a 15-minute freshness delay for the current partial day.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Aggregate tables become stale or inconsistent due to refresh failures | Medium | High | Idempotent refresh, per-bucket re-computation, and refresh-lag monitoring; alerting on missed runs | Platform-Admin |
| R-002 | Current partial-day data is confusing or incorrect while provisional | Medium | Medium | Clearly label provisional data or exclude it until the next refresh; document freshness policy | Product Owner |
| R-003 | Storage growth from daily aggregates outpaces raw-payload retention | Medium | Medium | Align aggregate retention with ADR-0018; monitor growth weekly and plan retention policy | Sole-Operator |
| R-004 | Topic/author merges corrupt historical daily counts | Medium | Medium | Resolve merge semantics before implementation; consider backfill or versioning for historical buckets | Product Owner |
| R-005 | Cross-tenant data leakage if RLS is misconfigured | Low | High | RLS on every aggregate table; contract tests covering cross-tenant reads; code review of policies | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0087-preconfigured-analytics-views.md`
- BRD: `../Business-Requirements/BRD-0087-Preconfigured-Analytics-Views.md`
- Feature design: `docs/product-research/feature-designs/27-preconfigured-analytics-views.md``
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md``
- Feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md``
- Feature design: `docs/product-research/feature-designs/21-ad-hoc-query-endpoint.md``
- Deep research: `docs/product-research/reports/`.`
- User stories: see extracted stories above