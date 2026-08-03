import { Router } from 'express';
import { getAuthorTopicSignals, AuthorTopicSortBy } from '../../../topics/authorTopicSignalStore';
import { requireTenantUser } from '../../auth/requireTenantUser';

export const topicsRouter = Router();

const VALID_SORT_BY: AuthorTopicSortBy[] = ['activeMonths', 'mentionCount'];

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
