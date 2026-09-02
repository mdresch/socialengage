---
name: topic-evolution
description: Backend service and HTTP endpoint for longitudinal topic evolution timeline analytics.
---

# Topic Evolution Service

Governed by **ADR-0097**, **BRD-0097**, **FDD-0097**, and **Story 11.5**.

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
