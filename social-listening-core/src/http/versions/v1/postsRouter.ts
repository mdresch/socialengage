import { Router } from 'express';
import {
  listSocialPosts,
  getSocialPostById,
  deriveEnrichmentText,
  setPostEnrichment,
  updatePostEnrichment,
  exportSocialPostsCsv,
} from '../../../posts/socialPostStore';
import { requireTenantUser, requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { enrichPost } from '../../../connectors/azureAiLanguage/enrichPost';
import { getWatchlistById } from '../../../watchlists/watchlistStore';
import { isConnectorActive } from '../../../connectors/connectorActivationStore';
import { getLatestCredentialId, readCredential } from '../../../credentials/credentialStore';
import { getSocialConnector } from '../../../connectors/registry';
import { invoke } from '../../../outbound/outboundEngagementService';
import { insertPending, setSent, setFailed, listForPost } from '../../../outbound/outboundActivityStore';
import { explainSpike, SpikeStorytellerError } from '../../../posts/spikeStorytellerService';

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
  const format = typeof req.query.format === 'string' ? req.query.format : undefined;

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

  if (format === 'csv') {
    try {
      const csv = await exportSocialPostsCsv(tenantId, { watchlistId });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="posts.csv"');
      res.send('\uFEFF' + csv);
    } catch (err: any) {
      if (err?.message === 'EXPORT_TOO_LARGE') {
        res.status(413).json({ code: 'EXPORT_TOO_LARGE' });
      } else {
        res.status(400).json({ error: 'Invalid request.' });
      }
    }
    return;
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

/**
 * Story 3.14 (ADR-0073) — reply to an ingested post through the originating
 * platform. User-bound, auditable, and RLS-scoped.
 */
postsRouter.post('/:id/replies', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const rawPayload =
    post.rawPayload && typeof post.rawPayload === 'object' ? (post.rawPayload as Record<string, unknown>) : {};
  const providerId = typeof rawPayload['providerId'] === 'string' ? rawPayload['providerId'] : '';

  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) {
    res.status(422).json({ error: 'Reply body is required and cannot be empty.', code: 'INVALID_REPLY_BODY' });
    return;
  }

  const active = await isConnectorActive(tenantId, providerId, 'user', userId);
  if (!active) {
    res.status(422).json({ error: 'Reply is not available for this provider.', code: 'REPLY_NOT_AVAILABLE' });
    return;
  }

  const credentialId = await getLatestCredentialId(tenantId, providerId, 'user', userId);
  if (!credentialId) {
    res.status(422).json({ error: 'Reply is not available for this provider.', code: 'REPLY_NOT_AVAILABLE' });
    return;
  }

  const credential = await readCredential(tenantId, credentialId);
  const connector = getSocialConnector(providerId);
  if (!connector || !connector.reply) {
    res.status(422).json({ error: 'Reply is not available for this provider.', code: 'REPLY_NOT_AVAILABLE' });
    return;
  }

  const pending = await insertPending({
    tenantId,
    postId: post.id,
    userId,
    providerId,
    credentialId,
    activityType: 'reply',
    body,
  });

  const result = await invoke({ tenantId, userId, post, body, credential, connector });

  if (result.status === 'sent') {
    const sent = await setSent(tenantId, pending.id, result.externalId!, result.externalUrl!, result.sentAt!);
    res.status(201).json(sent);
    return;
  }

  const failed = await setFailed(tenantId, pending.id, result.errorCode!, result.failedAt!);
  res.status(mapReplyErrorToStatus(result.errorCode!)).json(failed);
});

function mapReplyErrorToStatus(errorCode: string): number {
  switch (errorCode) {
    case 'rate_limited':
    case 'queue_ttl_exceeded':
    case 'queue_depth_exceeded':
      return 429;
    case 'network':
      return 504;
    case 'missing_permission':
    case 'post_not_found':
    case 'reconnect_required':
      return 502;
    default:
      return 500;
  }
}

/**
 * Story 3.14 (ADR-0073) — list the tenant-scoped reply audit rows for a post.
 */
postsRouter.get('/:id/replies', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId } = identity;

  const post = await getSocialPostById(tenantId, req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const replies = await listForPost(tenantId, post.id, { limit });
  res.json({ replies, nextCursor: null });
});

/**
 * Story 8.8 (ADR-0062 Decision §6) — AI Spike Storyteller. An on-demand,
 * user-triggered call that pages GET /v1/posts internally for a ±1 day
 * window around spikeDate, composes a prompt from the posts' title/body/
 * keyPhrases, and calls the existing azureOpenAiConnector.research() to
 * generate a narrative explanation. Available to both tenant_admin and
 * tenant_user (read-and-explain operation, not a write). Stateless: no
 * persistence, no stored aggregation. Returns 503 AI_UNAVAILABLE when no
 * Azure OpenAI credential is configured for the tenant.
 */
postsRouter.post('/explain-spike', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  try {
    const result = await explainSpike(tenantId, {
      spikeDate: req.body?.spikeDate,
      context: req.body?.context,
      customPrompt: req.body?.customPrompt,
    });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof SpikeStorytellerError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: 'Spike explanation failed unexpectedly.' });
  }
});

