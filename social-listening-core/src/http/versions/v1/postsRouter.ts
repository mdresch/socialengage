import { Router } from 'express';
import { listSocialPosts, getSocialPostById } from '../../../posts/socialPostStore';

export const postsRouter = Router();

/**
 * Cursor-paginated (ADR-0011) — page/offset query params are silently ignored,
 * not rejected (standard REST tolerance for unrecognized params). Tenant
 * identity comes from an X-Tenant-Id header, a Phase 1 placeholder — see
 * .claude/skills/posts-api/SKILL.md's Known gaps.
 */
postsRouter.get('/', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  try {
    const page = await listSocialPosts(tenantId, { cursor, limit });
    res.json(page);
  } catch {
    res.status(400).json({ error: 'Invalid cursor.' });
  }
});

/**
 * REST-fetch-on-demand for a single post (Story 5.1, ADR-0012) — what a
 * subscriber calls after receiving a thin SocialPostIngestedEvent. Same
 * X-Tenant-Id placeholder as the list route above.
 */
postsRouter.get('/:id', async (req, res) => {
  const tenantId = req.header('X-Tenant-Id');
  if (!tenantId) {
    res.status(400).json({ error: 'X-Tenant-Id header is required.' });
    return;
  }

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  res.json(post);
});
