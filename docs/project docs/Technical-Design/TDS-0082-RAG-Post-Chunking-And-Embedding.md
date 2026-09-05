# Technical Design Specification (TDS) — RAG Post Chunking and Embedding Pipeline

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0082: RAG Post Chunking and Embedding Pipeline — Overlapping Text Segmentation, Vector Encoding & Synchronization Engine |
| **Document ID** | `TDS-0082` |
| **Feature Name** | Asynchronous Post Chunking, 1536-Dimensional Embeddings & Index Bookkeeping |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/semantic-search-rag/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0082` | [ADR-0082: RAG Post Chunking and Embedding Pipeline](../../adr/0082-rag-post-chunking-and-embedding.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0082` | [BRD-0082: RAG Post Chunking And Embedding](../Business-Requirements/BRD-0082-RAG-Post-Chunking-And-Embedding.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0082` | [FDD-0082: RAG Post Chunking And Embedding](../Functional-Design/FDD-0082-RAG-Post-Chunking-And-Embedding.md) | Fully Aligned |
| **Governing User Story** | `Story 9.8` | [Epic 9: ADRs 0077–0085](../../user-stories/epic-9-adr-0077-to-0085.md#story-98--rag-post-chunking-and-embedding-pipeline-backend) | Acceptance Target |
| **Related User Stories** | `Story 9.7`, `Story 9.9`, `Story 9.10`, `Story 19.2` | Vector Store Abstraction, Vector RLS, Search Endpoints, Namespace Routing | Component Lineage |
| **Related Architecture Decisions** | `ADR-0018`, `ADR-0038`, `ADR-0053`, `ADR-0081`, `ADR-0137` | Data Retention, AI Provider, Markdown Normalization, Vector Abstraction, Chunk Routing | System Architecture |
| **Executable Contract Tests** | `Story 9.8 Contract` | `social-listening-core/contracts/epic-9/story-9.8.rag-chunking-pipeline.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Ingestion["Ingestion Pipeline (social-listening-core)"]
        PostSaved["Post Persisted in social_posts"]
        EmitEvent["Emit RAGIndexRequestedEvent"]
    end

    subgraph RAGWorker["Asynchronous RAGIndexingWorker"]
        Queue["RAG Indexing Queue"]
        Chunker["RAGChunkingService.split(post)"]
        Embedder["AIProviderConnector.embed(tenantId, chunks)"]
        Upserter["RAGConnector.upsert(tenantId, vectors)"]
        SyncTracker["Sync Bookkeeping (rag_chunks_sync)"]
    end

    subgraph EmbeddingProvider["Dedicated Azure OpenAI Deployment"]
        Ada["text-embedding-3-small (1536 dimensions)"]
    end

    subgraph Storage["PostgreSQL Database"]
        SyncTable["rag_chunks_sync Table
        - tenant_id, post_id, chunk_count
        - embedding_model, status, last_indexed_at"]
    end

    subgraph VectorEngine["Vector Store (e.g. pgvector)"]
        Index["Vector Embeddings & Chunks"]
    end

    PostSaved --> EmitEvent
    EmitEvent --> Queue
    Queue --> Chunker
    Chunker -->|256 tokens + 20% overlap| Embedder
    Embedder -->|HTTP POST 1536-dim| Ada
    Ada -->> Embedder: Dense Vectors
    Embedder --> Upserter
    Upserter --> Index
    Upserter --> SyncTracker
    SyncTracker --> SyncTable
```

### 2.2 Architectural Boundaries & Invariants
- **Asynchronous Decoupling Invariant:** Post chunking and vector embedding execute asynchronously via `RAGIndexRequestedEvent` out-of-band from primary post ingestion. A vector database timeout or embedding rate-limit never fails, slows, or blocks live post persistence into `social_posts`.
- **Text Chunking Rules:**
  - Target chunk size: **256 tokens** with **20% overlap** ($\approx 51$ tokens).
  - Segmentation prefers sentence and paragraph boundaries over hard token truncations.
  - **Short Post Guarantee:** Posts under 64 tokens are **never discarded**; they are retained as a single chunk containing the full post body.
  - **Title Prepending:** If `post.title` exists, `Title: {title}\n\n` is prepended to chunk content. This contextual prefix improves retrieval relevance for headline-heavy news articles.
- **Dedicated Embedding Model:** Utilizes `text-embedding-3-small` (1536 dimensions) deployed on Azure OpenAI Service. Generation/chat models (`gpt-4o-mini`) are never called for vector embedding.
- **Orphan Chunk Prevention on Re-Index:** If an edited post is re-indexed and produces fewer chunks than before (`new_chunk_count < old_chunk_count`), obsolete vector IDs `${tenantId}:${postId}:${new_chunk_count}` through `${tenantId}:${postId}:${old_chunk_count - 1}` are deleted prior to upserting the new chunk set.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Schema Definition
Migration `0075_create_rag_chunks_sync.sql`:
```sql
CREATE TABLE IF NOT EXISTS rag_chunks_sync (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    chunk_count INT NOT NULL DEFAULT 0,
    embedding_model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-3-small',
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('synced', 'pending', 'failed')),
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,
    PRIMARY KEY (tenant_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_sync_status 
ON rag_chunks_sync (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_sync_lag 
ON rag_chunks_sync (tenant_id, last_indexed_at);
```

### 3.2 TypeScript Contracts
`social-listening-core/src/rag/chunkingTypes.ts`:
```typescript
export interface RAGChunk {
  tenant_id: string;
  post_id: string;
  chunk_index: number;
  content: string; // canonical chunk text
}

export interface EmbeddedRAGChunk {
  id: string; // `${tenantId}:${postId}:${chunkIndex}`
  vector: number[]; // 1536 float elements
  metadata: RAGChunkMetadata;
}

export interface RAGChunkingService {
  split(post: SocialPost): RAGChunk[];
  embed(tenantId: string, chunks: RAGChunk[]): Promise<EmbeddedRAGChunk[]>;
}
```

---

## 4. Application Logic & Workflows

### 4.1 Chunking & Embedding Worker Pipeline
```typescript
export async function processPostIndexing(
  tenantId: string,
  post: SocialPost,
  chunkingService: RAGChunkingService,
  ragConnector: RAGConnector,
  client: PoolClient
): Promise<void> {
  // 1. Fetch previous sync state
  const prevSync = await client.query(
    `SELECT chunk_count FROM rag_chunks_sync WHERE tenant_id = $1 AND post_id = $2`,
    [tenantId, post.id]
  );
  const oldChunkCount = prevSync.rows[0]?.chunk_count || 0;

  // 2. Generate chunks
  const chunks = chunkingService.split(post);
  const newChunkCount = chunks.length;

  // 3. Clean up orphan chunks if re-indexing produced fewer chunks
  if (oldChunkCount > newChunkCount) {
    for (let i = newChunkCount; i < oldChunkCount; i++) {
      const orphanId = `${tenantId}:${post.id}:${i}`;
      await ragConnector.deleteVector(tenantId, orphanId);
    }
  }

  // 4. Generate embeddings via text-embedding-3-small
  const embeddedChunks = await chunkingService.embed(tenantId, chunks);

  // 5. Upsert vectors into store
  await ragConnector.upsert(tenantId, embeddedChunks);

  // 6. Update bookkeeping
  await client.query(
    `INSERT INTO rag_chunks_sync (tenant_id, post_id, chunk_count, embedding_model, status, last_indexed_at)
     VALUES ($1, $2, $3, 'text-embedding-3-small', 'synced', NOW())
     ON CONFLICT (tenant_id, post_id) DO UPDATE 
     SET chunk_count = EXCLUDED.chunk_count,
         status = 'synced',
         last_indexed_at = NOW(),
         error_message = NULL`,
    [tenantId, post.id, newChunkCount]
  );
}
```

---

## 5. Interface & API Contracts

### 5.1 Internal Service Methods
| Method | Input | Output | Error Policy |
|---|---|---|---|
| `split(post)` | `SocialPost` | `RAGChunk[]` | Bounded sliding window, sentence boundary aware |
| `embed(tenantId, chunks)` | `tenantId`, `RAGChunk[]` | `Promise<EmbeddedRAGChunk[]>` | Batch HTTP call to Azure OpenAI (1536 dim) |

---

## 6. Security, Tenancy & Isolation Model
- **Tenant ID Stamping:** Every chunk explicitly embeds `tenant_id` in `RAGChunk.tenant_id` and the vector ID `${tenantId}:${postId}:${chunkIndex}`.
- **Tenant Offboarding Sync:** When a tenant is deleted, `rag_chunks_sync` rows cascade delete, and `RAGConnector.deleteTenant(tenantId)` purges all vector records.

---

## 7. Performance, Scalability & Resource Caps
- **Embedding Batching:** Chunks are sent to `text-embedding-3-small` in batches of 16 to maximize Azure OpenAI throughput.
- **Worker Concurrency:** Indexing worker runs with concurrency ceiling of 4 workers per tenant to prevent exhausting token-per-minute (TPM) limits.

---

## 8. Resilience, Recovery & Failure Semantics
- **Failed State Bookkeeping:** If Azure OpenAI throws HTTP 429 or network disconnect, `rag_chunks_sync.status` is set to `'failed'` with `error_message` and re-queued with exponential backoff (10s, 30s, 1m).

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `rag_chunks_created_total{tenant_id}`
  - `rag_embedding_duration_ms`
  - `rag_indexing_lag_count{tenant_id}`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Embedding Model Migration:** The `rag_chunks_sync.embedding_model` column tracks the model that generated each vector. Upgrading to a new embedding model triggers background batch re-indexing of older rows.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-9/story-9.8.rag-chunking-pipeline.contract.test.ts`:
  - (1) Verifies text splitting honors 256 token limit with 20% overlap.
  - (2) Confirms short posts (< 64 tokens) are preserved as 1 chunk.
  - (3) Verifies title prepending behavior (`Title: {title}\n\n`).
  - (4) Asserts orphan chunk cleanup when re-indexing shorter content.
  - (5) Confirms sync bookkeeping row creation in `rag_chunks_sync`.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0082-1]** **Dynamic Tokenizer Alignment:** Using `tiktoken` in-process for exact token boundary calculations matching Azure OpenAI models.
- [ ] **[Q-0082-2]** **Multilingual Chunking Optimization:** Tuning overlap percentages for East Asian languages (CJK characters).
