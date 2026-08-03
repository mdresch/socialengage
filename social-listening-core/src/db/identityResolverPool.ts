import { Pool } from 'pg';

/**
 * Identity resolution's own connection pool (Story 5.9, ADR-0032 §5).
 * Connects as `identity_resolver_role` — a fourth, even-narrower role than
 * `platform_admin_role`'s own (BYPASSRLS, column-scoped SELECT-only on
 * `users`/`platform_admins`, no write grant at all). Never confuse this
 * with `getPlatformAdminPool()` (broader, tenants-scoped) or `getPool()`
 * (RLS-scoped app_user). See .claude/skills/identity-resolution/SKILL.md.
 */
let identityResolverPool: Pool | undefined;

export function getIdentityResolverPool(): Pool {
  if (!identityResolverPool) {
    identityResolverPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.IDENTITY_RESOLVER_PGUSER ?? 'identity_resolver_role',
      password: process.env.IDENTITY_RESOLVER_PGPASSWORD ?? 'identity_resolver_role_password',
    });
  }
  return identityResolverPool;
}

export async function closeIdentityResolverPool(): Promise<void> {
  if (identityResolverPool) {
    await identityResolverPool.end();
    identityResolverPool = undefined;
  }
}
