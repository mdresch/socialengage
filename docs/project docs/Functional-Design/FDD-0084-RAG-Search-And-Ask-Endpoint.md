# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0084 RAG Search and Ask Endpoint — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer |
| Reviewer(s) | Technical Lead (Menno) |
| Status | Draft |
| Related Documents | ADR-0084 (RAG search and ask endpoint), ADR-0081 (`RAGConnector`), ADR-0082 (chunking/embedding pipeline), ADR-0083 (vector-store RLS and metadata), ADR-0002 (`AIProviderConnector`), ADR-0078 (metric explainability, same AI contract pattern), BRD-0084, `docs/product-research/feature-designs/28-semantic-search-rag.md`, Story 9.10 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0084's decision — three REST endpoints (`POST /v1/rag/search`, `POST /v1/rag/ask`, `GET /v1/rag/status`) that expose the tenant-scoped RAG vector index to callers — into a functional design: the request/response behavior, processing rules, error handling, and workflows each endpoint must support.

**Note:** ADR-0084's Status is **Proposed**, not Accepted. This FDD is a draft for review and may change if the parent ADR is revised or rejected before implementation.

### 2.2 Scope

- **In scope:** the `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` contracts; query embedding; `RAGFilter` application; `topK`/`maxChunks` bounds; citation and snippet reconstruction; per-tenant metering and the `429 RAG_QUOTA_EXCEEDED` response.
- **Out of scope:** the `RAGConnector` interface and provider selection (ADR-0081); chunking/embedding pipeline internals (ADR-0082); vector-store metadata schema and tenant-isolation filter implementation (ADR-0083); the admin UI search/ask components and loading states (ADR-0085); streaming `ask` responses and hybrid (vector + keyword) search (both explicitly deferred past v1); unauthenticated/public RAG access (not supported).

### 2.3 Target Audience

Backend engineers implementing the three endpoints, QA authoring contract tests, the frontend team building against this contract (ADR-0085), and the Product Owner.

---

## 3. Context and Background

Today users can only find posts by keyword or boolean watchlist query (`GET /v1/posts`), which misses conceptually related posts that use different wording and provides no way to ask a natural-language question over the corpus. `docs/product-research/feature-designs/28-semantic-search-rag.md` calls for meaning-based discovery and grounded natural-language Q&A. ADR-0081/0082/0083 build the underlying vector index, chunking pipeline, and tenant-isolated metadata; ADR-0084 is the REST surface that exposes that index to callers, following the same query-and-filter dimensions already established for `GET /v1/posts` (watchlist, date range) so users can search within a familiar, known scope.

Source requirements: ADR-0084, BRD-0084, Story 9.10 (`docs/user-stories/epic-9-adr-0077-to-0085.md`). Depends on ADR-0081 (Story 9.7), ADR-0082 (Story 9.8), and ADR-0083 (Story 9.9) all being implemented first; consumed in turn by the admin UI (ADR-0085, Story 9.11).

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable meaning-based discovery of tenant posts | `POST /v1/rag/search` returns conceptually relevant results even without exact keyword overlap |
| G2 | Deliver verifiable, grounded natural-language answers | Every `POST /v1/rag/ask` response includes citations that match the chunks actually used |
| G3 | Bound cost and query volume per tenant | `topK`/`maxChunks` are capped; usage is metered and enforced via `429 RAG_QUOTA_EXCEEDED` |
| G4 | Give operators visibility into index health | `GET /v1/rag/status` reports indexed volume, lag behind ingestion, and store health |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `POST /v1/rag/search`

- **Description:** Accepts a natural-language query and optional filter, and returns a ranked list of matching post chunks.
- **Triggers:** An authenticated tenant user (or a caller on their behalf, e.g., the admin UI) submits a search query.
- **Inputs:**
  ```ts
  {
    query: string;
    filter?: { watchlistId?: string; platformId?: string; topicId?: string;
               sentiment?: 'positive'|'negative'|'neutral'|'mixed';
               dateRange?: { start: ISOString; end: ISOString } };
    pagination?: { topK: number };  // default 10, hard cap 50
  }
  ```
- **Processing:**
  1. Resolve the caller's `tenant_id` server-side from the authenticated session (never from the request body).
  2. Embed `query` using the same `AIProviderConnector.embed()` method used by the chunking pipeline (ADR-0082), so query and chunk vectors live in the same embedding space.
  3. Clamp/validate `topK`: default 10 when omitted, reject or clamp values above the hard cap of 50.
  4. Call `RAGConnector.search()` (ADR-0081) with the tenant-scoped embedding and the caller-supplied `filter` translated to a `RAGFilter` (ADR-0083).
  5. For each returned chunk, reconstruct a `snippet` by fetching the corresponding `social_posts` row and extracting the text at `chunkIndex` (chunk text itself is never stored in the vector store, per ADR-0083).
  6. Increment the tenant's RAG usage counter for this `search` call before returning a successful response.
- **Outputs:**
  ```ts
  { results: Array<{ postId: string; chunkIndex: number; score: number;
                      platformId: string; publishedAt: string; snippet: string }> }
  ```
- **Error handling:** Missing/empty `query` is a validation error (400). `topK` above 50 is rejected or clamped per implementation choice (must be consistent and documented). Quota exceeded returns `429 RAG_QUOTA_EXCEEDED`. Vector-store unavailability surfaces as a 5xx with a generic message, not an internal stack trace.
- **Edge cases:** Zero results is a valid 200 response with an empty `results` array (not an error). A `filter` that matches no vectors returns empty results, not a 404. A `social_posts` row deleted between indexing and the search request (race with reconciliation, ADR-0083) is either omitted from results or handled gracefully rather than erroring the whole request.

### 5.2 Feature / Capability: `POST /v1/rag/ask`

- **Description:** Accepts a natural-language question and returns a generated, citation-backed answer grounded only in retrieved tenant post chunks.
- **Triggers:** An authenticated tenant user asks a question through the UI or API.
- **Inputs:**
  ```ts
  { question: string; filter?: RAGFilter; maxChunks?: number }  // default 5, hard cap 10
  ```
- **Processing:**
  1. Resolve `tenant_id` server-side, as in 5.1.
  2. Validate/clamp `maxChunks`: default 5, hard cap 10.
  3. Internally retrieve `maxChunks` chunks using the same retrieval path as `POST /v1/rag/search` (embed the question, apply `filter`, call `RAGConnector.search()`).
  4. Send the question and the retrieved chunks to the AI provider's generation method (`AIProviderConnector.research?()` or a dedicated generation method per ADR-0002's connector pattern).
  5. The model is instructed to answer **only** from the supplied chunks and to cite them; it must not draw on outside knowledge.
  6. Build the `citations` array so that it always matches exactly the chunks actually used by the model to produce the answer (no citation without a corresponding retrieved chunk, and no chunk used without an accompanying citation).
  7. Assign a `confidence` grade (`high`/`medium`/`low`) reflecting the model's/service's certainty (e.g., derived from retrieval score distribution and/or the model's own signal).
  8. Meter this call against the tenant's quota (an `ask` call is metered more heavily than a `search` call, since it includes a generation step).
- **Outputs:**
  ```ts
  { answer: string;
    citations: Array<{ postId: string; chunkIndex: number; url?: string; snippet: string }>;
    confidence: 'high' | 'medium' | 'low' }
  ```
- **Error handling:** Missing/empty `question` is a 400. `maxChunks` above 10 is rejected or clamped. Zero retrieved chunks (nothing relevant found) must not fabricate an answer — the response should indicate the limitation rather than hallucinate (see Open Question Q2). Quota exceeded returns `429 RAG_QUOTA_EXCEEDED`. Generation-provider failure surfaces as a 5xx, distinct from a quota or validation error.
- **Edge cases:** A question outside the scope of any retrieved chunk must not be answered confidently from the model's general knowledge — behavior here is an explicit open question (Q2) to be resolved before implementation, but the default posture is "refuse or qualify, never fabricate." A question that retrieves fewer than `maxChunks` (small corpus) still returns a valid answer scoped to what was found.

### 5.3 Feature / Capability: `GET /v1/rag/status`

- **Description:** Reports indexing health and lag for the caller's tenant, so operators and tenant admins can see whether the RAG index is current and usable.
- **Triggers:** Polled/requested by the admin UI (ADR-0085) or an operator.
- **Inputs:** None beyond the authenticated caller's `tenant_id`.
- **Processing:** Aggregates `rag_chunks_sync` (ADR-0083) and `social_posts` counts for the tenant to compute indexed totals and lag; queries `RAGConnector` (or the vector store directly) for store-level health.
- **Outputs:**
  ```ts
  { totalIndexedPosts: number; totalChunks: number; lagBehindIngestion: number;
    lastIndexedAt: ISOString; storeStatus: 'healthy' | 'degraded' | 'unavailable' }
  ```
- **Error handling:** If the vector store cannot be reached, `storeStatus` reports `unavailable` rather than the endpoint itself erroring, so operators get a clear signal.
- **Edge cases:** A brand-new tenant with no indexed posts yet returns zeroed counts and a `healthy` (or appropriately neutral) status, not an error.

### 5.4 Feature / Capability: Per-Tenant Rate and Cost Metering

- **Description:** `search` and `ask` calls are metered per tenant against a monthly cap; exceeding it blocks further calls until the period resets.
- **Triggers:** Every `POST /v1/rag/search` and `POST /v1/rag/ask` call.
- **Inputs:** Tenant's current usage counters and configured plan cap.
- **Processing:** Before (or atomically with) serving the request, check the tenant's usage against its cap. If serving the request would exceed the cap, reject it before doing embedding/generation work (to avoid incurring cost on a request that will be rejected). `tenant_admin` can view current usage.
- **Outputs:** A successful response (with usage counters incremented) or a `429 RAG_QUOTA_EXCEEDED` error.
- **Error handling:** `429 RAG_QUOTA_EXCEEDED` is a distinct, documented error code so clients can distinguish it from generic rate limiting or validation errors.
- **Edge cases:** A request that fails validation (e.g., empty `query`) does not consume quota. A request that fails due to vector-store/provider error after quota was reserved should not double-charge on client retry (idempotency consideration).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-Business-Analyst / Topic-Center-Analyst / Tenant-Brand-Reputation-Manager | Primary end users issuing search/ask requests |
| Tenant-Reader | Secondary end user expecting a search box that "just understands" |
| Sole-Operator / Tenant-Admin | Views index health and usage/quota consumption |
| Backend Engineer | Implements the three endpoints |
| Admin UI (ADR-0085) | Consumes these endpoints on the user's behalf |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 9.10) | Backend engineer | Serve `POST /v1/rag/search`, `POST /v1/rag/ask`, and `GET /v1/rag/status` | `Tenant-Reader` can ask natural-language questions over the tenant's posts | `search` returns top-N chunks with `postId`/`chunkIndex`/`score`/`snippet`; `ask` returns `answer`/`citations`/`confidence`; `status` returns index health/lag; `topK` defaults 10/caps 50, `maxChunks` defaults 5/caps 10; quota overage returns `429 RAG_QUOTA_EXCEEDED`; citations link back to original posts |

### 6.3 Workflow Diagrams / Steps

**`POST /v1/rag/search` flow:**
1. Client submits `{ query, filter?, pagination? }`.
2. Server resolves `tenant_id`, validates/clamps `topK`.
3. Server checks tenant quota; rejects with `429` if exceeded.
4. Server embeds `query` via `AIProviderConnector.embed()`.
5. Server calls `RAGConnector.search()` with the tenant-scoped embedding and translated `RAGFilter`.
6. Server reconstructs each result's `snippet` from `social_posts`.
7. Server increments usage and returns `{ results }`.

**`POST /v1/rag/ask` flow:**
1. Client submits `{ question, filter?, maxChunks? }`.
2. Server resolves `tenant_id`, validates/clamps `maxChunks`, checks quota.
3. Server retrieves `maxChunks` chunks via the same retrieval path as `search`.
4. Server sends question + chunks to the AI provider's generation method, instructed to answer only from context and cite sources.
5. Server assembles `citations` matching the chunks actually used and assigns `confidence`.
6. Server increments usage and returns `{ answer, citations, confidence }`.

**`GET /v1/rag/status` flow:**
1. Client requests status for its tenant.
2. Server aggregates `rag_chunks_sync`/`social_posts` counts and queries store health.
3. Server returns `{ totalIndexedPosts, totalChunks, lagBehindIngestion, lastIndexedAt, storeStatus }`.

---

## 7. Data Requirements

### 7.1 Data Inputs

Natural-language `query`/`question` text; optional `RAGFilter` dimensions; `topK`/`maxChunks` pagination hints; the authenticated caller's resolved `tenant_id`; `rag_chunks_sync` and `social_posts` (for status and snippet reconstruction); vector-store search results (`postId`, `chunkIndex`, `score`).

### 7.2 Data Outputs

`search` results array; `ask` answer, citations, and confidence; `status` health payload; per-tenant usage counters incremented as a side effect.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `RagSearchRequest` | `query`, `filter?`, `pagination.topK` (default 10, max 50) | Translated into a `RAGFilter` (ADR-0083) passed to `RAGConnector.search()` |
| `RagSearchResult` | `postId`, `chunkIndex`, `score`, `platformId`, `publishedAt`, `snippet` | One entry per matched chunk; `snippet` reconstructed from `social_posts` by `postId`/`chunkIndex` |
| `RagAskRequest` | `question`, `filter?`, `maxChunks` (default 5, max 10) | Drives an internal `RagSearchRequest`, then a generation call |
| `RagAskResponse` | `answer`, `citations[]`, `confidence` (`high`/`medium`/`low`) | `citations` is a subset of the chunks retrieved for this request, one-to-one with what the model actually used |
| `RagCitation` | `postId`, `chunkIndex`, `url?`, `snippet` | References a specific chunk; `url` optional link to the original post |
| `RagStatus` | `totalIndexedPosts`, `totalChunks`, `lagBehindIngestion`, `lastIndexedAt`, `storeStatus` (`healthy`/`degraded`/`unavailable`) | Derived from `rag_chunks_sync` + `social_posts` counts and `RAGConnector` health |
| Tenant RAG usage counters | Per-tenant `search` count, `ask` count, monthly cap, current period | Consulted/incremented on every `search`/`ask` call; visible to `tenant_admin` |

### 7.4 Validation Rules

- `query` (search) / `question` (ask) must be non-empty strings.
- `pagination.topK` defaults to 10; values above 50 are rejected or clamped (implementation must be consistent).
- `maxChunks` defaults to 5; values above 10 are rejected or clamped.
- `filter.dateRange.start` must not be after `dateRange.end`.
- `filter.sentiment`, when present, must be one of `positive`/`negative`/`neutral`/`mixed`.
- Every `citations` entry in an `ask` response must correspond to a chunk that was actually retrieved and used for that answer.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Every `RAGConnector.search()` call underlying these endpoints includes the mandatory `tenant_id` equality filter (ADR-0083). | `search`, `ask` |
| BR2 | `POST /v1/rag/search` `topK` defaults to 10 and is bounded to 50. | `search` |
| BR3 | `POST /v1/rag/ask` `maxChunks` defaults to 5 and is bounded to 10. | `ask` |
| BR4 | Generated answers must be grounded solely in the chunks supplied for that question — no outside-knowledge answers. | `ask` |
| BR5 | Every citation in an `ask` response must correspond to a chunk actually used to generate the answer. | `ask` |
| BR6 | Per-tenant RAG usage (search + ask) is metered; hitting the monthly cap returns `429 RAG_QUOTA_EXCEEDED`. | `search`, `ask` |
| BR7 | Snippet and citation text are reconstructed from `social_posts`, never duplicated from the vector store. | `search`, `ask` |
| BR8 | No PII beyond public post content is indexed or returned through these endpoints. | `search`, `ask`, `status` |
| BR9 | There is no unauthenticated or public RAG access; all three endpoints require a resolved tenant identity. | `search`, `ask`, `status` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `RAGConnector` (ADR-0081) | Outbound | Executes tenant-scoped vector search | Internal service call |
| `AIProviderConnector.embed()` (ADR-0002/0082) | Outbound | Embeds the query/question text | Internal service call |
| `AIProviderConnector` generation method (ADR-0002) | Outbound | Generates the grounded answer for `ask` | Internal service call |
| `social_posts` | Inbound (read) | Source for snippet/citation text reconstruction | SQL (Postgres, RLS-scoped) |
| `rag_chunks_sync` (ADR-0083) | Inbound (read) | Source for `status` indexed-post/chunk counts and lag | SQL (Postgres) |
| Tenant usage/quota store | Bidirectional | Read current usage, increment on each call | Internal service call |
| Admin UI (ADR-0085) | Inbound (consumer) | Calls all three endpoints on behalf of the user | REST / JSON over HTTPS |
| Identity resolution (Entra-based, existing) | Inbound | Resolves authenticated caller to `tenant_id` | Existing internal auth pipeline |

---

## 10. Non-Functional Considerations

- **Performance:** `POST /v1/rag/search` should return within 1.5 seconds at the 95th percentile (NFR-001).
- **Security / access control:** Every vector query underneath these endpoints enforces the mandatory `tenant_id` filter (NFR-002); there is no public/unauthenticated RAG surface.
- **Reliability / availability:** Endpoints should maintain <1% error rate excluding quota/invalid-request responses when the vector store and source database are healthy (NFR-003).
- **Cost / compliance:** Embedding and generation calls are metered and reported per tenant (NFR-004); `ask` is deliberately more expensive than `search` because it includes a generation call, and this is bounded by `maxChunks` and the monthly quota.
- **Maintainability:** `ask` answers are generated only from retrieved chunks to limit hallucination (NFR-005) — this constrains prompt design, not just the response contract.
- **Audit and logging:** Query volume, `search` vs. `ask` split, average `topK`/`maxChunks` used, quota consumption by tenant, and p95 latency should be observable (see reporting needs in BRD-0084 Section 11).

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Empty/missing `query` or `question` | Validation error (400) | Request rejected before quota is consumed |
| `topK` > 50 or `maxChunks` > 10 | Validation error or clamped value (400 or silently clamped, per implementation) | Request rejected or bounded before reaching the vector store/generation call |
| Tenant monthly quota exceeded | `429 RAG_QUOTA_EXCEEDED` | Request rejected before embedding/generation cost is incurred |
| Vector store unreachable during `search`/`ask` | Generic 5xx error | No partial/unfiltered fallback; `GET /v1/rag/status` would separately report `unavailable` |
| Question outside scope of retrieved chunks | Answer indicates the limitation rather than fabricating a confident answer | Model instructed to answer only from context; low/no-confidence signaled (see Q2) |
| `filter.dateRange.start` after `end` | Validation error (400) | Request rejected |
| Caller `tenant_id` cannot be resolved (auth failure) | Standard authentication error | Request never reaches RAG retrieval logic |

---

## 12. Assumptions and Dependencies

- ADR-0081, ADR-0082, and ADR-0083 are accepted and implemented before these endpoints are exposed.
- Authenticated users are already resolved through the existing Entra-based identity pipeline.
- `social_posts` remains the source of truth for snippet/citation reconstruction.
- A vector index is populated and reachable before `search`/`ask` return useful results; an empty/lagging index degrades usefulness but is not itself an error state (reported via `status`).
- `AIProviderConnector` (ADR-0002) already exposes `embed()` and a usable generation method.
- Depends on Story 9.8 (chunking/embedding) and Story 9.9 (RLS/metadata) before Story 9.10 can be implemented.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `POST /v1/rag/ask` stream the answer token by token, or return a full response only? | Technical Lead | Before implementation |
| Q2 | How should the API behave when the question is outside the scope of the retrieved chunks — refuse to answer, or note the limitation explicitly in the response? | Technical Lead | Before implementation |
| Q3 | Should `search` support hybrid search (vector + keyword) in v1, or vector-only? | Technical Lead | Before implementation |
| Q4 | What is the right default `maxChunks` for `ask` — 3, 5, or 10? | Technical Lead | Before implementation |

---

## 14. Appendix

- **ADR:** `docs/adr/0084-rag-search-and-ask-endpoint.md` (Status: Proposed)
- **BRD:** `docs/project docs/Business-Requirements/BRD-0084-RAG-Search-And-Ask-Endpoint.md`
- **Feature design:** `docs/product-research/feature-designs/28-semantic-search-rag.md`
- **Deep research:** none found for this feature at this time
- **Related ADRs:** ADR-0081 (`RAGConnector`), ADR-0082 (chunking/embedding), ADR-0083 (RLS and metadata), ADR-0078 (metric explainability, same AI contract pattern), ADR-0002 (`AIProviderConnector`)
- **User stories:** Story 9.10 (`docs/user-stories/epic-9-adr-0077-to-0085.md`) — Blocked, pending ADR acceptance and Stories 9.8/9.9; consumed by Story 9.11 (ADR-0085)
- **Glossary:**
  - *RAG* — Retrieval-Augmented Generation.
  - *Chunk* — a text segment of a post suitable for embedding/retrieval.
  - *Citation* — a reference in an `ask` response pointing to a specific chunk used to generate the answer.
  - *`topK`* — maximum ranked results returned by a search.
  - *Confidence* — qualitative grade (`high`/`medium`/`low`) of the model's certainty in a generated answer.
- **Revision history:** v0.1, 2026-08-23 — initial regenerated functional design from ADR-0084/BRD-0084.
