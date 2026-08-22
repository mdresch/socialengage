---
status: high-level
source: docs/product-research/feature-designs.md
created: 2026-08-22
---

# AI topic clustering

### What it is
Automatically grouping related mentions into emergent themes or topics without requiring the user to pre-define every keyword.

### End-user benefits
- **Discover unknown unknowns:** a new complaint, competitor narrative, or product issue surfaces automatically.
- **Reduce manual taxonomy work:** the system suggests topics rather than forcing the user to maintain lists.
- **Better reporting:** topics can be used as filter dimensions across the analytics dashboard.

### Core details
- Topic clustering can be added as an enrichment step or a scheduled aggregation.
- Inputs: `body_markdown`, `enrichment` JSONB, `published_at`, `provider_id`.
- Outputs: a new `post_topics` or `topic` dimension stored in `enrichment`, plus a `TopicCoverage` widget on the dashboard.

### Implementation complexity
**Medium.** Azure OpenAI is already wired in; a `topic` enrichment model could be added to `enrichPost()` without a schema migration. The heavier work is the UI: surfacing clusters, letting users rename/merge them, and integrating the `selectedTopic` filter.

### Growth and reach
Topic clustering turns the product from reactive search into proactive discovery. That is the difference between a monitoring tool and a market-intelligence tool.

---

## Technical design

- **Data flow:** ingest/refresh of `social_posts` → batch or streaming clustering over `body_markdown` + `enrichment` (entities, key phrases) → `AIProviderConnector` with a structured-output prompt returns topic labels and confidence → results stored in `social_posts.enrichment.topics` and optionally a `post_topics` junction → dashboard `TopicCoverage` widget consumes the derived data.
- **Component interactions:** clustering can run inside `enrichPost()` for simplicity or as a scheduled aggregation using `pg_cron` (ADR-0009/Story 4.2 style) for large backfills. `AuthorTopicSignal` refresh already demonstrates the scheduled refresh pattern.
- **REST/Service Bus contracts:** `GET /v1/posts?topic=X` and `GET /v1/topics` endpoints; `SocialPostIngestedEvent` can trigger async cluster update.
- **Storage:** v1 can store topic labels in `enrichment` JSONB; v2 may need a normalized `topics` table and `post_topics` join for stable IDs and human curation.
- **Security considerations:** RLS inherited from `social_posts`; clustering prompt must not include tenant-level metadata that could leak across tenants.

## Backend principles

- **Reuse `AIProviderConnector`.** Topic clustering is just another enrichment model with a JSON-schema-constrained output (already proven by Azure OpenAI connector).
- **Avoid premature aggregation tables.** ADR-0008 explicitly defers topic-time-series tables. v1 should not build `TopicDailyCount`; JSONB is sufficient.
- **Postgres + RLS.** Any new `topics`/`post_topics` tables must be `tenant_id`-scoped and protected by RLS. Keep the same pattern as `post_watchlist_matches`.
- **Contract-test targets.** Verify that the same post always maps to the same set of canonical topics, that clustering handles multi-language input, and that dashboard filters return only tenant-scoped posts.

## Frontend / UI principles

- **User flow:** dashboard shows auto-generated topic cards → user clicks a topic to filter posts → can rename/merge topics for their tenant → topics become persistent filters.
- **Component hierarchy:** `TopicCloud` (dashboard) → `TopicFilter` (feed) → `TopicDetailPanel` (posts + rename/merge).
- **State management:** Client-side topic cache; server-side list of curated topics per tenant; merge is a tenant-scoped mutation.
- **Accessibility and responsive design:** Topic cards have clear labels and counts; rename input has visible focus; topic filter is a collapsible sidebar on mobile.

## Open questions

- Online clustering on every `enrichPost()` vs. nightly batch job over the corpus?
- How many topics should the model emit per post, and how do we avoid noisy/duplicated topics?
- Do we let tenants define a custom taxonomy or only AI-suggested clusters?
- Should `post_topics` be a real junction table from the start, or is JSONB enough?
- How do we evaluate cluster quality and drift over time?

## Research-based recommendations

| Open question | Recommendation | Evidence |
|---|---|---|
| **Online vs. nightly batch clustering?** | Use a **hybrid**: run a lightweight, per-post topic label/embedding on `enrichPost()` for immediate filtering, and a **nightly batch job** for corpus-wide consolidation and taxonomy discovery. QuestionPro reports its *Discover* pre-defined taxonomy is ~50 ms per doc, while its *AI Topics* auto-discovery takes hours. | QuestionPro's blog describes the move from manual topic curation to AI-powered discovery; fast per-doc inference vs. batch corpus discovery is a common split. |
| **Number of topics per post and noise?** | Cap at **1–3 topics per post** with a confidence threshold, and run a **merge/re-split pass** over the whole corpus nightly. Use HDBSCAN-style density clustering and BERTopic labels; discard or flag low-coherence clusters. | Myra Labs and Microsoft taxonomy work describe bottom-up clustering followed by iterative merge/split. Agentic Clustering research shows multi-agent refinement of clusters. CTC metrics catch meaningless topics. |
| **Custom taxonomy or AI-only?** | **Both**. AI-suggested clusters by default, with an optional `custom_taxonomy` seed list that the model uses as guardrails. QuestionPro supports an `available_taxonomy` where predefined topics are classified using the same extraction methods. | QuestionPro's `available_taxonomy` and Myra Labs' custom taxonomies show the hybrid model: AI plus a tenant's own framework. Microsoft describes top-down (predefined) and bottom-up (data-driven) pipelines. |
| **`post_topics` table vs. JSONB?** | Start with **JSONB** in `social_posts.enrichment` for v1. Introduce a real `post_topics` junction table only when topics become user-curable and stable enough to require foreign keys and merge history. | ADR-0008 already defers aggregation/time-series tables. Topic clusters in v1 are derived/AI-generated and fit JSONB; normalized tables are needed for curation. |
| **Evaluate quality and drift?** | Combine **topic coherence, diversity, and LLM-based CTC (Contextualized Topic Coherence)** with a small periodic human-judgment sample. Track topic-word distribution drift over time. | ACL 2024 dynamic topic model paper proposes temporal consistency + quality. Other work shows CTC better reflects human judgment, and purpose-oriented LLM metrics catch redundancy and drift. |

### Sources consulted

- QuestionPro: AI-Powered Topic Analysis — https://www.questionpro.com/engineering/ai/machine%20learning/nlp/text%20analysis/journey-building-smarter-topic-analysis/
- Myra Labs: AI and Custom Taxonomies — https://www.myralabs.com/automating-topic-clusters-using-ai-and-custom-taxonomies/
- Microsoft: Taxonomies from unstructured text with LLMs — https://medium.com/data-science-at-microsoft/from-chaos-to-clarity-building-taxonomies-from-unstructured-text-using-large-language-models-c1303db3adb1
- Agentic Clustering: Multi-Agent Refinement — https://arxiv.org/html/2606.01255v1
- Evaluating Dynamic Topic Models (ACL 2024) — https://aclanthology.org/2024.acl-long.11/
- Purpose-Oriented Topic Model Evaluation — https://doi.org/10.1007/s00799-025-00429-5
- Thematic Coherence in Microblogs — https://aclanthology.org/2021.acl-long.530/
- Topic Model Quality Metrics review — https://link.springer.com/article/10.1186/s12911-023-02216-1
- Contextualized Topic Coherence — https://aclanthology.org/2024.findings-eacl.123/

## Persona acceptance

- **Topic-Center-Analyst (primary):** can explore topics with human-readable labels, view related authors and posts, and compare a topic across time periods.
- **Tenant-Brand-Reputation-Manager (primary):** can see emerging reputation-related topics, receive alerts on topic spikes, and drill into the representative posts.
- **Social-Selling-Strategist (primary):** can use AI-suggested topics to identify commercial-intent conversations and relevant authors.
- **Tenant-Business-Analyst (secondary):** can export topic-label distributions and use them as dimensions in reporting.
- **Tenant-User (secondary):** can filter the post feed by a topic and see a short explanation of why a post belongs to it.

## AI enhancements

- **Generative topic labels:** cluster names are human-readable summaries rather than raw keywords.
- **Trend and anomaly detection:** the AI flags emerging clusters and unusual spikes automatically.
- **Merge/rename suggestions:** the UI can recommend that two AI-generated topics are actually the same.
- **Topic drift tracking:** detect when the meaning of a topic changes over time.
