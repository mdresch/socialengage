# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0104 AI Topic Clustering — Post-Topics Schema — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0104, BRD-0104, feature design 04) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0104 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0104, BRD-0104, `docs/product-research/feature-designs/04-ai-topic-clustering.md`, Story 12.7, Story 12.8, ADR-0087, ADR-0084, ADR-0078, ADR-0002 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0104 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the schema and endpoints below may still change before acceptance.

Today AI-derived topics live only inside a post's `enrichment` JSONB — transient, un-curatable, and slow to filter or aggregate. This document defines the functional behavior of a durable, tenant-scoped `topics` catalog and a `post_topics` junction table, the `AIProviderConnector.extractTopics()` enrichment contract that populates them, the scheduled refresh/backfill jobs that keep them current, the curation endpoints (rename, merge, hide) that let tenants maintain a clean catalog, and the `selectedTopic` filter that unblocks dashboard and topic-evolution views.

### 2.2 Scope

**In scope:**
- Tenant-scoped `topics` catalog and `post_topics` junction table.
- `AIProviderConnector.extractTopics(text)` contract and its use inside `enrichPost()`.
- Upsert-and-replace semantics for a post's topics on each (re-)enrichment.
- Scheduled `TopicClusteringRefresh` worker over the last 7 days.
- Rate-limited, Platform-Admin-triggered full backfill.
- Curation endpoints: `GET /v1/topics`, `POST /v1/topics/:id/rename`, `POST /v1/topics/:id/merge`, `POST /v1/topics/:id/hide`.
- `selectedTopic` filter on `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution`, persisted in the URL.
- `TopicDailyCount` integration for per-`topic_id` counts.

**Out of scope:**
- Hierarchical (parent/child) topic relationships.
- Automatic near-duplicate detection or auto-merge jobs.
- Topic visual metadata (color, icon).
- Cross-tenant/platform-wide topic sharing.
- Automatic backfill of `TopicDailyCount` history after a merge.

### 2.3 Target Audience

Backend engineers implementing the schema, enrichment contract, and refresh worker (Story 12.7); frontend engineers building topic curation UI and the dashboard `TopicSelector` (Story 12.8); QA authoring RLS and idempotency contract tests; Tenant Admins and Platform Admins who will operate curation and backfill.

---

## 3. Context and Background

`enrichPost()` already runs sentiment/entity/language enrichment against `AIProviderConnector` and writes into `social_posts.enrichment` (ADR-0002). Topic labels currently ride along in that same JSONB blob, which makes them slow to filter (JSONB containment does not scale for dashboard-grade aggregation) and unstable as filter keys (string labels shift when the model or corpus changes, so there is no canonical id for deep links). Downstream feature designs `08-dashboards-and-analytics` and `25-topic-evolution-timeline` both need a stable `selectedTopic` filter, which requires a real `topic_id`.

This design introduces `topics` and `post_topics` as first-class, tenant-RLS-protected tables, so topics become queryable dimensions rather than opaque JSON fragments, while topic curation (rename/merge/hide) gives tenants a way to keep the AI-suggested catalog usable over time.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make topics queryable/filterable at scale | `GET /v1/topics` and `selectedTopic`-filtered dashboard/evolution queries respond in under 500 ms for a 1M-post tenant |
| G2 | Reduce manual taxonomy maintenance burden | Tenant Admins can rename, merge, or hide topics without engineering support |
| G3 | Unblock dashboard and topic-evolution features | `selectedTopic` is accepted end-to-end and persists in the URL for deep linking |
| G4 | Keep AI-processing cost bounded | Routine refresh is capped at a 7-day rolling window; full backfill is rate-limited and Platform-Admin-only |
| G5 | Preserve multi-tenant isolation | Every `topics`/`post_topics` row is `tenant_id`-scoped and RLS-enforced; no cross-tenant topic reads are possible |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `topics` catalog and `post_topics` junction

- **Description:** Persists AI-extracted (and human-curated) topics per tenant, and the many-to-many association between posts and topics with per-association confidence.
- **Triggers:** Row creation happens as a side effect of topic extraction (5.2); row updates happen via curation actions (5.4).
- **Inputs:** Topic `name`/`confidence` pairs from `AIProviderConnector.extractTopics()`; curation requests (rename/merge/hide).
- **Processing:**
  - `topics` carries `id` (UUID), `tenant_id`, `name`, `slug`, `description`, `status` (`active`/`merged`/`hidden`), `merged_into_topic_id`, `created_at`, `updated_at`.
  - `post_topics` carries `post_id`, `topic_id`, `tenant_id`, `confidence` (0.0–1.0), `extracted_at`, with composite primary key `(post_id, topic_id)`.
  - `tenant_id` is the RLS key on both tables — no query may return rows for a different tenant.
- **Outputs:** Queryable topic dimension usable by `GET /v1/topics`, dashboard widgets, and the topic-evolution timeline.
- **Error handling:** An insert/update violating the RLS policy is rejected at the database layer; the API surfaces this as an authorization/not-found error rather than leaking cross-tenant existence.
- **Edge cases:** A `topic_id` referenced by `merged_into_topic_id` must itself be a valid, non-hidden topic in the same tenant; dangling merge targets are not permitted.

### 5.2 Feature / Capability: `AIProviderConnector.extractTopics()` and per-post extraction

- **Description:** Extracts candidate topics for a post's text and normalizes them into the tenant's `topics` catalog and `post_topics` associations.
- **Triggers:** Runs inside `enrichPost()` for newly ingested posts, and for posts re-enriched by the refresh worker (5.3) or a manual re-enrichment.
- **Inputs:** Post text (`body_markdown`).
- **Processing:**
  1. `AIProviderConnector.extractTopics(text): Promise<Array<{ name: string; confidence: number }>>` returns candidate topic names with confidence.
  2. Each returned `name` is matched against the tenant's existing `topics` (by name/slug); if no match exists, a new `topics` row is created with `status='active'`.
  3. All prior `post_topics` rows for the post are removed, then the newly extracted `(post_id, topic_id, confidence, extracted_at)` rows are upserted (BRU-008) — a post's topic set always reflects its most recent extraction, not an accumulation.
- **Outputs:** An up-to-date set of `post_topics` rows for the post, and any newly created `topics` catalog entries.
- **Error handling:** If extraction fails (provider error, timeout, empty text), the post's existing `post_topics` rows are left unchanged rather than cleared — a failed re-extraction must not silently strip a post's topics.
- **Edge cases:** A post whose extracted topic names collide case-insensitively or via near-identical slugs with an existing topic must resolve to the existing topic, not create a duplicate.

### 5.3 Feature / Capability: Scheduled refresh and Platform-Admin backfill

- **Description:** Keeps recently ingested posts' topics current, and provides a controlled path to re-cluster historical posts.
- **Triggers:** `TopicClusteringRefresh` runs on a schedule; full backfill is triggered explicitly by a Platform-Admin.
- **Inputs:** For refresh: posts from the last 7 days with no topics or an outdated clustering model version. For backfill: the full post history for one or more tenants.
- **Processing:**
  - The refresh worker re-runs extraction (5.2) only for posts within the rolling 7-day window that are unclustered or stale relative to the current model.
  - Repeated refresh runs must be idempotent — rerunning does not create duplicate `post_topics` rows (NFR-004), because extraction always replaces the post's topic set (5.2, step 3).
  - Full backfill beyond 7 days is available only as an explicit Platform-Admin action and is rate-limited to bound AI provider cost.
- **Outputs:** Refreshed `post_topics` rows for in-window posts; on backfill, refreshed rows for the requested historical range.
- **Error handling:** A backfill request exceeding the rate limit is rejected/queued rather than silently throttled without feedback; backfill progress is reported so an admin can monitor completion.
- **Edge cases:** A post ingested exactly at the edge of the 7-day window is still covered by the next scheduled run.

### 5.4 Feature / Capability: Topic curation — rename, merge, hide

- **Description:** Lets a tenant curate its AI-suggested topic catalog.
- **Triggers:** A Tenant-Admin calls one of the curation endpoints from the `TopicsView` UI (Story 12.8) or directly via the API.
- **Inputs:** `POST /v1/topics/:id/rename` (new `name`), `POST /v1/topics/:id/merge` (target `topic_id`), `POST /v1/topics/:id/hide` (no body beyond the target id).
- **Processing:**
  - **Rename:** updates `name` and re-derives `slug`; existing `post_topics` references are unaffected since they key on `topic_id`.
  - **Merge:** sets the source topic's `status='merged'` and `merged_into_topic_id` to the target; all `post_topics` rows referencing the source are re-pointed to the target topic (BRU-006).
  - **Hide:** sets `status='hidden'`; hidden topics are excluded from `GET /v1/topics` by default (BRU-007) but remain valid `post_topics` targets for historically extracted data.
- **Outputs:** Updated `topics` row(s); for merge, updated `post_topics` rows reflecting the new target.
- **Error handling:** Renaming/merging/hiding a topic that does not belong to the caller's tenant is rejected (RLS + authorization check). Merging a topic into itself, or into an already-merged/hidden topic, is rejected with a validation error.
- **Edge cases:** A topic merged into a target that is later itself merged into a third topic should resolve consistently for any consumer following `merged_into_topic_id` (curation UI and API should be able to follow the chain to the final active topic).

### 5.5 Feature / Capability: `selectedTopic` dashboard/evolution filter

- **Description:** Lets any topic-aware view (dashboard widgets, topic-evolution timeline) be scoped to a single topic.
- **Triggers:** A user selects a topic from the `TopicSelector` in the dashboard header, or loads/shares a deep link containing `selectedTopic`.
- **Inputs:** `selectedTopic` (a `topic_id`) as a query parameter on `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution` (as `topicId`).
- **Processing:** The endpoint filters its underlying post/aggregate query to only include posts associated (via `post_topics`) with the given `topic_id`. The UI keeps `selectedTopic` synchronized with the URL query string so the filtered view is shareable/reloadable.
- **Outputs:** Widget/evolution data scoped to the selected topic; a URL that reproduces the same filtered view when reloaded or shared.
- **Error handling:** An unknown or cross-tenant `topic_id` in `selectedTopic` yields an empty/not-found result rather than an error that leaks whether the id exists in another tenant.
- **Edge cases:** Selecting a merged topic's original (source) id should resolve to the merged-into target's data, consistent with 5.4's merge semantics, so a stale deep link to a merged topic still shows meaningful data.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Topic-Center-Analyst | Explores topics, related posts/authors, compares topics over time |
| Tenant-Brand-Reputation-Manager | Spots emerging reputation topics, drills into representative posts |
| Social-Selling-Strategist | Identifies commercial-intent conversations by topic |
| Tenant-Business-Analyst | Exports topic-label distributions as a reporting dimension |
| Tenant-User | Filters the post feed by topic |
| Tenant-Admin | Renames, merges, hides topics to keep the catalog clean |
| Platform-Admin | Triggers and monitors rate-limited full backfills |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.7) | backend engineer | `topics`, `post_topics`, and topic curation endpoints | topics are queryable, curatable, and dashboard-filterable | `topics`/`post_topics` with tenant RLS; `enrichPost()` creates/updates rows; `TopicClusteringRefresh` runs the last 7 days on schedule; rename/merge/hide endpoints available; `selectedTopic` supported on dashboard/evolution endpoints |
| US2 (Story 12.8) | Tenant-Admin | a topic list where I can rename, merge, or hide topics, and a `selectedTopic` filter on the dashboard | the topic catalog stays clean and I can focus dashboards on one topic | `TopicsView` lists topics with rename/merge/hide actions; `TopicSelector` added to dashboard header; `selectedTopic` persisted in URL; merged topics shown as aliases of the target |

### 6.3 Workflow Diagrams / Steps

**Extraction workflow (per post):**
1. A post is ingested (or refreshed/re-enriched).
2. `enrichPost()` calls `AIProviderConnector.extractTopics(body_markdown)`.
3. Each returned topic `name` is matched to an existing tenant `topics` row or a new one is created.
4. Existing `post_topics` rows for the post are deleted.
5. New `post_topics` rows are inserted with `confidence` and `extracted_at` for each matched/created topic.

**Refresh workflow:**
1. The scheduled `TopicClusteringRefresh` worker selects posts from the last 7 days with no topics or a stale model version.
2. For each selected post, the extraction workflow (above) runs.
3. Reruns are safe: because extraction replaces (not appends) a post's topics, no duplicate `post_topics` rows result.

**Curation workflow:**
1. A Tenant-Admin opens `TopicsView` and reviews the topic list (including counts of associated posts).
2. The admin renames a noisy label, merges a near-duplicate into a canonical topic, or hides an irrelevant topic.
3. The corresponding endpoint updates `topics` (and, for merge, re-points `post_topics`).
4. The updated catalog is reflected immediately in `GET /v1/topics` and in the `TopicSelector`.

**Dashboard filter workflow:**
1. A user selects a topic in the dashboard header `TopicSelector`.
2. The UI updates the URL query string with `selectedTopic=<topicId>` and re-requests `GET /v1/dashboards/widgets?selectedTopic=<topicId>`.
3. Widgets re-render scoped to the selected topic; the URL can be shared or reloaded to restore the same view.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Post text (`body_markdown`) supplied to `AIProviderConnector.extractTopics()`.
- Tenant-Admin curation requests (rename/merge/hide).
- `selectedTopic`/`topicId` query parameters from dashboard and evolution API calls.

### 7.2 Data Outputs

- `topics` and `post_topics` rows, queryable by `GET /v1/topics` and by dashboard/evolution endpoints.
- `TopicDailyCount` (ADR-0087) rollups keyed by `topic_id`.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `topics` | `id (uuid)`, `tenant_id`, `name`, `slug`, `description`, `status ('active'\|'merged'\|'hidden')`, `merged_into_topic_id`, `created_at`, `updated_at` | Tenant-scoped catalog; self-referential via `merged_into_topic_id`; referenced by `post_topics.topic_id` |
| `post_topics` | `post_id`, `topic_id`, `tenant_id`, `confidence (0.0–1.0)`, `extracted_at`; composite PK `(post_id, topic_id)` | Many-to-many junction between `social_posts` and `topics` |
| `social_posts` (existing) | Unchanged by this ADR | Referenced by `post_topics.post_id` |
| `TopicDailyCount` (ADR-0087, existing) | Precomputed daily counts keyed by `topic_id` | Derived from `post_topics`; not backfilled automatically on merge |

### 7.4 Validation Rules

- `topics.status` is one of `active`, `merged`, `hidden` (BRU-001).
- `tenant_id` is the RLS key for both `topics` and `post_topics`; no cross-tenant reads/writes (BRU-002, BRU-010).
- `post_topics.confidence` is a number in `[0.0, 1.0]` inclusive (BRU-003).
- `post_topics` primary key is the composite `(post_id, topic_id)` (BRU-004).
- Rename updates both `name` and `slug` together (BRU-005).
- Merge sets `status='merged'`, records `merged_into_topic_id`, and reassigns all `post_topics` rows from source to target (BRU-006).
- Hide sets `status='hidden'`; excluded from `GET /v1/topics` by default (BRU-007).
- Extraction always removes prior `post_topics` rows for a post before upserting new ones (BRU-008).
- Full backfill is Platform-Admin-only and rate-limited (BRU-009).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Every `topics`/`post_topics` row is tenant-scoped and RLS-enforced | All reads/writes |
| BR2 | A post's `post_topics` set is replaced, not appended to, on each extraction | `enrichPost()`, refresh worker |
| BR3 | Routine refresh is limited to the last 7 days | `TopicClusteringRefresh` |
| BR4 | Full backfill requires Platform-Admin action and is rate-limited | Backfill endpoint/job |
| BR5 | Merge re-points all referencing `post_topics` rows to the target topic | `POST /v1/topics/:id/merge` |
| BR6 | Hidden topics are excluded from `GET /v1/topics` by default | Topic listing |
| BR7 | `TopicDailyCount` history is not automatically backfilled after a merge | Precomputed aggregation |
| BR8 | Refresh reruns must be idempotent (no duplicate `post_topics` rows) | `TopicClusteringRefresh` |
| BR9 | `selectedTopic` filters must resolve merged-topic ids to their current target | Dashboard/evolution endpoints |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `AIProviderConnector.extractTopics()` | Outbound call | Produce candidate topic name/confidence pairs from post text | Provider SDK / REST, normalized JSON |
| `topics` / `post_topics` (Postgres) | Read/Write | Persist the topic catalog and post associations | SQL, tenant RLS |
| `enrichPost()` | Internal | Invokes extraction and upserts topic rows per post | Internal pipeline call |
| `TopicClusteringRefresh` (scheduled worker) | Internal | Re-run extraction over the last 7 days | Scheduled job |
| `GET /v1/topics`, `POST /v1/topics/:id/rename`, `/merge`, `/hide` | Inbound API | Topic listing and curation | REST/JSON |
| `GET /v1/dashboards/widgets`, `GET /v1/topics/evolution` | Inbound API | Accept `selectedTopic`/`topicId` filter | REST/JSON |
| `TopicDailyCount` (ADR-0087) | Read (derived) | Precomputed per-topic daily counts consumed by dashboards | Postgres aggregation |
| RAG topic search (ADR-0084) | Consumer | Uses stable `topic_id`/`name` as part of search context | Internal |

---

## 10. Non-Functional Considerations

- **Performance:** `GET /v1/topics` and `selectedTopic`-filtered widget/evolution queries target under 500 ms p95 for a 1M-post tenant (NFR-002); topic extraction stays within `enrichPost()`'s existing latency budget (NFR-003).
- **Security / access control:** `tenant_id` RLS on both `topics` and `post_topics` is mandatory and must be contract-tested for every endpoint and SQL path (NFR-001); full backfill is Platform-Admin-only.
- **Scalability:** A dedicated junction table (rather than JSONB) is chosen specifically so filtering/aggregation scale with indexing rather than JSONB containment scans.
- **Reliability / availability:** The refresh worker must be idempotent and safe to rerun without creating duplicate rows (NFR-004).
- **Audit and logging:** Rename/merge/hide actions should be attributable (who curated what, when) to support the topic merge/rename/hide audit reporting need.
- **Maintainability:** The enrichment contract returns a deterministic, schema-validated JSON shape (NFR-005).
- **Cost control:** Routine clustering is capped at a 7-day window; full historical backfill is explicitly rate-limited to bound AI provider spend.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Topic extraction fails for a post (provider error/timeout) | None (transparent) | Existing `post_topics` rows for the post are left unchanged; extraction is retried on the next scheduled refresh |
| Rename/merge/hide targets a topic outside the caller's tenant | Not-found / authorization error | Request rejected; no information about the other tenant's topic is disclosed |
| Merge target is invalid (self, already merged, already hidden) | Validation error | Merge rejected; source topic's status is unchanged |
| `selectedTopic` references an unknown or cross-tenant `topic_id` | Empty result set (or not-found, without disclosing existence) | Dashboard/evolution query returns no matching posts rather than erroring destructively |
| Full backfill requested beyond the configured rate limit | Rate-limit error with retry guidance | Request is rejected or queued; not silently dropped |
| Refresh worker reruns over an already-processed window | None (transparent) | No duplicate `post_topics` rows are created; extraction replace-semantics guarantee idempotency |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- `AIProviderConnector` and the `enrichPost()` pipeline are already available for structured-output extraction (ADR-0002).
- The existing `social_posts` table and RLS pattern can be extended with two new related tables without impacting existing enrichment.
- Tenants own and curate their own topic catalogs.

**Dependencies:**
- `AIProviderConnector` contract (ADR-0002) — already accepted.
- `TopicDailyCount` precomputed counts (ADR-0087) — already accepted.
- RAG topic search (ADR-0084) — already accepted.
- Metric explainability (ADR-0078) — already accepted.
- `enrichPost()` pipeline and `enrichment` JSONB — already built.
- Feature design `docs/product-research/feature-designs/04-ai-topic-clustering.md`.
- Story 12.7 (backend) and Story 12.8 (frontend), both currently Blocked pending ADR-0104 acceptance.

**Pending decisions:** ADR-0104 is Proposed; open questions below must be resolved before or during Story 12.7 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | How many topics should a single post be associated with — 1, 3, or up to a confidence threshold? | Product Owner | Before Story 12.7 implementation |
| Q2 | Should the AI provider return hierarchical (parent/child) topics or flat labels only? | Product Owner | Before Story 12.7 implementation |
| Q3 | How are near-duplicate topics detected — manual merge only, or a future auto-merge job? | Product Owner | Post-v1 |
| Q4 | Should `topics` support a `color` or `icon` for UI display? | Product Owner / UX | Before Story 12.8 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| Topic | A human-readable, AI-extracted theme describing a set of related posts. |
| `topics` | Tenant-scoped catalog table storing canonical topic labels and curation state. |
| `post_topics` | Many-to-many junction linking posts to topics with extraction confidence. |
| `confidence` | A 0.0–1.0 score indicating the model's certainty a post belongs to a topic. |
| `selectedTopic` | A dashboard/evolution query parameter filtering the view to one `topic_id`. |
| `TopicClusteringRefresh` | Scheduled worker that re-runs clustering on posts from the last 7 days. |
| Merge | Curation action marking one topic merged into another, re-pointing all references. |
| Hide | Curation action setting a topic's status to `hidden` so it is excluded by default. |

### Reference links

- ADR-0104: `docs/adr/0104-ai-topic-clustering-post-topics-schema.md` (Proposed)
- BRD-0104: `docs/project docs/Business-Requirements/BRD-0104-AI-Topic-Clustering-Post-Topics-Schema.md`
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Related ADRs: ADR-0087 (precomputed topic counts), ADR-0084 (RAG topic search), ADR-0078 (metric explainability), ADR-0002 (`AIProviderConnector`)
- Related user stories: Story 12.7 (backend), Story 12.8 (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing sources

- No `docs/product-research/reports/04-ai-topic-clustering-deep-research.md` deep-research brief was found; the feature design's own "Research-based recommendations" section was the closest available source and is referenced in the BRD.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
