# BRD-0108: Influencer Discovery and Scoring

> **Note:** ADR-0108 is currently **Proposed** (2026-08-23). This Business Requirements Document is therefore a draft for review and may change before the ADR is accepted.

---

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0108: Influencer Discovery and Scoring |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0108, feature design, and user stories |

---

## 2. Executive Summary

**What problem are we solving?**
Social-selling strategists, topic-center analysts, and brand-reputation managers need a defensible way to discover authors who are relevant, authoritative, and active around a topic, platform, or watchlist. Without a transparent scoring model, users must rely on manual keyword searches and guesswork, which makes outreach list building, campaign planning, and crisis triage slow and error-prone.

**Who is affected?**
The primary personas are the `Social-Selling-Strategist`, `Topic-Center-Analyst`, and `Tenant-Brand-Reputation-Manager`. The `Tenant-Business-Analyst` is a secondary consumer, primarily through export and correlation use cases.

**What is the proposed solution at a glance?**
Add a transparent, multi-component `Author` scoring model (`reach_score`, `engagement_score`, `authenticity_score`, and `influence_score`), a daily refresh worker to compute scores from existing `Author` and `AuthorTopicSignal` data, and a `GET /v1/influencers` endpoint that discovers, ranks, and filters authors by topic, platform, watchlist, and score. A companion UI (`InfluencerDiscoveryView`) will let users filter, sort, inspect score breakdowns, and add authors to a prospecting list.

**What business value do we expect?**
- Faster, more credible prospecting and partnership planning.
- Clearer crisis context when high-reach authors amplify or attack a brand.
- A foundation for higher seat pricing and expansion into PR / advocacy buyers.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable users to discover high-impact authors by topic, platform, or watchlist | `GET /v1/influencers` returns ranked results filtered by the selected dimension |
| 2 | Make scoring transparent and defensible | Every `influence_score` can be explained by four component scores and a published weight formula |
| 3 | Protect data sovereignty and avoid black-box vendor dependencies | Scores are computed from ingested platform data inside the tenant-scoped system |
| 4 | Prepare for future AI / RAG-driven discovery | Scored author records provide a clean baseline for `RAGConnector.search()` and similar extensions |

---

## 4. Scope

### 4.1 In Scope

- Four new `Author` scoring attributes: `reach_score`, `engagement_score`, `authenticity_score`, and `influence_score`.
- A daily `AuthorScoringRefresh` worker that recomputes scores from `Author`, `AuthorTopicSignal`, and `AuthorDailyCount`.
- `GET /v1/influencers` discovery endpoint with `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit` parameters.
- `GET /v1/influencers/:authorId/explain` endpoint for score breakdown.
- `InfluencerDiscoveryView` UI with filters, score bars, sorting, and an "add to prospecting list" action.
- `InfluencerCard` showing the four score bars, top topics, recent post count, and links to the author’s posts.
- Score weights configurable per-tenant with sensible defaults.
- RLS protection and cross-tenant isolation for all scoring data.

### 4.2 Out of Scope

- Real-time / on-every-request score computation.
- Use of a third-party influencer-ranking API.
- A single opaque popularity score.
- Real-time `AuthorInfluenceChangedEvent` streaming (deferred unless real-time ranking is later needed).
- Bot-detection service integration (open decision; in-house heuristics for v1 unless decided otherwise).

### 4.3 Assumptions

- `Author` and `AuthorTopicSignal` tables exist and are already populated (ADR-0004, ADR-0007).
- `AuthorDailyCount` precomputed aggregates are available (ADR-0087).
- The prospecting list capability exists or will exist before the UI action is enabled (ADR-0086).
- Only **public** author metadata is stored; private audience data (emails, DMs) is never collected.

### 4.4 Constraints

- Scores must be bounded (cap of 100) and stored as `numeric(5,2)`.
- Results list default `limit` is 50, hard-capped at 200.
- Daily refresh frequency is bounded to control compute cost.
- Platform Terms of Service for author metadata must be respected.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Social-Selling-Strategist | Primary end user — builds prospecting lists | High | Score by engagement / authenticity / relevance; export to CSV/CRM |
| Topic-Center-Analyst | Primary end user — tracks topic authority | High | See most influential authors around a topic and track changes over time |
| Tenant-Brand-Reputation-Manager | Primary end user — crisis and reputation monitoring | High | Identify high-reach authors amplifying or attacking the brand; alert on influence spikes |
| Tenant-Business-Analyst | Secondary end user — data correlation | Medium | Export author signal data and correlate with business dimensions |
| Menno | Product Owner / Technical Lead | High | Transparent, defensible, tenant-scoped design with no black-box dependencies |

---

## 6. Current State (As-Is)

**Current process:**
- Authors are normalized in the `Author` table with basic profile fields such as `name`, `url`, and `follower_count`.
- `AuthorTopicSignal` captures raw signals by topic and platform.
- Users can search posts and watchlists, but there is no systematic way to discover or rank authors by impact.
- Outreach and crisis triage rely on manual review of post feeds.

**Pain points:**
- Finding authoritative voices around a topic is time-consuming and subjective.
- There is no standardized way to compare authors across reach, engagement, and authenticity.
- Outreach list building and partnership planning lack defensible ranking.
- Brand crises are harder to triage when any user looks like any other until manually reviewed.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A daily scoring worker augments each `Author` record with `reach_score`, `engagement_score`, `authenticity_score`, and a composite `influence_score`.
2. Users open the `InfluencerDiscoveryView`, select a topic, platform, or watchlist, and optionally set a minimum score.
3. The system returns a ranked list of `InfluencerCard` items showing the four score bars and top topics.
4. Users sort by `influence`, `reach`, `engagement`, `authenticity`, or `recentPosts`.
5. Users click "Add to prospecting list" to save an author for outreach, or "View posts" to inspect the author’s recent content.
6. Power users or analysts call `GET /v1/influencers/:authorId/explain` to see the weighted score breakdown.

**Expected capabilities:**
- Discover authors by topic, platform, watchlist, or minimum composite score.
- Compare authors on transparent, bounded component scores.
- Save authors to shared prospecting lists for outreach / CRM export.
- Explain any score through a dedicated breakdown endpoint.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

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

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Author` scoring columns (`reach_score`, `engagement_score`, `authenticity_score`, `influence_score`) | Computed, bounded scores per author | `Author`, `AuthorTopicSignal`, `AuthorDailyCount` | Engineering | Public metadata / tenant-scoped |
| `AuthorDailyCount` | Precomputed engagement and reach aggregates | Derived from `SocialPost` (ADR-0087) | Engineering | Tenant-scoped derived data |
| `AuthorTopicSignal` | Raw topical signals per author and topic | Ingestion pipeline (ADR-0007) | Engineering | Public metadata / tenant-scoped |
| `prospecting_list` entries | Saved author references for outreach | `InfluencerDiscoveryView` (ADR-0086) | Product | Tenant-scoped business data |
| Score weights per tenant | Optional weight overrides | `tenant_settings` | Product | Tenant configuration |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Influencer discovery usage | Track how often users search, filter, and sort influencers | Product team | Weekly |
| Score distribution | Monitor range and health of `influence_score` values | Data / Engineering | Daily |
| Prospecting list additions | Measure adoption of save-to-list action | Product team | Weekly |
| Daily refresh duration and success | Ensure the scoring worker completes on schedule | Engineering | Daily |
| Cross-tenant leakage checks | Verify RLS isolation of influencer data | Security / Engineering | Per release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Daily scoring worker becomes expensive as author volume grows | Medium | High | Use precomputed `AuthorDailyCount`; bound refresh to once per day; monitor duration and cost | Engineering |
| R-002 | `authenticity_score` relies on heuristics that may miss sophisticated inauthentic behavior | Medium | High | Start with documented in-house heuristics; evaluate an external bot-detection service as a future option | Product / Data |
| R-003 | Cross-platform normalization is hard (e.g. X vs. LinkedIn engagement semantics) | Medium | Medium | Store per-platform baselines in scoring; document normalization assumptions; keep weights configurable | Data |
| R-004 | Platform ToS violations from storing public metadata | Low | High | Limit storage to public profile / public post data; review platform API terms; maintain audit log of sources | Legal / Compliance |
| R-005 | Users distrust a new score if it is not explainable | Medium | High | Provide `explain` endpoint, score bars in UI, and documented weight formula; keep four component scores visible | Product |
| R-006 | ADR remains Proposed; requirements may shift | High | High | Keep this BRD in draft; re-baseline once ADR is accepted | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `Author` model established (ADR-0004) | Internal | Engineering | Accepted |
| D-002 | `AuthorTopicSignal` raw signals (ADR-0007) | Internal | Engineering | Accepted |
| D-003 | `AuthorDailyCount` precomputed aggregates (ADR-0087) | Internal | Engineering | Accepted |
| D-004 | Prospecting list capability (ADR-0086) | Internal | Engineering | Before Story 12.16 |
| D-005 | `pg_cron` or equivalent scheduled refresh infrastructure | Internal | Engineering | In place (Story 4.x derived-data-caching-and-refresh) |
| D-006 | `RAGConnector.search()` (ADR-0084) for future semantic author discovery | Future | Engineering | Optional; not blocking v1 |

---

## 14. Acceptance Criteria

- `Author` table has `reach_score`, `engagement_score`, `authenticity_score`, and `influence_score` columns.
- `AuthorScoringRefresh` worker updates all four scores daily.
- `GET /v1/influencers` supports `topicId`, `platformId`, `watchlistId`, `minScore`, `sort`, and `limit`.
- `GET /v1/influencers` response includes author id, name, platform, public URL, four scores, top topics, and recent post count.
- `GET /v1/influencers/:authorId/explain` returns the score breakdown.
- `InfluencerDiscoveryView` has filters for topic, platform, watchlist, and score.
- `InfluencerCard` shows four score bars and top topics.
- UI supports sorting by `influence`, `reach`, `engagement`, and `authenticity`.
- "Add to prospecting list" opens the list selector and persists the author.
- "View posts" links to the post feed for that author.
- Scoring is deterministic for the same input and does not leak across tenants.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `Author` | A normalized account or person who creates content on a social platform. |
| `AuthorTopicSignal` | Raw, topic-level signals captured for an author. |
| `AuthorDailyCount` | Precomputed daily engagement and reach aggregates. |
| `reach_score` | A bounded score derived from follower count, impression reach, or network size. |
| `engagement_score` | A bounded score derived from average likes, comments, shares, and retweets per post. |
| `authenticity_score` | A bounded score derived from posting cadence, audience-to-engagement ratio, and bot-like behavior heuristics. |
| `influence_score` | A weighted composite of `reach`, `engagement`, `authenticity`, and `topic_relevance`. |
| `prospecting list` | A saved list of authors identified for outreach or partnership follow-up. |
| `InfluencerDiscoveryView` | The primary UI screen for discovering and filtering scored authors. |

---

## 16. Appendices

- ADR-0108 — `docs/adr/0108-influencer-discovery-and-scoring.md`
- Feature design — `docs/product-research/feature-designs/05-influencer-discovery.md`
- Scoping document — `docs/product-research/feature-adr-scoping.md`
- Story 12.15 — `docs/user-stories/epic-12-adr-0101-to-0108.md` (backend)
- Story 12.16 — `docs/user-stories/epic-12-adr-0101-to-0108.md` (frontend)
- Related ADRs: ADR-0004 (`Author` model), ADR-0007 (`AuthorTopicSignal`), ADR-0087 (`AuthorDailyCount`), ADR-0086 (prospecting list), ADR-0084 (`RAGConnector`)

**Missing source:** No `docs/product-research/reports/<feature>-deep-research.md` file was found for influencer discovery.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
