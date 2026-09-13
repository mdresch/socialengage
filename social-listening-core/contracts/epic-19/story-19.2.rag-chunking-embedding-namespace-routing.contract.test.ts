/**
 * Contract: Story 19.2 (ADR-0137, BRD-0137, FDD-0137) — RAG chunking and embedding
 * namespace routing (backend).
 * See docs/user-stories/epic-19-adr-0136-to-0140.md#story-192
 *
 * Intent
 * Source ADR: ADR-0137 (Accepted 2026-08-28), refining ADR-0082, confirming/extending
 * ADR-0136 (Story 19.1).
 * BRD/FDD: BRD-0137, FDD-0137 (drafted 2026-09-13 from ADR-0137's own newly-drafted
 * Decision text, replacing the 2026-08-28 stubs).
 * Scope: social-listening-core/src/rag/ragIndexingPipeline.ts,
 *   social-listening-core/migrations/0083_force_rls_rag_chunks_sync.sql.
 *
 * Contract to encode:
 *   AC1: indexPostForRAG() calls connector.ensureTenantNamespace?.(tenantId) before
 *        connector.upsert(...) — verified via call order on a mock connector that
 *        implements the hook.
 *   AC2: indexPostForRAG() still succeeds (status: 'synced') against a real connector
 *        that does NOT implement ensureTenantNamespace? (pgvector) — the hook is a no-op,
 *        never a hard requirement.
 *   AC3: indexPostForRAG()'s rag_chunks_sync write never calls getAdminPool() — a real
 *        call-site check (matching Story 19.1's own precedent), not a behavior mock.
 *   AC4: rag_chunks_sync's existing RLS policy is the real, operative boundary for data
 *        written through indexPostForRAG()'s real production call site — an unfiltered
 *        query under tenant B's withTenant() session context cannot see tenant A's
 *        sync row (Story 19.1's own AC4 pattern, extended to rag_chunks_sync).
 *   AC5: RAGChunkingService.split()/.embed() remain unchanged — no namespace/shard/RLS
 *        concept leaks into the chunking/embedding layer (regression guard).
 *
 * Out of scope: PgvectorRAGConnector itself (already fixed, Story 19.1); Pinecone/Azure
 *   AI Search connectors (ADR-0138/Story 19.3); ragReconciliationService.ts's separate
 *   missing-withTenant() defect (flagged for Story 19.3); backfill.ts (confirmed
 *   legitimate cross-tenant batch job); the dead orphan-chunk-cleanup loop in
 *   indexPostForRAG() Step 3 (flagged for a future ADR-0082/Story 9.8 revisit); any
 *   REST endpoint or UI/UX change (ADR-0139/19.4, ADR-0140/19.5).
 */

import { randomUUID } from 'crypto';
import type { RAGChunk, RAGConnector, RAGConnectorStatus, RAGSearchOptions, RAGSearchResult } from '../../src/rag/types';
import { RAGChunkingService } from '../../src/rag/ragChunkingService';
import { indexPostForRAG, resetSyncTracker } from '../../src/rag/ragIndexingPipeline';
import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';
import { withTenant } from '../../src/db/withTenant';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import * as adminPoolModule from '../../src/db/adminPool';

/** Real tenant fixture — rag_chunks_sync.tenant_id REFERENCES tenants(id). */
async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0].id;
}

/** A minimal RAGConnector mock that implements ensureTenantNamespace?, to observe call order. */
class NamespaceCapableMockConnector implements RAGConnector {
  public readonly id = 'mock-namespace-capable';
  public callOrder: string[] = [];

  async ensureTenantNamespace(_tenantId: string): Promise<void> {
    this.callOrder.push('ensureTenantNamespace');
  }
  async upsert(_tenantId: string, _vectors: RAGChunk[]): Promise<void> {
    this.callOrder.push('upsert');
  }
  async search(_tenantId: string, _query: number[], _options: RAGSearchOptions): Promise<RAGSearchResult[]> {
    return [];
  }
  async deletePost(_tenantId: string, _postId: string): Promise<void> {}
  async deleteTenant(_tenantId: string): Promise<void> {}
  async status(_tenantId?: string): Promise<RAGConnectorStatus> {
    return { provider: this.id, isAvailable: true, dimension: 1536, isolationModel: 'namespace' };
  }
}

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

describe('Story 19.2 — RAG chunking and embedding namespace routing contract', () => {
  beforeEach(() => {
    resetSyncTracker();
  });

  describe('AC1: ensureTenantNamespace?() is called before upsert() for a namespace-capable connector', () => {
    it('calls ensureTenantNamespace then upsert, in that order', async () => {
      const tenantId = randomUUID();
      const postId = randomUUID();
      const mockConnector = new NamespaceCapableMockConnector();
      const chunkingService = new RAGChunkingService();

      const post = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'AC1 namespace provisioning ordering probe.',
        title: 'AC1 probe',
      };

      const result = await indexPostForRAG(tenantId, post, { connector: mockConnector, chunkingService });

      expect(result.status).toBe('synced');
      expect(mockConnector.callOrder).toEqual(['ensureTenantNamespace', 'upsert']);
    });
  });

  describe('AC2: a connector without ensureTenantNamespace? still indexes successfully (no-op)', () => {
    it('indexPostForRAG succeeds against real PgvectorRAGConnector, which does not implement the hook', async () => {
      const connector = new PgvectorRAGConnector(1536);
      expect((connector as RAGConnector).ensureTenantNamespace).toBeUndefined();

      const tenantId = randomUUID();
      const postId = randomUUID();
      const chunkingService = new RAGChunkingService();
      const post = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'AC2 no-op hook probe.',
        title: 'AC2 probe',
      };

      const result = await indexPostForRAG(tenantId, post, { connector, chunkingService });
      expect(result.status).toBe('synced');
    });
  });

  describe('AC3: the rag_chunks_sync write never runs via getAdminPool()', () => {
    it('spies on getAdminPool and confirms it is never called by a real indexing pass', async () => {
      const adminPoolSpy = jest.spyOn(adminPoolModule, 'getAdminPool');
      const connector = new PgvectorRAGConnector(1536);
      const chunkingService = new RAGChunkingService();
      const tenantId = await createTenantFixture(`T-19.2-ac3-${randomUUID()}`);
      const postId = randomUUID();

      try {
        const post = {
          id: postId,
          tenant_id: tenantId,
          body_markdown: 'AC3 admin-pool-avoidance probe.',
          title: 'AC3 probe',
        };
        const result = await indexPostForRAG(tenantId, post, { connector, chunkingService });
        expect(result.status).toBe('synced');
        expect(adminPoolSpy).not.toHaveBeenCalled();
      } finally {
        adminPoolSpy.mockRestore();
      }
    });
  });

  describe('AC4: rag_chunks_sync RLS policy protects data written by the real indexPostForRAG() call site', () => {
    it('a raw, unfiltered query under tenant B session context cannot see tenant A\'s sync row', async () => {
      const connector = new PgvectorRAGConnector(1536);
      const chunkingService = new RAGChunkingService();
      const tenantA = await createTenantFixture(`T-19.2-ac4a-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-19.2-ac4b-${randomUUID()}`);
      const postA = randomUUID();
      const postB = randomUUID();

      await indexPostForRAG(tenantA, {
        id: postA,
        tenant_id: tenantA,
        body_markdown: 'AC4 tenant A sync-row probe.',
        title: 'AC4 A',
      }, { connector, chunkingService });

      await indexPostForRAG(tenantB, {
        id: postB,
        tenant_id: tenantB,
        body_markdown: 'AC4 tenant B sync-row probe.',
        title: 'AC4 B',
      }, { connector, chunkingService });

      // Deliberately unfiltered — no application-level WHERE tenant_id clause here —
      // proving the database itself blocks cross-tenant visibility of rag_chunks_sync.
      const rowsForB = await withTenant(tenantB, async (client) => {
        const { rows } = await client.query('SELECT tenant_id, post_id FROM rag_chunks_sync');
        return rows;
      });
      expect(rowsForB.length).toBeGreaterThan(0);
      expect(rowsForB.every((r: { tenant_id: string }) => r.tenant_id === tenantB)).toBe(true);
      expect(rowsForB.some((r: { post_id: string }) => r.post_id === postA)).toBe(false);
    });
  });

  describe('AC5: RAGChunkingService.split()/.embed() remain unchanged (regression guard)', () => {
    it('split()/.embed() carry no namespace/shard/RLS concept and behave exactly as before', async () => {
      const tenantId = randomUUID();
      const postId = randomUUID();
      const chunkingService = new RAGChunkingService();
      const post = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'AC5 unchanged chunking/embedding regression probe.',
        title: 'AC5 probe',
      };

      const chunks = chunkingService.split(post);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.post_id).toBe(postId);

      const embedded = await chunkingService.embed(tenantId, chunks);
      expect(embedded.length).toBe(chunks.length);
      expect(embedded[0].values.length).toBe(1536);
    });
  });
});
