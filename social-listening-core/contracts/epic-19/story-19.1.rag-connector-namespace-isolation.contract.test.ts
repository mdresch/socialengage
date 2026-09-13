/**
 * Contract: Story 19.1 (ADR-0136, BRD-0136, FDD-0136) — RAGConnector provider
 * abstraction with namespace-per-tenant isolation (backend).
 * See docs/user-stories/epic-19-adr-0136-to-0140.md#story-191
 *
 * Intent
 * Source ADR: ADR-0136 (Accepted 2026-08-28), superseding ADR-0081 Decision §11.
 * BRD/FDD: BRD-0136, FDD-0136 (drafted 2026-09-13 from ADR-0136's own Decision text,
 * replacing the 2026-08-28 one-line stubs — see those documents' own Revision History).
 * Scope: social-listening-core/src/rag/types.ts (interface addition),
 *   social-listening-core/src/rag/pgvectorConnector.ts (RLS-enforced query path),
 *   social-listening-core/migrations/0082_force_rls_rag_chunks.sql.
 *
 * Contract to encode:
 *   AC1: RAGConnector gains an optional ensureTenantNamespace?() hook; PgvectorRAGConnector
 *        does not implement it (its isolation is a static, already-provisioned table-level
 *        RLS policy, not a resource needing per-tenant provisioning before first write).
 *   AC2: PgvectorRAGConnector.status() reports isolationModel: 'row-level-rls'.
 *   AC3: PgvectorRAGConnector's own tenant-scoped queries (upsert/search/deletePost/
 *        deleteTenant/status(tenantId)) no longer run through getAdminPool() (a Postgres
 *        superuser connection that bypasses RLS unconditionally) — verified by observing
 *        the real call site, not by re-deriving RLS's own semantics (already proven at the
 *        schema/policy level by Story 5.4's contract, which covers every tenant_id-bearing
 *        table including rag_chunks).
 *   AC4: rag_chunks' existing tenant_isolation policy (migrations 0046/0047) is the real,
 *        operative boundary for data written through the connector's own real upsert() call
 *        — proven the same way Story 5.4 proves it for social_posts (an unfiltered raw query
 *        under a tenant session context returns only that tenant's own rows).
 *   AC5: the existing application-level tenant_id filter in upsert/search/deletePost remains
 *        in place and functioning (regression, not weakened) — BRD-0136 BR-004.
 *   AC6: deleteTenant() mechanics (`DELETE ... WHERE tenant_id = $1`) and the deterministic
 *        vector ID scheme (`${tenantId}:${postId}:${chunkIndex}`) are unchanged — BR-005/BR-006.
 *   AC7: ragConnectorRegistry.ts registers only 'pgvector' at the end of this story — BR-007,
 *        a scope guard against Story 19.3 (Pinecone/Azure AI Search) creep.
 *
 * Out of scope: Pinecone/Azure AI Search connectors and their isolation mapping
 *   (ADR-0138/Story 19.3), chunking/embedding namespace routing (ADR-0137/Story 19.2),
 *   search/ask endpoint changes (ADR-0139/Story 19.4).
 */

import { randomUUID } from 'crypto';
import type { RAGConnector } from '../../src/rag/types';
import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';
import { getRagConnector, resetRagConnectorRegistry } from '../../src/rag/ragConnectorRegistry';
import { getPool, closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import * as adminPoolModule from '../../src/db/adminPool';
import * as poolModule from '../../src/db/pool';

/** Real tenant fixture — rag_chunks.tenant_id REFERENCES tenants(id), so a real row is required. */
async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0].id;
}

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

describe('Story 19.1 — RAGConnector namespace-per-tenant isolation contract', () => {
  describe('AC1: ensureTenantNamespace? is optional and unimplemented by pgvector', () => {
    it('PgvectorRAGConnector does not implement ensureTenantNamespace (static, already-provisioned RLS scope)', () => {
      const connector: RAGConnector = new PgvectorRAGConnector(1536);
      expect(connector.ensureTenantNamespace).toBeUndefined();
    });
  });

  describe('AC2: status() reports the real, currently-in-effect isolation mechanism', () => {
    it("reports isolationModel: 'row-level-rls' for pgvector", async () => {
      const connector = new PgvectorRAGConnector(1536);
      const tenantId = randomUUID();
      const status = await connector.status(tenantId);
      expect(status.isolationModel).toBe('row-level-rls');
    });
  });

  describe('AC3: the connector\'s own tenant-scoped queries no longer run as a superuser that bypasses RLS', () => {
    it('upsert()/search()/deletePost()/deleteTenant()/status(tenantId) never call getAdminPool()', async () => {
      const adminPoolSpy = jest.spyOn(adminPoolModule, 'getAdminPool');
      const poolSpy = jest.spyOn(poolModule, 'getPool');
      const connector = new PgvectorRAGConnector(1536);
      const tenantId = await createTenantFixture(`T-19.1-ac3-${randomUUID()}`);
      const postId = randomUUID();
      const content = 'AC3 real-call-site probe content, unique per test run.';

      try {
        await connector.upsert(tenantId, [
          {
            id: `${tenantId}:${postId}:0`,
            values: generateMockEmbedding(content, 1536),
            metadata: {
              tenant_id: tenantId,
              post_id: postId,
              chunk_index: 0,
              content,
              platform_id: 'gnews',
              published_at: '2026-09-13T00:00:00Z',
            },
          },
        ]);
        await connector.search(tenantId, generateMockEmbedding(content, 1536), { topK: 5 });
        await connector.deletePost(tenantId, postId);
        await connector.deleteTenant(tenantId);
        await connector.status(tenantId);

        expect(adminPoolSpy).not.toHaveBeenCalled();
        expect(poolSpy).toHaveBeenCalled();
      } finally {
        adminPoolSpy.mockRestore();
        poolSpy.mockRestore();
      }
    });
  });

  describe('AC4 & AC5: rag_chunks RLS policy actually protects data the connector itself writes, alongside the unchanged application-level filter', () => {
    it('a fresh connector instance reading via a raw, unfiltered query under a tenant session context sees only that tenant\'s own rows written by the real upsert() call', async () => {
      const writer = new PgvectorRAGConnector(1536);
      const tenantA = await createTenantFixture(`T-19.1-ac4a-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-19.1-ac4b-${randomUUID()}`);
      const postA = randomUUID();
      const postB = randomUUID();

      await writer.upsert(tenantA, [
        {
          id: `${tenantA}:${postA}:0`,
          values: generateMockEmbedding('Tenant A confidential content', 1536),
          metadata: {
            tenant_id: tenantA,
            post_id: postA,
            chunk_index: 0,
            content: 'Tenant A confidential content',
            platform_id: 'gnews',
            published_at: '2026-09-13T00:00:00Z',
          },
        },
      ]);
      await writer.upsert(tenantB, [
        {
          id: `${tenantB}:${postB}:0`,
          values: generateMockEmbedding('Tenant B confidential content', 1536),
          metadata: {
            tenant_id: tenantB,
            post_id: postB,
            chunk_index: 0,
            content: 'Tenant B confidential content',
            platform_id: 'gnews',
            published_at: '2026-09-13T00:00:00Z',
          },
        },
      ]);

      // Deliberately unfiltered — no application-level WHERE tenant_id clause in this
      // test's own SQL — proving the database itself, not the connector's own filter,
      // is what blocks cross-tenant visibility (Story 5.4's AC3 pattern, extended to
      // rag_chunks specifically, closing BRD-0136 BR-008's gap in Story 9.9's test).
      const rowsForA = await withTenant(tenantA, async (client) => {
        const { rows } = await client.query('SELECT tenant_id, post_id FROM rag_chunks');
        return rows;
      });
      expect(rowsForA.length).toBeGreaterThan(0);
      expect(rowsForA.every((r: { tenant_id: string }) => r.tenant_id === tenantA)).toBe(true);
      expect(rowsForA.some((r: { post_id: string }) => r.post_id === postB)).toBe(false);

      // AC5 regression: the connector's own application-level filter is unchanged —
      // a second connector instance (fresh in-memory cache) still isolates via search().
      const reader = new PgvectorRAGConnector(1536);
      const results = await reader.search(tenantA, generateMockEmbedding('Tenant B confidential content', 1536), {
        topK: 10,
      });
      expect(results.every((r) => r.metadata.tenant_id === tenantA)).toBe(true);

      // A raw query with no tenant context set at all must fail closed (zero rows),
      // not leak either tenant's data.
      const pool = getPool();
      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          'SELECT tenant_id FROM rag_chunks WHERE post_id IN ($1, $2)',
          [postA, postB]
        );
        expect(rows).toHaveLength(0);
      } finally {
        client.release();
      }
    });
  });

  describe('AC6: deleteTenant() mechanics and the deterministic vector ID scheme are unchanged', () => {
    it('deleteTenant() removes all of a tenant\'s rows and the id scheme remains ${tenantId}:${postId}:${chunkIndex}', async () => {
      const connector = new PgvectorRAGConnector(1536);
      const tenantId = await createTenantFixture(`T-19.1-ac6-${randomUUID()}`);
      const postId = randomUUID();
      const content = 'AC6 deterministic id + deleteTenant probe';

      await connector.upsert(tenantId, [
        {
          id: '', // deliberately omitted so the connector must derive it
          values: generateMockEmbedding(content, 1536),
          metadata: {
            tenant_id: tenantId,
            post_id: postId,
            chunk_index: 0,
            content,
            platform_id: 'gnews',
            published_at: '2026-09-13T00:00:00Z',
          },
        },
      ]);

      const derivedId = `${tenantId}:${postId}:0`;
      const rowsBefore = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query('SELECT id FROM rag_chunks WHERE id = $1', [derivedId]);
        return rows;
      });
      expect(rowsBefore).toHaveLength(1);

      await connector.deleteTenant(tenantId);

      const rowsAfter = await withTenant(tenantId, async (client) => {
        const { rows } = await client.query('SELECT id FROM rag_chunks WHERE tenant_id = $1', [tenantId]);
        return rows;
      });
      expect(rowsAfter).toHaveLength(0);
    });
  });

  describe('AC7: only pgvector is registered — scope guard against Story 19.3 creep', () => {
    it('ragConnectorRegistry has no Pinecone/Azure AI Search provider registered', () => {
      resetRagConnectorRegistry();
      expect(() => getRagConnector('pinecone')).toThrow();
      expect(() => getRagConnector('azure-ai-search')).toThrow();
      expect(getRagConnector('pgvector')).toBeInstanceOf(PgvectorRAGConnector);
    });
  });
});
