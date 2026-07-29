-- Story 5.3 (ADR-0014): envelope-encrypted platform credential storage.
-- tenant_id makes this a Story 5.4 (ADR-0015) table too — the RLS-enable +
-- policy below isn't optional decoration, it's what keeps that story's
-- existing schema-wide contract (story-5.4.tenant-isolation-rls) passing.
CREATE TABLE IF NOT EXISTS platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform_id TEXT NOT NULL,
  wrapped_dek BYTEA NOT NULL,
  key_vault_key_id TEXT NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_credentials TO app_user;

ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON platform_credentials;
CREATE POLICY tenant_isolation ON platform_credentials
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
