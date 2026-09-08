-- Migration: 0080_refine_prospecting_list_sharing_and_dedup.sql
-- Story 17.1 (ADR-0129 / TDS-0129): Prospecting list sharing scope and refined RLS

-- 1. Add sharing_scope column
ALTER TABLE prospecting_lists
    ADD COLUMN IF NOT EXISTS sharing_scope TEXT NOT NULL DEFAULT 'private'
    CHECK (sharing_scope IN ('private', 'workspace_read', 'workspace_write'));

-- 2. Backfill existing shared boolean to workspace_read
UPDATE prospecting_lists
SET sharing_scope = 'workspace_read'
WHERE shared = TRUE AND sharing_scope = 'private';

-- 3. Refine RLS for prospecting_lists
DROP POLICY IF EXISTS prospecting_lists_tenant_select ON prospecting_lists;
CREATE POLICY prospecting_lists_tenant_select ON prospecting_lists
  FOR SELECT
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
      owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      OR sharing_scope IN ('workspace_read', 'workspace_write')
      OR shared = true
    )
  );

-- 4. Refine RLS for prospecting_list_entries
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
          OR pl.sharing_scope IN ('workspace_read', 'workspace_write')
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
        AND (
          pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          OR pl.sharing_scope = 'workspace_write'
        )
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
        AND (
          pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          OR pl.sharing_scope = 'workspace_write'
        )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM prospecting_lists pl
      WHERE pl.id = prospecting_list_entries.prospecting_list_id
        AND pl.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        AND (
          pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          OR pl.sharing_scope = 'workspace_write'
        )
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
        AND (
          pl.owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
          OR pl.sharing_scope = 'workspace_write'
        )
    )
  );
