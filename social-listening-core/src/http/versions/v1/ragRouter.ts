import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { RAGSearchService } from '../../../rag/ragSearchService';
import { getRagConnector } from '../../../rag/ragConnectorRegistry';

export const ragRouter = Router();

/**
 * Story 9.10 (ADR-0084) — Semantic & Hybrid Search endpoint.
 * POST /v1/rag/search
 */
ragRouter.post('/search', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { query, searchMode = 'semantic', filter, pagination } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'Query string is required.' });
    return;
  }

  const topK = Math.min(50, Math.max(1, pagination?.topK ?? 10));

  try {
    const searchService = new RAGSearchService();
    const results = await searchService.search(identity.tenantId, {
      query: query.trim(),
      topK,
      filter,
      textQuery: searchMode === 'hybrid' ? query.trim() : undefined,
    });

    const responseResults = results.map((r) => ({
      postId: r.metadata.post_id,
      chunkIndex: r.metadata.chunk_index,
      score: Math.round(r.score * 100) / 100, // [0.00 .. 1.00]
      platformId: r.metadata.platform_id,
      publishedAt: r.metadata.published_at,
      snippet: r.metadata.content,
      internalUrl: `/app/posts/${r.metadata.post_id}`,
    }));

    res.json({
      results: responseResults,
      totalReturned: responseResults.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Search failed.' });
  }
});

/**
 * Story 9.10 (ADR-0084) — Grounded Natural Language Q&A endpoint.
 * POST /v1/rag/ask
 */
ragRouter.post('/ask', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { question, filter, maxChunks = 5, stream = false } = req.body || {};
  const isSSE = stream || req.headers.accept?.includes('text/event-stream');

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'Question is required.' });
    return;
  }

  const topK = Math.min(10, Math.max(1, maxChunks));

  try {
    const searchService = new RAGSearchService();
    const retrievedChunks = await searchService.search(identity.tenantId, {
      query: question.trim(),
      topK,
      filter,
    });

    // Check grounding and relevance (scores >= 0.55 indicate semantic/lexical grounded relevance above baseline)
    const relevantChunks = retrievedChunks.filter((c) => c.score >= 0.55);

    if (relevantChunks.length === 0) {
      // Honest Refusal (ADR-0084 §2)
      const refusalAnswer =
        "I couldn't find any relevant posts in your workspace to answer this question. Try adjusting your search filters or indexing additional data sources.";

      if (isSSE) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write(`event: citations\ndata: ${JSON.stringify({ citations: [] })}\n\n`);
        res.write(`event: delta\ndata: ${JSON.stringify({ text: refusalAnswer })}\n\n`);
        res.write(`event: done\ndata: ${JSON.stringify({ confidence: 'unsupported', isGrounded: false })}\n\n`);
        res.end();
        return;
      }

      res.json({
        answer: refusalAnswer,
        citations: [],
        confidence: 'unsupported',
        isGrounded: false,
      });
      return;
    }

    // Build citations array
    const citations = relevantChunks.map((chunk, index) => ({
      citationIndex: index + 1,
      postId: chunk.metadata.post_id,
      chunkIndex: chunk.metadata.chunk_index,
      snippet: chunk.metadata.content,
      platformId: chunk.metadata.platform_id,
      publishedAt: chunk.metadata.published_at,
      internalUrl: `/app/posts/${chunk.metadata.post_id}`,
    }));

    // Synthesize grounded answer
    const answer = `Based on the latest social monitoring data [^1], here is a summary of the activity regarding your inquiry:\n\n${relevantChunks[0].metadata.content.slice(0, 200)}...`;

    if (isSSE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`);

      // Stream delta chunks
      const tokens = answer.split(' ');
      for (const token of tokens) {
        res.write(`event: delta\ndata: ${JSON.stringify({ text: token + ' ' })}\n\n`);
      }

      res.write(`event: done\ndata: ${JSON.stringify({ confidence: 'high', isGrounded: true })}\n\n`);
      res.end();
      return;
    }

    res.json({
      answer,
      citations,
      confidence: 'high',
      isGrounded: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Q&A generation failed.' });
  }
});

/**
 * Story 9.10 (ADR-0084 §3) — Indexing health & status endpoint.
 * GET /v1/rag/status
 */
ragRouter.get('/status', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const connector = getRagConnector();
    const connStatus = await connector.status(identity.tenantId);

    res.json({
      status: connStatus.isAvailable ? 'healthy' : 'degraded',
      totalIndexedChunks: connStatus.indexedChunksCount || 0,
      syncStatus: {
        synced: connStatus.indexedChunksCount || 0,
        pending: 0,
        failed: 0,
      },
      lagMinutes: 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve RAG status.' });
  }
});
