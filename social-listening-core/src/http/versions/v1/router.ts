import { Router, RequestHandler } from 'express';
import { postsRouter } from './postsRouter';
import { topicsRouter } from './topicsRouter';
import { connectorsRouter } from './connectorsRouter';
import { watchlistsRouter } from './watchlistsRouter';
import { meRouter } from './meRouter';
import { adminTenantsRouter } from './adminTenantsRouter';
import { adminBreakGlassRouter } from './adminBreakGlassRouter';
import { adminAuditLogRouter } from './adminAuditLogRouter';
import { selfServiceSignupRouter } from './selfServiceSignupRouter';
import { domainSignupAttemptsRouter } from './domainSignupAttemptsRouter';

/**
 * Story 5.10 (ADR-0033): a factory, not a static router, so app.ts can pass
 * in whichever auth middleware variant it selected (real or test-only) —
 * see .claude/skills/tenant-auth-middleware/SKILL.md. /v1/health is
 * deliberately exempt: it predates any auth mechanism (Story 1.3, ADR-0017)
 * and stays public on purpose — a health/liveness endpoint requiring
 * credentials would be unusual and its own contract
 * (contracts/epic-1/story-1.3.api-versioning.contract.test.ts) explicitly
 * requires it reachable unauthenticated. Every substantive route is mounted
 * behind authMiddleware, except self-service-signup below, which needs its
 * own, different (claims-level, not identity-level) auth middleware — see
 * .claude/skills/self-service-tenant-signup/SKILL.md.
 */
export function createV1Router(authMiddleware: RequestHandler, claimsAuthMiddleware: RequestHandler): Router {
  const v1Router = Router();

  /**
   * Placeholder proving the versioning mechanism works end to end — see
   * .claude/skills/http-api-versioning/SKILL.md. Deliberately public.
   */
  v1Router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /** Story 3.4 (ADR-0011) — see .claude/skills/posts-api/SKILL.md. */
  v1Router.use('/posts', authMiddleware, postsRouter);

  /** Story 4.1 (ADR-0007) — see .claude/skills/author-topic-signals/SKILL.md. */
  v1Router.use('/topics', authMiddleware, topicsRouter);

  /** Story 4.4 (ADR-0022) — see .claude/skills/derived-data-caching-and-refresh/SKILL.md. */
  v1Router.use('/connectors', authMiddleware, connectorsRouter);

  /**
   * Watchlist CRUD — Phase 1 "also build, not storied" work.
   * See .claude/skills/watchlist-crud/SKILL.md and docs/open-items-and-deferred-work.md §A.
   */
  v1Router.use('/watchlists', authMiddleware, watchlistsRouter);

  /** Story 5.11 (ADR-0036 §5) — see .claude/skills/me-endpoint/SKILL.md. */
  v1Router.use('/me', authMiddleware, meRouter);

  /** Story 5.12 (ADR-0030, ADR-0031) — see .claude/skills/platform-admin-tenant-management/SKILL.md. */
  v1Router.use('/admin/tenants', authMiddleware, adminTenantsRouter);

  /** Story 5.13 (ADR-0030 §3) — see .claude/skills/platform-admin-break-glass-rest/SKILL.md. */
  v1Router.use('/admin/tenants/:tenantId/break-glass', authMiddleware, adminBreakGlassRouter);

  /** Story 5.14 (ADR-0030 §5) — see .claude/skills/platform-admin-audit-log/SKILL.md. */
  v1Router.use('/admin/audit-log', authMiddleware, adminAuditLogRouter);

  /**
   * Story 5.15 (ADR-0037 §5) — the one route in this project accepting a
   * caller resolveIdentity() cannot match. claimsAuthMiddleware verifies
   * the token but does not itself reject on unresolved identity — the
   * route handler does that check. See
   * .claude/skills/self-service-tenant-signup/SKILL.md.
   */
  v1Router.use('/tenants/self-service-signup', claimsAuthMiddleware, selfServiceSignupRouter);

  /** Story 5.16 (ADR-0037 §8b) — see .claude/skills/same-domain-invite-assist/SKILL.md. */
  v1Router.use('/tenants/domain-signup-attempts', authMiddleware, domainSignupAttemptsRouter);

  return v1Router;
}
