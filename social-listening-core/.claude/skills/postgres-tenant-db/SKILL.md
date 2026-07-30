---
name: postgres-tenant-db
description: The Postgres connection pool, migration runner, and tenant-context (RLS) helper for social-listening-core. Read this before adding any table with a tenantId column, or any code that queries the database.
---

# Postgres tenant-scoped database layer

## What this is

The database foundation everything else in `social-listening-core` builds on: a `pg`-backed connection pool (`src/db/pool.ts`), a plain-SQL migration runner (`src/db/migrate.ts`, `migrations/*.sql`), and a tenant-context helper (`src/db/withTenant.ts`) that makes Postgres Row-Level Security actually take effect per request. It exists so JSONB (ADR-0016) and tenant isolation (ADR-0015) are real, tested properties of the running database — not just documented intentions.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0016 | Postgres as the database engine; native JSONB backs `SocialPost.rawPayload` | 1.2 |
| ADR-0015 | Tenant isolation enforced via Postgres Row-Level Security, not application-level filtering alone | 5.4 |
| ADR-0025 | A second, persistent local Postgres for manual dev/exploration (`docker-compose.dev.yml`), deliberately independent of the ephemeral test container's lifecycle | 1.4 |

## Contracts that constrain this component

- `contracts/epic-1/story-1.2.postgres-jsonb.contract.test.ts` — `social_posts.raw_payload` is a genuine `jsonb` column, queryable via a JSONB path operator against real Postgres; provisioning docs name Azure Database for PostgreSQL.
- `contracts/epic-5/story-5.4.tenant-isolation-rls.contract.test.ts` — every `tenant_id`-bearing table has RLS enabled and at least one policy (checked live via `pg_class`/`pg_policies`); a query with no tenant context set returns zero rows; an unfiltered query against two tenants' data returns only the caller's own tenant's rows.
- `contracts/epic-1/story-1.4.persistent-local-dev-database.contract.test.ts` — `docker-compose.dev.yml` has its own project name/port/database name/named volume, all distinct from `docker-compose.test.yml`; `db:dev:down` doesn't delete data, only the separately-named `db:dev:reset` does; `scripts/withDevEnv.js` forces the dev connection env vars regardless of the caller's own shell environment (no `||` fallback to a pre-existing value) and preserves a multi-word argument intact.

## How to extend this safely

- **Adding a new table with a `tenantId` column:** add a new `migrations/NNNN_*.sql` file that both creates the table AND enables + FORCEs RLS with a policy in the same migration (see `0002_enable_rls_social_posts.sql`'s pattern). `story-5.4.tenant-isolation-rls.contract.test.ts`'s AC1 check is schema-wide — it will fail automatically on the next full suite run if a new `tenant_id` column ships without a matching policy, catching the exact gap ADR-0015's Negative consequences warned about.
- **Adding SocialPost's other columns** (`authorId`, `acquisitionId`, `platformId`, `publishedAt`, ...): add an `ALTER TABLE social_posts ADD COLUMN ...` migration under that column's own owning story (3.1 Author, 3.2 IngestionRun, 3.4 pagination, etc.) — `0001_create_social_posts.sql` deliberately only has the columns Story 1.2 needed.
- **Querying `social_posts` (or any future tenant-scoped table) from application code:** always go through `withTenant(tenantId, fn)`, never `getPool().query(...)` directly outside it. `withTenant` opens an explicit transaction and sets `app.tenant_id` via `set_config(..., true)` (transaction-local), so the RLS context can never leak onto a pooled connection a different tenant's request reuses afterward.
- **Migrations run as the admin/superuser role** (`PGUSER`, defaulting to `postgres`) via `src/db/migrate.ts`; **the app's runtime pool connects as `app_user`** (`APP_PGUSER`/`APP_PGPASSWORD` in `src/db/pool.ts`). Keep these two roles/connections separate — see Load-bearing constraints below for why.
- **Schema-level maintenance code that isn't a migration** (Story 3.5's archival — `DETACH PARTITION`/`DROP TABLE` on `ingestion_runs`/`social_posts`) needs the same admin privilege level as a migration, but running once at startup like `migrate.ts` doesn't fit its shape (it runs repeatedly, on demand). `src/db/adminPool.ts`'s `getAdminPool()` exists for exactly this: a reusable admin-privileged pool, same credentials as `migrate.ts`'s inline `Client`, for schema-level code that isn't literally a one-shot migration. Never use it for normal tenant-scoped reads/writes — that's still `withTenant`'s job.
- **RLS policies and indexes defined on a partitioned parent table (Story 3.5 — `ingestion_runs`/`social_posts`, both partitioned monthly) apply uniformly to every partition automatically** (PG 11+) — never repeated per partition, and a new partition never needs its own policy/index setup.

## Load-bearing constraints — do not change casually

- **Never point `src/db/pool.ts` at the superuser/migration role.** Postgres never applies RLS to superusers — there is no override, `FORCE ROW LEVEL SECURITY` included. If the app pool ever connects as `postgres` (or any other superuser), every RLS policy silently stops mattering with no error and no visible symptom other than isolation just not being enforced. `app_user` (created in `0002_enable_rls_social_posts.sql`, granted only `SELECT/INSERT/UPDATE/DELETE` on specific tables, not table-owning DDL rights) is what RLS actually restricts.
- **RLS policy conditions must normalize the unset-context case through `NULLIF(current_setting('app.tenant_id', true), '')`, not just `current_setting(..., true)` alone.** Once a custom GUC like `app.tenant_id` has been set at all on a given physical connection (even transaction-locally via `set_config(..., true)`), it resets to an **empty string** on that connection's next reuse, not `NULL` — Postgres has no registered default for custom GUCs to fall back to. `''::uuid` throws a hard cast error rather than safely filtering out all rows. This was hit in practice writing Story 5.4's own contract test (AC2 failed with `invalid input syntax for type uuid: ""` before the fix) — not a hypothetical edge case, and directly relevant given `getPool()` is a real connection pool that reuses physical connections across requests.
- **`withTenant`'s `BEGIN`/`SET LOCAL`-equivalent/`COMMIT`-or-`ROLLBACK` sequence must stay intact.** A raw pooled query with no tenant context set fails closed (zero rows, per Story 5.4 AC2) — that's the safe default a missing call to `withTenant` degrades to. Don't "simplify" this into a bare `set_config(..., false)` (session-scoped, not transaction-scoped) — that would let tenant context leak onto whatever the next request happens to reuse that pooled connection for.

## Known gaps / deferred work

- No migration/query-builder/ORM is in use — `src/db/migrate.ts` applies plain `.sql` files directly via the `pg` client. This is deliberately minimal for Phase 0; revisit once Phase 1's fuller domain model (Stories 3.1 `Author`, 3.2 `IngestionRun`, etc.) makes hand-written SQL migrations genuinely cumbersome, not before.
- Local/CI test runs require **Docker running locally** — `jest.global-setup.js`/`jest.global-teardown.js` bring up and tear down a project-scoped ephemeral Postgres container (`docker-compose.test.yml`, port `5434`) automatically around every `npm test` / `npm run test:contracts` run. This is a new local-dev prerequisite as of Stories 1.2/5.4 (Story 1.1's contracts needed no such thing).
- **A separate, persistent dev Postgres now also exists (Story 1.4, ADR-0025)** — `docker-compose.dev.yml`, port `5435`, own volume — for actually running the server (`npm run dev`) or exploring real data by hand, independent of the ephemeral test container's lifecycle. See ADR-0025 and this file's own Governing ADRs table.
- **Resolved for one real case (2026-07-30):** `refresh_author_topic_signals()` (Story 4.4, ADR-0022, migration `0013`) is the first background/batch process that legitimately operates across all tenants (ADR-0015's Negative consequences anticipated this). It runs as the role that scheduled it via `pg_cron` — the admin/superuser role migrations already use — so RLS never applies, by the same mechanism this file's own Load-bearing constraints describe for superusers generally. `getAdminPool()` is the sanctioned way to invoke or introspect it from application/test code; see `.claude/skills/derived-data-caching-and-refresh/SKILL.md`. Other future cross-tenant batch jobs can follow the same pattern rather than needing a new bypass mechanism designed from scratch.
- `app_user`'s password is a hardcoded, well-known, non-secret value (`app_user_password`) — deliberately so, since this role only ever exists inside an ephemeral, localhost-only dev/test container torn down after each run. Production (Azure Database for PostgreSQL) credential handling is ordinary infra config, not designed here.
