import { SocialConnector, OutboundPostPayload } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { SocialPostSummary } from '../../posts/socialPostStore';

export const FACEBOOK_PROVIDER_ID = 'facebook';

/**
 * ADR-0059 Decision §4 — verified directly against developers.facebook.com's
 * own Access Token Guide. v21.0 confirmed current/stable at drafting time
 * (2026-08-18); bump alongside a real API-version deprecation notice, not
 * speculatively.
 */
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface FacebookPagePost {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  /**
   * Story 2.23 (ADR-0067) — true author attribution when a post is created
   * on the Page by a specific user/creator rather than directly as the Page entity.
   */
  from?: { id: string; name: string };
  /**
   * Story 2.18 (ADR-0059 Decision §2) — aggregate engagement counts only,
   * never individual comment/reaction content (ADR-0059 Decision §5's own
   * author-rights boundary). All three optional: `shares` is confirmed,
   * live, to be omitted entirely at zero (never `{ count: 0 }`) — see
   * facebook-connector/SKILL.md's own Load-bearing constraints. `reactions`/
   * `comments` are typed optional defensively, even though observed present
   * at zero in the same live check.
   */
  reactions?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

interface FacebookCredential {
  pageId: string;
  pageAccessToken: string;
  pageName: string;
}

/**
 * ADR-0059 Decision §4 — the stored credential is a JSON string
 * {pageId, pageAccessToken, pageName}, the same "opaque single string,
 * multi-part JSON inside it" pattern azureAiLanguageConnector.ts/
 * azureOpenAiConnector.ts already established (ADR-0014, no new storage
 * pattern). A malformed/incomplete credential is a credential-class
 * failure (http_401), matching every other connector's own treatment.
 */
export function parseFacebookCredential(credential: string): FacebookCredential {
  let parsed: Partial<FacebookCredential>;
  try {
    parsed = JSON.parse(credential) as Partial<FacebookCredential>;
  } catch {
    throw new ClassifiableError(
      'http_401',
      'Facebook credential is not valid JSON (expected {pageId, pageAccessToken, pageName}).'
    );
  }
  if (!parsed.pageId || !parsed.pageAccessToken) {
    throw new ClassifiableError('http_401', 'Facebook credential is missing pageId or pageAccessToken.');
  }
  return parsed as FacebookCredential;
}

function classifyResponse(response: Response, context: string): void {
  if (response.status === 401) throw new ClassifiableError('http_401', `Facebook returned 401 (${context})`);
  if (response.status === 403) throw new ClassifiableError('http_403', `Facebook returned 403 (${context})`);
  if (response.status === 429) throw new ClassifiableError('rate_limit', `Facebook returned 429 (${context})`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Facebook returned ${response.status} (${context})`);
  // Reuses 'network' for the same reason every other connector's own
  // adjacent generic-4xx branch does (project-wide convention for "a
  // generic rejection from a real provider", confirmed via direct grep
  // across gnewsConnector.ts/newswireConnector.ts/azureOpenAiConnector.ts/
  // tenantOwnedFeedConnector.ts/wikipediaConnector.ts/azureAiLanguageConnector.ts
  // — Story 2.16's own corrected doc comment) — not because 'network' is
  // non-retryable (it is retryable; this does not change that).
  if (!response.ok) throw new ClassifiableError('network', `Facebook returned ${response.status} (${context})`);
}

interface FacebookApiError {
  error?: { code: number; type: string; message: string };
}

/**
 * Graph API's own convention (verified directly, developers.facebook.com):
 * an invalid/expired token can return a real HTTP 200 with an {error:{...}}
 * body for some error classes — checked explicitly, the same "can't be
 * caught by status code alone" treatment wikipediaConnector.ts's own
 * mediaWikiFetch() already established for MediaWiki's equivalent case.
 */
async function graphApiFetch(url: string, context: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Facebook Graph API (${context}): ${(err as Error).message}`);
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response, rely on classifyResponse below
  }

  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as FacebookApiError).error;
    if (error) {
      const code = error.code;
      if (code === 190 || code === 10 || code === 100) {
        throw new ClassifiableError('http_401', `Facebook API auth error ${code} (${context}): ${error.type} — ${error.message}`);
      }
      if (code === 4 || code === 17) {
        throw new ClassifiableError('rate_limit', `Facebook API rate limit error ${code} (${context}): ${error.type} — ${error.message}`);
      }
      throw new ClassifiableError('network', `Facebook API error (${context}): ${error.type} — ${error.message}`);
    }
  }

  classifyResponse(response, context);

  return (body ?? {}) as Record<string, unknown>;
}

/**
 * Story 2.27 (ADR-0073) — dedicated POST helper for outbound replies. Graph
 * API returns error codes in the JSON body (including inside a 200 response),
 * so this is kept separate from the GET-oriented `graphApiFetch()` used for
 * ingestion. The classifications are intentionally reply-specific.
 */
async function postToFacebookGraphApi(
  url: string,
  context: string,
  body?: URLSearchParams,
  notFoundKind: 'post_not_found' | 'target_asset_not_found' = 'post_not_found'
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', body });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Facebook Graph API (${context}): ${(err as Error).message}`);
  }

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response; rely on HTTP classification below
  }

  if (parsedBody && typeof parsedBody === 'object' && 'error' in parsedBody) {
    const error = (parsedBody as FacebookApiError).error;
    if (error) {
      const code = error.code;
      const message = error.message ?? '';
      const type = error.type ?? 'OAuthException';
      if (code === 190 || code === 10) {
        throw new ClassifiableError('reconnect_required', `Facebook auth error ${code} (${context}): ${type} — ${message}`);
      }
      if (code === 4 || code === 17 || code === 32 || code === 80000) {
        throw new ClassifiableError('rate_limited', `Facebook rate limit error ${code} (${context}): ${type} — ${message}`);
      }
      if (code === 803) {
        throw new ClassifiableError(notFoundKind, `Facebook asset not found ${code} (${context}): ${type} — ${message}`);
      }
      if (code === 200 || /permission|insufficient scope/i.test(message)) {
        throw new ClassifiableError('missing_permission', `Facebook permission error ${code} (${context}): ${type} — ${message}`);
      }
      throw new ClassifiableError('network', `Facebook API error (${context}): ${type} — ${message}`);
    }
  }

  if (response.status === 401) throw new ClassifiableError('reconnect_required', `Facebook returned 401 (${context})`);
  if (response.status === 403) throw new ClassifiableError('missing_permission', `Facebook returned 403 (${context})`);
  if (response.status === 429) throw new ClassifiableError('rate_limited', `Facebook returned 429 (${context})`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Facebook returned ${response.status} (${context})`);
  if (!response.ok) throw new ClassifiableError('network', `Facebook returned ${response.status} (${context})`);

  return (parsedBody ?? {}) as Record<string, unknown>;
}

/**
 * Story 2.27 (ADR-0073) — post a comment on an ingested Facebook Page post.
 * Requires the Page credential to include the `pages_manage_engagement`
 * permission (working assumption; verify live before any real tenant goes live).
 */
export async function replyToFacebookPost(
  post: SocialPostSummary,
  body: string,
  credential: string
): Promise<{ externalId: string; externalUrl: string }> {
  const { pageId, pageAccessToken } = parseFacebookCredential(credential);
  const rawPayload = (post.rawPayload ?? {}) as { id?: string; pageId?: string };
  const postId = rawPayload.id;
  if (!postId) {
    throw new ClassifiableError('post_not_found', 'Facebook post rawPayload has no Graph API id.');
  }

  const url = `${GRAPH_API_BASE}/${encodeURIComponent(postId)}/comments?access_token=${encodeURIComponent(pageAccessToken)}`;
  const result = await postToFacebookGraphApi(url, 'reply to post', new URLSearchParams({ message: body }));
  const comment = result as unknown as { id?: string };
  if (!comment.id) {
    throw new ClassifiableError('network', 'Facebook reply response did not contain a comment id.');
  }

  const externalUrl = `https://www.facebook.com/${postId}/?comment_id=${comment.id}`;
  return { externalId: comment.id, externalUrl };
}

/**
 * Story 2.29 (ADR-0075) — publish a new post to a connected Facebook Page.
 * Requires the Page credential to include the `pages_manage_posts`
 * permission (working assumption; verify live before any real tenant goes live).
 */
export async function publishToFacebookPage(
  tenantId: string,
  userId: string,
  payload: OutboundPostPayload,
  credential: string
): Promise<{ externalId: string; externalUrl: string }> {
  const { pageId, pageAccessToken } = parseFacebookCredential(credential);

  // The caller's chosen Page must match the credential the outbound path resolved.
  if (payload.targetAssetId !== pageId) {
    throw new ClassifiableError(
      'missing_permission',
      `Credential is for Page ${pageId}, not the requested Page ${payload.targetAssetId}.`
    );
  }

  const url = `${GRAPH_API_BASE}/${encodeURIComponent(payload.targetAssetId)}/feed?access_token=${encodeURIComponent(pageAccessToken)}`;
  const result = await postToFacebookGraphApi(
    url,
    'publish to page',
    new URLSearchParams({ message: payload.text }),
    'target_asset_not_found'
  );
  const post = result as unknown as { id?: string };
  if (!post.id) {
    throw new ClassifiableError('network', 'Facebook publish response did not contain a post id.');
  }

  const externalUrl = `https://www.facebook.com/${payload.targetAssetId}/posts/${post.id}`;
  return { externalId: post.id, externalUrl };
}

/**
 * ADR-0059 Decision §2 — the Page's own published posts only, no comment/
 * mention *content* (Decision §5's deferred third-party author-rights
 * question). `fields` deliberately requests only what normalize()/
 * Author-modeling/Decision §2's own named engagement-count scope actually
 * consume — never a broader field set that could pull in comment-shaped
 * data incidentally. `reactions.summary(total_count)`/
 * `comments.summary(total_count)`/`shares` (Story 2.18) request aggregate
 * counts only, via Graph API's own summary-aggregation syntax — never the
 * underlying `reactions`/`comments` edges' own per-item data, which would
 * pull in individual identifiable people.
 */
export async function fetchFacebookPagePosts(pageId: string, pageAccessToken: string, limit = 25): Promise<FacebookPagePost[]> {
  const fields = 'id,message,created_time,permalink_url,from{id,name},reactions.summary(total_count),comments.summary(total_count),shares';
  const url = `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/feed?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(pageAccessToken)}`;
  const body = await graphApiFetch(url, 'feed');
  const data = (body as { data?: FacebookPagePost[] }).data;
  return Array.isArray(data) ? data : [];
}

export interface FacebookPageMetadata {
  id: string;
  name: string;
  fan_count?: number;
}

/** ADR-0059 Decision §5 — the Page's own name/fan count, for Author.displayName/followerCount. */
export async function fetchFacebookPageMetadata(pageId: string, pageAccessToken: string): Promise<FacebookPageMetadata> {
  const url = `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}?fields=id,name,fan_count&access_token=${encodeURIComponent(pageAccessToken)}`;
  const body = await graphApiFetch(url, 'page metadata');
  return body as unknown as FacebookPageMetadata;
}

/**
 * ADR-0059 (Story 2.15) — Facebook connector: a tenant's own connected
 * Page's own posts only, Tier 3 (user-bound) credential. See
 * .claude/skills/facebook-connector/SKILL.md.
 *
 * Deliberately has no `.poll`/`.pollCadenceMs` properties — the live
 * ingestion-polling scheduler (ADR-0052) only enumerates ownerType:'tenant'
 * activations, and this connector is Tier-3-only by design (ADR-0059
 * Decision §4), so it can never have one. Real Tier-3 scheduler support
 * (ADR-0052 Decision §6's own already-named, not-yet-built future shape —
 * poll(tenantId, userId), a RequestGate key of (tenantId, userId,
 * providerId)) is a real, separate gap this story does not close — see
 * this connector's own SKILL.md Known gaps. `deliveryMode: 'poll'` still
 * describes this connector's real transport shape (it fetches on request,
 * not push); pollScheduler.ts's own `if (connector.poll && ...)` guard
 * safely skips any connector with no `.poll` property, so registering
 * this connector without one is not a latent crash risk.
 */
export const facebookConnector: SocialConnector = {
  providerId: FACEBOOK_PROVIDER_ID,
  authMode: 'oauth',
  deliveryMode: 'poll',

  /**
   * ADR-0059 Decision §4 — the real, confirmed ceiling (4,800 x the Page's
   * own Engaged Users, per rolling 24-hour window) is per-Page dynamic;
   * ProviderConnector.getRateLimitConfig() is synchronous/zero-arg, with no
   * credential/tenant context to resolve a specific Page's own Engaged
   * Users at this call site. This is an explicit, conservative, flat
   * placeholder — not the real per-Page number — sized for a small
   * business Page rather than a drop-in reuse of any other connector's own
   * flat ceiling. Revisit once a real per-connector-instance rate-limit
   * shape exists (named, not designed, in this ADR's own Open Questions).
   */
  getRateLimitConfig: () => ({ requestsPerWindow: 200, windowSeconds: 24 * 60 * 60 }),

  /**
   * Story 2.27 (ADR-0073) — conservative outbound rate-limit for replies.
   * Falls back to `getRateLimitConfig()` if this connector were not to set it.
   * This is the same flat placeholder used for ingestion until a real per-Page
   * dynamic shape is designed.
   */
  getOutboundRateLimitConfig: () => ({ requestsPerWindow: 200, windowSeconds: 24 * 60 * 60 }),

  reply: replyToFacebookPost,

  /**
   * Story 2.29 (ADR-0075) — optional outbound post publishing. This is the
   * first real `SocialConnector.publish()` implementation, gated on the same
   * Page credential `reply()` uses.
   */
  publish: publishToFacebookPage,

  normalize: (rawItem) => {
    const post = rawItem as FacebookPagePost & { pageId: string };
    return {
      externalId: post.id,
      authorExternalId: post.pageId,
      publishedAt: post.created_time,
      rawPayload: post,
    };
  },

  // ADR-0059 Decision §1/§6 — no native search/query surface exists on
  // Facebook's current Graph API (the load-bearing finding this ADR's own
  // feasibility research made) — declared empty, matching, watchlist
  // matching falls back to whole-post-fetch matching, the same fallback
  // every connector to date uses for anything unsupported.
  supportedQueryFeatures: [],

  getCapabilities: () => ({
    sourceType: 'social',
    poll: { cadenceMs: 30 * 60 * 1000, supportsTimeWindow: true },
    publish: { supportsScheduling: true, supportedAssetTypes: ['text', 'image', 'video'] },
    reply: true,
    backfill: { supportsHistorical: true, maxLookbackDays: 90 },
  }),
};
