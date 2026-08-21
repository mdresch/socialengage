import { Router } from 'express';
import {
  listSocialPosts,
  getSocialPostById,
  deriveEnrichmentText,
  setPostEnrichment,
  updatePostEnrichment,
} from '../../../posts/socialPostStore';
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
 * Story 3.13 (ADR-0071) — Human-in-the-Loop post enrichment overrides.
 * Updates sentiment, keyPhrases, detectedLanguage, geoCountry, and summary
 * with audit lineage.
 */
postsRouter.patch('/:id/enrichment', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  try {
    const updated = await updatePostEnrichment(tenantId, req.params.id, userId, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    const code = err?.message || 'BAD_REQUEST';
    res.status(400).json({ error: err?.message || 'Invalid payload', code });
  }
});

/**
 * Story 6.16 & Story 3.13 (ADR-0071) — manually (re-)run enrichment for one already-ingested post.
 * Enforces a 409 Conflict guard if the post has been manually overridden unless force: true is passed.
 */
postsRouter.post('/:id/enrich', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const existingEnrichment = (post.enrichment as Record<string, any>) || {};
  const override = existingEnrichment.override;

  // Story 3.13 precedence guard: 409 Conflict if manually overridden without force
  if (override?.isOverridden && req.body?.force !== true) {
    res.status(409).json({
      error: 'Post enrichment has been manually overridden',
      code: 'ENRICHMENT_MANUALLY_OVERRIDDEN',
      override,
    });
    return;
  }

  const text = deriveEnrichmentText(post.rawPayload);
  const enrichment = await enrichPost(tenantId, text);

  if (enrichment) {
    let finalEnrichment: Record<string, any> = { ...enrichment };
    if (override) {
      const aiHistory = override.aiHistory ? [...override.aiHistory] : [];
      aiHistory.push({
        generatedAt: new Date().toISOString(),
        model: (enrichment as any).modelUsed ?? (enrichment as any).model,
        values: { ...enrichment },
      });

      finalEnrichment.override = {
        ...override,
        isOverridden: false,
        originalValues: { ...enrichment },
        aiHistory,
      };
    }
    await setPostEnrichment(tenantId, post.id, finalEnrichment);
    res.json({ ...post, enrichment: finalEnrichment });
  } else {
    res.json({ ...post, enrichment: post.enrichment ?? null });
  }
});

