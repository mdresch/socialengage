-- Story 5.4 (ADR-0015): tenant isolation via Row-Level Security on social_posts.
--
-- RLS is meaningless without a non-superuser, non-owner role to enforce it against:
-- Postgres never applies RLS to superusers (no override exists), and only applies
-- it to the table owner when the table is explicitly FORCEd. Migrations run as the
-- admin/superuser role (table owner); the app's own runtime connects as app_user
-- instead, which is where RLS actually takes effect. See
-- .claude/skills/postgres-tenant-db/SKILL.md's "Load-bearing constraints".
--
-- app_user's password is a well-known, non-secret value: this role only ever
-- exists inside an ephemeral, localhost-only dev/test Postgres container torn
-- down after each run. Nothing about it protects real data — production
-- (Azure Database for PostgreSQL) credential handling is ordinary infra config,
-- not in scope for this migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON social_posts TO app_user;

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts FORCE ROW LEVEL SECURITY;

-- NULLIF(..., '') matters: on a pooled connection, once a custom GUC like
-- app.tenant_id has been SET at all (even transaction-locally via SET LOCAL /
-- set_config(..., true)), it resets to an empty string on later reuse rather
-- than staying NULL — Postgres has no registered default for custom GUCs to
-- revert to. Casting '' straight to ::uuid throws a hard error instead of
-- safely filtering out all rows, so it's normalized to NULL first; NULL = x
-- is NULL (falsy) either way, giving the same fail-closed, zero-rows result
-- whether tenant_id was truly never set or reset to '' from a prior session.
DROP POLICY IF EXISTS tenant_isolation ON social_posts;
CREATE POLICY tenant_isolation ON social_posts
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
