---
name: rag-connector
description: RAGConnector provider abstraction (Story 9.7, ADR-0081, BRD-0081, FDD-0081; namespace-per-tenant isolation revision Story 19.1, ADR-0136, BRD-0136, FDD-0136) — vector store operations, pgvector default provider, RLS-enforced tenant isolation (primary) plus application-level pre-filtering (mandatory defense-in-depth), deterministic chunk IDs, and connector registry in social-listening-core. Read this before touching src/rag/.
---

# RAGConnector Provider Abstraction (`src/rag/`)

## Contracts that constrain this component

- `social-listening-core/contracts/epic-9/story-9.7.rag-connector.contract.test.ts` — Story 9.7 contract test.
- `social-listening-core/contracts/epic-9/story-9.9.rag-vector-rls.contract.test.ts` — Story 9.9 contract test (application-level tenant pre-filtering).
- `social-listening-core/contracts/epic-19/story-19.1.rag-connector-namespace-isolation.contract.test.ts` — Story 19.1 contract test (RLS-enforced query path, `isolationModel`, `ensureTenantNamespace?`).

## What this is

A vendor-agnostic provider abstraction for vector store operations (upsert, search, delete, status) supporting semantic search and generative Q&A without leaking vendor-specific code into business logic.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0081 | RAGConnector provider abstraction & pgvector default provider | 9.7 |
| ADR-0082 | Post chunking (256 tokens) and embedding pipeline | 9.8 |
| ADR-0083 | Vector store RLS and tenant metadata | 9.9 |
| ADR-0084 | RAG search and ask SSE endpoints | 9.10 |
| ADR-0136 | Supersedes ADR-0081 Decision §11 — physical per-tenant isolation (RLS for pgvector) is now primary, the application-level filter mandatory secondary defense-in-depth | 19.1 |

## Key Invariants

1. **Deterministic Vector IDs:** `${tenantId}:${postId}:${chunkIndex}` — unchanged by ADR-0136.
2. **Mandatory Tenant Pre-filtering (secondary, defense-in-depth since ADR-0136):** Every search query MUST still apply `tenant_id` equality filtering before/during vector distance calculations — retained even though it is no longer pgvector's primary isolation mechanism.
3. **Physical isolation is primary (ADR-0136 Decision §2):** `PgvectorRAGConnector`'s own tenant-scoped queries (`upsert`/`search`/`deletePost`/`deleteTenant`/`status(tenantId)`) run via `getPool()` + `withTenant()` (`src/db/pool.ts`, `src/db/withTenant.ts` — the `app_user` role, subject to `rag_chunks`' `tenant_isolation` RLS policy from migrations 0046/0047/0082), **never** `getAdminPool()` (Postgres superuser, bypasses RLS unconditionally). The one exception is `status()`'s cross-tenant aggregate branch (`tenantId` omitted) — no real production caller ever omits it (`ragRouter.ts`, `ragReconciliationService.ts` always pass one); that branch legitimately has no tenant to scope by and keeps `getAdminPool()`.
4. **`isolationModel` must be honest (ADR-0136 Decision §1):** `status()` reports `isolationModel: 'row-level-rls'` for pgvector — only ever set because Invariant 3 is genuinely true, never as an aspirational label.
5. **`ensureTenantNamespace?` is optional and unimplemented by pgvector:** pgvector's isolation is a static, already-provisioned table-level RLS policy, not a resource needing per-tenant provisioning before first write. A future namespace/shard-capable provider (Story 19.3, ADR-0138) implements it; pgvector correctly omits it.
6. **Canonical `RAGFilter` Shape:** `platformId`, `sentiment`, `watchlistIds`, `topics`, `dateRange`.
7. **Normalized Scores:** Similarity scores are strictly mapped to `[0.00 .. 1.00]`.
8. **Rebuildable Derived State:** `social_posts` remains the primary source of truth; vector records can be deleted and re-indexed.
9. **Only `pgvector` is registered** in `ragConnectorRegistry.ts` as of Story 19.1 — adding a Pinecone/Azure AI Search connector is Story 19.3/ADR-0138's scope, not this component's current state.
