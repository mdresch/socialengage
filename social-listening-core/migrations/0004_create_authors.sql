-- Story 3.1 (ADR-0004): Author normalized once per (tenant, platform, external
-- author), upserted as new posts arrive. tenant_id makes this a Story 5.4
-- (ADR-0015) table too — RLS is added in this same migration, not as an
-- afterthought (see postgres-tenant-db's SKILL.md for why that matters).
CREATE TABLE IF NOT EXISTS authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform_id TEXT NOT NULL,
  external_author_id TEXT NOT NULL,
  handle TEXT,
  display_name TEXT,
  follower_count INTEGER,
  profile_location TEXT,
  raw_profile JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform_id, external_author_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON authors TO app_user;

ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON authors;
CREATE POLICY tenant_isolation ON authors
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- SocialPost references Author via authorId, never embeds author display
-- fields (Story 3.1 AC2); postGeoLocation is per-event (SocialPost), distinct
-- from Author.profileLocation which is per-account (Story 3.1 AC3). Both new
-- columns are nullable at the schema level: Stories 1.2/5.4/5.3's pre-existing
-- minimal test inserts against social_posts don't (and shouldn't need to) set
-- them — the real "every post has an author" invariant is enforced by the
-- application-level insertSocialPost() helper's required parameter, not a DB
-- constraint. See .claude/skills/social-post-lineage/SKILL.md.
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES authors(id);
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS post_geo_location JSONB;
