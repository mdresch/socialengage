---
name: platform-metrics
description: Global `platform_metrics` table, hourly `PlatformMetricsWorker`, Azure Monitor/Cost Management provider abstraction, and `GET /v1/admin/platform-metrics` aggregation. Read this before changing `platformMetricsStore.ts`, `platformMetricsWorker.ts`, `azureMetricsClient.ts`, or the admin metrics endpoints.
---

# Platform Metrics (ADR-0114, Story 13.8)

## What this is

Story 13.8 adds a global, tenant-content-free `platform_metrics` table that stores time-bucketed infrastructure and ingestion telemetry at `hour` and `day` granularity. An hourly `PlatformMetricsWorker` derives internal counters from `ingestion_runs`, accepts metrics from a swappable `AzureMetricsProvider`, and prunes old rows. Two admin REST endpoints read from the table instead of live Azure APIs: `GET /v1/admin/platform-dashboard` (Story 10.6 dashboard, now backed by `platform_metrics`) and `GET /v1/admin/platform-metrics` (new aggregation endpoint, `platform_admin` only).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0114 | `platform_metrics` table, `hour`/`day` granularity, `dimensions` JSONB, 7-day hourly / 365-day daily retention, platform-admin REST query surface | 13.8 |
| ADR-0089 | Platform dashboard tiles and time-series, originally live; retargeted to `platform_metrics` by Story 13.8 | 10.6, 13.8 |

## Contracts that constrain this component

- `contracts/epic-13/story-13.8.platform-metrics-table-and-azure-metrics.contract.test.ts` — schema, worker, Azure provider wiring, dashboard and admin endpoints, aggregation, gating, and retention.

## Key files

- `migrations/0068_align_platform_metrics_granularity_and_indexes.sql` — adds `hour`/`day` to the granularity check and supporting indexes.
- `migrations/0069_add_platform_metrics_unique_index.sql` — ensures `idx_platform_metrics_unique` exists so `recordPlatformMetric` can upsert on `(metric_name, granularity, timestamp, source, dimensions)`.
- `src/platform/azureMetricsClient.ts` — `AzureMetricsProvider` interface, `setAzureMetricsProvider`, `fetchAzureMetrics`. Live implementation is intentionally a stub; real Azure wiring requires env vars.
- `src/platform/platformMetricsWorker.ts` — `runPlatformMetricsWorker()` computes previous-hour ingestion counters and persists Azure-sourced samples, then `prunePlatformMetrics()`. `startPlatformMetricsWorker()` is called from `src/http/server.ts` guarded by `isPlatformMetricsWorkerEnabled()`.
- `src/platform/platformMetricsStore.ts` — `recordPlatformMetric` (ON CONFLICT upsert), `recordMetricSamples`, `prunePlatformMetrics`, `queryPlatformMetricsAggregated`, `getPlatformDashboardData`, `resetPlatformDashboardCache`.
- `src/http/versions/v1/adminPlatformMetricsRouter.ts` — `GET /v1/admin/platform-metrics` (platform-admin only).
- `src/http/versions/v1/platformDashboardRouter.ts` — `GET /v1/admin/platform-dashboard`.
- `src/http/versions/v1/router.ts` — mounts the admin and dashboard routers.
- `src/http/server.ts` — starts the worker alongside the poll scheduler, gated by `isPlatformMetricsWorkerEnabled()`.

## How to extend this safely

- To add a new internal counter, update the `internalMetrics` array in `platformMetricsWorker.ts` and call `recordPlatformMetric`.
- To change the aggregation rules (sum vs. average), edit the `CASE` expression in `queryPlatformMetricsAggregated`. The SQL casts the result to `::float` so `pg` returns a JS number.
- To add a new Azure-sourced metric, have the live `AzureMetricsProvider` return a `MetricSample` with `source: 'azure_metrics'`, `granularity: 'hour'`, and a stable `dimensions` object.
- To change retention, edit the `DELETE` filters in `prunePlatformMetrics`. The 7-day / 365-day rule is in ADR-0114.

## Load-bearing constraints — do not change casually

- `platform_metrics.dimensions` is `JSONB` and must **never** store tenant post content, watchlist queries, or user PII. The contract tests explicitly check for `body`, `query`, and `email` keys.
- `recordPlatformMetric` relies on `idx_platform_metrics_unique` for its `ON CONFLICT` upsert. If the index is stale or missing, the upsert fails with `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- `queryPlatformMetricsAggregated` returns `value` and `points` as JS numbers. The SQL uses `::float` for `value` and `::int` for `count(*)` because `pg` returns `numeric` and `bigint` as strings by default.
- `getPlatformDashboardData` has a 60-second in-memory cache. Call `resetPlatformDashboardCache()` in tests that need fresh reads.
- `GET /v1/admin/platform-metrics` is gated to `platform_admin` via `requirePlatformAdmin` and returns `{ metrics: AggregatedMetricRow[] }`.
- The worker is started in `server.ts`, guarded by `isPlatformMetricsWorkerEnabled()` (disabled when `NODE_ENV === 'test'` unless `PLATFORM_METRICS_WORKER_ENABLED` is explicitly set). This ensures contract tests that boot `server.ts` (such as Story 1.10) do not trigger the background worker or write unexpected rows into `platform_metrics`.


## Known gaps / deferred work

- The live `AzureMetricsProvider` in `azureMetricsClient.ts` is a stub. Real Azure Monitor / Cost Management integration is out of scope for Story 13.8 and requires Azure env vars.
- Story 13.8 does not build a tenant-filtered metrics view; ADR-0114 notes that as a future option.
- Archiving pruned rows to Blob is mentioned in ADR-0114 as a future option and is not implemented.

## Relations to other components

- `platform-operations-dashboard` skill: `GET /v1/admin/platform-dashboard` now reads from `platform_metrics` instead of live social_posts counts.
- `live-ingestion-polling-scheduler` skill: the worker is started next to the ingestion poll scheduler in `server.ts`.
- `postgres-tenant-db` skill: `platform_metrics` is global and uses `getAdminPool()` (platform admin / app user), not a tenant-scoped pool.
