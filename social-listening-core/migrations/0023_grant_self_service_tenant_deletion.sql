-- Story 3.8 (ADR-0043, superseding ADR-0039 Decision §1 in full): self-service,
-- tenant_admin-initiated tenant offboarding — export, grace period, cancel,
-- confirm. Platform Admin has ZERO access to any tenant-content table, no
-- exception carved out for deletion — matching Story 5.7's own already-accepted
-- "zero access" boundary (ADR-0030 §2) exactly.
--
-- Request/export/cancel run under app_user's own connection (low-risk,
-- reversible — only touch the two new columns below). The final,
-- irreversible hard-delete runs under a dedicated tenant_deletion_role
-- instead of a standing app_user grant, deliberately: app_user is one
-- shared Postgres role every tenant_admin AND every tenant_user session
-- uses concurrently — a standing DELETE grant on users/tenants there would
-- be constantly present across every session, gated only by RLS +
-- application-layer role checks, not a narrow, code-path-only privilege.

-- New tenant-lifecycle state, narrowly granted (ADR-0043 §2) — mirrors
-- active_seat_count's own existing per-column-GRANT precedent, does not
-- touch the locked status/license_seat_count/domain columns.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_confirmed_at TIMESTAMPTZ;
GRANT UPDATE (deletion_requested_at, deletion_confirmed_at) ON tenants TO app_user;

-- A transient status value covering the bounded window between confirmation
-- and the tenants row itself actually being removed — 'active' and
-- 'suspended' already exist (migrations/0017); this adds the third and, per
-- ADR-0039 §5 ("suspension remains distinct from deletion, unchanged"), last
-- value this column needs for this story's own scope.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'suspended', 'deleting'));

-- domain_signup_attempts.tenant_id (migrations/0022) is a real FK with no ON
-- DELETE clause (default NO ACTION) — confirmed directly this would block
-- deleting a tenants row for as long as any domain_signup_attempts row still
-- references it, contradicting ADR-0039 §3's own explicit decision that
-- these rows are "retained, not deleted" as an unenforced tombstone
-- reference. platform_admin_audit_log.target_tenant_id (migrations/0015)
-- was already built as plain text with no FK at all — dropping this
-- constraint brings domain_signup_attempts in line with that same,
-- already-established tombstone-reference pattern, not inventing a new one.
ALTER TABLE domain_signup_attempts DROP CONSTRAINT IF EXISTS domain_signup_attempts_tenant_id_fkey;

-- Audit visibility (ADR-0043 §7): app_user needs to write to the same
-- platform_admin_audit_log table Platform Admin's own actions log to, so
-- Platform Admin retains visibility ("only sees the audit trail") without
-- ever executing the write itself. Covers the request/export/cancel steps'
-- own audit entries (the final-execution entry is logged by
-- tenant_deletion_role's own separate grant, below). INSERT-only, mirroring
-- tenant_signup_role's own identical precedent (migrations/0021) exactly —
-- deliberately no SELECT: this table has no RLS, so a SELECT grant would let
-- any tenant read every other tenant's Platform-Admin-visible audit history,
-- a real cross-tenant leak this migration must not introduce.
GRANT INSERT ON platform_admin_audit_log TO app_user;

-- tenant_deletion_role: a sixth, dedicated, narrowly-scoped role, used only
-- inside executeTenantDeletion() itself — never exposed to any HTTP route
-- or ordinary app_user session. Deliberately NOT BYPASSRLS, unlike every
-- other specialized role in this project (platform_admin_role,
-- tenant_signup_role, identity_resolver_role) — a bug in the deletion code
-- (a missing WHERE clause, a wrong tenantId variable) still can't cross a
-- tenant boundary, since RLS keeps enforcing tenant_id/id scoping
-- regardless of this role's own table-level grants. Requires the same
-- set_config('app.tenant_id', ...) session-context mechanism app_user's own
-- pool already uses (withTenant(), src/db/withTenant.ts) — connecting as
-- this role alone grants no cross-tenant access by itself.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenant_deletion_role') THEN
    CREATE ROLE tenant_deletion_role LOGIN PASSWORD 'tenant_deletion_role_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tenant_deletion_role;

-- SELECT is needed alongside DELETE: Postgres requires SELECT privilege on
-- any column referenced in a DELETE's WHERE clause, not DELETE privilege
-- alone. Also needed for executeTenantDeletion()'s own read-before-delete
-- steps (resolving archived rawPayload blob paths, referenced
-- ingestion_run ids, live ingestion_run ids).
GRANT SELECT, DELETE ON users TO tenant_deletion_role;
GRANT SELECT, DELETE ON watchlists TO tenant_deletion_role;
GRANT SELECT, DELETE ON platform_credentials TO tenant_deletion_role;
GRANT SELECT, DELETE ON social_posts TO tenant_deletion_role;
GRANT SELECT, DELETE ON authors TO tenant_deletion_role;
GRANT SELECT, DELETE ON ingestion_runs TO tenant_deletion_role;
GRANT SELECT, DELETE ON tenants TO tenant_deletion_role;

-- Narrow, column-scoped (matching this table's own established pattern for
-- active_seat_count/domain elsewhere) — executeTenantDeletion() sets
-- status = 'deleting' as its own first action, the transient marker for
-- the bounded window between confirmation and the tenants row itself
-- actually being removed. Not app_user's job: status stays locked to a
-- privileged role (ADR-0030 §2/ADR-0031 §3), and ADR-0043 §2 itself
-- deliberately leaves it untouched by the request/export/cancel steps.
GRANT UPDATE (status) ON tenants TO tenant_deletion_role;

-- The final-execution audit entry ("tenant_deletion_completed") is logged
-- under this same role's own connection, in the same withTenant() call that
-- deletes the tenants row — see executeTenantDeletion()'s own comment for
-- why. Same INSERT-only, no-SELECT shape as app_user's own grant above, same
-- reasoning.
GRANT INSERT ON platform_admin_audit_log TO tenant_deletion_role;
