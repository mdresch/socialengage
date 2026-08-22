# ADR-0087: Preconfigured analytics views

**Status:** Proposed (2026-08-23)

**Authorizes:** a family of tenant-scoped, precomputed daily aggregate tables (`TopicDailyCount`, `SourceDailyCount`, `AuthorDailyCount`, `SentimentDailyCount`, `WatchlistDailyCount`) and the refresh/query-routing rules that keep dashboards and analytics fast without scanning `social_posts` at request time.

**Source:** `docs/product-research/feature-designs/27-preconfigured-analytics-views.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Dashboards and analytics need fast aggregation
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and `docs/product-research/feature-designs/25-topic-evolution-timeline.md` require time-series and grouped metrics over large post volumes. Computing these on every page load by scanning `social_posts` becomes slow and expensive as tenants accumulate data.

### 2. `ADR-0008` explicitly deferred topic-level time-series aggregation
`ADR-0008` (SocialPost Enrichment) states that the `SocialPost` subsystem should not build aggregation tables. The work is intentionally owned by an analytics layer. This ADR authorizes that analytics layer while respecting the boundary.

### 3. Existing tables and events can drive the aggregates
`social_posts`, `post_watchlist_matches`, `author_topic_signals`, and the `SocialPostIngestedEvent` stream contain everything needed to refresh daily counts. A `pg_cron` job or a scheduled worker can maintain the views without touching the ingestion hot path.

---

## Decision

### 1. New daily aggregate tables
```sql
TopicDailyCount (
  tenant_id uuid,
  date date,
  topic_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  avg_sentiment_score numeric,
  unique_authors int
);

SourceDailyCount (
  tenant_id uuid,
  date date,
  platform_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  avg_sentiment_score numeric
);

AuthorDailyCount (
  tenant_id uuid,
  date date,
  author_id uuid,
  platform_id text,
  count int,
  sum_reach bigint,
  sum_engagement bigint
);

SentimentDailyCount (
  tenant_id uuid,
  date date,
  sentiment text,        -- 'positive' | 'negative' | 'neutral' | 'mixed'
  count int,
  sum_reach bigint
);

WatchlistDailyCount (
  tenant_id uuid,
  date date,
  watchlist_id uuid,
  count int,
  sum_reach bigint,
  sum_engagement bigint,
  unique_authors int
);
```

### 2. Composite primary keys and indexes
- Primary keys are `(tenant_id, date, ...)` for each table, with a `tenant_id` RLS policy.
- Indexes on `(tenant_id, date)` and `(tenant_id, watchlist_id, date)`.
- Tables are unlogged/batch-optimized where possible; refresh is idempotent.

### 3. Refresh pipeline
- A `RefreshAnalyticsViews` worker runs every 15 minutes via `pg_cron`.
- It computes new rows by selecting posts with `published_at` in a window and `updated_at` after the last refresh.
- Late-arriving posts trigger a re-computation for the affected `(tenant_id, date)` buckets.
- For the current partial day, the worker may compute a provisional row and overwrite it on the next run.

### 4. Query routing
- Dashboard and analytics endpoints prefer the preconfigured tables for full days.
- For the current partial day, or when a user drills down to individual posts, they fall back to `social_posts` with a small limit.
- `GET /v1/analytics/:view` exposes views: `topics`, `sources`, `authors`, `sentiments`, `watchlists`.

### 5. No raw post bodies in aggregates
Aggregate rows contain counts, sums, and identifiers only. The `watchlist_id` list may be included for `WatchlistDailyCount`, but no `post_id` list and no `rawPayload`.

---

## Consequences

1. **Faster dashboards:** chart data loads from small, indexed tables instead of scanning large post tables.
2. **Predictable cost:** aggregation is done once at refresh time, not on every page view.
3. **Bounded freshness:** data may be up to 15 minutes behind real-time ingestion for the current day.
4. **Storage growth:** aggregate tables are much smaller than raw posts but still accumulate over time. Retention policy is deferred.
5. **Foundation for v2:** `25-topic-evolution-timeline`, `21-ad-hoc-query-endpoint`, and `08-dashboards-and-analytics` all consume these views.

---

## Alternatives considered

1. **Use Postgres continuous aggregates (TimescaleDB).**
   - *Rejected:* it adds a new extension and operational complexity. Plain tables with a scheduled worker are simpler for a solo project.

2. **Compute everything on demand from `social_posts` and cache the result.**
   - *Rejected:* it does not reduce cost for repeated views and requires a cache invalidation strategy. Precomputed tables are more predictable.

3. **Precompute at ingestion time per post.**
   - *Rejected:* it couples analytics to the ingestion hot path and would slow ingestion. A separate worker is decoupled and retryable.

---

## Open questions

- Should the current partial-day row be real-time or excluded until the next refresh?
- How far back should daily aggregates be retained, and how does that relate to `ADR-0018` raw-payload retention?
- Should `TopicDailyCount` derive topic IDs from `AIProviderConnector` or from user-defined `watchlists`?
- How are topic merges reflected in historical daily counts?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/27-preconfigured-analytics-views.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0008` (SocialPost enrichment, no time-series in that subsystem), `ADR-0015` (tenant RLS), `ADR-0018` (retention)
