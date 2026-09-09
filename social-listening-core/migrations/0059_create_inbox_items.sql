-- Story 11.9 (ADR-0099): Create inbox_items table for unified social inbox and triage

CREATE TABLE IF NOT EXISTS inbox_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL,
  post_id         UUID        NOT NULL,
  watchlist_id    UUID        NULL,
  provider_id     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  priority        TEXT        NOT NULL DEFAULT 'normal',
  assigned_to     UUID        NULL,
  snoozed_until   TIMESTAMPTZ NULL,
  notes           TEXT        NULL,
  tags            TEXT[]      DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inbox_items_status_check
    CHECK (status IN ('open', 'assigned', 'snoozed', 'resolved')),
  CONSTRAINT inbox_items_priority_check
    CHECK (priority IN ('urgent', 'high', 'normal', 'low'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON inbox_items TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON inbox_items TO platform_admin_role;

ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inbox_items;
CREATE POLICY tenant_isolation ON inbox_items
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_inbox_items_tenant_status
  ON inbox_items (tenant_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_items_post_tenant
  ON inbox_items (tenant_id, post_id);

CREATE INDEX IF NOT EXISTS idx_inbox_items_assigned
  ON inbox_items (tenant_id, assigned_to, status);
