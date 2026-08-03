import { Router } from 'express';
import { listSocialPosts, getSocialPostById } from '../../../posts/socialPostStore';
import { requireTenantUser } from '../../auth/requireTenantUser';

export const postsRouter = Router();

/**
 * Cursor-paginated (ADR-0011) — page/offset query params are silently ignored,
 * not rejected (standard REST tolerance for unrecognized params). Tenant
 * identity comes from the resolved, token-authenticated caller (Story 5.10)
 * via requireTenantUser() — see .claude/skills/posts-api/SKILL.md.
 */
postsRouter.get('/', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

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
 * requireTenantUser() identity source as the list route above.
 */
postsRouter.get('/:id', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  res.json(post);
});
