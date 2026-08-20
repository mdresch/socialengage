-- Story 1.16 (ADR-0070 §1): Partial index for O(1) watchdog stale run sweeps
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_stale_watchdog ON ingestion_runs(status, started_at) WHERE status = 'running';
