---
name: social-post-enrichment
description: SocialPost's enrichment JSONB blob and publishedAt column for social-listening-core, and ADR-0008's boundary — this subsystem captures topic-time-series-capable data but never builds the aggregation itself. Read this before adding an enrichment field, before touching published_at, or before being tempted to build any topic-volume-over-time table/endpoint here.
---

# SocialPost enrichment fields and the topic-time-series boundary

## What this is

`social_posts.published_at` (when a post was actually published on-platform, distinct from `created_at`, when this system ingested it) and `social_posts.enrichment` (a single JSONB blob holding `entities`/`keyPhrases` today, additive keys like `sentiment`/`detectedLanguage`/`modelUsed` once the real enrichment pipeline lands later). Together they're what ADR-0008 requires exist and be queryable so a future insights/dashboard subsystem can build topic-volume-over-time aggregation directly from this data — without `social-listening-core` building that aggregation, a table, or any charting UI itself.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0008 | Defer `TopicDailyCount` aggregation and all charting to a future subsystem; rely on `enrichment.entities`/`keyPhrases` and `publishedAt` already being captured and queryable on `SocialPost` | 4.2 |

## Contracts that constrain this component

- `contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts` — a `SocialPost` carries `publishedAt`/`enrichment.entities`/`enrichment.keyPhrases`, queryable both via a direct SQL read and via `listSocialPosts()`'s existing read path; no `topic_daily_count`-like table/view exists and no charting-style route is mounted; a raw SQL query grouping `social_posts` by `published_at`'s day and each `enrichment.entities` value reconstructs exact per-day-per-topic counts, proving the captured data is sufficient for a future subsystem without this one computing the aggregation itself.

## How to extend this safely

- **Adding a new enrichment field** (`sentiment`, `detectedLanguage`, `modelUsed` — named in `docs/implementation-plan.md`'s Phase 2 deliverable, not yet built): add it as another key inside the existing `enrichment` JSONB blob via application code, not a new column and not a new migration — that's the entire point of using one JSONB blob here (see Load-bearing constraints).
- **Wiring a real enrichment pipeline** (an actual `AIProviderConnector` populating these fields from real analysis output — Phase 2's "also build, not storied" scope): write into `enrichment`/`published_at` via `insertSocialPost()`'s existing optional parameters; don't add a parallel write path.

## Load-bearing constraints — do not change casually

- **Never build a `TopicDailyCount` table, materialized view, or charting endpoint in this repo.** That is exactly what ADR-0008's Decision rules out — ownership belongs to a future insights/dashboard subsystem. This story's own AC3 query (grouping by day/topic) exists only in its contract test, proving the data supports that future work, not shipped as application code here.
- **`enrichment` is one JSONB blob, not per-field columns.** Adding `sentiment`/`detectedLanguage`/`modelUsed` later must not turn into separate `ALTER TABLE` migrations — that defeats the reason this is JSONB instead of typed columns in the first place (additive keys, no migration per field).
- **`published_at` and `enrichment` are both nullable at the schema level.** Only genuinely enriched posts have them set — Stories 1.2/3.4/5.3/5.4's pre-existing minimal test fixtures insert `social_posts` rows without them, and that must keep working; don't add a `NOT NULL` constraint without addressing those fixtures first.

## Known gaps / deferred work

- **Nothing populates these fields from real posts yet.** That's the real enrichment pipeline (an actual `AIProviderConnector` + wiring into the ingestion pipeline after normalization) — Phase 2's "also build, not storied" scope, not this story's. This story proves the schema and read path are correct given data that exists (inserted directly by its own contract test), the same pattern Story 4.1 used for `AuthorTopicSignal`.
- `entities` is modeled as a plain array of topic-identifier strings for this story's minimal proof — the real enrichment pipeline may need a richer shape (confidence scores, entity types); that's a decision for whoever builds the real pipeline, not speculated here.
