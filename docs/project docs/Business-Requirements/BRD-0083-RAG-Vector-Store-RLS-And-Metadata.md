# BRD-0083: RAG Vector-Store RLS and Metadata

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG Vector-Store RLS and Metadata — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-27 |
| Author(s) | BRD Writer / AI Architect |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved (Derived from Accepted ADR-0083) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0083, feature design 28-semantic-search-rag, and Story 9.9 |
| 0.2 | 2026-08-25 | BRD Writer Agent | Aligned with ADR-0081/0083 architectural-review revision: chunk text is now stored as `RAGChunkMetadata.content` |
| 1.0 | 2026-08-27 | AI Architect | Released for implementation: Mandates index pre-filtering (recall protection), targeted metadata updates (`updateMetadata`), content redaction lifecycle, deterministic batch deletions, and payload bounds (< 4 KB). |

---

## 2. Executive Summary

The platform introduces a tenant-scoped, vector-backed semantic search layer (RAG) enabling users to search and ask questions across the full text of ingested posts. Because vector stores are flat indexes shared across all tenants, a strict metadata and isolation scheme is required to prevent cross-tenant data leakage.

This BRD translates the accepted architecture of ADR-0083 into business and functional requirements. It mandates strict query-time `tenant_id` pre-filtering, vector index pre-filtering to prevent candidate recall drop-off, targeted metadata patching without re-embedding for human-in-the-loop overrides (ADR-0071), deterministic vector deletion, and content redaction lifecycles.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | **Enforce Absolute Tenant Isolation** | Zero cross-tenant data leakage in vector search contract tests via mandatory `tenant_id` pre-filtering. |
| 2 | **Guarantee High Search Recall & Accurate Ranking** | Mandate vector index pre-filtering (prior to k-NN graph traversal) to eliminate post-filtering candidate truncation. |
| 3 | **Minimize Write Amplification & LLM Cost** | Enable metadata-only updates (`updateMetadata`) for sentiment, topics, and watchlist changes without re-computing embeddings. |
| 4 | **Maintain Privacy & Content Lifecycle Compliance** | Content edits and redactions in `social_posts` immediately purge and replace derived vector copies; tenant offboarding cascades cleanly. |
| 5 | **Eliminate SQL Latency in RAG Generation** | Direct storage of chunk text payload (`content`) in metadata enables zero-SQL round-trip Q&A answers and summaries. |

---

## 4. Scope

### 4.1 In Scope
- Mandatory metadata schema: `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload <= 256 tokens / ~1.5 KB), `platform_id` (typed `PlatformId`), `published_at`, `watchlist_ids`, `sentiment`, `topics`.
- Mandatory index-level `tenant_id` equality pre-filtering on every `RAGConnector.search()` call.
- Mandatory vector index pre-filtering for `platformId`, `sentiment`, `watchlistIds`, `topics`, and `dateRange`, with $k \times 3$ over-fetching fallback if a store lacks native array-any filtering.
- Targeted metadata patching API: `RAGConnector.updateMetadata(tenantId, postId, partialMetadata)`.
- Content modification and redaction lifecycle: `deletePost()` followed by fresh chunking/embedding.
- Deterministic vector ID scheme `${tenantId}:${postId}:${chunkIndex}` and batch delete arrays.
- Periodic reconciliation worker scanning `rag_chunks_sync` to clean orphaned vector records.

### 4.2 Out of Scope
- `RAGConnector` provider interface abstraction (covered by ADR-0081 / BRD-0081).
- Text chunking algorithms and Azure OpenAI embedding pipelines (covered by ADR-0082 / BRD-0082).
- REST API search and Q&A endpoints `POST /v1/rag/search` and `POST /v1/rag/ask` (covered by ADR-0084).
- Frontend search and exploration UI components (covered by ADR-0085).

---

## 5. Detailed Business Requirements

### BR-01: Metadata Schema & Payload Constraints
- Every vector record must carry the complete `RAGChunkMetadata` envelope.
- Total metadata payload size per vector record must not exceed 4 KB (8 KB hard ceiling).

### BR-02: Index-Level Pre-Filtering & Recall Protection
- All search queries must execute filtering *inside* the vector index during nearest neighbor candidate retrieval.
- Third-party stores lacking native array-any matching on `watchlist_ids` must over-fetch by at least $3\times$ ($k \times 3$) to prevent returning truncated candidate sets.

### BR-03: Low-Cost Metadata Mutability
- The system must support updating sentiment (e.g. human override per ADR-0071), topics, or watchlist assignments without re-calling the embedding model.
- Vector connectors supporting partial updates (Pinecone, pgvector) must update metadata in-place.

### BR-04: Strict Privacy & Redaction Parity
- Modifying or deleting a post in `social_posts` must trigger immediate vector purge (`deletePost`) and re-embedding if content was modified.
- No PII (author names, profile URLs, avatars) beyond public post body text may be stored in vector metadata.

---

## 6. Non-Functional Requirements

- **Security & RLS**: All search operations strictly require resolved tenant context (`req.identity.tenantId`). Cross-tenant search queries are structurally rejected.
- **Latency**: Storing chunk text in metadata guarantees single-round-trip retrieval for RAG synthesis without secondary SQL queries.
- **Traceability**: All vector records deterministically link back to `social_posts.id` and `rag_chunks_sync.chunk_count`.