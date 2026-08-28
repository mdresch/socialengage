# Business Requirements Document (BRD) — Topic Evolution Timeline

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Topic Evolution Timeline Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Product Owner / Technical Lead) |
| Status | Draft for review — authorizing ADR is Proposed and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0097 and feature design `25-topic-evolution-timeline` |

---

## 2. Executive Summary

Topic conversations are not static: they grow, fade, shift in sentiment, and attract or lose influential authors over time. Today, analysts and brand managers lack a longitudinal view that connects these signals into a single, explorable timeline. The Topic Evolution Timeline addresses this by providing a dedicated, time-series analytics view for any selected topic.

The proposed solution is a tenant-scoped `GET /v1/topics/evolution` capability backed by existing precomputed analytics views (`TopicDailyCount`, `SentimentDailyCount`, `AuthorTopicSignal`, and `post_topics`) plus a corresponding user interface. Users select a topic, date range, and grain (day, week, or month), and the system returns a series of points that include volume, sentiment distribution, unique authors, top authors, top keywords, and a trend direction. A optional `compareToPrevious` overlay lets users contrast the current period with the immediately preceding one.

Expected business value: faster trend validation, stronger strategic insight into what drives a conversation, earlier warning of reputation shifts, and richer material for research and reporting. v1 deliberately excludes semantic-drift detection, which is planned for a future v2 once the RAG/vector layer is in place.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable longitudinal topic analysis | Analysts can compare a topic's volume, sentiment, and author mix across arbitrary date ranges with day/week/month granularity |
| 2 | Improve speed of strategic insight | Users identify rising or falling topics and their drivers without manually scanning posts |
| 3 | Strengthen crisis and reputation early warning | Sentiment or author spikes are visible as trend annotations (`rising` / `falling` / `stable`) within one business day |
| 4 | Support thought leadership and competitive reporting | Business users can export or present timeline data for external reports |
| 5 | Reuse existing precomputed analytics infrastructure | The feature does not require scanning raw post tables for every request |

---

## 4. Scope

### 4.1 In Scope

- A single-topic, time-series analytics endpoint (`GET /v1/topics/evolution`) for authorized tenant users.
- Input parameters: `topicId`, `start`, `end`, and `granularity` (`day`, `week`, `month`; default `day`).
- Output per time bucket: `mentionCount`, `uniqueAuthors`, sentiment distribution, `topAuthors`, `topKeywords`, and `trend`.
- On-the-fly aggregation of `day` rows into `week` and `month` buckets.
- A `compareToPrevious` period overlay.
- Trend detection (`rising` / `stable` / `falling`) computed from the 7-day slope of `mentionCount`.
- UI components: `TopicEvolutionTimeline` multi-series chart, `TrendAnnotation`, `AuthorSparkline`, `KeywordHeatmap`, date-range and granularity selectors.
- Tenant scoping and read-only access to data.
- v1 foundation that can later be extended with semantic-drift markers.

### 4.2 Out of Scope

- Semantic-drift detection and plain-language drift explanations (deferred to v2 / ADR-0116).
- Hour-level or real-time granularity.
- Precomputed weekly or monthly aggregate tables (summing daily rows is sufficient for v1).
- Ad-hoc computation from raw `social_posts` for every request.
- Topic merge, rename, and rebase handling for historical `TopicDailyCount` rows.
- `watchlistId`-driven topic derivation as a primary input (an open question for v2).
- RAG-powered question answering over historical topics.

### 4.3 Assumptions

- `ADR-0087` (preconfigured analytics views) is accepted and provides `TopicDailyCount`, `AuthorDailyCount`, and `SentimentDailyCount`.
- `ADR-0044` (`post_topics` / topic clustering) supplies `topKeywords`.
- Topic identifiers are stable over the requested period; merges/renames are handled by a separate future process.
- Tenant and role-based access controls are already enforced via existing RLS and Entra identity resolution.
- Users authorized to view a topic have permission to see its public author metadata.

### 4.4 Constraints

- Data must remain read-only; the timeline does not mutate posts, topics, or analytics tables.
- Long time windows must be served from precomputed views to avoid raw-post table scans.
- The feature is multi-tenant by default; no cross-tenant data can be exposed.
- v1 is bounded to explicit topic IDs and keyword counts; vector/semantic drift is explicitly out.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Topic-Center-Analyst (primary) | Investigates topic volume, sentiment, and author evolution | High | Interactive timeline with multi-series chart, author and keyword drill-downs, trend annotations |
| Tenant-Brand-Reputation-Manager (primary) | Monitors reputation-related topics for sudden shifts | High | Early warning when a topic spikes or its sentiment/participant mix changes |
| Tenant-Business-Analyst (secondary) | Uses platform data for internal reports and presentations | Medium | Exportable timeline data and stable time buckets |
| Tenant-Reader (secondary) | Consumes simplified summaries | Low | Clear, non-technical explanation of trend and key takeaways |
| Backend Engineering | Builds the endpoint and aggregation logic | High | Stable contracts, well-defined data sources, and acceptance tests |
| UI Engineering | Builds the analytics components | Medium | Component-level acceptance criteria and predictable API payloads |

---

## 6. Current State (As-Is)

Today the platform captures and enriches social posts, matches them to watchlists, and assigns topics and sentiment. `ADR-0087` introduces precomputed daily aggregate tables, but there is no consolidated, longitudinal view for a single topic. Analysts must infer trends from static snapshots, post lists, or manual exports. This makes it hard to validate whether a topic is genuinely growing, whether a sentiment shift is sustained, or which authors are consistently driving the conversation.

**Pain points:**
- No single screen shows a topic's lifecycle across volume, sentiment, sources, and authors.
- Trend detection is manual and error-prone.
- Comparison between two time periods requires separate queries and offline spreadsheet work.
- Semantic drift is not detectable at all.

---

## 7. Future State (To-Be)

After the initiative is implemented, an authorized tenant user opens a topic, selects an "Evolution" tab or screen, picks a date range and granularity, and sees an interactive timeline. The timeline displays volume, sentiment, unique authors, top authors, and top keywords for each bucket. Rising, stable, or falling trends are automatically annotated. Users can overlay the previous period to compare current and past activity. Future v2 will add semantic-drift warnings and AI-generated drift explanations once the RAG layer is available.

**Expected capabilities:**
- Time-series query for one topic across a configurable range and grain.
- Multi-series chart combining volume, sentiment, and author signals.
- Trend annotations based on a 7-day slope threshold.
- Author and keyword widgets for deeper context.
- Period-over-period comparison.
- Read-only, tenant-scoped access with no raw-post scans.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a topic evolution view for a selected topic and date range | Must | `GET /v1/topics/evolution` accepts `topicId`, `start`, `end`, and `granularity` | Product Owner |
| BR-002 | The view shall return per-bucket mention volume, unique authors, sentiment distribution, top authors, top keywords, and a trend label | Must | Each `point` in the response includes `mentionCount`, `uniqueAuthors`, `sentiment`, `topAuthors`, `topKeywords`, and `trend` | Product Owner |
| BR-003 | The user shall choose `day`, `week`, or `month` granularity, with `day` as the default | Must | Request succeeds for all three values; `day` is used when no value is supplied | Product Owner |
| BR-004 | The system shall compute a `rising` / `stable` / `falling` trend for each bucket | Must | `trend` is derived from the 7-day slope of `mentionCount` with the documented thresholds | Product Owner |
| BR-005 | The user shall be able to overlay the previous comparable period for comparison | Should | `compareToPrevious=true` returns a parallel prior-period series | Product Owner |
| BR-006 | The system shall source timeline data from precomputed analytics views to stay performant | Must | Endpoint uses `TopicDailyCount`, `SentimentDailyCount`, `AuthorTopicSignal`, and `post_topics` | Product Owner |
| BR-007 | The UI shall render an interactive multi-series timeline with trend, author, and keyword widgets | Must | `TopicEvolutionTimeline`, `TrendAnnotation`, `AuthorSparkline`, and `KeywordHeatmap` are present | Product Owner |
| BR-008 | The user shall be able to select the date range and granularity in the UI | Must | `TimeRangeSelector` and granularity controls are available and deep-linkable | Product Owner |
| BR-009 | The system shall enforce tenant data boundaries for all timeline requests | Must | Users cannot request data outside their authorized tenant | Product Owner |
| BR-010 | The system shall support exporting or presenting timeline data for reports (v1 minimum: API response) | Could | API payload is stable and JSON-exportable | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Timeline response time under 2 seconds for 90-day day-granularity queries for typical tenants | Performance | Must | Verified via contract and load tests |
| NFR-002 | All timeline endpoints enforce tenant-scoped authorization | Security | Must | Cross-tenant access attempts are rejected with 403 |
| NFR-003 | The endpoint remains available when raw-post volume grows | Scalability | Should | Query volume is served from precomputed views |
| NFR-004 | Chart components meet WCAG 2.1 AA for screen-reader and keyboard access | Accessibility | Should | Screen-reader table fallback and keyboard-friendly date controls |
| NFR-005 | The timeline data is read-only and cannot mutate source tables | Reliability / Data integrity | Must | No write operations are authorized from the timeline service |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A topic evolution request must include a valid `topicId`, `start` date, and `end` date within the tenant's accessible data. |
| BRU-002 | `granularity` defaults to `day` and must be one of `day`, `week`, or `month`. |
| BRU-003 | `trend` is `rising` if the 7-day slope of `mentionCount` is greater than +5% per day, `falling` if less than -5% per day, and `stable` otherwise. |
| BRU-004 | `week` and `month` buckets are computed on the fly by summing daily rows and are not stored as separate tables in v1. |
| BRU-005 | `topAuthors` must be derived from `AuthorTopicSignal` and include the author identifier, display name, and count for the bucket. |
| BRU-006 | `topKeywords` must be derived from `post_topics` and include the keyword and its count for the bucket. |
| BRU-007 | `compareToPrevious` overlays the immediately preceding period of equal length; partial buckets are not returned for the prior period. |
| BRU-008 | All timeline data is read-only and tenant-scoped; no user can modify analytics tables through the timeline interface. |
| BRU-009 | Public author metadata may be shown; private author or PII fields are excluded. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `TopicDailyCount` | Precomputed daily volume and unique-author counts per topic | ADR-0087 precomputed analytics views | Core Data / Analytics | Tenant-scoped aggregate |
| `SentimentDailyCount` | Precomputed daily sentiment distribution per topic or watchlist | ADR-0087 precomputed analytics views | Core Data / Analytics | Tenant-scoped aggregate |
| `AuthorTopicSignal` | Author-topic strength and participation counts used for `topAuthors` | Author-topic signal pipeline | Core Data / Analytics | Tenant-scoped; public metadata only |
| `post_topics` | Keyword-to-post/topic mapping used for `topKeywords` | ADR-0044 topic clustering | Core Data / Analytics | Tenant-scoped aggregate |
| `topics` | Topic metadata including `topicId` and `topicName` | Topic management | Core Data / Analytics | Tenant-scoped |
| `social_posts` (v2 only) | Raw post content for semantic-drift analysis | Ingestion pipeline | Core Data / Analytics | Tenant-scoped; not used in v1 for timeline query |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Topic volume over time | Track whether a topic is growing, stable, or declining | Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | On-demand |
| Sentiment distribution over time | Identify shifts in how the topic is received | Topic-Center-Analyst, Tenant-Brand-Reputation-Manager | On-demand per bucket |
| Unique authors and top authors | Understand who is driving the conversation | Topic-Center-Analyst | On-demand |
| Top keywords per bucket | Surface language and sub-theme shifts | Topic-Center-Analyst, Tenant-Business-Analyst | On-demand |
| Trend annotations (`rising` / `falling` / `stable`) | Provide at-a-glance early warning | Tenant-Brand-Reputation-Manager | Per bucket |
| Period-over-period comparison | Benchmark current activity against the prior period | Tenant-Business-Analyst | On-demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Long time windows or large tenants cause slow response times | Medium | High | Use precomputed `TopicDailyCount` / `SentimentDailyCount`; avoid raw-post scans | Engineering Lead |
| R-002 | Topic merges/renames break historical continuity | Medium | High | Handle merges/renames in a separate future process; assume stable `topic_id` for v1 | Product Owner |
| R-003 | Users misinterpret short-term spikes as sustained trends | Medium | Medium | Use 7-day slope and `stable` threshold; provide clear labels and comparison periods | UX Lead |
| R-004 | Scope creep into semantic-drift / RAG features delays v1 | Medium | High | Defer semantic drift and RAG to v2; keep v1 to explicit IDs and counts | Product Owner |
| R-005 | `week` and `month` on-the-fly aggregation is too slow at scale | Low | Medium | Monitor query latency; precompute weekly/monthly tables only if needed later | Engineering Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `ADR-0087` — preconfigured analytics views (`TopicDailyCount`, `SentimentDailyCount`, `AuthorDailyCount`) | Internal / Technical | Engineering Lead | Pre-requisite for BRD implementation |
| D-002 | `ADR-0044` — `post_topics` / topic clustering | Internal / Technical | Engineering Lead | Required for `topKeywords` |
| D-003 | `ADR-0083` / `ADR-0084` — RAG metadata and ask | Internal / Technical | Engineering Lead | Future v2 semantic-drift and explanations only |
| D-004 | Feature design `docs/product-research/feature-designs/25-topic-evolution-timeline.md` | Reference | Product Owner | Existing source document |
| D-005 | `Story 11.5` — Topic evolution timeline (backend) | Implementation | Engineering Lead | Ready, depends on ADR-0097 |
| D-006 | `Story 11.6` — Topic evolution timeline UI (frontend) | Implementation | Engineering Lead | Ready, depends on Story 11.5 |
| D-007 | `ADR-0116` — Semantic drift detection (v2) | Internal / Technical | Product Owner | Not required for v1 |

---

## 14. Acceptance Criteria

- `GET /v1/topics/evolution` accepts `topicId`, `start`, `end`, and `granularity` (`day`, `week`, `month`).
- The response includes `points` with `mentionCount`, `uniqueAuthors`, `sentiment`, `topAuthors`, `topKeywords`, and `trend`.
- `trend` is computed from the 7-day slope of `mentionCount` with the documented thresholds.
- `compareToPrevious` overlays the previous period when requested.
- The UI renders a `TopicEvolutionTimeline` multi-series chart, `TrendAnnotation`, `AuthorSparkline`, and `KeywordHeatmap`.
- Users can select date range and granularity in the UI, and deep links include `topicId`, `start`, `end`, and `granularity`.
- All requests are tenant-scoped and do not expose cross-tenant data.
- ADR-0097 remains Proposed; the BRD is treated as a draft for review and may be updated once the ADR is Accepted.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Topic** | A labeled conversation theme derived from post content, typically managed in the topic clustering pipeline. |
| **Topic Evolution Timeline** | A longitudinal analytics view that shows how a topic's volume, sentiment, authors, and keywords change over time. |
| **TopicDailyCount** | Precomputed daily aggregate table holding topic volume and unique-author counts. |
| **SentimentDailyCount** | Precomputed daily aggregate table holding sentiment distribution for a topic or watchlist. |
| **AuthorTopicSignal** | Data that captures how strongly and frequently an author participates in a given topic. |
| **post_topics** | Mapping between posts and the keywords/topics assigned to them. |
| **Granularity** | The time bucket size for the timeline: `day`, `week`, or `month`. |
| **Trend** | A label (`rising`, `stable`, `falling`) derived from the 7-day slope of mention count. |
| **compareToPrevious** | A request flag that overlays the immediately preceding period of equal length. |
| **Semantic Drift** | A v2 concept where the meaning of a topic changes over time, detectable via vector embeddings and RAG. |
| **RAG** | Retrieval-Augmented Generation; the v2 vector/AI layer used for semantic search and explanations. |
| **Watchlist** | A tenant-defined set of queries and connectors that matches social posts. |
| **Tenant** | An isolated customer workspace within the multi-tenant platform. |

---

## 16. Appendices

### Reference Documents

- `docs/adr/0097-topic-evolution-timeline.md` — source ADR for this BRD (Status: Proposed).
- `docs/product-research/feature-designs/25-topic-evolution-timeline.md` — parent feature design.
- `docs/product-research/feature-adr-scoping.md` — ADR chunking and scoping plan.

### Related User Stories

- `docs/user-stories/epic-11-adr-0095-to-0100.md`
  - **Story 11.5** — Topic evolution timeline (backend)
  - **Story 11.6** — Topic evolution timeline UI (frontend)
- `docs/user-stories/epic-13-adr-0109-to-0117.md`
  - **Story 13.11** — Semantic drift detection (backend) (v2 dependency)
  - **Story 13.12** — Semantic drift UI (frontend) (v2 dependency)

### Missing Research

- No `docs/product-research/reports/topic-evolution-timeline-deep-research.md` file was found. Deep-research brief to be added if/when available.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
