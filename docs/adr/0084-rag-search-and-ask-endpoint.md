# ADR-0084: RAG search and ask endpoint

**Status:** Accepted (2026-08-27)

**Drafted 2026-08-23 · Revised 2026-08-25 · Accepted 2026-08-27 per architectural review.** Authorizes the `POST /v1/rag/search` semantic/hybrid search endpoint, the `POST /v1/rag/ask` natural-language Q&A endpoint (with dual-mode Server-Sent Events streaming support), grounding/citation structures, normalized [0.00..1.00] scoring, prompt-injection defense, and indexing status contracts.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md`, `docs/product-research/feature-adr-scoping.md`, and ADR-0081/0082/0083.

---

## Context

### 1. Unified REST contract for search and synthesis
Users require two distinct consumption modes over indexed social data:
1. **Discovery / Retrieval**: Fast, ranked, pre-filtered semantic and hybrid search over raw post chunks.
2. **Synthesis / Q&A**: Natural-language answers grounded strictly in retrieved chunks with verifiable inline citations.

### 2. Citations and Grounding
Generated answers must be verifiable. Chunks passed to the LLM must be linked to citation identifiers (`[^1]`, `[^2]`), and the model must refuse to answer when the corpus lacks supporting evidence.

### 3. Consistency with Stored Chunk Architecture
Per ADR-0081 and ADR-0083, vector chunk records store `content` (chunk text) directly in metadata. Search and Q&A endpoints source snippets directly from vector metadata without executing secondary SQL joins to `social_posts`.

---

## Decision

### 1. `POST /v1/rag/search` (Semantic & Hybrid Search)
Performs vector pre-filtered search over indexed chunks for the calling tenant.

**Request (`application/json`)**
```ts
export interface RAGSearchRequest {
  query: string;                          // Natural-language query string
  searchMode?: 'semantic' | 'hybrid';     // Default: 'semantic'
  filter?: {                              // Canonical RAGFilter (ADR-0081/0083)
    platformId?: PlatformId | PlatformId[];
    sentiment?: 'positive' | 'negative' | 'neutral' | 'unassigned';
    watchlistIds?: string[];              // Array membership match
    topics?: string[];                    // Array membership match
    dateRange?: { from?: string; to?: string }; // ISO 8601 range
  };
  pagination?: {
    topK?: number;                        // Default: 10, Hard Cap: 50
  };
}
```

**Response (HTTP 200 OK)**
```ts
export interface RAGSearchResponse {
  results: Array<{
    postId: string;
    chunkIndex: number;
    score: number;                        // Normalized similarity [0.00 .. 1.00]
    platformId: PlatformId;
    publishedAt: string;                  // ISO 8601
    snippet: string;                      // Derived copy from RAGChunkMetadata.content
    internalUrl: string;                  // Deterministic app route: /app/posts/${postId}
  }>;
  totalReturned: number;
}
```

- **Query Embedding**: The query text is embedded using `AIProviderConnector.embed(tenantId, [query])` using `text-embedding-3-small` (ADR-0082).
- **Mandatory Pre-Filtering**: The query enforces `tenant_id == caller.tenantId` in the vector store (ADR-0083).
- **Normalized Scores**: `RAGSearchService` normalizes vendor-specific distance/similarity scores to a standard float range `[0.00, 1.00]` (where 1.00 is exact semantic match).

---

### 2. `POST /v1/rag/ask` (Grounded Natural Language Q&A)
Generates answers backed by vector search context. Supports both blocking JSON and Server-Sent Events (SSE).

**Request (`application/json`)**
```ts
export interface RAGAskRequest {
  question: string;
  filter?: RAGFilter;                     // Canonical RAGFilter
  maxChunks?: number;                     // Default: 5, Hard Cap: 10 (~1,280 tokens context)
  stream?: boolean;                       // Default: false (or via Accept: text/event-stream)
}
```

**Response (HTTP 200 OK - Standard JSON Mode)**
```ts
export interface RAGAskResponse {
  answer: string;                         // Markdown formatted answer with citation markers [^1]
  citations: Array<{
    citationIndex: number;                // 1-based index matching [^1]
    postId: string;
    chunkIndex: number;
    snippet: string;
    platformId: PlatformId;
    publishedAt: string;
    internalUrl: string;
  }>;
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  isGrounded: boolean;                    // False if question could not be answered from chunks
}
```

**Streaming Mode (`Accept: text/event-stream` or `stream: true`)**
When streaming is requested:
1. `event: citations` $\rightarrow$ Emits the resolved citations array immediately after vector retrieval.
2. `event: delta` $\rightarrow$ Emits incremental token strings `{"text": "..."}` as the LLM generates the answer.
3. `event: done` $\rightarrow$ Emits metadata including final `confidence` and `isGrounded` status.

**Prompting & Grounding Rules:**
- Input chunks are wrapped in strict XML context boundaries (`<context><chunk id="1">...</chunk></context>`) to mitigate prompt injection.
- System prompt strictly enforces: *"Answer ONLY using the provided chunks. If the answer cannot be deduced from the context, state that the corpus lacks sufficient information and do not speculate."* Return `confidence: 'unsupported'` and `isGrounded: false`.

---

### 3. `GET /v1/rag/status`
Returns real-time vector indexing health for the caller's tenant:

```ts
export interface RAGStatusResponse {
  totalIndexedPosts: number;
  totalChunks: number;
  lagBehindIngestion: number;             // Posts in social_posts not yet embedded
  lastIndexedAt: string | null;           // ISO 8601
  storeStatus: 'healthy' | 'degraded' | 'unavailable';
}
```

---

### 4. Rate Limiting and Quotas
- `POST /v1/rag/search` and `POST /v1/rag/ask` are metered per tenant.
- Separate token and query quotas are enforced per subscription tier.
- When quotas are exceeded, the API returns `429 Too Many Requests` with error code `RAG_QUOTA_EXCEEDED` and `Retry-After` header.

---

## Consequences

### Positive
- **Real-Time Responsiveness**: SSE streaming eliminates perceived frontend latency for generative Q&A.
- **Strict Provenance & Injection Defense**: Structured XML context boundaries and 1-based citation markers allow UIs to cleanly highlight source snippets.
- **Zero SQL Overhead**: Snippets are served directly from vector store metadata.
- **Consistent Relevance**: Normalized [0.00, 1.00] scores provide consistent confidence presentation across vector backends.

### Trade-offs & Mitigations
- **LLM Token Cost on `/ask`**: Generative synthesis incurs LLM token usage. *Mitigated by default `maxChunks: 5` (~1,280 tokens context) and tenant subscription quotas.*
- **SSE Connection Management**: Streaming requires persistent HTTP connections. *Mitigated by short timeouts (30s max) and standard HTTP chunked transport.*

---

## Related Notes
- `docs/product-research/feature-designs/28-semantic-search-rag.md`
- `docs/adr/0081-rag-connector-provider-abstraction.md`
- `docs/adr/0082-rag-post-chunking-and-embedding.md`
- `docs/adr/0083-rag-vector-store-rls-and-metadata.md`
- `docs/adr/0078-metric-explainability-and-confidence-scoring.md`

### Pending supersession note (2026-08-28)

If ADR-0139 (Proposed, 2026-08-28) is accepted, this ADR's decision would be superseded/refined by ADR-0139's own terms — specifically shifting vector store multi-tenancy from shared-index metadata filtering to physical namespace/shard-per-tenant isolation (Pinecone/Weaviate) and database-enforced Row-Level Security (pgvector). This is a pending note only: ADR-0139 is currently Proposed, not accepted.