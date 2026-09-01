-- Story 13.8 (ADR-0114): Align platform_metrics with ADR-0114's hour/day
-- granularity and grant Platform-Admin read access for the new admin endpoints.

-- ADR-0114 uses 'hour' and 'day' granularity. Migration 0050 originally
-- constrained the table to ('1m','5m','1h','1d') for Story 10.6. Keep those
-- values for backward compatibility and add the canonical 'hour'/'day' labels.
ALTER TABLE platform_metrics
  DROP CONSTRAINT IF EXISTS platform_metrics_granularity_check;

ALTER TABLE platform_metrics
  ADD CONSTRAINT platform_metrics_granularity_check
  CHECK (granularity IN ('1m','5m','1h','1d','hour','day'));

-- Fast reads for the dashboard time-series and admin query endpoints.
CREATE INDEX IF NOT EXISTS idx_platform_metrics_name_gran_time
  ON platform_metrics (metric_name, granularity, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_source_time
  ON platform_metrics (source, timestamp DESC);

-- Upsert support for the hourly worker so repeated runs are idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_metrics_unique
  ON platform_metrics (metric_name, granularity, timestamp, source, dimensions);

-- platform_metrics is a global, non-tenant-scoped table; Platform-Admin needs
-- read access for the new operational REST surface.
GRANT SELECT ON platform_metrics TO platform_admin_role;
