# ADR-0108: Influencer discovery and scoring

**Status:** Accepted (2026-08-28)

**Authorizes:** an `Author` scoring model (`influence_score`, `reach_score`, `engagement_score`, `authenticity_score`) and a `GET /v1/influencers` endpoint that discovers, ranks, and filters authors by topic, platform, and impact.

**Source:** `docs/product-research/feature-designs/05-influencer-discovery.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Finding the right authors is a core value prop
`docs/product-research/feature-designs/05-influencer-discovery.md` describes a feature for `Tenant-Business-Analyst` and `Social-Selling-Strategist` to discover authors who are relevant, authoritative, and active around a topic, platform, or watchlist.

### 2. The `Author` model and `AuthorTopicSignal` already exist
`ADR-0004` and `ADR-0007` established the `Author` table and `AuthorTopicSignal` raw signals. Influencer discovery is a scoring and ranking layer on top of these tables.

### 3. Scoring needs transparency and auditability
A black-box popularity score would not be defensible. The score must be explainable and composed of clear, bounded signals.

---

## Decision

### 1. New `Author` scoring columns
```sql
ALTER TABLE author ADD COLUMN
  reach_score numeric,
  engagement_score numeric,
  authenticity_score numeric,
  influence_score numeric;
```

- `reach_score` — derived from the author's follower count, impression reach, or network size.
- `engagement_score` — derived from average likes, comments, shares, and retweets per post.
- `authenticity_score` — derived from posting cadence, audience-to-engagement ratio, and bot-like behavior heuristics.
- `influence_score` — a weighted composite of reach, engagement, authenticity, and topic relevance.

### 2. Score computation
- A daily `AuthorScoringRefresh` worker recomputes scores from `Author` and `AuthorTopicSignal`.
- Scores are capped at 100 and stored as `numeric(5,2)`.
- Weights are configurable per tenant but have sensible defaults:
  - `influence_score = 0.25*reach + 0.35*engagement + 0.20*authenticity + 0.20*topic_relevance`.
- The worker uses precomputed `AuthorDailyCount` (ADR-0087) for engagement and reach.

### 3. `GET /v1/influencers` endpoint
```
GET /v1/influencers?topicId=...&platformId=...&watchlistId=...&minScore=...&sort=...&limit=50
```

**Response**
```ts
{
  influencers: Array<{
    authorId: string;
    authorName: string;
    platformId: string;
    publicUrl?: string;
    reachScore: number;
    engagementScore: number;
    authenticityScore: number;
    influenceScore: number;
    topTopics: Array<{ topicId: string; topicName: string; relevance: number }>;
    recentPosts: number;
  }>;
}
```

### 4. Filtering and sorting
- `topicId` — authors with high relevance to a topic.
- `platformId` — authors active on a specific platform.
- `watchlistId` — authors whose posts match a watchlist.
- `minScore` — minimum `influence_score`.
- `sort` — `influence`, `reach`, `engagement`, `authenticity`, `recentPosts`.
- `limit` — default 50, hard cap 200.

### 5. UI / UX
- `InfluencerDiscoveryView` with filters, score bars, and sorting.
- `InfluencerCard` shows the four score bars and top topics.
- `AddToProspectingList` action adds the author to a `prospecting_list` (ADR-0086).
- `ViewAuthorPosts` links to `GET /v1/posts?authorId=...`.

### 6. Score explainability
- `GET /v1/influencers/:authorId/explain` returns the breakdown of `influence_score` for a given author.
- Metric explainability (ADR-0078) can be used for the score bars.

---

## Consequences

1. **Authoritative discovery:** users can find authors by impact, not just keyword.
2. **Transparent scoring:** the four scores are explainable and auditable.
3. **Foundation for RAG:** `RAGConnector.search()` (ADR-0084) can later find semantically similar authors.
4. **Daily scoring cost:** the refresh worker is bounded to once a day and uses precomputed views.

---

## Alternatives considered

1. **Use a single, opaque popularity score.**
   - *Rejected:* it is not defensible. Four component scores are more useful and transparent.

2. **Score authors in real time on every `GET /v1/influencers` call.**
   - *Rejected:* it is too expensive. Daily precomputed scores are fast and consistent.

3. **Use a third-party influencer-ranking API.**
   - *Rejected:* it adds vendor cost and violates data-sovereignty principles. The platform scores from its own ingested data.

---

## Open Questions

- [ ] **[Q-0108-1]** Should `authenticity_score` use an external bot-detection service, or in-house heuristics?
- [ ] **[Q-0108-2]** How are scores normalized across platforms with different metrics (e.g. X vs. LinkedIn)?
- [ ] **[Q-0108-3]** Should tenants be able to customize the weights, or is a fixed default enough?
- [ ] **[Q-0108-4]** How does the daily refresh handle new or rarely seen authors?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/05-influencer-discovery.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0004` (`Author` model), `ADR-0007` (`AuthorTopicSignal`), `ADR-0087` (`AuthorDailyCount`), `ADR-0086` (prospecting list)
