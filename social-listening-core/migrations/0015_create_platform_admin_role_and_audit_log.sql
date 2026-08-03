-- Story 5.7 (ADR-0030): Platform Admin's audited, narrowly-scoped RLS bypass.
--
-- `platform_admin_role` is granted BYPASSRLS directly (the narrower Postgres
-- primitive ADR-0030 §1 chose over reusing the migration/bootstrap superuser)
-- -- but BYPASSRLS only disables RLS *policy* enforcement, it does not grant
-- any table privilege by itself. A role with BYPASSRLS and no GRANT on a
-- table still gets a real permission-denied error reading/writing it -- that
-- is exactly the mechanism this migration relies on to prove ADR-0030 §2's
-- "zero tenant-data access" boundary: `platform_admin_role` is deliberately
-- granted nothing at all on `watchlists`, `social_posts`, `platform_credentials`,
-- `authors`, `ingestion_runs`, or `author_topic_signals`.
--
-- The `tenants` table (candidate ADR #3 / Story 5.8) does not exist yet --
-- this migration does not and cannot grant platform_admin_role anything on
-- it. Story 5.8's own migration adds that grant when it creates the table;
-- see docs/user-stories/epic-5-security-isolation-and-messaging.md's Story
-- 5.7 entry and this repo's own .claude/skills/platform-admin-access/SKILL.md
-- for the full sequencing rationale.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin_role') THEN
    CREATE ROLE platform_admin_role LOGIN PASSWORD 'platform_admin_role_password' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO platform_admin_role;

-- ADR-0030 §5: every Platform-Admin-bypassed write must be recorded in a
-- durable, queryable log -- a dedicated table, since neither ADR-0030 nor
-- ADR-0031 pinned down its exact shape (both explicitly deferred it). Not
-- itself a tenant-content table and not RLS-scoped -- it is the audit record
-- of Platform Admin's own actions, readable only by the same role, on
-- purpose (the `pg_cron`/migration superuser can still access it directly if
-- ever needed for real incident response, the same as any other table).
CREATE TABLE IF NOT EXISTS platform_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_identity text NOT NULL,
  operation text NOT NULL,
  target_tenant_id text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON platform_admin_audit_log TO platform_admin_role;
