---
status: high-level
source: docs/project docs/Stakeholder Management/Performance-Review-Agent-Stakeholder-Profile.md
created: 2026-08-23
---

# Preconfigured analytics views

### What it is

A system of tenant-scoped, precomputed views that power dashboard widgets, analytics queries, and time-series charts without scanning raw `social_posts` at request time. These views are refreshed on a schedule or on demand and are the backend counterpart to the loading-state performance recommendations for the UI.

### End-user benefits

- **Faster dashboards:** charts and widgets load from pre-aggregated tables instead of scanning millions of rows.
- **Predictable performance:** heavy queries no longer slow down other users or the ingestion pipeline.
- **Lower cost:** fewer repeated full-table scans and less ad-hoc AI work.
- **Better UX:** the UI can show a real structure (skeleton) immediately and fill it from fast endpoints.

### Core details

- New tenant-scoped tables or continuous aggregates: `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`.
- Each table has `tenant_id`, `date`, `platform_id`, `watchlist_id`, `topic_id`, `author_id`, `sentiment`, `count`, `sum_reach`, `sum_engagement`, and `unique_authors`.
- Refresh is driven by `pg_cron` after each ingestion batch or on a fixed schedule (e.g., every 15 minutes).
- The dashboard and analytics widgets query the preconfigured views first and fall back to raw tables only for the current partial day or drill-down.
- The system is transparent to the user: the same dashboard calls the same API, but the backend chooses the fastest source.

### Implementation complexity

**Medium-to-high.** Requires new table design, a refresh pipeline, backfill logic, and careful RLS. The heavy part is ensuring correctness across time zones, late-arriving posts, and topic merges while keeping refresh cheap.

### Growth and reach

Essential for scaling `08-dashboards-and-analytics`, `25-topic-evolution-timeline`, `21-ad-hoc-query-endpoint`, and `09-real-time-alerts` without destroying performance.

---

## Technical design

- **Data flow:** `social_posts` and `post_watchlist_matches` are ingested → a `RefreshAnalyticsViews` job runs periodically → it updates `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, and `SentimentDailyCount` for the affected tenant and date → dashboard/analytics endpoints prefer these tables.
- **Component interactions:** `RefreshAnalyticsViews` → `pg_cron` / Azure Function → `analytics_view_store` → `dashboardService` / `adHocQueryService`.
- **REST/Service Bus contracts:** `GET /v1/analytics/:view` returns precomputed data. No new endpoints in v1; existing `GET /v1/posts` and dashboard endpoints transparently use the views.
- **Storage:** `TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount` (all tenant-scoped, RLS-protected).
- **Security considerations:** RLS on all views. No raw post content in aggregates. Backfill jobs must not expose cross-tenant data.

## Backend principles

- **Prefer precomputed for aggregates.** Any query that `GROUP BY`s `date`, `topic`, `source`, or `author` should hit a preconfigured view.
- **Refresh is idempotent and scoped.** Each refresh run only touches the affected tenant and date ranges.
- **Late-arriving posts are handled.** Ingested posts with `published_at` in the past trigger a re-computation for that bucket.
- **Fallback to raw tables.** For the current partial day or drill-down to a small sample, raw queries are still allowed with limits.
- **No duplicated business logic.** The aggregation rules are defined once and shared by refresh jobs and ad-hoc queries.

## Frontend / UI principles

- **Per-widget skeletons.** Each dashboard widget shows its own skeleton while its precomputed data loads; no whole-page spinner.
- **Progressive disclosure.** Show the shell and aggregates first, then lazy-load representative posts or drill-down on user action.
- **Cached tiles.** Known, frequently requested views can be served with short client-side `stale-while-revalidate` caching.
- **Loading pattern by latency:**
  - < 300 ms: no loader.
  - 300 ms – 1.5 s: skeleton or shimmer.
  - > 1.5 s: progress bar with a descriptive message.

## Open questions

- Should the views be implemented as native Postgres continuous aggregates (TimescaleDB style) or as plain materialized views with `pg_cron` refresh?
- How far back should views be retained, and how does this relate to the raw-payload retention policy (ADR-0018)?
- Should the refresh be per-tenant, per-connector, or global per batch?
- How do we handle topic/author merges without recomputing everything from scratch?
- Should the ad-hoc query endpoint be allowed to query preconfigured views as well as raw tables?

## AI enhancements

- **Refresh scheduling optimization:** the AI predicts peak ingestion times and schedules refresh jobs to avoid contention.
- **Anomaly detection:** the AI flags views that are stale, missing, or have unexpected variance.
- **Query path selection:** the AI recommends whether a given analytics query should use a preconfigured view or a raw-table scan.

## Persona acceptance

- **Tenant-Reader (primary):** sees dashboards load quickly and reliably.
- **Tenant-Business-Analyst (primary):** can run time-series and grouped queries without long waits.
- **Sole-Operator (primary):** avoids runaway database load and cost from ad-hoc user queries.
- **Platform-Admin (primary):** can monitor view-refresh health and storage growth.
- **Performance Review Agent (primary):** can verify that expensive analytics no longer scan raw tables at request time.
- **Topic-Center-Analyst (secondary):** can explore topic evolution over time from `TopicDailyCount`.
- **Tenant-Brand-Reputation-Manager (secondary):** can see crisis metrics without waiting for full re-computation.
