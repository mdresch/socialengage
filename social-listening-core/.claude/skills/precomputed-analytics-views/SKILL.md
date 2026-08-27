---
name: precomputed-analytics-views
description: Precomputed daily count aggregate tables, 15-minute refresh background worker, and GET /v1/analytics/:view endpoint (ADR-0087, Story 10.3).
---

# Precomputed Analytics Views (ADR-0087)

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
