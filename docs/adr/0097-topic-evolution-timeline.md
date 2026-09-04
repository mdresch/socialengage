# ADR-0097: Topic evolution timeline

**Status:** Accepted (2026-08-28)

**Authorizes:** a time-series topic-evolution endpoint (`GET /v1/topics/evolution`) that uses `TopicDailyCount` and `AuthorTopicSignal` to surface how topics, sentiment, and key authors change over time.

**Source:** `docs/product-research/feature-designs/25-topic-evolution-timeline.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Topics change over time
`docs/product-research/feature-designs/25-topic-evolution-timeline.md` and the `Topic-Center-Analyst` stakeholder profile require a way to see how a topic grew, what sentiment it carried, and which authors drove it. This is a longitudinal analysis feature, not a single snapshot.

### 2. Precomputed views provide the backbone
`ADR-0087` (Preconfigured analytics views) provides `TopicDailyCount`, `AuthorDailyCount`, and `SentimentDailyCount`. These tables already aggregate the necessary data. The topic evolution endpoint reads from them.

### 3. Semantic drift is a future differentiator
Future versions can use vector embeddings from `ADR-0083` to detect when a topic's meaning has shifted. v1 is based on explicit topic IDs and keyword counts.

---

## Decision

### 1. New `GET /v1/topics/evolution` endpoint
```
GET /v1/topics/evolution?topicId=...&start=...&end=...&granularity=day
```

**Response (HTTP 200)**
```ts
{
  topicId: string;
  topicName: string;
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week' | 'month';
  points: Array<{
    date: string;
    mentionCount: number;
    uniqueAuthors: number;
    sentiment: { positive: number; negative: number; neutral: number; mixed: number };
    topAuthors: Array<{ authorId: string; authorName: string; count: number }>;
    topKeywords: Array<{ keyword: string; count: number }>;
    trend: 'rising' | 'stable' | 'falling';
  }>;
}
```

### 2. Data sources
- `TopicDailyCount` for `mentionCount` and `uniqueAuthors`.
- `SentimentDailyCount` for sentiment distribution (filtered by the topic's matching watchlists or by the topic itself).
- `AuthorTopicSignal` for `topAuthors`.
- `post_topics` (from ADR-0044/`04-ai-topic-clustering`) for `topKeywords`.

### 3. Granularity and bucketing
- `granularity` can be `day`, `week`, or `month`.
- `day` is the default and uses `TopicDailyCount` directly.
- `week` and `month` are computed on the fly by summing daily rows.
- The endpoint supports a `compareToPrevious` flag that overlays the previous period.

### 4. Trend detection
- `trend` is computed from the slope of the last 7 days of `mentionCount`.
- `rising` if slope > 5% per day.
- `falling` if slope < -5% per day.
- `stable` otherwise.

### 5. UI timeline components
- `TopicEvolutionTimeline` renders a multi-series chart (volume, sentiment, unique authors).
- `TrendAnnotation` marks `rising`/`falling` points.
- `AuthorSparkline` shows top authors over time.
- `KeywordHeatmap` shows the top 10 keywords per period.

### 6. Semantic drift (v2, optional)
- v1 does not include semantic drift.
- `RAGConnector.search()` (ADR-0083/0084) can later detect clusters of semantically similar posts and surface "this topic now means something different" warnings.

---

## Consequences

1. **Longitudinal analysis:** users can see how a conversation developed over days or weeks.
2. **Reuses precomputed views:** the endpoint is fast and does not scan raw posts.
3. **Foundation for RAG:** the same point-in-time slices can be used by RAG for question answering about historical topics.
4. **Topic stability:** the endpoint requires `topic_id` stability over the requested period. Topic merges and renames are handled by a separate process.

---

## Alternatives considered

1. **Compute the timeline on every request from `social_posts`.**
   - *Rejected:* it is too slow for long time windows and large tenants. Precomputed views are required.

2. **Store precomputed weekly and monthly tables in addition to daily.**
   - *Rejected:* it adds storage. Summing daily rows on the fly is fast enough for the expected query volume.

3. **Include semantic-drift detection in v1.**
   - *Rejected:* it requires the RAG/vector layer and adds significant scope. v1 uses explicit topic IDs and counts.

---

## Open Questions

- [ ] **[Q-0097-1]** Should the endpoint accept a `watchlistId` instead of a `topicId` and derive topics from the watchlist's matched posts?
- [ ] **[Q-0097-2]** How are topic merges and renames reflected in historical `TopicDailyCount` rows? Do we backfill or mark as `rebased_at`?
- [ ] **[Q-0097-3]** Should `topKeywords` come from precomputed topic keywords or be computed on the fly?
- [ ] **[Q-0097-4]** What is the right trend threshold? 5% per day, or a 7-day rolling average?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0087` (preconfigured analytics views), `ADR-0083` (RAG metadata), `ADR-0084` (RAG ask)
