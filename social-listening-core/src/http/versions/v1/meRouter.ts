import { Router } from 'express';
import { getResolvedIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';

export const meRouter = Router();

/**
 * GET /v1/me (Story 5.11, ADR-0036 §5) — returns the caller's own
 * already-resolved identity, unmodified. No request input (query, body,
 * header) is ever read here — the identity comes exclusively from
 * req.identity, attached by the auth middleware before this handler runs
 * (ADR-0036 §5's Clarification). See .claude/skills/me-endpoint/SKILL.md.
 */
meRouter.get('/', (req, res) => {
  const identity = getResolvedIdentity(req as RequestWithIdentity);
  res.json(identity);
});
