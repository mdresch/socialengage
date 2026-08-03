import { Pool } from 'pg';

/**
 * Platform Admin's own connection pool (Story 5.7, ADR-0030 §1/§2). Connects
 * as `platform_admin_role` — a dedicated, narrowly-scoped role (BYPASSRLS,
 * granted only on platform_admin_audit_log today; the tenants table grant
 * is added by Story 5.8's own migration when that table exists) — never the
 * migration/bootstrap superuser (getAdminPool(), far broader) and never the
 * RLS-scoped app_user pool (getPool()), which this role must never be
 * confused with. See .claude/skills/platform-admin-access/SKILL.md.
 */
let platformAdminPool: Pool | undefined;

export function getPlatformAdminPool(): Pool {
  if (!platformAdminPool) {
    platformAdminPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.PLATFORM_ADMIN_PGUSER ?? 'platform_admin_role',
      password: process.env.PLATFORM_ADMIN_PGPASSWORD ?? 'platform_admin_role_password',
    });
  }
  return platformAdminPool;
}

export async function closePlatformAdminPool(): Promise<void> {
  if (platformAdminPool) {
    await platformAdminPool.end();
    platformAdminPool = undefined;
  }
}
