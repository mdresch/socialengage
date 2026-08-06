-- Story 5.15 (ADR-0037 §1/§2): tenant_signup_role -- a fifth (after
-- app_user, platform_admin_role, the migration/bootstrap role, and
-- identity_resolver_role), even-narrower BYPASSRLS role, purpose-built for
-- exactly one job: letting an unauthenticated-until-that-instant caller
-- provision their own first tenant, without widening platform_admin_role's
-- own already-locked boundary (ADR-0030 §2).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_signup_role') THEN
    CREATE ROLE tenant_signup_role LOGIN PASSWORD 'tenant_signup_role_password' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tenant_signup_role;

-- ADR-0037 §1: INSERT-only on tenants -- no SELECT, no UPDATE. A
-- domain-match is detected purely via the existing partial unique index's
-- constraint violation (migrations/0017_create_tenants.sql), not a
-- SELECT-then-INSERT check -- avoids a TOCTOU race entirely.
GRANT INSERT ON tenants TO tenant_signup_role;

-- A SELECT addition, found necessary while actually building Story 5.15
-- (the same "implementation-time mechanics resolved directly" precedent as
-- Story 5.8's own resolution of ADR-0031 §3's domain-column details), for
-- two real, distinct reasons -- not the single narrower one first assumed:
-- (1) ADR-0037 §8b's own domain_signup_attempts table needs the MATCHED
-- existing tenant's id to record the attempt against, and a Postgres
-- unique-violation error does not itself return the conflicting row's id;
-- (2) confirmed directly against a real Postgres instance: `INSERT ...
-- RETURNING *` requires SELECT privilege on every column named in the
-- RETURNING clause, not INSERT privilege alone -- a column-scoped
-- SELECT(id)-only grant (this migration's own first draft) made every
-- successful tenants INSERT fail outright, since the application needs the
-- full row (name/status/license_seat_count/active_seat_count/domain/
-- created_at/updated_at) back to build its HTTP response. This is not an
-- enumeration risk (§3's anti-enumeration principle is about reading
-- OTHER tenants' rows, not the one row this role's own INSERT just
-- created) -- and matches the exact same unrestricted SELECT grant shape
-- platform_admin_role already has on this table (migrations/0017), so this
-- is not a new category of exposure for the tenants table.
GRANT SELECT ON tenants TO tenant_signup_role;

-- ADR-0037 §2: every tenant_signup_role write to tenants is audited
-- through the same platform_admin_audit_log table Story 5.7 already built --
-- reusing the table and logPlatformAdminAction()'s own SQL shape, executed
-- under this role's own connection (not platform_admin_role's), which is
-- exactly why this role needs its own INSERT grant here too.
GRANT INSERT ON platform_admin_audit_log TO tenant_signup_role;
