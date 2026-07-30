import { Router } from 'express';
import { getAuthorTopicSignals, AuthorTopicSortBy } from '../../../topics/authorTopicSignalStore';

export const topicsRouter = Router();

const VALID_SORT_BY: AuthorTopicSortBy[] = ['activeMonths', 'mentionCount'];

/**
 * GET /v1/topics/:topic/authors (Story 4.1, ADR-0007) — raw AuthorTopicSignal
 * rows for a topic, sorted by the requested field; no computed expertise
 * score exists. Tenant identity comes from an X-Tenant-Id header, the same
 * Phase 1 placeholder postsRouter uses — see
 * .claude/skills/author-topic-signals/SKILL.md.
 */
topicsRouter.get('/:topic/authors', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const sortByParam = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'mentionCount';
  if (!VALID_SORT_BY.includes(sortByParam as AuthorTopicSortBy)) {
    res.status(400).json({ error: 'sortBy must be one of activeMonths, mentionCount.' });
    return;
  }

  const authors = await getAuthorTopicSignals(tenantId, req.params.topic, sortByParam as AuthorTopicSortBy);
  res.json({ topic: req.params.topic, authors });
});
