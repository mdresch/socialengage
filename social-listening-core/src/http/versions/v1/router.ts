import { Router } from 'express';

export const v1Router = Router();

/**
 * Placeholder proving the versioning mechanism works end to end. Real
 * business endpoints (connectors, watchlists, posts, ...) are Phase 1+
 * stories — see .claude/skills/http-api-versioning/SKILL.md.
 */
v1Router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
