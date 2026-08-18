-- Story 6.27 (ADR-0060 Decision §1) -- one Facebook OAuth grant (one user's
-- own long-lived User token) may now result in more than one connected,
-- independently-polled Page. A new, small child table referencing
-- platform_credentials by id -- not a discriminator column on
-- platform_credentials itself (that table stays provider-agnostic), and not
-- an overload of getLatestCredentialId()/deleteCredential() (those two
-- functions structurally assume at most one live row per tuple, and every
-- other connector in this project's roster still correctly needs that).
-- See .claude/skills/facebook-connector/SKILL.md.
CREATE TABLE facebook_connected_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id),
  page_id       TEXT NOT NULL,          -- Meta's own Page id
  page_name     TEXT NOT NULL,          -- cached display name, refreshed on (re)connect
  -- ON DELETE SET NULL (not RESTRICT): a soft-removed row must survive its
  -- own credential's real deletion (Decision §1/§5's own "destroy the
  -- secret promptly, keep the audit row" design) -- nullable to allow it.
  credential_id UUID REFERENCES platform_credentials(id) ON DELETE SET NULL,
  -- 'orphaned' (added at ADR-0060 review): a re-consent /exchange call whose
  -- returned Page list no longer includes this page_id -- Meta's own access
  -- grant ended without anyone here clicking "disconnect". Distinct from
  -- 'removed' (the tenant's own deliberate disconnect action).
  status        TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'removed', 'orphaned')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, page_id)
);

GRANT SELECT, INSERT, UPDATE ON facebook_connected_pages TO app_user;

ALTER TABLE facebook_connected_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_connected_pages FORCE ROW LEVEL SECURITY;

-- Standard tenant_isolation policy (ADR-0015) -- same as every other
-- tenant-scoped table. Per-user ownership within a tenant is an
-- application-layer check (every store function below is called with the
-- caller's own resolved userId, never a client-supplied one), mirroring
-- platform_credentials'/connector_user_activations' own already-established
-- "RLS is tenant-only, ownership is application-layer" pattern.
DROP POLICY IF EXISTS tenant_isolation ON facebook_connected_pages;
CREATE POLICY tenant_isolation ON facebook_connected_pages
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_facebook_connected_pages_tenant_user ON facebook_connected_pages(tenant_id, user_id);

DROP TRIGGER IF EXISTS update_facebook_connected_pages_updated_at ON facebook_connected_pages;
CREATE TRIGGER update_facebook_connected_pages_updated_at
  BEFORE UPDATE ON facebook_connected_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
