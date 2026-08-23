# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0108: Influencer Discovery and Scoring |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0108, BRD-0108, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

**What problem are we solving?**
Social-selling strategists, topic-center analysts, and brand-reputation managers need a defensible way to discover authors who are relevant, authoritative, and active around a topic, platform, or watchlist. Without a transparent scoring model, users must rely on manual keyword searches and guesswork, which makes outreach list building, campaign planning, and crisis triage slow and error-prone.

This FDD translates the accepted architecture and business requirements from ADR-0108 and BRD-0108 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Four new `Author` scoring attributes: `reach_score`, `engagement_score`, `authenticity_score`, and `influence_score`.
- A daily `AuthorScoringRefresh` worker that recomputes scores from `Author`, `AuthorTopicSignal`, and `AuthorDailyCount`.
- `GET /v1/influencers` discovery endpoint with `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit` parameters.
- `GET /v1/influencers/:authorId/explain` endpoint for score breakdown.
- `InfluencerDiscoveryView` UI with filters, score bars, sorting, and an "add to prospecting list" action.
- `InfluencerCard` showing the four score bars, top topics, recent post count, and links to the author’s posts.
- Score weights configurable per-tenant with sensible defaults.
- RLS protection and cross-tenant isolation for all scoring data.
- **Out of scope:** - Real-time / on-every-request score computation.
- Use of a third-party influencer-ranking API.
- A single opaque popularity score.
- Real-time `AuthorInfluenceChangedEvent` streaming (deferred unless real-time ranking is later needed).
- Bot-detection service integration (open decision; in-house heuristics for v1 unless decided otherwise).
- **Assumptions and constraints:** - `Author` and `AuthorTopicSignal` tables exist and are already populated (ADR-0004, ADR-0007).
- `AuthorDailyCount` precomputed aggregates are available (ADR-0087).
- The prospecting list capability exists or will exist before the UI action is enabled (ADR-0086).
- Only **public** author metadata is stored; private audience data (emails, DMs) is never collected.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Finding the right authors is a core value prop
`docs/product-research/feature-designs/05-influencer-discovery.md` describes a feature for `Tenant-Business-Analyst` and `Social-Selling-Strategist` to discover authors who are relevant, authoritative, and active around a topic, platform, or watchlist.

### 2. The `Author` model and `AuthorTopicSignal` already exist
`ADR-0004` and `ADR-0007` established the `Author` table and `AuthorTopicSignal` raw signals. Influencer discovery is a scoring and ranking layer on top of these tables.

### 3. Scoring needs transparency and auditability
A black-box popularity score would not be defensible. The score must be explainable and composed of clear, bounded signals.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable users to discover high-impact authors by topic, platform, or watchlist | `GET /v1/influencers` returns ranked results filtered by the selected dimension |
| 2 | Make scoring transparent and defensible | Every `influence_score` can be explained by four component scores and a published weight formula |
| 3 | Protect data sovereignty and avoid black-box vendor dependencies | Scores are computed from ingested platform data inside the tenant-scoped system |
| 4 | Prepare for future AI / RAG-driven discovery | Scored author records provide a clean baseline for `RAGConnector.search()` and similar extensions |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall compute and store four `Author` scores: `reach_score`, `engagement_score`, `authenticity_score`, and `influence_score` | Must | `Author` table contains the four numeric columns and a daily refresh worker updates them | Product Owner |
| BR-002 | The system shall expose a `GET /v1/influencers` discovery endpoint | Must | Endpoint accepts `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit`; default `limit` 50, hard cap 200 | Product Owner |
| BR-003 | The `GET /v1/influencers` response shall include author identity, scores, top topics, and recent post count | Must | Response shape matches ADR-0108 §3 | Product Owner |
| BR-004 | The system shall support sorting by `influence`, `reach`, `engagement`, `authenticity`, and `recentPosts` | Must | Each sort option returns a consistent, deterministic ordering | Product Owner |
| BR-005 | The system shall provide a score explanation endpoint | Must | `GET /v1/influencers/:authorId/explain` returns the weighted `influence_score` breakdown | Product Owner |
| BR-006 | The system shall offer an `InfluencerDiscoveryView` with filters and score bars | Should | UI matches Story 12.16 acceptance criteria | Product Owner |
| BR-007 | The system shall allow users to add discovered authors to a prospecting list | Should | "Add to prospecting list" action opens the list selector and persists the author (ADR-0086) | Product Owner |
| BR-008 | The system shall allow tenants to customize `influence_score` weights | Could | Weights can be overridden in `tenant_settings` after v1 with ±50% bounds | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Social-Selling-Strategist | Primary end user — builds prospecting lists | High | Score by engagement / authenticity / relevance; export to CSV/CRM |
| Topic-Center-Analyst | Primary end user — tracks topic authority | High | See most influential authors around a topic and track changes over time |
| Tenant-Brand-Reputation-Manager | Primary end user — crisis and reputation monitoring | High | Identify high-reach authors amplifying or attacking the brand; alert on influence spikes |
| Tenant-Business-Analyst | Secondary end user — data correlation | Medium | Export author signal data and correlate with business dimensions |
| Menno | Product Owner / Technical Lead | High | Transparent, defensible, tenant-scoped design with no black-box dependencies |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.15 | backend engineer | `Author` scoring columns and `GET /v1/influencers`, | `Social-Selling-Strategist` can discover and rank relevant authors. | `Author` table has `reach_score`, `engagement_score`, `authenticity_score`, `influence_score`.; `AuthorScoringRefresh` worker updates scores daily.; `GET /v1/influencers` supports `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit`. |
| 12.16 | `Social-Selling-Strategist` | an influencer discovery page with filters, score bars, and an "add to prospecting list" action, | I can find and save high-value authors. | `InfluencerDiscoveryView` with filters for topic, platform, watchlist, and score.; `InfluencerCard` shows four score bars and top topics.; Sorting by `influence`, `reach`, `engagement`, `authenticity`. |

### 6.3 Workflow Diagrams / Steps

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

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Author` scoring columns (`reach_score`, `engagement_score`, `authenticity_score`, `influence_score`) | Computed, bounded scores per author | `Author`, `AuthorTopicSignal`, `AuthorDailyCount` | Engineering | Public metadata / tenant-scoped |
| `AuthorDailyCount` | Precomputed engagement and reach aggregates | Derived from `SocialPost` (ADR-0087) | Engineering | Tenant-scoped derived data |
| `AuthorTopicSignal` | Raw topical signals per author and topic | Ingestion pipeline (ADR-0007) | Engineering | Public metadata / tenant-scoped |
| `prospecting_list` entries | Saved author references for outreach | `InfluencerDiscoveryView` (ADR-0086) | Product | Tenant-scoped business data |
| Score weights per tenant | Optional weight overrides | `tenant_settings` | Product | Tenant configuration |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | An `influence_score` is a weighted composite: `0.25 * reach + 0.35 * engagement + 0.20 * authenticity + 0.20 * topic_relevance` by default, unless the tenant has customized weights. |
| BRU-002 | All individual scores are capped at 100 and stored with two decimal places. |
| BRU-003 | Scores are recomputed at most once per day by the `AuthorScoringRefresh` worker. |
| BRU-004 | `GET /v1/influencers` always filters results to the current tenant’s `tenant_id` via RLS. |
| BRU-005 | `limit` on `GET /v1/influencers` defaults to 50 and may not exceed 200. |
| BRU-006 | Score explanation must include the four component scores and the weights used to compute `influence_score`. |
| BRU-007 | Private audience data — emails, DMs, contact lists — must not be collected or stored for influencer scoring. |

---

---

## 9. Interfaces and Integrations

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

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Scores must be deterministic for the same input | Reliability | Must | Contract tests verify identical inputs yield identical scores across runs |
| NFR-002 | Scoring data must be isolated by tenant | Security | Must | Cross-tenant leakage is prevented by RLS and contract tests |
| NFR-003 | Discovery endpoint response time must support interactive filtering | Performance | Should | p95 response under 2 seconds for the default 50-item result set |
| NFR-004 | Only public author metadata may be stored and exposed | Compliance | Must | No private audience data (emails, DMs) is persisted or returned |
| NFR-005 | Scoring must respect platform Terms of Service | Compliance | Must | Data sources and storage are limited to public profile and public-post data |
| NFR-006 | Score computation must be bounded to once per day | Scalability | Must | Daily worker is scheduled; live queries do not recompute scores on demand |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Daily scoring worker becomes expensive as author volume grows | Medium | High | Use precomputed `AuthorDailyCount`; bound refresh to once per day; monitor duration and cost | Engineering |
| R-002 | `authenticity_score` relies on heuristics that may miss sophisticated inauthentic behavior | Medium | High | Start with documented in-house heuristics; evaluate an external bot-detection service as a future option | Product / Data |
| R-003 | Cross-platform normalization is hard (e.g. X vs. LinkedIn engagement semantics) | Medium | Medium | Store per-platform baselines in scoring; document normalization assumptions; keep weights configurable | Data |
| R-004 | Platform ToS violations from storing public metadata | Low | High | Limit storage to public profile / public post data; review platform API terms; maintain audit log of sources | Legal / Compliance |
| R-005 | Users distrust a new score if it is not explainable | Medium | High | Provide `explain` endpoint, score bars in UI, and documented weight formula; keep four component scores visible | Product |
| R-006 | ADR remains Proposed; requirements may shift | High | High | Keep this BRD in draft; re-baseline once ADR is accepted | Product Owner |

---

---

## 12. Assumptions and Dependencies

- `Author` and `AuthorTopicSignal` tables exist and are already populated (ADR-0004, ADR-0007).
- `AuthorDailyCount` precomputed aggregates are available (ADR-0087).
- The prospecting list capability exists or will exist before the UI action is enabled (ADR-0086).
- Only **public** author metadata is stored; private audience data (emails, DMs) is never collected.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `Author` model established (ADR-0004) | Internal | Engineering | Accepted |
| D-002 | `AuthorTopicSignal` raw signals (ADR-0007) | Internal | Engineering | Accepted |
| D-003 | `AuthorDailyCount` precomputed aggregates (ADR-0087) | Internal | Engineering | Accepted |
| D-004 | Prospecting list capability (ADR-0086) | Internal | Engineering | Before Story 12.16 |
| D-005 | `pg_cron` or equivalent scheduled refresh infrastructure | Internal | Engineering | In place (Story 4.x derived-data-caching-and-refresh) |
| D-006 | `RAGConnector.search()` (ADR-0084) for future semantic author discovery | Future | Engineering | Optional; not blocking v1 |

---

---

## 13. Open Questions

- Should `authenticity_score` use an external bot-detection service, or in-house heuristics?
- How are scores normalized across platforms with different metrics (e.g. X vs. LinkedIn)?
- Should tenants be able to customize the weights, or is a fixed default enough?
- How does the daily refresh handle new or rarely seen authors?

---

---

## 14. Appendix

### Reference Documents

- ADR-0108: `docs/adr/0108-influencer-discovery-and-scoring.md`
- BRD-0108: `docs/project docs/Business-Requirements/BRD-0108-Influencer-Discovery-And-Scoring.md`
- Feature design: `docs/product-research/feature-designs/05-influencer-discovery.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0108 and BRD-0108. |