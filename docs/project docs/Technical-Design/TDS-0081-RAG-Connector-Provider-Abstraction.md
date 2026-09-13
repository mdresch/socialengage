# Technical Design Specification (TDS) — RAGConnector Provider Abstraction

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0081: RAGConnector Provider Abstraction — Vendor-Agnostic Vector Store Interface & Multi-Tenant Query Contracts |
| **Document ID** | `TDS-0081` |
| **Feature Name** | RAG Vector Store Abstraction Layer & Provider Registry |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/semantic-search-rag/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0081` | [ADR-0081: RAGConnector Provider Abstraction](../../adr/0081-rag-connector-provider-abstraction.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0081` | [BRD-0081: RAGConnector Provider Abstraction](../Business-Requirements/BRD-0081-RAGConnector-Provider-Abstraction.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0081` | [FDD-0081: RAGConnector Provider Abstraction](../Functional-Design/FDD-0081-RAGConnector-Provider-Abstraction.md) | Fully Aligned |
| **Governing User Story** | `Story 9.7` | [Epic 9: ADRs 0077–0085](../../user-stories/epic-9-adr-0077-to-0085.md#story-97--ragconnector-provider-abstraction-backend) | Acceptance Target |
| **Related User Stories** | `Story 9.8`, `Story 9.9`, `Story 9.10`, `Story 19.1` | Chunking Pipeline, Vector Store RLS, RAG Search/Ask, Namespace Isolation | Sibling & Refinement Flows |
| **Related Architecture Decisions** | `ADR-0002`, `ADR-0015`, `ADR-0082`, `ADR-0083`, `ADR-0136` | Connector Pattern, Tenant Isolation, Chunking, Metadata Schema, Namespace Refinement | System Architecture |
| **Executable Contract Tests** | `Story 9.7 Contract` | `social-listening-core/contracts/epic-9/story-9.7.rag-connector.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph CoreServices["social-listening-core Engine"]
        Chunker["RAGChunkingService (ADR-0082)"]
        SearchService["RAGSearchService (ADR-0084)"]
        Registry["RAGConnectorRegistry"]
        Interface["RAGConnector Interface"]
    end

    subgraph ConcreteBackends["Pluggable Vector Store Implementations"]
        PGVector["PGVectorConnector (v1 Default - Azure Postgres RLS)"]
        Pinecone["PineconeServerlessConnector (Managed Cloud)"]
        AzureSearch["AzureAISearchConnector (Azure Native Hybrid)"]
    end

    subgraph StorageEngine["Vector Storage Engines"]
        PostgresDB[("Azure Database for PostgreSQL (pgvector extension)")]
        PineconeIndex[("Pinecone Serverless Index")]
        AzureSearchIndex[("Azure AI Search Vector Index")]
    end

    Chunker -->|upsert(tenantId, vectors)| Registry
    SearchService -->|search(tenantId, queryVector, opts)| Registry
    Registry --> Interface
    Interface --> PGVector
    Interface --> Pinecone
    Interface --> AzureSearch
    PGVector --> PostgresDB
    Pinecone --> PineconeIndex
    AzureSearch --> AzureSearchIndex
```

### 2.2 Architectural Boundaries & Invariants
- **Vendor-Agnostic Contract:** `RAGConnector` abstracts all vector-store operations (`upsert`, `search`, `deletePost`, `deleteTenant`, `status`), preventing leakage of vendor-specific query constructs (Pinecone Mongo operators, OData filters, pgvector cosine operators `<=>`) into application layers.
- **Mandatory Tenant Scoping:** Every method signature enforces a mandatory `tenantId: string` parameter. Calls without explicit tenant identity are rejected immediately.
- **Inline Text Payload Invariant:** Vector metadata stores the canonical chunk text (`content: string`). This allows generative synthesis (RAG) to source context directly from vector results without executing secondary database joins to `social_posts`.
- **Deterministic Vector ID Scheme:** Chunks are uniquely identified across all vector engines using the deterministic format:
  $$\text{Vector ID} = \text{tenant\_id} \mathbin{:} \text{post\_id} \mathbin{:} \text{chunk\_index}$$
- **v1 Default Engine:** `pgvector` co-located in Azure Database for PostgreSQL is the v1 default, providing zero external infrastructure cost and leveraging existing transactional boundaries (ADR-0015/ADR-0016).

---

## 3. Data Architecture & Persistence Design

### 3.1 Interface & Metadata Types
`social-listening-core/src/rag/types.ts`:
```typescript
export interface RAGChunkMetadata {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  content: string; // text payload, <= 256 tokens (~1.5 KB)
  platform_id: string;
  published_at: string;
  watchlist_ids?: string[];
  sentiment?: string;
  topics?: string[];
}

export interface RAGFilter {
  platformId?: string | string[];
  sentiment?: string | string[];
  watchlistIds?: string[];
  topics?: string[];
  dateRange?: { from?: string; to?: string };
}

export interface RAGSearchOptions {
  topK: number;
  filter?: RAGFilter;
  textQuery?: string; // hybrid lexical search
  minScore?: number;
}

export interface RAGSearchResult {
  id: string;
  score: number; // normalized [0.00 .. 1.00]
  metadata: RAGChunkMetadata;
}

export interface RAGConnector {
  readonly id: string;
  upsert(
    tenantId: string,
    vectors: Array<{ id: string; values: number[]; metadata: RAGChunkMetadata }>
  ): Promise<void>;
  search(
    tenantId: string,
    queryVector: number[],
    options: RAGSearchOptions
  ): Promise<RAGSearchResult[]>;
  deletePost(tenantId: string, postId: string): Promise<void>;
  deleteTenant(tenantId: string): Promise<void>;
  status(tenantId?: string): Promise<{ healthy: boolean; lagCount: number }>;
}
```

---

## 4. Application Logic & Workflows

### 4.1 Filter Translation Pattern
Each connector maps the generic `RAGFilter` into native target syntax:
```typescript
// PGVector filter translator
export function translateFilterToPgSql(tenantId: string, filter?: RAGFilter): { whereClause: string; params: any[] } {
  const conditions = ['tenant_id = $1'];
  const params: any[] = [tenantId];

  if (filter?.platformId) {
    params.push(Array.isArray(filter.platformId) ? filter.platformId : [filter.platformId]);
    conditions.push(`platform_id = ANY($${params.length})`);
  }
  if (filter?.sentiment) {
    params.push(filter.sentiment);
    conditions.push(`sentiment = $${params.length}`);
  }
  if (filter?.watchlistIds && filter.watchlistIds.length > 0) {
    params.push(filter.watchlistIds);
    conditions.push(`watchlist_ids && $${params.length}`);
  }
  if (filter?.dateRange?.from) {
    params.push(filter.dateRange.from);
    conditions.push(`published_at >= $${params.length}`);
  }

  return { whereClause: conditions.join(' AND '), params };
}
```

---

## 5. Interface & API Contracts

### 5.1 Connector Capabilities Matrix
| Operation | PGVector | Pinecone Serverless | Azure AI Search |
|---|---|---|---|
| **Vector Upsert** | SQL INSERT / ON CONFLICT | HTTP REST / gRPC | REST Document Index |
| **Cosine Search** | `<=>` Cosine Distance | Cosine Metric | Cosine / HNSW |
| **Hybrid Search** | `tsvector` + Vector RRF | Sparse-Dense Vectors | Native Hybrid Text/Vector |
| **Filter Evaluation** | SQL WHERE clause | Metadata Filter JSON | OData `$filter` |

---

## 6. Security, Tenancy & Isolation Model
- **Metadata Equality Filtering:** Every query automatically injects `tenant_id == caller.tenantId`. Querying without tenant isolation is impossible at the interface layer.
- **Tenant Deletion Cascades:** Calling `deleteTenant(tenantId)` purges all vector chunks, embeddings, and metadata records belonging to the target tenant in compliance with GDPR Article 17 right-to-erasure.

---

## 7. Performance, Scalability & Resource Caps
- **Chunk Batching:** `upsert()` processes vectors in batches of 100 items to avoid network buffer overflows.
- **Metadata Bounding:** Total chunk metadata is strictly bounded to $< 4\text{ KB}$ per vector.

---

## 8. Resilience, Recovery & Failure Semantics
- **Reconstructability:** Vector records are derived indexes. If the vector index experiences catastrophic data loss, it can be regenerated by re-running the chunking pipeline over `social_posts`.

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `rag_connector_upsert_duration_ms{provider_id}`
  - `rag_connector_search_duration_ms{provider_id}`
  - `rag_connector_vectors_total{tenant_id, provider_id}`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Provider Switching:** Changing `RAG_PROVIDER` in environment configuration switches the active connector without application rebuilds.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-9/story-9.7.rag-connector.contract.test.ts`:
  - (1) Proves `upsert()` and `search()` operations conform to `RAGConnector`.
  - (2) Verifies tenant isolation: search under Tenant A never returns vectors for Tenant B.
  - (3) Confirms `deletePost()` removes all chunk indices for that post.
  - (4) Verifies `deleteTenant()` purges all tenant records.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0081-1]** **Dynamic RRF Hybrid Tuning:** Adjusting Reciprocal Rank Fusion (RRF) weights between dense semantic search and sparse BM25 text queries.
- [ ] **[Q-0081-2]** **Physical Namespace Migration:** Transitioning from metadata filtering to hard physical tenant namespaces (addressed in ADR-0136).
