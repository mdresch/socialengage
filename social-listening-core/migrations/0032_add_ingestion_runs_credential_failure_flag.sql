-- Story 2.15 (ADR-0059 Decision §4) -- a new, nullable column mirroring
-- ingestion_runs.retryable's own shape (migration 0008), computed at the
-- same call sites (completeIngestionRun's 'failed' branches in
-- runIngestionAttempt.ts) using the already-existing isCredentialError()
-- classification. deriveConnectorHealth() reads this to surface a new
-- 'reconnect_required' ConnectorHealthStatus, distinct from the generic
-- failing/degraded derivation every other credential-agnostic failure
-- already produces. NULL means "no error occurred" or "not yet classified",
-- the same convention retryable already established.
ALTER TABLE ingestion_runs
  ADD COLUMN is_credential_failure BOOLEAN;
