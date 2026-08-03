import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Story 5.6 / ADR-0029 — bearer-token validation against Microsoft Entra
 * External ID's own published JWKS/OIDC discovery document. Standard OIDC/JWT
 * verification only (jose) — no Entra-specific SDK or Graph API call, per
 * ADR-0029 §2's Decision-level requirement.
 *
 * Not mounted on any real route yet — see .claude/skills/entra-authentication/
 * SKILL.md for what's deliberately deferred to Story 5.9 (identity resolution)
 * and Story 5.10 (wiring this into the real /v1 router, retiring X-Tenant-Id).
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
  /** Set only on successful verification. `sub` is an opaque identifier — never parsed for meaning (ADR-0029 §2). */
  auth?: { sub: string };
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

      (req as AuthenticatedRequest).auth = { sub: payload.sub };
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
