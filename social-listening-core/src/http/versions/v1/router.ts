import { Router } from 'express';
import { postsRouter } from './postsRouter';
import { topicsRouter } from './topicsRouter';

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
