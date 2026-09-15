---
name: rag-vector-rls
description: RAG vector-store RLS, metadata isolation, and lifecycle management (Story 9.9, ADR-0083, BRD-0083, FDD-0083; namespace-isolation revision Story 19.3, ADR-0138, BRD-0138, FDD-0138) in social-listening-core. Read this before touching src/rag/ragSearchService.ts or src/rag/ragReconciliationService.ts.
---

# RAG Vector Store RLS and Metadata Lifecycle

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts` — Story 9.9 contract test.
- `social-listening-core/contracts/epic-19/story-19.3.rag-vector-store-namespace-isolation.contract.test.ts` — Story 19.3 contract test (`reconcileOrphanedRAGChunks()`'s `withTenant()` fix).

## What this is

Governs the tenant isolation invariants, query-time metadata pre-filtering, in-place metadata updates (HITL overrides), and orphan-chunk reconciliation for the multi-tenant vector layer in `social-listening-core`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0083 | RAG vector store RLS, metadata schema, and lifecycle | 9.9 |
| ADR-0081 | RAGConnector provider abstraction | 9.7 |
| ADR-0082 | Post chunking and embedding pipeline | 9.8 |
| ADR-0071 | Human-in-the-loop overrides & metadata patching | 7.1 |
| ADR-0138 | Confirms pgvector's RLS isolation (already delivered, Story 19.1); fixes `reconcileOrphanedRAGChunks()`'s fail-closed missing-`withTenant()` defect; documents (does not build) Pinecone/Weaviate physical-isolation architecture | 19.3 |

## Key Invariants

1. **Mandatory Pre-Filtering:** Vector search MUST execute tenant equality filtering prior to or during k-NN graph traversal.
2. **Bounded Metadata Payload:** Metadata payload per chunk is strictly bounded to $< 4\text{ KB}$.
3. **In-Place Metadata Updates:** `updateMetadata(tenantId, postId, partialMetadata)` modifies metadata without expensive re-embedding.
4. **Over-Fetching Fallback:** When array post-filtering is applied in-memory, over-fetch $k \times 3$ candidates.
5. **`reconcileOrphanedRAGChunks()`'s real-DB branch must always go through `withTenant()` (Story 19.3/ADR-0138):** it previously called `getPool().query(...)` directly with no session context set at all, so `rag_chunks`/`social_posts`' RLS policies (both `FORCE`d) made its orphan-detection query return zero rows unconditionally — fail-closed, not a leak, but reconciliation silently never found anything. Fixed by wrapping the query and its `rag_chunks_sync` cleanup delete in one `withTenant(tenantId, ...)` call, the same mechanism Story 19.1/19.2 already applied elsewhere in `src/rag/`.
6. **This is NOT actually a scheduled background worker (correction, 2026-09-14, ADR-0138 Context §4):** this line previously claimed a "background worker" removes stale vector records. Confirmed by direct codebase-wide search: nothing anywhere (`server.ts`, `bootstrapConnectors.ts`, any cron/scheduler file) ever calls `RAGReconciliationService`/`reconcileOrphanedRAGChunks` — ADR-0083 Decision §4 item 5's "periodic background worker" promise has never actually been fulfilled. The method is now *correct* when invoked (Invariant 5), but nothing invokes it. A real, separately-flagged gap against ADR-0083 itself (ADR-0138 Open Question Q-0138-3), not fixed here.
7. **pgvector's own RLS-based tenant isolation is delivered elsewhere, not by this component:** see `.claude/skills/rag-connector/SKILL.md` Invariant 3 — `PgvectorRAGConnector`'s own queries (Story 19.1) and `rag_chunks_sync` writes (`ragIndexingPipeline.ts`, Story 19.2) are already RLS-enforced. This component's own remaining RLS surface was exactly Invariant 5's fix.
