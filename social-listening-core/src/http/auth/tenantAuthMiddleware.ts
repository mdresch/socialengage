import type { RequestHandler } from 'express';
import { createEntraAuthMiddleware, AuthenticatedRequest, EntraAuthConfig } from './entraAuthMiddleware';
import { resolveIdentity } from '../../identity/identityResolution';
import { RequestWithIdentity } from './requestIdentity';

/**
 * ADR-0033 §1/§2's "one seam" — the real, production authentication
 * middleware, composing Story 5.6's token verification (unchanged) with
 * Story 5.9's resolveIdentity() (unchanged). Mounted exactly once, at the
 * top of the /v1 router stack, in app.ts. See
 * .claude/skills/tenant-auth-middleware/SKILL.md.
 */
export function createTenantAuthMiddleware(config: EntraAuthConfig): RequestHandler {
  const entraAuth = createEntraAuthMiddleware(config);

  return function tenantAuthMiddleware(req, res, next) {
    entraAuth(req, res, async () => {
      // Reached only when entraAuth called next() — auth is guaranteed set.
      const auth = (req as AuthenticatedRequest).auth;
      if (!auth) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
      }

      const identity = await resolveIdentity({ sub: auth.sub, email: auth.email });
      if (!identity) {
        res.status(403).json({ error: 'No matching account for this identity.' });
        return;
      }

      (req as RequestWithIdentity).identity = identity;
      next();
    });
  };
}
