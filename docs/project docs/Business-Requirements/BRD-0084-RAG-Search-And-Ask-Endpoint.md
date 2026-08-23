# BRD-0084: RAG Search and Ask Endpoint

# Business Requirements Document (BRD) — RAG Search and Ask Endpoint

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | RAG Search and Ask Endpoint – Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno – Product Owner / Technical Lead |
| Status | Draft for Review (source ADR-0084 is Proposed) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft derived from ADR-0084 and feature design `28-semantic-search-rag.md` |

---

## 2. Executive Summary

**What problem are we solving?**
Today, users can only search ingested social posts using keyword or boolean filters. This misses conceptually related posts that use different words, and it provides no way to ask natural-language questions such as *“What are people saying about the latest product launch?”* over the tenant’s corpus.

**Who is affected?**
Tenant analysts, brand-reputation managers, topic-center analysts, and tenant readers all need faster, meaning-based discovery and verifiable answers.

**What is the proposed solution at a glance?**
ADR-0084 authorizes three REST endpoints: `POST /v1/rag/search` for semantic search, `POST /v1/rag/ask` for grounded natural-language Q&A, and `GET /v1/rag/status` for index health. The endpoints use a tenant-scoped vector index to return ranked post chunks and answers with citations.

**What business value do we expect?**
Semantic search turns the post corpus into a queryable knowledge layer, improves AI output quality by grounding answers in real tenant posts, reduces manual research time, and creates a long-term product differentiator.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable meaning-based discovery of tenant posts | Users can find relevant posts without matching exact keywords |
| 2 | Deliver verifiable, natural-language answers over the corpus | Every `ask` response includes citations to source posts |
| 3 | Support analyst productivity | Reduction in time spent manually scanning keyword result sets |
| 4 | Maintain tenant cost and data governance | Per-tenant quota and rate limits are enforced by default |

---

## 4. Scope

### 4.1 In Scope

- `POST /v1/rag/search` endpoint for natural-language semantic search.
- `POST /v1/rag/ask` endpoint for question answering with citations and confidence grading.
- `GET /v1/rag/status` endpoint for index health and lag reporting.
- Request/response contract shapes, filter dimensions, pagination, and result metadata.
- Tenant-scoped RAG filter support (`watchlistId`, `platformId`, `topicId`, `sentiment`, `dateRange`).
- Default and hard-capped values for `topK` (10 / 50) and `maxChunks` (5 / 10).
- Per-tenant usage metering and `429 RAG_QUOTA_EXCEEDED` response.
- Citation format that links back to original `social_posts`.

### 4.2 Out of Scope

- Vector store selection and `RAGConnector` abstraction (ADR-0081).
- Post chunking, embedding, and async indexing pipeline (ADR-0082).
- Vector-store RLS, metadata schema, and deletion sync (ADR-0083).
- Frontend search/ask UI components, loading patterns, and accessibility (ADR-0085).
- Streaming `ask` responses for v1.
- Hybrid (vector + keyword) search for v1.
- Unauthenticated or public RAG access.

### 4.3 Assumptions

- ADR-0081, ADR-0082, and ADR-0083 are accepted and implemented before these endpoints are exposed.
- Authenticated users are already resolved through the existing Entra-based identity pipeline.
- The `social_posts` table remains the source of truth for snippet reconstruction.
- A vector index is populated and reachable before `search` and `ask` calls return useful results.

### 4.4 Constraints

- `topK` may not exceed 50 per request.
- `maxChunks` may not exceed 10 per `ask` request.
- Rate and cost caps are enforced per tenant and surfaced as `429` responses.
- All retrieval is subject to tenant-level RLS and metadata filters.
- BRD is based on a Proposed ADR and may change upon acceptance.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Business-Analyst | Primary end user | High | Search by meaning and ask natural-language questions |
| Topic-Center-Analyst | Primary end user | High | Explore related posts and trends without exact queries |
| Tenant-Brand-Reputation-Manager | Primary end user | High | Discover emerging narratives in unexpected language |
| Tenant-Reader | Secondary end user | Medium | Simple search box that “just understands” |
| Sole-Operator | Secondary end user / administrator | Medium | See and control embedding costs and index health |
| Performance Review Agent | Secondary reviewer | Low | Review query latency, quota usage, and vector-store cost |
| Backend Engineering | Implementer | High | Clear contract, bounded scope, and cost controls |
| Product Owner | Decision maker | High | Traceable requirements tied to accepted ADR and feature design |

---

## 6. Current State (As-Is)

**Current process:**
Users locate posts through keyword search, boolean watchlist queries, and manual feed scrolling. Results are ranked by keyword match or recency, not by conceptual similarity. There is no endpoint that accepts a natural-language question and returns a synthesized, grounded answer.

**Pain points:**
- Keyword search fails when authors use different terminology.
- Analysts must read many posts to synthesize a trend or answer.
- AI-generated content cannot cite source posts, reducing trust.
- Full-text scans become expensive as post volumes grow.

---

## 7. Future State (To-Be)

**New or improved process:**
A tenant user enters a natural-language query. The system embeds the query, retrieves the most similar post chunks from a tenant-scoped vector index, and either returns ranked snippets (`/v1/rag/search`) or passes the chunks to an AI generation step that returns a concise, cited answer (`/v1/rag/ask`). A status endpoint (`/v1/rag/status`) shows whether the vector index is healthy, how far it lags behind ingestion, and how many posts/chunks are indexed.

**Expected capabilities:**
- Conceptual search across the tenant’s ingested posts.
- Natural-language Q&A with citations and confidence grading.
- Filtered scoped search by watchlist, platform, topic, sentiment, or date range.
- Index health visibility and per-tenant cost metering.
- Snippet reconstruction from the authoritative `social_posts` row.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall accept a natural-language query and return ranked, tenant-scoped post chunks | Must | `POST /v1/rag/search` returns `results` with `postId`, `chunkIndex`, `score`, `platformId`, `publishedAt`, and `snippet` | Product Owner |
| BR-002 | The system shall allow filtering search and ask requests by watchlist, platform, topic, sentiment, and date range | Must | `RAGFilter` dimensions are validated and applied to vector retrieval | Product Owner |
| BR-003 | The system shall cap the number of returned results to control cost | Must | `topK` defaults to 10 and is hard-capped at 50 | Product Owner |
| BR-004 | The system shall answer natural-language questions and cite the chunks it used | Must | `POST /v1/rag/ask` returns `answer`, `citations`, and `confidence` (`high` / `medium` / `low`) | Product Owner |
| BR-005 | The system shall expose index health and lag to operators | Must | `GET /v1/rag/status` returns `totalIndexedPosts`, `totalChunks`, `lagBehindIngestion`, `lastIndexedAt`, and `storeStatus` | Product Owner |
| BR-006 | The system shall enforce per-tenant RAG quotas | Must | When the tenant cap is reached, the endpoint returns `429 RAG_QUOTA_EXCEEDED` | Product Owner |
| BR-007 | The system shall link every snippet and citation back to its source post | Must | Citations contain `postId`, `chunkIndex`, `url` (when available), and `snippet` | Product Owner |
| BR-008 | The system shall reconstruct snippets from the authoritative post store | Must | Snippets are fetched from `social_posts`, not duplicated in the vector store | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Semantic search returns within 1.5 seconds for the 95th percentile tenant | Performance | Should | Measured via production or contract monitoring over 30 days |
| NFR-002 | Every vector query enforces tenant isolation through a mandatory `tenant_id` filter | Security | Must | Contract tests verify no cross-tenant results for any filter combination |
| NFR-003 | RAG endpoints are available when the vector store and source-of-truth DB are healthy | Reliability | Should | < 1% error rate excluding quota and invalid request responses |
| NFR-004 | Embedding and generation calls are metered and reported per tenant | Cost / Compliance | Must | Usage tables expose `search` and `ask` counts and quota consumption |
| NFR-005 | `ask` answers are generated only from retrieved chunks to limit hallucination | Maintainability | Must | Model prompt instructs answer-from-context and citation behavior |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Every `RAGConnector.search()` call must include a mandatory `tenant_id` equality filter. |
| BRU-002 | `POST /v1/rag/search` rejects `topK` values above 50 and falls back to 10 when omitted. |
| BRU-003 | `POST /v1/rag/ask` rejects `maxChunks` values above 10 and falls back to 5 when omitted. |
| BRU-004 | Generated answers must be grounded solely in the chunks supplied for the question. |
| BRU-005 | Every citation in an `ask` response must correspond to a chunk actually used to generate the answer. |
| BRU-006 | Per-tenant RAG usage is metered; hitting the cap returns `429 RAG_QUOTA_EXCEEDED`. |
| BRU-007 | Snippet and citation text are reconstructed from `social_posts` as the source of truth. |
| BRU-008 | No PII beyond public post content is indexed or returned through RAG endpoints. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Natural-language query | The user’s search or question text | Client request | Product | Standard tenant input |
| `RAGFilter` | Filter dimensions (`watchlistId`, `platformId`, `topicId`, `sentiment`, `dateRange`) | Client request | Product | Tenant-scoped configuration data |
| `postId` | Identifier of the source post | `social_posts` | Engineering | Reference to tenant content |
| `chunkIndex` | Position of the chunk within the post | Vector store / `rag_chunks_sync` | Engineering | Internal reference |
| `score` | Vector similarity score for the result | Vector store | Engineering | Internal |
| `snippet` | Reconstructed excerpt of the matching post chunk | `social_posts` | Engineering | Public post content |
| `answer` | Generated natural-language response | AI provider | Engineering | Derived from public post content |
| `citations` | References to chunks used for the answer | Vector store + `social_posts` | Engineering | Public post content |
| `confidence` | Reliability of the generated answer (`high` / `medium` / `low`) | AI provider / service | Engineering | Internal |
| `storeStatus` | Health of the tenant vector index | `RAGConnector` | Engineering | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| RAG query volume by tenant | Track adoption and cost exposure | Product / Operations | Daily |
| Search vs. ask request split | Understand usage patterns | Product | Weekly |
| Average topK and maxChunks used | Observe cost behavior | Engineering / Performance Review | Weekly |
| Quota consumption by tenant | Detect tenants approaching limits | Operations | Real time |
| Semantic search latency (p95) | Monitor user experience | Engineering | Daily |
| Vector index lag behind ingestion | Surface indexing health | Operations / Tenant-Admin | Hourly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `ask` generation costs are higher than expected | Medium | High | Enforce `maxChunks` cap, per-tenant quota, and default 5 chunks | Product Owner |
| R-002 | Generated answers hallucinate or omit important caveats | Medium | High | Require citations, confidence grading, and answer-from-context prompts | Engineering |
| R-003 | Vector store latency exceeds user expectations | Medium | Medium | Cap `topK` at 50, cache popular embeddings, monitor p95 latency | Engineering |
| R-004 | Cross-tenant data leakage through misconfigured metadata | Low | High | Mandate `tenant_id` filter on every `RAGConnector.search()` call and contract-test cross-tenant boundaries | Engineering |
| R-005 | End users do not adopt semantic search | Medium | Medium | Provide UI discovery, inline examples, and success metrics feedback loop | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0081 – `RAGConnector` provider abstraction | Architecture | Product / Engineering | Before contract implementation |
| D-002 | ADR-0082 – chunking and embedding pipeline | Architecture | Product / Engineering | Before `search` and `ask` return useful results |
| D-003 | ADR-0083 – vector-store RLS and metadata schema | Architecture | Product / Engineering | Before `search` and `ask` are exposed |
| D-004 | Feature design `28-semantic-search-rag.md` | Reference | Product | Maintained alongside ADR acceptance |
| D-005 | Story 9.8 – RAG post chunking and embedding pipeline | Story | Engineering | Precedes Story 9.10 |
| D-006 | Story 9.9 – RAG vector-store RLS and metadata | Story | Engineering | Precedes Story 9.10 |
| D-007 | AI provider contract for `embed()` and generation methods | External / Internal | Engineering | Existing `AIProviderConnector` (ADR-0002) |

---

## 14. Acceptance Criteria

- `POST /v1/rag/search` accepts a natural-language `query` and optional `RAGFilter`, returning `results` with `postId`, `chunkIndex`, `score`, `platformId`, `publishedAt`, and `snippet`.
- `POST /v1/rag/search` defaults `topK` to 10 and rejects or clamps values above 50.
- `POST /v1/rag/ask` returns `answer`, `citations`, and `confidence`, where `confidence` is one of `high`, `medium`, or `low`.
- `POST /v1/rag/ask` defaults `maxChunks` to 5 and rejects or clamps values above 10.
- Every `ask` citation links back to the original `social_posts` row and matches a retrieved chunk.
- `GET /v1/rag/status` returns `totalIndexedPosts`, `totalChunks`, `lagBehindIngestion`, `lastIndexedAt`, and `storeStatus`.
- Quotas are enforced per tenant; exceeding the monthly cap returns `429 RAG_QUOTA_EXCEEDED`.
- Cross-tenant access is prevented by mandatory `tenant_id` filtering on every vector query.

---

## 15. Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation: combining vector search with a language model to produce grounded answers. |
| Vector store | A database or index optimized for storing and querying high-dimensional embedding vectors. |
| Chunk | A smaller text segment of a post, suitable for embedding and retrieval. |
| Embedding | A numerical vector representation of text produced by an embedding model. |
| Citation | A reference in an `ask` response that points to a specific post chunk used to generate the answer. |
| `topK` | The maximum number of ranked results returned by a search. |
| `RAGFilter` | The set of optional dimensions used to scope a RAG search or ask request. |
| Confidence | A qualitative grade (`high`, `medium`, `low`) indicating the model’s certainty in the generated answer. |
| RLS | Row-Level Security; the mechanism that enforces tenant isolation. |

---

## 16. Appendices

### A. Source Architecture Decision Record
- `docs/adr/0084-rag-search-and-ask-endpoint.md` (Status: Proposed)

### B. Feature Design
- `docs/product-research/feature-designs/28-semantic-search-rag.md`

### C. Scoping Plan
- `docs/product-research/feature-adr-scoping.md`

### D. Related User Stories
- **Story 9.10** – RAG search and ask endpoint (backend) (ADR-0084, depends on Story 9.8 and 9.9)
- **Story 9.8** – RAG post chunking and embedding pipeline (backend)
- **Story 9.9** – RAG vector-store RLS and metadata (backend)
- **Story 9.11** – RAG UI/UX and loading patterns (frontend, depends on Story 9.10)

### E. Related ADRs
- **ADR-0081** – `RAGConnector` provider abstraction
- **ADR-0082** – Post chunking and embedding pipeline
- **ADR-0083** – Vector-store RLS and metadata
- **ADR-0078** – Metric explainability (same AI contract pattern)
- **ADR-0002** – `AIProviderConnector`

### F. Missing Source Materials
- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature. This section should be updated if a deep-research brief is produced.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
