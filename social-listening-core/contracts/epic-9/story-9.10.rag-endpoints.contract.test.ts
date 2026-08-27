/**
 * Contract: Story 9.10 (ADR-0084, BRD-0084, FDD-0084) — RAG Search and Ask Endpoints.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-910
 */

import request from 'supertest';
import express from 'express';
import { ragRouter } from '../../src/http/versions/v1/ragRouter';
import { getRagConnector } from '../../src/rag/ragConnectorRegistry';
import { generateMockEmbedding } from '../../src/rag/ragChunkingService';

const tenantId = '11111111-1111-1111-1111-111111111111';
const postId = '22222222-2222-2222-2222-222222222222';

// Create a test Express app mocking tenant auth middleware
function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).identity = {
      type: 'tenant_user',
      userId: 'user-1',
      tenantId,
      role: 'tenant_user',
    };
    next();
  });
  app.use('/v1/rag', ragRouter);
  return app;
}

describe('Story 9.10 — RAG Search, Ask, and Status Endpoints Contract', () => {
  const app = createApp();
  const connector = getRagConnector();

  beforeEach(async () => {
    await connector.deleteTenant(tenantId);

    // Seed test chunks in vector store
    const content = 'Acme Corp launches new autonomous enterprise social listening features.';
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
          published_at: '2026-08-25T10:00:00Z',
          watchlist_ids: ['wid-1'],
          sentiment: 'positive',
          topics: ['ai-listening'],
        },
      },
    ]);
  });

  describe('AC1: POST /v1/rag/search (Semantic & Hybrid Search)', () => {
    it('returns ranked search results with normalized scores and deterministic internalUrl', async () => {
      const res = await request(app)
        .post('/v1/rag/search')
        .send({
          query: 'social listening features',
          pagination: { topK: 5 },
        });

      expect(res.status).toBe(200);
      expect(res.body.results).toBeInstanceOf(Array);
      expect(res.body.results.length).toBe(1);

      const hit = res.body.results[0];
      expect(hit.postId).toBe(postId);
      expect(hit.score).toBeGreaterThanOrEqual(0);
      expect(hit.score).toBeLessThanOrEqual(1);
      expect(hit.internalUrl).toBe(`/app/posts/${postId}`);
      expect(hit.snippet).toContain('autonomous enterprise social listening');
    });

    it('rejects empty query with 400 Bad Request', async () => {
      const res = await request(app).post('/v1/rag/search').send({ query: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Query string is required');
    });
  });

  describe('AC2 & AC3: POST /v1/rag/ask (Dual-mode Q&A with Citations)', () => {
    it('returns grounded answer with citations in JSON mode', async () => {
      const res = await request(app)
        .post('/v1/rag/ask')
        .send({
          question: 'What features did Acme launch?',
          maxChunks: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.isGrounded).toBe(true);
      expect(res.body.confidence).toBe('high');
      expect(res.body.answer).toContain('[^1]');
      expect(res.body.citations.length).toBe(1);
      expect(res.body.citations[0].postId).toBe(postId);
      expect(res.body.citations[0].citationIndex).toBe(1);
    });

    it('returns honest refusal with confidence unsupported when context is absent', async () => {
      const res = await request(app)
        .post('/v1/rag/ask')
        .send({
          question: 'What is the flight speed of an unladen swallow in Greenland?',
        });

      expect(res.status).toBe(200);
      expect(res.body.isGrounded).toBe(false);
      expect(res.body.confidence).toBe('unsupported');
      expect(res.body.citations).toEqual([]);
      expect(res.body.answer).toContain("couldn't find any relevant posts");
    });
  });

  describe('AC4: GET /v1/rag/status (Health & Indexed Chunks)', () => {
    it('returns indexing status and chunk count', async () => {
      const res = await request(app).get('/v1/rag/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.totalIndexedChunks).toBeGreaterThanOrEqual(1);
      expect(res.body.syncStatus.synced).toBeGreaterThanOrEqual(1);
    });
  });
});
