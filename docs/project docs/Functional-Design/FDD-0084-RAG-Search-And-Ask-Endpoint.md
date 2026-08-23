# BRD-0084: RAG Search and Ask Endpoint

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0084: RAG Search and Ask Endpoint |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0084-rag-search-and-ask-endpoint.md, ../Business-Requirements/BRD-0084-RAG-Search-And-Ask-Endpoint.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0084-rag-search-and-ask-endpoint.md and the business requirements in BRD-0084-RAG-Search-And-Ask-Endpoint.md into functional design for **RAG Search And Ask Endpoint**.
**What problem are we solving?**
Today, users can only search ingested social posts using keyword or boolean filters. This misses conceptually related posts that use different words, and it provides no way to ask natural-language questions such as *“What are people saying about the latest product launch?”* over the tenant’s corpus.

**Who is affected?**
Tenant analysts, brand-reputation managers, topic-center analysts, and tenant readers all need faster, meaning-based discovery and verifiable answers.

**What is the proposed solution at a glance?**
ADR-0084 authorizes three REST endpoints: `POST /v1/rag/search` for semantic search, `POST /v1/rag/ask` for grounded natural-language Q&A, and `GET /v1/rag/status` for index health. The endpoints use a tenant-scoped vector index to return ranked post chunks and answers with citations.

**What business value do we expect?**
Semantic search turns the post corpus into a queryable knowledge layer, improves AI output quality by grounding answers in real tenant posts, reduces manual research time, and creates a long-term product differentiator.

---

### 2.2 Scope
**In scope:**
- `POST /v1/rag/search` endpoint for natural-language semantic search.
- `POST /v1/rag/ask` endpoint for question answering with citations and confidence grading.
- `GET /v1/rag/status` endpoint for index health and lag reporting.
- Request/response contract shapes, filter dimensions, pagination, and result metadata.
- Tenant-scoped RAG filter support (`watchlistId`, `platformId`, `topicId`, `sentiment`, `dateRange`).
- Default and hard-capped values for `topK` (10 / 50) and `maxChunks` (5 / 10).
- Per-tenant usage metering and `429 RAG_QUOTA_EXCEEDED` response.
- Citation format that links back to original `social_posts`.

**Out of scope:**
- Vector store selection and `RAGConnector` abstraction (ADR-0081).
- Post chunking, embedding, and async indexing pipeline (ADR-0082).
- Vector-store RLS, metadata schema, and deletion sync (ADR-0083).
- Frontend search/ask UI components, loading patterns, and accessibility (ADR-0085).
- Streaming `ask` responses for v1.
- Hybrid (vector + keyword) search for v1.
- Unauthenticated or public RAG access.

## 3. Context and Background
See ADR Context.
**What problem are we solving?**
Today, users can only search ingested social posts using keyword or boolean filters. This misses conceptually related posts that use different words, and it provides no way to ask natural-language questions such as *“What are people saying about the latest product launch?”* over the tenant’s corpus.

**Who is affected?**
Tenant analysts, brand-reputation managers, topic-center analysts, and tenant readers all need faster, meaning-based discovery and verifiable answers.

**What is the proposed solution at a glance?**
ADR-0084 authorizes three REST endpoints: `POST /v1/rag/search` for semantic search, `POST /v1/rag/ask` for grounded natural-language Q&A, and `GET /v1/rag/status` for index health. The endpoints use a tenant-scoped vector index to return ranked post chunks and answers with citations.

**What business value do we expect?**
Semantic search turns the post corpus into a queryable knowledge layer, improves AI output quality by grounding answers in real tenant posts, reduces manual research time, and creates a long-term product differentiator.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable meaning-based discovery of tenant posts | Users can find relevant posts without matching exact keywords |
| 2 | Deliver verifiable, natural-language answers over the corpus | Every `ask` response includes citations to source posts |
| 3 | Support analyst productivity | Reduction in time spent manually scanning keyword result sets |
| 4 | Maintain tenant cost and data governance | Per-tenant quota and rate limits are enforced by default |

---

**Positive consequences (from ADR):**
1. **Two clear UX paths:** `search` for discovery, `ask` for synthesis.
2. **Citations by design:** every answer is grounded in retrievable posts.
3. **Cost exposure:** `ask` is more expensive than `search` because it includes a generation call.
4. **Coupling to `social_posts`:** the response must fetch the original post to display the snippet, adding a small but necessary round trip.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
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

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 9.10 | epic-9-adr-0077-to-0085.md | As backend engineer, I want `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` to serve semantic search and Q&A, so that `Tenant-Reader` can... | `POST /v1/rag/search` accepts a natural-language `query` and `RAGFilter` and returns top-N chunks with `postId`, `chunkIndex`, `score`, and `snippet`.; `POST... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- ADR-0081, ADR-0082, and ADR-0083 are accepted and implemented before these endpoints are exposed.
- Authenticated users are already resolved through the existing Entra-based identity pipeline.
- The `social_posts` table remains the source of truth for snippet reconstruction.
- A vector index is populated and reachable before `search` and `ask` calls return useful results.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Semantic search returns within 1.5 seconds for the 95th percentile tenant | Performance | Should | Measured via production or contract monitoring over 30 days |
| NFR-002 | Every vector query enforces tenant isolation through a mandatory `tenant_id` filter | Security | Must | Contract tests verify no cross-tenant results for any filter combination |
| NFR-003 | RAG endpoints are available when the vector store and source-of-truth DB are healthy | Reliability | Should | < 1% error rate excluding quota and invalid request responses |
| NFR-004 | Embedding and generation calls are metered and reported per tenant | Cost / Compliance | Must | Usage tables expose `search` and `ask` counts and quota consumption |
| NFR-005 | `ask` answers are generated only from retrieved chunks to limit hallucination | Maintainability | Must | Model prompt instructs answer-from-context and citation behavior |

---

## 11. Error Handling and Exceptions
1. **Two clear UX paths:** `search` for discovery, `ask` for synthesis.
2. **Citations by design:** every answer is grounded in retrievable posts.
3. **Cost exposure:** `ask` is more expensive than `search` because it includes a generation call.
4. **Coupling to `social_posts`:** the response must fetch the original post to display the snippet, adding a small but necessary round trip.

---

## 12. Assumptions and Dependencies
- ADR-0081, ADR-0082, and ADR-0083 are accepted and implemented before these endpoints are exposed.
- Authenticated users are already resolved through the existing Entra-based identity pipeline.
- The `social_posts` table remains the source of truth for snippet reconstruction.
- A vector index is populated and reachable before `search` and `ask` calls return useful results.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | `ask` generation costs are higher than expected | Medium | High | Enforce `maxChunks` cap, per-tenant quota, and default 5 chunks | Product Owner |
| R-002 | Generated answers hallucinate or omit important caveats | Medium | High | Require citations, confidence grading, and answer-from-context prompts | Engineering |
| R-003 | Vector store latency exceeds user expectations | Medium | Medium | Cap `topK` at 50, cache popular embeddings, monitor p95 latency | Engineering |
| R-004 | Cross-tenant data leakage through misconfigured metadata | Low | High | Mandate `tenant_id` filter on every `RAGConnector.search()` call and contract-test cross-tenant boundaries | Engineering |
| R-005 | End users do not adopt semantic search | Medium | Medium | Provide UI discovery, inline examples, and success metrics feedback loop | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0084-rag-search-and-ask-endpoint.md`
- BRD: `../Business-Requirements/BRD-0084-RAG-Search-And-Ask-Endpoint.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above