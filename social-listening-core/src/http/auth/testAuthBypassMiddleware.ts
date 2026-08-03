import type { RequestHandler } from 'express';
import { RequestWithIdentity } from './requestIdentity';
import { ResolvedIdentity } from '../../identity/identityResolution';

export const TEST_IDENTITY_HEADER = 'X-Test-Identity';

/**
 * Test-only auth bypass — reads a JSON-encoded ResolvedIdentity directly
 * from X-Test-Identity, skipping real Entra token verification entirely.
 * Only ever mounted when NODE_ENV === 'test' (see app.ts) — never present
 * in production. See .claude/skills/tenant-auth-middleware/SKILL.md's
 * "Load-bearing constraints" for why this gate is the entire safety
 * boundary here.
 */
export const testAuthBypassMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header(TEST_IDENTITY_HEADER);
  if (!header) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  let identity: ResolvedIdentity;
  try {
    identity = JSON.parse(header) as ResolvedIdentity;
  } catch {
    res.status(401).json({ error: 'Invalid X-Test-Identity header' });
    return;
  }

  (req as RequestWithIdentity).identity = identity;
  next();
};
