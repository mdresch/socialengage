/**
 * Contract: Story 9.7 (ADR-0081, BRD-0081, FDD-0081) — RAGConnector provider abstraction.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-97
 */

import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';
import { getRagConnector, registerRagConnector, resetRagConnectorRegistry } from '../../src/rag/ragConnectorRegistry';
import type { RAGChunk, RAGConnector } from '../../src/rag/types';

describe('Story 9.7 — RAGConnector Provider Abstraction Contract', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const postId1 = '33333333-3333-3333-3333-333333333333';
  const postId2 = '44444444-4444-4444-4444-444444444444';

  let connector: PgvectorRAGConnector;

  beforeEach(() => {
    connector = new PgvectorRAGConnector(4); // 4-dimension vectors for test simplicity
  });

  describe('AC1 & AC2: RAGConnector interface and metadata payload', () => {
    it('implements upsert, search, deletePost, deleteTenant, and status', async () => {
      expect(typeof connector.upsert).toBe('function');
      expect(typeof connector.search).toBe('function');
      expect(typeof connector.deletePost).toBe('function');
      expect(typeof connector.deleteTenant).toBe('function');
      expect(typeof connector.status).toBe('function');
    });

    it('upserts chunks carrying full metadata (content, platform_id, published_at, watchlist_ids, sentiment, topics)', async () => {
      const chunks: RAGChunk[] = [
        {
          id: `${tenantA}:${postId1}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: 'Acme announces groundbreaking product release.',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
            watchlist_ids: ['wid-1'],
            sentiment: 'positive',
            topics: ['product-launch'],
          },
        },
      ];

      await connector.upsert(tenantA, chunks);
      const status = await connector.status(tenantA);
      expect(status.indexedChunksCount).toBe(1);
    });
  });

  describe('AC3 & AC8: Mandatory tenant pre-filtering on search', () => {
    it('never returns chunks from another tenant even with identical query vectors', async () => {
      // Upsert identical vector for Tenant A and Tenant B
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: 'Tenant A confidential statement',
            platform_id: 'newswire',
            published_at: '2026-08-25T12:00:00Z',
          },
        },
      ]);

      await connector.upsert(tenantB, [
        {
          id: `${tenantB}:${postId2}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantB,
            post_id: postId2,
            chunk_index: 0,
            content: 'Tenant B confidential statement',
            platform_id: 'newswire',
            published_at: '2026-08-25T12:00:00Z',
          },
        },
      ]);

      // Search scoped to Tenant A
      const resultsA = await connector.search(tenantA, [1, 0, 0, 0], { topK: 10 });
      expect(resultsA.length).toBe(1);
      expect(resultsA[0].metadata.tenant_id).toBe(tenantA);
      expect(resultsA[0].metadata.content).toBe('Tenant A confidential statement');

      // Search scoped to Tenant B
      const resultsB = await connector.search(tenantB, [1, 0, 0, 0], { topK: 10 });
      expect(resultsB.length).toBe(1);
      expect(resultsB[0].metadata.tenant_id).toBe(tenantB);
      expect(resultsB[0].metadata.content).toBe('Tenant B confidential statement');
    });
  });

  describe('AC4: RAGFilter handling (platformId, sentiment, watchlistIds, topics, dateRange)', () => {
    beforeEach(async () => {
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: 'Positive GNews article',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
            watchlist_ids: ['wid-brand'],
            sentiment: 'positive',
            topics: ['growth'],
          },
        },
        {
          id: `${tenantA}:${postId2}:0`,
          values: [0.9, 0.1, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId2,
            chunk_index: 0,
            content: 'Negative Newswire report',
            platform_id: 'newswire',
            published_at: '2026-08-20T10:00:00Z',
            watchlist_ids: ['wid-crisis'],
            sentiment: 'negative',
            topics: ['incident'],
          },
        },
      ]);
    });

    it('filters by platformId', async () => {
      const results = await connector.search(tenantA, [1, 0, 0, 0], {
        topK: 10,
        filter: { platformId: 'gnews' },
      });
      expect(results.length).toBe(1);
      expect(results[0].metadata.platform_id).toBe('gnews');
    });

    it('filters by sentiment', async () => {
      const results = await connector.search(tenantA, [1, 0, 0, 0], {
        topK: 10,
        filter: { sentiment: 'negative' },
      });
      expect(results.length).toBe(1);
      expect(results[0].metadata.sentiment).toBe('negative');
    });

    it('filters by watchlistIds', async () => {
      const results = await connector.search(tenantA, [1, 0, 0, 0], {
        topK: 10,
        filter: { watchlistIds: ['wid-brand'] },
      });
      expect(results.length).toBe(1);
      expect(results[0].metadata.watchlist_ids).toContain('wid-brand');
    });

    it('filters by dateRange', async () => {
      const results = await connector.search(tenantA, [1, 0, 0, 0], {
        topK: 10,
        filter: { dateRange: { from: '2026-08-24T00:00:00Z' } },
      });
      expect(results.length).toBe(1);
      expect(results[0].metadata.post_id).toBe(postId1);
    });
  });

  describe('AC5: Deletion by post and by tenant', () => {
    it('deletePost deletes all chunks of a specific post', async () => {
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: 'Post 1 Chunk 0',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
          },
        },
        {
          id: `${tenantA}:${postId1}:1`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 1,
            content: 'Post 1 Chunk 1',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
          },
        },
        {
          id: `${tenantA}:${postId2}:0`,
          values: [0, 1, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId2,
            chunk_index: 0,
            content: 'Post 2 Chunk 0',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
          },
        },
      ]);

      await connector.deletePost(tenantA, postId1);
      const results = await connector.search(tenantA, [1, 0, 0, 0], { topK: 10 });
      expect(results.some((r) => r.metadata.post_id === postId1)).toBe(false);
      expect(results.some((r) => r.metadata.post_id === postId2)).toBe(true);
    });

    it('deleteTenant purges all chunks for that tenant', async () => {
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: [1, 0, 0, 0],
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: 'Post 1',
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
          },
        },
      ]);

      await connector.deleteTenant(tenantA);
      const status = await connector.status(tenantA);
      expect(status.indexedChunksCount).toBe(0);
    });
  });

  describe('AC11: RAGConnector Registry', () => {
    afterEach(() => {
      resetRagConnectorRegistry();
    });

    it('retrieves default pgvector connector', () => {
      const rag = getRagConnector();
      expect(rag.id).toBe('pgvector');
    });

    it('allows registering custom alternative connectors (e.g. pinecone)', () => {
      const mockPinecone: RAGConnector = {
        id: 'pinecone',
        upsert: jest.fn(),
        search: jest.fn(),
        deletePost: jest.fn(),
        deleteTenant: jest.fn(),
        status: jest.fn().mockResolvedValue({ provider: 'pinecone', isAvailable: true, dimension: 1536 }),
      };

      registerRagConnector('pinecone', mockPinecone);
      const retrieved = getRagConnector('pinecone');
      expect(retrieved.id).toBe('pinecone');
    });
  });
});
