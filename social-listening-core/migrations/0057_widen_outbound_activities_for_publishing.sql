-- Story 11.7 (ADR-0098): Widen outbound_activities for publishing, scheduling, asset targeting, and background dispatch

-- 1. Add published_at, assets, and error_details columns if not existing
ALTER TABLE outbound_activities
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS assets JSONB DEFAULT '[]',
  ALTER COLUMN credential_id DROP NOT NULL,
  ALTER COLUMN post_id DROP NOT NULL;

-- 2. Widen status check constraint to include scheduled, publishing, published
ALTER TABLE outbound_activities
  DROP CONSTRAINT IF EXISTS outbound_activities_status_check;

ALTER TABLE outbound_activities
  ADD CONSTRAINT outbound_activities_status_check
    CHECK (status IN ('scheduled', 'publishing', 'published', 'pending', 'sent', 'failed', 'cancelled'));

-- 3. Grant table permissions to platform_admin_role for background scheduler
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_activities TO platform_admin_role;

-- 4. Scheduler index
CREATE INDEX IF NOT EXISTS idx_outbound_activities_scheduler
  ON outbound_activities (status, scheduled_for);
