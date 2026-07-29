// Contract: Story 5.4 (ADR-0015) — tenant isolation via Postgres Row-Level Security.
// See docs/user-stories/epic-5-security-isolation-and-messaging.md#story-54--tenant-isolation-via-postgres-row-level-security
//
// Intent: Story 5.4 — Tenant isolation via Postgres Row-Level Security (ADR-0015)
// Scope: migrations/0002_enable_rls_social_posts.sql, src/db/pool.ts (APP_PG* role),
// src/db/withTenant.ts
// Contract to encode: (1) every tenant_id-bearing table has row security enabled and
// at least one policy, checked live against Postgres system catalogs — not just the
// one table this pass happens to add; (2) a query with no tenant session context set
// returns zero rows (fails closed), not another tenant's data; (3) a deliberately
// unfiltered query (no WHERE tenant_id) against two tenants' data returns only the
// session's own tenant's rows.
// Explicitly out of scope: any table beyond social_posts (none exist yet — this story
// only needs the one table Story 1.2 introduced); a full role-separation/least-privilege
// scheme beyond app_user vs. the migration-admin role, which is the minimum needed to
// make RLS testable at all (superusers and table owners bypass RLS unconditionally in
// Postgres, so *some* non-owner, non-superuser role is a hard requirement here, not a
// design choice up for debate).

import { randomUUID } from 'crypto';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';

afterAll(async () => {
  await closePool();
});

describe('Story 5.4 — Postgres RLS tenant-isolation contract', () => {
  it('AC1: every tenant_id-bearing table has row security enabled and at least one policy', async () => {
    const pool = getPool();
    const { rows: tenantTables } = await pool.query(`
      SELECT c.relname
      FROM information_schema.columns col
      JOIN pg_class c ON c.relname = col.table_name AND c.relkind = 'r'
      WHERE col.column_name = 'tenant_id' AND col.table_schema = 'public'
    `);
    expect(tenantTables.length).toBeGreaterThan(0);

    for (const { relname } of tenantTables) {
      const { rows: rlsRows } = await pool.query(
        'SELECT relrowsecurity FROM pg_class WHERE relname = $1',
        [relname]
      );
      expect(rlsRows[0].relrowsecurity).toBe(true);

      const { rows: policyRows } = await pool.query(
        'SELECT policyname FROM pg_policies WHERE tablename = $1',
        [relname]
      );
      expect(policyRows.length).toBeGreaterThan(0);
    }
  });

  it('AC2: a query with no tenant session context set returns zero rows, not another tenant\'s data', async () => {
    const tenantId = randomUUID();
    await withTenant(tenantId, async (client) => {
      await client.query(
        "INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, '{}'::jsonb)",
        [tenantId]
      );
    });

    const pool = getPool();
    const client = await pool.connect();
    try {
      // Deliberately no SET LOCAL app.tenant_id — simulates a code path that
      // forgot to set tenant context.
      const { rows } = await client.query('SELECT * FROM social_posts');
      expect(rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it('AC3: an unfiltered query against two tenants\' data returns only the session\'s own tenant\'s rows', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    await withTenant(tenantA, async (client) => {
      await client.query(
        'INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, \'{"t":"a"}\'::jsonb)',
        [tenantA]
      );
    });
    await withTenant(tenantB, async (client) => {
      await client.query(
        'INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, \'{"t":"b"}\'::jsonb)',
        [tenantB]
      );
    });

    await withTenant(tenantA, async (client) => {
      // Deliberately unfiltered: no WHERE tenant_id clause.
      const { rows } = await client.query('SELECT * FROM social_posts');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r: { tenant_id: string }) => r.tenant_id === tenantA)).toBe(true);
    });
  });
});
