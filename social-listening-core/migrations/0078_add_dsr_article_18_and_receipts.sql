-- Story 16.2 (ADR-0126, BRD-0126, FDD-0126, TDS-0126): DSR Article 18 Restriction Quarantining & Verified Receipts
-- Schema refinements for processing restriction flag and cryptographic submission receipts

-- 1. Add processing_restricted flag to social_posts table
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS processing_restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Partial index on active (unrestricted) posts for fast query filtering
CREATE INDEX IF NOT EXISTS idx_social_posts_active_processing
  ON social_posts (tenant_id, created_at)
  WHERE processing_restricted = FALSE;

-- 3. Add request_type to data_subject_requests
ALTER TABLE data_subject_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'takedown'
  CHECK (request_type IN ('access', 'rectification', 'erasure', 'restriction', 'takedown'));

-- 4. Cryptographic DSR Receipts table
CREATE TABLE IF NOT EXISTS dsr_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES data_subject_requests(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  receipt_signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dsr_request_receipt UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_dsr_receipts_tenant
  ON dsr_receipts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_dsr_receipts_subject_hash
  ON dsr_receipts (tenant_id, subject_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON dsr_receipts TO app_user;

ALTER TABLE dsr_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY dsr_receipts_tenant_isolation ON dsr_receipts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
