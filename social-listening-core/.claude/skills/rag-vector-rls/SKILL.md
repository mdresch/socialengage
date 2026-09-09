---
name: rag-vector-rls
description: RAG vector-store RLS, metadata isolation, and lifecycle management (Story 9.9, ADR-0083, BRD-0083, FDD-0083) in social-listening-core. Read this before touching src/rag/ragSearchService.ts or src/rag/ragReconciliationService.ts.
---

# RAG Vector Store RLS and Metadata Lifecycle

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts` — Story 9.9 contract test.

## What this is

Governs the tenant isolation invariants, query-time metadata pre-filtering, in-place metadata updates (HITL overrides), and orphan-chunk reconciliation for the multi-tenant vector layer in `social-listening-core`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0083 | RAG vector store RLS, metadata schema, and lifecycle | 9.9 |
| ADR-0081 | RAGConnector provider abstraction | 9.7 |
| ADR-0082 | Post chunking and embedding pipeline | 9.8 |
| ADR-0071 | Human-in-the-loop overrides & metadata patching | 7.1 |

## Key Invariants

1. **Mandatory Pre-Filtering:** Vector search MUST execute tenant equality filtering prior to or during k-NN graph traversal.
2. **Bounded Metadata Payload:** Metadata payload per chunk is strictly bounded to $< 4\text{ KB}$.
3. **In-Place Metadata Updates:** `updateMetadata(tenantId, postId, partialMetadata)` modifies metadata without expensive re-embedding.
4. **Over-Fetching Fallback:** When array post-filtering is applied in-memory, over-fetch $k \times 3$ candidates.
5. **Orphan Reconciliation:** Background worker removes stale vector records when posts are deleted.
