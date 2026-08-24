-- Story 3.15 (ADR-0075) — extend outbound_activities for new, original post
-- dispatch (activity_type='post'). Reuses the same tenant-scoped, RLS-guarded
-- table introduced by Story 3.14 (ADR-0073).

-- New posts have no parent social post; the existing post_id column is widened to NULL.
ALTER TABLE outbound_activities
  ALTER COLUMN post_id DROP NOT NULL;

-- Target-asset fields and optional payload / scheduling columns.
ALTER TABLE outbound_activities
  ADD COLUMN IF NOT EXISTS target_asset_id  TEXT        NULL,
  ADD COLUMN IF NOT EXISTS target_asset_type TEXT       NULL,
  ADD COLUMN IF NOT EXISTS payload          JSONB       NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ NULL;

-- Widen activity_type and status to include 'post' and 'cancelled'.
ALTER TABLE outbound_activities
  DROP CONSTRAINT IF EXISTS outbound_activities_activity_type_check;
ALTER TABLE outbound_activities
  ADD CONSTRAINT outbound_activities_activity_type_check
    CHECK (activity_type IN ('reply', 'post'));

ALTER TABLE outbound_activities
  DROP CONSTRAINT IF EXISTS outbound_activities_status_check;
ALTER TABLE outbound_activities
  ADD CONSTRAINT outbound_activities_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'));

-- Index for the new list endpoint: tenant-scoped post rows, newest first,
-- with optional status/provider filters.
CREATE INDEX IF NOT EXISTS idx_outbound_activities_post_filter
  ON outbound_activities (tenant_id, activity_type, status, provider_id, created_at DESC);
