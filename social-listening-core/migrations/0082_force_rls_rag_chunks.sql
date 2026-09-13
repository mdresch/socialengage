-- Story 19.1 (ADR-0136): close the gap flagged in ADR-0136 Context §3 — rag_chunks
-- enabled RLS (migration 0046) but never FORCEd it, unlike every other tenant table
-- in this project (see migration 0002's own established pattern for social_posts).
-- FORCE alone would not have fixed the real bypass (PgvectorRAGConnector ran its
-- queries as the Postgres superuser via getAdminPool(), and superusers are never
-- subject to RLS regardless of FORCE) — src/rag/pgvectorConnector.ts is switched in
-- this same story to query via getPool()/withTenant() (the non-superuser app_user
-- role) instead. This migration brings rag_chunks's own RLS configuration up to the
-- same standard as every other tenant table, for defense-in-depth consistency.
ALTER TABLE rag_chunks FORCE ROW LEVEL SECURITY;
