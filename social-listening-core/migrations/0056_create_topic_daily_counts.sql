-- Story 11.5 (ADR-0097): Topic daily counts table for topic evolution timeline analytics

CREATE TABLE IF NOT EXISTS topic_daily_counts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  topic TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  unique_authors INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  mixed_count INTEGER NOT NULL DEFAULT 0,
  top_keywords JSONB NOT NULL DEFAULT '[]',
  top_authors JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date, topic)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON topic_daily_counts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON topic_daily_counts TO platform_admin_role;

ALTER TABLE topic_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_daily_counts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON topic_daily_counts;
CREATE POLICY tenant_isolation ON topic_daily_counts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
