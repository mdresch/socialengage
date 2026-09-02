---
name: topic-evolution-ui
description: Frontend UI components for the topic evolution timeline, trend annotations, and keyword/author widgets.
---

# Topic Evolution Timeline UI

Governed by **ADR-0097**, **BRD-0097**, **FDD-0097**, and **Story 11.6**.

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-11/story-11.6.topic-evolution-ui.contract.test.ts` — Story 11.6 contract test.

## Key Responsibilities

1. **`core-client.ts` Integration**:
   - `getTopicEvolution(options)`: Fetches longitudinal time-series data with points, sentiment distributions, top keywords, driver authors, and 7-day slope trend indicators.

2. **BFF Proxy Handler**:
   - `/api/topics/evolution`: Proxy for authenticated tenant queries.

3. **`TopicEvolutionTimeline.tsx` Component**:
   - Multi-series volume bar visualization with stacked sentiment colors.
   - `TrendAnnotation` badge displaying `rising` (🔥), `falling` (📉), or `stable` (➡️).
   - `AuthorSparkline` (top driver authors) and `KeywordHeatmap` (top keywords frequency breakdown) detail cards.
   - Interactive date range, topic selector, and granularity controls (`day`, `week`, `month`).
   - `compareToPrevious` overlay for period-over-period trend analysis.
   - Deep linking synchronization via query params (`topic`, `granularity`, `compareToPrevious`).
