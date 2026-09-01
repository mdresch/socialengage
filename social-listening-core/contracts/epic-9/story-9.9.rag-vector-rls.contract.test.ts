/**
 * Contract: Story 9.9 (ADR-0083, BRD-0083, FDD-0083) — RAG Vector-Store RLS and Metadata Lifecycle.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-99
 */

import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';
import { RAGSearchService } from '../../src/rag/ragSearchService';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';

describe('Story 9.9 — RAG Vector-Store RLS and Metadata Lifecycle Contract', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const postId1 = '33333333-3333-3333-3333-333333333333';
  const postId2 = '44444444-4444-4444-4444-444444444444';

  let connector: PgvectorRAGConnector;
  let searchService: RAGSearchService;

  beforeEach(() => {
    connector = new PgvectorRAGConnector(1536);
    searchService = new RAGSearchService(connector);
  });

  describe('AC1 & AC2: Metadata Payload & Strict Tenant Pre-filtering', () => {
    it('stores bounded metadata payload (< 4 KB) with required tenant_id, post_id, chunk_index, and content', async () => {
      const content = 'Quarterly financial earnings report indicates 15% revenue growth in EMEA.';
      const metadata = {
        tenant_id: tenantA,
        post_id: postId1,
        chunk_index: 0,
        content,
        platform_id: 'newswire',
        published_at: '2026-08-25T10:00:00Z',
        watchlist_ids: ['wid-financials'],
        sentiment: 'positive',
        topics: ['earnings', 'growth'],
      };

      const payloadBytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
      expect(payloadBytes).toBeLessThan(4096);

      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: generateMockEmbedding(content, 1536),
          metadata,
        },
      ]);

      const status = await connector.status(tenantA);
      expect(status.indexedChunksCount).toBe(1);
    });

    it('guarantees tenant isolation: search with high similarity in Tenant A returns nothing from Tenant B', async () => {
      const sensitiveText = 'Confidential roadmap details for Project Titan';
      const vector = generateMockEmbedding(sensitiveText, 1536);

      // Upsert into Tenant B
      await connector.upsert(tenantB, [
        {
          id: `${tenantB}:${postId2}:0`,
          values: vector,
          metadata: {
            tenant_id: tenantB,
            post_id: postId2,
            chunk_index: 0,
            content: sensitiveText,
            platform_id: 'gnews',
            published_at: '2026-08-25T12:00:00Z',
          },
        },
      ]);

      // Tenant A searches with the exact same query
      const results = await searchService.search(tenantA, {
        query: sensitiveText,
        topK: 10,
      });

      expect(results.length).toBe(0);
    });
  });

  describe('AC3 & AC9: In-place metadata updates (HITL overrides without re-embedding)', () => {
    it('updates sentiment and topics in-place via updateMetadata without re-generating embeddings', async () => {
      const originalText = 'Mixed reactions to customer service policy update.';
      const vector = generateMockEmbedding(originalText, 1536);

      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: vector,
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content: originalText,
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
            sentiment: 'neutral',
            topics: ['policy'],
          },
        },
      ]);

      // Apply Human-in-the-loop override (ADR-0071)
      await connector.updateMetadata(tenantA, postId1, {
        sentiment: 'negative',
        topics: ['policy', 'customer-escalation'],
      });

      const searchResults = await searchService.search(tenantA, {
        query: originalText,
        filter: { sentiment: 'negative' },
        topK: 5,
      });

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].metadata.sentiment).toBe('negative');
      expect(searchResults[0].metadata.topics).toContain('customer-escalation');
    });
  });

  describe('AC4: Over-fetching fallback for multi-attribute filtering', () => {
    it('supports overfetchFactor to prevent candidate truncation', async () => {
      const content = 'Brand intelligence and competitive monitoring.';
      await connector.upsert(tenantA, [
        {
          id: `${tenantA}:${postId1}:0`,
          values: generateMockEmbedding(content, 1536),
          metadata: {
            tenant_id: tenantA,
            post_id: postId1,
            chunk_index: 0,
            content,
            platform_id: 'gnews',
            published_at: '2026-08-25T10:00:00Z',
          },
        },
      ]);

      const results = await searchService.search(tenantA, {
        query: 'competitive monitoring',
        topK: 1,
        overfetchFactor: 3,
      });

      expect(results.length).toBe(1);
      expect(results[0].metadata.post_id).toBe(postId1);
    });
  });
});
