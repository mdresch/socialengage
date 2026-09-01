import express, { Express } from 'express';
import { createV1Router } from './versions/v1/router';
import { createTenantAuthMiddleware } from './auth/tenantAuthMiddleware';
import { testAuthBypassMiddleware } from './auth/testAuthBypassMiddleware';
import { createEntraAuthMiddleware } from './auth/entraAuthMiddleware';
import { testClaimsBypassMiddleware } from './auth/testClaimsBypassMiddleware';
import { rateLimitMiddleware } from './rateLimitMiddleware';

/**
 * Story 5.10 (ADR-0033): resolves the real Entra tenant config from env
 * vars, matching the exact construction Story 5.6's own contract uses
 * (contracts/epic-5/story-5.6.entra-authentication.contract.test.ts).
 * Only called outside test mode — see createApp() below.
 */
function entraConfigFromEnv() {
  const tenantId = process.env.ENTRA_TENANT_ID as string;
  const tenantSubdomain = process.env.ENTRA_TENANT_SUBDOMAIN as string;
  const apiAppId = process.env.ENTRA_API_APP_ID as string;
  return {
    issuer: `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`,
    jwksUri: `https://${tenantSubdomain}.ciamlogin.com/${tenantId}/discovery/v2.0/keys`,
    audience: apiAppId,
  };
}

/**
 * Every route is mounted under a version prefix (ADR-0017) — never mount
 * anything at the app root. See .claude/skills/http-api-versioning/SKILL.md.
 *
 * ADR-0033's "one seam": exactly one auth middleware definition, selected
 * here and threaded into createV1Router() (versions/v1/router.ts), which
 * mounts it ahead of every substantive route — never duplicated per-route
 * logic, never re-implemented in a handler. /v1/health is the one
 * deliberate exception (see router.ts's own comment — it predates any auth
 * mechanism, ADR-0017/Story 1.3, and stays public). NODE_ENV === 'test'
 * (Jest's own default, unchanged) selects the test-only bypass instead of
 * real Entra verification — see .claude/skills/tenant-auth-middleware/
 * SKILL.md's "Load-bearing constraints" for why this is the entire safety
 * boundary between the two.
 */
export function createApp(): Express {
  const app = express();
  app.use(express.json());

  const authMiddleware =
    process.env.NODE_ENV === 'test' ? testAuthBypassMiddleware : createTenantAuthMiddleware(entraConfigFromEnv());

  // Story 5.15 (ADR-0037 §5): self-service-signup's own auth needs token
  // verification only, never the identity-resolution-and-reject-on-null
  // step authMiddleware bakes in — that would reject exactly the one
  // caller this route exists to accept. See
  // .claude/skills/self-service-tenant-signup/SKILL.md.
  const claimsAuthMiddleware =
    process.env.NODE_ENV === 'test' ? testClaimsBypassMiddleware : createEntraAuthMiddleware(entraConfigFromEnv());

  // Story 12.11 (ADR-0106): Public API rate limiting & X-RateLimit-* headers
  app.use('/v1', rateLimitMiddleware);

  app.use('/v1', createV1Router(authMiddleware, claimsAuthMiddleware));
  return app;
}

