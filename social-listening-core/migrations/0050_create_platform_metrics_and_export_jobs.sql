-- Story 10.6 / 10.8 (ADR-0089, ADR-0090): Platform metrics and post export jobs

CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  granularity TEXT NOT NULL CHECK (granularity IN ('1m', '5m', '1h', '1d')),
  timestamp TIMESTAMPTZ NOT NULL,
  value NUMERIC(15,4) NOT NULL,
  unit TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_name_time ON platform_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_granularity ON platform_metrics(granularity, timestamp DESC);

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  export_type TEXT NOT NULL DEFAULT 'posts_csv',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER,
  blob_path TEXT,
  download_url TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant ON export_jobs(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_metrics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON export_jobs TO app_user;

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY export_jobs_tenant_select ON export_jobs
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY export_jobs_tenant_insert ON export_jobs
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY export_jobs_tenant_update ON export_jobs
  FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
