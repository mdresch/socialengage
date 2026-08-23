# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0104: AI Topic Clustering — Post-Topics Schema |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft for review (ADR-0104 is Proposed)) |
| Related Documents | ADR-0104, BRD-0104, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

Social listening currently surfaces topics as transient, AI-derived labels inside a post's `enrichment` JSONB. That makes it hard to filter, aggregate, or compare mentions by theme over time, and it prevents the analytics dashboard from offering a reliable `selectedTopic` filter.

This FDD translates the accepted architecture and business requirements from ADR-0104 and BRD-0104 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A tenant-scoped `topics` catalog (`id`, `tenant_id`, `name`, `slug`, `description`, `status`, `merged_into_topic_id`, `created_at`, `updated_at`).
- A `post_topics` many-to-many junction (`post_id`, `topic_id`, `tenant_id`, `confidence`, `extracted_at`) with composite primary key `(post_id, topic_id)`.
- `AIProviderConnector.extractTopics(text): Promise<Array<{ name, confidence }>>` enrichment contract.
- Per-post topic extraction inside `enrichPost()` with upsert semantics and removal of prior topics for the post.
- A scheduled `TopicClusteringRefresh` worker limited to posts from the last 7 days.
- A rate-limited, Platform-Admin triggered full backfill action.
- Tenant curation endpoints: `GET /v1/topics`, `POST /v1/topics/:id/rename`, `POST /v1/topics/:id/merge`, `POST /v1/topics/:id/hide`.
- `selectedTopic` query parameter support on `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution`.
- **Out of scope:** - Hierarchical or parent/child topic relationships.
- Automatic near-duplicate topic detection or auto-merge jobs.
- UI color, icon, or other visual styling metadata for topics.
- Cross-tenant, platform-wide topic sharing.
- Automatic backfilling of `TopicDailyCount` history after a merge.
- **Assumptions and constraints:** - Azure OpenAI / `AIProviderConnector` is already available for structured-output extraction.
- The existing `social_posts` and `enrichment` pipeline can call `extractTopics` with acceptable latency.
- Tenants own and curate their own topic catalogs; topic labels may be AI-suggested and user-refined.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Topic clustering needs a durable, queryable representation
`docs/product-research/feature-designs/04-ai-topic-clustering.md` describes AI topic clustering. The current `enrichment` JSONB stores topics, but a separate `post_topics` table and `topics` catalog are needed for fast filtering, aggregation, and UI selection.

### 2. Dashboards need a `selectedTopic` filter
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and `docs/product-research/feature-designs/25-topic-evolution-timeline.md` require a `selectedTopic` filter. This needs a stable `topic_id` and `topic_name`.

### 3. Human overrides and merge/rename are future needs
The schema must support user-driven topic merge, rename, and hide so that the AI-generated topics can be curated over time.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make AI-generated topics queryable and filterable across the platform | Users can filter posts, dashboards, and topic-evolution views by a stable `selectedTopic` with sub-second response times |
| 2 | Reduce manual taxonomy maintenance | Tenant admins can rename, merge, or hide noisy topics without engineering support |
| 3 | Unblock dashboard and topic-evolution features | `selectedTopic` is accepted by `GET /v1/dashboards/widgets` and `GET /v1/topics/evolution` |
| 4 | Keep AI-processing costs bounded | Refresh is limited to a 7-day rolling window; full backfill is a rate-limited Platform-Admin action |
| 5 | Preserve multi-tenant data isolation | All `topics` and `post_topics` rows are tenant-scoped and protected by RLS |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

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

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.7 | backend engineer | `topics`, `post_topics`, and topic curation endpoints, | topics are queryable, curatable, and dashboard-filterable. | `topics` and `post_topics` tables with tenant RLS.; `enrichPost()` creates/updates `post_topics` and `topics` rows.; `TopicClusteringRefresh` worker re-runs the last 7 days on a schedule. |
| 12.8 | `Tenant-Admin` | a topic list where I can rename, merge, or hide topics and a `selectedTopic` filter on the dashboard, | the topic catalog stays clean and I can focus dashboards on one topic. | `TopicsView` lists topics with rename, merge, and hide actions.; `TopicSelector` is added to the dashboard header.; `selectedTopic` is persisted in the URL for deep linking. |

### 6.3 Workflow Diagrams / Steps

### 1. New `topics` catalog and `post_topics` junction
```sql
topics (
  id uuid,
  tenant_id uuid,
  name text,
  slug text,
  description text,
  status text,                -- 'active' | 'merged' | 'hidden'
  merged_into_topic_id uuid,  -- if merged
  created_at timestamptz,
  updated_at timestamptz
);

post_topics (
  post_id uuid,
  topic_id uuid,
  tenant_id uuid,
  confidence number,          // 0.0–1.0
  extracted_at timestamptz
);
```

- `topics` is tenant-scoped. `tenant_id` is the RLS key.
- `post_topics` is a junction with confidence.
- Primary key on `post_topics` is `(post_id, topic_id)`.

### 2. Enrichment contract
- `AIProviderConnector.extractTopics(text: string): Promise<Array<{ name: string; confidence: number }>>`.
- The result is normalized: each topic `name` is matched or created in `topics`.
- `post_topics` is upserted; old topics for the post are removed before upsert.

### 3. Refresh and backfill
- New posts are clustered during `enrichPost()`.
- A scheduled `TopicClusteringRefresh` worker re-runs clustering for posts in the last 7 days that have not been clustered or for which the model has changed.
- A full backfill is a Platform-Admin action and is rate-limited.

### 4. Topic curation endpoints
```
GET    /v1/topics
POST   /v1/topics/:id/rename
POST   /v1/topics/:id/merge
POST   /v1/topics/:id/hide
```

- `rename` updates `name` and `slug`.
- `merge` sets `status='merged'` and `merged_into_topic_id`. `post_topics` rows pointing to the merged topic are updated to the target.
- `hide` sets `status='hidden'`. Hidden topics do not appear in `GET /v1/topics` by default.

### 5. `selectedTopic` filter
- `GET /v1/dashboards/widgets?selectedTopic=<topicId>` and `GET /v1/topics/evolution?topicId=<topicId>` filter to the topic.
- The UI shows the topic selector in the dashboard header.
- `selectedTopic` is preserved in deep links and the URL query string.

### 6. `TopicDailyCount` integration
- `TopicDailyCount` (ADR-0087) counts per `topic_id`.
- On merge, historical `TopicDailyCount` rows are not backfilled automatically; the new topic starts from the merge date.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. New `topics` catalog and `post_topics` junction
```sql
topics (
  id uuid,
  tenant_id uuid,
  name text,
  slug text,
  description text,
  status text,                -- 'active' | 'merged' | 'hidden'
  merged_into_topic_id uuid,  -- if merged
  created_at timestamptz,
  updated_at timestamptz
);

post_topics (
  post_id uuid,
  topic_id uuid,
  tenant_id uuid,
  confidence number,          // 0.0–1.0
  extracted_at timestamptz
);
```

- `topics` is tenant-scoped. `tenant_id` is the RLS key.
- `post_topics` is a junction with confidence.
- Primary key on `post_topics` is `(post_id, topic_id)`.

### 2. Enrichment contract
- `AIProviderConnector.extractTopics(text: string): Promise<Array<{ name: string; confidence: number }>>`.
- The result is normalized: each topic `name` is matched or created in `topics`.
- `post_topics` is upserted; old topics for the post are removed before upsert.

### 3. Refresh and backfill
- New posts are clustered during `enrichPost()`.
- A scheduled `TopicClusteringRefresh` worker re-runs clustering for posts in the last 7 days that have not been clustered or for which the model has changed.
- A full backfill is a Platform-Admin action and is rate-limited.

### 4. Topic curation endpoints
```
GET    /v1/topics
POST   /v1/topics/:id/rename
POST   /v1/topics/:id/merge
POST   /v1/topics/:id/hide
```

- `rename` updates `name` and `slug`.
- `merge` sets `status='merged'` and `merged_into_topic_id`. `post_topics` rows pointing to the merged topic are updated to the target.
- `hide` sets `status='hidden'`. Hidden topics do not appear in `GET /v1/topics` by default.

### 5. `selectedTopic` filter
- `GET /v1/dashboards/widgets?selectedTopic=<topicId>` and `GET /v1/topics/evolution?topicId=<topicId>` filter to the topic.
- The UI shows the topic selector in the dashboard header.
- `selectedTopic` is preserved in deep links and the URL query string.

### 6. `TopicDailyCount` integration
- `TopicDailyCount` (ADR-0087) counts per `topic_id`.
- On merge, historical `TopicDailyCount` rows are not backfilled automatically; the new topic starts from the merge date.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All `topics` and `post_topics` queries enforce `tenant_id` RLS and never return cross-tenant data | Security | Must | Contract tests prove isolation for every endpoint and SQL path |
| NFR-002 | `GET /v1/topics` and `GET /v1/dashboards/widgets?selectedTopic=...` respond in under 500 ms for a tenant with 1M posts | Performance | Should | Measured in staging with p95 latency |
| NFR-003 | Topic extraction completes within the existing `enrichPost()` latency budget | Performance | Should | Measured in production over 30 days |
| NFR-004 | The 7-day refresh worker must be safe to rerun and idempotent | Reliability | Must | Duplicate runs do not create duplicate `post_topics` rows |
| NFR-005 | The enrichment contract returns deterministic, deterministic-JSON-shaped results | Maintainability | Must | JSON schema validation in contract tests |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Full backfill is expensive and could exhaust AI budget | Medium | High | Limit routine refresh to 7 days; require Platform-Admin trigger and rate limiting for full backfill | Product Owner |
| R-002 | Topic labels drift over time, causing inconsistent filters | Medium | Medium | Use stable `topic_id`; support merge/rename to manage drift | Product Owner |
| R-003 | Duplicate or near-duplicate topics clutter the catalog | Medium | Medium | Provide merge/hide tools; consider future auto-merge job | Product Owner |
| R-004 | Merged topics create broken historical counts | Low | Medium | Accept that `TopicDailyCount` is not backfilled automatically on merge; document the merge-date boundary | Product Owner |
| R-005 | RLS misconfiguration exposes topics across tenants | Low | High | Enforce `tenant_id` in every query; contract tests must verify isolation | Tech Lead |

---

---

## 12. Assumptions and Dependencies

- Azure OpenAI / `AIProviderConnector` is already available for structured-output extraction.
- The existing `social_posts` and `enrichment` pipeline can call `extractTopics` with acceptable latency.
- Tenants own and curate their own topic catalogs; topic labels may be AI-suggested and user-refined.

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

---

## 13. Open Questions

- How many topics should a single post be associated with? 1? 3? Up to the confidence threshold?
- Should the AI provider return hierarchical topics (parent/child) or flat labels?
- How are near-duplicate topics detected? Is it manual merge only, or an auto-merge job?
- Should `topics` support a `color` or `icon` for UI display?

---

---

## 14. Appendix

### Reference Documents

- ADR-0104: `docs/adr/0104-ai-topic-clustering-post-topics-schema.md`
- BRD-0104: `docs/project docs/Business-Requirements/BRD-0104-AI-Topic-Clustering-Post-Topics-Schema.md`
- Feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Feature design: `docs/product-research/feature-designs/08-dashboards-and-analytics.md`
- Feature design: `docs/product-research/feature-designs/25-topic-evolution-timeline.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0104 and BRD-0104. |