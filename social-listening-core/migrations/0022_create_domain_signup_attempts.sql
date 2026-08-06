-- Story 5.15/5.16 (ADR-0037 §8b): domain_signup_attempts -- every
-- domain-match rejection (§3) is durably recorded against the MATCHED,
-- already-existing tenant, RLS-scoped exactly like every other
-- tenant-content table (ADR-0015's ordinary policy) -- deliberately the
-- opposite of §2's Platform-Admin-only audit log, since this data belongs
-- to, and must be visible to, the matched tenant's own Tenant-Admin
-- (Story 5.16's own job, not built here). Story 5.15 is this table's sole
-- writer; Story 5.16 is its sole (tenant-scoped) reader.

CREATE TABLE IF NOT EXISTS domain_signup_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  email         TEXT NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE domain_signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_signup_attempts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON domain_signup_attempts;
CREATE POLICY tenant_isolation ON domain_signup_attempts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- app_user gets SELECT for Story 5.16's own future Tenant-Admin-facing read
-- (not built here) -- RLS above is what actually confines it to the
-- caller's own tenant.
GRANT SELECT ON domain_signup_attempts TO app_user;

-- ADR-0037 §8b: INSERT-only via tenant_signup_role -- the same
-- minimum-required discipline as this role's other two grants
-- (migrations/0021_create_tenant_signup_role.sql). BYPASSRLS means this
-- role does not need app.tenant_id set to write a row against a tenant it
-- does not itself belong to.
GRANT INSERT ON domain_signup_attempts TO tenant_signup_role;

CREATE INDEX IF NOT EXISTS idx_domain_signup_attempts_tenant_id ON domain_signup_attempts(tenant_id);
