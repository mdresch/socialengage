/**
 * Contract: Story 9.8 (ADR-0082, BRD-0082, FDD-0082) — RAG Post Chunking and Embedding Pipeline.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-98
 */

import { RAGChunkingService } from '../../src/rag/ragChunkingService';
import { indexPostForRAG, getSyncStatus, resetSyncTracker } from '../../src/rag/ragIndexingPipeline';
import { PgvectorRAGConnector } from '../../src/rag/pgvectorConnector';

describe('Story 9.8 — RAG Post Chunking and Embedding Pipeline Contract', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const postId = '22222222-2222-2222-2222-222222222222';

  let chunkingService: RAGChunkingService;
  let connector: PgvectorRAGConnector;

  beforeEach(() => {
    resetSyncTracker();
    chunkingService = new RAGChunkingService();
    connector = new PgvectorRAGConnector(1536);
  });

  describe('AC1 & AC2: Chunking Rules & Boundaries', () => {
    it('preserves short posts as a single chunk with full body and metadata', () => {
      const shortPost = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'Short status update about product launch.',
        title: 'Launch Update',
        platform_id: 'gnews',
        published_at: '2026-08-25T10:00:00Z',
        sentiment: 'positive',
      };

      const chunks = chunkingService.split(shortPost);
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunk_index).toBe(0);
      expect(chunks[0].content).toContain('Title: Launch Update');
      expect(chunks[0].content).toContain('Short status update about product launch.');
      expect(chunks[0].metadata.sentiment).toBe('positive');
      expect(chunks[0].metadata.platform_id).toBe('gnews');
    });

    it('splits long markdown posts into overlapping chunks', () => {
      // Create a multi-paragraph article that exceeds single chunk size (1024 chars)
      const paragraph = 'This is an extensive analysis of market developments and strategic positioning in artificial intelligence. '.repeat(15);
      const longPost = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: `${paragraph}\n\n${paragraph}\n\n${paragraph}`,
        title: 'Comprehensive Market Report',
      };

      const chunks = chunkingService.split(longPost);
      expect(chunks.length).toBeGreaterThan(1);
      // Verify all chunks have post's title prepended
      chunks.forEach((chunk) => {
        expect(chunk.content).toContain('Title: Comprehensive Market Report');
      });
      // Sequential indices starting from 0
      expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
    });
  });

  describe('AC3 & AC5: Embedding and Sync Tracking Pipeline', () => {
    it('indexes post, generates 1536-dim embeddings, and records synced status', async () => {
      const post = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'Acme Corp reports quarterly revenue surge of 25% due to enterprise AI expansion.',
        title: 'Quarterly Results',
        sentiment: 'positive',
      };

      const result = await indexPostForRAG(tenantId, post, { connector, chunkingService });
      expect(result.status).toBe('synced');
      expect(result.chunkCount).toBe(1);

      // Verify sync tracking
      const sync = getSyncStatus(tenantId, postId);
      expect(sync).toBeDefined();
      expect(sync?.status).toBe('synced');
      expect(sync?.chunk_count).toBe(1);
      expect(sync?.embedding_model).toBe('text-embedding-3-small');

      // Verify vector store contains the chunk
      const queryVec = new Array(1536).fill(0.1);
      const searchResults = await connector.search(tenantId, queryVec, { topK: 5, minScore: 0 });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].metadata.post_id).toBe(postId);
    });

    it('handles retry and error recording when vector store fails', async () => {
      const failingConnector: any = {
        upsert: jest.fn().mockRejectedValue(new Error('Vector store connection timeout')),
      };

      const post = {
        id: postId,
        tenant_id: tenantId,
        body_markdown: 'Content to index.',
      };

      const result = await indexPostForRAG(tenantId, post, {
        connector: failingConnector,
        chunkingService,
        maxRetries: 2,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Vector store connection timeout');

      const sync = getSyncStatus(tenantId, postId);
      expect(sync?.status).toBe('failed');
      expect(sync?.error_message).toContain('Vector store connection timeout');
    });
  });
});
