-- Story 16.1 (ADR-0125, BRD-0125, FDD-0125, TDS-0125): Author-initiated takedown refinements
-- Schema definition for data_subject_requests and post redaction linkage

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID,
  post_url TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  requester_affirmation BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'received', 'under_review', 'granted', 'denied', 'escalated')),
  verification_token TEXT UNIQUE,
  verification_token_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  risk_flag BOOLEAN NOT NULL DEFAULT FALSE,
  risk_reason TEXT,
  decision_reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS redacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redaction_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_dsr_tenant_status 
  ON data_subject_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_dsr_sla_due 
  ON data_subject_requests (tenant_id, status, sla_due_at)
  WHERE status = 'received';

CREATE INDEX IF NOT EXISTS idx_dsr_risk_flag 
  ON data_subject_requests (tenant_id, risk_flag)
  WHERE risk_flag = TRUE;

CREATE INDEX IF NOT EXISTS idx_dsr_verification_token 
  ON data_subject_requests (verification_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON data_subject_requests TO app_user;

ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY data_subject_requests_tenant_isolation ON data_subject_requests
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
