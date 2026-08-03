import { Router, RequestHandler } from 'express';
import { postsRouter } from './postsRouter';
import { topicsRouter } from './topicsRouter';
import { connectorsRouter } from './connectorsRouter';
import { watchlistsRouter } from './watchlistsRouter';

/**
 * Story 5.10 (ADR-0033): a factory, not a static router, so app.ts can pass
 * in whichever auth middleware variant it selected (real or test-only) —
 * see .claude/skills/tenant-auth-middleware/SKILL.md. /v1/health is
 * deliberately exempt: it predates any auth mechanism (Story 1.3, ADR-0017)
 * and stays public on purpose — a health/liveness endpoint requiring
 * credentials would be unusual and its own contract
 * (contracts/epic-1/story-1.3.api-versioning.contract.test.ts) explicitly
 * requires it reachable unauthenticated. Every substantive route is mounted
 * behind authMiddleware.
 */
export function createV1Router(authMiddleware: RequestHandler): Router {
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

  return v1Router;
}
