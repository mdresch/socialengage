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
CREATE TABLE post_watchlist_matches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
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
-- direction, and ON DELETE CASCADE's own lookup path when a post is removed).
CREATE INDEX IF NOT EXISTS idx_pwm_post_id ON post_watchlist_matches (post_id, tenant_id);
