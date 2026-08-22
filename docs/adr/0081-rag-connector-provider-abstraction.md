# ADR-0081: RAGConnector provider abstraction

**Status:** Proposed (2026-08-23)

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
    options: { topK: number; filter?: RAGFilter }
  ): Promise<Array<{ id: string; score: number; metadata: RAGChunkMetadata }>>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<ConnectorStatus>;
}

interface RAGChunkMetadata {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  platform_id: string;
  published_at: string;
  watchlist_ids?: string[];
  sentiment?: string;
  topics?: string[];
}
```

### 2. Tenant isolation via metadata filters
Every `search()` implementation must include `tenant_id` as a mandatory equality filter. There is no shared, unfiltered index for all tenants. Namespace or index separation is provider-specific but the contract requires a metadata filter.

### 3. Initial provider set
v1 supports **one** of the following, chosen at platform deployment time:
- **Pinecone** — managed, fast, serverless indexes.
- **Azure AI Search** — native Azure, supports vector + text hybrid.
- **pgvector** — cheapest, keeps data in Postgres, but requires more operational work.

The abstraction allows more providers to be added without changing `RAGChunkingService` or `RAGSearchService`.

### 4. Vector records are derived, not primary
`RAGConnector` stores chunks and embeddings. The source of truth remains `social_posts`. The vector index can be rebuilt from `social_posts` and `rag_chunks_sync`.

### 5. Configuration lives with credentials
Vector store credentials and index/endpoint names are stored in the existing `platform_credentials` envelope (ADR-0028) with `credential_type = 'rag'`. This keeps credential handling consistent with other connectors.

### 6. Async status and health
`status()` returns indexing lag, chunk count, and any store-level errors. It feeds the `RAGSearchService` and, in v2, the Platform Operations Dashboard.

---

## Consequences

1. **Provider portability:** the platform is not locked into a single vector store.
2. **Consistent credential handling:** `RAGConnector` uses the same envelope and ownership tiers as `SocialConnector` and `AIProviderConnector`.
3. **Tenant isolation by contract:** the interface makes `tenant_id` a required parameter for every operation.
4. **One more runtime dependency:** the platform needs a real vector-store account, but only one provider is required.
5. **Foundation for downstream features:** `28-semantic-search-rag`, `24-daily-digest-email`, `22-metric-explainability`, and `25-topic-evolution-timeline` can all build on this interface.

---

## Alternatives considered

1. **Pick one provider and hardcode it.**
   - *Rejected:* it locks the platform to a single vendor and makes future migrations expensive. The project already uses `AIProviderConnector` for exactly this reason.

2. **Use Postgres full-text search instead of a vector store.**
   - *Rejected:* full-text search does not support semantic meaning or natural-language Q&A. It is a useful complement, not a replacement.

3. **Store vectors inside `social_posts.enrichment` JSONB.**
   - *Rejected:* it would make vector search a full-table scan with no ANN index and no tenant-scoped similarity search. A dedicated vector index is required for performance.

---

## Open questions

- Which provider should be the v1 default for this project? (Pinecone for speed, Azure AI Search for Azure-native, or pgvector for cost?)
- Should the vector index be per-tenant, per-tenant-namespace, or shared index with tenant metadata?
- What is the maximum vector dimension supported by the chosen provider?
- How is the `RAGConnector` instantiated — by a new `ragConnectorRegistry.ts` or by extending the existing `ProviderConnector` registry?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0002` (`AIProviderConnector`), `ADR-0028` (credential ownership tiers), `ADR-0015` (tenant RLS)
