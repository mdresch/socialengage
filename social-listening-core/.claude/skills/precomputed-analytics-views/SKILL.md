---
name: precomputed-analytics-views
description: Precomputed daily count aggregate tables, 15-minute refresh background worker, and GET /v1/analytics/:view endpoint (ADR-0087, ADR-0135, Stories 10.3, 18.2).
---

# Precomputed Analytics Views (ADR-0087, ADR-0135)

## What this is

Provides sub-second analytics aggregations across sources, authors, sentiments, watchlists, and topics via precomputed daily rollup tables instead of scanning million-row raw post tables on demand. Sits downstream of ingestion and enrichment, continuously populated by a 15-minute upsert background worker.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0087 | Five daily aggregate rollup tables, 15-minute idempotent upsert refresh, and `GET /v1/analytics/:view` endpoint | Story 10.3 |
| ADR-0097 | Topic evolution timeline aggregation and `topic_daily_counts` schema | Story 11.5 |
| ADR-0135 | Binding prohibition on literal PostgreSQL `MATERIALIZED VIEW` objects; enforcement of ordinary physical PostgreSQL tables (`CREATE TABLE`) with native Row-Level Security (`ENABLE ROW LEVEL SECURITY`) and tenant isolation policies | Story 18.2 |

## Contracts that constrain this component

- `contracts/epic-10/story-10.3.preconfigured-analytics-views.contract.test.ts` — Baseline precomputed daily count views, 15-minute worker refresh, date filtering, and cross-tenant isolation.
- `contracts/epic-18/story-18.2.preconfigured-analytics-views-rls.contract.test.ts` — Verifies in PostgreSQL system catalogs (`pg_class`, `pg_policy`) that all five rollup entities (`source_daily_counts`, `author_daily_counts`, `sentiment_daily_counts`, `watchlist_daily_counts`, `topic_daily_counts`) are physical tables (`relkind = 'r'`), not materialized views (`relkind = 'm'`), with enforced RLS and tenant isolation, idempotent upserts, and full query routing for all five views including `topics`.

## How to extend this safely

- **Adding a new precomputed rollup dimension:** Always create as an ordinary physical PostgreSQL table (`CREATE TABLE`) with `tenant_id`, `date`, the dimension key, and composite primary key `(tenant_id, date, <dimension_key>)`. Immediately attach `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;` and a tenant isolation policy (`USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)`).
- **Never create a PostgreSQL `MATERIALIZED VIEW`:** PostgreSQL does not support Row-Level Security on materialized views (ADR-0135 Context §2). Using a materialized view or a security-barrier wrapper violates the tenant isolation architecture.
- **Worker updates:** Any worker populating precomputed views must connect via `getAdminPool()` to execute cross-tenant batch updates, and must use atomic idempotent upserts (`INSERT INTO ... ON CONFLICT (tenant_id, date, ...) DO UPDATE SET ...`).

## Load-bearing constraints — do not change casually

1. **Physical Tables with Native RLS (ADR-0135 Decision §2):** All five rollup structures (`source_daily_counts`, `author_daily_counts`, `sentiment_daily_counts`, `watchlist_daily_counts`, `topic_daily_counts`) MUST be ordinary tables (`relkind = 'r'`). Literal `CREATE MATERIALIZED VIEW` is strictly prohibited.
2. **Idempotent Refresh Pipeline:** The refresh pipeline must use `ON CONFLICT DO UPDATE` (upsert) to cleanly incorporate late-arriving ingested posts without wiping or locking historical records. Never invoke `REFRESH MATERIALIZED VIEW`.
3. **Admin Pool Usage:** Worker connects via `getAdminPool()` to execute cross-tenant batch updates without leaking RLS session state.
4. **Tenant Scoping:** `GET /v1/analytics/:view` endpoint strictly enforces caller `tenant_id` context via `withTenant()`.
5. **Views Supported:** `sources`, `authors`, `sentiments`, `watchlists`, `topics`. Invalid view names return `400 Bad Request`.

## Known gaps / deferred work

- **TimescaleDB continuous aggregates (ADR-0135 Alternatives §2):** Re-evaluated and deferred to future scale-driven migration; plain tables with RLS and worker upserts remain the standard.
- **Archive pruning policy (Q-0135-2):** Aligning 365-day rollup retention with ADR-0018 data retention policies is slated for a future lifecycle pass.

## Relations to other components

- **`source_daily_counts`, `author_daily_counts`, `sentiment_daily_counts`, `watchlist_daily_counts`, `topic_daily_counts` tables** — the five precomputed rollup tables populated by the worker; all partitioned by `tenant_id` with RLS.
- **`social_posts` table** — source for aggregations; the worker computes counts grouped by platform/author/sentiment/watchlist/topic over the `published_at` date.
- **`getAdminPool()` (admin connection pool)** — the background worker uses the admin pool to run cross-tenant batch upserts without leaking RLS session state from individual tenant connections.
- **`ad-hoc-query-engine` skill** — the complement; use ad-hoc queries when the needed dimension/metric combination isn't precomputed.
- **`analytics-dashboard` admin SKILL.md** — the frontend `AnalyticsDashboard` component and analytics views consuming `GET /v1/analytics/:view`. **Documentation Steward note, 2026-09-16: not yet backed by a real-call-site contract.** `social-listening-admin`'s own `analytics-dashboard/SKILL.md` states plainly that its `/tenant/analytics` screen computes everything client-side from `GET /v1/posts` and that "no `social-listening-core` endpoint, no stored aggregation table exists or is added for this" (the one named exception being the unrelated `POST /v1/posts/explain-spike` AI Spike Storyteller call). Grepped `social-listening-admin/src` for any call to `/v1/analytics/:view` (or its five named views — sources/authors/sentiments/watchlists/topics) and found none, in `core-client.ts` or anywhere else. `GET /v1/analytics/:view` is real and mounted (`analyticsViewsRouter.ts`, Story 10.3/18.2) and its own contracts exercise it directly, but no admin-side production call site consumes it. Flagged for Menno to route to `qa-contract-author` if wiring the dashboard to this endpoint is intended, rather than authored here.
- **`post_watchlist_matches` join table** — the `watchlist_daily_counts` rollup joins through this table to attribute posts to their matching watchlists.
