import { Pool } from 'pg';

/**
 * The app's runtime connection pool. Connects as `app_user` (a non-superuser,
 * non-owner role — see migrations/0002_enable_rls_social_posts.sql), which is
 * what actually makes Row-Level Security take effect. Never widen this to the
 * migration/admin role: Postgres never applies RLS to superusers, and only
 * applies it to the table owner when a table is explicitly FORCEd — connecting
 * as the wrong role silently defeats tenant isolation with no visible symptom.
 * See .claude/skills/postgres-tenant-db/SKILL.md.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.APP_PGUSER ?? 'app_user',
      password: process.env.APP_PGPASSWORD ?? 'app_user_password',
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
