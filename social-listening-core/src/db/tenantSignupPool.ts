import { Pool } from 'pg';

/**
 * Self-service tenant sign-up's own connection pool (Story 5.15, ADR-0037
 * §1). Connects as `tenant_signup_role` — a fifth, purpose-built BYPASSRLS
 * role (INSERT-only on `tenants`, column-scoped SELECT(id) on `tenants`,
 * INSERT-only on `platform_admin_audit_log` and `domain_signup_attempts`) —
 * never `platform_admin_role`'s pool, which this role must never be
 * confused with. See .claude/skills/self-service-tenant-signup/SKILL.md.
 */
let tenantSignupPool: Pool | undefined;

export function getTenantSignupPool(): Pool {
  if (!tenantSignupPool) {
    tenantSignupPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.TENANT_SIGNUP_PGUSER ?? 'tenant_signup_role',
      password: process.env.TENANT_SIGNUP_PGPASSWORD ?? 'tenant_signup_role_password',
    });
  }
  return tenantSignupPool;
}

export async function closeTenantSignupPool(): Promise<void> {
  if (tenantSignupPool) {
    await tenantSignupPool.end();
    tenantSignupPool = undefined;
  }
}
