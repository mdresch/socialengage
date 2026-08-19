import { Router } from 'express';
import { listSocialPosts, getSocialPostById, deriveEnrichmentText, setPostEnrichment } from '../../../posts/socialPostStore';
import { requireTenantUser, requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { enrichPost } from '../../../connectors/azureAiLanguage/enrichPost';
import { getWatchlistById } from '../../../watchlists/watchlistStore';

export const postsRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cursor-paginated (ADR-0011) — page/offset query params are silently ignored,
 * not rejected (standard REST tolerance for unrecognized params). Tenant
 * identity comes from the resolved, token-authenticated caller (Story 5.10)
 * via requireTenantUserIdentity() — see .claude/skills/posts-api/SKILL.md.
 *
 * Story 3.11 (ADR-0063 Decision §3) — an optional watchlistId query
 * parameter: 400 INVALID_WATCHLIST_ID for a malformed UUID; 404
 * WATCHLIST_NOT_FOUND for a missing, cross-tenant, or another user's watchlist
 * (getWatchlistById()'s existing ownership-scoped RLS, same split as
 * watchlist-crud's own ADR-0044 §5c — see
 * .claude/skills/post-watchlist-match-persistence/SKILL.md).
 */
postsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const watchlistId = typeof req.query.watchlistId === 'string' ? req.query.watchlistId : undefined;

  if (watchlistId !== undefined) {
    if (!UUID_PATTERN.test(watchlistId)) {
      res.status(400).json({ code: 'INVALID_WATCHLIST_ID' });
      return;
    }
    const watchlist = await getWatchlistById(tenantId, userId, watchlistId);
    if (!watchlist) {
      res.status(404).json({ code: 'WATCHLIST_NOT_FOUND' });
      return;
    }
  }

  try {
    const page = await listSocialPosts(tenantId, { cursor, limit, watchlistId });
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

/**
 * Story 6.16 — manually (re-)run enrichment for one already-ingested post,
 * for the case Story 6.11's own detail screen surfaced live: a post
 * ingested before any AI provider was credentialed and active stays
 * enrichment: null forever, since enrichPost() is otherwise only ever
 * called inline during ingestion. Same requireTenantUser() identity
 * source and 404-on-unknown/cross-tenant behavior as the GET route above.
 * enrichPost() resolving to undefined (no provider currently connected) is
 * a real, honest 200 with enrichment left null — not an error status; see
 * .claude/skills/posts-api/SKILL.md.
 */
postsRouter.post('/:id/enrich', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const text = deriveEnrichmentText(post.rawPayload);
  const enrichment = await enrichPost(tenantId, text);

  if (enrichment) {
    await setPostEnrichment(tenantId, post.id, enrichment as unknown as Record<string, unknown>);
  }

  res.json({ ...post, enrichment: enrichment ?? null });
});
