---
name: author-topic-signals
description: AuthorTopicSignal raw signals and GET /v1/topics/:topic/authors for social-listening-core. Read this before touching author_topic_signals, before adding a sort option to the expert-finder endpoint, or before wiring anything that populates this table from real posts.
---

# Author-topic signals and the expert-finder endpoint

## What this is

The raw, unscored per-`(tenant, author, topic)` signal table (`mentionCount`, `firstMentionAt`/`lastMentionAt`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown`) that backs `GET /v1/topics/:topic/authors` (`src/http/versions/v1/topicsRouter.ts`), read via `getAuthorTopicSignals()` (`src/topics/authorTopicSignalStore.ts`). ADR-0007's core decision: no computed expertise score is stored — ranking logic stays with the API consumer via `sortBy=activeMonths|mentionCount`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0007 | `AuthorTopicSignal` ships with raw signals only, no computed expertise score; `sortBy` moves ranking logic to the API consumer | 4.1 |

## Contracts that constrain this component

- `contracts/epic-4/story-4.1.author-topic-signals.contract.test.ts` — `author_topic_signals` has the ADR-0007 raw columns and no `expertiseScore`-like column; `GET /v1/topics/:topic/authors?sortBy=activeMonths|mentionCount` sorts descending accordingly with only raw fields in the response; an invalid `sortBy` is rejected (400), not silently defaulted; the read path never queries `social_posts`.

## How to extend this safely

- **Reading topic-author signals:** always go through `getAuthorTopicSignals()` — never query `author_topic_signals` directly from a router or elsewhere.
- **Adding a new raw signal field** (e.g. something else ADR-0007-adjacent): extend `migrations/0009_create_author_topic_signals.sql`'s successor migration and the store's `AuthorTopicSignal` interface together — never add a computed/derived field here; that's exactly what ADR-0007 rules out for this table.
- **Adding a new `sortBy` value:** extend the `AuthorTopicSortBy` union in `authorTopicSignalStore.ts` and the router's `VALID_SORT_BY` list together, and map it to a real column via the same hardcoded ternary/switch pattern already there — never interpolate the query-string value directly into the `ORDER BY` clause.

## Load-bearing constraints — do not change casually

- **`getAuthorTopicSignals()` must never query `social_posts`.** This table is a read of an already-populated signal store, not a live per-request aggregation — that's ADR-0007's "periodically refreshed materialized view" framing, and this story's own AC3 contract checks it by source-text inspection. If a future story genuinely needs live aggregation, that's a different, explicitly-decided architecture change, not a drive-by addition here.
- **No expertise-score-like column, ever, on this table or in the API response.** ADR-0007 exists specifically to keep ranking logic out of the data model. A PR that adds a weighted/composite score column here is reintroducing exactly what this ADR rejected — that needs its own ADR, not a schema tweak.
- **`sortBy`'s column mapping is a hardcoded ternary, never string-interpolated user input**, since `ORDER BY` can't be parameterized the way `WHERE` values can — see `authorTopicSignalStore.ts`.

## Known gaps / deferred work

- **Nothing populates `author_topic_signals` from real posts yet.** That needs `enrichment.entities`/`enrichment.keyPhrases` (topic extraction), `engagementMetrics`, and `sentiment` on `social_posts` — none of which exist yet (Story 4.2, ADR-0008, and the Phase 2 "also build, not storied" enrichment-pipeline wiring, per `docs/implementation-plan.md`). Until that lands, rows only exist however a caller directly inserts them (this story's own contract test does exactly that).
- **No scheduled refresh job.** ADR-0022 (Story 4.4, accepted 2026-07-29 but Phase-4-scheduled) is what actually builds the hourly `pg_cron` refresh this table is meant to receive. Story 4.1 only proves the schema and read path are correct given rows that already exist — see this story's contract Intent comment for the "prove the derivation, not the whole pipeline" reasoning (same pattern Story 4.3 used for `ConnectorHealth`/`IngestionRun`).
- Tenant identity is the same `X-Tenant-Id` header placeholder used by `posts-api` — see that `SKILL.md`'s Load-bearing constraints for why it isn't a real security boundary yet (Phase 5's job).
- No RLS-isolation contract test here specifically — `author_topic_signals` follows the exact same tenant-isolation pattern as `authors`/`ingestion_runs` (RLS enabled in the same migration that creates it), and that mechanism is Story 5.4's own contract's job to guarantee, not re-tested per new table.
