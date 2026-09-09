# BRD-0104: AI Topic Clustering — Post-Topics Schema

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0104: AI Topic Clustering — Post-Topics Schema |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno |
| Status | Draft for review (ADR-0104 is Proposed) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0104, feature design 04-ai-topic-clustering, and Epic 12 stories 12.7/12.8 |

> **Note:** ADR-0104 is currently **Proposed**. This BRD is a draft for review and is expected to change if the ADR is modified before acceptance.

---

## 2. Executive Summary

Social listening currently surfaces topics as transient, AI-derived labels inside a post's `enrichment` JSONB. That makes it hard to filter, aggregate, or compare mentions by theme over time, and it prevents the analytics dashboard from offering a reliable `selectedTopic` filter.

This BRD defines the business case for a durable `topics` catalog and a `post_topics` junction table, backed by an extraction contract on `AIProviderConnector`, a scheduled refresh worker, and tenant-level curation endpoints (rename, merge, hide). The change turns AI-suggested topics into first-class, queryable business dimensions that can drive dashboards and the topic-evolution timeline.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make AI-generated topics queryable and filterable across the platform | Users can filter posts, dashboards, and topic-evolution views by a stable `selectedTopic` with sub-second response times |
| 2 | Reduce manual taxonomy maintenance | Tenant admins can rename, merge, or hide noisy topics without engineering support |
| 3 | Unblock dashboard and topic-evolution features | `selectedTopic` is accepted by `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution` |
| 4 | Keep AI-processing costs bounded | Refresh is limited to a 7-day rolling window; full backfill is a rate-limited Platform-Admin action |
| 5 | Preserve multi-tenant data isolation | All `topics` and `post_topics` rows are tenant-scoped and protected by RLS |

---

## 4. Scope

### 4.1 In Scope

- A tenant-scoped `topics` catalog (`id`, `tenant_id`, `name`, `slug`, `description`, `status`, `merged_into_topic_id`, `created_at`, `updated_at`).
- A `post_topics` many-to-many junction (`post_id`, `topic_id`, `tenant_id`, `confidence`, `extracted_at`) with composite primary key `(post_id, topic_id)`.
- `AIProviderConnector.extractTopics(text): Promise<Array<{ name, confidence }>>` enrichment contract.
- Per-post topic extraction inside `enrichPost()` with upsert semantics and removal of prior topics for the post.
- A scheduled `TopicClusteringRefresh` worker limited to posts from the last 7 days.
- A rate-limited, Platform-Admin triggered full backfill action.
- Tenant curation endpoints: `GET /v1/topics`, `POST /v1/topics/:id/rename`, `POST /v1/topics/:id/merge`, `POST /v1/topics/:id/hide`.
- `selectedTopic` query parameter support on `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution`.

### 4.2 Out of Scope

- Hierarchical or parent/child topic relationships.
- Automatic near-duplicate topic detection or auto-merge jobs.
- UI color, icon, or other visual styling metadata for topics.
- Cross-tenant, platform-wide topic sharing.
- Automatic backfilling of `TopicDailyCount` history after a merge.

### 4.3 Assumptions

- Azure OpenAI / `AIProviderConnector` is already available for structured-output extraction.
- The existing `social_posts` and `enrichment` pipeline can call `extractTopics` with acceptable latency.
- Tenants own and curate their own topic catalogs; topic labels may be AI-suggested and user-refined.

### 4.4 Constraints

- Clustering full history is expensive; routine refresh is capped at 7 days.
- `tenant_id` is the RLS key for both `topics` and `post_topics`.
- `confidence` is a `number` in the range `0.0–1.0`.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Topic-Center-Analyst | Primary end user | High | Explore human-readable topics, view related posts/authors, compare topics over time |
| Tenant-Brand-Reputation-Manager | Primary end user | High | Spot emerging reputation topics and drill into representative posts |
| Social-Selling-Strategist | Primary end user | High | Identify commercial-intent conversations by AI-suggested topic |
| Tenant-Business-Analyst | Secondary end user | Medium | Export topic-label distributions and use topics as reporting dimensions |
| Tenant-User | Secondary end user | Medium | Filter the post feed by topic and see why a post matches |
| Tenant-Admin | Topic curator | High | Rename, merge, or hide topics to keep the catalog clean |
| Platform-Admin | Operations | Medium | Trigger and monitor rate-limited full backfills |
| Backend Engineer | Implementer | High | Stable schema, clear enrichment contract, and refresh rules |

---

## 6. Current State (As-Is)

Topic labels are currently produced by AI clustering and stored only inside the `enrichment` JSONB column of `social_posts`. While this is easy to add to the enrichment pipeline, it makes topics:

- **Slow to filter and aggregate:** JSONB containment and array matching do not perform well for dashboard filtering or time-series aggregation.
- **Unstable as filter keys:** topic labels are strings that can change when the model or corpus changes; there is no canonical `topic_id` for deep links.
- **Hard to curate:** there is no place to persist rename, merge, or hide actions, so users cannot maintain a clean topic catalog.
- **Inaccessible to dashboard filters:** the dashboard and topic-evolution timeline cannot offer a `selectedTopic` filter without a stable topic dimension.

---

## 7. Future State (To-Be)

After this change, every post ingested or re-enriched passes through the `enrichPost()` topic-extraction step. `AIProviderConnector.extractTopics()` returns a list of `name`/`confidence` pairs. The system normalizes each `name` to a tenant-scoped `topics` row and creates the corresponding `post_topics` rows with confidence.

A scheduled `TopicClusteringRefresh` worker keeps the last 7 days up to date. Platform Admins can run a rate-limited full backfill if needed. Tenant Admins view the topic list in the admin UI, rename unclear labels, merge duplicates, and hide irrelevant topics. Dashboards and the topic-evolution timeline expose a `selectedTopic` filter that persists in the URL.

**Expected capabilities:**
- Stable, tenant-specific topic IDs that survive model updates.
- Fast filtering and aggregation across posts by topic.
- Human curation of AI-suggested topics.
- Deep-linkable dashboard and evolution views filtered to a single topic.
- Foundation for the `TopicDailyCount` and analytics features built in ADR-0087.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall maintain a tenant-scoped `topics` catalog with `id`, `tenant_id`, `name`, `slug`, `description`, `status`, `merged_into_topic_id`, `created_at`, `updated_at`. | Must | Table exists, rows are isolated by `tenant_id`, `status` accepts `active`/`merged`/`hidden` | Product Owner |
| BR-002 | The system shall maintain a `post_topics` junction table linking posts to topics with `confidence` and `extracted_at`. | Must | Composite PK `(post_id, topic_id)`, `tenant_id` RLS, `confidence` stored as 0.0–1.0 | Product Owner |
| BR-003 | `enrichPost()` shall extract topics via `AIProviderConnector.extractTopics()` and upsert `post_topics` and `topics` rows. | Must | New post ingestion creates/updates rows; prior post topics are removed before upsert | Product Owner |
| BR-004 | The system shall run a `TopicClusteringRefresh` worker over posts from the last 7 days. | Must | Scheduled worker runs and re-clusters posts that have no topics or an outdated model | Product Owner |
| BR-005 | A Platform-Admin action shall support full backfill with rate limiting. | Should | Backfill action can be triggered, is rate-limited, and reports progress | Product Owner |
| BR-006 | The system shall expose `GET /v1/topics` to list active topics for a tenant. | Must | Endpoint returns tenant-scoped topics with counts/labels; hidden topics excluded by default | Product Owner |
| BR-007 | The system shall support `POST /v1/topics/:id/rename`. | Must | Renames `name` and updates `slug`; does not break existing `post_topics` references | Product Owner |
| BR-008 | The system shall support `POST /v1/topics/:id/merge`. | Must | Sets source `status='merged'`, `merged_into_topic_id`, and re-points `post_topics` rows to the target topic | Product Owner |
| BR-009 | The system shall support `POST /v1/topics/:id/hide`. | Must | Sets `status='hidden'`; hidden topic no longer appears in `GET /v1/topics` by default | Product Owner |
| BR-010 | Dashboard and evolution endpoints shall accept a `selectedTopic` query parameter. | Must | `GET /v1/dashboards/widgets?selectedTopic=<topicId>` and `GET /v1/topics/evolution?topicId=<topicId>` filter to the topic | Product Owner |
| BR-011 | The UI shall persist `selectedTopic` in the URL query string for deep linking. | Should | Selecting a topic updates the URL; sharing or reloading the URL restores the filter | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All `topics` and `post_topics` queries enforce `tenant_id` RLS and never return cross-tenant data | Security | Must | Contract tests prove isolation for every endpoint and SQL path |
| NFR-002 | `GET /v1/topics` and `GET /v1/dashboards/widgets?selectedTopic=...` respond in under 500 ms for a tenant with 1M posts | Performance | Should | Measured in staging with p95 latency |
| NFR-003 | Topic extraction completes within the existing `enrichPost()` latency budget | Performance | Should | Measured in production over 30 days |
| NFR-004 | The 7-day refresh worker must be safe to rerun and idempotent | Reliability | Must | Duplicate runs do not create duplicate `post_topics` rows |
| NFR-005 | The enrichment contract returns deterministic, deterministic-JSON-shaped results | Maintainability | Must | JSON schema validation in contract tests |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `topics.status` is one of `active`, `merged`, or `hidden`. |
| BRU-002 | `topics.tenant_id` is the RLS key for both `topics` and `post_topics`. |
| BRU-003 | `post_topics.confidence` must be a number between 0.0 and 1.0 inclusive. |
| BRU-004 | The primary key of `post_topics` is the composite `(post_id, topic_id)`. |
| BRU-005 | `POST /v1/topics/:id/rename` updates `name` and `slug` of the target topic. |
| BRU-006 | `POST /v1/topics/:id/merge` sets the source topic `status='merged'`, stores `merged_into_topic_id`, and reassigns `post_topics` rows from the source to the target. |
| BRU-007 | `POST /v1/topics/:id/hide` sets `status='hidden'`; hidden topics are excluded from `GET /v1/topics` by default. |
| BRU-008 | `enrichPost()` removes all prior `post_topics` rows for a post before upserting the newly extracted topics. |
| BRU-009 | Full backfill is a Platform-Admin-only, rate-limited action. |
| BRU-010 | Cross-tenant topic sharing is not permitted; every topic catalog is tenant-scoped. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `topics.id` | Canonical UUID for a topic | System-generated | Backend | Internal |
| `topics.tenant_id` | RLS / ownership key | Derived from post/tenant | Backend | Internal |
| `topics.name` | Human-readable topic label | AI extraction or user rename | Backend | Public within tenant |
| `topics.slug` | URL-safe identifier | Derived from `name` | Backend | Public within tenant |
| `topics.description` | Optional human-readable description | AI or user input | Backend | Public within tenant |
| `topics.status` | `active`/`merged`/`hidden` | System/user | Backend | Internal |
| `topics.merged_into_topic_id` | Target topic UUID when `merged` | System/user | Backend | Internal |
| `post_topics.post_id` | Reference to `social_posts` | Ingestion/enrichment | Backend | Internal |
| `post_topics.topic_id` | Reference to `topics` | AI extraction | Backend | Internal |
| `post_topics.confidence` | 0.0–1.0 model confidence | AI provider | Backend | Internal |
| `post_topics.extracted_at` | Timestamp of extraction | System | Backend | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Topic coverage by source | Show which sources are generating which topics | Tenant Analyst | On-demand |
| `selectedTopic` filter usage | Track which topics are most often selected as filters | Product team | Weekly |
| Refresh worker lag | Monitor whether the 7-day refresh worker is keeping up | Platform Operations | Real-time / daily |
| Full backfill duration and rate-limit hits | Cost and operational awareness | Platform Operations | Per backfill |
| Topic merge/rename/hide audit | Track catalog curation actions | Tenant Admin / Product | On-demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Full backfill is expensive and could exhaust AI budget | Medium | High | Limit routine refresh to 7 days; require Platform-Admin trigger and rate limiting for full backfill | Product Owner |
| R-002 | Topic labels drift over time, causing inconsistent filters | Medium | Medium | Use stable `topic_id`; support merge/rename to manage drift | Product Owner |
| R-003 | Duplicate or near-duplicate topics clutter the catalog | Medium | Medium | Provide merge/hide tools; consider future auto-merge job | Product Owner |
| R-004 | Merged topics create broken historical counts | Low | Medium | Accept that `TopicDailyCount` is not backfilled automatically on merge; document the merge-date boundary | Product Owner |
| R-005 | RLS misconfiguration exposes topics across tenants | Low | High | Enforce `tenant_id` in every query; contract tests must verify isolation | Tech Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AIProviderConnector` contract (ADR-0002) | Internal | Tech Lead | Already accepted |
| D-002 | `TopicDailyCount` precomputed counts (ADR-0087) | Internal | Tech Lead | Already accepted |
| D-003 | RAG topic search (ADR-0084) | Internal | Tech Lead | Already accepted |
| D-004 | Metric explainability (ADR-0078) | Internal | Product Owner | Already accepted |
| D-005 | `enrichPost()` pipeline and `enrichment` JSONB | Internal | Backend Lead | Already built |
| D-006 | `docs/product-research/feature-designs/04-ai-topic-clustering.md` | Reference | Product Owner | Available |
| D-007 | Story 12.7 — backend schema and endpoints | Internal | Backend Lead | Ready for implementation |
| D-008 | Story 12.8 — topic curation UI and `selectedTopic` filter | Internal | Frontend Lead | Ready after Story 12.7 |

---

## 14. Acceptance Criteria

- `topics` and `post_topics` tables exist with tenant RLS and the columns defined in ADR-0104.
- `enrichPost()` creates or updates `post_topics` and `topics` rows for new and refreshed posts.
- `TopicClusteringRefresh` worker re-clusters posts from the last 7 days on a schedule.
- `POST /v1/topics/:id/rename`, `POST /v1/topics/:id/merge`, and `POST /v1/topics/:id/hide` are available and enforce tenant scoping.
- `GET /v1/dashboards/widgets?selectedTopic=<topicId>` and `GET /v1/topics/evolution?topicId=<topicId>` filter results to the selected topic.
- `GET /v1/topics` does not return hidden topics by default.
- Contract tests prove that a post always maps to the same set of canonical tenant-scoped topics and that cross-tenant leakage is impossible.
- The UI `TopicsView` supports list, rename, merge, and hide actions, and the `TopicSelector` is available in the dashboard header with URL-persisted `selectedTopic`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Topic | A human-readable, AI-extracted theme or cluster that describes a set of related posts. |
| `topics` | Tenant-scoped catalog table that stores canonical topic labels and curation state. |
| `post_topics` | Many-to-many junction table linking posts to topics with extraction confidence. |
| `confidence` | A 0.0–1.0 score indicating the model's certainty that a post belongs to a topic. |
| `selectedTopic` | A dashboard/evolution query parameter that filters the view to a single `topic_id`. |
| `enrichPost()` | Existing pipeline step that enriches a post with sentiment, entities, language, and now topics. |
| `TopicClusteringRefresh` | Scheduled worker that re-runs clustering on posts from the last 7 days. |
| `RLS` | Row-Level Security; the PostgreSQL mechanism used to enforce tenant isolation. |
| Merge | A curation action that marks one topic as merged into another and re-points all `post_topics` references. |
| Hide | A curation action that sets a topic's `status` to `hidden` so it no longer appears in default lists. |

---

## 16. Appendices

### Supporting documents
- ADR-0104 — `docs/adr/0104-ai-topic-clustering-post-topics-schema.md`
- Feature design — `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Scoping plan — `docs/product-research/feature-adr-scoping.md`
- Epic 12 — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Related user stories
- **Story 12.7 — AI topic clustering post-topics schema (backend):** `topics` and `post_topics` tables with tenant RLS; `enrichPost()` creates/updates rows; `TopicClusteringRefresh` worker; curation endpoints; `selectedTopic` support.
- **Story 12.8 — Topic curation and selected topic UI (frontend):** `TopicsView` list with rename/merge/hide; `TopicSelector` in dashboard header; `selectedTopic` persisted in URL; merged topics shown as aliases.

### Missing source note
- No `docs/product-research/reports/04-ai-topic-clustering-deep-research.md` file was found. Competitive/research content from the feature design's "Research-based recommendations" section was used instead.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-23 |
| Product Owner | Menno | | 2026-08-23 |
| Technical Lead | Menno | | 2026-08-23 |
| Other Stakeholder | | | |

> **Research Revision (2026-08-28):** Refined in place per  4-ai-topic-clustering-deep-research.md. Adds rolling 24-hour topic velocity tracking and auto-naming label generator.