---
name: rag-chunking-pipeline
description: RAG post chunking and embedding pipeline (Story 9.8, ADR-0082, BRD-0082, FDD-0082; namespace-routing revision Story 19.2, ADR-0137, BRD-0137, FDD-0137) — 256-token overlapping chunker, title prepending, RLS-enforced sync tracking, and the ensureTenantNamespace? provisioning call site in social-listening-core. Read this before touching src/rag/ragChunkingService.ts or src/rag/ragIndexingPipeline.ts.
---

# RAG Post Chunking and Embedding Pipeline

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.8.rag-chunking-pipeline.contract.test.ts` — Story 9.8 contract test.
- `social-listening-core/contracts/epic-19/story-19.2.rag-chunking-embedding-namespace-routing.contract.test.ts` — Story 19.2 contract test (`ensureTenantNamespace?()` call site, `rag_chunks_sync` RLS enforcement).

## What this is

An asynchronous post chunking and embedding pipeline in `social-listening-core` that splits incoming posts into overlapping chunks, generates vector embeddings, upserts to vector storage, and tracks synchronization status in `rag_chunks_sync`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0082 | RAG post chunking (256 tokens) and embedding pipeline | 9.8 |
| ADR-0081 | RAGConnector provider abstraction | 9.7 |
| ADR-0083 | Vector store RLS & metadata | 9.9 |
| ADR-0137 | Confirms the pipeline needs no signature change under ADR-0136; wires `ensureTenantNamespace?()` into `indexPostForRAG()`; fixes `rag_chunks_sync`'s admin-pool RLS bypass | 19.2 |

## Key Invariants

1. **256-Token Chunk Target:** ~20% overlap, respecting sentence and paragraph boundaries.
2. **Short Post Rule:** Posts < 64 tokens are never discarded; they are indexed as a single chunk.
3. **Title Context:** If present, `Title: {title}\n\n` is prepended to chunk content for topical context.
4. **Dedicated Embedding Model:** Configured for `text-embedding-3-small` (1536 dims).
5. **Orphan-chunk cleanup is NOT actually implemented (correction, 2026-09-13, ADR-0137 Context §5):** `indexPostForRAG()`'s Step 3 computes an obsolete vector ID when re-indexing to fewer chunks but never deletes it — dead code. This line previously claimed cleanup happens; it does not. A real, verified gap against ADR-0082 Decision §5, explicitly flagged (not fixed) for a future ADR-0082/Story 9.8 revisit — see ADR-0137 Context §5/Decision §4.
6. **Sync Status Tracking:** Status recorded in `rag_chunks_sync` (`synced`, `pending`, `failed`).
7. **`ensureTenantNamespace?()` call site (ADR-0136/ADR-0137):** `indexPostForRAG()` calls `await connector.ensureTenantNamespace?.(tenantId)` immediately before `connector.upsert(...)`, inside the existing per-attempt retry block — a no-op for providers that don't implement it (pgvector, today), a working provisioning hook for a future namespace-capable provider (Story 19.3). This is the hook's only caller in the codebase.
8. **`rag_chunks_sync` writes are RLS-enforced, primary mechanism (ADR-0137 Decision §3):** `indexPostForRAG()`'s own `rag_chunks_sync` write runs via `withTenant()`/`getPool()` (the `app_user` role), never `getAdminPool()` — the same fix Story 19.1 applied to `rag_chunks` in `PgvectorRAGConnector`, extended here to the pipeline layer's own sibling bookkeeping table (migrations 0046/0047/0083).
9. **`backfill.ts`'s cross-tenant reads via `getAdminPool()` remain a sanctioned exception** (a genuine one-time/on-demand batch job across all tenants, per `.claude/skills/postgres-tenant-db/SKILL.md`'s Known Gaps precedent) — not an instance of the bug Invariant 8 fixes. `ragReconciliationService.ts`'s own separate, more severe defect (never calls `withTenant()` at all, fails closed) is out of this component's scope — flagged for ADR-0138/Story 19.3 (see `.claude/skills/rag-vector-rls/SKILL.md`).
