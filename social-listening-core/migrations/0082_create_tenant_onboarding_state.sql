-- Story 17.2 (ADR-0130, TDS-0130): Role-tailored onboarding journeys with automated probe verification
CREATE TABLE IF NOT EXISTS tenant_onboarding_state (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  role_journeys JSONB NOT NULL DEFAULT '{
    "admin": { "completed": false, "steps": {} },
    "care_agent": { "completed": false, "steps": {} },
    "social_seller": { "completed": false, "steps": {} },
    "brand_manager": { "completed": false, "steps": {} }
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON tenant_onboarding_state TO app_user;

ALTER TABLE tenant_onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_onboarding_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_onboarding_state;
CREATE POLICY tenant_isolation ON tenant_onboarding_state
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
