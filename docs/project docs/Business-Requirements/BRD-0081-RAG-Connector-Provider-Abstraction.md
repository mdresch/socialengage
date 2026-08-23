# Business Requirements Document — RAG Connector Provider Abstraction

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – RAG Connector Provider Abstraction – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft / Review |

> **Note:** ADR-0081 is currently **Proposed** (2026-08-23). This BRD is therefore a **draft for review** and may change when the ADR is accepted or revised.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0081, feature design `28-semantic-search-rag.md`, and Epic 9 user stories |

---

## 2. Executive Summary

Semantic search and RAG (Retrieval-Augmented Generation) are planned to move SocialEngage from keyword search to a tenant-scoped knowledge layer over public social posts. Before the platform can expose natural-language search or “Ask” features, it needs a stable, provider-agnostic way to store and query vector embeddings.

This BRD defines the business need for a `RAGConnector` provider abstraction. It authorizes a single interface that hides the differences between vector stores such as Pinecone, Azure AI Search, and pgvector so that ingestion, search, and admin layers do not become coupled to any one vendor. The abstraction also enforces multi-tenant isolation by contract, requiring every operation to carry and respect a `tenant_id` boundary.

For stakeholders, the immediate value is **portability**: the platform can start with one vector store and swap or add another later without rebuilding the semantic-search pipeline. It also establishes the foundation for downstream features such as metric explainability, daily-digest summaries, topic-evolution timelines, and composer mention suggestions.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Avoid vendor lock-in for vector storage | The platform can swap the active vector-store provider with no changes to `RAGChunkingService` or `RAGSearchService` |
| 2 | Preserve strict tenant isolation in vector indexes | Every vector query enforces a `tenant_id` equality filter; no cross-tenant retrieval is possible through the connector |
| 3 | Reuse existing credential and connector patterns | `RAGConnector` uses the same ownership-tier and credential-envelope model as `SocialConnector` and `AIProviderConnector` |
| 4 | Enable downstream RAG-powered features | ADRs 0082–0085 and dependent features (explainability, digest, topic drift, composer suggestions) can build on the interface |

---

## 4. Scope

### 4.1 In Scope

- A `RAGConnector` interface defining `upsert`, `search`, `deletePost`, `deleteTenant`, and `status` operations.
- A `RAGChunkMetadata` schema carrying `tenant_id`, `post_id`, `chunk_index`, `platform_id`, `published_at`, `watchlist_ids`, `sentiment`, and `topics`.
- Mandatory `tenant_id` metadata filtering on every `search()` implementation.
- Support for one initial vector-store provider at platform deployment time (Pinecone, Azure AI Search, or pgvector).
- Storage of vector-store credentials and endpoint/index names in the existing `platform_credentials` envelope with `credential_type = 'rag'`.
- `status()` returning indexing lag, chunk count, and store-level errors.

### 4.2 Out of Scope

- The post-chunking and embedding pipeline (covered by ADR-0082 / Story 9.8).
- Vector-store RLS and deletion-sync rules beyond the `tenant_id` filter (covered by ADR-0083 / Story 9.9).
- The `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` REST contracts (covered by ADR-0084 / Story 9.10).
- The admin UI search box, results list, and “Ask” panel (covered by ADR-0085 / Story 9.11).

### 4.3 Assumptions

- One vector-store provider will be selected for v1; multi-provider runtime selection is a v2 consideration.
- The source of truth for posts remains `social_posts`; the vector index is a derived, rebuildable view.
- The platform already uses `platform_credentials` (ADR-0028) and tenant RLS (ADR-0015).
- The connector pattern from `AIProviderConnector` and `SocialConnector` is the adopted organizational standard.

### 4.4 Constraints

- Vector records must not store PII beyond the public post content already ingested.
- The abstraction must not allow an unfiltered, cross-tenant index.
- Embedding and search latency must fit within a best-effort async pipeline without blocking ingestion.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Backend Engineer | Builds and maintains `RAGConnector` implementations | High | Clear interface contract, reusable credential handling |
| Tenant-Business-Analyst | End user of future semantic search | High | Meaningful, tenant-scoped search and Q&A results |
| Topic-Center-Analyst | Explores conceptually related posts | High | Confidence that retrieved posts belong to the tenant |
| Tenant-Brand-Reputation-Manager | Discovers emerging narratives | Medium | Fast, relevant results and no data leakage |
| Platform Admin | Operates the vector-store account | Medium | One provider to configure, monitor, and rotate credentials for |
| Performance Review Agent | Reviews latency and cost | Medium | Indexing lag, chunk count, and quota usage visible |

---

## 6. Current State (As-Is)

No provider-agnostic vector-storage contract exists. The `28-semantic-search-rag` feature design describes a tenant-scoped semantic search layer, but without an agreed abstraction the rest of the system would have to embed provider-specific code inside chunking, search, and UI layers. This would make vendor selection a one-way decision and future migrations expensive, repeating the exact problem that `AIProviderConnector` already solved for AI providers.

**Pain points:**
- No standard way to upsert, search, or delete vector records by tenant.
- No shared pattern for storing vector-store credentials or index configuration.
- Provider-specific tenant-isolation mechanisms would be duplicated across the ingestion and search code paths.
- Downstream RAG features cannot be built safely until the storage contract is stable.

---

## 7. Future State (To-Be)

After this initiative, a `RAGConnector` interface sits between the vector store and the rest of the platform. The chosen provider is configured once at deployment, credentials live in the existing `platform_credentials` table, and every operation is tenant-scoped.

**New or improved process:**
1. A post is ingested, normalized, and enriched.
2. `RAGChunkingService` splits the post and obtains embeddings.
3. `RAGConnector.upsert()` writes chunks to the vector index with tenant-scoped metadata.
4. `RAGSearchService` calls `RAGConnector.search()` with a mandatory `tenant_id` filter and optional filters.
5. Tenant offboarding or post deletion triggers `deleteTenant()` or `deletePost()`.
6. `status()` surfaces index health and lag to the platform operations view.

**Expected capabilities:**
- Switch Pinecone, Azure AI Search, or pgvector without touching `RAGChunkingService` or `RAGSearchService`.
- Enforce tenant boundaries by contract in every vector query.
- Reuse existing credential-ownership and connector-registry patterns.
- Provide the foundation for `28-semantic-search-rag` and related AI features.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The platform shall expose a `RAGConnector` interface with `upsert`, `search`, `deletePost`, `deleteTenant`, and `status` operations | Must | Interface is defined and one provider implements it end-to-end | Product Owner |
| BR-002 | Every `search()` call shall filter records by `tenant_id` using a mandatory equality filter | Must | Cross-tenant queries return only the caller's records; unfiltered search is not possible | Product Owner |
| BR-003 | The platform shall support at least one initial vector-store provider (Pinecone, Azure AI Search, or pgvector) chosen at deployment | Must | A single provider can be configured and used for upsert, search, and delete | Product Owner |
| BR-004 | Vector-store credentials and endpoint/index names shall be stored in the existing `platform_credentials` envelope with `credential_type = 'rag'` | Must | Credentials follow the same ownership-tier rules as other connectors | Product Owner |
| BR-005 | The system shall provide a `status()` operation that reports indexing lag, chunk count, and store-level errors | Should | Operations can observe connector health without provider-specific tooling | Product Owner |
| BR-006 | `RAGConnector` shall allow future providers to be added without changing `RAGChunkingService` or `RAGSearchService` | Should | A new provider is added by implementing the interface and registering it | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Vector records shall be isolated per tenant using metadata filters on every query | Security | Must | Verified by contract tests for cross-tenant leakage |
| NFR-002 | The `RAGConnector` pattern shall match existing `AIProviderConnector` and `SocialConnector` abstractions | Maintainability | Must | Code review confirms consistent interface, registry, and credential handling |
| NFR-003 | The vector index shall be rebuildable from `social_posts` and `rag_chunks_sync` | Reliability | Should | A documented backfill path exists and is contract-tested |
| NFR-004 | Vector-store operations shall be best-effort and shall not block the ingestion pipeline | Reliability | Should | Ingestion contracts pass when vector upsert is temporarily unavailable |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `tenant_id` metadata filter is mandatory on every `RAGConnector.search()` call and cannot be bypassed. |
| BRU-002 | Vector records are derived from `social_posts`; the source of truth remains the relational database. |
| BRU-003 | Vector-store credentials shall use `credential_type = 'rag'` inside the existing `platform_credentials` envelope. |
| BRU-004 | Only one vector-store provider shall be active in v1, selected at platform deployment time. |
| BRU-005 | No PII beyond public post content may be written to the vector index. |
| BRU-006 | `RAGConnector.deleteTenant()` and `deletePost()` must remove all vector records for the given tenant or post. |

---

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Vector index lag (`last_indexed_at` vs. newest post) | Monitor how far behind the vector index is | Platform Admin / Performance Review Agent | Real-time via `status()` |
| Chunk count per tenant | Track indexing volume and cost | Performance Review Agent | Real-time via `status()` |
| Store-level errors and health | Detect provider outages or quota issues | Platform Admin | Real-time via `status()` |
| Provider in use | Confirm which vector store is configured | Platform Admin / Backend Engineer | Static configuration |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The v1 vector-store provider is not selected, delaying implementation | Medium | High | Treat provider selection as a deployment-time configuration; any of Pinecone, Azure AI Search, or pgvector satisfies the interface | Product Owner |
| R-002 | Provider-specific tenant isolation is implemented inconsistently | Medium | High | Mandate `tenant_id` metadata filter in the interface contract and enforce it with contract tests | Technical Lead |
| R-003 | Vector-store cost or latency exceeds expectations | Medium | Medium | Set bounded default chunk size and top-k; expose `status()` metrics for quota monitoring | Product Owner |
| R-004 | Credential rotation for a new `rag` type is not supported by existing tooling | Low | Medium | Reuse `platform_credentials` envelope and ownership tiers from ADR-0028 | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- `RAGConnector` interface defines `upsert()`, `search()`, `deletePost()`, `deleteTenant()`, and `status()`.
- Configuration is stored per tenant in `platform_credentials` with `credential_type = 'rag'`.
- Tenant isolation is enforced by a `tenant_id` metadata filter on every `search()`.
- The source of truth remains `social_posts`; the vector index is documented as a rebuildable derived view.
- Contract tests verify upsert, search, and delete for at least one provider.
- The interface allows adding a second provider without changing `RAGChunkingService` or `RAGSearchService`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation — using retrieved text chunks to ground AI-generated answers in real data. |
| Vector store | A database optimized for storing and searching high-dimensional embedding vectors (e.g., Pinecone, Azure AI Search, pgvector). |
| Embedding | A numerical vector that represents the semantic meaning of a piece of text. |
| Chunk | A contiguous segment of a post's `body_markdown` used for retrieval. |
| Connector | A provider-agnostic interface plus per-provider implementation in the SocialEngage architecture. |
| Tenant isolation | The guarantee that one tenant's data cannot be accessed by another tenant, enforced here by metadata filters. |

---

## 16. Appendices

- **Source ADR:** `docs/adr/0081-rag-connector-provider-abstraction.md` (Status: Proposed)
- **Parent feature design:** `docs/product-research/feature-designs/28-semantic-search-rag.md`
- **Scoping plan:** `docs/product-research/feature-adr-scoping.md`
- **Deep-research brief:** *Not found.* No `docs/product-research/reports/28-semantic-search-rag-deep-research.md` exists; explicitly noted as missing source.
- **Related user stories:**
  - `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.7 (RAGConnector provider abstraction, ADR-0081)
  - `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.8 (chunking and embedding, ADR-0082)
  - `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.9 (vector-store RLS and metadata, ADR-0083)
  - `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.10 (search and ask endpoint, ADR-0084)
  - `docs/user-stories/epic-9-adr-0077-to-0085.md` — Story 9.11 (RAG UI/UX, ADR-0085)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
