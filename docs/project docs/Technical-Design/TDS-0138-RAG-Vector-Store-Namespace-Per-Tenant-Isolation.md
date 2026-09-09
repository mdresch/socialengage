# Technical Design Specification (TDS) — RAG Vector-Store Namespace-Per-Tenant Isolation

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0138: RAG Vector-Store Namespace-Per-Tenant Isolation — Pinecone Namespaces & PostgreSQL pgvector RLS Architecture |
| **Document ID** | `TDS-0138` |
| **Feature Name** | Physical Multi-Tenant Isolation, Pinecone Namespaces & Database-Enforced pgvector RLS |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-core/.claude/skills/semantic-search-rag/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0138` | [ADR-0138: RAG Vector Store — Namespace-Per-Tenant Isolation](../../adr/0138-rag-vector-store-namespace-per-tenant-isolation.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0138` | [BRD-0138: RAG Vector Store Namespace-Per-Tenant Isolation](../Business-Requirements/BRD-0138-RAG-Vector-Store-Namespace-Per-Tenant-Isolation.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0138` | [FDD-0138: RAG Vector Store Namespace-Per-Tenant Isolation](../Functional-Design/FDD-0138-RAG-Vector-Store-Namespace-Per-Tenant-Isolation.md) | Fully Aligned |
| **Governing User Story** | `Story 19.3` | [Epic 19: ADRs 0136–0140](../../user-stories/epic-19-adr-0136-to-0140.md#story-193--rag-vector-store-namespace-isolation-and-pgvector-rls-backend) | Acceptance Target |
| **Related User Stories** | `Story 9.9`, `Story 19.1`, `Story 19.4` | Baseline Vector RLS, Namespace Abstraction, Search Namespace Resolution | Sibling & Precedent Flows |
| **Related Architecture Decisions** | `ADR-0015`, `ADR-0083`, `ADR-0136`, `ADR-0139` | Tenant RLS, Vector Metadata, Namespace Abstraction, Search Resolution | System Architecture |
| **Executable Contract Tests** | `Story 19.3 Contract` | `social-listening-core/contracts/epic-19/story-19.3.rag-vector-store-namespace.contract.test.ts` | Ready for Suite Execution |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientQuery["Tenant Query Context"]
        TenantAuth["withTenant(tenantId)"]
        QueryVector["Embedded Query Vector (1536 dim)"]
    end

    subgraph IsolationLayer["RAG Vector Store Isolation Layer"]
        PGVectorBackend["pgvector (PostgreSQL RLS Engine)"]
        PineconeBackend["Pinecone Serverless (Namespace Engine)"]
    end

    subgraph HardwarePartitions["Physical Storage Partitions"]
        RLSTable[("rag_post_chunks Table
        RLS Policy: tenant_id = app.current_tenant_id")]
        PNS1[("Pinecone Namespace: tenant_AAA")]
        PNS2[("Pinecone Namespace: tenant_BBB")]
    end

    TenantAuth --> QueryVector
    QueryVector --> PGVectorBackend
    QueryVector --> PineconeBackend

    PGVectorBackend -->|SET LOCAL app.current_tenant_id| RLSTable
    PineconeBackend -->|index.namespace('tenant_AAA')| PNS1
    PineconeBackend -.->|Strictly Inaccessible| PNS2
```

### 2.2 Architectural Boundaries & Invariants
- **Database-Enforced pgvector RLS (Closing ADR-0083 Gap):** The pgvector storage table `rag_post_chunks` enforces native PostgreSQL Row-Level Security:
  $$\text{tenant\_id} = \text{current\_setting('app.current\_tenant\_id', true)::uuid}$$
  Application-level `WHERE` clauses are no longer the sole security boundary; database RLS guarantees zero cross-tenant leakage even if an application bug omits a filter.
- **Dedicated Pinecone Namespaces:** On Pinecone Serverless, each tenant is allocated an isolated namespace string: `tenant_${tenantId}`. Vector upsert, query, and delete operations execute exclusively against that namespace client.
- **Mandatory Dual-Layer Guard (Defense-in-Depth):** In addition to physical namespace routing and database RLS, all search operations inject a secondary metadata filter `tenant_id == caller.tenantId`.
- **Instantaneous Namespace Deletion:** Offboarding an organization triggers native namespace deletion on Pinecone, dropping millions of vector records in $< 100\text{ms}$ without scanning the index.

---

## 3. Data Architecture & Persistence Design

### 3.1 DDL Schema with Hardened RLS Policy
Migration `0083_harden_pgvector_rls_policy.sql`:
```sql
ALTER TABLE rag_post_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_post_chunks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_post_chunks_tenant_isolation ON rag_post_chunks;

CREATE POLICY rag_post_chunks_tenant_isolation ON rag_post_chunks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 4. Application Logic & Workflows

### 4.1 Pinecone Namespace Dispatcher
```typescript
export class PineconeVectorStore {
  private client: Pinecone;
  private indexName: string;

  constructor(apiKey: string, indexName: string) {
    this.client = new Pinecone({ apiKey });
    this.indexName = indexName;
  }

  getTenantScope(tenantId: string) {
    const namespace = `tenant_${tenantId}`;
    return this.client.index(this.indexName).namespace(namespace);
  }

  async queryTenant(tenantId: string, vector: number[], topK: number, filter?: object) {
    const ns = this.getTenantScope(tenantId);
    return ns.query({
      vector,
      topK,
      filter: { ...filter, tenant_id: { $eq: tenantId } }, // Defense-in-depth
      includeMetadata: true,
    });
  }

  async purgeTenant(tenantId: string) {
    const ns = this.getTenantScope(tenantId);
    await ns.deleteAll(); // Instant O(1) physical wipe
  }
}
```

---

## 5. Interface & API Contracts

### 5.1 Provider Verification Matrix
| Invariant Requirement | pgvector Architecture | Pinecone Architecture |
|---|---|---|
| **Primary Isolation Boundary** | PostgreSQL RLS (`app.current_tenant_id`) | Dedicated Namespace (`tenant_${id}`) |
| **Secondary Boundary** | SQL WHERE `tenant_id = $1` | Metadata filter `{"tenant_id": {"$eq": id}}` |
| **Tenant Offboarding** | SQL `DELETE WHERE tenant_id = $1` | Native `namespace.deleteAll()` |
| **Cross-Tenant Bleed Risk** | Zero (Blocked by Postgres kernel) | Zero (Isolated by Pinecone graph partition) |

---

## 6. Security, Tenancy & Isolation Model
- **Kernel-Level Isolation:** `FORCE ROW LEVEL SECURITY` ensures even table owners and maintenance connections running without superuser bypass cannot accidentally read cross-tenant vector chunks.

---

## 7. Performance, Scalability & Resource Caps
- **RU Cost Reduction:** Pinecone namespace queries scan only the tenant's vector graph subset, reducing billed Request Units by up to $90\%$ compared to global index filtering.

---

## 8. Resilience, Recovery & Failure Semantics
- **Atomic Deletion Guarantee:** Namespace deletion returns confirmation upon complete unlinking of partition roots.

---

## 9. Observability, Telemetry & Auditability
- **Metrics Tracked:**
  - `rag_namespace_queries_total{tenant_id}`
  - `rag_rls_violations_blocked_total`

---

## 10. Migration, Compatibility & Rollback Strategy
- **Migration Plan:** `0083_harden_pgvector_rls_policy.sql` applies `FORCE ROW LEVEL SECURITY` seamlessly.

---

## 11. Verification, Testing & Quality Assurance
- **Contract Test Suite:** `social-listening-core/contracts/epic-19/story-19.3.rag-vector-store-namespace.contract.test.ts`:
  - (1) Confirms pgvector rejects queries across tenants when `app.current_tenant_id` mismatches.
  - (2) Proves Pinecone connector targets `tenant_${tenantId}` namespace.
  - (3) Verifies `purgeTenant()` executes instant namespace wipe.

---

## 12. Open Questions & Future Enhancements

- [ ] **[Q-0138-1]** **Namespace Warmup:** Pre-warming namespace index graphs in Pinecone prior to heavy user query sessions.
