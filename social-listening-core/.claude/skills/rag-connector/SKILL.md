---
name: rag-connector
description: RAGConnector provider abstraction (Story 9.7, ADR-0081, BRD-0081, FDD-0081) — vector store operations, pgvector default provider, tenant isolation pre-filtering, deterministic chunk IDs, and connector registry in social-listening-core. Read this before touching src/rag/.
---

# RAGConnector Provider Abstraction (`src/rag/`)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.7.rag-connector.contract.test.ts` — Story 9.7 contract test.

## What this is

A vendor-agnostic provider abstraction for vector store operations (upsert, search, delete, status) supporting semantic search and generative Q&A without leaking vendor-specific code into business logic.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0081 | RAGConnector provider abstraction & pgvector default provider | 9.7 |
| ADR-0082 | Post chunking (256 tokens) and embedding pipeline | 9.8 |
| ADR-0083 | Vector store RLS and tenant metadata | 9.9 |
| ADR-0084 | RAG search and ask SSE endpoints | 9.10 |

## Key Invariants

1. **Deterministic Vector IDs:** `${tenantId}:${postId}:${chunkIndex}`.
2. **Mandatory Tenant Pre-filtering:** Every search query MUST apply `tenant_id` equality filtering before/during vector distance calculations.
3. **Canonical `RAGFilter` Shape:** `platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange`.
4. **Normalized Scores:** Similarity scores are strictly mapped to `[0.00 .. 1.00]`.
5. **Rebuildable Derived State:** `social_posts` remains the primary source of truth; vector records can be deleted and re-indexed.
