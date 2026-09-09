-- Story 13.7 (ADR-0113): persistent, tenant-isolated metric explanation cache.
--
-- Caches the structured output of POST /v1/explain for up to 5 minutes by default,
-- keyed by SHA-256 of (tenantId, metricKey, value, timeRange, filters, promptVersion).
-- The cache is advisory: a miss or an explicit no-cache request regenerates.
-- Every call is still logged in platform_admin_audit_log for cost/performance auditing.

CREATE TABLE IF NOT EXISTS metric_explanation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cache_key_hash TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  value TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  generation_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_explanation_cache_key
  ON metric_explanation_cache(tenant_id, cache_key_hash);

CREATE INDEX IF NOT EXISTS idx_metric_explanation_cache_expiry
  ON metric_explanation_cache(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON metric_explanation_cache TO app_user;

ALTER TABLE metric_explanation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_explanation_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON metric_explanation_cache;
CREATE POLICY tenant_isolation ON metric_explanation_cache
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
