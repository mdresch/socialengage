# Technical Design Specification (TDS) — RAG Search & Ask Endpoints

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0084: RAG Search & Ask Endpoints — Semantic Vector Retrieval, Dual-Mode SSE Generative Q&A & Status Reporting |
| **Document ID** | `TDS-0084` |
| **Feature Name** | Semantic/Hybrid Vector Search, Grounded Generative Q&A & Streaming API Contracts |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/semantic-search-rag/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0084` | [ADR-0084: RAG Search and Ask Endpoint](../../adr/0084-rag-search-and-ask-endpoint.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0084` | [BRD-0084: RAG Search And Ask Endpoint](../Business-Requirements/BRD-0084-RAG-Search-And-Ask-Endpoint.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0084` | [FDD-0084: RAG Search And Ask Endpoint](../Functional-Design/FDD-0084-RAG-Search-And-Ask-Endpoint.md) | Fully Aligned |
| **Governing User Story** | `Story 9.10` | [Epic 9: ADRs 0077–0085](../../user-stories/epic-9-adr-0077-to-0085.md#story-910--rag-search-and-ask-endpoint-backend) | Acceptance Target |
| **Related User Stories** | `Story 9.11`, `Story 13.12`, `Story 19.4` | RAG UI Patterns, Semantic Drift UI, Namespace Resolution Refinement | Consumer & Refinement Modules |
| **Related Architecture Decisions** | `ADR-0081`, `ADR-0082`, `ADR-0083`, `ADR-0085`, `ADR-0139` | Vector Abstraction, Chunking, Vector RLS, UI UX Patterns, Namespace Resolution | System Architecture |
| **Executable Contract Tests** | `Story 9.10 Contract` | `social-listening-core/contracts/epic-9/story-9.10.rag-endpoints.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientApp["Client (social-listening-admin)"]
        SearchTab["Semantic Search View"]
        AskTab["Ask AI Q&A View (SSE Streaming Client)"]
        StatusWidget["RAG Health Indicator"]
    end

    subgraph RAGRouter["API Layer (social-listening-core)"]
        SearchRoute["POST /v1/rag/search"]
        AskRoute["POST /v1/rag/ask (Blocking or SSE)"]
        StatusRoute["GET /v1/rag/status"]
    end

    subgraph ServiceEngine["RAG Orchestration Engine"]
        SearchService["RAGSearchService (Query Embedding + Pre-filter)"]
        AskService["RAGAskService (Prompt Assembly + SSE Streamer)"]
        StatusService["RAGStatusService (rag_chunks_sync Lag Evaluation)"]
    end

    subgraph UpstreamAI["Azure OpenAI Service"]
        EmbeddingModel["text-embedding-3-small (1536-dim)"]
        ChatModel["gpt-4o-mini (SSE Chunk Streamer)"]
    end

    subgraph VectorDB["Vector Store (pgvector / Pinecone)"]
        VectorIndex["Tenant Vector Store (Pre-Filtered)"]
    end

    SearchTab --> SearchRoute
    SearchRoute --> SearchService
    SearchService --> EmbeddingModel
    SearchService --> VectorIndex

    AskTab --> AskRoute
    AskRoute --> AskService
    AskService --> SearchService
    AskService -->|XML Context Boundary| ChatModel
    ChatModel -->> AskService: Token Stream
    AskService -->> AskTab: SSE Events (citations -> delta -> done)

    StatusWidget --> StatusRoute
    StatusRoute --> StatusService
```

### 2.2 Architectural Boundaries & Invariants
- **Normalized Relevance Scoring:** Vendor distance scores are translated by `RAGSearchService` into a standard floating-point similarity range:
  $$\text{Normalized Score} \in [0.00, 1.00]$$
  where $1.00$ represents an exact semantic match.
- **Dual-Mode `/ask` Contract:** Supports both blocking JSON responses and real-time Server-Sent Events (SSE) streaming via `Accept: text/event-stream` or query param `stream=true`.
- **Three-Phase SSE Event Protocol:**
  1. `event: citations`: Dispatched immediately following vector retrieval, supplying client UI with source metadata before the first LLM token generates.
  2. `event: delta`: Dispatches incremental token chunks `{"text": "..."}` as emitted by the generative model.
  3. `event: done`: Dispatches terminal summary payload including `confidence: 'high' | 'medium' | 'low' | 'unsupported'` and `isGrounded: boolean`.
- **Prompt Injection Defense & Strict Grounding:** Chunk snippets injected into the system prompt are enclosed within strict XML boundaries (`<context><chunk id="N">...</chunk></context>`). The system prompt instructs the model: *"Answer ONLY using the provided chunks. If the answer cannot be deduced, state that the corpus lacks sufficient information and do not speculate."*
- **Direct Snippet Provenance:** Snippets are sourced directly from `RAGChunkMetadata.content` within the vector index, eliminating database joins to `social_posts`.

---

## 3. Data Architecture & Persistence Design

### 3.1 Contract TypeScript Interfaces
`social-listening-core/src/rag/endpointTypes.ts`:
```typescript
export interface RAGSearchRequest {
  query: string;
  searchMode?: 'semantic' | 'hybrid';
  filter?: RAGFilter;
  pagination?: {
    topK?: number; // default 10, max 50
  };
}

export interface RAGSearchResultItem {
  postId: string;
  chunkIndex: number;
  score: number; // 0.00 .. 1.00
  platformId: PlatformId;
  publishedAt: string;
  snippet: string;
  internalUrl: string; // /app/posts/${postId}
}

export interface RAGSearchResponse {
  results: RAGSearchResultItem[];
  totalReturned: number;
}

export interface RAGAskRequest {
  question: string;
  filter?: RAGFilter;
  maxChunks?: number; // default 5, max 10 (~1,280 tokens context)
  stream?: boolean;
}

export interface RAGCitation {
  citationIndex: number; // 1-based matching [^1]
  postId: string;
  chunkIndex: number;
  snippet: string;
  platformId: PlatformId;
  publishedAt: string;
  internalUrl: string;
}

export interface RAGAskResponse {
  answer: string;
  citations: RAGCitation[];
  confidence: 'high' | 'medium' | 'low' | 'unsupported';
  isGrounded: boolean;
}

export interface RAGStatusResponse {
  totalIndexedPosts: number;
  totalChunks: number;
  lagBehindIngestion: number;
  lastIndexedAt: string | null;
  storeStatus: 'healthy' | 'degraded' | 'unavailable';
}
```

---

## 4. Application Logic & Workflows

### 4.1 SSE Streaming Handler (`askStreamHandler.ts`)
```typescript
export async function streamRAGAsk(
  tenantId: string,
  request: RAGAskRequest,
  res: Response,
  searchService: RAGSearchService,
  aiConnector: AIProviderConnector
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 1. Retrieve top context chunks
  const topChunks = await searchService.search(tenantId, request.question, {
    topK: Math.min(request.maxChunks || 5, 10),
    filter: request.filter,
  });

  // 2. Map citations & dispatch immediate citations event
  const citations: RAGCitation[] = topChunks.map((c, idx) => ({
    citationIndex: idx + 1,
    postId: c.metadata.post_id,
    chunkIndex: c.metadata.chunk_index,
    snippet: c.metadata.content,
    platformId: c.metadata.platform_id as PlatformId,
    publishedAt: c.metadata.published_at,
    internalUrl: `/app/posts/${c.metadata.post_id}`,
  }));

  res.write(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`);

  // 3. Stream generative answer from LLM
  const stream = await aiConnector.streamAnswer(request.question, citations);
  for await (const chunk of stream) {
    res.write(`event: delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
  }

  // 4. Send terminal done event
  const donePayload = {
    confidence: stream.finalConfidence || 'high',
    isGrounded: stream.isGrounded !== false,
  };
  res.write(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`);
  res.end();
}
```

---

## 5. Interface & API Contracts

### 5.1 Route Catalog
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/v1/rag/search` | Tenant-User | Executes semantic vector pre-filtered search |
| `POST` | `/v1/rag/ask` | Tenant-User | Grounded natural-language Q&A (JSON or SSE stream) |
| `GET` | `/v1/rag/status` | Tenant-User, Tenant-Admin | Retrieves vector indexing health and ingestion lag |

### 5.2 Status Response (`GET /v1/rag/status`)
**Response (200 OK):**
```json
{
  "totalIndexedPosts": 4820,
  "totalChunks": 9640,
  "lagBehindIngestion": 3,
  "lastIndexedAt": "2026-09-05T15:58:00.000Z",
  "storeStatus": "healthy"
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Strict Query Pre-Filtering:** Vector search queries execute with immutable tenant filter `tenant_id = caller.tenantId`.
- **System Prompt Sandboxing:** Injected snippets are sanitized to escape XML tags (`&lt;`, `&gt;`), preventing prompt injection attacks.

---

## 7. Performance, Scalability & Resource Caps
- **TopK Bounds:** `topK` capped at 50 results for `/search` and 10 chunks for `/ask`.
- **Context Ceiling:** Total input tokens to generative LLM capped at ~1,500 tokens per `/ask` query.

---

## 8. Resilience, Recovery & Failure Semantics
- **Stream Interruption Handling:** If the client disconnects prematurely during SSE streaming, the backend cancels the upstream LLM generation request immediately to conserve tokens.

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `rag_search_requests_total{tenant_id, search_mode}`
  - `rag_ask_requests_total{tenant_id, stream_mode}`
  - `rag_ask_refusals_total{tenant_id}`
  - `rag_ask_latency_ms`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Compatibility:** Fully backward-compatible; clients can consume `/ask` as standard blocking JSON or upgrade to streaming without breaking contract changes.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-9/story-9.10.rag-endpoints.contract.test.ts`:
  - (1) Confirms `POST /v1/rag/search` returns normalized scores `[0.00..1.00]`.
  - (2) Proves `POST /v1/rag/ask` generates valid inline citation markers `[^1]`.
  - (3) Verifies SSE streaming protocol (`citations`, `delta`, `done` event sequence).
  - (4) Confirms `GET /v1/rag/status` reports accurate lag count from `rag_chunks_sync`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0084-1]** **Conversational Multi-Turn Memory:** Adding session-based thread IDs to `/v1/rag/ask` for follow-up conversational queries.
- [ ] **[Q-0084-2]** **Physical Namespace Routing Refinement:** Routing query embeddings directly to tenant-dedicated namespaces (addressed in ADR-0139).
