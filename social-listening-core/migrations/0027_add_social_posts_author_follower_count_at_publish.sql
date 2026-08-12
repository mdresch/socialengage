-- Story 3.9 (ADR-0049): a single, optional, point-in-time snapshot of the
-- author's follower count as reported by the connector at the moment this
-- specific post was ingested — deliberately separate from authors.follower_count
-- (ADR-0004's own most-recently-seen, upserted value). Populated once, at
-- insert time, never updated afterward. See
-- .claude/skills/social-post-lineage/SKILL.md.
--
-- Additive only: existing rows get NULL (no DEFAULT, no backfill UPDATE) --
-- ADR-0049's own "does not retroactively populate existing rows" consequence.
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS author_follower_count_at_publish INTEGER;

-- ADR-0049 Open Question 1 / Decision's own Negative consequences: NULL here
-- is genuinely three-way ambiguous, and the ADR's own instruction is that
-- this documentation requirement (not its exact form) is what's mandated.
-- Recorded as a real, queryable Postgres column comment (col_description()),
-- not just prose in this migration file that nothing at runtime can read.
COMMENT ON COLUMN social_posts.author_follower_count_at_publish IS
  'Point-in-time snapshot of the author''s follower count as reported by the connector at ingest time (ADR-0049). Immutable after insert -- never derived from or reconciled against authors.follower_count. NULL is three-way ambiguous: (a) connector-type null -- this connector never reports follower counts at all (e.g. Newswire, GNews, Wikipedia -- organization-as-Author connectors with no meaningful subscriber count); (b) platform-omitted null -- the connector generally supports this value but the platform did not return one for this specific post; (c) pre-migration null -- this row was written before this column existed and was never backfilled (migration 0027 added this column with no backfill, by design).';
