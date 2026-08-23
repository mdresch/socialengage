# Business Requirements Document — RAG Connector Provider Abstraction

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — RAG Connector Provider Abstraction |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0081-rag-connector-provider-abstraction.md, ../Business-Requirements/BRD-0081-RAG-Connector-Provider-Abstraction.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0081-rag-connector-provider-abstraction.md and the business requirements in BRD-0081-RAG-Connector-Provider-Abstraction.md into functional design for **RAG Connector Provider Abstraction**.
Semantic search and RAG (Retrieval-Augmented Generation) are planned to move SocialEngage from keyword search to a tenant-scoped knowledge layer over public social posts. Before the platform can expose natural-language search or “Ask” features, it needs a stable, provider-agnostic way to store and query vector embeddings.

This BRD defines the business need for a `RAGConnector` provider abstraction. It authorizes a single interface that hides the differences between vector stores such as Pinecone, Azure AI Search, and pgvector so that ingestion, search, and admin layers do not become coupled to any one vendor. The abstraction also enforces multi-tenant isolation by contract, requiring every operation to carry and respect a `tenant_id` boundary.

For stakeholders, the immediate value is **portability**: the platform can start with one vector store and swap or add another later without rebuilding the semantic-search pipeline. It also establishes the foundation for downstream features such as metric explainability, daily-digest summaries, topic-evolution timelines, and composer mention suggestions.

---

### 2.2 Scope
**In scope:**
- A `RAGConnector` interface defining `upsert`, `search`, `deletePost`, `deleteTenant`, and `status` operations.
- A `RAGChunkMetadata` schema carrying `tenant_id`, `post_id`, `chunk_index`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics`.
- Mandatory `tenant_id` metadata filtering on every `search()` implementation.
- Support for one initial vector-store provider at platform deployment time (Pinecone, Azure AI Search, or pgvector).
- Storage of vector-store credentials and endpoint/index names in the existing `platform_credentials` envelope with `credential_type = 'rag'`.
- `status()` returning indexing lag, chunk count, and store-level errors.

**Out of scope:**
- The post-chunking and embedding pipeline (covered by ADR-0082 / Story 9.8).
- Vector-store RLS and deletion-sync rules beyond the `tenant_id` filter (covered by ADR-0083 / Story 9.9).
- The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` REST contracts (covered by ADR-0084 / Story 9.10).
- The admin UI search box, results list, and “Ask” panel (covered by ADR-0085 / Story 9.11).

## 3. Context and Background
See ADR Context.
Semantic search and RAG (Retrieval-Augmented Generation) are planned to move SocialEngage from keyword search to a tenant-scoped knowledge layer over public social posts. Before the platform can expose natural-language search or “Ask” features, it needs a stable, provider-agnostic way to store and query vector embeddings.

This BRD defines the business need for a `RAGConnector` provider abstraction. It authorizes a single interface that hides the differences between vector stores such as Pinecone, Azure AI Search, and pgvector so that ingestion, search, and admin layers do not become coupled to any one vendor. The abstraction also enforces multi-tenant isolation by contract, requiring every operation to carry and respect a `tenant_id` boundary.

For stakeholders, the immediate value is **portability**: the platform can start with one vector store and swap or add another later without rebuilding the semantic-search pipeline. It also establishes the foundation for downstream features such as metric explainability, daily-digest summaries, topic-evolution timelines, and composer mention suggestions.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Avoid vendor lock-in for vector storage | The platform can swap the active vector-store provider with no changes to `RAGChunkingService` or `RAGSearchService` |
| 2 | Preserve strict tenant isolation in vector indexes | Every vector query enforces a `tenant_id` equality filter; no cross-tenant retrieval is possible through the connector |
| 3 | Reuse existing credential and connector patterns | `RAGConnector` uses the same ownership-tier and credential-envelope model as `SocialConnector` and `AIProviderConnector` |
| 4 | Enable downstream RAG-powered features | ADRs 0082–0085 and dependent features (explainability, digest, topic drift, composer suggestions) can build on the interface |

---

**Positive consequences (from ADR):**
1. **Provider portability:** the platform is not locked into a single vector store.
2. **Consistent credential handling:** `RAGConnector` uses the same envelope and ownership tiers as `SocialConnector` and `AIProviderConnector`.
3. **Tenant isolation by contract:** the interface makes `tenant_id` a required parameter for every operation.
4. **One more runtime dependency:** the platform needs a real vector-store account, but only one provider is required.
5. **Foundation for downstream features:** `28-semantic-search-rag`, `24-daily-digest-email`, `22-metric-explainability`, and `25-topic-evolution-timeline` can all build on this interface.

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The platform shall expose a `RAGConnector` interface with `upsert`, `search`, `deletePost`, `deleteTenant`, and `status` operations | Must | Interface is defined and one provider implements it end-to-end | Product Owner |
| BR-002 | Every `search()` call shall filter records by `tenant_id` using a mandatory equality filter | Must | Cross-tenant queries return only the caller's records; unfiltered search is not possible | Product Owner |
| BR-003 | The platform shall support at least one initial vector-store provider (Pinecone, Azure AI Search, or pgvector) chosen at deployment | Must | A single provider can be configured and used for upsert, search, and delete | Product Owner |
| BR-004 | Vector-store credentials and endpoint/index names shall be stored in the existing `platform_credentials` envelope with `credential_type = 'rag'` | Must | Credentials follow the same ownership-tier rules as other connectors | Product Owner |
| BR-005 | The system shall provide a `status()` operation that reports indexing lag, chunk count, and store-level errors | Should | Operations can observe connector health without provider-specific tooling | Product Owner |
| BR-006 | `RAGConnector` shall allow future providers to be added without changing `RAGChunkingService` or `RAGSearchService` | Should | A new provider is added by implementing the interface and registering it | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Backend Engineer | Builds and maintains `RAGConnector` implementations | High | Clear interface contract, reusable credential handling |
| Tenant-Business-Analyst | End user of future semantic search | High | Meaningful, tenant-scoped search and Q&A results |
| Topic-Center-Analyst | Explores conceptually related posts | High | Confidence that retrieved posts belong to the tenant |
| Tenant-Brand-Reputation-Manager | Discovers emerging narratives | Medium | Fast, relevant results and no data leakage |
| Platform Admin | Operates the vector-store account | Medium | One provider to configure, monitor, and rotate credentials for |
| Performance Review Agent | Reviews latency and cost | Medium | Indexing lag, chunk count, and quota usage visible |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.7 | epic-9-adr-0077-to-0085.md | As backend engineer, I want a `RAGConnector` interface and at least one concrete provider (e.g. Pinecone or pgvector) for upsert/search/delete, so that the s... | `RAGConnector` interface defines `upsert()`, `search()`, `deletePost()`, `deleteTenant()`, and `status()`.; Configuration is stored per tenant in `platform_c... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `RAGChunkMetadata.tenant_id` | Tenant identifier used for isolation filters | `social_posts.tenant_id` | Platform | Internal |
| `RAGChunkMetadata.post_id` | Original post reference for back-linking and rebuilds | `social_posts.id` | Platform | Internal |
| `RAGChunkMetadata.chunk_index` | Position of the chunk inside the post | `RAGChunkingService` | Platform | Internal |
| `RAGChunkMetadata.platform_id` | Source platform of the post | `social_posts.platform_id` | Platform | Internal |
| `RAGChunkMetadata.published_at` | Original post publish timestamp | `social_posts.published_at` | Platform | Internal |
| `RAGChunkMetadata.watchlist_ids` | Watchlists the post matched | `social_posts` / watchlist matching | Platform | Internal |
| `RAGChunkMetadata.sentiment` | Sentiment label from enrichment | `enrichment.sentiment` | Platform | Internal |
| `RAGChunkMetadata.topics` | Topic labels from enrichment | `enrichment.topics` | Platform | Internal |
| `platform_credentials` (type `rag`) | Endpoint, index, and key for the vector store | ADR-0028 credential envelope | Platform Admin | Secret |
| `rag_chunks_sync` | Tracks `post_id`, `last_indexed_at`, `chunk_count`, and `store_id` per tenant | New table | Platform | Internal |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A `tenant_id` metadata filter is mandatory on every `RAGConnector.search()` call and cannot be bypassed. |
| BRU-002 | Vector records are derived from `social_posts`; the source of truth remains the relational database. |
| BRU-003 | Vector-store credentials shall use `credential_type = 'rag'` inside the existing `platform_credentials` envelope. |
| BRU-004 | Only one vector-store provider shall be active in v1, selected at platform deployment time. |
| BRU-005 | No PII beyond public post content may be written to the vector index. |
| BRU-006 | `RAGConnector.deleteTenant()` and `deletePost()` must remove all vector records for the given tenant or post. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `AIProviderConnector` pattern and connector registry (ADR-0002) | Architectural | Technical Lead | Already accepted |
| D-002 | Credential ownership tiers in `platform_credentials` (ADR-0028) | Architectural | Technical Lead | Already accepted |
| D-003 | Tenant RLS and row-level isolation (ADR-0015) | Architectural | Technical Lead | Already accepted |
| D-004 | Feature design `28-semantic-search-rag.md` | Reference | Product Owner | 2026-08-23 |
| D-005 | `RAGConnector` provider abstraction implementation (Story 9.7) | Implementation | Technical Lead | Ready |
| D-006 | Chunking and embedding pipeline (ADR-0082 / Story 9.8) | Downstream | Product Owner | Follows ADR-0081 |
| D-007 | Vector-store RLS and metadata sync (ADR-0083 / Story 9.9) | Downstream | Product Owner | Follows ADR-0081 |

---

- One vector-store provider will be selected for v1; multi-provider runtime selection is a v2 consideration.
- The source of truth for posts remains `social_posts`; the vector index is a derived, rebuildable view.
- The platform already uses `platform_credentials` (ADR-0028) and tenant RLS (ADR-0015).
- The connector pattern from `AIProviderConnector` and `SocialConnector` is the adopted organizational standard.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Vector records shall be isolated per tenant using metadata filters on every query | Security | Must | Verified by contract tests for cross-tenant leakage |
| NFR-002 | The `RAGConnector` pattern shall match existing `AIProviderConnector` and `SocialConnector` abstractions | Maintainability | Must | Code review confirms consistent interface, registry, and credential handling |
| NFR-003 | The vector index shall be rebuildable from `social_posts` and `rag_chunks_sync` | Reliability | Should | A documented backfill path exists and is contract-tested |
| NFR-004 | Vector-store operations shall be best-effort and shall not block the ingestion pipeline | Reliability | Should | Ingestion contracts pass when vector upsert is temporarily unavailable |

---

## 11. Error Handling and Exceptions
1. **Provider portability:** the platform is not locked into a single vector store.
2. **Consistent credential handling:** `RAGConnector` uses the same envelope and ownership tiers as `SocialConnector` and `AIProviderConnector`.
3. **Tenant isolation by contract:** the interface makes `tenant_id` a required parameter for every operation.
4. **One more runtime dependency:** the platform needs a real vector-store account, but only one provider is required.
5. **Foundation for downstream features:** `28-semantic-search-rag`, `24-daily-digest-email`, `22-metric-explainability`, and `25-topic-evolution-timeline` can all build on this interface.

---

## 12. Assumptions and Dependencies
- One vector-store provider will be selected for v1; multi-provider runtime selection is a v2 consideration.
- The source of truth for posts remains `social_posts`; the vector index is a derived, rebuildable view.
- The platform already uses `platform_credentials` (ADR-0028) and tenant RLS (ADR-0015).
- The connector pattern from `AIProviderConnector` and `SocialConnector` is the adopted organizational standard.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The v1 vector-store provider is not selected, delaying implementation | Medium | High | Treat provider selection as a deployment-time configuration; any of Pinecone, Azure AI Search, or pgvector satisfies the interface | Product Owner |
| R-002 | Provider-specific tenant isolation is implemented inconsistently | Medium | High | Mandate `tenant_id` metadata filter in the interface contract and enforce it with contract tests | Technical Lead |
| R-003 | Vector-store cost or latency exceeds expectations | Medium | Medium | Set bounded default chunk size and top-k; expose `status()` metrics for quota monitoring | Product Owner |
| R-004 | Credential rotation for a new `rag` type is not supported by existing tooling | Low | Medium | Reuse `platform_credentials` envelope and ownership tiers from ADR-0028 | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0081-rag-connector-provider-abstraction.md`
- BRD: `../Business-Requirements/BRD-0081-RAG-Connector-Provider-Abstraction.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md``
- Deep research: `docs/product-research/reports/28-semantic-search-rag-deep-research.md``
- User stories: see extracted stories above