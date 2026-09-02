-- Story 13.11 (ADR-0116): tenant-isolated cache for expensive semantic drift computations.
--
-- Caches the structured output of GET /v1/topics/:id/drift for 24 hours,
-- keyed by SHA-256 of (tenant_id, topic_id, start_window, end_window).

CREATE TABLE IF NOT EXISTS semantic_drift_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cache_key_hash TEXT NOT NULL,
  topic_id UUID NOT NULL,
  start_window TIMESTAMPTZ NOT NULL,
  end_window TIMESTAMPTZ NOT NULL,
  drift_result JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_semantic_drift_cache_key
  ON semantic_drift_cache(tenant_id, cache_key_hash);

CREATE INDEX IF NOT EXISTS idx_semantic_drift_cache_expiry
  ON semantic_drift_cache(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON semantic_drift_cache TO app_user;

ALTER TABLE semantic_drift_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_drift_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON semantic_drift_cache;
CREATE POLICY tenant_isolation ON semantic_drift_cache
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
