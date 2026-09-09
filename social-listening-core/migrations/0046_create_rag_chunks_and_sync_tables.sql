-- Story 9.7, Story 9.8, Story 9.9 (ADR-0081, ADR-0082, ADR-0083)
-- Create tables for RAG vector chunks and synchronization tracking with RLS.

-- Attempt to enable pgvector extension if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not supported in this environment, skipping';
END $$;

-- Table: rag_chunks
CREATE TABLE IF NOT EXISTS rag_chunks (
  id VARCHAR(255) PRIMARY KEY, -- deterministic format ${tenant_id}:${post_id}:${chunk_index}
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  platform_id VARCHAR(64) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  watchlist_ids UUID[] DEFAULT '{}',
  sentiment VARCHAR(32),
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_post ON rag_chunks(tenant_id, post_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_published ON rag_chunks(tenant_id, published_at DESC);

-- Enable RLS on rag_chunks
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_chunks_tenant_isolation ON rag_chunks;
CREATE POLICY rag_chunks_tenant_isolation ON rag_chunks
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Table: rag_chunks_sync
CREATE TABLE IF NOT EXISTS rag_chunks_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  embedding_model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-3-small',
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- synced, pending, failed
  last_indexed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rag_chunks_sync_tenant_post UNIQUE(tenant_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_sync_status ON rag_chunks_sync(tenant_id, status);

-- Enable RLS on rag_chunks_sync
ALTER TABLE rag_chunks_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_chunks_sync_tenant_isolation ON rag_chunks_sync;
CREATE POLICY rag_chunks_sync_tenant_isolation ON rag_chunks_sync
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
