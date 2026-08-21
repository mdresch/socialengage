-- Story 2.24 (ADR-0068 Decision §2) -- Instagram Business and Creator
-- accounts connected via Facebook Pages / Meta Graph API.
-- Tracks account metadata (ig_user_id, username, page_id, page_name)
-- and references the stored encrypted Page access token credential.
-- See .claude/skills/instagram-connector/SKILL.md.
CREATE TABLE instagram_connected_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id),
  ig_user_id    TEXT NOT NULL,          -- Meta's own Instagram Business User ID
  username      TEXT NOT NULL,          -- Instagram @handle
  page_id       TEXT NOT NULL,          -- Linked parent Facebook Page ID
  page_name     TEXT NOT NULL,          -- Linked parent Facebook Page display name
  credential_id UUID REFERENCES platform_credentials(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'removed', 'orphaned', 'reconnect_required')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, ig_user_id)
);

GRANT SELECT, INSERT, UPDATE ON instagram_connected_accounts TO app_user;

ALTER TABLE instagram_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_connected_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON instagram_connected_accounts;
CREATE POLICY tenant_isolation ON instagram_connected_accounts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_instagram_connected_accounts_tenant_user ON instagram_connected_accounts(tenant_id, user_id);

DROP TRIGGER IF EXISTS update_instagram_connected_accounts_updated_at ON instagram_connected_accounts;
CREATE TRIGGER update_instagram_connected_accounts_updated_at
  BEFORE UPDATE ON instagram_connected_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
