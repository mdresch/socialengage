import { Router } from 'express';
import { getAuthorTopicSignals, AuthorTopicSortBy } from '../../../topics/authorTopicSignalStore';
import { getTopicEvolution } from '../../../topics/topicEvolutionService';
import { requireTenantUser } from '../../auth/requireTenantUser';

export const topicsRouter = Router();

const VALID_SORT_BY: AuthorTopicSortBy[] = ['activeMonths', 'mentionCount'];

/**
 * GET /v1/topics/evolution (Story 11.5, ADR-0097) — returns time-series data for a topic's
 * volume, sentiment, unique authors, top authors, top keywords, and 7-day slope trend.
 */
topicsRouter.get('/evolution', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const topicName = (req.query.topicName || req.query.topic || req.query.topicId) as string | undefined;
  const topicId = req.query.topicId as string | undefined;
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;
  const granularity = (req.query.granularity || 'day') as 'day' | 'week' | 'month';
  const compareToPrevious = req.query.compareToPrevious === 'true';

  if (!['day', 'week', 'month'].includes(granularity)) {
    res.status(400).json({ error: 'granularity must be one of day, week, month.' });
    return;
  }

  try {
    const evolution = await getTopicEvolution(tenantId, {
      topicId,
      topicName,
      start,
      end,
      granularity,
      compareToPrevious,
    });
    res.json(evolution);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch topic evolution' });
  }
});

/**
 * GET /v1/topics/:topic/authors (Story 4.1, ADR-0007) — raw AuthorTopicSignal
 * rows for a topic, sorted by the requested field; no computed expertise
 * score exists. Tenant identity comes from the resolved, token-authenticated
 * caller (Story 5.10) via requireTenantUser() — see
 * .claude/skills/author-topic-signals/SKILL.md.
 */
topicsRouter.get('/:topic/authors', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const sortByParam = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'mentionCount';
  if (!VALID_SORT_BY.includes(sortByParam as AuthorTopicSortBy)) {
    res.status(400).json({ error: 'sortBy must be one of activeMonths, mentionCount.' });
    return;
  }

  const authors = await getAuthorTopicSignals(tenantId, req.params.topic, sortByParam as AuthorTopicSortBy);
  res.json({ topic: req.params.topic, authors });
});
