-- Story 13.8 (ADR-0114): ensure the unique index used by recordPlatformMetric's
-- ON CONFLICT upsert exists, even if an earlier version of migration 0068 ran
-- without it.

DROP INDEX IF EXISTS idx_platform_metrics_unique;

CREATE UNIQUE INDEX idx_platform_metrics_unique
  ON platform_metrics (metric_name, granularity, timestamp, source, dimensions);
