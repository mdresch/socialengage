import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Story 5.6 / ADR-0029 — bearer-token validation against Microsoft Entra
 * External ID's own published JWKS/OIDC discovery document. Standard OIDC/JWT
 * verification only (jose) — no Entra-specific SDK or Graph API call, per
 * ADR-0029 §2's Decision-level requirement.
 *
 * As of Story 5.10, composed inside tenantAuthMiddleware.ts (not called
 * directly by any route) — see .claude/skills/tenant-auth-middleware/SKILL.md.
 */

export interface EntraAuthConfig {
  /** Expected `iss` claim — e.g. https://{tenantId}.ciamlogin.com/{tenantId}/v2.0 */
  issuer: string;
  /** The tenant's real JWKS endpoint — e.g. https://{subdomain}.ciamlogin.com/{tenantId}/discovery/v2.0/keys */
  jwksUri: string;
  /** Expected `aud` claim — the social-listening-core API app's own App ID / App ID URI. */
  audience: string;
}

export interface AuthenticatedRequest extends Request {
  /**
   * Set only on successful verification. `sub` is an opaque identifier —
   * never parsed for meaning (ADR-0029 §2). `email` (added Story 5.10) is
   * extracted the same way — a verbatim claim value, not derived meaning —
   * for resolveIdentity()'s own invite-link lookup (ADR-0032 §6). Empty
   * string if the token carries no `email` claim (e.g. today's app-only
   * client-credentials tokens — see this component's own SKILL.md "Known
   * gaps" for why interactive user tokens remain unverified).
   */
  auth?: { sub: string; email: string };
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Creates the auth middleware for a given Entra tenant configuration. Builds
 * exactly one remote JWKS set (jose caches/refreshes it internally) per call —
 * construct this once at startup, not per-request.
 */
export function createEntraAuthMiddleware(config: EntraAuthConfig): RequestHandler {
  const jwks = createRemoteJWKSet(new URL(config.jwksUri));

  return async function entraAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const header = req.header('Authorization');

    if (!header || !header.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: config.audience,
      });

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        res.status(401).json({ error: 'Token missing sub claim' });
        return;
      }

      const email = typeof payload.email === 'string' ? payload.email : '';
      (req as AuthenticatedRequest).auth = { sub: payload.sub, email };
      next();
    } catch {
      // Signature failure, issuer/audience mismatch, and expiry all land here —
      // jose throws a distinct error type per case, but ADR-0029's own AC4
      // requires all three to produce the same 401 outcome before any
      // downstream application logic runs, so the cause is not differentiated
      // in the response.
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
