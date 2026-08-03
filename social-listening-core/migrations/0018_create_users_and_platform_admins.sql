-- Story 5.9 (ADR-0032): `users` (tenant-scoped identity), `platform_admins`
-- (Platform Admin identity — deliberately NOT a users row, §3), and
-- `identity_resolver_role` — a fourth, even-narrower BYPASSRLS role than
-- platform_admin_role's own, SELECT-only, used solely to bootstrap the very
-- first identity lookup of a request before withTenant() can run (§5).

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  external_subject  TEXT UNIQUE,
  email             TEXT NOT NULL,
  display_name      TEXT,
  role              TEXT NOT NULL DEFAULT 'tenant_user' CHECK (role IN ('tenant_admin', 'tenant_user')),
  status            TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
  invited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at      TIMESTAMPTZ,
  access_ends_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- app_user needs full CRUD-minus-delete here: Tenant-Admin creates invited
-- rows, the first-sign-in link write (external_subject/status/activated_at)
-- runs through this same role once tenant_id is known (see
-- .claude/skills/identity-resolution/SKILL.md's "Load-bearing constraints"
-- for why identity_resolver_role itself never performs that write), and
-- access_ends_at is set/cleared here too. No AC in this story exercises
-- deletion, so it is not granted.
GRANT SELECT, INSERT, UPDATE ON users TO app_user;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ADR-0032 §3: Platform Admin is deliberately NOT a users row — its own
-- separate table, no tenant_id column, no tenant_isolation-shaped policy.
-- RLS is enabled and FORCEd with zero policies defined below, which fails
-- closed to every role without BYPASSRLS; app_user is still granted SELECT
-- so a query against it doesn't error, it just always returns zero rows —
-- exactly what this story's own AC asks to prove.
CREATE TABLE IF NOT EXISTS platform_admins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject  TEXT UNIQUE NOT NULL,
  email             TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
-- Deliberately no CREATE POLICY here — see comment above.

GRANT SELECT ON platform_admins TO app_user;
GRANT SELECT, INSERT ON platform_admins TO platform_admin_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'identity_resolver_role') THEN
    CREATE ROLE identity_resolver_role LOGIN PASSWORD 'identity_resolver_role_password' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO identity_resolver_role;

-- Deliberately column-scoped SELECT, and nothing else — ADR-0032 §5's own
-- "never any write grant" requirement, a real DB-enforced boundary, not an
-- application convention. Narrower than platform_admin_role's own grant on
-- purpose: a compromise of this role must not imply a compromise of that
-- one, or vice versa.
GRANT SELECT (id, tenant_id, email, role, status, access_ends_at, external_subject)
  ON users TO identity_resolver_role;
GRANT SELECT (id, external_subject) ON platform_admins TO identity_resolver_role;
