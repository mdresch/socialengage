---
name: precomputed-analytics-views
description: Precomputed daily count aggregate tables, 15-minute refresh background worker, and GET /v1/analytics/:view endpoint (ADR-0087, Story 10.3).
---

# Precomputed Analytics Views (ADR-0087)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-10/story-10.3.preconfigured-analytics-views.contract.test.ts` — Story 10.3 contract test.

## Purpose
Provides sub-second analytics aggregations across sources, authors, sentiments, and watchlists via precomputed daily rollup tables instead of scanning million-row raw post tables on demand.

## Invariants
1. **Precomputed Tables:** `source_daily_counts`, `author_daily_counts`, `sentiment_daily_counts`, `watchlist_daily_counts` partitioned with RLS per `tenant_id`.
2. **15-Minute Refresh Worker:** Background worker loops every 15 minutes, computing rollups for today and yesterday using `ON CONFLICT DO UPDATE` (upsert) to cleanly incorporate late-arriving ingested posts.
3. **Admin Pool Usage:** Worker connects via `getAdminPool()` to execute cross-tenant batch updates without leaking RLS session state.
4. **Tenant Scoping:** `GET /v1/analytics/:view` endpoint strictly enforces caller `tenant_id` context via `withTenant()`.
5. **Views Supported:** `sources`, `authors`, `sentiments`, `watchlists`. Invalid view names return `400 Bad Request`.

## Endpoints
- `GET /v1/analytics/:view?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`: Fetch precomputed daily rollup rows.

## Relations to other components

- **`source_daily_counts`, `author_daily_counts`, `sentiment_daily_counts`, `watchlist_daily_counts` tables** — the four precomputed rollup tables populated by the 15-minute worker; all partitioned by `tenant_id` with RLS.
- **`social_posts` table** — source for aggregations; the worker computes `COUNT(*)` grouped by platform/author/sentiment/watchlist over the `published_at` date.
- **`getAdminPool()` (admin connection pool)** — the background worker uses the admin pool to run cross-tenant batch upserts without leaking RLS session state from individual tenant connections.
- **`ad-hoc-query-engine` skill** — the complement; use ad-hoc queries when the needed dimension/metric combination isn't precomputed.
- **`analytics-dashboard` admin SKILL.md** — the frontend `AnalyticsDashboard` component (Story 8.x) and the precomputed views tab consuming `GET /v1/analytics/:view`.
- **`watchlist_posts` join table** — the `watchlist_daily_counts` rollup joins through this many-to-many table to attribute posts to their matching watchlists.
