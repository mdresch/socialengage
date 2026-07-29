import { PoolClient } from 'pg';
import { getPool } from './pool';

/**
 * The only sanctioned way to run a tenant-scoped query (ADR-0015). Sets the
 * RLS session context via `set_config(..., true)` (transaction-local, the
 * parameterized equivalent of SET LOCAL) inside an explicit transaction, so
 * the context can never leak onto a pooled connection a different tenant's
 * request reuses afterward. A raw `pool.query(...)` bypassing this helper
 * either fails closed (no context set — RLS returns zero rows) or, if some
 * future code path sets context without this transaction discipline, risks
 * leaking it across reused connections. See
 * .claude/skills/postgres-tenant-db/SKILL.md.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
