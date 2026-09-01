-- Story 11.3 (ADR-0096): User Daily Digest Preferences and Scheduling Table

CREATE TABLE IF NOT EXISTS user_digest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  send_at_local TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  watchlist_ids UUID[] DEFAULT '{}',
  include_ai_summary BOOLEAN NOT NULL DEFAULT true,
  include_top_posts BOOLEAN NOT NULL DEFAULT true,
  include_topic_breakdown BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_digest_prefs UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_digest_scheduler 
  ON user_digest_preferences (is_enabled, timezone, send_at_local) 
  WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_user_digest_tenant_user
  ON user_digest_preferences (tenant_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_digest_preferences TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_digest_preferences TO platform_admin_role;

ALTER TABLE user_digest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_digest_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY user_digest_preferences_tenant ON user_digest_preferences
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
