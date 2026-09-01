-- Story 11.1 (ADR-0095) — CRM Connector and Case Handoff tables
-- Widen outbound_activities to support activity_type='crm_handoff', author_id, and error_details.
-- Create tenant-scoped crm_field_mappings table with PostgreSQL RLS.

-- 1. Widen outbound_activities check constraint and add author/error columns
ALTER TABLE outbound_activities
  DROP CONSTRAINT IF EXISTS outbound_activities_activity_type_check;

ALTER TABLE outbound_activities
  ADD CONSTRAINT outbound_activities_activity_type_check
    CHECK (activity_type IN ('reply', 'post', 'crm_handoff'));

ALTER TABLE outbound_activities
  ADD COLUMN IF NOT EXISTS author_id UUID NULL,
  ADD COLUMN IF NOT EXISTS error_details JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_activities_crm_dedup
  ON outbound_activities (tenant_id, post_id, provider_id, status)
  WHERE activity_type = 'crm_handoff';

-- 2. Create crm_field_mappings table
CREATE TABLE IF NOT EXISTS crm_field_mappings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  crm_connector_id TEXT        NOT NULL,
  entity_type      TEXT        NOT NULL CHECK (entity_type IN ('lead', 'opportunity', 'support')),
  source_field     TEXT        NOT NULL,
  target_field     TEXT        NOT NULL,
  is_required      BOOLEAN     NOT NULL DEFAULT false,
  default_value    TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_crm_field_mapping UNIQUE (tenant_id, crm_connector_id, entity_type, source_field)
);

CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_lookup
  ON crm_field_mappings (tenant_id, crm_connector_id, entity_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON crm_field_mappings TO app_user;

ALTER TABLE crm_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_field_mappings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON crm_field_mappings;
CREATE POLICY tenant_isolation ON crm_field_mappings
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
