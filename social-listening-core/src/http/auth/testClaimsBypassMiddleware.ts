import type { RequestHandler } from 'express';
import { AuthenticatedRequest } from './entraAuthMiddleware';

export const TEST_CLAIMS_HEADER = 'X-Test-Claims';

/**
 * Test-only claims-level auth bypass — reads a JSON-encoded {sub, email}
 * directly from X-Test-Claims, skipping real Entra token verification but
 * NOT skipping resolveIdentity() the way testAuthBypassMiddleware does.
 * Only ever mounted when NODE_ENV === 'test' (see app.ts).
 *
 * This exists because self-service sign-up (Story 5.15, ADR-0037 §5) is the
 * one route that must be reachable by a caller resolveIdentity() finds
 * nothing for — testAuthBypassMiddleware's X-Test-Identity carries an
 * already-resolved ResolvedIdentity and has no way to represent "no
 * identity, but a real set of token claims to resolve." This bypass sets
 * the same req.auth shape createEntraAuthMiddleware() would from a real
 * token, so the route handler's own resolveIdentity() call runs for real
 * against the real database either way. See
 * .claude/skills/self-service-tenant-signup/SKILL.md.
 */
export const testClaimsBypassMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header(TEST_CLAIMS_HEADER);
  if (!header) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  let claims: { sub?: unknown; email?: unknown };
  try {
    claims = JSON.parse(header);
  } catch {
    res.status(401).json({ error: 'Invalid X-Test-Claims header' });
    return;
  }

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    res.status(401).json({ error: 'Invalid X-Test-Claims header' });
    return;
  }

  (req as AuthenticatedRequest).auth = { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
  next();
};
