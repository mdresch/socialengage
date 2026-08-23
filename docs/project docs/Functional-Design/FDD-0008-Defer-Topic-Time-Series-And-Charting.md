# Business Requirements Document – Defer Topic Time-Series and Charting

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document – Defer Topic Time-Series and Charting |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0008-defer-topic-time-series-and-charting.md, ../Business-Requirements/BRD-0008-Defer-Topic-Time-Series-And-Charting.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0008-defer-topic-time-series-and-charting.md and the business requirements in BRD-0008-Defer-Topic-Time-Series-And-Charting.md into functional design for **Defer Topic Time Series And Charting**.
Topic-volume-over-time is a natural analytics capability—e.g., "mentions of X per day"—but it belongs to a future insights/dashboard subsystem rather than the current ingestion and data subsystem. Building a `TopicDailyCount` aggregation table, a time-series endpoint, or charting UI now would require us to commit to an aggregation grain, time-zone handling strategy, and dashboard contract before consumers exist.

This Business Requirements Document records the decision to **defer** server-side topic time-series aggregation and all charting to a future subsystem. The underlying data required for that future work—`publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` on `SocialPost`—must remain present and queryable, but no aggregation infrastructure or visualization will be built here.

In 2026-08-17, [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) accepted a narrow, scoped supersession of this ADR's "any charting UI" clause only. It enabled client-side-computed charting inside `social-listening-admin` from data `GET /v1/posts` already returns, with zero new backend aggregation. The "no `TopicDailyCount` table or endpoint" clause remains fully in force.

---

### 2.2 Scope
**In scope:**
- Ensuring `SocialPost` captures and exposes the raw fields a future time-series subsystem needs: `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases`.
- Formalizing the boundary between the data/ingestion subsystem and future insights/dashboard subsystems.
- Documenting that any consumer requiring topic-volume-over-time today must aggregate `GET /v1/posts` client-side (paginated, per the existing API).

**Out of scope:**
- A `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent pre-computed topic time-series store.
- A dedicated endpoint that returns pre-aggregated topic volume over time.
- Any charting or dashboard UI inside this subsystem, except as narrowly superseded by [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) for client-side charting in `social-listening-admin`.
- Server-side pre-computed roll-ups, materialized views, or ad-hoc analytic query endpoints.
- Decisions on aggregation grain (daily, hourly, per-tenant-time-zone) and time-zone handling for topic grouping.

## 3. Context and Background
Topic-volume-over-time is a natural feature (e.g., "mentions of X per day") built on data this subsystem already captures — `enrichment.entities`/`keyPhrases` and `publishedAt` on `SocialPost`. But this spec's scope is explicitly the ingestion/insights *data* subsystem, not dashboards; charting UI and other consumer-facing analytics are called out as belonging to later subsystems (§1, §9).
Topic-volume-over-time is a natural analytics capability—e.g., "mentions of X per day"—but it belongs to a future insights/dashboard subsystem rather than the current ingestion and data subsystem. Building a `TopicDailyCount` aggregation table, a time-series endpoint, or charting UI now would require us to commit to an aggregation grain, time-zone handling strategy, and dashboard contract before consumers exist.

This Business Requirements Document records the decision to **defer** server-side topic time-series aggregation and all charting to a future subsystem. The underlying data required for that future work—`publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` on `SocialPost`—must remain present and queryable, but no aggregation infrastructure or visualization will be built here.

In 2026-08-17, [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) accepted a narrow, scoped supersession of this ADR's "any charting UI" clause only. It enabled client-side-computed charting inside `social-listening-admin` from data `GET /v1/posts` already returns, with zero new backend aggregation. The "no `TopicDailyCount` table or endpoint" clause remains fully in force.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep the data subsystem focused on ingestion, normalization, enrichment, storage, and events/API exposure | No dashboard, visualization, or time-series table is added to this subsystem |
| 2 | Avoid speculative aggregation design before consumer requirements are known | `TopicDailyCount` and similar roll-ups are not designed or built |
| 3 | Preserve future buildability for the insights/dashboard subsystem | `SocialPost` consistently carries `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` and can answer topic-over-time queries from raw data |
| 4 | Minimize wasted engineering work while retaining the option to aggregate later | A future subsystem can compute `TopicDailyCount` directly from existing data without compensating changes |

---

**Positive consequences (from ADR):**
**Positive**
- Keeps this subsystem's scope aligned with its stated purpose (§1): ingestion, normalization, enrichment, storage, and exposing data via events/API — not visualization.
- Avoids committing to a time-series aggregation grain (daily? hourly? per-tenant-timezone?) before a consuming dashboard subsystem's actual requirements are known.
- No wasted work: because `entities`/`keyPhrases`/`publishedAt` are already on `SocialPost`, deferring this doesn't require any compensating design now — the future subsystem can compute `TopicDailyCount` directly from existing data.

**Negative**
- Any consumer wanting topic-volume-over-time today must aggregate `GET /posts` results client-side (paginated, per §6), which is materially more expensive than querying a pre-aggregated table — acceptable for now since no such consumer exists yet in scope.
- The future insights subsystem will need read access to raw post-level enrichment data (via API or a data-layer contract not yet defined) to build `TopicDailyCount`, which is a dependency this ADR doesn't resolve.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The data subsystem shall not build a `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent server-side topic time-series store | Must | No new time-series aggregation table or migration exists in `social-listening-core` | Technical Lead |
| BR-002 | The data subsystem shall not expose an endpoint or event whose purpose is to return pre-aggregated topic volume over time | Must | No `/analytics/topic-daily-count` or equivalent endpoint is added to the public API | Technical Lead |
| BR-003 | `SocialPost` shall continue to capture `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` in a tenant-scoped, queryable form | Must | Every enriched post includes these fields; existing API consumers can filter by `publishedAt` and read `enrichment` | Product Owner |
| BR-004 | Any topic-volume-over-time consumer in scope today must derive its data by aggregating raw `GET /v1/posts` results client-side | Must | Paginated post results are the only data source used for charting; no pre-aggregation is relied upon | Product Owner |
| BR-005 | Charting UI shall not be built inside this subsystem, except as explicitly scoped by a superseding ADR (ADR-0054) | Must | No dashboard/chart components are shipped from `social-listening-core`; `social-listening-admin` client-side charting follows ADR-0054 boundaries | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 5.1 Architecture Decision
Do not build a `TopicDailyCount` aggregation table, endpoint, or any charting UI in this subsystem. Rely on the fact that the underlying data (`enrichment.entities`/`keyPhrases`, `publishedAt`) is already captured on `SocialPost` and is sufficient for a future insights/dashboard subsystem to build this aggregation independently.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Subsystem Architect | Owns scope and data-layer boundaries | High | Avoid scope creep and premature aggregation design |
| Future Insights/Dashboard Team | Will build the consuming subsystem | High | Receive clean, complete raw post data without hidden dependencies |
| Tenant User | Views analytics through a future dashboard | Medium | Eventually see reliable topic-volume-over-time charts |
| Product Owner | Prioritizes v1 scope and roadmap | Medium | Avoid wasted speculative work while keeping future options open |
| Platform Operator | Monitors cost and performance | Low | No additional materialized tables or refresh jobs to operate yet |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 4.2 | epic-4-derived-data-analytics-and-health.md | As subsystem architect scoping this subsystem's boundaries, I want `SocialPost` to consistently capture `enrichment.entities`, `enrichment.keyPhrases`, and `... | Every enriched `SocialPost` has `enrichment.entities`, `enrichment.keyPhrases`, and `publishedAt` populated and queryable.; No `TopicDailyCount` table, mater... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.publishedAt` | UTC publication timestamp of the social post | Connector ingestion + normalization | Data subsystem | Tenant-confidential content metadata |
| `SocialPost.enrichment.entities` | Extracted entities with text, category, and confidence score | AI enrichment (Azure AI Language / OpenAI) | Data subsystem | Derived insight; tenant-scoped |
| `SocialPost.enrichment.keyPhrases` | Key phrases extracted from the post body | AI enrichment | Data subsystem | Derived insight; tenant-scoped |
| `TopicDailyCount` (deferred) | Pre-aggregated count of topic mentions per day | Not built in this subsystem | Future insights subsystem | N/A |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `SocialPost` is the authoritative source for topic, entity, key-phrase, and timestamp data; no pre-aggregated topic count table may be introduced under this ADR. |
| BRU-002 | Time-series aggregation grain (daily, hourly, per-tenant time zone) is a decision for the future consuming subsystem, not this data subsystem. |
| BRU-003 | Any client-side charting permitted today must use only data already returned by `GET /v1/posts` and must not require a new backend aggregation endpoint. |
| BRU-004 | All data access for future analytics remains subject to tenant-scoped RLS and existing API authorization. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialPost` schema and enrichment output remain stable | Internal | Data subsystem | Ongoing |
| D-002 | Design Specification §4.6 "Deferred" and §9 "Explicitly Out of Scope" | Reference | Architecture | Already in force |
| D-003 | [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) – narrow supersession of the "any charting UI" clause | Internal / Governance | Product Owner | Accepted 2026-08-17 |
| D-004 | Future insights/dashboard subsystem to define its data-layer contract | External to this subsystem | Future team | Unresolved; deferred |
| D-005 | [Story 4.2](../user-stories/epic-4-derived-data-analytics-and-health.md#story-42--deferred-topic-time-series-aggregation) | Implementation | Engineering | Ready |

---

- A future insights or dashboard subsystem will eventually require read access to raw, tenant-scoped post-level enrichment data.
- `GET /v1/posts` and the existing `SocialPost` data model provide sufficient information for a future consumer to compute `TopicDailyCount` without this subsystem adding new storage.
- No subsystem consumer currently in scope requires topic-volume-over-time.

Do not build a `TopicDailyCount` aggregation table, endpoint, or any charting UI in this subsystem. Rely on the fact that the underlying data (`enrichment.entities`/`keyPhrases`, `publishedAt`) is already captured on `SocialPost` and is sufficient for a future insights/dashboard subsystem to build this aggregation independently.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The raw `SocialPost` data model must support future topic time-series computation without migration | Maintainability | Must | A query grouping by day and topic/key-phrase can reconstruct what `TopicDailyCount` would contain, verified by a contract test |
| NFR-002 | No new operational burden (refresh jobs, materialized views, extra storage) is introduced for deferred aggregation | Reliability / Cost | Must | No `pg_cron` job, continuous aggregate, or background refresh process is created for topic time-series |
| NFR-003 | Future consumers must read raw data through existing tenant-scoped, RLS-respecting contracts | Security | Must | Any future data-layer contract does not bypass `social-listening-core` RLS or direct database access rules |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Keeps this subsystem's scope aligned with its stated purpose (§1): ingestion, normalization, enrichment, storage, and exposing data via events/API — not visualization.
- Avoids committing to a time-series aggregation grain (daily? hourly? per-tenant-timezone?) before a consuming dashboard subsystem's actual requirements are known.
- No wasted work: because `entities`/`keyPhrases`/`publishedAt` are already on `SocialPost`, deferring this doesn't require any compensating design now — the future subsystem can compute `TopicDailyCount` directly from existing data.

**Negative**
- Any consumer wanting topic-volume-over-time today must aggregate `GET /posts` results client-side (paginated, per §6), which is materially more expensive than querying a pre-aggregated table — acceptable for now since no such consumer exists yet in scope.
- The future insights subsystem will need read access to raw post-level enrichment data (via API or a data-layer contract not yet defined) to build `TopicDailyCount`, which is a dependency this ADR doesn't resolve.

## 12. Assumptions and Dependencies
- A future insights or dashboard subsystem will eventually require read access to raw, tenant-scoped post-level enrichment data.
- `GET /v1/posts` and the existing `SocialPost` data model provide sufficient information for a future consumer to compute `TopicDailyCount` without this subsystem adding new storage.
- No subsystem consumer currently in scope requires topic-volume-over-time.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A future consumer is forced to perform expensive client-side aggregation over paginated `GET /v1/posts` results | High (if consumer appears before v2) | Medium | Accept for now; document that pre-aggregation is deferred and can be added once consumer requirements and grain are known | Product Owner |
| R-002 | The data-layer contract between this subsystem and a future insights subsystem is not yet defined | Medium | Medium | Defer the contract to the future ADR/story that creates the insights subsystem; ensure raw data remains queryable through existing RLS-scoped API | Technical Lead |
| R-003 | Stakeholders may request server-side pre-aggregation before requirements justify it | Medium | Low | Reference this BRD and ADR-0008/ADR-0054 boundaries during roadmap planning; require a new ADR to lift the deferral | Product Owner |
| R-004 | Aggregation grain and time-zone assumptions made now could be wrong for future dashboards | Low (avoided by not building) | Low | Avoid building the table until grain and time-zone requirements are explicit | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0008-defer-topic-time-series-and-charting.md`
- BRD: `../Business-Requirements/BRD-0008-Defer-Topic-Time-Series-And-Charting.md`
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Deep research: `docs/product-research/reports/0008-defer-topic-time-series-and-charting-deep-research.md``
- User stories: see extracted stories above