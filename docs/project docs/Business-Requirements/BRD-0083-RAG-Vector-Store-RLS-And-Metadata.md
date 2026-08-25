# BRD-0083: RAG Vector-Store RLS and Metadata

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG Vector-Store RLS and Metadata — Business Requirements Document |
| Version | 0.2 |
| Date | 2026-08-25 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft for review — ADR-0083 is currently Proposed |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0083, feature design 28-semantic-search-rag, and Story 9.9 |
| 0.2 | 2026-08-25 | BRD Writer Agent | Aligned with ADR-0081/0083 architectural-review revision: chunk text is now stored as `RAGChunkMetadata.content` (derived copy, `social_posts` remains source of truth); `RAGFilter` shape aligned to ADR-0081 canonical form (`platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange.from/to`); vector ID scheme `${tenantId}:${postId}:${chunkIndex}` referenced |

---

## 2. Executive Summary

The platform is introducing a tenant-scoped, vector-backed semantic search layer (RAG) so users can search and ask questions across the full text of ingested posts. Because vector stores are typically flat indexes shared across all tenants, a separate metadata and isolation scheme is required to keep one tenant's data from appearing in another tenant's search results.

This BRD covers the metadata schema and row-level-security (RLS) rules for the RAG vector store as described in ADR-0083. It defines the mandatory metadata fields on every vector record, the `tenant_id` equality filter that must accompany every search, the query filters exposed to users, and the deletion/offboarding rules that keep the derived vector index in sync with the source `social_posts` table. The RAG feature overall remains in Proposed state; this document is a draft for review and may change if the parent ADR is revised or rejected.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enforce tenant isolation in the RAG vector index at the same level as database RLS | Every search returns only records owned by the caller's `tenant_id`; zero cross-tenant leakage in contract tests |
| 2 | Enable rich, query-time filtering for semantic search | `platformId`, `sentiment`, `watchlistIds`, `topics`, and `dateRange` filters operate without joining back to `social_posts` at query time |
| 3 | Maintain PII and source-of-truth discipline | No PII beyond public post content is stored in the vector store; chunk text is stored as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth); `author` and other PII are never stored |
| 4 | Keep the vector index consistent with the rest of the tenant lifecycle | Post deletion and tenant offboarding remove the corresponding vector records within defined SLAs |

---

## 4. Scope

### 4.1 In Scope

- Mandatory metadata fields on every RAG vector record: `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload), `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`.
- A tenant-equality metadata filter applied on every `RAGConnector.search()` call (`tenant_id` comes from the mandatory `tenantId` parameter, never from `RAGFilter`).
- The `RAGFilter` query contract (canonical, provider-agnostic shape per ADR-0081): `platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange` (`from`/`to`).
- The deterministic vector ID convention `${tenantId}:${postId}:${chunkIndex}` (defined in ADR-0081), enabling predictable deletes and idempotent re-indexing.
- Deletion and offboarding hooks: `RAGConnector.deletePost(tenantId, postId)` and `RAGConnector.deleteTenant(tenantId)`.
- A reconciliation job that removes orphan vector records no longer present in `social_posts`.
- Explicit exclusion of PII beyond public post content from the vector store; chunk text is stored as a derived `content` copy only.

### 4.2 Out of Scope

- The `RAGConnector` interface itself (covered by ADR-0081).
- Post chunking, embedding model selection, and the indexing pipeline (covered by ADR-0082).
- The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` endpoint contracts (covered by ADR-0084).
- The admin UI search/ask components and loading patterns (covered by ADR-0085).
- Selection of the default vector-store provider (Pinecone, Azure AI Search, or pgvector).

### 4.3 Assumptions

- The chosen vector store supports metadata on each vector record and at least equality filtering on metadata fields.
- `social_posts` remains the source of truth; the vector store is a derived index that can be rebuilt.
- Watchlist, topic, and sentiment enrichment values are available at the time a post is chunked and indexed.
- `published_at` is available in ISO 8601 form for every indexed post.

### 4.4 Constraints

- Vector-store metadata size limits may constrain how many fields or how large `watchlist_ids`, `topics`, and the `content` chunk-text payload can be per record.
- Tenant isolation must be enforced at query time; no per-tenant index is required, but namespaces/indices may be used as defense in depth only.
- The vector store must not hold `author` or other PII beyond public post content; chunk text is stored as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user of semantic search | High | Confident that search results are scoped to the right tenant and filters return accurate subsets |
| Topic-Center-Analyst | Primary end user of concept-related exploration | High | Reliable topic and date filters on vector search |
| Tenant-Brand-Reputation-Manager | Primary end user of emerging-narrative discovery | High | No leakage of another tenant's posts in search results |
| Platform Administrator | Operator of the vector index | Medium | Clear offboarding and deletion rules to satisfy tenant-data obligations |
| Backend Engineer | Implements `RAGConnector` and metadata rules | High | Explicit, non-bypassable `tenant_id` filter and metadata schema |
| Performance Review Agent | Monitors cost and latency | Low | Visibility into metadata overhead and query-time filter cost |

---

## 6. Current State (As-Is)

**Current process:**

- Tenant RLS is already enforced at the database layer on `social_posts`, `watchlists`, and other relational tables (ADR-0015 and ADR-0032).
- The RAG feature is in design; ADR-0081 defines the `RAGConnector` abstraction, and ADR-0082 defines the chunking/embedding pipeline.
- Vector stores are typically flat indexes; they do not natively understand multi-tenant boundaries unless each record carries a tenant discriminator and every query filters by it.

**Pain points:**

- A flat vector index without per-record `tenant_id` metadata would allow search results to leak across tenants.
- Filtering by `watchlistIds`, `platformId`, `topics`, or `dateRange` at query time requires sufficient metadata on each vector record; otherwise every candidate must be joined back to `social_posts`, defeating the performance benefit of the vector index.
- Tenant offboarding and post deletion currently delete relational rows, but a separate vector store requires explicit deletion hooks or orphan records will remain.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Every chunk written to the vector store carries a metadata envelope that includes `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload), `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics`.
2. Every `RAGConnector.search()` call always applies a metadata equality filter `tenant_id == caller.tenant_id` before returning any results; `tenant_id` comes from the mandatory `tenantId` parameter, never from `RAGFilter`.
3. Callers may pass a `RAGFilter` with `platformId`, `sentiment`, `watchlistIds`, `topics`, and `dateRange` (`from`/`to`); the connector translates this to vendor-native syntax and applies it as metadata filters where the store supports them, otherwise the `RAGSearchService` post-filters results.
4. When a post is deleted via `DELETE /v1/posts/:id`, `RAGConnector.deletePost(tenantId, postId)` removes the corresponding vector records (predictable id-range delete via `${tenantId}:${postId}:${chunkIndex}` where supported, else metadata-filter delete).
5. When a tenant is offboarded (ADR-0043), `RAGConnector.deleteTenant(tenantId)` removes all of that tenant's vector records.
6. A periodic reconciliation job scans `rag_chunks_sync` and deletes vector records whose `post_id` no longer exists in `social_posts`.
7. The vector store stores chunk text as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth); `author` and other PII are never stored.

**Expected capabilities:**

- Tenant-isolated semantic search that is consistent with existing database RLS.
- Fast, metadata-driven filtering for watchlists, platforms, topics, sentiment, and date ranges.
- Citation back to the original `social_posts` row via `post_id` and `chunk_index`.
- Clean data lifecycle: post deletion and tenant offboarding propagate to the vector index.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Every vector record shall include `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload), `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics` metadata | Must | Contract test verifies each record has all mandatory fields on upsert | Product Owner |
| BR-002 | `RAGConnector.search()` shall always apply a `tenant_id == caller.tenant_id` metadata equality filter; `tenant_id` comes from the mandatory `tenantId` parameter, never from `RAGFilter` | Must | No search call succeeds without a tenant filter; cross-tenant search returns zero results | Product Owner |
| BR-003 | The system shall support the canonical `RAGFilter` (ADR-0081) for `platformId`, `sentiment`, `watchlistIds`, `topics`, and `dateRange` (`from`/`to`); the connector translates it to vendor-native syntax | Must | Each filter narrows results to matching metadata values; unsupported store features fall back to `RAGSearchService` post-filtering | Product Owner |
| BR-004 | Post deletion shall remove the deleted post's vector records via the deterministic vector ID scheme `${tenantId}:${postId}:${chunkIndex}` (id-range delete where supported, else metadata-filter delete) | Must | `DELETE /v1/posts/:id` triggers `RAGConnector.deletePost()` and the records are no longer searchable | Product Owner |
| BR-005 | Tenant offboarding shall remove all vector records for that tenant | Must | Offboarding flow triggers `RAGConnector.deleteTenant()` and no records for the tenant remain | Product Owner |
| BR-006 | A periodic reconciliation job shall delete orphan vector records whose `post_id` no longer exists in `social_posts` | Should | Reconciler scans `rag_chunks_sync` and removes dangling records within the configured retention window | Product Owner |
| BR-007 | The vector store shall store chunk text as a derived `content` copy (rebuildable from `social_posts`, which remains the source of truth) and shall not store `author` or other PII beyond public post content | Must | Metadata and stored payload contain `content` (derived public post text), identifiers, dates, labels, and arrays only; no `author` or other PII | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Tenant-equality filter overhead shall not exceed 20% additional latency versus an unfiltered search on the same corpus | Performance | Should | Measured in contract tests with a representative tenant corpus |
| NFR-002 | Metadata payload per vector record shall fit within the chosen vector store's documented metadata size limit | Scalability | Must | Largest expected record is validated against provider limit before production |
| NFR-003 | Vector-store isolation rules shall be enforced by the `RAGConnector` implementation and shall be impossible to bypass through the public API | Security | Must | Static review and contract tests confirm no public path can omit the `tenant_id` filter |
| NFR-004 | Deletion/offboarding operations shall complete within the tenant data-erasure SLA | Compliance | Must | Measured end-to-end from trigger to non-existence of records in vector index |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | There is no "search across all tenants" mode; every `RAGConnector.search()` is scoped to one `tenant_id` (from the mandatory `tenantId` parameter, never from `RAGFilter`). |
| BRU-002 | `watchlist_ids` stored on a vector record is an array; the `watchlistIds` filter matches any record that contains a requested value in that array. |
| BRU-003 | `published_at` is stored as an ISO 8601 string and is used for `dateRange` (`from`/`to`) filtering. |
| BRU-004 | If the vector store supports namespaces or separate indices, they may be used in addition to — but never in place of — the mandatory `tenant_id` metadata filter. |
| BRU-005 | `social_posts` is the source of truth; the vector store stores chunk text as a derived `content` copy (rebuildable from `social_posts`) alongside the embedding and metadata. |
| BRU-006 | `author` and other PII shall not be written to the vector store. |
| BRU-007 | Vector record ids follow `${tenantId}:${postId}:${chunkIndex}` (ADR-0081); re-upserting the same post overwrites the same ids (idempotent re-indexing). |
| BRU-008 | `RAGFilter` is provider-agnostic (ADR-0081 canonical shape); vendor-native filter syntax translation stays inside the connector implementation. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_id` | Tenant identifier, equality-filtered on every search | `tenants` / caller context | Backend / RLS | Tenant identifier |
| `post_id` | Reference back to the `social_posts` row | `social_posts` | Backend | Non-PII foreign key |
| `chunk_index` | Zero-based chunk number within the post | `RAGChunkingService` | Backend | Non-PII |
| `content` | Chunk text payload stored alongside the embedding; derived from `social_posts.body_markdown` (rebuildable); enables direct RAG generation without a secondary SQL lookup | `RAGChunkingService` (derived from `social_posts`) | Backend | Public post content |
| `platform_id` | Connector platform identifier for the post | `social_posts` / connector | Backend | Non-PII |
| `published_at` | ISO 8601 publication timestamp for date-range filters | `social_posts` | Backend | Non-PII |
| `watchlist_ids` | Array of watchlist IDs the post matched at indexing time | `watchlist` matches | Backend | Tenant-internal |
| `sentiment` | Optional sentiment label | Enrichment / ADR-0071 | Backend | Non-PII |
| `topics` | Optional array of topic IDs from clustering | AI topic clustering | Backend | Non-PII |
| `rag_chunks_sync` | Tracks `post_id`, `tenant_id`, `chunk_count`, `embedding_model`, `status` (`synced`/`pending`/`failed`), `last_indexed_at`, `error_message` per tenant (schema defined in ADR-0082 Decision §5) | New sync table | Backend | Tenant-internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Vector records per tenant | Track indexing volume and cost per tenant | Platform Administrator | Daily |
| Search latency by filter type | Ensure metadata filters do not regress semantic search performance | Performance Review Agent | Real-time / hourly |
| Orphan vector records | Measure effectiveness of deletion/offboarding and reconciliation | Backend Engineer | Daily |
| Cross-tenant query audit | Confirm every search contains a `tenant_id` filter | Security / Compliance | Continuous |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Vector store metadata size limits force truncation of `watchlist_ids` or `topics` | Medium | High | Size budget the metadata payload; validate largest record against provider limit; trim or compress arrays if needed | Technical Lead |
| R-002 | A bypass of the `tenant_id` filter causes cross-tenant data leakage | Low | Critical | Enforce filter inside `RAGConnector.search()` only; contract-test every path; no public parameter can override `tenant_id` | Technical Lead |
| R-003 | Stored `content` chunk-text payload increases vector-record size and metadata-budget pressure | Medium | Medium | Bound `content` by the chunk size (ADR-0082 default 256 tokens); validate largest record against provider metadata limit; `social_posts` remains the source of truth for rebuilds | Technical Lead |
| R-004 | Orphan vector records remain after post deletions or retention policy changes | Medium | High | Implement `deletePost`, `deleteTenant`, and periodic reconciliation; audit `rag_chunks_sync` | Backend Engineer |
| R-005 | Metadata filter support varies across providers, causing inconsistent `RAGFilter` behavior | Medium | Medium | Abstract filter translation in `RAGConnector`; post-filter unsupported filters in `RAGSearchService` | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0081 `RAGConnector` provider abstraction | Internal ADR | Product Owner | Accepted before implementation |
| D-002 | ADR-0082 post chunking and embedding pipeline | Internal ADR | Product Owner | Accepted before implementation |
| D-003 | ADR-0015 tenant RLS at database layer | Internal ADR (Accepted) | Product Owner | Already in place |
| D-004 | ADR-0043 tenant deletion / offboarding | Internal ADR | Product Owner | Accepted before implementation |
| D-005 | Story 9.7 `RAGConnector` provider backend | Internal Story | Product Owner | Ready |
| D-006 | Story 9.9 RAG vector-store RLS and metadata backend | Internal Story | Product Owner | Ready (this BRD) |
| D-007 | Vector store provider selection and provisioning | External / Infrastructure | Platform Administrator | Before implementation |

---

## 14. Acceptance Criteria

- Every vector record written to the vector store contains the mandatory metadata fields `tenant_id`, `post_id`, `chunk_index`, `content` (chunk text payload), `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics`.
- `RAGConnector.search()` rejects or always applies a `tenant_id == caller.tenant_id` equality filter (from the mandatory `tenantId` parameter); no call can return chunks from a different tenant.
- `RAGFilter` fields (`platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange` `from`/`to`) return only matching records when the store supports the filter, or are post-filtered by `RAGSearchService` otherwise.
- `DELETE /v1/posts/:id` removes the post's vector records via `RAGConnector.deletePost(tenantId, postId)` (id-range delete via `${tenantId}:${postId}:${chunkIndex}` where supported, else metadata-filter delete).
- Tenant offboarding removes all vector records for the tenant via `RAGConnector.deleteTenant(tenantId)`.
- The vector store stores chunk text as a derived `content` copy (rebuildable from `social_posts`); it contains no `author` field and no other PII beyond public post content.
- Search results can be cited back to the original `social_posts` row using `post_id` and `chunk_index`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation — using a vector-backed retrieval step to ground generative answers in tenant posts. |
| Vector store | A database optimized for storing and querying high-dimensional embeddings (e.g., Pinecone, Azure AI Search, pgvector). |
| Metadata | Additional fields attached to each vector record, used for tenant isolation and query-time filtering. |
| `RAGConnector` | The provider-agnostic interface that abstracts upsert, search, delete, and status operations across vector stores. |
| `RAGFilter` | The caller-supplied filter object that narrows search by watchlist, platform, topic, sentiment, or date range. |
| `rag_chunks_sync` | A relational tracking table that records which posts have been indexed, when, and how many chunks were produced. |

---

## 16. Appendices

### Appendix A — Reference Documents

- `docs/adr/0083-rag-vector-store-rls-and-metadata.md` (source ADR, currently Proposed)
- `docs/product-research/feature-designs/28-semantic-search-rag.md`
- `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0081` (`RAGConnector`), `ADR-0082` (chunking and embedding), `ADR-0015` (tenant RLS), `ADR-0043` (tenant deletion)

### Appendix B — Related User Stories

- **Story 9.9 — RAG vector-store RLS and metadata (backend)**
  - *As a* backend engineer, *I want* vector records to carry tenant-scoped metadata and a mandatory `tenant_id` filter on every search, *so that* a multi-tenant vector index cannot leak data across tenants.
  - Key acceptance criteria: mandatory metadata fields on every record; `tenant_id` equality filter on every `search()`; `RAGFilter` support; `deletePost` and `deleteTenant` hooks; no PII beyond public post content.

### Appendix C — Missing Sources

- No `docs/product-research/reports/<feature>-deep-research.md` file exists for semantic search / RAG; the competitive/deep-research brief is not available at this time.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
