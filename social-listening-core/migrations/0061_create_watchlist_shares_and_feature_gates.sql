-- Story 12.13 (ADR-0107): Multi-user workspaces, RBAC, watchlist sharing, and feature gates

CREATE TABLE IF NOT EXISTS watchlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'edit')),
  shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(watchlist_id, shared_with_user_id)
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS feature_gates JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_watchlist_shares_tenant ON watchlist_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_shares_watchlist ON watchlist_shares(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_shares_user ON watchlist_shares(shared_with_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist_shares TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist_shares TO platform_admin_role;
GRANT UPDATE (feature_gates) ON tenants TO app_user;
GRANT UPDATE (feature_gates) ON tenants TO platform_admin_role;

ALTER TABLE watchlist_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_shares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchlist_shares_isolation ON watchlist_shares;
CREATE POLICY watchlist_shares_isolation ON watchlist_shares
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Update watchlists RLS to allow reading shared watchlists (ADR-0107 Decision §3)
DROP POLICY IF EXISTS tenant_isolation ON watchlists;
CREATE POLICY tenant_isolation ON watchlists
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR EXISTS (
        SELECT 1 FROM watchlist_shares ws
        WHERE ws.watchlist_id = watchlists.id
          AND ws.shared_with_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
