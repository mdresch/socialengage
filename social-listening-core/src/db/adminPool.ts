import { Pool } from 'pg';

/**
 * An admin/superuser-privileged connection pool — the DDL privilege level
 * migrate.ts's own Client already uses, but reusable rather than inline.
 * Archival (Story 3.5, ADR-0018 — DETACH PARTITION/DROP TABLE on
 * ingestion_runs/social_posts) is schema-level maintenance work, the same
 * category as a migration, not a normal app-runtime operation — it must
 * not run through the RLS-scoped app_user pool (getPool() in pool.ts),
 * which has no DDL privileges at all. See
 * .claude/skills/data-retention-and-archival/SKILL.md.
 */
let adminPool: Pool | undefined;

export function getAdminPool(): Pool {
  if (!adminPool) {
    adminPool = new Pool({
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'social_listening',
      user: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD ?? 'postgres',
    });
    adminPool.on('error', () => {});
  }
  return adminPool;
}

export async function closeAdminPool(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = undefined;
  }
}
