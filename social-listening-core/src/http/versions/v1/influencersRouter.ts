import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { queryInfluencers, explainInfluencerScore } from '../../../authors/influencerService';

export const influencersRouter = Router();

/**
 * GET /v1/influencers (Story 12.15, ADR-0108) — discover and rank influencers with topic/platform filters.
 */
influencersRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { topicId, platformId, watchlistId, minScore, sort, limit } = req.query;

  try {
    const influencers = await queryInfluencers(
      identity.tenantId,
      {
        topicId: typeof topicId === 'string' ? topicId : undefined,
        platformId: typeof platformId === 'string' ? platformId : undefined,
        watchlistId: typeof watchlistId === 'string' ? watchlistId : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        sort: typeof sort === 'string' ? (sort as any) : undefined,
        limit: limit ? Number(limit) : 50,
      },
      identity.userId
    );

    res.json({ influencers });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to query influencers.' });
  }
});

/**
 * GET /v1/influencers/:authorId/explain (Story 12.15, ADR-0108) — returns the influence score explainability breakdown.
 */
influencersRouter.get('/:authorId/explain', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const explanation = await explainInfluencerScore(identity.tenantId, req.params.authorId, identity.userId);
    if (!explanation) {
      res.status(404).json({ error: 'Author not found.' });
      return;
    }

    res.json(explanation);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to explain influencer score.' });
  }
});
