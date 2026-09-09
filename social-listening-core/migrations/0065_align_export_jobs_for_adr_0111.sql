-- Story 13.4 (ADR-0111): align export_jobs with the ADR-0111 schema while
-- retaining the Story 10.8 columns needed for the legacy GET /v1/exports/:jobId/status contract.

DO $$
BEGIN
  -- ADR-0111 names the requesting user `requested_by_user_id`.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'export_jobs' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'export_jobs' AND column_name = 'requested_by_user_id'
  ) THEN
    ALTER TABLE export_jobs RENAME COLUMN user_id TO requested_by_user_id;
  END IF;

  -- ADR-0111 names the output type `format` (`csv` or `json`).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'export_jobs' AND column_name = 'export_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'export_jobs' AND column_name = 'format'
  ) THEN
    ALTER TABLE export_jobs RENAME COLUMN export_type TO format;
  END IF;
END $$;

-- ADR-0111 requires SHA-256 and blob_path for async exports.
ALTER TABLE export_jobs
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS blob_path TEXT;

-- Align the default with ADR-0111's `format` values (`csv` or `json`).
ALTER TABLE export_jobs ALTER COLUMN format SET DEFAULT 'csv';

-- Allow both the ADR-0111 status values and the legacy Story 10.8 values.
-- The legacy GET /v1/exports/:jobId/status endpoint maps `running` -> `processing`
-- and `ready` -> `completed` to keep the Story 10.8 contract green.
ALTER TABLE export_jobs DROP CONSTRAINT IF EXISTS export_jobs_status_check;
ALTER TABLE export_jobs ADD CONSTRAINT export_jobs_status_check
  CHECK (status IN ('pending', 'running', 'ready', 'expired', 'failed', 'processing', 'completed'));
