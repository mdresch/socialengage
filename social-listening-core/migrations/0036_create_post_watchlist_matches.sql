-- Story 3.11 (ADR-0063 Decision §1) -- a real, queryable junction table
-- between social_posts and watchlists, persisting the (post, watchlist)
-- match pairs already computed at ingestion time for ADR-0058's event
-- publishing, so GET /v1/posts?watchlistId=<id> can filter server-side
-- instead of re-evaluating watchlist terms per request. tenant_id is
-- denormalized onto this table (not resolved via a JOIN to either parent)
-- to satisfy RLS using the same app.tenant_id session predicate
-- social_posts/watchlists already use -- same pattern as watchlists itself
-- (migrations/0014_create_watchlists.sql). See
-- .claude/skills/post-watchlist-match-persistence/SKILL.md.
--
-- post_id deliberately carries no DB-enforced FK into social_posts, unlike
-- watchlist_id below. social_posts has been partitioned by created_at since
-- migration 0012 (Story 3.5, ADR-0018), which forced its primary key to
-- become composite (id, created_at) -- a hard Postgres requirement for
-- partitioned tables (a partition's unique/PK constraints must include the
-- partition key). social_posts.id alone therefore has no unique constraint
-- to reference; REFERENCES social_posts(id) fails at migration time
-- (confirmed empirically, not assumed -- "no unique constraint matching
-- given keys"). This is the identical conflict already discovered and
-- resolved once before for social_posts.acquisition_id -> ingestion_runs(id)
-- (migration 0012's own comment, data-retention-and-archival/SKILL.md's own
-- load-bearing constraints): a real FK is also fundamentally incompatible
-- with archiveAgedRawPayloads()'s own DETACH/reattach-partition cycle,
-- since Postgres refuses to detach a partition any live FK still points
-- into. post_id is app-enforced only (insertPostWatchlistMatches()'s only
-- real caller, publishSocialPostIngestedEvents(), always passes a real,
-- just-inserted post id), the same tier acquisition_id/author_id already
-- partly rely on. See ADR-0063's own Amendment Log for the dated
-- correction and .claude/skills/post-watchlist-match-persistence/SKILL.md.
CREATE TABLE post_watchlist_matches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID        NOT NULL,
  watchlist_id UUID        NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL,
  matched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevents double-insertion on an ingestion retry without requiring an
  -- upsert -- INSERT ... ON CONFLICT DO NOTHING (insertPostWatchlistMatches())
  -- is safe and idempotent against this constraint.
  UNIQUE (post_id, watchlist_id)
);

GRANT SELECT, INSERT ON post_watchlist_matches TO app_user;

ALTER TABLE post_watchlist_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_watchlist_matches FORCE ROW LEVEL SECURITY;

-- Standard tenant_isolation policy (ADR-0015), same NULLIF-guarded form
-- watchlists' own policy uses (evaluates NULL, not an error, when
-- app.tenant_id is unset) -- both USING (reads/DELETE/UPDATE-source-row
-- checks) and WITH CHECK (INSERT/UPDATE-new-row checks) are needed; the
-- app's own insertPostWatchlistMatches() only ever INSERTs.
DROP POLICY IF EXISTS tenant_isolation ON post_watchlist_matches;
CREATE POLICY tenant_isolation ON post_watchlist_matches
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- "which posts matched this watchlist" (GET /v1/posts?watchlistId=<id>'s
-- own filter direction) -- matched_at DESC mirrors social_posts' own
-- publishedAt DESC-shaped consistency (ADR-0063 Decision §3), though the
-- actual page ordering stays social_posts.seq-based (posts-api's own
-- load-bearing "never a TIMESTAMPTZ column" pagination rule is unchanged
-- by this join).
CREATE INDEX IF NOT EXISTS idx_pwm_watchlist_id ON post_watchlist_matches (watchlist_id, tenant_id, matched_at DESC);
-- "which watchlists did this post match" (ADR-0058's own event-publishing
-- direction). No ON DELETE CASCADE relies on this index -- post_id carries
-- no DB-enforced FK (see the CREATE TABLE comment above); no code path in
-- this repo hard-deletes an individual social_posts row today.
CREATE INDEX IF NOT EXISTS idx_pwm_post_id ON post_watchlist_matches (post_id, tenant_id);
