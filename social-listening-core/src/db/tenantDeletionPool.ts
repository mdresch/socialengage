import { Pool } from 'pg';

/**
 * Story 3.8 (ADR-0043) — the final, irreversible hard-delete step's own
 * connection pool. Connects as `tenant_deletion_role`: a dedicated,
 * narrowly-scoped role (DELETE/SELECT on every tenant-content table, DELETE
 * on tenants, INSERT on platform_admin_audit_log) used only inside
 * executeTenantDeletion() itself — never exposed to any HTTP route or
 * app_user session. Deliberately NOT BYPASSRLS, unlike every other
 * specialized role in this project (platform_admin_role, tenant_signup_role,
 * identity_resolver_role) — a bug in the deletion code still can't cross a
 * tenant boundary, since RLS keeps enforcing tenant_id scoping regardless.
 * Always used through withTenant(tenantId, fn, getTenantDeletionPool()), the
 * same session-context mechanism app_user's own pool uses. See
 * .claude/skills/self-service-tenant-deletion/SKILL.md.
 */
let tenantDeletionPool: Pool | undefined;

export function getTenantDeletionPool(): Pool {
  if (!tenantDeletionPool) {
    tenantDeletionPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.TENANT_DELETION_PGUSER ?? 'tenant_deletion_role',
      password: process.env.TENANT_DELETION_PGPASSWORD ?? 'tenant_deletion_role_password',
    });
    tenantDeletionPool.on('error', () => {});
  }
  return tenantDeletionPool;
}

export async function closeTenantDeletionPool(): Promise<void> {
  if (tenantDeletionPool) {
    await tenantDeletionPool.end();
    tenantDeletionPool = undefined;
  }
}
