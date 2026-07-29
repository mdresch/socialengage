// Contract: Healing — ADR-0009's named-but-missing performance index.
// See docs/adr/0009-connector-health-derived-not-stored.md
//
// Intent: Healing — close a gap surfaced by a full ADR/story consistency audit
// (2026-07-29): ADR-0009's own Negative consequences explicitly names the index
// deriveConnectorHealth() needs — "this needs an index on (tenantId, platformId,
// startedAt) (or similar) to stay cheap as run volume grows" — but no such index
// was ever added when Story 4.3 shipped.
// Scope: migrations/0008_add_ingestion_runs_retryable_and_index.sql
// Contract to encode: an index exists on ingestion_runs covering tenant_id,
// platform_id, and started_at (the exact three columns deriveConnectorHealth()'s
// WHERE/ORDER BY clause uses), confirmed via live introspection of pg_indexes —
// not just trusting the migration file was written correctly.
// Explicitly out of scope: any change to the derivation rules themselves (Story
// 4.3's contract already covers those); query-plan/EXPLAIN-based verification that
// the index is actually chosen by the planner (existence is what ADR-0009's text
// asks for; planner behavior is a deeper, environment-dependent claim this healing
// pass doesn't need to make).

import { getPool, closePool } from '../../src/db/pool';

afterAll(async () => {
  await closePool();
});

describe('Healing — ingestion_runs (tenant_id, platform_id, started_at) index contract (ADR-0009)', () => {
  it('an index exists on ingestion_runs covering tenant_id, platform_id, and started_at', async () => {
    const { rows } = await getPool().query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'ingestion_runs'`
    );
    const covering = rows.some(
      (row: { indexdef: string }) =>
        /\btenant_id\b/i.test(row.indexdef) &&
        /\bplatform_id\b/i.test(row.indexdef) &&
        /\bstarted_at\b/i.test(row.indexdef)
    );
    expect(covering).toBe(true);
  });
});
