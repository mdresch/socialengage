---
name: rag-chunking-pipeline
description: RAG post chunking and embedding pipeline (Story 9.8, ADR-0082, BRD-0082, FDD-0082) — 256-token overlapping chunker, title prepending, sync tracking, and orphan-chunk cleanup in social-listening-core. Read this before touching src/rag/ragChunkingService.ts or src/rag/ragIndexingPipeline.ts.
---

# RAG Post Chunking and Embedding Pipeline

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.8.rag-chunking-pipeline.contract.test.ts` — Story 9.8 contract test.

## What this is

An asynchronous post chunking and embedding pipeline in `social-listening-core` that splits incoming posts into overlapping chunks, generates vector embeddings, upserts to vector storage, and tracks synchronization status in `rag_chunks_sync`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0082 | RAG post chunking (256 tokens) and embedding pipeline | 9.8 |
| ADR-0081 | RAGConnector provider abstraction | 9.7 |
| ADR-0083 | Vector store RLS & metadata | 9.9 |

## Key Invariants

1. **256-Token Chunk Target:** ~20% overlap, respecting sentence and paragraph boundaries.
2. **Short Post Rule:** Posts < 64 tokens are never discarded; they are indexed as a single chunk.
3. **Title Context:** If present, `Title: {title}\n\n` is prepended to chunk content for topical context.
4. **Dedicated Embedding Model:** Configured for `text-embedding-3-small` (1536 dims).
5. **Orphan-chunk Cleanup:** When re-indexing shorter content, obsolete chunks are pruned.
6. **Sync Status Tracking:** Status recorded in `rag_chunks_sync` (`synced`, `pending`, `failed`).
