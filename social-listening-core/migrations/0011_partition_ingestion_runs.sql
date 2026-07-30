-- Story 3.5 (ADR-0018): partition ingestion_runs monthly by started_at, so
-- archival (Story 3.5's own code) can detach/export/drop the oldest
-- partition rather than a row-by-row delete sweep. A composite primary key
-- (id, started_at) is a Postgres requirement for partitioned tables (every
-- unique/PK constraint must include the partition key) -- not a design
-- choice on its own.
--
-- Rebuilt via backup-table-then-recreate, not RENAME-in-place: renaming a
-- table does not rename its indexes/constraints, so the old table's
-- default-named ingestion_runs_pkey and idx_ingestion_runs_tenant_platform_started
-- would still occupy those names and collide with the new table's identically
-- (and deliberately) named ones. Dropping the old table first frees them
-- cleanly. See .claude/skills/data-retention-and-archival/SKILL.md.
CREATE TABLE ingestion_runs_data_backup AS SELECT * FROM ingestion_runs;

-- social_posts.acquisition_id's FK into ingestion_runs(id) can't survive
-- ingestion_runs becoming partitioned (id alone is no longer a valid unique
-- constraint target) -- dropped here, replaced by a composite FK in
-- migration 0012 once social_posts gains acquisition_started_at.
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_acquisition_id_fkey;

DROP TABLE ingestion_runs;

CREATE TABLE ingestion_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('poll', 'webhook')),
  connector_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  posts_ingested INTEGER NOT NULL DEFAULT 0,
  posts_skipped INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  retryable BOOLEAN,
  PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);

-- Catches anything outside the generated window below so inserts never fail
-- for lack of a matching partition.
CREATE TABLE ingestion_runs_default PARTITION OF ingestion_runs DEFAULT;

-- A generous rolling window computed relative to CURRENT_DATE at migration
-- time, not hardcoded dates -- correct whenever this migration actually
-- runs. ensure_ingestion_runs_partition() below creates additional specific
-- months on demand; nothing schedules it periodically (see this story's
-- SKILL.md Known gaps -- partition-maintenance automation is out of scope).
DO $$
DECLARE
  month_start date;
  month_end date;
  partition_name text;
BEGIN
  FOR i IN -24..3 LOOP
    month_start := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
    month_end := month_start + interval '1 month';
    partition_name := 'ingestion_runs_y' || to_char(month_start, 'YYYY') || 'm' || to_char(month_start, 'MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF ingestion_runs FOR VALUES FROM (%L) TO (%L)',
      partition_name, month_start, month_end
    );
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ingestion_runs TO app_user;

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ingestion_runs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- RLS policies and indexes defined on a partitioned parent apply uniformly
-- to every partition automatically (PG 11+) -- not repeated per partition.
CREATE INDEX idx_ingestion_runs_tenant_platform_started ON ingestion_runs (tenant_id, platform_id, started_at);

INSERT INTO ingestion_runs (id, tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary, retryable)
SELECT id, tenant_id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary, retryable
FROM ingestion_runs_data_backup;

DROP TABLE ingestion_runs_data_backup;

-- Idempotent helper for creating a specific month's partition on demand.
CREATE OR REPLACE FUNCTION ensure_ingestion_runs_partition(target_month date) RETURNS void AS $$
DECLARE
  month_start date := date_trunc('month', target_month);
  month_end date := month_start + interval '1 month';
  partition_name text := 'ingestion_runs_y' || to_char(month_start, 'YYYY') || 'm' || to_char(month_start, 'MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF ingestion_runs FOR VALUES FROM (%L) TO (%L)',
    partition_name, month_start, month_end
  );
END;
$$ LANGUAGE plpgsql;
