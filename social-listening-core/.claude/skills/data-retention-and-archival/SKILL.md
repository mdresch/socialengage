---
name: data-retention-and-archival
description: Tiered retention (Azure Blob Storage archival) and monthly partitioning for social_posts and ingestion_runs. Read this before touching either table's schema, before adding a new retention-window config, or before touching src/archival/*.
---

# Data retention and archival

## What this is

Two different tiering strategies, sharing one blob storage client and one config module (`src/archival/`): `archiveAgedRawPayloads()` (`socialPostArchival.ts`) replaces a `SocialPost` row's `raw_payload` with a blob-storage pointer once it's older than the retention window — the row itself stays in Postgres forever, only the bulky field is tiered. `archiveAgedIngestionRuns()` (`ingestionRunArchival.ts`) removes the *whole row* from Postgres once an `IngestionRun` ages out, exporting it to blob first; `resolveIngestionRun()` is the read-side fallback that makes an archived run still resolvable. Both rely on `social_posts`/`ingestion_runs` being genuinely partitioned monthly (migrations `0011`/`0012`) — archival detaches the aged-out partition, processes it, then reattaches (SocialPost) or drops it (IngestionRun), never a row-by-row `UPDATE`/`DELETE` sweep across the live table.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0018 | Tiered retention: analytically-relevant fields retained indefinitely; `rawPayload` archived to blob after 90 days (configurable); `IngestionRun` archived (not hard-deleted) after 18 months (configurable); monthly range partitioning as the mechanism | 3.5 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.5.tiered-retention-and-archival.contract.test.ts` — a `SocialPost` older than the retention window has `rawPayload` replaced by a resolvable blob pointer, with `tenantId`/`publishedAt`/`enrichment` unchanged; an `IngestionRun` older than its window is genuinely removed from the live table and still resolves via `resolveIngestionRun()`'s blob fallback; both windows default to 90 days/18 months and read from `RAW_PAYLOAD_RETENTION_DAYS`/`INGESTION_RUN_RETENTION_MONTHS`; both tables are genuinely partitioned (`pg_partitioned_table`) and archival is structurally `DETACH`/`ATTACH PARTITION` (SocialPost) or `DETACH PARTITION` + `DROP TABLE` (IngestionRun), never a bare `UPDATE`/`DELETE`; archived `rawPayload` content is recoverable byte-for-byte via its blob pointer.

## How to extend this safely

- **Changing a retention window:** it's `RAW_PAYLOAD_RETENTION_DAYS`/`INGESTION_RUN_RETENTION_MONTHS` env vars (`retentionConfig.ts`), an operational change — never hardcode a new number in `socialPostArchival.ts`/`ingestionRunArchival.ts`.
- **Running archival:** call `archiveAgedRawPayloads()`/`archiveAgedIngestionRuns()` directly — nothing schedules them (see Known gaps). Both use `getAdminPool()` (DDL privilege), never the app's RLS-scoped `getPool()`/`withTenant` — archival is inherently cross-tenant maintenance work, the same category as a migration.
- **Adding a future month's partition ahead of need:** call `SELECT ensure_ingestion_runs_partition('2027-01-01')`/`ensure_social_posts_partition('2027-01-01')` (idempotent SQL functions, migrations `0011`/`0012`) — don't hand-write a `CREATE TABLE ... PARTITION OF` statement elsewhere.
- **Reading an `IngestionRun` that might have aged out:** call `resolveIngestionRun(tenantId, runId)`, never a bare `SELECT ... FROM ingestion_runs WHERE id = $1` if the run could plausibly be 18+ months old — a live-only query silently returns nothing once archived.

## Load-bearing constraints — do not change casually

- **`social_posts` is partitioned by `created_at`, not `published_at`** — a deliberate deviation from ADR-0018's literal implementation default, logged in that ADR's own Amendment Log (2026-07-30). `published_at` is nullable (Story 4.2 — only enriched posts have it), and Postgres requires a partitioned table's partition key to be part of its primary key, which must be `NOT NULL`. Retention is also conceptually about hot-storage age since *ingestion*, not the source platform's original publish date.
- **`social_posts.acquisition_id` has no DB-enforced foreign key into `ingestion_runs` anymore.** Discovered empirically, not assumed: Postgres refuses `ALTER TABLE ingestion_runs DETACH PARTITION ...` while any row elsewhere still holds a live FK into it — a real, enforced FK is fundamentally incompatible with `ingestion_runs`' whole-row archival. `acquisition_started_at` stays as a populated, useful denormalized column; the "every post traces to a real run" guarantee is application-enforced only (`insertSocialPost()` always populates both columns correctly), the same tier `author_id` already partly relies on. Confirmed with the user before dropping the constraint — see this migration's own dated comment.
- **`ingestion_runs`'/`social_posts`' primary keys are composite** (`(id, started_at)`/`(id, created_at)`) — a Postgres requirement for partitioned tables (every unique/PK constraint must include the partition key), not a design choice. Application code doing `WHERE id = $1` is unaffected (composite PKs don't prevent single-column lookups); only code that assumed `id` alone was DB-unique-constrained would need to change, and none does.
- **Rebuilt via backup-table-then-recreate, never `RENAME`-in-place.** Renaming a table doesn't rename its indexes/constraints, so a rename-in-place approach collides on default constraint/index names (`<table>_pkey`, etc.) the moment the new table tries to reuse them. `CREATE TABLE x_data_backup AS SELECT * FROM x; DROP TABLE x; CREATE TABLE x (...); INSERT INTO x SELECT ... FROM x_data_backup; DROP TABLE x_data_backup;` sidesteps this entirely — see migrations `0011`/`0012`'s own comments for why this was necessary, discovered by hitting the collision directly.
- **The `_default` partition (`ingestion_runs_default`/`social_posts_default`) is never archival-eligible.** `findEligiblePartitions()` in both archival modules matches only the `_yYYYYmMM` naming pattern, deliberately excluding it — dropping or reattaching-with-bounds a `DEFAULT` partition would break the table's ability to accept any insert falling outside the generated `-24..+3` month window.
- **`archiveAgedIngestionRuns()`'s exported blob content includes `tenant_id`** — `resolveIngestionRun()` checks it against the caller's `tenantId` before returning, so an archived run can never resolve for the wrong tenant even though blob storage itself has no RLS-equivalent.

## Known gaps / deferred work

- **Nothing schedules archival.** No `pg_cron`/job runner invokes `archiveAgedRawPayloads()`/`archiveAgedIngestionRuns()` periodically — both are proven correct when called directly (this story's own contract), matching the "prove the mechanism, not the whole pipeline" pattern every infrastructure-touching story this session used. Wiring a schedule is separate, not-yet-storied operational work.
- **Tenant offboarding / right-to-erasure (GDPR Article 17) is explicitly out of ADR-0018's own scope** — not addressed here either.
- **Partition-maintenance automation** (periodically calling `ensure_ingestion_runs_partition()`/`ensure_social_posts_partition()` for upcoming months) isn't scheduled — the migrations create a generous `-24..+3` month window at apply time, which is enough headroom for now but isn't unbounded.
- **No batching/pagination within a single archival run** — each eligible partition's rows are processed one at a time in a loop. Fine at this story's proven scale; revisit if a real partition ever holds enough rows that this becomes slow (no evidence of that yet — solo project, no real traffic).
