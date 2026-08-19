-- Story 6.27 (ADR-0060 Decision §3) -- a new, nullable column mirroring
-- migration 0032's own is_credential_failure precedent (additive, nullable,
-- populated only by Facebook's own per-Page poll path, NULL for every other
-- connector and every pre-existing Facebook row, zero migration risk to any
-- other connector's queries). Load-bearing for Decision §4: without a Page
-- discriminator on the audit-anchor table itself (ADR-0005), there is no
-- data to derive per-Page ConnectorHealth from at all.
ALTER TABLE ingestion_runs
  ADD COLUMN page_id TEXT;
