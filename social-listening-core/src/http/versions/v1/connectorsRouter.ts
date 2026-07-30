import { Router } from 'express';
import { getCachedConnectorHealth } from '../../../connectors/connectorHealthCache';

export const connectorsRouter = Router();

/**
 * GET /v1/connectors/:platformId (Story 4.4, ADR-0022) — ConnectorHealth
 * served from the in-process TTL cache, never a live recompute per request.
 * Tenant identity comes from the same X-Tenant-Id header placeholder
 * postsRouter/topicsRouter use. See
 * .claude/skills/derived-data-caching-and-refresh/SKILL.md.
 */
connectorsRouter.get('/:platformId', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const health = await getCachedConnectorHealth(tenantId, req.params.platformId);
  res.json(health);
});
