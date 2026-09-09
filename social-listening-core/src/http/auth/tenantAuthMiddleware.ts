import type { RequestHandler } from 'express';
import { createEntraAuthMiddleware, AuthenticatedRequest, EntraAuthConfig } from './entraAuthMiddleware';
import { resolveIdentity } from '../../identity/identityResolution';
import { RequestWithIdentity } from './requestIdentity';
import { SeatLimitExceededError } from '../../tenants/featureGates';

/**
 * ADR-0033 §1/§2's "one seam" — the real, production authentication
 * middleware, composing Story 5.6's token verification (unchanged) with
 * Story 5.9's resolveIdentity() (unchanged). Mounted exactly once, at the
 * top of the /v1 router stack, in app.ts. See
 * .claude/skills/tenant-auth-middleware/SKILL.md.
 *
 * Story 13.5 (ADR-0112): a `SeatLimitExceededError` thrown during
 * invite-activation is mapped to a 403 `SEAT_LIMIT_EXCEEDED` response, the
 * same code the HTTP invite surface returns.
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

      try {
        const identity = await resolveIdentity({ sub: auth.sub, email: auth.email });
        if (!identity) {
          res.status(403).json({ error: 'No matching account for this identity.' });
          return;
        }

        (req as RequestWithIdentity).identity = identity;
        next();
      } catch (err) {
        if (err instanceof SeatLimitExceededError) {
          res.status(403).json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    });
  };
}
