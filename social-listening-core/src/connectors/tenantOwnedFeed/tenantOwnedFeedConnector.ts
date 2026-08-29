import { SocialConnector } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { ParsedFeedItem, parseFeedItems } from './feedItemParser';

export const TENANT_OWNED_FEED_PROVIDER_ID = 'tenant-owned-feed';

/**
 * ADR-0050's own respectful-polling requirement (Decision, Implementation
 * defaults) — every outbound fetch of a tenant's own feed self-identifies,
 * the same discipline ADR-0024's SEC EDGAR research established.
 */
export const TENANT_OWNED_FEED_USER_AGENT =
  'SocialEngage-TenantOwnedFeedConnector/1.0 (+https://socialengage.example; respectful-polling)';

/**
 * Tenant-owned-domain RSS/content-feed connector (ADR-0050): the tenant's
 * own, DNS-TXT-verified domain's feed. `Author` represents the verified
 * domain itself (organization-as-Author, ADR-0004's now-generalized clause
 * per ADR-0050 Decision §4), never an individual — `normalize()` here
 * receives the activation's own verified domain alongside the raw item, not
 * a per-item author. See .claude/skills/tenant-owned-feed-connector/SKILL.md.
 */
export const tenantOwnedFeedConnector: SocialConnector = {
  providerId: TENANT_OWNED_FEED_PROVIDER_ID,
  authMode: 'none',
  deliveryMode: 'poll',
  sourceType: 'blog',

  // ADR-0050's own conservative fixed-window default: one poll per feed URL
  // per 30 minutes — no published rate limit exists for a tenant's own feed.
  getRateLimitConfig: () => ({ requestsPerWindow: 2, windowSeconds: 3600 }),

  normalize: (rawItem) => {
    const { item, verifiedDomain } = rawItem as { item: ParsedFeedItem; verifiedDomain: string };
    return {
      externalId: item.id,
      authorExternalId: verifiedDomain,
      publishedAt: new Date(item.publishedAt).toISOString(),
      rawPayload: item,
    };
  },

  // ADR-0050's own v1 scope: empty at launch — every watchlist query falls
  // back to whole-query post-fetch matching for this connector, same as
  // Newswire (Story 2.6).
  supportedQueryFeatures: [],
};

/**
 * Fetches and parses one tenant-owned feed, reclassifying network/HTTP
 * failures into ClassifiableError so runIngestionAttempt() can retry/dead-
 * letter them (ADR-0010) the same way any other connector's attempt() would.
 * Sets a self-identifying User-Agent on every request (ADR-0050's own
 * respectful-polling requirement).
 */
export async function fetchTenantOwnedFeed(feedUrl: string): Promise<ParsedFeedItem[]> {
  let response: Response;
  try {
    response = await fetch(feedUrl, { headers: { 'User-Agent': TENANT_OWNED_FEED_USER_AGENT } });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach ${feedUrl}: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new ClassifiableError('http_401', `${feedUrl} returned 401`);
  if (response.status === 403) throw new ClassifiableError('http_403', `${feedUrl} returned 403`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `${feedUrl} returned ${response.status}`);
  if (!response.ok) throw new ClassifiableError('network', `${feedUrl} returned ${response.status}`);

  const xml = await response.text();
  return parseFeedItems(xml);
}
