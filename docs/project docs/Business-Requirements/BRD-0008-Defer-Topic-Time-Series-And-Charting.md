# Business Requirements Document – Defer Topic Time-Series and Charting

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage Social Listening / Insights – Defer Topic Time-Series and Charting |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent, AI Business & Requirements Analyst |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-19 | BRD Writer Agent | Initial BRD derived from ADR-0008 and related feature designs |

---

## 2. Executive Summary

Topic-volume-over-time is a natural analytics capability—e.g., "mentions of X per day"—but it belongs to a future insights/dashboard subsystem rather than the current ingestion and data subsystem. Building a `TopicDailyCount` aggregation table, a time-series endpoint, or charting UI now would require us to commit to an aggregation grain, time-zone handling strategy, and dashboard contract before consumers exist.

This Business Requirements Document records the decision to **defer** server-side topic time-series aggregation and all charting to a future subsystem. The underlying data required for that future work—`publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` on `SocialPost`—must remain present and queryable, but no aggregation infrastructure or visualization will be built here.

In 2026-08-17, [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) accepted a narrow, scoped supersession of this ADR's "any charting UI" clause only. It enabled client-side-computed charting inside `social-listening-admin` from data `GET /v1/posts` already returns, with zero new backend aggregation. The "no `TopicDailyCount` table or endpoint" clause remains fully in force.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep the data subsystem focused on ingestion, normalization, enrichment, storage, and events/API exposure | No dashboard, visualization, or time-series table is added to this subsystem |
| 2 | Avoid speculative aggregation design before consumer requirements are known | `TopicDailyCount` and similar roll-ups are not designed or built |
| 3 | Preserve future buildability for the insights/dashboard subsystem | `SocialPost` consistently carries `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` and can answer topic-over-time queries from raw data |
| 4 | Minimize wasted engineering work while retaining the option to aggregate later | A future subsystem can compute `TopicDailyCount` directly from existing data without compensating changes |

---

## 4. Scope

### 4.1 In Scope

- Ensuring `SocialPost` captures and exposes the raw fields a future time-series subsystem needs: `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases`.
- Formalizing the boundary between the data/ingestion subsystem and future insights/dashboard subsystems.
- Documenting that any consumer requiring topic-volume-over-time today must aggregate `GET /v1/posts` client-side (paginated, per the existing API).

### 4.2 Out of Scope

- A `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent pre-computed topic time-series store.
- A dedicated endpoint that returns pre-aggregated topic volume over time.
- Any charting or dashboard UI inside this subsystem, except as narrowly superseded by [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) for client-side charting in `social-listening-admin`.
- Server-side pre-computed roll-ups, materialized views, or ad-hoc analytic query endpoints.
- Decisions on aggregation grain (daily, hourly, per-tenant-time-zone) and time-zone handling for topic grouping.

### 4.3 Assumptions

- A future insights or dashboard subsystem will eventually require read access to raw, tenant-scoped post-level enrichment data.
- `GET /v1/posts` and the existing `SocialPost` data model provide sufficient information for a future consumer to compute `TopicDailyCount` without this subsystem adding new storage.
- No subsystem consumer currently in scope requires topic-volume-over-time.

### 4.4 Constraints

- The subsystem's charter is ingestion, normalization, enrichment, storage, and exposing data via events/API, not visualization or analytics presentation.
- Multi-tenant, RLS-protected data access must not be bypassed by any future consumer.
- No new backend aggregation may be added in Epic 8 or related client-side dashboard work, per the ADR-0054 boundary.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Subsystem Architect | Owns scope and data-layer boundaries | High | Avoid scope creep and premature aggregation design |
| Future Insights/Dashboard Team | Will build the consuming subsystem | High | Receive clean, complete raw post data without hidden dependencies |
| Tenant User | Views analytics through a future dashboard | Medium | Eventually see reliable topic-volume-over-time charts |
| Product Owner | Prioritizes v1 scope and roadmap | Medium | Avoid wasted speculative work while keeping future options open |
| Platform Operator | Monitors cost and performance | Low | No additional materialized tables or refresh jobs to operate yet |

---

## 6. Current State (As-Is)

The Social Listening / Insights data subsystem already captures the core post record that makes topic-volume-over-time possible. `SocialPost` stores `publishedAt` and `enrichment` JSONB containing `entities` and `keyPhrases`.

**Pain points:**
- A natural downstream desire exists to show "mentions of X per day," but no consumer subsystem currently exists to consume it.
- Building the aggregation now would force premature decisions on grain, time zones, and schema that may not match future dashboard requirements.
- Keeping charting in the data subsystem would blur its charter and risk scope creep.

---

## 7. Future State (To-Be)

After this decision is in force:

- The data subsystem continues to own raw post data and enrichment, but does not own aggregation or visualization.
- A future insights/dashboard subsystem can build `TopicDailyCount` and time-series charts independently, using the raw `SocialPost` data already exposed.
- `social-listening-admin` may render client-side-computed charting (per ADR-0054, Epic 8) using `GET /v1/posts` results, without introducing new backend aggregation tables or endpoints.
- Server-side pre-aggregation and a `TopicDailyCount`-shaped store remain explicitly deferred until a later phase with clear consumer requirements.

**Expected capabilities:**
- Raw `SocialPost` data remains queryable by tenant, date, watchlist, and provider.
- Future consumers can derive `TopicDailyCount` without changes to this subsystem's storage or API.
- The boundary between data/ingestion and presentation/insights is clearly documented and contract-ready.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The data subsystem shall not build a `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent server-side topic time-series store | Must | No new time-series aggregation table or migration exists in `social-listening-core` | Technical Lead |
| BR-002 | The data subsystem shall not expose an endpoint or event whose purpose is to return pre-aggregated topic volume over time | Must | No `/analytics/topic-daily-count` or equivalent endpoint is added to the public API | Technical Lead |
| BR-003 | `SocialPost` shall continue to capture `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` in a tenant-scoped, queryable form | Must | Every enriched post includes these fields; existing API consumers can filter by `publishedAt` and read `enrichment` | Product Owner |
| BR-004 | Any topic-volume-over-time consumer in scope today must derive its data by aggregating raw `GET /v1/posts` results client-side | Must | Paginated post results are the only data source used for charting; no pre-aggregation is relied upon | Product Owner |
| BR-005 | Charting UI shall not be built inside this subsystem, except as explicitly scoped by a superseding ADR (ADR-0054) | Must | No dashboard/chart components are shipped from `social-listening-core`; `social-listening-admin` client-side charting follows ADR-0054 boundaries | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The raw `SocialPost` data model must support future topic time-series computation without migration | Maintainability | Must | A query grouping by day and topic/key-phrase can reconstruct what `TopicDailyCount` would contain, verified by a contract test |
| NFR-002 | No new operational burden (refresh jobs, materialized views, extra storage) is introduced for deferred aggregation | Reliability / Cost | Must | No `pg_cron` job, continuous aggregate, or background refresh process is created for topic time-series |
| NFR-003 | Future consumers must read raw data through existing tenant-scoped, RLS-respecting contracts | Security | Must | Any future data-layer contract does not bypass `social-listening-core` RLS or direct database access rules |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `SocialPost` is the authoritative source for topic, entity, key-phrase, and timestamp data; no pre-aggregated topic count table may be introduced under this ADR. |
| BRU-002 | Time-series aggregation grain (daily, hourly, per-tenant time zone) is a decision for the future consuming subsystem, not this data subsystem. |
| BRU-003 | Any client-side charting permitted today must use only data already returned by `GET /v1/posts` and must not require a new backend aggregation endpoint. |
| BRU-004 | All data access for future analytics remains subject to tenant-scoped RLS and existing API authorization. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `SocialPost.publishedAt` | UTC publication timestamp of the social post | Connector ingestion + normalization | Data subsystem | Tenant-confidential content metadata |
| `SocialPost.enrichment.entities` | Extracted entities with text, category, and confidence score | AI enrichment (Azure AI Language / OpenAI) | Data subsystem | Derived insight; tenant-scoped |
| `SocialPost.enrichment.keyPhrases` | Key phrases extracted from the post body | AI enrichment | Data subsystem | Derived insight; tenant-scoped |
| `TopicDailyCount` (deferred) | Pre-aggregated count of topic mentions per day | Not built in this subsystem | Future insights subsystem | N/A |

---

## 11. Reporting and Analytics

No reporting or analytics UI is delivered by this initiative. The business outcome is the explicit absence of pre-computed time-series reporting in the data subsystem.

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Enrichment completeness on `SocialPost` | Verify that future time-series consumers will have the raw data they need | Engineering / QA | Per contract test run |
| Absence of `TopicDailyCount` / aggregation artifacts | Confirm the deferral is honored in `social-listening-core` | Architecture / QA | Per contract test run |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A future consumer is forced to perform expensive client-side aggregation over paginated `GET /v1/posts` results | High (if consumer appears before v2) | Medium | Accept for now; document that pre-aggregation is deferred and can be added once consumer requirements and grain are known | Product Owner |
| R-002 | The data-layer contract between this subsystem and a future insights subsystem is not yet defined | Medium | Medium | Defer the contract to the future ADR/story that creates the insights subsystem; ensure raw data remains queryable through existing RLS-scoped API | Technical Lead |
| R-003 | Stakeholders may request server-side pre-aggregation before requirements justify it | Medium | Low | Reference this BRD and ADR-0008/ADR-0054 boundaries during roadmap planning; require a new ADR to lift the deferral | Product Owner |
| R-004 | Aggregation grain and time-zone assumptions made now could be wrong for future dashboards | Low (avoided by not building) | Low | Avoid building the table until grain and time-zone requirements are explicit | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialPost` schema and enrichment output remain stable | Internal | Data subsystem | Ongoing |
| D-002 | Design Specification §4.6 "Deferred" and §9 "Explicitly Out of Scope" | Reference | Architecture | Already in force |
| D-003 | [ADR-0054](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md) – narrow supersession of the "any charting UI" clause | Internal / Governance | Product Owner | Accepted 2026-08-17 |
| D-004 | Future insights/dashboard subsystem to define its data-layer contract | External to this subsystem | Future team | Unresolved; deferred |
| D-005 | [Story 4.2](../user-stories/epic-4-derived-data-analytics-and-health.md#story-42--deferred-topic-time-series-aggregation) | Implementation | Engineering | Ready |

---

## 14. Acceptance Criteria

- `SocialPost` consistently captures `publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` and these fields are queryable.
- No `TopicDailyCount` table, materialized view, continuous aggregate, or charting endpoint exists in `social-listening-core`.
- A contract test demonstrates that grouping raw `SocialPost` rows by day and topic/key-phrase can reconstruct the shape a future `TopicDailyCount` table would contain.
- Client-side dashboard charting in `social-listening-admin` (if present) uses only data already returned by `GET /v1/posts`, per ADR-0054.
- Any request to add server-side topic time-series aggregation requires a new ADR that explicitly supersedes ADR-0008's `TopicDailyCount` deferral.

---

## 15. Glossary

| Term | Definition |
|---|---|
| ADR | Architecture Decision Record—a document that captures an important architecture decision along with its context and consequences. |
| `TopicDailyCount` | A deferred, hypothetical pre-aggregated table storing the number of mentions of a topic per day. |
| Time-series aggregation | The process of grouping timestamped data into buckets (e.g., per hour or per day) to reveal trends over time. |
| Enrichment | AI-derived metadata added to a `SocialPost`, including `entities` and `keyPhrases`. |
| `SocialPost` | The normalized post entity at the center of the data subsystem. |
| Insights/Dashboard subsystem | A future subsystem responsible for analytics, charting, and visual presentation of listening data. |
| ADR-0054 supersession | A later accepted ADR that partially narrows ADR-0008 by permitting client-side-computed charting in `social-listening-admin` only, with no new backend aggregation. |

---

## 16. Appendices

### Reference documents

- [ADR-0008: Defer `TopicDailyCount` aggregation and all charting to a future subsystem](../adr/0008-defer-topic-time-series-and-charting.md)
- [ADR-0054: Tenant-facing Analytics Dashboard scope and data-source strategy](../adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md)
- [Feature design: 08-dashboards-and-analytics](../product-research/feature-designs/08-dashboards-and-analytics.md)
- [Feature design: 25-topic-evolution-timeline](../product-research/feature-designs/25-topic-evolution-timeline.md)
- [Feature design: 27-preconfigured-analytics-views](../product-research/feature-designs/27-preconfigured-analytics-views.md)

### Related user stories

- [Story 4.2 — Deferred topic time-series aggregation](../user-stories/epic-4-derived-data-analytics-and-health.md#story-42--deferred-topic-time-series-aggregation) (Source: ADR-0008, Status: Ready)
- Epic 8 stories 8.1–8.6 are client-side dashboard work enabled by ADR-0054 and do not alter the `TopicDailyCount` deferral in ADR-0008.

### Missing source note

No `docs/product-research/reports/0008-defer-topic-time-series-and-charting-deep-research.md` file exists. The BRD is therefore based on the ADR itself, the referenced design specification, the related feature-design documents, and the user stories above.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | | | |
