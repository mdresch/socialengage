---
name: social-post-lineage
description: Author normalization and IngestionRun audit anchoring for SocialPost — who wrote a post and which process brought it in. Read this before touching social_posts, authors, or ingestion_runs, or before writing any code that inserts a post.
---

# Social post lineage: Author + IngestionRun

## What this is

The two provenance facts every real `SocialPost` carries: who wrote it (`author_id` → `authors`, Story 3.1/ADR-0004) and which process acquired it (`acquisition_id` → `ingestion_runs`, Story 3.2/ADR-0005). `src/authors/authorStore.ts` upserts authors by `(tenantId, platformId, externalAuthorId)`; `src/ingestion/ingestionRunStore.ts` opens/closes audit-trail runs; `src/posts/socialPostStore.ts` is the sanctioned way to insert a post, requiring both as parameters. Together they're what lets a support engineer trace any post back to exactly who posted it and exactly which run brought it in.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0004 | `Author` normalized once per `(tenantId, platformId, externalAuthorId)`, upserted on arrival; `SocialPost.authorId` references it, no embedded author fields | 3.1 |
| ADR-0005 | Every `SocialPost` carries `acquisitionId` → an immutable `IngestionRun` audit record | 3.2 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.1.author-normalization.contract.test.ts` — two ingests of the same external author yield one `Author` row with `lastSeenAt` advancing; `social_posts` has no embedded author display fields; `postGeoLocation` (per-event) lives on `social_posts`, `profileLocation` (per-account) lives on `authors`.
- `contracts/epic-3/story-3.2.ingestion-run-audit-anchor.contract.test.ts` — a post inserted via `insertSocialPost()` has a real `acquisitionId`; `IngestionRun` records `triggerType`/`connectorVersion`/timestamps/`status`/counts/`errorSummary`; a post's originating run's `connectorVersion`/`triggerType` resolve in one JOIN query.
- `contracts/epic-3/story-3.2.ingestion-run-retryable-field.contract.test.ts` (healing pass, 2026-07-29) — `ingestion_runs.retryable`: `null` for a clean first-attempt success, `true` for a failure after a retryable error was exhausted, `false` for a non-retryable failure or a failed-OAuth-refresh failure.
- `contracts/epic-3/story-3.5.tiered-retention-and-archival.contract.test.ts` — constrains `insertSocialPost()`'s `acquisition_started_at` population and both tables' composite-PK/partitioned shape; see `.claude/skills/data-retention-and-archival/SKILL.md` for what that story actually owns.

## How to extend this safely

- **Inserting a real post:** always go through `insertSocialPost()` — never write to `social_posts` directly. It requires `authorId` and `acquisitionId` as parameters (pass `null` for `authorId` only in genuinely author-less test fixtures; real ingestion always resolves one via `upsertAuthor()` first).
- **A real ingestion run:** `startIngestionRun()` at the beginning of a poll/webhook handling cycle, `completeIngestionRun()` once it's done (success or failure) — this pairing is what ADR-0005's "create run → ingest posts → close run" sequencing means in practice.
- **Adding a new `Author` or `SocialPost` field:** extend the relevant migration's `ALTER TABLE`/`CREATE TABLE`, not a new ad hoc column added elsewhere — keep the schema changes traceable to the story that needed them (see `0004_create_authors.sql`'s and `0005_create_ingestion_runs.sql`'s own comments for the pattern).

## Load-bearing constraints — do not change casually

- **`social_posts.author_id` and `social_posts.acquisition_id` are nullable at the schema level, not enforced `NOT NULL`.** This is deliberate, not an oversight: Stories 1.2/5.4/5.3's contracts insert directly into `social_posts` with neither column set, and making them `NOT NULL` now would break those already-passing contracts (a regression the methodology explicitly forbids introducing without a dated, ADR-justified note). The real "every post has both" invariant is enforced by `insertSocialPost()`'s required TypeScript parameters — that's the actual guarantee, not a DB constraint. Don't add a `NOT NULL` migration without first addressing those older fixtures' inserts.
- **`authors` and `ingestion_runs` both carry `tenant_id` and both got RLS enabled in the same migration that created them** — same pattern, same reasoning as `platform_credentials` (see `postgres-tenant-db`'s SKILL.md). Never add a new `tenant_id`-bearing table without RLS in the same migration; Story 5.4's schema-wide contract catches it, but don't rely on that as the first line of defense.
- **`upsertAuthor()`'s uniqueness is `(tenant_id, platform_id, external_author_id)`, not just `external_author_id`.** The same external author ID could theoretically collide across platforms or (in principle) tenants; the composite key is what ADR-0004 actually specifies.
- **`social_posts.acquisition_id` has no DB-enforced foreign key into `ingestion_runs` as of Story 3.5 (ADR-0018)** — dropped when `ingestion_runs` became partitioned, since Postgres refuses to detach a partition of a table something else still holds a live FK into, which is fundamentally incompatible with `ingestion_runs`' own whole-row archival. `insertSocialPost()` still always populates `acquisition_id` and the denormalized `acquisition_started_at` correctly — the "every post traces to a real run" guarantee is application-enforced only now, the same tier `author_id` already partly relied on. See `.claude/skills/data-retention-and-archival/SKILL.md` for the full reasoning.
- **Both `social_posts` and `ingestion_runs` are partitioned monthly (Story 3.5) with composite primary keys** (`(id, created_at)`/`(id, started_at)` — a Postgres requirement for partitioned tables). `WHERE id = $1` lookups are unaffected; don't assume `id` alone is DB-unique-constrained anymore if writing new code that relies on that.

## Known gaps / deferred work

- No real connector calls any of this yet — `upsertAuthor()`/`startIngestionRun()`/`insertSocialPost()` are proven correct in isolation (this story's contracts), not yet wired into an actual poll cycle. That's Phase 1's "also build, not storied" RSS/News connector work, layered on top once Story 3.3 (watchlist matching) and 3.4 (pagination) are also ready.
- `AuthorTopicSignal` (Story 4.1) and the expert-finder query (`GET /topics/:topic/authors`) build on `authors` later; nothing here anticipates their shape.

## Corrections

- **2026-07-29 (healing pass):** this file previously claimed `ingestion_runs.retryable` "belongs to Story 2.3's error-classification work, which actually populates and consumes it." That was wrong — Story 2.3 shipped using an in-code, non-persisted classification (`ClassifiableError.kind`) and never added the column, a gap only caught by a later full ADR/story consistency audit (2026-07-29). Fixed in this same pass — see `runIngestionAttempt.ts` and the retryable-field contract above. Noted here so the same stale claim doesn't get copied forward again.
