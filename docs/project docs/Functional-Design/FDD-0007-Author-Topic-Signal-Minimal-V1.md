# Business Requirements Document (BRD) — Author/Topic Signal Minimal v1

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Author/Topic Signal Minimal v1 |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0007-author-topic-signal-minimal-v1.md, ../Business-Requirements/BRD-0007-Author-Topic-Signal-Minimal-V1.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0007-author-topic-signal-minimal-v1.md and the business requirements in BRD-0007-Author-Topic-Signal-Minimal-V1.md into functional design for **Author Topic Signal Minimal V1**.
The platform needs to answer the question, *"Who is writing about topic X?"* in a way that downstream consumers can rank and reason about without being locked into a single, prematurely chosen expertise formula. Today, every `SocialPost` records an author, but there is no tenant-scoped, aggregated view of an author's relationship to a topic over time.

This BRD authorizes a minimal v1 of `AuthorTopicSignal`: a periodically refreshed materialized view that stores only raw signals per author/topic pair — mention count, first and last mention timestamps, active-month count, average engagement, and a sentiment breakdown. A single API endpoint, `GET /topics/:topic/authors`, returns these authors sorted by either `activeMonths` or `mentionCount`. No composite expertise score is stored or returned.

The expected outcome is that future subsystems, UI screens, and report builders receive consistent, transparent, reusable raw ingredients for expert-finding and influencer discovery, while the core subsystem avoids committing to an unvalidated scoring heuristic at this early stage.

---

### 2.2 Scope
**In scope:**
- A tenant-scoped `AuthorTopicSignal` materialized view that aggregates per author/topic from ingested `SocialPost` data.
- Raw signals only: `mentionCount`, `firstMentionAt`, `lastMentionAt`, `activeMonthsCount`, `avgEngagement`, and `sentimentBreakdown`.
- The `GET /topics/:topic/authors` endpoint with `sortBy=activeMonths|mentionCount`.
- Periodic, scheduled refresh of the materialized view (default: hourly via `pg_cron`; cadence decided during implementation per Story 4.4).
- RLS-protected, tenant-isolated access to the view and endpoint.

**Out of scope:**
- A computed `expertiseScore`, `influenceScore`, or any other single composite ranking metric stored in `AuthorTopicSignal`.
- Live, on-request aggregation against the full `SocialPost` table.
- UI or charting for expert/influencer discovery in this iteration.
- Topic-time-series aggregation (`TopicDailyCount`) or trend charting.
- ML-based scoring, decayed weights, or engagement-weighted ranking in the core data model.

## 3. Context and Background
The system needs to support an "expert finder" query — find an author knowledgeable about topic X — exposed via `GET /topics/:topic/authors?sortBy=activeMonths|mentionCount` (§6). There are many plausible ways to rank expertise (recency-weighted, engagement-weighted, decayed, ML-scored), and this is the first version of this subsystem.
The platform needs to answer the question, *"Who is writing about topic X?"* in a way that downstream consumers can rank and reason about without being locked into a single, prematurely chosen expertise formula. Today, every `SocialPost` records an author, but there is no tenant-scoped, aggregated view of an author's relationship to a topic over time.

This BRD authorizes a minimal v1 of `AuthorTopicSignal`: a periodically refreshed materialized view that stores only raw signals per author/topic pair — mention count, first and last mention timestamps, active-month count, average engagement, and a sentiment breakdown. A single API endpoint, `GET /topics/:topic/authors`, returns these authors sorted by either `activeMonths` or `mentionCount`. No composite expertise score is stored or returned.

The expected outcome is that future subsystems, UI screens, and report builders receive consistent, transparent, reusable raw ingredients for expert-finding and influencer discovery, while the core subsystem avoids committing to an unvalidated scoring heuristic at this early stage.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable topic-level author discovery without premature scoring lock-in | `GET /topics/:topic/authors` ships with `sortBy=activeMonths\|mentionCount` and no stored composite score |
| 2 | Provide transparent, reusable raw signals to downstream consumers | Raw fields (`mentionCount`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown`) are documented, queryable, and tenant-scoped |
| 3 | Support eventual-consistency refresh without live recomputation | `AuthorTopicSignal` refreshes periodically and serves reads without recomputing on every request |
| 4 | Lay the foundation for future influencer/expert-ranking features | Future features can consume `AuthorTopicSignal` and apply their own weighting without core schema changes |

---

**Positive consequences (from ADR):**
**Positive**
- Downstream consumers (including future subsystems like Social Selling, which will likely care most about expertise ranking) can apply their own weighting without the core needing to anticipate every ranking strategy up front.
- A raw-signal materialized view is straightforward to refresh periodically and to extend later (e.g., adding a computed score column) without a breaking schema change to `AuthorTopicSignal` itself — new fields are additive.
- Avoids prematurely committing to a scoring formula that would be expensive to change once downstream systems depend on its output ranking.

**Negative**
- API consumers that just want "the best expert" must implement their own composite ranking from `mentionCount`/`activeMonthsCount`/`avgEngagement`/`sentimentBreakdown` rather than calling a single sorted endpoint — more work pushed to every consumer, including the admin UI and future subsystems.
- Because it's a periodically refreshed materialized view rather than a live query, `AuthorTopicSignal` is eventually consistent with the underlying `SocialPost`/`enrichment` data; the refresh cadence isn't specified here and needs to be decided during implementation.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall maintain a tenant-scoped `AuthorTopicSignal` view keyed by `(tenantId, authorId, topic)` | Must | View exists, is `tenant_id`-scoped, and returns one row per author/topic/tenant | Product Owner |
| BR-002 | The view shall expose only raw signals: `mentionCount`, `firstMentionAt`, `lastMentionAt`, `activeMonthsCount`, `avgEngagement`, `sentimentBreakdown` | Must | No `expertiseScore` or equivalent composite field exists; all values are raw aggregations | Product Owner |
| BR-003 | The system shall expose `GET /topics/:topic/authors?sortBy=activeMonths\|mentionCount` | Must | Endpoint accepts `sortBy` parameter and sorts ascending/descending as specified; default sort is documented | Product Owner |
| BR-004 | The view shall be refreshed on a scheduled cadence rather than computed live per request | Must | A refresh job exists and advances the view's last-refreshed timestamp; reads do not trigger full recomputation | Product Owner |
| BR-005 | The system shall enforce tenant isolation on `AuthorTopicSignal` reads | Must | A tenant's caller can only see authors/signals for its own `tenant_id`; contract tests prove no cross-tenant leakage | Product Owner |
| BR-006 | The raw-signal schema shall be additive; new fields can be added without breaking existing API consumers | Should | Adding a future column does not change existing JSON or column set returned to existing clients | Technical Lead |

### 5.1 Architecture Decision
Model `AuthorTopicSignal` as a periodically refreshed materialized view holding only raw signals: `mentionCount`, `firstMentionAt`/`lastMentionAt`, `activeMonthsCount`, `avgEngagement`, and `sentimentBreakdown`. No computed expertise score is stored. The API exposes `sortBy=activeMonths|mentionCount` so ranking logic stays with the API consumer rather than being baked into the data model.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Social Selling Strategist (future) | Consumer of expert-finding signals | High | Raw, composable signals to build prospecting and outreach lists |
| Topic-Center-Analyst (future) | Investigates authors around a topic | High | Sortable author list by activity/volume for research |
| Tenant-Brand-Reputation-Manager (future) | Identifies high-activity voices | Medium | Clear counts and recency to detect amplifiers or detractors |
| API Consumer / Future Subsystem | Machine consumer of `AuthorTopicSignal` | High | Stable raw fields and explicit sorting options |
| Platform Operator | Runs the scheduled refresh | Medium | Observable, reliable refresh cadence |
| Menno (Sole Operator / Sponsor) | Accountable for scope and acceptability | High | Minimal v1 that defers scoring until more evidence exists |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 4.1 | epic-4-derived-data-analytics-and-health.md | As API consumer (e.g., a future Social Selling subsystem), I want `GET /topics/:topic/authors` backed by a periodically refreshed `AuthorTopicSignal` view ex... | `AuthorTopicSignal` contains no `expertiseScore` or equivalent computed field — only raw counts/dates/breakdowns.; `GET /topics/:topic/authors` accepts `sort... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `mentionCount` | Number of posts by the author matching the topic | `SocialPost` aggregation | Data Engineering | Public author/topic activity |
| `firstMentionAt` / `lastMentionAt` | Earliest and latest post timestamps for the author/topic | `SocialPost` aggregation | Data Engineering | Public author/topic activity |
| `activeMonthsCount` | Count of distinct calendar months in which the author mentioned the topic | `SocialPost` aggregation | Data Engineering | Public author/topic activity |
| `avgEngagement` | Average engagement value across the author's posts on the topic | `SocialPost.enrichment` / engagement fields | Data Engineering | Public author/topic activity |
| `sentimentBreakdown` | Distribution of positive / neutral / negative posts for the author/topic | `SocialPost` enrichment / sentiment | Data Engineering | Public author/topic activity |
| `Author` normalized row | Platform-identity anchor for the author | Ingestion pipeline per ADR-0004 | Data Engineering | Public profile metadata |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `AuthorTopicSignal` stores only raw, tenant-scoped, author/topic signals; no computed expertise or influence score is stored. |
| BRU-002 | `GET /topics/:topic/authors` supports exactly two sorting options: `activeMonths` and `mentionCount`. |
| BRU-003 | Author-topic signals are eventually consistent with the underlying post and enrichment data; the refresh cadence is the source of truth for freshness. |
| BRU-004 | Cross-tenant access to any author/topic signal is prohibited by RLS. |
| BRU-005 | Any future scoring or weighting is the responsibility of the consumer, not the core `AuthorTopicSignal` view. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `Author` table normalized per ADR-0004 | Predecessor | Menno | Accepted 2026-07-28; in place |
| D-002 | Derived-data refresh strategy per ADR-0022 / Story 4.4 | Predecessor | Menno | Accepted 2026-07-29; scheduled refresh infrastructure |
| D-003 | Postgres RLS and tenant isolation pattern (ADR-0015, ADR-0032) | Predecessor | Menno | In place |
| D-004 | `SocialPost` enrichment with `publishedAt`, engagement, and sentiment | Predecessor | Menno | In place |

---

- `Author` already exists as a normalized, tenant-scoped entity per ADR-0004.
- `SocialPost` records carry topic linkage and tenant-scoped `publishedAt`, engagement, and sentiment data.
- Downstream consumers (including future subsystems) are willing and able to compose their own ranking from raw signals.
- Hourly refresh latency is acceptable for the first version of the capability.

Model `AuthorTopicSignal` as a periodically refreshed materialized view holding only raw signals: `mentionCount`, `firstMentionAt`/`lastMentionAt`, `activeMonthsCount`, `avgEngagement`, and `sentimentBreakdown`. No computed expertise score is stored. The API exposes `sortBy=activeMonths|mentionCount` so ranking logic stays with the API consumer rather than being baked into the data model.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `GET /topics/:topic/authors` must respond within acceptable latency for pre-aggregated data | Performance | Must | P95 response time under 500 ms for typical tenant topic queries in contract tests |
| NFR-002 | `AuthorTopicSignal` must refresh without blocking reads | Reliability | Should | Read queries continue during refresh; brief staleness is acceptable |
| NFR-003 | The view and endpoint must follow the project's RLS and tenant-isolation patterns | Security | Must | Passes RLS contract tests; no tenant can access another tenant's author-topic signals |
| NFR-004 | The refresh schedule and last-refresh timestamp must be observable | Maintainability | Should | Logs or metrics expose the last successful refresh time and any refresh failures |

---

## 11. Error Handling and Exceptions
**Positive**
- Downstream consumers (including future subsystems like Social Selling, which will likely care most about expertise ranking) can apply their own weighting without the core needing to anticipate every ranking strategy up front.
- A raw-signal materialized view is straightforward to refresh periodically and to extend later (e.g., adding a computed score column) without a breaking schema change to `AuthorTopicSignal` itself — new fields are additive.
- Avoids prematurely committing to a scoring formula that would be expensive to change once downstream systems depend on its output ranking.

**Negative**
- API consumers that just want "the best expert" must implement their own composite ranking from `mentionCount`/`activeMonthsCount`/`avgEngagement`/`sentimentBreakdown` rather than calling a single sorted endpoint — more work pushed to every consumer, including the admin UI and future subsystems.
- Because it's a periodically refreshed materialized view rather than a live query, `AuthorTopicSignal` is eventually consistent with the underlying `SocialPost`/`enrichment` data; the refresh cadence isn't specified here and needs to be decided during implementation.

## 12. Assumptions and Dependencies
- `Author` already exists as a normalized, tenant-scoped entity per ADR-0004.
- `SocialPost` records carry topic linkage and tenant-scoped `publishedAt`, engagement, and sentiment data.
- Downstream consumers (including future subsystems) are willing and able to compose their own ranking from raw signals.
- Hourly refresh latency is acceptable for the first version of the capability.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Consumers that want "the best expert" must implement their own ranking, increasing integration effort | High | Medium | Document the raw fields and sorting clearly; provide examples of how to compose a composite score; plan a future v2 scoring layer only after demand is validated | Product Owner |
| R-002 | Hourly refresh causes stale data that users or downstream systems may misinterpret | Medium | Medium | Expose `lastRefreshedAt` in API responses and docs; make refresh cadence observable and tunable | Platform Operator |
| R-003 | Future scoring features accidentally violate the "raw only" principle | Medium | High | Enforce BRU-001 via code review and contract tests; require a new ADR for any stored computed score | Technical Lead |
| R-004 | Query latency grows as the post table scales, even with materialized view | Low | Medium | Keep refresh periodic; if latency becomes an issue, revisit indexing and partitioning before changing the API contract | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0007-author-topic-signal-minimal-v1.md`
- BRD: `../Business-Requirements/BRD-0007-Author-Topic-Signal-Minimal-V1.md`
- Feature design: `docs/product-research/feature-designs/05-influencer-discovery.md``
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md``
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above