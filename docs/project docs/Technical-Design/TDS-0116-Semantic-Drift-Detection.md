# Technical Design Specification (TDS) — Semantic Drift Detection

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0116: Semantic Drift Detection — Vector Embedding Centroid Analysis, Semantic Cluster Evolution & 24-Hour Cache Storage |
| **Document ID** | `TDS-0116` |
| **Feature Name** | Vector Semantic Drift Analysis & Topic Meaning Divergence Service |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/semantic-drift/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0116` | [ADR-0116: Semantic Drift Detection](../../adr/0116-semantic-drift-detection.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0116` | [BRD-0116: Semantic Drift Detection](../Business-Requirements/BRD-0116-Semantic-Drift-Detection.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0116` | [FDD-0116: Semantic Drift Detection](../Functional-Design/FDD-0116-Semantic-Drift-Detection.md) | Fully Aligned |
| **Governing User Story** | `Story 13.11` | [Epic 13: Stories 109–117](../../user-stories/epic-13-adr-0109-to-0117.md#story-1311--semantic-drift-detection-backend) | Acceptance Target |
| **Related User Stories** | `Story 11.5`, `Story 13.12` | Topic Evolution Timeline, Semantic Drift UI | Consumer Modules |
| **Related Architecture Decisions** | `ADR-0082`, `ADR-0083`, `ADR-0084`, `ADR-0097` | RAG Chunking, Vector Metadata, RAG Ask, Topic Evolution | Predecessor Lineage |
| **Executable Contract Tests** | `Story 13.11 & 13.12 Contracts` | `social-listening-core/contracts/epic-13/story-13.11.semantic-drift-detection.contract.test.ts`<br>`social-listening-admin/contracts/epic-13/story-13.12.semantic-drift-ui.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph VectorDB["Vector Store (pgvector / post_chunks)"]
        Chunks["post_chunks (topic_id, embedding, chunk_text, published_at)"]
    end

    subgraph ServiceLayer["social-listening-core: SemanticDriftService"]
        DriftRoute["GET /v1/topics/:id/drift?start=...&end=..."]
        WindowSplitter["Temporal Window Sampler (Then vs. Now)"]
        CentroidCalc["Centroid & Cosine Distance Engine"]
        Clusterer["Semantic Cluster Labeler & Sample Extractor"]
    end

    subgraph CacheStore["PostgreSQL Storage"]
        DriftCache["semantic_drift_cache (24-Hour TTL, Tenant RLS)"]
    end

    subgraph UIClient["social-listening-admin UI"]
        EvolutionUI["TopicEvolutionTimeline.tsx (Warning Icons)"]
        DriftCard["DriftExplanationCard.tsx (Cluster Comparison)"]
    end

    DriftRoute --> DriftCache
    DriftCache -->>|Cache Hit (< 24h)| DriftRoute
    DriftCache -->>|Cache Miss| WindowSplitter
    WindowSplitter --> Chunks
    Chunks --> CentroidCalc
    CentroidCalc --> Clusterer
    Clusterer -->|DriftResult DTO| DriftCache
    DriftCache --> DriftRoute
    DriftRoute --> EvolutionUI
    EvolutionUI --> DriftCard
```

### 2.2 Architectural Boundaries & Invariants
- **Vector Centroid Mathematical Model:** Drift computation queries all RAG chunks associated with `topicId` within two discrete temporal windows: $\mathcal{W}_{then}$ and $\mathcal{W}_{now}$. It computes window centroid vectors:
  $$\vec{c} = \frac{1}{|\mathcal{W}|} \sum_{v \in \mathcal{W}} \vec{v}$$
  The drift score is calculated as the cosine distance:
  $$\text{driftScore} = 1 - \frac{\vec{c}_{then} \cdot \vec{c}_{now}}{\|\vec{c}_{then}\| \|\vec{c}_{now}\|}$$
- **Standardized Warning Tiers:**
  - $\text{driftScore} < 0.2 \implies \text{warning: 'none'}$
  - $0.2 \le \text{driftScore} < 0.5 \implies \text{warning: 'mild'}$
  - $\text{driftScore} \ge 0.5 \implies \text{warning: 'significant'}$
- **24-Hour TTL Response Cache:** Vector math and cluster labeling are computationally expensive. All calculations are persisted in table `semantic_drift_cache` with a 24-hour TTL.
- **Tenant Scoping & RLS Invariant:** The target `topicId` must exist within the caller's tenant boundary. Cross-tenant queries return HTTP 404.

---

## 3. Data Architecture & Persistence Design

### 3.1 Cache DDL Schema Definition
Migration `0071_create_semantic_drift_cache.sql`:
```sql
CREATE TABLE IF NOT EXISTS semantic_drift_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    drift_score NUMERIC(5, 4) NOT NULL,
    warning TEXT NOT NULL CHECK (warning IN ('none', 'mild', 'significant')),
    top_clusters_now JSONB NOT NULL DEFAULT '[]',
    top_clusters_then JSONB NOT NULL DEFAULT '[]',
    sample_posts_now JSONB NOT NULL DEFAULT '[]',
    sample_posts_then JSONB NOT NULL DEFAULT '[]',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_drift_cache_tenant_topic_window UNIQUE (tenant_id, topic_id, start_time, end_time)
);

ALTER TABLE semantic_drift_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY semantic_drift_cache_tenant_isolation ON semantic_drift_cache
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_drift_cache_lookup ON semantic_drift_cache (tenant_id, topic_id, expires_at);
```

### 3.2 TypeScript Interface Definitions
Defined in `social-listening-core/src/rag/semanticDriftService.ts`:

```typescript
export interface DriftResult {
  topicId: string;
  start: string;                 // ISO Timestamp
  end: string;                   // ISO Timestamp
  driftScore: number;            // 0.0000 to 1.0000
  warning: 'none' | 'mild' | 'significant';
  topClustersNow: string[];      // Current semantic cluster labels
  topClustersThen: string[];     // Previous semantic cluster labels
  samplePostsNow: string[];      // Representative excerpts from current window
  samplePostsThen: string[];     // Representative excerpts from historical window
  cacheHit?: boolean;
}
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Drift Score & Centroid Distance Algorithm
```typescript
export function computeCosineDistance(vecA: number[], vecB: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0.0;
  const cosineSimilarity = Math.max(-1, Math.min(1, dot / magnitude));
  return Math.round((1.0 - cosineSimilarity) * 10000) / 10000;
}

export function classifyDriftWarning(score: number): DriftResult['warning'] {
  if (score >= 0.5) return 'significant';
  if (score >= 0.2) return 'mild';
  return 'none';
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Endpoint Specification
`GET /v1/topics/:id/drift`

- **Query Parameters:**
  - `start` (Required): ISO 8601 Timestamp for historical baseline window
  - `end` (Required): ISO 8601 Timestamp for comparison window
- **Response Format (200 OK):**
```json
{
  "topicId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "start": "2026-08-01T00:00:00Z",
  "end": "2026-09-01T00:00:00Z",
  "driftScore": 0.5842,
  "warning": "significant",
  "topClustersNow": ["Swift Programming Syntax", "Xcode Development Tools"],
  "topClustersThen": ["Taylor Swift Eras Tour", "Concert Ticket Sales"],
  "samplePostsNow": ["Discussing modern Swift concurrency patterns and async/await."],
  "samplePostsThen": ["Great experience seeing the tour live in Amsterdam last night!"],
  "cacheHit": false
}
```

---

## 6. Security, Tenancy & Isolation Model
- **Strict Tenant Authorization:** Topic existence is verified against the authenticated tenant. Querying another tenant's topic ID returns HTTP 404 (`Topic not found`).
- **Vector Partitioning:** Post chunk embeddings in `post_chunks` are scoped by `tenant_id`, preventing cross-tenant cluster extraction.

---

## 7. Performance, Scalability & Resource Caps
- **Sampling Ceilings:** To prevent memory exhaustion during centroid calculation, each window samples a maximum of 500 representative vector chunks.
- **24-Hour Cache Hit:** Cached responses return in $< 12\text{ms}$.

---

## 8. Resilience, Recovery & Failure Semantics
- **Sparse Data:** If either window contains fewer than 3 chunks, the service returns `driftScore: 0.0`, `warning: 'none'`, and empty cluster lists without failing.

---

## 9. Observability, Telemetry & Auditability
- Emits metric: `semantic_drift_computed{topic_id, warning, drift_score, cache_hit}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Schema migration `0071` creates the isolated cache table. Rollback drops `semantic_drift_cache` without affecting topic definitions.

---

## 11. Verification, Testing & Quality Assurance
- **Story 13.11 Contract:** `social-listening-core/contracts/epic-13/story-13.11.semantic-drift-detection.contract.test.ts`
  - AC1/AC2: Computes centroid drift; returns `warning: 'significant'` on score $\ge 0.5$.
  - AC3: Identical windows return score $< 0.2$ with `warning: 'none'`.
  - AC4/AC5: Validates cluster label generation and sample post extraction.
  - AC6/AC7: Validates 24-hour cache hit and `expires_at` column.
  - AC8: Cross-tenant topic returns 404; cross-tenant cache bleed is prevented.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0116-1]** **Dynamic vector sample sizes.** Allowing tenants with $>100,000$ posts to configure larger vector sample sizes.
- [ ] **[Q-0116-2]** **Automatic drift alerts.** Emitting webhook notifications when a tracked topic crosses into `significant` drift.
- [ ] **[Q-0116-3]** **Sub-topic drift analysis.** Computing drift across sub-topic child nodes in hierarchical taxonomies.
