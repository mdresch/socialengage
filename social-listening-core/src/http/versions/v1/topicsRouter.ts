import { Router, Response } from 'express';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { requireTenantUser } from '../../auth/requireTenantUser';
import {
  listTopics,
  getTopicById,
  renameTopic,
  mergeTopic,
  hideTopic,
} from '../../../topics/topicStore';
import { getAuthorTopicSignals, type AuthorTopicSortBy } from '../../../topics/authorTopicSignalStore';
import { getTopicEvolution } from '../../../topics/topicEvolutionService';
import { computeDrift, SemanticDriftError } from '../../../rag/semanticDriftService';

export const topicsRouter = Router();


/**
 * Story 11.5 (ADR-0097) — GET /v1/topics/evolution
 * Topic evolution time series. Mounted BEFORE :id / :topic parameter routes.
 */
topicsRouter.get('/evolution', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;

    const rawGranularity = req.query.granularity as string | undefined;
    if (rawGranularity && !['day', 'week', 'month'].includes(rawGranularity)) {
      return res.status(400).json({ error: 'granularity must be one of day, week, month' });
    }

    const { topic, topicId, topicName, start, end, compareToPrevious } = req.query;
    const granularity = rawGranularity as 'day' | 'week' | 'month' | undefined;

    const result = await getTopicEvolution(tenantId, {
      topic: topic as string | undefined,
      topicId: topicId as string | undefined,
      topicName: topicName as string | undefined,
      start: start as string | undefined,
      end: end as string | undefined,
      granularity,
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
topicsRouter.get('/', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
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
topicsRouter.get('/:topic/authors', async (req: RequestWithIdentity, res: Response) => {
  const topic = req.params.topic as string;
  const sortBy = (req.query.sortBy as string) ?? 'mentionCount';

  if (sortBy !== 'activeMonths' && sortBy !== 'mentionCount') {
    return res.status(400).json({ error: 'sortBy must be "activeMonths" or "mentionCount"' });
  }

  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
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
topicsRouter.get('/:id', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
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
topicsRouter.post('/:id/rename', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
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
topicsRouter.post('/:id/merge', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
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
topicsRouter.post('/:id/hide', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
    const id = req.params.id as string;
    const topic = await hideTopic(tenantId, id);
    res.status(200).json({ topic });
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/**
 * Story 13.11 (ADR-0116) — GET /v1/topics/:id/drift
 * Compares the semantic meaning of a topic between two time windows.
 */
topicsRouter.get('/:id/drift', async (req: RequestWithIdentity, res: Response) => {
  try {
    const tenantId = requireTenantUser(req, res);
    if (!tenantId) return;
    const id = req.params.id as string;
    const { start, end } = req.query;

    if (!start || typeof start !== 'string' || !end || typeof end !== 'string') {
      return res.status(400).json({ error: 'start and end query parameters are required' });
    }

    const result = await computeDrift(tenantId, id, start, end);
    res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof SemanticDriftError) {
      return res.status(err.status).json({ code: err.code, error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});
