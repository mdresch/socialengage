# BRD-0082: RAG Post Chunking and Embedding Pipeline

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – BRD-0082: RAG Post Chunking and Embedding Pipeline |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft – ADR-0082 is Proposed; this BRD is for review and may change |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0082, feature design 28-semantic-search-rag, and Epic 9 stories |

---

## 2. Executive Summary

Social listening users currently search posts by keyword and metadata. As the volume of ingested posts grows, keyword search misses conceptually related content that uses different language, and long posts contain multiple ideas that cannot be surfaced as a single relevant excerpt. To enable semantic search and RAG-grounded analytics, each normalized post must be split into meaningful, overlapping chunks and converted into vector embeddings that a vector store can retrieve by meaning.

This BRD describes the business requirements for the post chunking and embedding pipeline authorized by ADR-0082. The pipeline introduces a `RAGChunkingService` that splits `body_markdown` into bounded chunks, embeds those chunks through the existing `AIProviderConnector`, and uses an asynchronous worker to keep the vector index in sync with `social_posts`. The vector store remains a derived, best-effort index: ingestion completes regardless of embedding or vector-store health, and a bookkeeping table enables reconstruction and lag monitoring.

The expected business value is higher retrieval quality for semantic search, more accurate AI-generated answers and summaries, and a resilient architecture that does not make the vector store a hard dependency of the ingestion pipeline.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Improve semantic retrieval quality | Users find conceptually related posts even when query and post text differ; top-N results contain the specific excerpt that answers the question |
| 2 | Keep the vector index synchronized with `social_posts` | New, updated, and deleted posts are reflected in the vector index with bounded, observable lag |
| 3 | Protect ingestion reliability | Embedding and vector-store failures do not block or fail the main ingestion pipeline |
| 4 | Enable cost-aware AI operations | Embedding consumption is bounded by chunk-size defaults, counted per chunk, and observable per tenant |
| 5 | Support multi-tenant semantic search | Each chunk is embedded and indexed with tenant-scoped metadata and source provenance |

---

## 4. Scope

### 4.1 In Scope

- A new `RAGChunkingService` that splits normalized `SocialPost` content into overlapping `RAGChunk` objects.
- Chunking rules applied to `body_markdown` with a default size of 256 tokens, 20% overlap (≈ 51 tokens), paragraph/sentence boundary preference, and a minimum chunk size of 64 tokens.
- Embedding of chunks through an `AIProviderConnector.embed()` contract.
- Asynchronous indexing triggered after `enrichPost()` completes via a `RAGIndexRequestedEvent` queue.
- A `RAGIndexingWorker` that consumes the event, chunks and embeds the post, and upserts the resulting vectors through `RAGConnector` (ADR-0081).
- A `rag_chunks_sync` bookkeeping table that tracks `post_id`, `tenant_id`, `last_indexed_at`, `chunk_count`, and `store_id`.
- Synchronization on post deletion, tenant offboarding, and `rawPayload` retention (vectors remain while the post itself exists).
- Bounded retry and failure logging for the async indexing worker.

### 4.2 Out of Scope

- The vector store provider abstraction itself (owned by ADR-0081 / Story 9.7).
- Vector-store RLS, metadata schema, and query-time filtering (owned by ADR-0083 / Story 9.9).
- The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` REST endpoints (owned by ADR-0084 / Story 9.10).
- The admin UI search box, results list, citations, and loading patterns (owned by ADR-0085 / Story 9.11).
- A dedicated, cheaper embedding model (future ADR; v1 uses the existing `AIProviderConnector`).

### 4.3 Assumptions

- ADR-0081 (`RAGConnector`) is accepted and implemented before this pipeline is built.
- `AIProviderConnector` already supports or will be extended to support an `embed(texts: string[])` method.
- `body_markdown` is the canonical, normalized post body at the point `enrichPost()` completes.
- The vector store is treated as a derived index that can be rebuilt from `social_posts` and `rag_chunks_sync`.

### 4.4 Constraints

- Embedding and vector-store calls must not block the main ingestion pipeline.
- Chunk size, overlap, and model selection are fixed defaults in v1; per-tenant or per-post-type configuration is a future tuning pass.
- Every embedding call consumes AI provider quota; default chunk size and overlap are chosen to balance retrieval quality and cost.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user of semantic search | High | Find relevant post excerpts by meaning, not keyword |
| Topic-Center-Analyst | Primary end user of trend exploration | High | Surface conceptually related posts and narratives |
| Tenant-Brand-Reputation-Manager | Primary end user of issue discovery | High | Discover unexpected language and emerging narratives |
| Tenant-Reader | Secondary end user of simple search | Medium | Use a search box that understands natural language |
| Sole-Operator | Secondary operator and cost owner | Medium | See and control embedding costs and index health |
| Performance Review Agent | Secondary reviewer of latency and cost | Medium | Review RAG query latency, embedding quota, and vector-store cost |
| Backend Engineer | Builds and maintains the pipeline | High | Clear chunking rules, async contract, and failure handling |
| Platform Administrator | Operates multi-tenant infrastructure | Medium | Tenant isolation, reconstruction, and deletion sync |

---

## 6. Current State (As-Is)

**Current process:**

1. A `SocialConnector` ingests a post and persists it in `social_posts`.
2. The post is normalized to `body_markdown` and run through `enrichPost()` for sentiment, topics, and other enrichment.
3. Users find posts through keyword search, platform filters, watchlist filters, and date ranges.
4. AI outputs rely on full post bodies or aggregate metrics, which can be too coarse for precise answers.

**Pain points:**

- A whole post is too coarse for semantic search; a single post may contain multiple ideas, only one of which answers a user's question.
- Keyword search cannot find conceptually related posts that use different terminology.
- There is no derived vector index, so AI features cannot be grounded in the most relevant excerpts from the tenant's own posts.
- Synchronous enrichment or embedding could slow ingestion or create a hard dependency on the vector store.

---

## 7. Future State (To-Be)

**New or improved process:**

1. After a post is ingested, normalized, and enriched, the ingestion worker emits a `RAGIndexRequestedEvent`.
2. A `RAGIndexingWorker` consumes the event and calls `RAGChunkingService.split(post)`.
3. `RAGChunkingService` splits `body_markdown` into overlapping `RAGChunk` objects, respecting paragraph/sentence boundaries, minimum chunk size, and a default 256-token target with 20% overlap.
4. The service calls `AIProviderConnector.embed(chunks)` to produce one vector per chunk.
5. The worker upserts the resulting `EmbeddedRAGChunk` records, including metadata, into the vector store through `RAGConnector` (ADR-0081).
6. `rag_chunks_sync` records `post_id`, `tenant_id`, `last_indexed_at`, `chunk_count`, and `store_id` for each indexed post.
7. On post deletion or tenant offboarding, the worker calls `RAGConnector.deletePost()` or `RAGConnector.deleteTenant()`.
8. `rawPayload` retention (ADR-0018) removes only the raw payload column; vector chunks remain until the post itself is deleted.
9. `GET /v1/rag/status` (ADR-0084) exposes indexing lag and health to operators.

**Expected capabilities:**

- Posts are retrievable at the chunk level, surfacing the most relevant excerpt for a question.
- The vector index stays in sync with `social_posts` without blocking ingestion.
- The index can be rebuilt or repaired from the source of truth using `rag_chunks_sync`.
- Embedding and vector-store outages are logged and retried without breaking the ingestion pipeline.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall split each normalized `SocialPost` into one or more `RAGChunk` objects from `body_markdown` after `enrichPost()` completes. | Must | `RAGChunkingService.split(post)` returns at least one chunk per post; very short posts produce a single chunk. | Product Owner |
| BR-002 | The system shall produce overlapping chunks with a default 256-token size and 20% overlap (≈ 51 tokens). | Must | Chunks are sized and overlapped according to ADR-0082 §2. | Product Owner |
| BR-003 | The system shall prefer paragraph and sentence boundaries when splitting, falling back to token count when no boundary exists. | Must | A chunk does not split mid-sentence unless the sentence exceeds the target size. | Product Owner |
| BR-004 | The system shall enforce a minimum chunk size of 64 tokens. | Must | No chunk smaller than 64 tokens is emitted unless the entire post is shorter. | Product Owner |
| BR-005 | The system shall embed each chunk into a vector using `AIProviderConnector.embed()`. | Must | `AIProviderConnector.embed(texts)` returns one vector per input string in the same order. | Product Owner |
| BR-006 | The system shall append enrichment metadata to `RAGChunkMetadata` without including it in the embedded text. | Must | Embedded `text` is the canonical chunk content; metadata is stored alongside the vector. | Product Owner |
| BR-007 | The system shall trigger indexing asynchronously via `RAGIndexRequestedEvent` after `enrichPost()`. | Must | The event is emitted after enrichment; ingestion does not wait for the worker to complete. | Product Owner |
| BR-008 | The system shall consume `RAGIndexRequestedEvent` with a `RAGIndexingWorker` and upsert chunks through `RAGConnector`. | Must | Worker calls `RAGChunkingService` and `RAGConnector.upsert()` for each indexed post. | Product Owner |
| BR-009 | The system shall track the sync state of each post in `rag_chunks_sync`. | Must | Table records `post_id`, `tenant_id`, `last_indexed_at`, `chunk_count`, and `store_id`. | Product Owner |
| BR-010 | The system shall delete a post's chunks from the vector store when the post is deleted. | Must | `RAGIndexingWorker` calls `RAGConnector.deletePost()` on deletion. | Product Owner |
| BR-011 | The system shall delete all chunks for a tenant when the tenant is offboarded. | Must | `RAGIndexingWorker` calls `RAGConnector.deleteTenant()` on offboarding. | Product Owner |
| BR-012 | The system shall retry indexing failures with bounded backoff and log each failure. | Must | Retry policy is documented and failures do not block main ingestion. | Product Owner |
| BR-013 | The system shall make chunk size, overlap, and embedding model configurable in a future release. | Could | ADR open questions capture the future requirement; v1 uses fixed defaults. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The chunking and embedding pipeline shall not block the main ingestion pipeline. | Reliability | Must | Ingestion completes successfully even when the vector store or embedding service is unavailable. |
| NFR-002 | The vector index shall be rebuildable from `social_posts` and `rag_chunks_sync`. | Reliability | Must | A full re-index produces the same chunk set and metadata for a given post. |
| NFR-003 | The pipeline shall enforce tenant isolation in all indexing and deletion operations. | Security | Must | No `RAGConnector` call mixes chunks from different tenants. |
| NFR-004 | Embedding latency for a single post should remain under a configurable target (e.g., 1.5 seconds for short posts, 5 seconds for long posts) in normal conditions. | Performance | Should | Measured in staging with representative post lengths. |
| NFR-005 | The pipeline should support embedding multiple chunks in a single `AIProviderConnector.embed()` call. | Performance | Should | Batching reduces per-call overhead while respecting provider limits. |
| NFR-006 | The pipeline shall emit metrics or events for chunk count, embedding calls, and indexing failures. | Maintainability | Should | Observable through existing logging/monitoring infrastructure. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A post is not indexed for RAG until `enrichPost()` has completed successfully. |
| BRU-002 | The canonical text embedded for each chunk is derived from `body_markdown` only; enrichment metadata is stored but not embedded. |
| BRU-003 | Every chunk must carry `post_id` and `chunk_index` so it can be linked back to the original `social_posts` row. |
| BRU-004 | The vector store is a derived index; `social_posts` remains the source of truth. |
| BRU-005 | Embedding and vector-store failures are retried but never allowed to fail the main ingestion pipeline. |
| BRU-006 | `rawPayload` retention (ADR-0018) removes only `social_posts.raw_payload`; vector chunks remain until the post itself is deleted or the tenant is offboarded. |
| BRU-007 | Chunk size, overlap, and embedding model are fixed in v1 unless a future ADR changes them. |
| BRU-008 | All chunk and embedding operations are scoped to a single `tenant_id`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `body_markdown` | Canonical normalized post body used for chunking | `social_posts` | Backend / Ingestion | Public post content |
| `RAGChunk.post_id` | Original post identifier | `social_posts.id` | Backend / RAG | System reference |
| `RAGChunk.chunk_index` | Zero-based index of the chunk within the post | `RAGChunkingService` | Backend / RAG | System reference |
| `RAGChunk.text` | Canonical chunk text to be embedded | `RAGChunkingService` | Backend / RAG | Public post content |
| `EmbeddedRAGChunk.vector` | Numerical embedding produced by `AIProviderConnector` | `AIProviderConnector.embed()` | Backend / RAG | Derived, not PII |
| `RAGChunkMetadata` | Enrichment metadata and provenance attached to the chunk; see ADR-0083 | `enrichPost()` + `RAGChunkingService` | Backend / RAG | Mixed; no PII beyond public post content |
| `rag_chunks_sync.post_id` | Post identifier for sync bookkeeping | `social_posts.id` | Backend / RAG | System reference |
| `rag_chunks_sync.tenant_id` | Tenant identifier for isolation and cleanup | `social_posts.tenant_id` | Backend / RAG | System reference |
| `rag_chunks_sync.last_indexed_at` | Timestamp of the last successful index | `RAGIndexingWorker` | Backend / RAG | System reference |
| `rag_chunks_sync.chunk_count` | Number of chunks indexed for the post | `RAGIndexingWorker` | Backend / RAG | System reference |
| `rag_chunks_sync.store_id` | Identifier of the vector store record/index | `RAGConnector` | Backend / RAG | System reference |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Indexed post count | Track how many posts have been chunked and embedded | Product / Engineering | Hourly / daily |
| Chunk count per post | Observe distribution of chunk counts and cost exposure | Engineering / Operations | Daily |
| Index lag (oldest unindexed post) | Measure how far behind the vector index is from `social_posts` | Operations | Real-time |
| Embedding failure rate | Detect `AIProviderConnector` or vector-store issues | Engineering | Real-time |
| Retry queue depth | Monitor `RAGIndexRequestedEvent` backlog | Engineering | Real-time |
| Per-tenant chunk count | Support cost accounting and quota management | Product / Operations | Daily |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Embedding or vector-store outage causes indexing backlog | Medium | Medium | Async, bounded retry; main ingestion continues; `GET /v1/rag/status` exposes lag | Engineering |
| R-002 | Chunking quality is poor for short or heavily formatted posts | Medium | Medium | Minimum chunk size, boundary preference, and future tuning pass for per-post-type rules | Product / Engineering |
| R-003 | Embedding costs exceed budget as post volume grows | Medium | High | Default bounded chunk size; per-tenant chunk-count metrics; dedicated cheaper embedding model considered in future ADR | Product / Engineering |
| R-004 | Vector index drifts out of sync with `social_posts` | Medium | High | `rag_chunks_sync` bookkeeping table enables reconciliation and full rebuild; deletion and offboarding triggers keep deletes in sync | Engineering |
| R-005 | Multi-tenant data leaks if tenant filter is missed | Low | High | `RAGConnector` enforces `tenant_id` metadata on every upsert/search (ADR-0081/0083); `rag_chunks_sync` records `tenant_id` for every operation | Engineering |
| R-006 | ADR-0082 remains Proposed and may change before implementation | High | Medium | This BRD is marked as draft for review; final BRD updated once ADR is Accepted | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0081 `RAGConnector` provider abstraction | Internal / Architectural | Engineering | Before Story 9.8 implementation |
| D-002 | ADR-0002 `AIProviderConnector` with `embed()` support | Internal / Architectural | Engineering | Before Story 9.8 implementation |
| D-003 | ADR-0083 vector-store RLS and metadata schema | Internal / Architectural | Engineering | Concurrent or before search endpoint work |
| D-004 | ADR-0084 RAG search and ask endpoint contract | Internal / Architectural | Engineering | After Story 9.8 |
| D-005 | `docs/product-research/feature-designs/28-semantic-search-rag.md` | Reference | Product | Already exists |
| D-006 | `docs/product-research/feature-adr-scoping.md` | Reference | Product | Already exists |
| D-007 | Deep-research report for `28-semantic-search-rag` | Reference | Product | Not found in `docs/product-research/reports/`; to be added if produced |

---

## 14. Acceptance Criteria

- `RAGChunkingService.split(post)` produces overlapping chunks from `body_markdown` and enrichment metadata, with a default 256-token size, 20% overlap, paragraph/sentence boundary preference, and a 64-token minimum chunk size.
- `AIProviderConnector.embed(chunks)` or a dedicated embedding model is wired into the pipeline and returns one vector per input chunk.
- `RAGIndexRequestedEvent` is emitted after `enrichPost()` and consumed by a worker that does not block the main ingestion pipeline.
- `rag_chunks_sync` tracks `post_id`, `tenant_id`, `last_indexed_at`, `chunk_count`, and `store_id` per tenant.
- Failures are retried with bounded backoff and do not fail ingestion.
- Post deletion and tenant offboarding trigger removal of the corresponding vectors from the vector store.
- The vector index can be rebuilt from `social_posts` and `rag_chunks_sync`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation; a pattern that retrieves relevant source excerpts before generating an answer or summary. |
| `RAGChunk` | A smaller text unit produced from a post, with `post_id`, `chunk_index`, and `text`, ready for embedding. |
| `EmbeddedRAGChunk` | A `RAGChunk` plus its vector embedding and metadata. |
| `RAGChunkingService` | The service responsible for splitting a post into chunks and embedding those chunks. |
| `RAGIndexingWorker` | The async worker that consumes `RAGIndexRequestedEvent` and persists chunks to the vector store. |
| `RAGIndexRequestedEvent` | A queued event emitted after `enrichPost()` to trigger async RAG indexing. |
| `rag_chunks_sync` | Bookkeeping table that tracks the last-indexed state of each post for a tenant. |
| `body_markdown` | The canonical, normalized Markdown representation of a post's body. |
| `AIProviderConnector` | The provider-agnostic AI interface used for enrichment and, in v1, embedding. |
| `RAGConnector` | The provider-agnostic vector store interface defined in ADR-0081. |

---

## 16. Appendices

### Appendix A: Source Documents

- ADR-0082 – `docs/adr/0082-rag-post-chunking-and-embedding.md` (Status: Proposed)
- Feature design – `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Feature-to-ADR scoping – `docs/product-research/feature-adr-scoping.md`

### Appendix B: Related ADRs

- ADR-0081: `RAGConnector` provider abstraction
- ADR-0083: Vector-store RLS and metadata
- ADR-0084: RAG search and ask endpoint contract
- ADR-0085: RAG UI/UX and loading patterns
- ADR-0002: `AIProviderConnector`
- ADR-0018: Data retention and archival

### Appendix C: Related User Stories

- **Story 9.8 — RAG post chunking and embedding pipeline (backend)**
  - **Source:** ADR-0082
  - **Status:** Ready (depends on Story 9.7)
  - **As a** backend engineer,
  - **I want** `RAGChunkingService` and an async `RAGIndexRequestedEvent` to chunk and embed posts after enrichment,
  - **so that** the vector store stays in sync with `social_posts` without blocking ingestion.
  - **Acceptance Criteria:**
    - `RAGChunkingService.split(post)` produces overlapping chunks from `body_markdown` and enrichment metadata.
    - `AIProviderConnector.embed(chunks)` or a dedicated embedding model is wired into the pipeline.
    - `RAGIndexRequestedEvent` is emitted after `enrichPost()` and consumed by a worker.
    - `rag_chunks_sync` tracks `post_id`, `last_indexed_at`, `chunk_count`, and `store_id` per tenant.
    - Failures are retried but do not block the main ingestion pipeline.

- **Story 9.7 — RAGConnector provider abstraction (backend)**
  - **Source:** ADR-0081
  - **Status:** Ready
  - Defines the `RAGConnector` interface that this pipeline depends on.

- **Story 9.9 — RAG vector-store RLS and metadata (backend)**
  - **Source:** ADR-0083
  - **Status:** Ready (depends on Story 9.7)
  - Defines the metadata and tenant-isolation rules for stored chunks.

### Appendix D: Missing or Missing-Referenced Materials

- A `docs/product-research/reports/28-semantic-search-rag-deep-research.md` file was not found in the repository. If a deep-research brief is produced later, it should be linked here and its findings merged into Section 12 and Section 8.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
