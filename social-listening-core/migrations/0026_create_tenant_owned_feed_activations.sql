-- Story 2.11 (ADR-0050): tenant-owned-domain RSS/content-feed connector's
-- own DNS TXT domain-ownership verification state. Per ADR-0050 Decision
-- §3/§5's "Verification state storage" — a per-(tenantId, activation)
-- record tracking domain, feed URL, verification token, token expiry, and
-- verified/pending/expired status. A tenant may hold more than one row
-- (multiple verified domains) — no uniqueness constraint forces one row per
-- tenant; ADR-0050 Open Question 2 leaves multi-domain UX unresolved, but
-- the storage model already supports it, per that Question's own text.
-- See .claude/skills/tenant-owned-feed-connector/SKILL.md.

CREATE TABLE IF NOT EXISTS tenant_owned_feed_activations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  domain               TEXT NOT NULL,
  feed_url             TEXT NOT NULL,
  verification_token   TEXT NOT NULL,
  txt_record_host      TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
  token_expires_at     TIMESTAMPTZ NOT NULL,
  verified_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON tenant_owned_feed_activations TO app_user;

ALTER TABLE tenant_owned_feed_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_owned_feed_activations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_owned_feed_activations;
CREATE POLICY tenant_isolation ON tenant_owned_feed_activations
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_tenant_owned_feed_activations_tenant_id ON tenant_owned_feed_activations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_owned_feed_activations_tenant_status ON tenant_owned_feed_activations(tenant_id, status);

-- ADR-0044 §4's already-established, project-wide trigger-set updated_at
-- convention (update_updated_at_column(), defined in migration 0014).
DROP TRIGGER IF EXISTS update_tenant_owned_feed_activations_updated_at ON tenant_owned_feed_activations;
CREATE TRIGGER update_tenant_owned_feed_activations_updated_at
  BEFORE UPDATE ON tenant_owned_feed_activations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
