# ADR-0104: AI topic clustering post-topics schema

**Status:** Proposed (2026-08-23)

**Authorizes:** a `post_topics` many-to-many table, `topics` catalog, and `TopicClusteringService` refresh contract for AI-driven topic clustering, plus the `selectedTopic` dashboard filter.

**Source:** `docs/product-research/feature-designs/04-ai-topic-clustering.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Topic clustering needs a durable, queryable representation
`docs/product-research/feature-designs/04-ai-topic-clustering.md` describes AI topic clustering. The current `enrichment` JSONB stores topics, but a separate `post_topics` table and `topics` catalog are needed for fast filtering, aggregation, and UI selection.

### 2. Dashboards need a `selectedTopic` filter
`docs/product-research/feature-designs/08-dashboards-and-analytics.md` and `docs/product-research/feature-designs/25-topic-evolution-timeline.md` require a `selectedTopic` filter. This needs a stable `topic_id` and `topic_name`.

### 3. Human overrides and merge/rename are future needs
The schema must support user-driven topic merge, rename, and hide so that the AI-generated topics can be curated over time.

---

## Decision

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

## Consequences

1. **Queryable topics:** `post_topics` and `topics` make filtering and aggregation fast.
2. **Curation over time:** users can merge, rename, and hide topics to keep the catalog clean.
3. **Foundation for dashboards:** `selectedTopic` unblocks `08-dashboards` and `25-topic-evolution`.
4. **Clustering cost:** a full backfill is expensive; the refresh worker is limited to a 7-day rolling window.

---

## Alternatives considered

1. **Store topics only in `enrichment` JSONB.**
   - *Rejected:* it makes filtering and aggregation slow. A `post_topics` junction is needed for performance.

2. **Use the cluster label as the primary key.**
   - *Rejected:* a string label is not stable across renames and merges. A UUID `id` is the canonical key.

3. **Global, platform-wide topics shared across tenants.**
   - *Rejected:* topics are tenant-specific. Cross-tenant topic sharing would violate RLS and data-sovereignty principles.

---

## Open questions

- How many topics should a single post be associated with? 1? 3? Up to the confidence threshold?
- Should the AI provider return hierarchical topics (parent/child) or flat labels?
- How are near-duplicate topics detected? Is it manual merge only, or an auto-merge job?
- Should `topics` support a `color` or `icon` for UI display?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/04-ai-topic-clustering.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0087` (precomputed topic counts), `ADR-0084` (RAG topic search), `ADR-0078` (metric explainability), `ADR-0002` (`AIProviderConnector`)
