# ADR-0116: Semantic drift detection

**Status:** Accepted (2026-08-28)

**Authorizes:** a v2 `SemanticDriftService` that uses vector embeddings from `RAGConnector` (ADR-0081–0085) to detect when a topic's meaning has shifted over time, and the `GET /v1/topics/:id/drift` endpoint.

**Source:** `docs/product-research/feature-designs/25-topic-evolution-timeline.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Topics are not static
A brand name, product, or hashtag can shift in meaning. "Swift" can mean a programming language, a singer, or a bank. `docs/product-research/feature-designs/25-topic-evolution-timeline.md` v2 requires semantic-drift detection so users can see when a topic's conversation has changed.

### 2. RAG provides the embedding layer
`ADR-0082` (chunking and embedding) and `ADR-0083` (vector-store metadata) store post chunks as vectors. The drift service can compare vectors from different time windows.

### 3. Drift is an advanced, v2 feature
This ADR is intentionally scoped for v2. It depends on a working RAG pipeline and is not required for v1 topic evolution.

---

## Decision

### 1. `SemanticDriftService`
```ts
interface SemanticDriftService {
  computeDrift(topicId: string, start: ISOString, end: ISOString): Promise<DriftResult>;
}

interface DriftResult {
  topicId: string;
  start: string;
  end: string;
  driftScore: number;           // 0.0 (same) to 1.0 (completely different)
  topClustersNow: string[];     // current semantic cluster labels
  topClustersThen: string[];    // previous semantic cluster labels
  samplePostsNow: string[];
  samplePostsThen: string[];
  warning: 'none' | 'mild' | 'significant';
}
```

### 2. Drift computation
- Select `RAG` chunks for the topic in the `start` window and the `end` window.
- Compute the centroid vector for each window.
- `driftScore = 1 - cosine_similarity(centroid_then, centroid_now)`.
- Run k-means or HDBSCAN on each window's chunks to produce `topClusters`.
- Pick sample posts near each centroid for `samplePosts`.

### 3. Drift score thresholds
- `warning = 'none'` if `driftScore < 0.2`.
- `warning = 'mild'` if `0.2 <= driftScore < 0.5`.
- `warning = 'significant'` if `driftScore >= 0.5`.

### 4. `GET /v1/topics/:id/drift` endpoint
```
GET /v1/topics/:id/drift?start=...&end=...
```

- Tenant-scoped; the `topic_id` must belong to the tenant.
- Returns `DriftResult`.
- Cached for 24 hours because drift is expensive to compute.

### 5. UI integration
- The Topic Evolution Timeline (ADR-0097) shows a `warning` icon on periods where `driftScore` is high.
- A `DriftExplanationCard` explains the shift in plain language using `RAGAsk` (ADR-0084).

---

## Consequences

1. **Deeper topic insight:** users can see when a conversation changes meaning, not just volume.
2. **RAG dependency:** the feature only works once the vector pipeline is production-ready.
3. **Compute cost:** centroid and clustering are expensive. 24-hour caching is required.
4. **v2 scope:** this is not needed for v1 topic evolution.

---

## Alternatives considered

1. **Detect drift by keyword frequency changes.**
   - *Rejected:* keyword changes are noisy and do not capture meaning shifts. Vector-based drift is more robust.

2. **Precompute drift for every topic every day.**
   - *Rejected:* it is too expensive. On-demand with caching is sufficient.

3. **Use the `TopicDailyCount` counts as a drift signal.**
   - *Rejected:* counts show volume, not meaning. They are complementary, not a replacement.

---

## Open Questions

- [ ] **[Q-0116-1]** How many chunks per time window should be sampled? 100? 1,000?
- [ ] **[Q-0116-2]** Should drift use all chunks for the topic or only those with high confidence?
- [ ] **[Q-0116-3]** How are ties in `topClusters` handled if cluster names are auto-generated?
- [ ] **[Q-0116-4]** Should drift be computed for sub-topics or only root topics?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0097` (topic evolution timeline), `ADR-0083` (RAG metadata), `ADR-0084` (RAG ask)
