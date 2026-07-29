import { Router } from 'express';
import { listSocialPosts } from '../../../posts/socialPostStore';

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
