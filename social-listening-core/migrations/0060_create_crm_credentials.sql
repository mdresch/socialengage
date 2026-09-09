-- Story 11.x — CRM connector credential storage.
-- Tenant-scoped, envelope-encrypted, same pattern as platform_credentials.
CREATE TABLE IF NOT EXISTS crm_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  crm_connector_id TEXT NOT NULL,
  wrapped_dek BYTEA NOT NULL,
  key_vault_key_id TEXT NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_crm_credentials UNIQUE (tenant_id, crm_connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_credentials TO app_user;

ALTER TABLE crm_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON crm_credentials;
CREATE POLICY tenant_isolation ON crm_credentials
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
