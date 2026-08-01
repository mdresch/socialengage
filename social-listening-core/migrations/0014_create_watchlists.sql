-- Watchlist CRUD (Phase 1 "also build, not storied" work)
-- See .claude/skills/watchlist-crud/SKILL.md and docs/open-items-and-deferred-work.md §A.
-- Backs POST /v1/watchlists, GET /v1/watchlists, PATCH /v1/watchlists/:id, DELETE /v1/watchlists/:id.
-- Tenant isolation enforced via RLS per ADR-0015, matching social_posts/ingestion_runs/platform_credentials pattern.

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('keyword', 'hashtag', 'account', 'boolean')),
  terms TEXT[],
  boolean_query TEXT,
  platform_ids TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON watchlists TO app_user;

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON watchlists;
CREATE POLICY tenant_isolation ON watchlists
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Indexes: tenant_id is the primary RLS filter; id is primary key; match_type supports filtering by type
CREATE INDEX IF NOT EXISTS idx_watchlists_tenant_id ON watchlists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_tenant_match_type ON watchlists(tenant_id, match_type);
CREATE INDEX IF NOT EXISTS idx_watchlists_created_at ON watchlists(created_at);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_watchlists_updated_at ON watchlists;
CREATE TRIGGER update_watchlists_updated_at
  BEFORE UPDATE ON watchlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
