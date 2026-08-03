-- Story 1.7 (ADR-0034): additive ownership-tier columns on platform_credentials.
-- Every existing row (Stories 1.6/2.6/2.7) becomes owner_type='tenant',
-- user_id=NULL under this migration's default -- a correct backfill, not a
-- reinterpretation (ADR-0026's GNews credentials were already tenant-wide,
-- ADR-0028 Tier 2). RLS is deliberately unchanged -- see
-- .claude/skills/connector-connect-disconnect/SKILL.md's own "Load-bearing
-- constraints" for why ownership stays an application-layer check, not a
-- second RLS predicate.

ALTER TABLE platform_credentials
  ADD COLUMN IF NOT EXISTS owner_type TEXT NOT NULL DEFAULT 'tenant' CHECK (owner_type IN ('tenant', 'user')),
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

ALTER TABLE platform_credentials
  ADD CONSTRAINT platform_credentials_owner_shape CHECK (
    (owner_type = 'tenant' AND user_id IS NULL) OR
    (owner_type = 'user' AND user_id IS NOT NULL)
  );
