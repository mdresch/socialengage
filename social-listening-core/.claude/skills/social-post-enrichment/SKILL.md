---
name: social-post-enrichment
description: SocialPost's enrichment JSONB blob and publishedAt column for social-listening-core, and ADR-0008's boundary — this subsystem captures topic-time-series-capable data but never builds the aggregation itself. Read this before adding an enrichment field, before touching published_at, or before being tempted to build any topic-volume-over-time table/endpoint here.
---

# SocialPost enrichment fields and the topic-time-series boundary

## What this is

`social_posts.published_at` (when a post was actually published on-platform, distinct from `created_at`, when this system ingested it) and `social_posts.enrichment` (a single JSONB blob). As of Story 2.8, `enrichment` is real, populated data from a live `AIProviderConnector` (Azure AI Language) on every GNews/Newswire post — `entities` (`{text, category, confidenceScore}[]`), `keyPhrases` (`string[]`), `sentiment`/`sentimentScores`, `detectedLanguage`, `modelUsed`. Together `enrichment` and `publishedAt` are what ADR-0008 requires exist and be queryable so a future insights/dashboard subsystem can build topic-volume-over-time aggregation directly from this data — without `social-listening-core` building that aggregation, a table, or any charting UI itself.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0008 | Defer `TopicDailyCount` aggregation and all charting to a future subsystem; rely on `enrichment.entities`/`keyPhrases` and `publishedAt` already being captured and queryable on `SocialPost` | 4.2 |
| ADR-0038 | The real provider whose output actually fills `enrichment` — Azure AI Language, via `enrichPost()` (`.claude/skills/azure-ai-language-connector/SKILL.md`), wired into both GNews's and Newswire's own ingest functions ahead of `insertSocialPost()` | 2.8 |
| ADR-0064 | Country-level geospatial extraction and normalization (`geoCountry`, `geoCountryName`, `geoRegion`, `geoSource`, `geoConfidence`) inside `enrichment` JSONB blob, with provenance and confidence tracking | 2.20 |
| ADR-0071 | Human-in-the-Loop Post Enrichment Overrides API (`PATCH /v1/posts/:id/enrichment`), `enrichment.override` audit metadata lineage, and 409 Conflict automated re-enrichment precedence guard | 3.13 |

## Contracts that constrain this component

- `contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts` — a `SocialPost` carries `publishedAt`/`enrichment.entities`/`enrichment.keyPhrases`, queryable both via a direct SQL read and via `listSocialPosts()`'s existing read path; no `topic_daily_count`-like table/view exists and no charting-style route is mounted; a raw SQL query grouping `social_posts` by `published_at`'s day and each entity's own `text` reconstructs exact per-day-per-topic counts, proving the captured data is sufficient for a future subsystem without this one computing the aggregation itself. **Updated 2026-08-10 (Story 2.8, dated note in the contract's own header):** `entities` widened from `string[]` to `{text,category,confidenceScore}[]` — the AC3 query now uses `jsonb_array_elements` + `->>'text'`, not `jsonb_array_elements_text`.
- `contracts/epic-2/story-2.8.azure-ai-language-connector.contract.test.ts` — the real pipeline that actually populates these fields now. Not re-proven here; this component's own contract only proves the schema/read-path are correct given data that exists.
- `contracts/epic-2/story-2.20.geospatial-enrichment.contract.test.ts` — country-level geospatial extraction and normalization across GNews, Newswire, and tenant-owned-feed, populating `geoCountry`, `geoCountryName`, `geoSource`, and `geoConfidence` within `enrichment` with zero DB migrations.
- `contracts/epic-3/story-3.13.post-enrichment-overrides.contract.test.ts` — verifies `PATCH /v1/posts/:id/enrichment` updates sentiment, sentimentScore, keyPhrases, detectedLanguage, geoCountry, summary, persists `enrichment.override` audit lineage, and enforces `409 Conflict` on `POST /v1/posts/:id/enrich` when `isOverridden === true` unless `force: true` is passed.

## How to extend this safely

- **Adding a new enrichment field**: add it as another key inside the existing `enrichment` JSONB blob via application code, not a new column and not a new migration — that's the entire point of using one JSONB blob here (see Load-bearing constraints). Also update `AnalyzeResult` (`src/connectors/types.ts`) if the new field is something `analyze()` itself should populate.
- **A new connector's own ingest function wanting enrichment** (a future Story 2.9 LLM-based provider, or a future real social connector beyond GNews/Newswire): call `enrichPost(tenantId, text)` (`.claude/skills/azure-ai-language-connector/SKILL.md`) right before `insertSocialPost()`, passing its result straight into `insertSocialPost()`'s existing `enrichment` parameter — the same pattern `pollGNewsSearch.ts`/`pollNewswireFeeds.ts` both already use. Never write a parallel enrichment path.

## Load-bearing constraints — do not change casually

- **Never build a `TopicDailyCount` table, materialized view, or charting endpoint in this repo.** That is exactly what ADR-0008's Decision rules out — ownership belongs to a future insights/dashboard subsystem. This story's own AC3 query (grouping by day/topic) exists only in its contract test, proving the data supports that future work, not shipped as application code here.
- **`enrichment` is one JSONB blob, not per-field columns.** Adding `sentiment`/`detectedLanguage`/`modelUsed` later must not turn into separate `ALTER TABLE` migrations — that defeats the reason this is JSONB instead of typed columns in the first place (additive keys, no migration per field).
- **`published_at` and `enrichment` are both nullable at the schema level.** Only genuinely enriched posts have them set — Stories 1.2/3.4/5.3/5.4's pre-existing minimal test fixtures insert `social_posts` rows without them, and that must keep working; don't add a `NOT NULL` constraint without addressing those fixtures first.

## Known gaps / deferred work

- **Enrichment is now real (Story 2.8, 2026-08-10)** — `enrichPost()` populates these fields from a live Azure AI Language call on every GNews/Newswire post. Kept, corrected, not deleted, per this doc series' own "don't rewrite history" convention: this bullet previously said nothing populated these fields yet.
- **`entities` is now `{text, category, confidenceScore}[]`, not a plain array of strings** — confirmed against real Azure AI Language API output (Story 2.8), not the placeholder shape this story originally used for its own minimal schema-proof fixtures. Story 4.2's own contract was updated accordingly, with a dated note in its own file.
- **Enrichment is best-effort, never a hard dependency of ingestion succeeding** — a tenant with no Azure AI Language credential, an inactive one (Story 1.11/ADR-0051, healed 2026-08-12), or a persistent enrichment failure after retries, still gets the post ingested with `enrichment` left `undefined`. See `.claude/skills/azure-ai-language-connector/SKILL.md`'s own Load-bearing constraints.
