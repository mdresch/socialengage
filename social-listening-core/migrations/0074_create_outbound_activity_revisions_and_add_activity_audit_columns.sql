-- Story 14.2 (ADR-0119): Outbound activity revisions and audit timestamps

-- 1. Add edited_at and deleted_at audit columns to outbound_activities
ALTER TABLE outbound_activities
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Create outbound_activity_revisions table
CREATE TABLE IF NOT EXISTS outbound_activity_revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL,
  activity_id     UUID        NOT NULL,
  user_id         UUID        NOT NULL,
  revision_type   TEXT        NOT NULL CHECK (revision_type IN ('edit', 'delete')),
  body            TEXT        NULL,
  payload         JSONB       NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'cancelled')),
  error_code      TEXT        NULL,
  external_id     TEXT        NULL,
  external_url    TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Grants and RLS
GRANT SELECT, INSERT, UPDATE ON outbound_activity_revisions TO app_user;

ALTER TABLE outbound_activity_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_activity_revisions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON outbound_activity_revisions;
CREATE POLICY tenant_isolation ON outbound_activity_revisions
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 4. Indexes for revision history queries
CREATE INDEX IF NOT EXISTS idx_outbound_activity_revisions_activity_created
  ON outbound_activity_revisions (activity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_activity_revisions_tenant
  ON outbound_activity_revisions (tenant_id);
