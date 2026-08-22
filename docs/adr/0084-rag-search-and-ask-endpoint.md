# ADR-0084: RAG search and ask endpoint

**Status:** Proposed (2026-08-23)

**Authorizes:** the `POST /v1/rag/search` semantic search endpoint and the `POST /v1/rag/ask` natural-language Q&A endpoint, including their contracts, filters, pagination, and citation format.

**Source:** `docs/product-research/feature-designs/28-semantic-search-rag.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Semantic search needs a clean REST contract
`docs/product-research/feature-designs/28-semantic-search-rag.md` requires a way for users to find conceptually related posts and ask natural-language questions over the tenant's corpus. The endpoint must translate a query into a vector, run `RAGConnector.search()`, and return ranked results with provenance.

### 2. Q&A needs grounding and citations
A generated answer is only useful if the user can verify it against the original posts. `POST /v1/rag/ask` must return both the answer and the chunks that support it.

### 3. The project already has `posts` and `watchlists` as filter dimensions
`GET /v1/posts` supports watchlist and date filters. `POST /v1/rag/search` should support the same dimensions so users can search within a known scope.

---

## Decision

### 1. `POST /v1/rag/search`
**Request**
```ts
{
  query: string;                    // natural-language query
  filter?: {
    watchlistId?: string;
    platformId?: string;
    topicId?: string;
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
    dateRange?: { start: ISOString; end: ISOString };
  };
  pagination?: {
    topK: number;                   // default 10, hard cap 50
  };
}
```

**Response (HTTP 200)**
```ts
{
  results: Array<{
    postId: string;
    chunkIndex: number;
    score: number;
    platformId: string;
    publishedAt: string;
    snippet: string;                // reconstructed from social_posts
  }>;
}
```

- The query text is embedded using the same `AIProviderConnector.embed()` as the chunking pipeline.
- `RAGSearchService` calls `RAGConnector.search()` with the `tenant_id` and any `RAGFilter`.
- Snippets are reconstructed by fetching the original `social_posts` row and extracting the relevant chunk.
- `topK` is capped to 50 to control cost.

### 2. `POST /v1/rag/ask`
**Request**
```ts
{
  question: string;
  filter?: RAGFilter;               // same as /v1/rag/search
  maxChunks?: number;               // default 5, hard cap 10
}
```

**Response (HTTP 200)**
```ts
{
  answer: string;
  citations: Array<{
    postId: string;
    chunkIndex: number;
    url?: string;                   // link to the original post
    snippet: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
}
```

- The backend retrieves `maxChunks` chunks using `POST /v1/rag/search`.
- It sends the question and chunks to `AIProviderConnector.research?()` or a dedicated generation method.
- The model is instructed to answer only from the provided chunks and to cite them.
- `citations` always match the chunks used, so the answer is verifiable.

### 3. `GET /v1/rag/status`
Returns the indexing health for the tenant:
```ts
{
  totalIndexedPosts: number;
  totalChunks: number;
  lagBehindIngestion: number;       // posts in social_posts not yet in vector store
  lastIndexedAt: ISOString;
  storeStatus: 'healthy' | 'degraded' | 'unavailable';
}
```

### 4. Rate and cost limits
- `POST /v1/rag/search` and `POST /v1/rag/ask` are metered per tenant.
- Default monthly caps are set per plan; `tenant_admin` can see usage.
- A `429 RAG_QUOTA_EXCEEDED` is returned when the cap is hit.

---

## Consequences

1. **Two clear UX paths:** `search` for discovery, `ask` for synthesis.
2. **Citations by design:** every answer is grounded in retrievable posts.
3. **Cost exposure:** `ask` is more expensive than `search` because it includes a generation call.
4. **Coupling to `social_posts`:** the response must fetch the original post to display the snippet, adding a small but necessary round trip.

---

## Alternatives considered

1. **One combined `/v1/rag/query` endpoint with a `mode` flag.**
   - *Rejected:* separate endpoints make the UI and rate-limiting clearer. `search` is cheap; `ask` is expensive.

2. **Return full chunk text from the vector store without fetching `social_posts`.**
   - *Rejected:* it duplicates content and weakens RLS/PII controls. The source of truth is `social_posts`.

3. **Allow unauthenticated `ask` for public posts.**
   - *Rejected:* all tenant data is access-controlled. There is no public RAG surface.

---

## Open questions

- Should `/v1/rag/ask` stream the answer token by token, or return a full response?
- How should the API behave when the question is outside the scope of the retrieved chunks — refuse to answer or note the limitation?
- Should `search` support hybrid search (vector + keyword) in v1 or only vector?
- What is the right `maxChunks` for `ask`? 3, 5, or 10?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0081` (`RAGConnector`), `ADR-0082` (chunking and embedding), `ADR-0083` (RLS and metadata), `ADR-0078` (metric explainability, same AI contract pattern)
