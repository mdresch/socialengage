# ADR-0138: RAG vector store — namespace-per-tenant isolation and pgvector RLS

**Status:** Accepted (2026-08-28)

**Authorizes:** refinements to ADR-0083: establishes physical namespace isolation on Pinecone (
amespace: tenant_id), dedicated shards on Weaviate, and explicit Postgres Row-Level Security policies on ag_chunks pgvector tables.