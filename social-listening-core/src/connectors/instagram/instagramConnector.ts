import { SocialConnector } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { htmlToMarkdown } from '../../content/htmlToMarkdown';

export const INSTAGRAM_PROVIDER_ID = 'instagram';

/**
 * Meta Graph API version for Instagram Graph API.
 * Confirmed stable against v21.0 per ADR-0068 Decision §1.
 */
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramChildMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url?: string;
  thumbnail_url?: string;
}

export interface InstagramMediaLocation {
  id?: string;
  name?: string;
  country?: string;
  city?: string;
  street?: string;
  zip?: string;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: InstagramMediaType;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: InstagramChildMedia[] };
  location?: InstagramMediaLocation;
}

export interface InstagramMediaResponse {
  data: InstagramMediaItem[];
  paging?: {
    cursors?: {
      after?: string;
      before?: string;
    };
    next?: string;
  };
}

export interface InstagramAccountMetadata {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

export interface InstagramCredential {
  igUserId: string;
  pageAccessToken: string;
  username: string;
  pageId?: string;
  pageName?: string;
}

/**
 * ADR-0068 Decision §2 — the stored credential is a JSON string
 * {igUserId, pageAccessToken, username, pageId, pageName}.
 */
export function parseInstagramCredential(credential: string): InstagramCredential {
  let parsed: Partial<InstagramCredential>;
  try {
    parsed = JSON.parse(credential) as Partial<InstagramCredential>;
  } catch {
    throw new ClassifiableError(
      'http_401',
      'Instagram credential is not valid JSON (expected {igUserId, pageAccessToken, username}).'
    );
  }
  if (!parsed.igUserId || !parsed.pageAccessToken) {
    throw new ClassifiableError('http_401', 'Instagram credential is missing igUserId or pageAccessToken.');
  }
  return parsed as InstagramCredential;
}

interface GraphApiErrorBody {
  error?: {
    code: number;
    subcode?: number;
    type: string;
    message: string;
  };
}

function classifyResponse(response: Response, context: string): void {
  if (response.status === 401) throw new ClassifiableError('http_401', `Instagram returned 401 (${context})`);
  if (response.status === 403) throw new ClassifiableError('http_403', `Instagram returned 403 (${context})`);
  if (response.status === 429) throw new ClassifiableError('rate_limit', `Instagram returned 429 (${context})`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Instagram returned ${response.status} (${context})`);
  if (!response.ok) throw new ClassifiableError('network', `Instagram returned ${response.status} (${context})`);
}

/**
 * Graph API error classification per ADR-0068 Decision §2:
 * - Error 190: Invalid/expired token -> http_401 / reconnect_required
 * - Error 10: Permission revoked / disabled -> http_401 / reconnect_required
 * - Error 100: Invalid param / unlinked account -> http_401 / reconnect_required
 * - Error 4 or 17: Application/User rate limit -> rate_limit
 */
async function graphApiFetch(url: string, context: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Instagram Graph API (${context}): ${(err as Error).message}`);
  }

  classifyResponse(response, context);

  const body = (await response.json()) as GraphApiErrorBody;
  if (body.error) {
    const code = body.error.code;
    if (code === 190 || code === 10 || code === 100) {
      throw new ClassifiableError('http_401', `Instagram API auth error ${code} (${context}): ${body.error.type} — ${body.error.message}`);
    }
    if (code === 4 || code === 17) {
      throw new ClassifiableError('rate_limit', `Instagram API rate limit error ${code} (${context}): ${body.error.type} — ${body.error.message}`);
    }
    throw new ClassifiableError('network', `Instagram API error (${context}): ${body.error.type} — ${body.error.message}`);
  }
  return body as Record<string, unknown>;
}

/**
 * Fetches published media for an Instagram Business/Creator account.
 * Requests fields per ADR-0068: id, caption, media_type, media_url, thumbnail_url,
 * permalink, timestamp, username, like_count, comments_count, children{id,media_type,media_url,thumbnail_url}, location.
 */
export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  options?: { limit?: number; after?: string }
): Promise<InstagramMediaResponse> {
  const limit = Math.min(options?.limit ?? 25, 50);
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count,children{id,media_type,media_url,thumbnail_url},location';
  let url = `${GRAPH_API_BASE}/${encodeURIComponent(igUserId)}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
  if (options?.after) {
    url += `&after=${encodeURIComponent(options.after)}`;
  }

  const body = await graphApiFetch(url, 'media');
  const data = (body as { data?: InstagramMediaItem[]; paging?: InstagramMediaResponse['paging'] }).data;
  return {
    data: Array.isArray(data) ? data : [],
    paging: (body as { paging?: InstagramMediaResponse['paging'] }).paging,
  };
}

/**
 * Fetches profile metadata for an Instagram Business/Creator account (followers count, display name).
 */
export async function fetchInstagramAccountMetadata(
  igUserId: string,
  accessToken: string
): Promise<InstagramAccountMetadata> {
  const url = `${GRAPH_API_BASE}/${encodeURIComponent(igUserId)}?fields=id,username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(accessToken)}`;
  const body = await graphApiFetch(url, 'account metadata');
  return body as unknown as InstagramAccountMetadata;
}

/**
 * Converts Instagram caption to canonical markdown.
 * Fallback to deterministic media type summary if empty per ADR-0068 §4.C.
 */
export function captionToMarkdown(caption?: string, mediaType?: InstagramMediaType): string {
  if (caption && caption.trim().length > 0) {
    return htmlToMarkdown(caption.trim());
  }
  switch (mediaType) {
    case 'CAROUSEL_ALBUM':
      return '[Instagram Carousel]';
    case 'VIDEO':
      return '[Instagram Video]';
    case 'IMAGE':
    default:
      return '[Instagram Photo]';
  }
}

/**
 * ADR-0068 (Story 2.24) — Instagram Business connector.
 * Registered as a Tier-3 user-bound connector with `pollUser` in bootstrapConnectors.ts.
 */
export const instagramConnector: SocialConnector = {
  providerId: INSTAGRAM_PROVIDER_ID,
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig: () => ({ requestsPerWindow: 200, windowSeconds: 24 * 60 * 60 }),

  normalize: (rawItem) => {
    const item = rawItem as InstagramMediaItem & { igUserId: string };
    return {
      externalId: `instagram_${item.igUserId}_${item.id}`,
      authorExternalId: `instagram:${item.igUserId}`,
      publishedAt: item.timestamp,
      rawPayload: item,
    };
  },

  supportedQueryFeatures: [],
};
