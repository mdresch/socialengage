-- Story 1.11 (ADR-0051): connector activation, decoupled from credential
-- presence. Two new, ownership-scoped tables mirroring platform_credentials'
-- own tenant/user split (ADR-0028 Tier 2/Tier 3, Story 1.7/ADR-0034) but
-- wholly separate from it -- neither table is ever pre-populated (ADR-0051
-- Decision Section 1's own lazy-creation rule: absence of a row means
-- "never activated," read identically to is_active = false).
-- See .claude/skills/connector-activation/SKILL.md.

CREATE TABLE IF NOT EXISTS connector_activations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  platform_id    TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  activated_at   TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform_id)
);

GRANT SELECT, INSERT, UPDATE ON connector_activations TO app_user;

ALTER TABLE connector_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_activations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON connector_activations;
CREATE POLICY tenant_isolation ON connector_activations
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_connector_activations_tenant_platform ON connector_activations(tenant_id, platform_id);

-- ADR-0044 Section 4's already-established, project-wide trigger-set
-- updated_at convention (update_updated_at_column(), defined in migration
-- 0014) -- this is a mutable, tenant-scoped table, not on that convention's
-- own exempt list.
DROP TRIGGER IF EXISTS update_connector_activations_updated_at ON connector_activations;
CREATE TRIGGER update_connector_activations_updated_at
  BEFORE UPDATE ON connector_activations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- connector_user_activations: the Tier 3, user-specific scope. user_id is
-- REFERENCES users(id) ON DELETE CASCADE (mirrors watchlists.user_id's own
-- precedent and reasoning, migration 0025 -- personal state disappearing
-- along with the person who owns it is correct here too). This is why Story
-- 3.8's tenant-deletion pipeline needs no changes: cascade deletion handles
-- it, rather than adding this table to tenantDeletion.ts's own explicit
-- ordered batch-delete list. updated_by (both tables) is ON DELETE SET NULL
-- -- an audit pointer, not ownership, so it must never block deleting the
-- user who last flipped the flag.
CREATE TABLE IF NOT EXISTS connector_user_activations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  platform_id    TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  activated_at   TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON connector_user_activations TO app_user;

ALTER TABLE connector_user_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_user_activations FORCE ROW LEVEL SECURITY;

-- Tenant-only RLS, deliberately -- mirrors platform_credentials' own real,
-- verified pattern (migrations/0019's own comment: "RLS is deliberately
-- unchanged... ownership stays an application-layer check"), not
-- watchlists' fully-private, RLS-enforced-ownership pattern. This lets a
-- tenant_admin deactivate a user's personal activation for offboarding
-- (mirroring disconnect's own Story 1.7 AC5 precedent), the same way a
-- second RLS predicate on watchlists would have made impossible there.
DROP POLICY IF EXISTS tenant_isolation ON connector_user_activations;
CREATE POLICY tenant_isolation ON connector_user_activations
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_connector_user_activations_tenant_platform_user ON connector_user_activations(tenant_id, platform_id, user_id);

DROP TRIGGER IF EXISTS update_connector_user_activations_updated_at ON connector_user_activations;
CREATE TRIGGER update_connector_user_activations_updated_at
  BEFORE UPDATE ON connector_user_activations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
