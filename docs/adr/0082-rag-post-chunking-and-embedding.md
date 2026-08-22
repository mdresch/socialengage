# ADR-0082: RAG post chunking and embedding pipeline

**Status:** Proposed (2026-08-23)

**Authorizes:** a `RAGChunkingService` that splits normalized posts into overlapping chunks and produces vector embeddings, plus the async indexing pipeline that keeps the vector store in sync with `social_posts`.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. A whole post is too coarse for semantic search
`docs/product-research/feature-designs/28-semantic-search-rag.md` needs a vector-backed search over posts. A single `SocialPost` may contain multiple ideas, topics, or claims. To retrieve the right excerpt for a question, the post must be split into smaller, overlapping chunks before embedding.

### 2. Embeddings must stay in sync with the source of truth
`social_posts` is the source of truth. The vector store is a derived index. When a post is ingested, updated, or deleted, the vector chunks must follow. The pipeline must be async so that an embedding failure never blocks ingestion.

### 3. The project already has `AIProviderConnector`
`ADR-0002` and `ADR-0038` provide a provider-agnostic `AIProviderConnector`. A new `embed()` method on that interface is the natural path. A dedicated, cheaper embedding model is a future alternative.

---

## Decision

### 1. New `RAGChunkingService`
```ts
interface RAGChunkingService {
  split(post: SocialPost): RAGChunk[];
  embed(chunks: RAGChunk[]): Promise<EmbeddedRAGChunk[]>;
}

interface RAGChunk {
  post_id: string;
  chunk_index: number;
  text: string;           // the canonical chunk text
}

interface EmbeddedRAGChunk extends RAGChunk {
  vector: number[];
  metadata: RAGChunkMetadata;   // see ADR-0083
}
```

### 2. Chunking rules
- **Primary input:** `body_markdown`.
- **Chunk size:** 256 tokens by default, with 20% overlap (≈ 51 tokens).
- **Boundary behavior:** prefer paragraph and sentence boundaries; if none exist, split at token count.
- **Minimum chunk size:** 64 tokens. A very short post becomes one chunk.
- **Enrichment metadata is appended** to each chunk's `RAGChunkMetadata` but not to the text that is embedded.

### 3. Embedding contract
- `AIProviderConnector.embed(texts: string[]): Promise<number[][]>` returns one vector per input string.
- v1 uses the same Azure OpenAI model as the rest of `AIProviderConnector`.
- A future ADR may introduce a dedicated, cheaper embedding provider.

### 4. Async indexing trigger
- After `enrichPost()` completes, the ingestion worker emits `RAGIndexRequestedEvent` to a queue.
- `RAGIndexingWorker` consumes the event, calls `RAGChunkingService`, and upserts chunks through `RAGConnector` (ADR-0081).
- Failures are logged and retried with bounded backoff; they do not block the main ingestion pipeline.

### 5. Sync and bookkeeping
- A new `rag_chunks_sync` table tracks `post_id`, `tenant_id`, `last_indexed_at`, `chunk_count`, and `store_id`.
- On post deletion or tenant offboarding, `RAGIndexingWorker` calls `RAGConnector.deletePost()` or `RAGConnector.deleteTenant()`.
- On `rawPayload` retention (ADR-0018), only `social_posts.raw_payload` is removed; the vector chunks remain until the post itself is deleted.

---

## Consequences

1. **Better retrieval quality:** chunking surfaces the right excerpt, not just the whole post.
2. **Async resilience:** an embedding or vector-store outage does not break ingestion.
3. **Reconstructability:** the `rag_chunks_sync` table makes it possible to rebuild the index from `social_posts`.
4. **Embedding cost:** every chunk costs one vector. Short posts still cost one vector; long posts cost several.
5. **Failure mode:** chunks can lag behind the latest posts; `GET /v1/rag/status` (ADR-0084) exposes this lag.

---

## Alternatives considered

1. **Embed the entire post as one vector.**
   - *Rejected:* it loses the ability to retrieve the specific sentence or claim that answers a question.

2. **Pre-compute chunks during the `poll()` call in each `SocialConnector`.**
   - *Rejected:* it pushes RAG logic into every connector. A shared service keeps the architecture consistent.

3. **Synchronous embedding during ingestion.**
   - *Rejected:* it would slow ingestion and make the vector store a hard dependency. Async is safer for a v1 RAG layer.

---

## Open questions

- Should the chunk size be configurable per tenant or per post type?
- Should the embedding model be the same as the generation model, or a dedicated, cheaper `text-embedding-3-small`-style model?
- How are late-arriving `published_at` corrections handled? Do we re-index the whole post or only affected chunks?
- What is the retry policy for an `RAGIndexRequestedEvent` that repeatedly fails?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0081` (`RAGConnector`), `ADR-0083` (RLS and metadata), `ADR-0002` (`AIProviderConnector`), `ADR-0018` (retention)
