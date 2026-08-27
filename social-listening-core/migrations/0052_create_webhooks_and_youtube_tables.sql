-- Story 10.11 & 10.13 (ADR-0092, ADR-0093): Webhooks and YouTube Connector

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{"alert.triggered"}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code INTEGER,
  error_message TEXT,
  latency_ms INTEGER,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS youtube_channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  quota_used_today INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhook_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_delivery_attempts(subscription_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_subs_tenant ON youtube_channel_subscriptions(tenant_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_subscriptions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_delivery_attempts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON youtube_channel_subscriptions TO app_user;

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_select ON webhook_subscriptions
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY webhook_subscriptions_insert ON webhook_subscriptions
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY webhook_subscriptions_update ON webhook_subscriptions
  FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY webhook_subscriptions_delete ON webhook_subscriptions
  FOR DELETE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_delivery_attempts_select ON webhook_delivery_attempts
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY webhook_delivery_attempts_insert ON webhook_delivery_attempts
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE youtube_channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channel_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY youtube_channel_subscriptions_select ON youtube_channel_subscriptions
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY youtube_channel_subscriptions_insert ON youtube_channel_subscriptions
  FOR INSERT
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY youtube_channel_subscriptions_update ON youtube_channel_subscriptions
  FOR UPDATE
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
