-- Story 13.1 (ADR-0109): widen ingestion_runs.trigger_type to allow
-- 'health_check', the trigger type used by the manual re-enable flow
-- (POST /v1/connectors/:platformId/enable). The health_check run is a
-- reset boundary: deriveConnectorHealth() treats it as the start of a new
-- consecutive-failure/success streak.
--
-- The parent table's CHECK constraint is inherited by every partition, so
-- dropping and re-adding it on the parent updates all partitions at once.

ALTER TABLE ingestion_runs
  DROP CONSTRAINT IF EXISTS ingestion_runs_trigger_type_check;

ALTER TABLE ingestion_runs
  ADD CONSTRAINT ingestion_runs_trigger_type_check
  CHECK (trigger_type IN ('poll', 'webhook', 'health_check'));
