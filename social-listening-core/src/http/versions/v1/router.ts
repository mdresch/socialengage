import { Router } from 'express';
import { postsRouter } from './postsRouter';
import { topicsRouter } from './topicsRouter';
import { connectorsRouter } from './connectorsRouter';
import { watchlistsRouter } from './watchlistsRouter';

export const v1Router = Router();

/**
 * Placeholder proving the versioning mechanism works end to end — see
 * .claude/skills/http-api-versioning/SKILL.md.
 */
v1Router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/** Story 3.4 (ADR-0011) — see .claude/skills/posts-api/SKILL.md. */
v1Router.use('/posts', postsRouter);

/** Story 4.1 (ADR-0007) — see .claude/skills/author-topic-signals/SKILL.md. */
v1Router.use('/topics', topicsRouter);

/** Story 4.4 (ADR-0022) — see .claude/skills/derived-data-caching-and-refresh/SKILL.md. */
v1Router.use('/connectors', connectorsRouter);

/**
 * Watchlist CRUD — Phase 1 "also build, not storied" work.
 * See .claude/skills/watchlist-crud/SKILL.md and docs/open-items-and-deferred-work.md §A.
 */
v1Router.use('/watchlists', watchlistsRouter);
