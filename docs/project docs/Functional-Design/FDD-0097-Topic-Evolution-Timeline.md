# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0097 Topic Evolution Timeline — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0097-topic-evolution-timeline.md, ../Business-Requirements/BRD-0097-Topic-Evolution-Timeline.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0097-topic-evolution-timeline.md and the business requirements in BRD-0097-Topic-Evolution-Timeline.md into functional design for **Topic Evolution Timeline**.
Topic conversations are not static: they grow, fade, shift in sentiment, and attract or lose influential authors over time. Today, analysts and brand managers lack a longitudinal view that connects these signals into a single, explorable timeline. The Topic Evolution Timeline addresses this by providing a dedicated, time-series analytics view for any selected topic.

The proposed solution is a tenant-scoped `GET /v1/topics/evolution` capability backed by existing precomputed analytics views (`TopicDailyCount`, `SentimentDailyCount`, `AuthorTopicSignal`, and `post_topics`) plus a corresponding user interface. Users select a topic, date range, and grain (day, week, or month), and the system returns a series of points that include volume, sentiment distribution, unique authors, top authors, top keywords, and a trend direction. A optional `compareToPrevious` overlay lets users contrast the current period with the immediately preceding one.

Expected business value: faster trend validation, stronger strategic insight into what drives a conversation, earlier warning of reputation shifts, and richer material for research and reporting. v1 deliberately excludes semantic-drift detection, which is planned for a future v2 once the RAG/vector layer is in place.

---

### 2.2 Scope
**In scope:**
- A single-topic, time-series analytics endpoint (`GET /v1/topics/evolution`) for authorized tenant users.
- Input parameters: `topicId`, `start`, `end`, and `granularity` (`day`, `week`, `month`; default `day`).
- Output per time bucket: `mentionCount`, `uniqueAuthors`, sentiment distribution, `topAuthors`, `topKeywords`, and `trend`.
- On-the-fly aggregation of `day` rows into `week` and `month` buckets.
- A `compareToPrevious` period overlay.
- Trend detection (`rising` / `stable` / `falling`) computed from the 7-day slope of `mentionCount`.
- UI components: `TopicEvolutionTimeline` multi-series chart, `TrendAnnotation`, `AuthorSparkline`, `KeywordHeatmap`, date-range and granularity selectors.
- Tenant scoping and read-only access to data.
- v1 foundation that can later be extended with semantic-drift markers.

**Out of scope:**
- Semantic-drift detection and plain-language drift explanations (deferred to v2 / ADR-0116).
- Hour-level or real-time granularity.
- Precomputed weekly or monthly aggregate tables (summing daily rows is sufficient for v1).
- Ad-hoc computation from raw `social_posts` for every request.
- Topic merge, rename, and rebase handling for historical `TopicDailyCount` rows.
- `watchlistId`-driven topic derivation as a primary input (an open question for v2).
- RAG-powered question answering over historical topics.

## 3. Context and Background
See ADR Context.
Topic conversations are not static: they grow, fade, shift in sentiment, and attract or lose influential authors over time. Today, analysts and brand managers lack a longitudinal view that connects these signals into a single, explorable timeline. The Topic Evolution Timeline addresses this by providing a dedicated, time-series analytics view for any selected topic.

The proposed solution is a tenant-scoped `GET /v1/topics/evolution` capability backed by existing precomputed analytics views (`TopicDailyCount`, `SentimentDailyCount`, `AuthorTopicSignal`, and `post_topics`) plus a corresponding user interface. Users select a topic, date range, and grain (day, week, or month), and the system returns a series of points that include volume, sentiment distribution, unique authors, top authors, top keywords, and a trend direction. A optional `compareToPrevious` overlay lets users contrast the current period with the immediately preceding one.

Expected business value: faster trend validation, stronger strategic insight into what drives a conversation, earlier warning of reputation shifts, and richer material for research and reporting. v1 deliberately excludes semantic-drift detection, which is planned for a future v2 once the RAG/vector layer is in place.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable longitudinal topic analysis | Analysts can compare a topic's volume, sentiment, and author mix across arbitrary date ranges with day/week/month granularity |
| 2 | Improve speed of strategic insight | Users identify rising or falling topics and their drivers without manually scanning posts |
| 3 | Strengthen crisis and reputation early warning | Sentiment or author spikes are visible as trend annotations (`rising` / `falling` / `stable`) within one business day |
| 4 | Support thought leadership and competitive reporting | Business users can export or present timeline data for external reports |
| 5 | Reuse existing precomputed analytics infrastructure | The feature does not require scanning raw post tables for every request |

---

**Positive consequences (from ADR):**
1. **Longitudinal analysis:** users can see how a conversation developed over days or weeks.
2. **Reuses precomputed views:** the endpoint is fast and does not scan raw posts.
3. **Foundation for RAG:** the same point-in-time slices can be used by RAG for question answering about historical topics.
4. **Topic stability:** the endpoint requires `topic_id` stability over the requested period. Topic merges and renames are handled by a separate process.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Topic-Center-Analyst (primary) | Investigates topic volume, sentiment, and author evolution | High | Interactive timeline with multi-series chart, author and keyword drill-downs, trend annotations |
| Tenant-Brand-Reputation-Manager (primary) | Monitors reputation-related topics for sudden shifts | High | Early warning when a topic spikes or its sentiment/participant mix changes |
| Tenant-Business-Analyst (secondary) | Uses platform data for internal reports and presentations | Medium | Exportable timeline data and stable time buckets |
| Tenant-Reader (secondary) | Consumes simplified summaries | Low | Clear, non-technical explanation of trend and key takeaways |
| Backend Engineering | Builds the endpoint and aggregation logic | High | Stable contracts, well-defined data sources, and acceptance tests |
| UI Engineering | Builds the analytics components | Medium | Component-level acceptance criteria and predictable API payloads |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 11.5 | epic-11-adr-0095-to-0100.md | As backend engineer, I want `GET /v1/topics/evolution` to return time-series data for a topic's volume, sentiment, top authors, and keywords, so that `Topic-... | Endpoint accepts `topicId`, `start`, `end`, and `granularity` (`day`, `week`, `month`).; Data sources: `TopicDailyCount`, `SentimentDailyCount`, `AuthorTopic... |
| Story 11.6 | epic-11-adr-0095-to-0100.md | As `Topic-Center-Analyst`, I want a topic evolution timeline with volume, sentiment, author, and keyword charts, so that I can understand how a topic is chan... | `TopicEvolutionTimeline` component with a multi-series chart.; `TrendAnnotation` marks `rising`/`falling`/`stable` periods.; `AuthorSparkline` and `KeywordHe... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `TopicDailyCount` | Precomputed daily volume and unique-author counts per topic | ADR-0087 precomputed analytics views | Core Data / Analytics | Tenant-scoped aggregate |
| `SentimentDailyCount` | Precomputed daily sentiment distribution per topic or watchlist | ADR-0087 precomputed analytics views | Core Data / Analytics | Tenant-scoped aggregate |
| `AuthorTopicSignal` | Author-topic strength and participation counts used for `topAuthors` | Author-topic signal pipeline | Core Data / Analytics | Tenant-scoped; public metadata only |
| `post_topics` | Keyword-to-post/topic mapping used for `topKeywords` | ADR-0044 topic clustering | Core Data / Analytics | Tenant-scoped aggregate |
| `topics` | Topic metadata including `topicId` and `topicName` | Topic management | Core Data / Analytics | Tenant-scoped |
| `social_posts` (v2 only) | Raw post content for semantic-drift analysis | Ingestion pipeline | Core Data / Analytics | Tenant-scoped; not used in v1 for timeline query |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- `ADR-0087` (preconfigured analytics views) is accepted and provides `TopicDailyCount`, `AuthorDailyCount`, and `SentimentDailyCount`.
- `ADR-0044` (`post_topics` / topic clustering) supplies `topKeywords`.
- Topic identifiers are stable over the requested period; merges/renames are handled by a separate future process.
- Tenant and role-based access controls are already enforced via existing RLS and Entra identity resolution.
- Users authorized to view a topic have permission to see its public author metadata.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Timeline response time under 2 seconds for 90-day day-granularity queries for typical tenants | Performance | Must | Verified via contract and load tests |
| NFR-002 | All timeline endpoints enforce tenant-scoped authorization | Security | Must | Cross-tenant access attempts are rejected with 403 |
| NFR-003 | The endpoint remains available when raw-post volume grows | Scalability | Should | Query volume is served from precomputed views |
| NFR-004 | Chart components meet WCAG 2.1 AA for screen-reader and keyboard access | Accessibility | Should | Screen-reader table fallback and keyboard-friendly date controls |
| NFR-005 | The timeline data is read-only and cannot mutate source tables | Reliability / Data integrity | Must | No write operations are authorized from the timeline service |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
1. **Longitudinal analysis:** users can see how a conversation developed over days or weeks.
2. **Reuses precomputed views:** the endpoint is fast and does not scan raw posts.
3. **Foundation for RAG:** the same point-in-time slices can be used by RAG for question answering about historical topics.
4. **Topic stability:** the endpoint requires `topic_id` stability over the requested period. Topic merges and renames are handled by a separate process.

---

## 12. Assumptions and Dependencies
- `ADR-0087` (preconfigured analytics views) is accepted and provides `TopicDailyCount`, `AuthorDailyCount`, and `SentimentDailyCount`.
- `ADR-0044` (`post_topics` / topic clustering) supplies `topKeywords`.
- Topic identifiers are stable over the requested period; merges/renames are handled by a separate future process.
- Tenant and role-based access controls are already enforced via existing RLS and Entra identity resolution.
- Users authorized to view a topic have permission to see its public author metadata.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Long time windows or large tenants cause slow response times | Medium | High | Use precomputed `TopicDailyCount` / `SentimentDailyCount`; avoid raw-post scans | Engineering Lead |
| R-002 | Topic merges/renames break historical continuity | Medium | High | Handle merges/renames in a separate future process; assume stable `topic_id` for v1 | Product Owner |
| R-003 | Users misinterpret short-term spikes as sustained trends | Medium | Medium | Use 7-day slope and `stable` threshold; provide clear labels and comparison periods | UX Lead |
| R-004 | Scope creep into semantic-drift / RAG features delays v1 | Medium | High | Defer semantic drift and RAG to v2; keep v1 to explicit IDs and counts | Product Owner |
| R-005 | `week` and `month` on-the-fly aggregation is too slow at scale | Low | Medium | Monitor query latency; precompute weekly/monthly tables only if needed later | Engineering Lead |

---

## 14. Appendix
- ADR: `../../adr/0097-topic-evolution-timeline.md`
- BRD: `../Business-Requirements/BRD-0097-Topic-Evolution-Timeline.md`
- Feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md``
- Deep research: `docs/product-research/reports/topic-evolution-timeline-deep-research.md``
- User stories: see extracted stories above