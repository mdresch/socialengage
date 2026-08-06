---
name: derived-data-caching-and-refresh
description: The in-process ConnectorHealth read cache (GET /v1/connectors/:platformId) and the pg_cron-scheduled AuthorTopicSignal refresh for social-listening-core. Read this before touching connectorHealthCache.ts, connectorsRouter.ts, or the refresh_author_topic_signals() function/schedule.
---

# Derived-data caching and refresh strategy

## What this is

Two different freshness mechanisms for two pieces of derived data, per ADR-0022: `ConnectorHealthCache` (`src/connectors/connectorHealthCache.ts`) is a TTL-bound, in-process read-through cache in front of `deriveConnectorHealth()` (Story 4.3), serving `GET /v1/connectors/:platformId`; `refresh_author_topic_signals()` (migration `0013`) is a Postgres function scheduled hourly via `pg_cron` that recomputes `author_topic_signals` (Story 4.1) from `social_posts`. Both exist to bound staleness cheaply without becoming a second, independently-updatable source of truth — the cache is always reconstructable from `IngestionRun`, and the scheduled refresh is always reconstructable from `social_posts`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0022 | `ConnectorHealth`: 60s-TTL in-process read-through cache, recomputed from `IngestionRun` on miss/expiry, never Redis/shared-store-backed. `AuthorTopicSignal`: hourly `pg_cron` refresh from `social_posts`. Both accepted as-is (2026-07-29) | 4.4 |

## Contracts that constrain this component

- `contracts/epic-4/story-4.4.derived-data-caching-and-refresh.contract.test.ts` — `GET /v1/connectors/:platformId` is cache-served (a tiny-TTL `ConnectorHealthCache` instance proves stability within the TTL and recompute-on-expiry, since waiting a real 60s isn't feasible in a test); the cache module has no Redis import (source inspection); flushing then immediately re-reading (data unchanged) is a no-op result-wise; two independent cache instances can show different, individually-correct results within the same TTL window; `cron.job` has an hourly (`0 * * * *`) entry for `refresh-author-topic-signals`; invoking `refresh_author_topic_signals()` directly (the same call `pg_cron` makes) correctly recomputes `mentionCount`/`firstMentionAt`/`lastMentionAt`/`activeMonthsCount` from real `social_posts` rows and advances `refreshed_at`.

## How to extend this safely

- **Reading connector status for the admin UI:** call `getCachedConnectorHealth(tenantId, platformId)` (module-level shared instance, `DEFAULT_TTL_MS` = 60s, overridable via `CONNECTOR_HEALTH_CACHE_TTL_MS`) — never call `deriveConnectorHealth()` directly from a router and never persist the result anywhere outside the cache's own in-memory `Map`.
- **Needing an isolated cache for a test or a specific call site:** instantiate `new ConnectorHealthCache(ttlMs)` directly — the class takes `ttlMs` as a constructor parameter specifically so tests don't have to wait out the real 60s default (see the contract's AC1b/AC4).
- **Flushing the cache** (e.g., an operational troubleshooting endpoint, if one is ever added): call `flushConnectorHealthCache()` (shared instance) or `.flush()` on a specific instance — always safe, since every entry is a pure derivation, never a source of truth.
- **Changing the `AuthorTopicSignal` refresh logic:** edit `refresh_author_topic_signals()` in a new migration (`CREATE OR REPLACE FUNCTION`), never inline SQL elsewhere — `pg_cron`'s scheduled job calls this function by name, so the schedule doesn't need to change when the function's body does.
- **Adding a new signal field the refresh should populate:** only once its source column exists on `social_posts` (e.g., `engagementMetrics`/`sentiment` land via the Phase 2 enrichment pipeline) — extend the function's `SELECT`/`INSERT`/`ON CONFLICT DO UPDATE` together, the same migration-based pattern already there.

## Load-bearing constraints — do not change casually

- **`ConnectorHealthCache` must never import or depend on Redis or any shared store.** This is ADR-0022's specific, reasoned distinction from `RequestGate` (ADR-0020): `ConnectorHealth` has no correctness requirement across instances, only a staleness bound, so a shared-store dependency would be a strictly worse trade for this value. The contract's AC2 checks this via source inspection — don't add an import that would make it fail.
- **The cache is never written to by anything other than `deriveConnectorHealth()`'s own return value.** No code path may construct or mutate a `ConnectorHealth` object and insert it into the cache directly — that would reintroduce exactly the drift risk ADR-0009 (Story 4.3) exists to prevent. `.get()` is the only way a value enters the cache.
- **`refresh_author_topic_signals()` runs with whatever role scheduled it (`postgres`, the migration's admin/superuser role) — RLS never applies to it.** This is deliberate and sanctioned: a periodic cross-tenant maintenance job is exactly the case `.claude/skills/postgres-tenant-db/SKILL.md`'s own Known gaps flagged as needing a bypass, once such a job actually existed. Reading `cron.job` or invoking the refresh function directly from application/test code must go through `getAdminPool()`, never the RLS-scoped `getPool()`/`withTenant` — `app_user` isn't the job's owner and won't see `cron.job` rows at all.
- **`pg_cron` requires `shared_preload_libraries=pg_cron` and a matching `cron.database_name` set at Postgres server *start*, not just `CREATE EXTENSION`.** The test container sets both via `docker-compose.test.yml`'s `command:` override; a real Azure Database for PostgreSQL Flexible Server deployment needs the equivalent server-parameter configuration (`pg_cron` is an Azure allow-listed extension) — this is real operational config, not something a migration alone can turn on.
- **The refresh function only populates `mentionCount`/`firstMentionAt`/`lastMentionAt`/`activeMonthsCount`.** `avgEngagement`/`sentimentBreakdown` are deliberately left out of its `INSERT`/`ON CONFLICT` column list — `social_posts` has no `engagementMetrics`/`sentiment` source column yet. Don't backfill these with a placeholder/default value; leave them genuinely absent until real source data exists.
- **Never compare `refreshed_at` (or any other Postgres-side `now()`-derived timestamp) against a JS-side `new Date()` from the test process.** They're different clocks — the test process runs on the host/dev machine, `refresh_author_topic_signals()` runs entirely inside the Dockerized Postgres container, and Docker Desktop/WSL2 VM clock drift from the host is real and grows over a session's wall-clock runtime (confirmed directly: an AC5b flake widened from a 10ms to a 95ms margin across one session, and reproduced identically under `--runInBand`, ruling out Jest worker contention as the cause). The contract's own "before" marker is captured via `SELECT now()` on the same connection/pool the refresh itself uses, specifically to keep both timestamps on one clock — don't revert to `new Date()` for a similar comparison anywhere in this file's own test.

## Known gaps / deferred work

- **Only `GET /v1/connectors/:platformId` exists — no "list all connectors for a tenant" endpoint.** No connector/platform registry query is storied yet (`src/connectors/registry.ts` tracks registered connector *implementations* in-process, not a per-tenant list of configured platforms); building that is separate, not-yet-scoped work.
- **The optional `?fresh=true` cache-bypass param ADR-0022's Acceptance note calls out is not built.** Explicitly optional, not required for acceptance — add it to `connectorsRouter.ts` (calling `deriveConnectorHealth()` directly instead of the cache) if a real troubleshooting need for it shows up.
- **`avgEngagement`/`sentimentBreakdown` are never populated by `refresh_author_topic_signals()`.** Blocked on `social_posts` gaining `engagementMetrics`/`sentiment` columns, which is Phase 2's "also build, not storied" enrichment-pipeline wiring — see `.claude/skills/social-post-enrichment/SKILL.md`'s own Known gaps.
- **No production/Azure-side pg_cron enablement has been done** — this story only wires the local ephemeral test container. Enabling `pg_cron` on the real Azure Database for PostgreSQL Flexible Server instance (allow-listing the extension, setting `cron.database_name`) is deployment configuration, not covered by this repo's contract suite.
- **`refresh_author_topic_signals()` is a plain, best-effort aggregation** (`COUNT`/`MIN`/`MAX`/`COUNT DISTINCT month`) over whatever `social_posts` rows currently exist — no batching/pagination, no incremental/delta refresh (always a full recompute). Fine at this project's proven scale (solo project, no real traffic); revisit if a real partition ever holds enough rows to make a full hourly recompute slow.
