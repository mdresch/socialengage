# ADR-0083: RAG vector-store RLS and metadata

**Status:** Proposed (2026-08-23)

**Authorizes:** the metadata schema for vector chunks and the tenant-isolation rule that every `RAGConnector.search()` must enforce at query time.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Vector stores are typically flat indexes
Most vector databases (Pinecone, Azure AI Search, pgvector) support a single index or namespace. Multi-tenant data must be filtered at query time using metadata. The `RAGConnector` abstraction (ADR-0081) must make this boundary explicit and impossible to bypass.

### 2. The project already enforces tenant isolation at the database layer
`ADR-0015` and `ADR-0032` established tenant RLS on `social_posts`, `watchlists`, and other tables. The RAG layer is a derived index and must inherit the same isolation. A vector query must never return chunks from another tenant.

### 3. Metadata supports filters and citations
Search needs to filter by `watchlistId`, `provider`, `dateRange`, and `topic`. Each vector record must carry enough metadata to answer these filters without joining back to `social_posts` at query time. It also needs `post_id` and `chunk_index` so the UI can cite the original post.

---

## Decision

### 1. Required metadata fields on every vector record
```ts
interface RAGChunkMetadata {
  tenant_id: string;         // required, equality-filtered on every search
  post_id: string;           // to link back to social_posts
  chunk_index: number;       // 0..N for this post
  platform_id: string;       // connector platform
  published_at: string;      // ISO 8601, for date-range filtering
  watchlist_ids: string[];   // empty array if none
  sentiment?: string;        // e.g. 'positive' | 'negative' | 'neutral'
  topics?: string[];         // topic IDs from topic clustering
}
```

### 2. Tenant isolation by metadata filter
- Every `RAGConnector.search()` call must include a metadata filter `tenant_id == caller.tenant_id`.
- There is no "search across all tenants" mode.
- If the vector store supports namespaces (Pinecone) or separate indices, the implementation may use them, but the metadata filter is still mandatory as a defense in depth.

### 3. Queryable metadata support
The `RAGFilter` passed to `search()` is:
```ts
interface RAGFilter {
  watchlistId?: string;       // exact match in watchlist_ids array
  platformId?: string;        // exact match
  topicId?: string;           // exact match in topics array
  sentiment?: string;         // exact match
  dateRange?: { start: ISOString; end: ISOString };
}
```
- `watchlist_ids` uses the store's array-membership filter if available; otherwise `RAGSearchService` post-filters.
- `published_at` uses a range filter when the store supports it.

### 4. Deletion and offboarding
- On `DELETE /v1/posts/:id`, call `RAGConnector.deletePost(tenantId, postId)`.
- On tenant deletion/offboarding (ADR-0043), call `RAGConnector.deleteTenant(tenantId)`.
- A periodic reconciliation job scans `rag_chunks_sync` for `post_id`s no longer in `social_posts` and deletes the orphan vector records.

### 5. No PII beyond public post content
The vector store holds only the `chunk_index`, `text` is not stored (only the vector is). The original text is reconstructed from `social_posts` using `post_id` and `chunk_index` for display and citations. `author` and other PII are not stored in the vector store.

---

## Consequences

1. **Strong tenant isolation:** every search is filtered by `tenant_id`, consistent with RLS elsewhere.
2. **Rich filtering:** metadata enables the watchlist, platform, topic, and date filters in `POST /v1/rag/search`.
3. **Reconstruction cost:** the UI must fetch `social_posts` to show the original chunk text. This is a deliberate trade-off for PII safety.
4. **Metadata limits:** vector stores impose size limits on metadata. The chosen set fits within common limits but may need trimming if new fields are added.

---

## Alternatives considered

1. **Store the full chunk text in the vector store for faster display.**
   - *Rejected:* it keeps a second copy of tenant data and increases PII surface. `social_posts` remains the source of truth.

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
