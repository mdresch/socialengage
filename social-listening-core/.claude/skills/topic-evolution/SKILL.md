---
name: topic-evolution
description: Backend service and HTTP endpoint for longitudinal topic evolution timeline analytics.
---

# Topic Evolution Service

Governed by **ADR-0097**, **BRD-0097**, **FDD-0097**, and **Story 11.5**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.5.topic-evolution.contract.test.ts` — Story 11.5 contract test.

## Responsibilities

1. **Longitudinal Aggregation (`topicEvolutionService.ts`)**:
   - Aggregates daily topic data into `day`, `week`, or `month` granularity buckets.
   - Calculates 7-day slope trend indicators (`rising` if $> +5\%/\text{day}$, `falling` if $< -5\%/\text{day}$, otherwise `stable`).
   - Surfaces volume metrics (`mentionCount`, `uniqueAuthors`), sentiment distribution (`positive`, `negative`, `neutral`, `mixed`), `topAuthors`, and `topKeywords`.
   - Supports `compareToPrevious` for longitudinal period-over-period comparison.

2. **Storage (`topic_daily_counts`)**:
   - Per-(tenant, date, topic) precomputed daily rollup table with RLS enforcement.

3. **HTTP API**:
   - `GET /v1/topics/evolution?topic=...&start=...&end=...&granularity=day|week|month&compareToPrevious=true|false`
   - `GET /v1/topics/:id/drift?start=...&end=...` — semantic drift detection (Story 13.11, ADR-0116), backed by `SemanticDriftService`. See `.claude/skills/semantic-drift/SKILL.md`.
   - Both routes are authenticated with `requireTenantUser()` and mounted on the same `topicsRouter`.

## Relations to other components

- **`topic_daily_counts` table** — precomputed per-(tenant, date, topic) daily rollup that this endpoint reads directly; never a raw `social_posts` scan at query time.
- **`social_posts` table** — source of raw topic mentions used to populate `topic_daily_counts`; not queried at request time by this skill.
- **`ai-topic-clustering-post-topics-schema` skill** — topic assignments written to `post_topics` are what feeds the daily count aggregations that back this endpoint.
- **`semantic-drift` skill** — semantic drift detection (`GET /v1/topics/:id/drift`) shares the same `topicsRouter` and complements the evolution timeline with keyword-vector shift analysis.
- **`precomputed-analytics-views` skill** — `sentiment_daily_counts` and `source_daily_counts` (ADR-0087) are sibling precomputed views used by analytics endpoints in the same layer.
