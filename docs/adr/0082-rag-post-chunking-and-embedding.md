# ADR-0082: RAG post chunking and embedding pipeline

**Status:** Accepted (2026-08-25). Originally Proposed 2026-08-23; revised 2026-08-25 per architectural review ("Accept with minor revisions") — aligned `RAGChunk.content` with ADR-0081's `RAGChunkMetadata.content`, added `tenant_id` to `RAGChunk` and `tenantId` to `embed()`, clarified `text-embedding-3-small` (1536-dim) as the dedicated embedding deployment, added orphan-chunk cleanup on re-index, added title-prepending and short-post guarantees, expanded `rag_chunks_sync` schema, and resolved all four open questions (Decisions §1–§5). Accepted the same day by the Business Sponsor / Product Owner / Technical Lead following the final review verdict "Approved / Accepted."

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
  embed(tenantId: string, chunks: RAGChunk[]): Promise<EmbeddedRAGChunk[]>;
}

interface RAGChunk {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  content: string;          // the canonical chunk text (named content to match RAGChunkMetadata.content in ADR-0081)
}

interface EmbeddedRAGChunk {
  id: string;               // ${tenantId}:${postId}:${chunkIndex} (ADR-0081 vector ID scheme)
  vector: number[];
  metadata: RAGChunkMetadata;   // see ADR-0083; includes content, tenant_id, post_id, chunk_index, platform_id, published_at, watchlist_ids, sentiment, topics
}
```

- `RAGChunk.content` is named `content` (not `text`) to match `RAGChunkMetadata.content` in ADR-0081, avoiding a property-name mismatch across the two interfaces.
- `RAGChunk` carries `tenant_id` so the chunking service can produce the deterministic vector ID `${tenantId}:${postId}:${chunkIndex}` (ADR-0081) and so `embed()` is explicitly tenant-scoped.
- `embed()` takes `tenantId` explicitly so the embedding call is never ambiguous about which tenant's quota/deployment it runs against.

### 2. Chunking rules
- **Primary input:** `body_markdown`.
- **Chunk size:** 256 tokens by default, with 20% overlap (≈ 51 tokens). Fixed platform default in v1 (not per-tenant configurable — see Resolved Questions).
- **Boundary behavior:** prefer paragraph and sentence boundaries; if none exist, split at token count.
- **Minimum chunk size:** 64 tokens. A very short post becomes one chunk. **Short posts (< 64 tokens) are never discarded** — they are indexed as a single chunk containing the entire post body.
- **Title prepending:** if the post has a title or subject field, prepend `Title: {title}\n\n` to the chunk text before embedding. This gives each chunk the post's title context, improving retrieval quality when the title carries topical information not repeated in the body. The prepended title is part of `content` (and thus stored in `RAGChunkMetadata.content`), but it is not counted toward the 256-token chunk-size target — it is additive.
- **Enrichment metadata is appended** to each chunk's `RAGChunkMetadata` but not to the `content` that is embedded.

### 3. Embedding contract
- `AIProviderConnector.embed(tenantId: string, texts: string[]): Promise<number[][]>` returns one vector per input string, scoped to the caller's tenant.
- v1 uses a **dedicated embedding deployment**, not the chat/generation model. The default is **`text-embedding-3-small`** (1536 dimensions), deployed as a separate Azure OpenAI deployment alongside the existing chat-completion models (e.g., GPT-4o). Chat/generation models do not produce embeddings; a dedicated embedding deployment is required.
- The 1536-dimension vector size is the connector-configuration value referenced by ADR-0081 Decision §12 (vector dimension specified in connector configuration, not hardcoded in the interface).
- A future ADR may introduce a different embedding provider or model; the `embed()` contract abstracts the provider, and `rag_chunks_sync.embedding_model` tracks which model produced each post's vectors so a migration can be detected and re-indexing triggered.

### 4. Async indexing trigger
- After `enrichPost()` completes, the ingestion worker emits `RAGIndexRequestedEvent` to a queue.
- `RAGIndexingWorker` consumes the event, calls `RAGChunkingService`, and upserts chunks through `RAGConnector` (ADR-0081).
- Failures are logged and retried with bounded backoff; they do not block the main ingestion pipeline.

### 5. Sync and bookkeeping
- A new `rag_chunks_sync` table tracks indexing state per post/tenant:
```sql
CREATE TABLE rag_chunks_sync (
  tenant_id UUID NOT NULL,
  post_id UUID NOT NULL,
  chunk_count INT NOT NULL DEFAULT 0,
  embedding_model VARCHAR(64) NOT NULL,    -- e.g. 'text-embedding-3-small'
  status VARCHAR(32) NOT NULL,             -- 'synced' | 'pending' | 'failed'
  last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  PRIMARY KEY (tenant_id, post_id)
);
CREATE INDEX idx_rag_chunks_sync_status ON rag_chunks_sync(tenant_id, status);
```
  - `embedding_model` enables embedding-model migrations: a future model swap can be detected by comparing this column to the current configured model, and affected posts can be re-indexed.
  - `status` supports `GET /v1/rag/status` (ADR-0084) health/lag reporting and retry visibility. `error_message` captures the last failure reason for `failed` rows.
- **Orphan-chunk cleanup on re-index:** when a post is re-indexed (due to an edit, enrichment correction, or `published_at` change), the worker compares the new chunk count to `rag_chunks_sync.chunk_count`. If `new_chunk_count < old_chunk_count`, the worker explicitly deletes the obsolete vector IDs `${tenantId}:${postId}:${new_chunk_count}` through `${tenantId}:${postId}:${old_chunk_count - 1}` before upserting the new chunks and updating the sync row. This prevents orphaned chunks from returning obsolete content in future searches. (Alternatively, the worker may call `RAGConnector.deletePost(tenantId, postId)` before upserting the new chunk set — simpler but slightly more expensive for large posts; either approach is acceptable as long as no stale chunks remain.)
- On post deletion or tenant offboarding, `RAGIndexingWorker` calls `RAGConnector.deletePost()` or `RAGConnector.deleteTenant()` and removes the corresponding `rag_chunks_sync` row(s).
- On `rawPayload` retention (ADR-0018), only `social_posts.raw_payload` is removed; the vector chunks remain until the post itself is deleted.

---

## Consequences

1. **Better retrieval quality:** chunking surfaces the right excerpt, not just the whole post. Title-prepending further improves retrieval when the title carries topical context.
2. **Async resilience:** an embedding or vector-store outage does not break ingestion.
3. **Reconstructability:** the `rag_chunks_sync` table (with `embedding_model` and `status`) makes it possible to rebuild the index from `social_posts` and to detect/embedding-model-migrate affected posts.
4. **Embedding cost:** every chunk costs one vector. Short posts still cost one vector; long posts cost several. The dedicated `text-embedding-3-small` deployment is significantly cheaper than generation models ($0.02 / 1M tokens).
5. **Failure mode:** chunks can lag behind the latest posts; `GET /v1/rag/status` (ADR-0084) exposes this lag. Failed posts are marked `status = 'failed'` in `rag_chunks_sync` with `error_message` for operator visibility.
6. **Orphan-chunk safety:** the re-index orphan-cleanup rule (Decision §5) prevents stale chunks from polluting search results when a post is edited to a shorter body. Without this rule, the deterministic vector ID scheme would leave high-index chunks permanently orphaned.

---

## Alternatives considered

1. **Embed the entire post as one vector.**
   - *Rejected:* it loses the ability to retrieve the specific sentence or claim that answers a question.

2. **Pre-compute chunks during the `poll()` call in each `SocialConnector`.**
   - *Rejected:* it pushes RAG logic into every connector. A shared service keeps the architecture consistent.

3. **Synchronous embedding during ingestion.**
   - *Rejected:* it would slow ingestion and make the vector store a hard dependency. Async is safer for a v1 RAG layer.

---

## Resolved questions

| Question | Resolution | Rationale |
|---|---|---|
| Should the chunk size be configurable per tenant or per post type? | **Fixed platform default in v1** (256 tokens / 20% overlap). | Dynamic chunk sizing adds tenant configuration complexity without clear ROI in v1. 256 tokens matches typical social-media/comment granularity well. |
| Should the embedding model be the same as the generation model, or a dedicated `text-embedding-3-small`-style model? | **Dedicated `text-embedding-3-small`** (1536 dimensions). | Chat/generation models do not produce embeddings. `text-embedding-3-small` is extremely cheap ($0.02 / 1M tokens), has high MTEB benchmark performance, and is natively available on Azure OpenAI. Deployed as a separate deployment alongside existing chat-completion models. |
| How are late-arriving `published_at` corrections handled — re-index the whole post or only affected chunks? | **Re-index the entire post asynchronously.** | Social posts rarely have more than 3–5 chunks. Diffing individual chunks adds unnecessary complexity compared to an idempotent full-post re-index (which overwrites existing vector IDs and cleans up orphans per Decision §5). |
| What is the retry policy for an `RAGIndexRequestedEvent` that repeatedly fails? | **3 retries with exponential backoff (1s, 5s, 30s) → DLQ → mark `rag_chunks_sync.status = 'failed'`.** | Prevents ingestion-pipeline stalls. Surfaced via `GET /v1/rag/status` for operational visibility without crashing background workers. The `error_message` column captures the last failure reason. |

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0081` (`RAGConnector`, Accepted 2026-08-25), `ADR-0083` (RLS and metadata), `ADR-0002` (`AIProviderConnector`), `ADR-0018` (retention)
