import { Router, Request, Response } from 'express';
import {
  listTopics,
  getTopicById,
  renameTopic,
  mergeTopic,
  hideTopic,
} from '../../../topics/topicStore';
import { getAuthorTopicSignals, type AuthorTopicSortBy } from '../../../topics/authorTopicSignalStore';
import { getTopicEvolution } from '../../../topics/topicEvolutionService';

export const topicsRouter = Router();

function getTenantId(req: Request): string {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

/**
 * Story 11.5 (ADR-0097) — GET /v1/topics/evolution
 * Topic evolution time series. Mounted BEFORE :id / :topic parameter routes.
 */
topicsRouter.get('/evolution', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { topic, topicId, topicName, start, end, granularity, compareToPrevious } = req.query;

    const result = await getTopicEvolution(tenantId, {
      topic: topic as string | undefined,
      topicId: topicId as string | undefined,
      topicName: topicName as string | undefined,
      start: start as string | undefined,
      end: end as string | undefined,
      granularity: granularity as 'day' | 'week' | 'month' | undefined,
      compareToPrevious: compareToPrevious === 'true',
    });

    res.status(200).json(result);
  } catch (err: any) {
    const status = err.message?.includes('required') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 12.7 (ADR-0104 §4) — GET /v1/topics
 * Lists active or all topics for the tenant.
 */
topicsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const status = req.query.status as 'active' | 'merged' | 'hidden' | 'all' | undefined;
    const search = req.query.search as string | undefined;

    const topics = await listTopics(tenantId, { status, search });
    res.status(200).json({ topics });
  } catch (err: any) {
    const status = err.message?.includes('required') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 4.1 (ADR-0007) — GET /v1/topics/:topic/authors
 */
topicsRouter.get('/:topic/authors', async (req: Request, res: Response) => {
  const topic = req.params.topic as string;
  const sortBy = (req.query.sortBy as string) ?? 'mentionCount';

  if (sortBy !== 'activeMonths' && sortBy !== 'mentionCount') {
    return res.status(400).json({ error: 'sortBy must be "activeMonths" or "mentionCount"' });
  }

  try {
    const tenantId = getTenantId(req);
    const authors = await getAuthorTopicSignals(tenantId, topic, sortBy as AuthorTopicSortBy);
    res.json({ topic, authors });
  } catch (err: any) {
    const status = err.message?.includes('required') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 12.7 (ADR-0104 §4) — GET /v1/topics/:id
 */
topicsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id as string;
    const topic = await getTopicById(tenantId, id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    res.status(200).json({ topic });
  } catch (err: any) {
    const status = err.message?.includes('required') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 12.7 (ADR-0104 §4) — POST /v1/topics/:id/rename
 */
topicsRouter.post('/:id/rename', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id as string;
    const { name } = req.body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const topic = await renameTopic(tenantId, id, name);
    res.status(200).json({ topic });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 12.7 (ADR-0104 §4) — POST /v1/topics/:id/merge
 */
topicsRouter.post('/:id/merge', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id as string;
    const { targetTopicId } = req.body ?? {};

    if (!targetTopicId || typeof targetTopicId !== 'string') {
      return res.status(400).json({ error: 'targetTopicId is required' });
    }

    const topic = await mergeTopic(tenantId, id, targetTopicId);
    res.status(200).json({ topic });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 12.7 (ADR-0104 §4) — POST /v1/topics/:id/hide
 */
topicsRouter.post('/:id/hide', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id as string;
    const topic = await hideTopic(tenantId, id);
    res.status(200).json({ topic });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});
