# ADR-0083: RAG vector-store RLS and metadata

**Status:** Proposed (2026-08-23); revised 2026-08-25 to align with ADR-0081's architectural-review revision — `content` (chunk text) is now stored in `RAGChunkMetadata`, the `RAGFilter` shape is aligned to ADR-0081's canonical form, and the deterministic vector ID scheme is referenced.

**Authorizes:** the metadata schema for vector chunks and the tenant-isolation rule that every `RAGConnector.search()` must enforce at query time.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Vector stores are typically flat indexes
Most vector databases (Pinecone, Azure AI Search, pgvector) support a single index or namespace. Multi-tenant data must be filtered at query time using metadata. The `RAGConnector` abstraction (ADR-0081) must make this boundary explicit and impossible to bypass.

### 2. The project already enforces tenant isolation at the database layer
`ADR-0015` and `ADR-0032` established tenant RLS on `social_posts`, `watchlists`, and other tables. The RAG layer is a derived index and must inherit the same isolation. A vector query must never return chunks from another tenant.

### 3. Metadata supports filters and citations
Search needs to filter by `watchlistIds`, `platformId`, `dateRange`, and `topics`. Each vector record must carry enough metadata to answer these filters without joining back to `social_posts` at query time. It also needs `post_id` and `chunk_index` (and, per ADR-0081 revision, `content`) so the UI can cite the original post and display chunk text directly.

---

## Decision

### 1. Required metadata fields on every vector record
```ts
interface RAGChunkMetadata {
  tenant_id: string;         // required, equality-filtered on every search
  post_id: string;           // to link back to social_posts
  chunk_index: number;       // 0..N for this post
  content: string;           // chunk text payload (per ADR-0081 revision) — enables direct RAG generation without a secondary SQL lookup
  platform_id: string;       // connector platform
  published_at: string;      // ISO 8601, for date-range filtering
  watchlist_ids: string[];   // empty array if none
  sentiment?: string;        // e.g. 'positive' | 'negative' | 'neutral'
  topics?: string[];         // topic IDs from topic clustering
}
```
The full, authoritative interface shape (including `RAGFilter`, `RAGSearchOptions`, `RAGSearchResult`, and the deterministic vector ID convention) is defined in ADR-0081; this ADR scopes itself to the metadata schema and isolation rule.

### 2. Tenant isolation by metadata filter
- Every `RAGConnector.search()` call must include a metadata filter `tenant_id == caller.tenant_id`.
- There is no "search across all tenants" mode.
- If the vector store supports namespaces (Pinecone) or separate indices, the implementation may use them, but the metadata filter is still mandatory as a defense in depth.

### 3. Queryable metadata support
The `RAGFilter` passed to `search()` is the canonical, provider-agnostic shape defined in ADR-0081:
```ts
interface RAGFilter {
  platformId?: string | string[];   // exact match
  sentiment?: string | string[];    // exact match
  watchlistIds?: string[];          // array-membership match in watchlist_ids
  topics?: string[];                // array-membership match in topics
  dateRange?: { from?: string; to?: string };  // ISO 8601 range filter on published_at
}
```
- `tenant_id` is never a `RAGFilter` field — it comes from the mandatory `tenantId` parameter on `search()` (ADR-0081 Decision §2).
- Each connector implementation translates `RAGFilter` to vendor-native filter syntax (Pinecone Mongo-style operators, Azure AI Search OData `$filter`, pgvector SQL `WHERE`); provider-specific syntax stays inside the connector.
- `watchlist_ids` uses the store's array-membership filter if available; otherwise `RAGSearchService` post-filters.
- `published_at` uses a range filter (`dateRange.from`/`dateRange.to`) when the store supports it.

### 4. Deletion and offboarding
- On `DELETE /v1/posts/:id`, call `RAGConnector.deletePost(tenantId, postId)`. Vector ids follow `${tenantId}:${postId}:${chunkIndex}` (ADR-0081 Decision §7), so this is a predictable id-range delete where the provider supports it, and a metadata-filter delete (`post_id == postId` AND `tenant_id == tenantId`) otherwise.
- On tenant deletion/offboarding (ADR-0043), call `RAGConnector.deleteTenant(tenantId)` — a metadata-filter delete on `tenant_id`.
- A periodic reconciliation job scans `rag_chunks_sync` for `post_id`s no longer in `social_posts` and deletes the orphan vector records.

### 5. No PII beyond public post content; chunk text stored as derived copy
The vector store holds `chunk_index` and `content` (the chunk text payload, per ADR-0081 revision). `content` is a derived copy of already-public post text, stored alongside the embedding so `search()` results can be used directly for RAG generation (Q&A answers, daily-digest summaries) without a secondary SQL lookup to `social_posts`. `social_posts` remains the source of truth — `content` is rebuildable from it. `author` and other PII are not stored in the vector store; only public post content and its derived metadata (sentiment, topics, watchlist matches) appear in vector-record metadata.

---

## Consequences

1. **Strong tenant isolation:** every search is filtered by `tenant_id`, consistent with RLS elsewhere.
2. **Rich filtering:** metadata enables the watchlist, platform, topic, sentiment, and date filters in `POST /v1/rag/search`.
3. **Stored chunk text:** `content` is stored as a derived copy alongside the embedding, so RAG generation does not require a secondary SQL lookup. This is a deliberate trade-off: slightly larger vector-record payloads in exchange for retrieval convenience. `social_posts` remains the source of truth and the index is rebuildable.
4. **Metadata limits:** vector stores impose size limits on metadata. The chosen set (including `content`) fits within common limits but may need trimming if new fields are added; `content` is the largest field and is bounded by the chunk size (ADR-0082, default 256 tokens).

---

## Alternatives considered

1. **Store no chunk text in the vector store; reconstruct from `social_posts` on every retrieval.**
   - *Rejected (reversed 2026-08-25 per ADR-0081 architectural review):* forcing a secondary SQL lookup for every RAG generation step (Q&A answers, daily-digest summaries) adds latency and coupling that outweighs the PII-surface benefit. `content` is now stored as a derived copy of already-public post text; `social_posts` remains the source of truth and the index is rebuildable. The original PII-safety concern is preserved by storing only public post content (no `author` or other PII) in vector-record metadata.

2. **One vector index per tenant.**
   - *Rejected:* it multiplies index-management and cost overhead. Metadata filtering is the standard, scalable pattern.

3. **Join vector search results back to `social_posts` for filters.**
   - *Rejected:* it would force a database round trip for every candidate, defeating the performance benefit of the vector index. Metadata filters keep search fast.

---

## Open questions

- Should `watchlist_ids` be updated when a new watchlist matches an already-indexed post, or is the watchlist filter applied at search time against `post_watchlist_matches`?
- How is metadata updated when `sentiment` or `topics` are corrected by a human-in-the-loop override (ADR-0071)?
- What is the maximum metadata payload the chosen vector store accepts per record?
- Should `platform_id` be an indexed string or a `provider_id`/`platformId` enum?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0081` (`RAGConnector`), `ADR-0082` (chunking and embedding), `ADR-0015` (tenant RLS), `ADR-0043` (tenant deletion)
