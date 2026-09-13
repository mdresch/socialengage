-- Story 19.2 (ADR-0137 Decision §3 / Open Question Q1): close the same gap migration
-- 0082 closed for rag_chunks, now for its sibling bookkeeping table. rag_chunks_sync
-- enabled RLS (migration 0046) but never FORCEd it. FORCE alone would not have fixed
-- the real bypass (indexPostForRAG() ran its rag_chunks_sync write as the Postgres
-- superuser via getAdminPool()) — src/rag/ragIndexingPipeline.ts is switched in this
-- same story to write via getPool()/withTenant() (the non-superuser app_user role)
-- instead. This migration brings rag_chunks_sync's own RLS configuration up to the
-- same standard as rag_chunks and every other tenant table, for defense-in-depth
-- consistency.
ALTER TABLE rag_chunks_sync FORCE ROW LEVEL SECURITY;
