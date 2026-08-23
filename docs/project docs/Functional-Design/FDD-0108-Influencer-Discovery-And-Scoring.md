# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0108 Influencer Discovery and Scoring — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0108, BRD-0108, feature design 05) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0108 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0108, BRD-0108, `docs/product-research/feature-designs/05-influencer-discovery.md`, Story 12.15, Story 12.16, ADR-0004, ADR-0007, ADR-0087, ADR-0086 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0108 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the scoring model and endpoints below may still change before acceptance.

Today `Author` and `AuthorTopicSignal` capture normalized profile data and raw topical signals, but there is no systematic way to discover or rank authors by impact — finding authoritative voices is manual and subjective. This document defines the functional behavior of a transparent, four-component `Author` scoring model (`reach_score`, `engagement_score`, `authenticity_score`, `influence_score`), the daily `AuthorScoringRefresh` worker that computes it, the `GET /v1/influencers` discovery endpoint, and the `GET /v1/influencers/:authorId/explain` score-breakdown endpoint.

### 2.2 Scope

**In scope:**
- Four new `Author` scoring columns: `reach_score`, `engagement_score`, `authenticity_score`, `influence_score`.
- The daily `AuthorScoringRefresh` worker and its computation formula.
- `GET /v1/influencers` (filter by `topicId`, `platformId`, `watchlistId`, `minScore`; sort by `influence`/`reach`/`engagement`/`authenticity`/`recentPosts`; `limit` default 50, hard cap 200).
- `GET /v1/influencers/:authorId/explain` score breakdown.
- `InfluencerDiscoveryView`/`InfluencerCard` UI, including "Add to prospecting list" and "View posts" actions.
- Per-tenant configurable score weights (bounded).

**Out of scope:**
- Real-time / on-every-request score computation.
- Third-party influencer-ranking API integration.
- A single opaque popularity score.
- Real-time `AuthorInfluenceChangedEvent` streaming.
- External bot-detection service integration (in-house heuristics only for v1, pending open question).

### 2.3 Target Audience

Backend engineers implementing the scoring columns, refresh worker, and endpoints (Story 12.15); frontend engineers building `InfluencerDiscoveryView` (Story 12.16); QA authoring determinism and cross-tenant-isolation contract tests; Social-Selling-Strategists, Topic-Center-Analysts, and Brand-Reputation-Managers who will use the feature.

---

## 3. Context and Background

`Author` (ADR-0004) and `AuthorTopicSignal` (ADR-0007) already exist and are populated by ingestion. `AuthorDailyCount` (ADR-0087) already precomputes engagement/reach aggregates. What's missing is a scoring and ranking layer that turns those raw signals into a defensible, explainable measure of influence — one that can be filtered by topic/platform/watchlist and sorted, so a Social-Selling-Strategist or Topic-Center-Analyst can find the right authors instead of manually reviewing post feeds. Because a black-box score is not defensible, the design deliberately exposes four bounded, weighted component scores plus a dedicated explanation endpoint, and computes everything from the platform's own ingested data rather than a third-party ranking service (preserving data sovereignty).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable discovery of high-impact authors by topic/platform/watchlist | `GET /v1/influencers` returns ranked, filtered results |
| G2 | Make scoring transparent and defensible | Every `influence_score` is explainable via four component scores and a published weight formula |
| G3 | Protect data sovereignty | Scores are computed entirely from ingested platform data inside the tenant-scoped system, no third-party ranking API |
| G4 | Prepare for future AI/RAG-driven discovery | Scored author records form a clean baseline for `RAGConnector.search()` extensions |
| G5 | Keep scoring cost bounded | Computation happens at most once per day via a scheduled worker, not per-request |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `Author` scoring columns and computation

- **Description:** Adds four bounded, numeric scores to each `Author` record, computed from existing signal tables.
- **Triggers:** The daily `AuthorScoringRefresh` worker run.
- **Inputs:** `Author` profile data, `AuthorTopicSignal` rows, `AuthorDailyCount` (ADR-0087) precomputed engagement/reach aggregates.
- **Processing:**
  - `reach_score` — derived from follower count, impression reach, or network size.
  - `engagement_score` — derived from average likes, comments, shares, retweets per post.
  - `authenticity_score` — derived from posting cadence, audience-to-engagement ratio, and bot-like behavior heuristics.
  - `influence_score` — weighted composite: `0.25*reach + 0.35*engagement + 0.20*authenticity + 0.20*topic_relevance` by default, or the tenant's customized weights if configured (BRU-001).
  - All four scores are capped at 100 and stored as `numeric(5,2)` (BRU-002).
  - The worker uses `AuthorDailyCount` for engagement/reach rather than re-scanning raw posts, keeping the daily run bounded.
- **Outputs:** Updated `reach_score`, `engagement_score`, `authenticity_score`, `influence_score` on each scored `Author` row.
- **Error handling:** An author with insufficient signal data (e.g., newly seen, very few posts) still receives a computed (possibly low/zero) score rather than a null — the worker must handle sparse-data authors gracefully.
- **Edge cases:** A tenant-customized weight set must still respect any configured bounds (e.g., BR-008's ±50% bound) — an out-of-bounds weight override is rejected or clamped, not silently applied.

### 5.2 Feature / Capability: `AuthorScoringRefresh` scheduled worker

- **Description:** Recomputes all four scores for eligible authors on a daily cadence.
- **Triggers:** Scheduled run (at most once per day, per BRU-003 / NFR-006).
- **Inputs:** All `Author` rows with signal data changed or eligible for rescoring since the last run.
- **Processing:** For each eligible author, recompute the four scores per 5.1 and persist the update. Scores must be deterministic for identical inputs (NFR-001) — the same signal data must always produce the same scores.
- **Outputs:** Refreshed scoring columns across the tenant's `Author` table.
- **Error handling:** A failure scoring one author must not abort the whole run; failed authors are logged and retried on the next scheduled run rather than left permanently stale without visibility.
- **Edge cases:** A brand-new author with no prior signal history receives an initial score on the first run after their first observed post, not left unscored indefinitely.

### 5.3 Feature / Capability: `GET /v1/influencers` discovery endpoint

- **Description:** Returns a ranked, filtered list of scored authors.
- **Triggers:** A user opens or filters `InfluencerDiscoveryView`, or calls the endpoint directly.
- **Inputs:** Query parameters `topicId?`, `platformId?`, `watchlistId?`, `minScore?`, `sort? ('influence'|'reach'|'engagement'|'authenticity'|'recentPosts')`, `limit?` (default 50, hard cap 200 — BRU-005).
- **Processing:**
  - `topicId` filters to authors with high relevance to that topic.
  - `platformId` filters to authors active on that platform.
  - `watchlistId` filters to authors whose posts match that watchlist.
  - `minScore` filters to authors with `influence_score >= minScore`.
  - `sort` determines ordering; each sort option must yield a deterministic, consistent ordering (BR-004) — ties are broken consistently (e.g., by `authorId`) so pagination/repeated calls are stable.
  - Results are always scoped to the caller's tenant via RLS (BRU-004).
- **Outputs:** `{ influencers: Array<{ authorId, authorName, platformId, publicUrl?, reachScore, engagementScore, authenticityScore, influenceScore, topTopics: [{topicId, topicName, relevance}], recentPosts }> }`.
- **Error handling:** `limit` values above 200 are clamped to 200 rather than rejected outright (or rejected with a clear validation error — implementation choice), never silently ignored to return unbounded results. An invalid `sort` value returns a validation error.
- **Edge cases:** A filter combination matching zero authors returns an empty `influencers` array, not an error.

### 5.4 Feature / Capability: Score explanation

- **Description:** Returns the weighted breakdown behind a specific author's `influence_score`.
- **Triggers:** A user requests the explanation for an author (e.g., clicking a score bar in `InfluencerCard`), or calls the endpoint directly.
- **Inputs:** `authorId` (path parameter).
- **Processing:** `GET /v1/influencers/:authorId/explain` returns the four component scores and the weights actually used to compute `influence_score` for that author (BRU-006), reflecting any tenant-specific weight overrides in effect at computation time.
- **Outputs:** A breakdown object showing each component score, its weight, and its contribution to the composite `influence_score`.
- **Error handling:** Requesting an explanation for an author outside the caller's tenant, or an author with no computed scores yet, returns not-found rather than a partial/malformed breakdown.
- **Edge cases:** If metric explainability (ADR-0078) is layered on top for plain-language narration, the underlying numeric breakdown from this endpoint remains the authoritative source of truth.

### 5.5 Feature / Capability: Discovery UI and prospecting integration

- **Description:** The frontend surface for browsing, filtering, and acting on discovered influencers.
- **Triggers:** A user opens `InfluencerDiscoveryView`.
- **Inputs:** Filter selections (topic, platform, watchlist, minimum score) and sort choice.
- **Processing:** `InfluencerDiscoveryView` calls `GET /v1/influencers` with the selected filters/sort and renders one `InfluencerCard` per result, showing the four score bars and top topics. "Add to prospecting list" opens the prospecting list selector and persists the author via the prospecting list capability (ADR-0086). "View posts" links to `GET /v1/posts?authorId=...`.
- **Outputs:** A rendered, filterable, sortable list of influencer cards; a saved prospecting-list entry when the add action is used.
- **Error handling:** If the prospecting list capability is unavailable (e.g., ADR-0086 dependency not yet built for a given deployment), the "Add to prospecting list" action is disabled/hidden rather than erroring at click time.
- **Edge cases:** An author with zero top topics (e.g., too new to have topic signal) still renders correctly, showing an empty top-topics section rather than breaking the card.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Social-Selling-Strategist | Builds prospecting lists by scoring/filtering authors |
| Topic-Center-Analyst | Tracks topic authority via influential authors |
| Tenant-Brand-Reputation-Manager | Identifies high-reach authors amplifying/attacking the brand |
| Tenant-Business-Analyst | Exports and correlates author signal data |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.15) | backend engineer | `Author` scoring columns and `GET /v1/influencers` | `Social-Selling-Strategist` can discover and rank relevant authors | `Author` has the four score columns; `AuthorScoringRefresh` updates them daily; `GET /v1/influencers` supports `topicId`/`platformId`/`watchlistId`/`minScore`/`sort`/`limit`; response includes scores, top topics, recent post count; `GET /v1/influencers/:authorId/explain` returns the breakdown |
| US2 (Story 12.16) | Social-Selling-Strategist | an influencer discovery page with filters, score bars, and an "add to prospecting list" action | I can find and save high-value authors | `InfluencerDiscoveryView` with filters for topic/platform/watchlist/score; `InfluencerCard` shows four score bars and top topics; sorting by influence/reach/engagement/authenticity; "Add to prospecting list" opens the list selector; "View posts" links to the post feed for that author |

### 6.3 Workflow Diagrams / Steps

**Daily scoring workflow:**
1. `AuthorScoringRefresh` runs on its daily schedule.
2. For each eligible author, it pulls current `AuthorTopicSignal` and `AuthorDailyCount` data.
3. `reach_score`, `engagement_score`, `authenticity_score` are computed; `influence_score` is derived as the weighted composite.
4. All four scores, capped at 100 and stored as `numeric(5,2)`, are persisted on the `Author` row.

**Discovery workflow:**
1. A user opens `InfluencerDiscoveryView` and selects filters (topic/platform/watchlist/min score) and a sort order.
2. The UI calls `GET /v1/influencers` with those parameters.
3. Results are rendered as `InfluencerCard`s with score bars and top topics.
4. The user can re-sort, adjust filters, "Add to prospecting list," or "View posts" for any author.

**Explainability workflow:**
1. A user clicks into a score (or an explicit "explain" action) on an `InfluencerCard`.
2. The UI calls `GET /v1/influencers/:authorId/explain`.
3. The breakdown (component scores + weights) is displayed, optionally narrated in plain language via ADR-0078 metric explainability.

---

## 7. Data Requirements

### 7.1 Data Inputs

- `Author` profile fields (existing).
- `AuthorTopicSignal` raw topical signals (existing, ADR-0007).
- `AuthorDailyCount` precomputed engagement/reach aggregates (existing, ADR-0087).
- Optional per-tenant score weight overrides.

### 7.2 Data Outputs

- Updated `Author.reach_score` / `engagement_score` / `authenticity_score` / `influence_score`.
- `GET /v1/influencers` result lists.
- `GET /v1/influencers/:authorId/explain` breakdowns.
- `prospecting_list` entries (ADR-0086) created via the "Add to prospecting list" action.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `Author` (existing, extended) | Adds `reach_score numeric(5,2)`, `engagement_score numeric(5,2)`, `authenticity_score numeric(5,2)`, `influence_score numeric(5,2)` | One row per author; referenced by `AuthorTopicSignal`, posts, and prospecting list entries |
| `AuthorTopicSignal` (existing) | Author-topic-level raw signals | Input to scoring; references `Author` and `topics` |
| `AuthorDailyCount` (existing, ADR-0087) | Precomputed daily engagement/reach aggregates | Input to scoring; derived from `SocialPost` |
| `prospecting_list` (existing, ADR-0086) | Saved author references for outreach | Populated by "Add to prospecting list"; references `Author` |
| Tenant score weight overrides (optional, in `tenant_settings`) | Per-tenant weight values for the `influence_score` formula, bounded | Applied during `AuthorScoringRefresh` computation |

### 7.4 Validation Rules

- `influence_score` default formula: `0.25*reach + 0.35*engagement + 0.20*authenticity + 0.20*topic_relevance`, unless the tenant has bounded customized weights (BRU-001).
- All four scores are capped at 100, stored as `numeric(5,2)` (BRU-002).
- Scores are recomputed at most once per day (BRU-003, NFR-006).
- `GET /v1/influencers` always filters to the caller's tenant via RLS (BRU-004).
- `limit` defaults to 50, hard cap 200 (BRU-005).
- The explanation response must include all four component scores and the weights used (BRU-006).
- No private audience data (emails, DMs, contact lists) is collected or stored for scoring (BRU-007, NFR-004).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `influence_score` is a transparent weighted composite of four bounded component scores | `AuthorScoringRefresh` |
| BR2 | Scores are recomputed at most once daily, never on-demand per request | Scoring computation |
| BR3 | `GET /v1/influencers` results are always tenant-scoped via RLS | Discovery endpoint |
| BR4 | Every sort option yields a deterministic, stable ordering | Discovery endpoint |
| BR5 | `limit` is bounded to a hard cap of 200 | Discovery endpoint |
| BR6 | The explanation endpoint must expose all four component scores and their weights | Explain endpoint |
| BR7 | Only public author metadata is stored; no private audience data | Scoring computation |
| BR8 | Tenant weight customization, if enabled, must stay within configured bounds | Scoring computation |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `AuthorScoringRefresh` (scheduled worker) | Internal | Computes and persists the four scores daily | Scheduled job over `Author`/`AuthorTopicSignal`/`AuthorDailyCount` |
| `GET /v1/influencers` | Inbound API | Discovery/ranking of scored authors | REST/JSON |
| `GET /v1/influencers/:authorId/explain` | Inbound API | Score breakdown | REST/JSON |
| `AuthorDailyCount` (ADR-0087) | Read | Engagement/reach input to scoring | Postgres aggregation |
| `AuthorTopicSignal` (ADR-0007) | Read | Topic relevance input to scoring | Postgres |
| `prospecting_list` (ADR-0086) | Write | Persists "Add to prospecting list" action | Postgres, tenant RLS |
| `GET /v1/posts?authorId=...` | Read (existing) | "View posts" navigation target | REST/JSON |
| `POST /v1/explain` (ADR-0078, optional) | Outbound call | Plain-language narration layered on the explain breakdown | REST/JSON |
| `InfluencerDiscoveryView` / `InfluencerCard` (admin UI) | Internal | Filter, browse, and act on discovered influencers | React UI calling the endpoints above |

---

## 10. Non-Functional Considerations

- **Performance:** `GET /v1/influencers` targets p95 under 2 seconds for the default 50-item result set (NFR-003).
- **Reliability:** Scores are deterministic for identical inputs (NFR-001).
- **Security / access control:** Scoring data is isolated by tenant via RLS; cross-tenant leakage is contract-tested (NFR-002).
- **Compliance:** Only public author metadata is stored/exposed — no private audience data (NFR-004); data sources respect platform Terms of Service (NFR-005).
- **Scalability:** Score computation is bounded to once per day; live queries never recompute on demand (NFR-006).
- **Auditability:** Score distribution and refresh duration/success are monitored to catch drift or worker failure early.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| An author has sparse/insufficient signal data during scoring | None (transparent) | A best-effort (possibly low) score is still computed and stored, not left null |
| One author's scoring computation fails mid-run | None (transparent) | The failure is logged; other authors' scores still update; the failed author is retried on the next run |
| `GET /v1/influencers` called with `limit` above 200 | Clamped result or validation error (implementation choice) | Never returns more than 200 results |
| `GET /v1/influencers` called with an invalid `sort` value | Validation error | Request rejected |
| `GET /v1/influencers/:authorId/explain` called for an author outside the tenant or with no scores yet | Not-found | No partial/malformed breakdown returned |
| Filter combination matches zero authors | Empty result set | `influencers: []`, not an error |
| Prospecting-list dependency unavailable | "Add to prospecting list" disabled/hidden | No error thrown at click time |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- `Author` and `AuthorTopicSignal` tables exist and are populated (ADR-0004, ADR-0007).
- `AuthorDailyCount` precomputed aggregates are available (ADR-0087).
- The prospecting list capability exists or will exist before the UI action is enabled (ADR-0086).
- Only public author metadata is stored; private audience data is never collected.

**Dependencies:**
- ADR-0004 (`Author` model) — accepted.
- ADR-0007 (`AuthorTopicSignal`) — accepted.
- ADR-0087 (`AuthorDailyCount`) — accepted.
- ADR-0086 (prospecting list) — required before Story 12.16's "add to list" action is usable.
- Scheduled-refresh infrastructure (`pg_cron` or equivalent) — already in place (Story 4.x, derived-data caching/refresh).
- `RAGConnector.search()` (ADR-0084) — optional, not blocking v1.
- Story 12.15 (backend) and Story 12.16 (frontend), both currently Blocked pending ADR-0108 acceptance.

**Pending decisions:** ADR-0108 is Proposed; open questions below must be resolved before or during Story 12.15/12.16 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `authenticity_score` use an external bot-detection service, or in-house heuristics? | Product Owner | Before Story 12.15 implementation |
| Q2 | How are scores normalized across platforms with different metrics (e.g. X vs. LinkedIn)? | Technical Lead | Before Story 12.15 implementation |
| Q3 | Should tenants be able to customize the weights, or is a fixed default enough? | Product Owner | Before Story 12.15 implementation |
| Q4 | How does the daily refresh handle new or rarely seen authors? | Technical Lead | Before Story 12.15 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| `Author` | A normalized account or person who creates content on a social platform. |
| `AuthorTopicSignal` | Raw, topic-level signals captured for an author. |
| `AuthorDailyCount` | Precomputed daily engagement and reach aggregates. |
| `reach_score` | Bounded score derived from follower count, impression reach, or network size. |
| `engagement_score` | Bounded score derived from average likes/comments/shares/retweets per post. |
| `authenticity_score` | Bounded score derived from posting cadence, audience-to-engagement ratio, bot-like heuristics. |
| `influence_score` | Weighted composite of reach, engagement, authenticity, and topic relevance. |
| Prospecting list | A saved list of authors identified for outreach or partnership follow-up. |

### Reference links

- ADR-0108: `docs/adr/0108-influencer-discovery-and-scoring.md` (Proposed)
- BRD-0108: `docs/project docs/Business-Requirements/BRD-0108-Influencer-Discovery-And-Scoring.md`
- Feature design: `docs/product-research/feature-designs/05-influencer-discovery.md`
- Related ADRs: ADR-0004 (`Author` model), ADR-0007 (`AuthorTopicSignal`), ADR-0087 (`AuthorDailyCount`), ADR-0086 (prospecting list), ADR-0084 (`RAGConnector`)
- Related user stories: Story 12.15 (backend), Story 12.16 (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing sources

- No `docs/product-research/reports/05-influencer-discovery-deep-research.md` deep-research brief was found for this feature.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
