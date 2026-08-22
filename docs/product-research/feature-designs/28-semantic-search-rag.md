---
status: high-level
source: user request / Performance-Review-Agent-Stakeholder-Profile.md
created: 2026-08-23
---

# Semantic search with RAG

### What it is

A tenant-scoped, vector-backed semantic search layer that lets users search and ask questions across the full text of ingested posts. Posts are chunked, embedded, and upserted into a vector database. A `RAGConnector` abstraction allows the platform to use Pinecone, Azure AI Search, pgvector, or another vector store while keeping the rest of the system provider-agnostic.

### End-user benefits

- **Conversational search:** users can ask natural-language questions like “What are people saying about the latest product launch?” and get grounded answers.
- **Find meaning, not keywords:** semantic search surfaces conceptually related posts even when they don’t use the same words as the query.
- **Better AI outputs:** RAG retrieval gives the AI provider context from real tenant posts, reducing hallucinations for summarization, explanation, and recommendation features.
- **Fast lookup at scale:** a dedicated vector index is faster and cheaper than full-text scans for large post volumes.

### Core details

- After a post is persisted and normalized, a `RAGChunker` splits `body_markdown` and enrichment metadata into overlapping chunks.
- An `AIProviderConnector.embed()` call (or a dedicated embedding model) produces vectors for each chunk.
- The `RAGStore` (e.g., Pinecone) stores each chunk as a vector record with metadata: `tenant_id`, `post_id`, `chunk_index`, `provider_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`.
- Search is done through `POST /v1/rag/search` with a natural-language `query` and optional filters (`watchlistId`, `provider`, `dateRange`, `topic`).
- The response returns the top-N matching chunks plus references to the original `social_posts` rows.
- RAG results can feed `22-metric-explainability.md`, `25-topic-evolution-timeline.md`, `24-daily-digest-email.md`, and the Polypost Composer mention-suggestions feature.

### Implementation complexity

**High.** Requires a new `RAGConnector` framework, chunking logic, an embedding pipeline, a vector store integration, tenant-scoped RLS, and RAG-aware UI/UX. The heavy part is cost management, latency, and keeping embeddings in sync with post updates and retention.

### Growth and reach

A long-term differentiator. Semantic search changes the product from keyword search to a knowledge layer over public conversation. It is the foundation for future natural-language analytics and AI assistants.

---

## Technical design

- **Data flow:** a post is ingested and normalized → `enrichPost()` runs sentiment and topics → `RAGChunker.split(post)` creates chunks → `AIProviderConnector.embed(chunks)` returns vectors → `RAGStore.upsert(tenantId, chunks, vectors, metadata)` writes to the vector index.
- **Component interactions:** `ingestion worker` → `RAGChunkingService` → `AIProviderConnector.embed()` → `RAGStore` (Pinecone / Azure AI Search / pgvector) → `RAGSearchService` → `GET /v1/posts/:id` for original source.
- **REST/Service Bus contracts:** `POST /v1/rag/search`, `POST /v1/rag/ask` for natural-language Q&A, `GET /v1/rag/status` to show index health. `SocialPostIngestedEvent` (or a dedicated `RAGIndexRequestedEvent` in v2) triggers async indexing.
- **Storage:** vector records live in the configured `RAGStore`; the system still uses `social_posts` as the source of truth. A `rag_chunks_sync` table tracks `post_id`, `last_indexed_at`, `chunk_count`, and `store_id` per tenant.
- **Security considerations:** Tenant isolation is enforced by `tenant_id` metadata filters on every vector query. No PII beyond public post content is indexed. Embeddings and metadata are encrypted at rest. Deletion/offboarding must also delete the tenant’s vectors.

## Backend principles

- **Pluggable vector store.** A `RAGConnector` interface with `upsert()`, `search()`, `deleteTenant()`, `deletePost()`, and `status()` lets the platform swap Pinecone for Azure AI Search or pgvector without touching the business logic.
- **Chunking first.** A post is too coarse for useful retrieval; chunking with overlap is required.
- **Async and best-effort by default.** RAG indexing runs after ingestion, not as a blocking step. Failures are retried but do not block the main pipeline.
- **Source of truth remains `social_posts`.** The vector store is a derived index; it can be rebuilt from the source table.
- **Cost-aware defaults.** Default chunk size and top-k are bounded; vector dimensions and embedding calls are metered per tenant.

## Frontend / UI principles

- **User flow:** user types a natural-language query in the post feed or a dedicated “Ask” search box → sees ranked post excerpts with highlighted matching chunks → clicks a result to open the original post.
- **Component hierarchy:** `RAGSearchBox` → `RAGResultsList` → `RAGResultCard` → `PostDetail`. `RAGAsk` wraps the search and a generated answer with citations.
- **State management:** Server state for the search result; local state for filters and the query draft.
- **Accessibility and responsive design:** Search supports keyboard submission; results show clear provenance and excerpts. Mobile view stacks filters above results.
- **Loading pattern:** medium-latency semantic search (300 ms–1.5 s) should use a skeleton list; long “Ask” calls use a progress bar or streaming answer.

## Open questions

- Which vector store should be the v1 default — Pinecone, Azure AI Search, or pgvector?
- Should chunking and embedding be done in-process or by a separate worker/function?
- How do we keep the vector index in sync with `rawPayload` retention (ADR-0018)?
- Should RAG search be scoped to one watchlist, all tenant posts, or a filtered subset?
- How do we prevent a tenant from consuming too many embedding tokens/quota?
- Should the embedding model be the same `AIProviderConnector` used for enrichment, or a dedicated, cheaper embedding model?
- What is the right chunk size and overlap for short social posts vs. long articles?

## AI enhancements

- **Conversational Q&A:** `POST /v1/rag/ask` uses retrieved chunks to ground a generated answer with citations.
- **Smart chunking:** the AI adjusts chunk size and overlap based on post length and structure.
- **Query expansion:** the AI rewrites a vague query into multiple search vectors and merges results.
- **Hyde retrieval:** the AI generates a hypothetical ideal answer and searches for posts similar to that hypothetical text.

## Related ADRs and features that RAG accelerates

RAG is not just a standalone feature. It is an enabling layer that makes several existing and proposed capabilities faster or more accurate.

### ADRs

- **ADR-0076 (Composer Deep Research Agent, Proposed)** — already orchestrates key-phrase extraction, Brave/Bing search, and LLM synthesis. A tenant-scoped RAG layer can pre-embed those search snippets and the tenant’s own posts, so the research endpoint does not re-query the web every time and can ground its summary in the tenant’s corpus.
- **ADR-0065 / ADR-0066 (Brave/Bing Search connectors)** — result snippets from these connectors are ideal RAG chunks. Vectorizing them turns one-off search results into a persistent, queryable tenant research corpus.
- **ADR-0002 (`AIProviderConnector`)** — the same provider abstraction can host `embed()` and `research()` methods, so the RAG embedding step plugs into the existing AI-provider framework.
- **ADR-0007 (`AuthorTopicSignal`)** — vector similarity over author content can augment or replace keyword-based author/topic signals.
- **ADR-0072 / ADR-0073 (Polypost Composer and Composer Assist)** — RAG enables semantic author-mention suggestions and grounded composer-side research without one-off web searches.

### Feature designs

- **`04-ai-topic-clustering.md`** — embeddings are a more robust way to detect emergent topics than keyword co-occurrence.
- **`05-influencer-discovery.md`** — vector similarity over author content finds “similar experts” faster than rule-based scoring.
- **`13-composed-post-author-mention-suggestions.md`** — RAG can suggest authors whose content is semantically close to the composed post.
- **`22-metric-explainability.md`** — explanations can cite the top-N semantically relevant posts instead of only aggregate numbers.
- **`24-daily-digest-email.md`** — RAG-grounded summarization makes the AI summary more factually tied to the tenant’s actual posts.
- **`25-topic-evolution-timeline.md`** — semantic-drift detection is easier when posts and topics have embeddings.
- **`21-ad-hoc-query-endpoint.md`** — `POST /v1/analytics/query` could accept a natural-language query and run a vector search.
- **`08-dashboards-and-analytics.md`** — natural-language Q&A over the tenant corpus becomes possible.
- **`27-preconfigured-analytics-views.md`** — precomputed topic/source counts give RAG search filters and facets; the two features are complementary (views for fast aggregate lookups, RAG for deep semantic drill-down).

## Persona acceptance

- **Tenant-Business-Analyst (primary):** can search posts by meaning, not just keyword, and ask natural-language questions across the data.
- **Topic-Center-Analyst (primary):** can explore conceptually related posts and trends without crafting exact queries.
- **Tenant-Brand-Reputation-Manager (primary):** can discover emerging narratives even when the language is unexpected.
- **Tenant-Reader (secondary):** can use a simple search box that “just understands.”
- **Sole-Operator (secondary):** can see and control embedding costs and index health.
- **Performance Review Agent (secondary):** can review the RAG query latency, embedding quota usage, and vector-store cost.
