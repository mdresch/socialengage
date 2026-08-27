-- Story 10.9 (ADR-0091): Real-time alert rules and tenant alerts schema

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('volume_spike', 'negative_sentiment_spike', 'influential_post', 'connector_error', 'keyword_burst')),
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE SET NULL,
  platform_id TEXT,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TIMESTAMPTZ,
  channels TEXT[] NOT NULL DEFAULT '{"in_app"}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'snoozed')),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_tenant_alerts_tenant_status ON tenant_alerts(tenant_id, status, triggered_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON alert_rules TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_alerts TO app_user;

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY alert_rules_tenant_select ON alert_rules
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY alert_rules_tenant_insert ON alert_rules
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY alert_rules_tenant_update ON alert_rules
  FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY alert_rules_tenant_delete ON alert_rules
  FOR DELETE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_alerts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_alerts_select ON tenant_alerts
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_alerts_insert ON tenant_alerts
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_alerts_update ON tenant_alerts
  FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY tenant_alerts_delete ON tenant_alerts
  FOR DELETE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
