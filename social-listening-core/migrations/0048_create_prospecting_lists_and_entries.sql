-- Story 10.1 (ADR-0086): Prospecting lists and prospecting list entries schema with RLS

CREATE TABLE IF NOT EXISTS prospecting_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prospecting_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecting_list_id UUID NOT NULL REFERENCES prospecting_lists(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES authors(id),
  platform_id TEXT NOT NULL,
  topic TEXT,
  engagement_score NUMERIC(5,2),
  authenticity_score NUMERIC(5,2),
  influence_score NUMERIC(5,2),
  reach_score NUMERIC(5,2),
  relationship_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (relationship_stage IN ('new', 'contacted', 'engaged', 'converted', 'passed')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  added_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prospecting_list_author UNIQUE (prospecting_list_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_prospecting_lists_tenant_owner ON prospecting_lists(tenant_id, owner_id, shared);
CREATE INDEX IF NOT EXISTS idx_prospecting_entries_list ON prospecting_list_entries(prospecting_list_id, relationship_stage);
CREATE INDEX IF NOT EXISTS idx_prospecting_entries_tenant_author ON prospecting_list_entries(tenant_id, author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON prospecting_lists TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON prospecting_list_entries TO app_user;

ALTER TABLE prospecting_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_lists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospecting_lists_tenant_select ON prospecting_lists;
CREATE POLICY prospecting_lists_tenant_select ON prospecting_lists
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR shared = true
    )
  );

DROP POLICY IF EXISTS prospecting_lists_tenant_insert ON prospecting_lists;
CREATE POLICY prospecting_lists_tenant_insert ON prospecting_lists
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS prospecting_lists_tenant_update ON prospecting_lists;
CREATE POLICY prospecting_lists_tenant_update ON prospecting_lists
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS prospecting_lists_tenant_delete ON prospecting_lists;
CREATE POLICY prospecting_lists_tenant_delete ON prospecting_lists
  FOR DELETE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

ALTER TABLE prospecting_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_list_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospecting_list_entries_select ON prospecting_list_entries;
CREATE POLICY prospecting_list_entries_select ON prospecting_list_entries
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND (
          pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          OR pl.shared = true
        )
    )
  );

DROP POLICY IF EXISTS prospecting_list_entries_insert ON prospecting_list_entries;
CREATE POLICY prospecting_list_entries_insert ON prospecting_list_entries
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS prospecting_list_entries_update ON prospecting_list_entries;
CREATE POLICY prospecting_list_entries_update ON prospecting_list_entries
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS prospecting_list_entries_delete ON prospecting_list_entries;
CREATE POLICY prospecting_list_entries_delete ON prospecting_list_entries
  FOR DELETE
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
