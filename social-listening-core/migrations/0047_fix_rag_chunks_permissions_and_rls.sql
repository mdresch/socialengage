-- Migration 0047: Grant app_user permissions on RAG tables and align RLS setting with app.tenant_id

GRANT SELECT, INSERT, UPDATE, DELETE ON rag_chunks TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON rag_chunks_sync TO app_user;

DROP POLICY IF EXISTS rag_chunks_tenant_isolation ON rag_chunks;
CREATE POLICY rag_chunks_tenant_isolation ON rag_chunks
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS rag_chunks_sync_tenant_isolation ON rag_chunks_sync;
CREATE POLICY rag_chunks_sync_tenant_isolation ON rag_chunks_sync
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
