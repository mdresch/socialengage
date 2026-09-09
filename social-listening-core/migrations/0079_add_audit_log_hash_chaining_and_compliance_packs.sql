-- Story 16.3 (ADR-0127, BRD-0127, FDD-0127, TDS-0127): Cryptographic Audit Log Hash Chaining & Manifest Export
-- Adds Merkle-tree hash chaining columns to platform_admin_audit_log, creates tenant_audit_log and compliance_audit_packs tables.

-- 1. Alter platform_admin_audit_log to store cryptographic hash chain digests
ALTER TABLE platform_admin_audit_log
  ADD COLUMN IF NOT EXISTS previous_record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  ADD COLUMN IF NOT EXISTS record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_record_hash
  ON platform_admin_audit_log (record_hash);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_log_tenant_seq
  ON platform_admin_audit_log (target_tenant_id, created_at ASC, id ASC);

-- 2. Create tenant_audit_log table with RLS tenant isolation
CREATE TABLE IF NOT EXISTS tenant_audit_log (
  seq BIGSERIAL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  record_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_audit_log ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant_seq
  ON tenant_audit_log (tenant_id, seq ASC);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_record_hash
  ON tenant_audit_log (record_hash);

GRANT SELECT, INSERT ON tenant_audit_log TO app_user;

ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_audit_log_isolation ON tenant_audit_log
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 3. Create compliance_audit_packs table
CREATE TABLE IF NOT EXISTS compliance_audit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  generated_by_user_id UUID,
  pack_type TEXT NOT NULL DEFAULT 'full',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  storage_path TEXT,
  sha256 TEXT,
  merkle_root TEXT,
  manifest JSONB,
  zip_data BYTEA,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_packs_tenant
  ON compliance_audit_packs (tenant_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_audit_packs TO app_user;

ALTER TABLE compliance_audit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_packs FORCE ROW LEVEL SECURITY;

CREATE POLICY compliance_audit_packs_tenant_isolation ON compliance_audit_packs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
