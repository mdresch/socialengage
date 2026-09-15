/**
 * Contract: Story 19.3 (ADR-0138, BRD-0138, FDD-0138) — RAG vector-store namespace
 * isolation and pgvector RLS (backend).
 * See docs/user-stories/epic-19-adr-0136-to-0140.md#story-193
 *
 * Intent
 * Source ADR: ADR-0138 (Accepted 2026-08-28), confirming ADR-0136/Story 19.1's already-
 * delivered pgvector RLS mapping, refining ADR-0083.
 * BRD/FDD: BRD-0138, FDD-0138 (drafted 2026-09-14 from ADR-0138's own newly-drafted
 * Decision text, replacing the 2026-08-28 stubs).
 * Scope: social-listening-core/src/rag/ragReconciliationService.ts.
 *
 * Contract to encode:
 *   AC1: reconcileOrphanedRAGChunks()'s real-DB branch calls withTenant() — a real
 *        call-site check (matching Story 19.1/19.2's own precedent), not a mock of
 *        RLS's own semantics (already proven at the schema/policy level elsewhere).
 *   AC2: a genuine orphan (a rag_chunks row whose post_id no longer exists in
 *        social_posts) is found and deleted through the real production call site —
 *        proving the fix's real effect: before the fix, no app.tenant_id session
 *        context was ever set, so this query returned zero rows unconditionally.
 *   AC3: a non-orphaned post (present in both social_posts and rag_chunks) is left
 *        untouched — the JOIN correctly identifies only true orphans, not every post.
 *   AC4: the orphan's corresponding rag_chunks_sync row is also deleted.
 *   AC5: reconciling tenant A never touches tenant B's own orphaned rows — cross-tenant
 *        isolation holds under the real withTenant() session context.
 *
 * Out of scope: any Pinecone/Azure AI Search connector or isolation mapping (still no
 *   such connector exists); wiring a scheduler/cron job to actually invoke this service
 *   periodically (a separate, unresolved gap against ADR-0083 Decision §4 item 5, not
 *   this ADR's to fix); any change to PgvectorRAGConnector, RAGChunkMetadata, or the
 *   RAGConnector interface (all already confirmed unchanged).
 */

import { randomUUID } from 'crypto';
import { RAGReconciliationService } from '../../src/rag/ragReconciliationService';
import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';
import { withTenant } from '../../src/db/withTenant';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import * as withTenantModule from '../../src/db/withTenant';

/** Real tenant fixture — rag_chunks.tenant_id / social_posts.tenant_id REFERENCES tenants(id). */
async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0].id;
}

/** Inserts a real social_posts row for tenantId, returning its id. */
async function createSocialPostFixture(tenantId: string): Promise<string> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO social_posts (tenant_id, raw_payload) VALUES ($1, '{}'::jsonb) RETURNING id`,
      [tenantId]
    );
    return rows[0].id;
  });
}

/** Inserts a rag_chunks_sync bookkeeping row directly (fixture only — not the code path under test). */
async function createSyncFixture(tenantId: string, postId: string): Promise<void> {
  await withTenant(tenantId, (client) =>
    client.query(
      `INSERT INTO rag_chunks_sync (tenant_id, post_id, chunk_count, embedding_model, status, last_indexed_at)
       VALUES ($1, $2, 1, 'text-embedding-3-small', 'synced', now())
       ON CONFLICT (tenant_id, post_id) DO NOTHING`,
      [tenantId, postId]
    )
  );
}

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

describe('Story 19.3 — RAG vector-store namespace isolation and pgvector RLS contract', () => {
  describe('AC1: reconcileOrphanedRAGChunks() real-DB branch calls withTenant()', () => {
    it('invokes withTenant() during a real reconciliation pass', async () => {
      const withTenantSpy = jest.spyOn(withTenantModule, 'withTenant');
      const connector = new PgvectorRAGConnector(1536);
      const service = new RAGReconciliationService(connector);
      const tenantId = await createTenantFixture(`T-19.3-ac1-${randomUUID()}`);

      try {
        await service.reconcileOrphanedRAGChunks(tenantId);
        expect(withTenantSpy).toHaveBeenCalled();
      } finally {
        withTenantSpy.mockRestore();
      }
    });
  });

  describe('AC2, AC3 & AC4: a genuine orphan is found and cleaned up; a live post is left alone', () => {
    it('deletes an orphaned rag_chunks/rag_chunks_sync pair, leaves a live post untouched', async () => {
      const connector = new PgvectorRAGConnector(1536);
      const service = new RAGReconciliationService(connector);
      const tenantId = await createTenantFixture(`T-19.3-ac234-${randomUUID()}`);

      // A live post: exists in social_posts AND has a matching rag_chunks row.
      const livePostId = await createSocialPostFixture(tenantId);
      await connector.upsert(tenantId, [
        {
          id: `${tenantId}:${livePostId}:0`,
          values: generateMockEmbedding('live post content', 1536),
          metadata: {
            tenant_id: tenantId,
            post_id: livePostId,
            chunk_index: 0,
            content: 'live post content',
            platform_id: 'gnews',
            published_at: '2026-09-14T00:00:00Z',
          },
        },
      ]);
      await createSyncFixture(tenantId, livePostId);

      // An orphan: a rag_chunks row for a post_id that was never (or no longer) in social_posts.
      const orphanPostId = randomUUID();
      await connector.upsert(tenantId, [
        {
          id: `${tenantId}:${orphanPostId}:0`,
          values: generateMockEmbedding('orphaned post content', 1536),
          metadata: {
            tenant_id: tenantId,
            post_id: orphanPostId,
            chunk_index: 0,
            content: 'orphaned post content',
            platform_id: 'gnews',
            published_at: '2026-09-14T00:00:00Z',
          },
        },
      ]);
      await createSyncFixture(tenantId, orphanPostId);

      const result = await service.reconcileOrphanedRAGChunks(tenantId);
      expect(result.deletedOrphansCount).toBe(1);

      const remaining = await withTenant(tenantId, async (client) => {
        const chunks = await client.query('SELECT post_id FROM rag_chunks WHERE tenant_id = $1', [tenantId]);
        const sync = await client.query('SELECT post_id FROM rag_chunks_sync WHERE tenant_id = $1', [tenantId]);
        return { chunkPostIds: chunks.rows.map((r) => r.post_id), syncPostIds: sync.rows.map((r) => r.post_id) };
      });

      // AC3: the live post's rows survive.
      expect(remaining.chunkPostIds).toContain(livePostId);
      expect(remaining.syncPostIds).toContain(livePostId);
      // AC2 & AC4: the orphan's rows (both tables) are gone.
      expect(remaining.chunkPostIds).not.toContain(orphanPostId);
      expect(remaining.syncPostIds).not.toContain(orphanPostId);
    });
  });

  describe('AC5: reconciling one tenant never touches another tenant\'s orphaned rows', () => {
    it('leaves tenant B\'s own orphan alone when reconciling tenant A', async () => {
      const connector = new PgvectorRAGConnector(1536);
      const service = new RAGReconciliationService(connector);
      const tenantA = await createTenantFixture(`T-19.3-ac5a-${randomUUID()}`);
      const tenantB = await createTenantFixture(`T-19.3-ac5b-${randomUUID()}`);

      const orphanA = randomUUID();
      const orphanB = randomUUID();
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${orphanA}:0`,
          values: generateMockEmbedding('tenant A orphan', 1536),
          metadata: {
            tenant_id: tenantA,
            post_id: orphanA,
            chunk_index: 0,
            content: 'tenant A orphan',
            platform_id: 'gnews',
            published_at: '2026-09-14T00:00:00Z',
          },
        },
      ]);
      await connector.upsert(tenantB, [
        {
          id: `${tenantB}:${orphanB}:0`,
          values: generateMockEmbedding('tenant B orphan', 1536),
          metadata: {
            tenant_id: tenantB,
            post_id: orphanB,
            chunk_index: 0,
            content: 'tenant B orphan',
            platform_id: 'gnews',
            published_at: '2026-09-14T00:00:00Z',
          },
        },
      ]);

      const result = await service.reconcileOrphanedRAGChunks(tenantA);
      expect(result.deletedOrphansCount).toBe(1);

      const tenantBRows = await withTenant(tenantB, async (client) => {
        const { rows } = await client.query('SELECT post_id FROM rag_chunks WHERE tenant_id = $1', [tenantB]);
        return rows.map((r) => r.post_id);
      });
      expect(tenantBRows).toContain(orphanB);
    });
  });
});
