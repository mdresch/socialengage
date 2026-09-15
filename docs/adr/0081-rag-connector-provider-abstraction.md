# ADR-0081: RAGConnector provider abstraction

**Status:** Accepted (2026-08-25). Originally Proposed 2026-08-23; revised 2026-08-25 per architectural review ("Accept with minor revisions") — added `content`/`RAGFilter`/`RAGSearchOptions`/`RAGSearchResult` to the interface, vector ID scheme, batching responsibility, hybrid-search/score-threshold options, and resolved all four open questions (Decisions §3, §7–§13). Accepted the same day by the Business Sponsor / Product Owner / Technical Lead following the review verdict "Approved / Ready to Merge."

**Authorizes:** a `RAGConnector` interface that abstracts vector-store operations, allowing the platform to support Pinecone, Azure AI Search, pgvector, and other vector databases without leaking provider-specific code into the ingestion, search, or UI layers.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Semantic search needs a dedicated vector index
`docs/product-research/feature-designs/28-semantic-search-rag.md` describes a tenant-scoped, vector-backed semantic search layer. Posts are chunked, embedded, and upserted into a vector database. The choice of vector store (Pinecone, Azure AI Search, pgvector) has operational, cost, and latency implications that should not be baked into the rest of the system.

### 2. The project already uses connector abstractions
`ADR-0002` (`AIProviderConnector`) and the `SocialConnector` / `ProviderConnector` framework established a pattern: an interface, a registry, and per-provider implementations. A `RAGConnector` follows the same pattern.

### 3. Tenant isolation is non-negotiable
Vector stores often use a flat namespace per index. Multi-tenant data must be filtered at query time by `tenant_id` metadata. The abstraction must make this boundary explicit and impossible to bypass.

---

## Decision

### 1. New `RAGConnector` interface
```ts
interface RAGConnector {
  id: string;
  upsert(
    tenantId: string,
    vectors: Array<{ id: string; values: number[]; metadata: RAGChunkMetadata }>
  ): Promise<void>;
  search(
    tenantId: string,
    query: number[],
    options: RAGSearchOptions
  ): Promise<RAGSearchResult[]>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<ConnectorStatus>;
}

interface RAGChunkMetadata {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  content: string;               // chunk text payload, enables direct RAG generation without a secondary SQL lookup
  platform_id: string;
  published_at: string;
  watchlist_ids?: string[];
  sentiment?: string;
  topics?: string[];
}

interface RAGFilter {
  platformId?: string | string[];
  sentiment?: string | string[];
  watchlistIds?: string[];
  topics?: string[];
  dateRange?: { from?: string; to?: string };
}

interface RAGSearchOptions {
  topK: number;
  filter?: RAGFilter;
  textQuery?: string;            // enables hybrid search (dense vector + sparse/lexical) where the provider supports it
  minScore?: number;             // score threshold cutoff; results below this score are dropped
}

interface RAGSearchResult {
  id: string;
  score: number;
  metadata: RAGChunkMetadata;
}
```

`RAGFilter` is a canonical, provider-agnostic filter shape. Each connector implementation is responsible for translating it into the vendor's native filter syntax (e.g. Pinecone Mongo-style operators, Azure AI Search OData `$filter`, pgvector SQL `WHERE`). The connector must strictly merge `tenant_id` into the filter internally — `tenant_id` is never a field the caller supplies via `RAGFilter`; it comes from the mandatory `tenantId` parameter.

### 2. Tenant isolation via metadata filters
Every `search()` implementation must include `tenant_id` as a mandatory equality filter. There is no shared, unfiltered index for all tenants. Namespace or index separation is provider-specific but the contract requires a metadata filter.

### 3. Initial provider set and v1 default
v1 supports **one** active provider, chosen at platform deployment time:
- **pgvector** — the **v1 default** for this project. The platform already runs on Azure Postgres with RLS (ADR-0015), so pgvector adds zero external infrastructure and keeps vector data co-located with `social_posts`. Best fit for a solo, self-funded, low-scale deployment.
- **Pinecone Serverless** — documented managed-cloud alternative if operational simplicity and minimal setup overhead later take priority over infrastructure cost.
- **Azure AI Search** — native Azure, supports vector + text hybrid; remains a supported option via the same interface.

The abstraction allows more providers to be added without changing `RAGChunkingService` or `RAGSearchService`.

### 4. Vector records are derived, not primary
`RAGConnector` stores chunks and embeddings. The source of truth remains `social_posts`. The vector index can be rebuilt from `social_posts` and `rag_chunks_sync`.

### 5. Configuration lives with credentials
Vector store credentials and index/endpoint names are stored in the existing `platform_credentials` envelope (ADR-0028) with `credential_type = 'rag'`. This keeps credential handling consistent with other connectors.

### 6. Async status and health
`status()` returns indexing lag, chunk count, and any store-level errors. It feeds the `RAGSearchService` and, in v2, the Platform Operations Dashboard.

### 7. Deterministic vector ID scheme
A single `social_post` produces multiple chunks (e.g. `chunk_index` 0..N). Vector record ids are deterministic and follow the convention:

```
Vector ID = `${tenantId}:${postId}:${chunkIndex}`
```

This makes `deletePost(tenantId, postId)` a predictable id-range delete (`${tenantId}:${postId}:0` through `${tenantId}:${postId}:N`) where the provider supports it, and a metadata-filter delete (`post_id == postId` AND `tenant_id == tenantId`) otherwise. `deleteTenant(tenantId)` is a metadata-filter delete on `tenant_id`. The deterministic id scheme also makes re-indexing idempotent — re-upserting the same post overwrites the same vector ids rather than creating duplicates.

### 8. Chunk batching is the connector implementation's responsibility
Vector-store APIs have strict payload/batch limits (e.g. Pinecone 2 MB/batch, Azure AI Search batch-size limits). The `RAGConnector` implementation is responsible for splitting the `vectors` array it receives into provider-safe batches internally. Callers (`RAGChunkingService`) pass the full per-post chunk set and do not need to know the provider's batch limits. This keeps the batching concern inside the provider boundary, not the caller.

### 9. Chunk text stored in metadata (`content`)
`RAGChunkMetadata.content` carries the chunk text payload alongside the embedding. This lets `search()` return the text snippet directly in `RAGSearchResult.metadata.content`, so downstream RAG generation (Q&A answers, daily-digest summaries) does not need a secondary SQL lookup to `social_posts`/`rag_chunks_sync` to retrieve the chunk text. Most vector databases (Pinecone, Azure AI Search, pgvector) efficiently store payload text alongside embeddings. `social_posts` remains the source of truth — `content` is a derived copy used for retrieval convenience, and the index remains rebuildable from `social_posts`.

### 10. Hybrid search and score threshold
`RAGSearchOptions.textQuery` enables hybrid search (dense vector + sparse/lexical BM25) where the provider supports it (Azure AI Search, modern Pinecone tiers). Providers without hybrid support ignore `textQuery` and perform dense-only search. `RAGSearchOptions.minScore` is an optional score threshold; results below it are dropped before returning. Both are optional and do not change the interface for providers that do not support them.

### 11. Isolation model: shared index with mandatory metadata filtering
The v1 isolation model is a **shared index with mandatory `tenant_id` metadata filtering** on every query. Not all vector databases support unlimited namespaces, so standardizing on metadata filtering ensures compatibility across all providers. Namespace-per-tenant separation (where the provider supports it, e.g. Pinecone) may be used as an internal connector optimization on top of the mandatory metadata filter, but the contract requires the metadata filter regardless.

### 12. Vector dimension is connector configuration
The embedding vector dimension is specified in connector configuration (e.g. 1536 for OpenAI `text-embedding-3-small` / standard models), not hardcoded in the interface. Index creation must match the chosen embedding model's dimension. Different providers/models have different dimensions; keeping it in configuration allows swapping embedding models without changing the `RAGConnector` interface.

### 13. Dedicated `ragConnectorRegistry.ts`
`RAGConnector` instances are instantiated by a **dedicated `ragConnectorRegistry.ts`**, not by extending the existing `ProviderConnector` registry. Vector stores have fundamentally different lifecycles, configuration fields, and connection semantics compared to social-media API connectors. A dedicated registry keeps the two concerns cleanly separated while still following the same interface/registry/implementation pattern established by ADR-0002.

---

## Consequences

1. **Provider portability:** the platform is not locked into a single vector store.
2. **Consistent credential handling:** `RAGConnector` uses the same envelope and ownership tiers as `SocialConnector` and `AIProviderConnector`.
3. **Tenant isolation by contract:** the interface makes `tenant_id` a required parameter for every operation.
4. **One more runtime dependency:** the platform needs a real vector-store account, but only one provider is required (pgvector reuses the existing Postgres instance, so no new external account is needed for the v1 default).
5. **Foundation for downstream features:** `28-semantic-search-rag`, `24-daily-digest-email`, `22-metric-explainability`, and `25-topic-evolution-timeline` can all build on this interface.
6. **Chunk text in metadata:** storing `content` in `RAGChunkMetadata` increases per-record payload size but eliminates a secondary SQL lookup for RAG generation; the index remains a derived, rebuildable view over `social_posts`.
7. **Deterministic vector ids:** the `${tenantId}:${postId}:${chunkIndex}` convention makes deletes predictable and re-indexing idempotent, at the cost of requiring all implementations to follow the same id scheme.
8. **Provider-agnostic filter translation:** each connector implementation owns the translation of `RAGFilter` to vendor-native syntax, keeping provider leakage out of callers.

---

## Alternatives considered

1. **Pick one provider and hardcode it.**
   - *Rejected:* it locks the platform to a single vendor and makes future migrations expensive. The project already uses `AIProviderConnector` for exactly this reason.

2. **Use Postgres full-text search instead of a vector store.**
   - *Rejected:* full-text search does not support semantic meaning or natural-language Q&A. It is a useful complement, not a replacement.

3. **Store vectors inside `social_posts.enrichment` JSONB.**
   - *Rejected:* it would make vector search a full-table scan with no ANN index and no tenant-scoped similarity search. A dedicated vector index is required for performance.

---

## Resolved questions (previously open, resolved per architectural review 2026-08-25)

- **v1 default provider:** pgvector — zero external infrastructure on the existing Azure Postgres stack; best fit for a solo, self-funded, low-scale deployment. Pinecone Serverless remains the documented managed-cloud alternative. (See Decision §3.)
- **Namespace vs. metadata isolation:** shared index with mandatory `tenant_id` metadata filtering; namespace-per-tenant may be used as an internal optimization where supported. (See Decision §11.)
- **Vector dimension:** specified in connector configuration, matched to the chosen embedding model at index-creation time; not hardcoded in the interface. (See Decision §12.)
- **Registry pattern:** dedicated `ragConnectorRegistry.ts`, separate from the `ProviderConnector` registry. (See Decision §13.)

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0028` (credential ownership tiers), `ADR-0015` (tenant RLS)

### Pending supersession note (2026-08-28)

If ADR-0136 (Proposed, 2026-08-28) is accepted, this ADR's decision would be superseded/refined by ADR-0136's own terms — specifically shifting vector store multi-tenancy from shared-index metadata filtering to physical namespace/shard-per-tenant isolation (Pinecone/Weaviate) and database-enforced Row-Level Security (pgvector). This is a pending note only: ADR-0136 is currently Proposed, not accepted.

### Supersession update (2026-09-14, Story 19.3)

ADR-0136 was Accepted 2026-08-28 and its Decision §11 supersession (noted above) is now real, not pending: Story 19.1 (`social-listening-core@8962e1d`) shipped `PgvectorRAGConnector`'s RLS-based tenant isolation exactly as ADR-0136 decided. This ADR's own Decision §11 (shared-index metadata filtering as the primary isolation mechanism) is superseded in full by ADR-0136 Decision §2, per that ADR's own "Relation to ADR-0081" section. Found and corrected while drafting ADR-0138 (Story 19.3), which cross-references this note.