# ADR-0083: RAG vector-store RLS and metadata

**Status:** Accepted (2026-08-27)

**Drafted 2026-08-23 · Revised 2026-08-25 · Accepted 2026-08-27 per architectural review.** Authorizes the metadata schema for vector chunks, mandatory vector index pre-filtering, in-place metadata patch semantics, post redaction lifecycle, and the tenant-isolation rule that every `RAGConnector.search()` must enforce at query time.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md`, `docs/product-research/feature-adr-scoping.md`, and ADR-0081/0082.

---

## Context

### 1. Vector stores are flat multi-tenant indexes
Most managed vector databases (Pinecone, Azure AI Search, pgvector) operate on a shared index or namespace. Multi-tenant data must be strictly isolated at query time using metadata filters. The `RAGConnector` abstraction (ADR-0081) must make this tenant boundary impossible to bypass.

### 2. Tenant isolation must match database layer RLS
`ADR-0015` and `ADR-0032` established tenant RLS on `social_posts`, `watchlists`, and other tables. The RAG vector layer is a derived index and must inherit equivalent isolation. A vector query must never return candidate vectors or content from another tenant.

### 3. Metadata supports pre-filtering, citations, and content retrieval
Vector search needs to filter by `watchlistIds`, `platformId`, `dateRange`, `topics`, and `sentiment`. Storing `content` (chunk text payload) directly in vector metadata eliminates high-latency secondary SQL lookups during RAG generation (ADR-0081/0082 revision). `post_id` and `chunk_index` enable deterministic citations back to source posts.

---

## Decision

### 1. Required metadata schema on every vector record
```ts
export type PlatformId =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'bluesky'
  | 'threads'
  | 'x'
  | 'rss'
  | 'newswire'
  | 'wikipedia'
  | string;

export interface RAGChunkMetadata {
  tenant_id: string;         // Required: strict equality-filtered on every search
  post_id: string;           // Links back to social_posts
  chunk_index: number;       // 0..N for this post
  content: string;           // Chunk text payload (bounded <= 256 tokens / ~1.5 KB)
  platform_id: PlatformId;   // Typed platform identifier
  published_at: string;      // ISO 8601, for date-range filtering
  watchlist_ids: string[];   // Array of matching watchlist IDs (empty array if none)
  sentiment?: string;        // 'positive' | 'negative' | 'neutral' | 'unassigned'
  topics?: string[];         // Topic IDs from AI topic clustering
}
```

- **Payload Size Boundary**: Total metadata payload per chunk is strictly bounded to $< 4\text{ KB}$ (well beneath the safe ceiling of 8 KB and provider limits: Pinecone 40 KB, pgvector unbounded JSONB, Azure AI Search 16 MB).

---

### 2. Mandatory tenant isolation by query-time filter
- Every `RAGConnector.search()` call must include an index-level metadata equality filter: `tenant_id == caller.tenantId`.
- There is no "search across all tenants" mode.
- If the vector store supports physical namespaces (Pinecone) or partitioned indices, the implementation may utilize them, but the `tenant_id` metadata filter remains mandatory as defense-in-depth.

---

### 3. Queryable metadata support & Mandatory Pre-Filtering
- **Pre-Filtering Mandate**: All metadata filters must execute **prior to or during graph traversal (k-NN search)** within the vector index. Application-level post-filtering on nearest neighbor candidates is prohibited as a primary mechanism because it causes severe recall drop-off and pagination skew.
- **Provider Filter Translation**:
  - **Pinecone**: Mongo-style `$in`, `$eq`, `$and` operators.
  - **Azure AI Search**: OData `$filter` expressions (e.g., `watchlist_ids/any(w: search.in(w, '...'))`).
  - **pgvector**: SQL `WHERE tenant_id = $1 AND platform_id = ANY($2) AND watchlist_ids && $3`.
- **Over-Fetching Fallback**: If a third-party vector store lacks native array-membership pre-filtering on `watchlist_ids`, `RAGSearchService` must over-fetch ($k \times 3$) candidates before applying in-memory post-filters to mitigate recall degradation.

---

### 4. Lifecycle Management (Deletions, Updates, Redactions, Offboarding)

1. **Post Deletion (`DELETE /v1/posts/:id`)**:
   - Invokes `RAGConnector.deletePost(tenantId, postId)`.
   - Executed via metadata filter (`post_id == postId` AND `tenant_id == tenantId`) or by generating deterministic batch ID arrays (`${tenantId}:${postId}:${0..chunkCount - 1}`) and invoking provider batch delete.
2. **Post Modification / Content Redaction (`PATCH/PUT /v1/posts/:id`)**:
   - When post text is modified or sanitized upstream in `social_posts`, the system invokes `deletePost(tenantId, postId)` followed by fresh chunking, re-embedding, and upserting to guarantee no stale or redacted text persists in `content`.
3. **Metadata Patching & Human-in-the-Loop Overrides (ADR-0071)**:
   - When sentiment, topics, or watchlist assignments change without text edits, the system calls `RAGConnector.updateMetadata(tenantId, postId, partialMetadata)`.
   - Providers supporting partial metadata updates (Pinecone `update()`, pgvector `UPDATE`) update metadata fields in-place without re-generating embeddings.
   - Providers without partial update support re-upsert the existing vector with the updated metadata object.
4. **Tenant Offboarding & Deletion (ADR-0043)**:
   - Invokes `RAGConnector.deleteTenant(tenantId)` to execute a bulk metadata delete by `tenant_id` (or drop tenant namespace).
5. **Reconciliation Background Worker**:
   - A periodic background worker compares `rag_chunks_sync` against `social_posts` to garbage-collect orphaned vector records and reconcile metadata drift.

---

## Consequences

### Positive
- **Guaranteed Isolation**: Strict `tenant_id` pre-filtering prevents vector data leakage across tenants.
- **High Recall & Accurate Ranking**: Vector pre-filtering prevents candidate truncation and pagination skew.
- **Zero SQL Round-Trip on RAG**: Storing `content` directly in metadata enables instant RAG synthesis (Q&A, summaries) without secondary SQL queries.
- **Reduced Write Amplification**: Metadata-only patches (`updateMetadata`) avoid expensive embedding recomputation when sentiment or topics are updated.
- **Privacy Compliance**: Content redaction and post deletions cleanly purge vector copies.

### Trade-offs & Mitigations
- **Storage Footprint**: Storing chunk text inside vector metadata increases vector storage volume slightly. *Mitigated by 256-token chunk bounds and high-utility RAG retrieval speed.*
- **Over-fetch Cost on Limited Stores**: Stores lacking array-any filtering incur minor over-fetch latency. *Mitigated by native SQL array support in default pgvector deployment.*

---

## Resolved Questions

1. **Updating `watchlist_ids` vs. query-time join?**
   - **Resolved (2026-08-27):** Stored as an index-time metadata array on each chunk. Updated via partial metadata patching (`updateMetadata`) when watchlists change. Query-time SQL joins are avoided to preserve vector search performance.
2. **Human-in-the-loop metadata overrides (ADR-0071)?**
   - **Resolved (2026-08-27):** Handled via `RAGConnector.updateMetadata(tenantId, postId, partialMetadata)` without re-embedding text.
3. **Maximum metadata payload limit?**
   - **Resolved (2026-08-27):** Bounded $< 4\text{ KB}$ per record with an 8 KB hard ceiling, well within Pinecone (40 KB) and pgvector limits.
4. **`platform_id` format?**
   - **Resolved (2026-08-27):** Typed string union (`PlatformId`) matching the core platform enum across the service.

---

## Related Notes
- `docs/product-research/feature-designs/28-semantic-search-rag.md`
- `docs/adr/0081-rag-connector-provider-abstraction.md`
- `docs/adr/0082-rag-post-chunking-and-embedding.md`
- `docs/adr/0015-tenant-isolation-via-postgres-row-level-security.md`
- `docs/adr/0043-self-service-tenant-initiated-deletion.md`
- `docs/adr/0071-human-in-the-loop-post-enrichment-overrides-and-cascading-drawer-ui.md`

### Pending supersession note (2026-08-28)

If ADR-0138 (Proposed, 2026-08-28) is accepted, this ADR's decision would be superseded/refined by ADR-0138's own terms — specifically shifting vector store multi-tenancy from shared-index metadata filtering to physical namespace/shard-per-tenant isolation (Pinecone/Weaviate) and database-enforced Row-Level Security (pgvector). This is a pending note only: ADR-0138 is currently Proposed, not accepted.

### Supersession update (2026-09-14, Story 19.3)

ADR-0138 was actually already Accepted 2026-08-28 (this note's own "Proposed" framing was stale even before today) and, as of this same pass, now carries real Decision text — see ADR-0138's own "Relation to ADR-0083" section for the full accounting. Two things to note precisely, not a blanket "superseded": Decision §2 (mandatory tenant-isolation metadata filter, translation table, lifecycle management) remains the live, unchanged Decision text for providers without physical isolation, and the `RAGChunkMetadata` schema (Decision §1) stands exactly as originally decided — ADR-0138 confirmed both unchanged rather than superseding them. Only this ADR's Decision §2's closing sentence (physical namespaces as an optional add-on) is superseded by ADR-0136 Decision §2 making physical isolation primary; and Decision §4 item 5 (the reconciliation background worker) is partially addressed — ADR-0138 fixed the worker's fail-closed RLS-routing defect, but the worker still has no scheduler and does not run in production (a real, separate, still-open gap against this ADR, per ADR-0138's own Decision §6/Open Question Q-0138-3).