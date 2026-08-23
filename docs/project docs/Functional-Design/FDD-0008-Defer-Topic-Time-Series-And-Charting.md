# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0008 Defer Topic Time-Series and Charting — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0008 is Accepted; narrowly, partially superseded by ADR-0054, 2026-08-17 — see §3 and §13) |
| Related Documents | ADR-0008, ADR-0054, ADR-0038, BRD-0008, Story 4.2, Epic 8 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0008 (defer `TopicDailyCount` aggregation and all charting to a future subsystem) — as narrowly amended by ADR-0054 — into a functional design describing exactly what this subsystem does and does not do regarding topic-volume-over-time, and what raw data it guarantees remains available for whoever eventually builds that aggregation.

### 2.2 Scope

- **In scope:** the boundary decision itself — no server-side `TopicDailyCount` table/endpoint/aggregation grain in `social-listening-core`; the guarantee that `SocialPost.publishedAt`, `enrichment.entities`, and `enrichment.keyPhrases` remain captured and queryable; the narrow, dated carve-out (ADR-0054) permitting client-side-computed charting inside `social-listening-admin` using only `GET /v1/posts` data, with zero new backend aggregation.
- **Out of scope:** designing `TopicDailyCount` itself, any aggregation grain (daily/hourly/per-tenant-timezone) or its time-zone handling; any server-side pre-computed rollup, continuous aggregate, or dedicated analytics/reporting subsystem; the specific Epic 8 dashboard screens themselves (governed by ADR-0054/Epic 8's own design, referenced but not re-specified here).

### 2.3 Target Audience

Backend engineers deciding whether a proposed feature crosses this subsystem's charter boundary; the admin UI engineer building Epic 8 dashboard charting; the technical lead adjudicating any future request to lift this deferral.

---

## 3. Context and Background

- **Problem/opportunity:** topic-volume-over-time ("mentions of X per day") is a natural feature built on data this subsystem already captures (`enrichment.entities`/`keyPhrases` and `publishedAt` on `SocialPost`). But this subsystem's scope is explicitly the ingestion/insights *data* subsystem, not dashboards — charting UI and consumer-facing analytics are called out as belonging to later subsystems.
- **Business/user value:** keeps this subsystem's scope aligned with its stated purpose (ingestion, normalization, enrichment, storage, exposing data via events/API); avoids committing to a time-series aggregation grain before a consuming dashboard subsystem's actual requirements are known; no wasted work, since the raw fields a future subsystem needs are already captured.
- **Source requirements:** ADR-0008; ADR-0054 (2026-08-17, narrow supersession); BRD-0008 (BR-001–BR-005, BRU-001–BRU-004); Story 4.2 (built `social-listening-core@ec66c3b`); Epic 8 Stories 8.1–8.6 (client-side dashboard work enabled by ADR-0054, does not alter the `TopicDailyCount` deferral).
- **Amendment (2026-08-17, ADR-0054):** the original Decision bundled two things under one sentence — "no `TopicDailyCount` table, endpoint, **or any charting UI**." ADR-0054 supersedes only the "any charting UI" clause, narrowly bounded to client-side-computed charting inside `social-listening-admin`, using data `GET /posts`/`enrichment` already returns, with zero new backend aggregation. The "no `TopicDailyCount` table or endpoint" clause remains fully in force, untouched.
- **Related correction (2026-08-13):** Story 4.2's own AC1/AC3 originally assumed `enrichment.entities` had an unspecified shape; Story 2.8 (ADR-0038) later settled it as `{text, category, confidenceScore}[]`, not bare `string[]`. This FDD's data model (§7) reflects that settled shape.
- **Constraints/dependencies:** any consumer wanting topic-volume-over-time today (before ADR-0054's narrow carve-out) must aggregate `GET /posts` results client-side — materially more expensive than a pre-aggregated table, accepted because no in-scope consumer needed it until Epic 8; a future insights subsystem will need read access to raw post-level enrichment data (via API or an as-yet-undefined data-layer contract) to build `TopicDailyCount` — this ADR does not resolve that dependency.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Keep the data subsystem focused on ingestion/enrichment/storage/API, not visualization | No dashboard, visualization, or time-series table exists in `social-listening-core` beyond ADR-0054's narrow carve-out |
| G2 | Avoid speculative aggregation design before consumer requirements are known | `TopicDailyCount` and similar rollups are not designed or built |
| G3 | Preserve future buildability for an eventual insights/dashboard subsystem | `SocialPost` consistently carries `publishedAt`, `enrichment.entities`, `enrichment.keyPhrases`, queryable enough to reconstruct `TopicDailyCount` from raw data |
| G4 | Minimize wasted engineering work while keeping the option to aggregate later | A future subsystem can compute `TopicDailyCount` directly from existing data without compensating changes now |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: No server-side topic time-series aggregation

- **Description:** `social-listening-core` builds no `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent pre-computed topic-time-series store, and no endpoint or event whose purpose is to return pre-aggregated topic volume over time.
- **Triggers:** any proposed feature or story that would add such a table/endpoint.
- **Inputs:** a feature proposal touching topic-volume-over-time.
- **Processing:** the proposal is checked against this boundary; anything matching "pre-aggregated topic count over time, computed server-side" is out of scope for this subsystem unless a new ADR explicitly supersedes this clause (as ADR-0054 did, narrowly, for charting only — not for aggregation).
- **Outputs:** `social-listening-core`'s codebase and API surface contain no such table/endpoint.
- **Error handling:** a pull request or story that adds a `TopicDailyCount`-shaped table/endpoint without a superseding ADR is a scope violation to reject at review, not to merge with a caveat.
- **Edge cases:** a proposal that looks aggregation-shaped but is actually just a filtered/paginated read of raw `SocialPost` rows (no server-side pre-computation) does not violate this boundary — the line is "pre-computed store," not "any query that touches many posts."

### 5.2 Feature / Capability: Guaranteed raw-data availability for future aggregation

- **Description:** `SocialPost` continues to capture, in tenant-scoped, queryable form, the exact fields a future time-series subsystem would need: `publishedAt`, `enrichment.entities`, `enrichment.keyPhrases`.
- **Triggers:** every enriched post ingested by the pipeline.
- **Inputs:** the connector's normalized post output and the AI enrichment stage's output.
- **Processing:** `publishedAt` is set at normalization; `enrichment.entities` (`{text, category, confidenceScore}[]`, per ADR-0038's settled shape) and `enrichment.keyPhrases` are set at enrichment time; none of these fields is ever omitted or gated behind this deferral.
- **Outputs:** every enriched `SocialPost` row carries these fields, queryable via the existing `GET /posts` API.
- **Error handling:** a post missing these fields where enrichment succeeded is an enrichment-pipeline defect, unrelated to this ADR's deferral decision — this ADR only forbids building the *aggregation*, never the underlying raw data.
- **Edge cases:** a post whose enrichment failed or is unavailable (per ADR-0010/ADR-0023's retry/failure handling) simply has these fields unpopulated for that post — a future aggregator must handle that gap the same way any consumer of enrichment data already does.

### 5.3 Feature / Capability: Client-side aggregation as today's only path

- **Description:** any consumer wanting topic-volume-over-time before a future insights subsystem exists must derive it by aggregating raw, paginated `GET /posts` results client-side.
- **Triggers:** a consumer (e.g., the admin UI, before ADR-0054) needing a "mentions per day" view.
- **Inputs:** paginated `GET /posts` responses, including `publishedAt` and `enrichment` fields.
- **Processing:** the consumer performs its own grouping/counting client-side; `social-listening-core` performs no pre-aggregation on the consumer's behalf.
- **Outputs:** a client-computed topic-volume view, materially more expensive than a pre-aggregated table but functionally complete.
- **Error handling:** a consumer relying on this path against a very large post volume should expect real client-side compute/latency cost — this is a known, accepted tradeoff (BRD-0008 R-001), not a defect.
- **Edge cases:** none beyond ordinary pagination handling already required of any `GET /posts` consumer.

### 5.4 Feature / Capability: Narrow charting carve-out (ADR-0054)

- **Description:** `social-listening-admin` is permitted to render client-side-computed charting (Epic 8, Stories 8.1–8.6, `/tenant/analytics`) using data `GET /posts`/`enrichment` already returns, with zero new backend aggregation table, endpoint, or grain.
- **Triggers:** the admin UI's own Analytics Dashboard feature (Epic 8).
- **Inputs:** `GET /posts` responses (including `enrichment.entities`/`keyPhrases`, `publishedAt`) already available to any consumer.
- **Processing:** the admin UI computes chart data entirely client-side (in the browser or its own BFF layer), from data already returned by the existing public API — no new `social-listening-core` code path is introduced to support this.
- **Outputs:** dashboard charts rendered in `social-listening-admin`, sourced entirely from pre-existing API responses.
- **Error handling:** any Epic 8 work that would require a *new* `social-listening-core` endpoint or stored aggregate is out of ADR-0054's own narrow scope and falls back under this ADR's original, unmodified deferral — it would need its own separate ADR.
- **Edge cases:** the boundary is specifically "charting UI inside `social-listening-admin`, zero new backend aggregation" — any other consumer (a different UI, a downstream subsystem) wanting the same convenience does not automatically inherit this carve-out; it would need its own analysis.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Subsystem Architect / Technical Lead | Enforces the boundary; adjudicates any proposal to lift the deferral |
| Backend Engineer | Ensures `SocialPost` continues to carry the raw fields future aggregation needs |
| Admin UI Engineer | Builds Epic 8 client-side charting within ADR-0054's narrow carve-out |
| Future Insights/Dashboard Subsystem (not yet built) | Eventual consumer that will build `TopicDailyCount` from raw data |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 4.2) | subsystem architect scoping this subsystem's boundaries | have `SocialPost` consistently capture `enrichment.entities`, `enrichment.keyPhrases`, and `publishedAt` without this subsystem building a `TopicDailyCount` table or any charting UI | a future insights/dashboard subsystem can build topic-volume-over-time aggregation directly from this data, without this subsystem taking on visualization scope it wasn't meant to own | (1) every enriched `SocialPost` has `enrichment.entities`, `enrichment.keyPhrases`, `publishedAt` populated and queryable; (2) no `TopicDailyCount` table/materialized view/charting endpoint exists in `social-listening-core`; (3) a query grouping raw `SocialPost` rows by day/topic can reconstruct what `TopicDailyCount` would contain |
| US2 (Epic 8, enabled by ADR-0054) | tenant analytics viewer | see client-side-computed analytics charts in `social-listening-admin` | I get topic/volume insight today, without this subsystem building new backend aggregation | Charts are computed entirely from `GET /posts`/`enrichment` data already returned; no new `social-listening-core` aggregation table or endpoint is introduced |

### 6.3 Workflow Diagrams / Steps

**Workflow: A feature proposal touching topic-volume-over-time**

1. Proposal is evaluated against this ADR's boundary: does it require a new server-side pre-aggregated store or endpoint?
2. If yes, and no superseding ADR exists for that specific case: proposal is out of scope; author must either restructure it as client-side aggregation (5.3/5.4) or draft a new ADR explicitly superseding this deferral.
3. If yes, but it matches ADR-0054's narrow carve-out (client-side charting in `social-listening-admin`, zero new backend aggregation): proceed under Epic 8.
4. If no (it's a raw-data read, not a pre-aggregation): proceed normally as an ordinary `GET /posts` consumer.

**Workflow: Admin UI Analytics Dashboard rendering a chart (ADR-0054 carve-out)**

1. Admin UI fetches paginated `GET /posts` results (including `publishedAt`, `enrichment.entities`/`keyPhrases`) for the tenant.
2. Admin UI computes chart data (e.g., mentions per day) entirely client-side/BFF-side.
3. Chart renders in `/tenant/analytics` — no new `social-listening-core` code path was touched to produce it.

**Workflow: Future insights subsystem building `TopicDailyCount` (not yet built)**

1. Future subsystem reads raw `SocialPost` rows (via API or a to-be-defined data-layer contract) for a tenant.
2. Groups by day and topic/entity/key-phrase to compute its own aggregation.
3. Because `publishedAt`/`enrichment.entities`/`enrichment.keyPhrases` are already guaranteed present and queryable (5.2), no changes to `social-listening-core` are required to enable this.

---

## 7. Data Requirements

### 7.1 Data Inputs

`SocialPost.publishedAt`; `SocialPost.enrichment.entities` (`{text, category, confidenceScore}[]`, per ADR-0038); `SocialPost.enrichment.keyPhrases`; paginated `GET /posts` responses as the sole read path for any current topic-volume consumer.

### 7.2 Data Outputs

No new server-side outputs are produced by this ADR — its entire functional content is a guarantee (raw fields remain available) and a boundary (no server-side aggregation/charting beyond ADR-0054's narrow carve-out). Client-side chart data is an output of the admin UI's own Epic 8 feature, not of this subsystem.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialPost` (existing, unchanged by this ADR) | `publishedAt`, `enrichment.entities` (`{text, category, confidenceScore}[]`), `enrichment.keyPhrases` | Source data any future `TopicDailyCount` aggregation would group by day/topic; owned by earlier ADRs (ADR-0002/ADR-0038) |
| `TopicDailyCount` (explicitly not built) | would be: topic/entity, day, tenant, mention count | Deferred entirely to a future insights/dashboard subsystem; no schema exists in `social-listening-core` |
| Client-side chart data (admin UI, Epic 8, ADR-0054) | computed in `social-listening-admin`, not persisted server-side | Derived entirely from `GET /posts` responses; not a `social-listening-core` entity |

### 7.4 Validation Rules

- `SocialPost` is the authoritative source for topic, entity, key-phrase, and timestamp data; no pre-aggregated topic count table may be introduced under this ADR (BRU-001).
- Time-series aggregation grain (daily, hourly, per-tenant timezone) is a decision for the future consuming subsystem, not this data subsystem (BRU-002).
- Any client-side charting permitted today must use only data already returned by `GET /posts` and must not require a new backend aggregation endpoint (BRU-003).
- All data access for future analytics remains subject to tenant-scoped RLS and existing API authorization (BRU-004).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | No `TopicDailyCount` table, materialized view, continuous aggregate, or equivalent server-side topic time-series store is built. | `social-listening-core` |
| BR2 | No endpoint or event whose purpose is to return pre-aggregated topic volume over time is exposed. | `social-listening-core` public API |
| BR3 | `SocialPost` continues to capture `publishedAt`, `enrichment.entities`, `enrichment.keyPhrases` in tenant-scoped, queryable form. | `SocialPost` |
| BR4 | Any topic-volume-over-time consumer in scope today derives its data by aggregating raw `GET /posts` results client-side. | Consumers |
| BR5 | Charting UI is not built inside this subsystem, except as explicitly scoped by ADR-0054's narrow carve-out. | `social-listening-core`, `social-listening-admin` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `GET /posts` | Outbound | Sole read path for any current topic-volume-over-time consumer (client-side aggregation) | HTTPS REST / JSON |
| `social-listening-admin` Analytics Dashboard (Epic 8, ADR-0054) | Outbound consumer | Client-side-computed charting from `GET /posts` data, zero new backend aggregation | HTTPS REST / JSON (existing endpoint) |
| Future insights/dashboard subsystem (not yet built) | Future outbound consumer | Would build `TopicDailyCount` from raw `SocialPost` data via API or a not-yet-defined data-layer contract | Undefined — explicit open dependency |
| RLS (ADR-0015) | Enforcement | Ensures any future analytics read remains tenant-scoped | Postgres row-level security |

---

## 10. Non-Functional Considerations

- **Performance:** the raw `SocialPost` data model must support future topic time-series computation without a migration — a query grouping by day and topic/key-phrase can reconstruct what `TopicDailyCount` would contain, verified by contract test (NFR-001).
- **Reliability/cost:** no new operational burden (refresh jobs, materialized views, extra storage) is introduced for deferred aggregation — no `pg_cron` job or continuous aggregate exists for topic time-series (NFR-002).
- **Security/access control:** future consumers must read raw data through existing tenant-scoped, RLS-respecting contracts — no future data-layer contract may bypass `social-listening-core` RLS or direct database access rules (NFR-003).
- **Maintainability:** the boundary is enforced by review discipline and, per BRD-0008's acceptance criteria, by a contract test proving the raw-data reconstruction is possible — not by a runtime mechanism.
- **Accessibility/localization:** not applicable to this ADR's own scope; any charting UI (ADR-0054/Epic 8) inherits the admin UI's own standards separately.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A proposal adds a `TopicDailyCount`-shaped table/endpoint without a superseding ADR | N/A (caught at review) | Rejected as a scope violation; requires either restructuring as client-side aggregation or a new superseding ADR |
| Epic 8 work requires a new `social-listening-core` endpoint or stored aggregate | N/A (caught at review) | Falls outside ADR-0054's narrow carve-out; requires its own separate ADR, not assumed covered |
| A post is missing `publishedAt`/`enrichment` fields where enrichment succeeded | N/A (enrichment pipeline defect) | Unrelated to this ADR's deferral; treated as an enrichment-pipeline bug, not a deferral violation |
| A consumer performs expensive client-side aggregation over large paginated `GET /posts` results | N/A (accepted tradeoff) | Expected and accepted until a future consumer justifies server-side pre-aggregation (BRD-0008 R-001) |

---

## 12. Assumptions and Dependencies

- A future insights or dashboard subsystem will eventually require read access to raw, tenant-scoped post-level enrichment data.
- `GET /posts` and the existing `SocialPost` data model provide sufficient information for a future consumer to compute `TopicDailyCount` without this subsystem adding new storage.
- No subsystem consumer currently in scope requires server-side topic-volume-over-time beyond ADR-0054's narrow, client-side carve-out.
- Dependency: ADR-0038 settled `enrichment.entities`' real shape (`{text, category, confidenceScore}[]`), which any future aggregation must account for.
- Dependency: ADR-0054 (2026-08-17) is the only accepted supersession of this ADR, and only of its "any charting UI" clause — narrowly bounded to client-side charting in `social-listening-admin`.
- Dependency: the data-layer contract a future insights subsystem would use to read raw post data (API vs. some other mechanism) is explicitly undefined and unresolved by this ADR.
- Dependency: ADR-0015 (RLS) governs tenant isolation for any future analytics read.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What data-layer contract will a future insights/dashboard subsystem actually use to read raw post-level enrichment data — the existing REST API, or something new? | Product Owner / Technical Lead | Unresolved; deferred until that subsystem is scoped |
| Q2 | Any request to add server-side topic time-series aggregation requires a new ADR that explicitly supersedes this deferral — has one been drafted since ADR-0054? | Technical Lead | Check `docs/adr/README.md`'s current index before assuming still deferred |

---

## 14. Appendix

- **Glossary:** see BRD-0008 §15 (ADR, `TopicDailyCount`, Time-series aggregation, Enrichment, `SocialPost`, Insights/Dashboard subsystem, ADR-0054 supersession).
- **Reference links:** `docs/adr/0008-defer-topic-time-series-and-charting.md`; `docs/adr/0054-tenant-facing-analytics-dashboard-scope-and-data-source-strategy.md`; `docs/project docs/Business-Requirements/BRD-0008-Defer-Topic-Time-Series-And-Charting.md`; `docs/user-stories/epic-4-derived-data-analytics-and-health.md` (Story 4.2); `docs/user-stories/epic-8-analytics-dashboard.md` (Stories 8.1–8.6); `docs/adr/0038-...` (entities shape correction, per Story 4.2's dated note).
- **Feature design/deep research:** `docs/product-research/feature-designs/08-dashboards-and-analytics.md`, `docs/product-research/feature-designs/25-topic-evolution-timeline.md`, `docs/product-research/feature-designs/27-preconfigured-analytics-views.md` — all referenced by BRD-0008 as related future-dashboard context. No `docs/product-research/reports/<feature>-deep-research.md` file was found for this specific deferral decision.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0008 (with its ADR-0054 amendment)/BRD-0008/Story 4.2 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
