import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { ComposerResearchError, performResearch } from '../../../composer/composerResearchService';
import { ClassifiableError } from '../../../ingestion/errorClassification';

export const composerRouter = Router();

/**
 * Story 3.17 (ADR-0076) — Deep Research for the Polypost Composer.
 * POST /v1/composer/research accepts a draft post and orchestrates
 * extraction, one-off Brave/Bing searches, and synthesis. Available to
 * tenant_admin and tenant_user identities; platform_admin is rejected.
 */
composerRouter.post('/research', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  try {
    const result = await performResearch(tenantId, {
      text: req.body?.text,
      targetPlatforms: Array.isArray(req.body?.targetPlatforms) ? req.body.targetPlatforms : undefined,
      maxSearchResultsPerQuery: req.body?.maxSearchResultsPerQuery,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ComposerResearchError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }

    if (err instanceof ClassifiableError) {
      const statusByKind: Record<string, number> = {
        rate_limit: 429,
        rate_limited: 429,
        queue_ttl_exceeded: 429,
        queue_depth_exceeded: 429,
        http_5xx: 502,
        network: 502,
      };
      const status = statusByKind[err.kind] ?? 422;
      res.status(status).json({ error: err.message, code: err.kind });
      return;
    }

    res.status(500).json({ error: 'Research failed unexpectedly.' });
  }
});
