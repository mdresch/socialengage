-- Story 1.15 (ADR-0061 Decision §2) -- a new, nullable column so a Tier-3
-- (user-bound) poll's own IngestionRun can be scoped to the user it ran
-- for, distinct from the tenant-wide runs every existing poll connector
-- still produces (user_id stays NULL for those). References users(id) --
-- a partitioned table (ingestion_runs) referencing a non-partitioned one,
-- unaffected by the FK-into-a-partitioned-table constraint that forced
-- social_posts.acquisition_id's own FK to be dropped (migration 0018).
ALTER TABLE ingestion_runs
  ADD COLUMN user_id UUID REFERENCES users(id);
