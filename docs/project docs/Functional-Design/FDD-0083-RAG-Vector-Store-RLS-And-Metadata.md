# BRD-0083: RAG Vector-Store RLS and Metadata

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0083: RAG Vector-Store RLS and Metadata |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0083-rag-vector-store-rls-and-metadata.md, ../Business-Requirements/BRD-0083-RAG-Vector-Store-RLS-And-Metadata.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0083-rag-vector-store-rls-and-metadata.md and the business requirements in BRD-0083-RAG-Vector-Store-RLS-And-Metadata.md into functional design for **RAG Vector Store RLS And Metadata**.
The platform is introducing a tenant-scoped, vector-backed semantic search layer (RAG) so users can search and ask questions across the full text of ingested posts. Because vector stores are typically flat indexes shared across all tenants, a separate metadata and isolation scheme is required to keep one tenant's data from appearing in another tenant's search results.

This BRD covers the metadata schema and row-level-security (RLS) rules for the RAG vector store as described in ADR-0083. It defines the mandatory metadata fields on every vector record, the `tenant_id` equality filter that must accompany every search, the query filters exposed to users, and the deletion/offboarding rules that keep the derived vector index in sync with the source `social_posts` table. The RAG feature overall remains in Proposed state; this document is a draft for review and may change if the parent ADR is revised or rejected.

---

### 2.2 Scope
**In scope:**
- Mandatory metadata fields on every RAG vector record: `tenant_id`, `post_id`, `chunk_index`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`.
- A tenant-equality metadata filter applied on every `RAGConnector.search()` call.
- The `RAGFilter` query contract: `watchlistId`, `platformId`, `topicId`, `sentiment`, `dateRange`.
- Deletion and offboarding hooks: `RAGConnector.deletePost(tenantId, postId)` and `RAGConnector.deleteTenant(tenantId)`.
- A reconciliation job that removes orphan vector records no longer present in `social_posts`.
- Explicit exclusion of PII beyond public post content from the vector store.

**Out of scope:**
- The `RAGConnector` interface itself (covered by ADR-0081).
- Post chunking, embedding model selection, and the indexing pipeline (covered by ADR-0082).
- The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` endpoint contracts (covered by ADR-0084).
- The admin UI search/ask components and loading patterns (covered by ADR-0085).
- Selection of the default vector-store provider (Pinecone, Azure AI Search, or pgvector).

## 3. Context and Background
See ADR Context.
The platform is introducing a tenant-scoped, vector-backed semantic search layer (RAG) so users can search and ask questions across the full text of ingested posts. Because vector stores are typically flat indexes shared across all tenants, a separate metadata and isolation scheme is required to keep one tenant's data from appearing in another tenant's search results.

This BRD covers the metadata schema and row-level-security (RLS) rules for the RAG vector store as described in ADR-0083. It defines the mandatory metadata fields on every vector record, the `tenant_id` equality filter that must accompany every search, the query filters exposed to users, and the deletion/offboarding rules that keep the derived vector index in sync with the source `social_posts` table. The RAG feature overall remains in Proposed state; this document is a draft for review and may change if the parent ADR is revised or rejected.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enforce tenant isolation in the RAG vector index at the same level as database RLS | Every search returns only records owned by the caller's `tenant_id`; zero cross-tenant leakage in contract tests |
| 2 | Enable rich, query-time filtering for semantic search | `watchlistId`, `platformId`, `topicId`, `sentiment`, and `dateRange` filters operate without joining back to `social_posts` at query time |
| 3 | Maintain PII and source-of-truth discipline | No PII beyond public post content is stored in the vector store; original chunk text is reconstructed from `social_posts` |
| 4 | Keep the vector index consistent with the rest of the tenant lifecycle | Post deletion and tenant offboarding remove the corresponding vector records within defined SLAs |

---

**Positive consequences (from ADR):**
1. **Strong tenant isolation:** every search is filtered by `tenant_id`, consistent with RLS elsewhere.
2. **Rich filtering:** metadata enables the watchlist, platform, topic, and date filters in `POST /v1/rag/search`.
3. **Reconstruction cost:** the UI must fetch `social_posts` to show the original chunk text. This is a deliberate trade-off for PII safety.
4. **Metadata limits:** vector stores impose size limits on metadata. The chosen set fits within common limits but may need trimming if new fields are added.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Every vector record shall include `tenant_id`, `post_id`, `chunk_index`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics` metadata | Must | Contract test verifies each record has all mandatory fields on upsert | Product Owner |
| BR-002 | `RAGConnector.search()` shall always apply a `tenant_id == caller.tenant_id` metadata equality filter | Must | No search call succeeds without a tenant filter; cross-tenant search returns zero results | Product Owner |
| BR-003 | The system shall support `RAGFilter` for `watchlistId`, `platformId`, `topicId`, `sentiment`, and `dateRange` | Must | Each filter narrows results to matching metadata values; unsupported store features fall back to `RAGSearchService` post-filtering | Product Owner |
| BR-004 | Post deletion shall remove the deleted post's vector records | Must | `DELETE /v1/posts/:id` triggers `RAGConnector.deletePost()` and the records are no longer searchable | Product Owner |
| BR-005 | Tenant offboarding shall remove all vector records for that tenant | Must | Offboarding flow triggers `RAGConnector.deleteTenant()` and no records for the tenant remain | Product Owner |
| BR-006 | A periodic reconciliation job shall delete orphan vector records whose `post_id` no longer exists in `social_posts` | Should | Reconciler scans `rag_chunks_sync` and removes dangling records within the configured retention window | Product Owner |
| BR-007 | The vector store shall not store original chunk text or author PII beyond public post content | Must | Metadata and stored payload contain only identifiers, dates, labels, and arrays; original text is reconstructed from `social_posts` | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user of semantic search | High | Confident that search results are scoped to the right tenant and filters return accurate subsets |
| Topic-Center-Analyst | Primary end user of concept-related exploration | High | Reliable topic and date filters on vector search |
| Tenant-Brand-Reputation-Manager | Primary end user of emerging-narrative discovery | High | No leakage of another tenant's posts in search results |
| Platform Administrator | Operator of the vector index | Medium | Clear offboarding and deletion rules to satisfy tenant-data obligations |
| Backend Engineer | Implements `RAGConnector` and metadata rules | High | Explicit, non-bypassable `tenant_id` filter and metadata schema |
| Performance Review Agent | Monitors cost and latency | Low | Visibility into metadata overhead and query-time filter cost |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.9 | epic-9-adr-0077-to-0085.md | As backend engineer, I want vector records to carry tenant-scoped metadata and a mandatory `tenant_id` filter on every search, so that a multi-tenant vector ... | Every vector record has metadata: `tenant_id`, `post_id`, `chunk_index`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, `topics`.; `RAGConnecto... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenant_id` | Tenant identifier, equality-filtered on every search | `tenants` / caller context | Backend / RLS | Tenant identifier |
| `post_id` | Reference back to the `social_posts` row | `social_posts` | Backend | Non-PII foreign key |
| `chunk_index` | Zero-based chunk number within the post | `RAGChunkingService` | Backend | Non-PII |
| `platform_id` | Connector platform identifier for the post | `social_posts` / connector | Backend | Non-PII |
| `published_at` | ISO 8601 publication timestamp for date-range filters | `social_posts` | Backend | Non-PII |
| `watchlist_ids` | Array of watchlist IDs the post matched at indexing time | `watchlist` matches | Backend | Tenant-internal |
| `sentiment` | Optional sentiment label | Enrichment / ADR-0071 | Backend | Non-PII |
| `topics` | Optional array of topic IDs from clustering | AI topic clustering | Backend | Non-PII |
| `rag_chunks_sync` | Tracks `post_id`, `last_indexed_at`, `chunk_count`, `store_id` per tenant | New sync table | Backend | Tenant-internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | There is no "search across all tenants" mode; every `RAGConnector.search()` is scoped to one `tenant_id`. |
| BRU-002 | `watchlist_ids` stored on a vector record is an array; the `watchlistId` filter matches any record that contains the requested value in that array. |
| BRU-003 | `published_at` is stored as an ISO 8601 string and is used for `dateRange` filtering. |
| BRU-004 | If the vector store supports namespaces or separate indices, they may be used in addition to — but never in place of — the mandatory `tenant_id` metadata filter. |
| BRU-005 | `social_posts` is the only source of truth for original chunk text; the vector store stores only the embedding and metadata. |
| BRU-006 | `author` and other PII shall not be written to the vector store. |

---

## 9. Interfaces and Integrations
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

- The chosen vector store supports metadata on each vector record and at least equality filtering on metadata fields.
- `social_posts` remains the source of truth; the vector store is a derived index that can be rebuilt.
- Watchlist, topic, and sentiment enrichment values are available at the time a post is chunked and indexed.
- `published_at` is available in ISO 8601 form for every indexed post.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Tenant-equality filter overhead shall not exceed 20% additional latency versus an unfiltered search on the same corpus | Performance | Should | Measured in contract tests with a representative tenant corpus |
| NFR-002 | Metadata payload per vector record shall fit within the chosen vector store's documented metadata size limit | Scalability | Must | Largest expected record is validated against provider limit before production |
| NFR-003 | Vector-store isolation rules shall be enforced by the `RAGConnector` implementation and shall be impossible to bypass through the public API | Security | Must | Static review and contract tests confirm no public path can omit the `tenant_id` filter |
| NFR-004 | Deletion/offboarding operations shall complete within the tenant data-erasure SLA | Compliance | Must | Measured end-to-end from trigger to non-existence of records in vector index |

---

## 11. Error Handling and Exceptions
1. **Strong tenant isolation:** every search is filtered by `tenant_id`, consistent with RLS elsewhere.
2. **Rich filtering:** metadata enables the watchlist, platform, topic, and date filters in `POST /v1/rag/search`.
3. **Reconstruction cost:** the UI must fetch `social_posts` to show the original chunk text. This is a deliberate trade-off for PII safety.
4. **Metadata limits:** vector stores impose size limits on metadata. The chosen set fits within common limits but may need trimming if new fields are added.

---

## 12. Assumptions and Dependencies
- The chosen vector store supports metadata on each vector record and at least equality filtering on metadata fields.
- `social_posts` remains the source of truth; the vector store is a derived index that can be rebuilt.
- Watchlist, topic, and sentiment enrichment values are available at the time a post is chunked and indexed.
- `published_at` is available in ISO 8601 form for every indexed post.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Vector store metadata size limits force truncation of `watchlist_ids` or `topics` | Medium | High | Size budget the metadata payload; validate largest record against provider limit; trim or compress arrays if needed | Technical Lead |
| R-002 | A bypass of the `tenant_id` filter causes cross-tenant data leakage | Low | Critical | Enforce filter inside `RAGConnector.search()` only; contract-test every path; no public parameter can override `tenant_id` | Technical Lead |
| R-003 | Reconstruction of chunk text from `social_posts` adds UI latency | Medium | Medium | Cache frequently cited posts; index `post_id`/`chunk_index` lookup; document trade-off in UX | Product Owner |
| R-004 | Orphan vector records remain after post deletions or retention policy changes | Medium | High | Implement `deletePost`, `deleteTenant`, and periodic reconciliation; audit `rag_chunks_sync` | Backend Engineer |
| R-005 | Metadata filter support varies across providers, causing inconsistent `RAGFilter` behavior | Medium | Medium | Abstract filter translation in `RAGConnector`; post-filter unsupported filters in `RAGSearchService` | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0083-rag-vector-store-rls-and-metadata.md`
- BRD: `../Business-Requirements/BRD-0083-RAG-Vector-Store-RLS-And-Metadata.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above