-- Story 14.4 (ADR-0121): Composer Deep Research caching, re-trigger, and cost telemetry
-- 1. Create tenant_settings table if it doesn't already exist
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  research_cache_ttl_hours INTEGER NOT NULL DEFAULT 24 CHECK (research_cache_ttl_hours >= 1 AND research_cache_ttl_hours <= 168),
  research_daily_request_cap INTEGER NOT NULL DEFAULT 50 CHECK (research_daily_request_cap >= 1 AND research_daily_request_cap <= 500),
  research_monthly_cost_cap_usd NUMERIC(10,4) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON tenant_settings TO app_user;

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_settings;
CREATE POLICY tenant_isolation ON tenant_settings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 2. Create research_cache table
CREATE TABLE IF NOT EXISTS research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  text_hash TEXT NOT NULL,
  result_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_text_hash UNIQUE (tenant_id, text_hash)
);

GRANT SELECT, INSERT, UPDATE ON research_cache TO app_user;

ALTER TABLE research_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_cache FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON research_cache;
CREATE POLICY tenant_isolation ON research_cache
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_research_cache_lookup
  ON research_cache (tenant_id, text_hash, expires_at);

-- 3. Create research_runs table
CREATE TABLE IF NOT EXISTS research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_hash TEXT NOT NULL,
  ai_provider_id TEXT NOT NULL,
  search_provider_ids TEXT[] NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON research_runs TO app_user;

ALTER TABLE research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON research_runs;
CREATE POLICY tenant_isolation ON research_runs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_research_runs_tenant_created
  ON research_runs (tenant_id, created_at DESC);
