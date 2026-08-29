import { SocialConnector, NormalizedPost } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { acquire, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { htmlToMarkdown } from '../../content/htmlToMarkdown';

export const BRAVE_SEARCH_PROVIDER_ID = 'brave-search';

const BRAVE_NEWS_SEARCH_URL = 'https://api.search.brave.com/res/v1/news/search';
const BRAVE_WEB_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

export interface BraveSearchResultItem {
  url: string;
  title: string;
  description?: string;
  age?: string;
  published?: string;
  page_age?: string;
  meta_url?: {
    scheme?: string;
    netloc?: string;
    hostname?: string;
    favicon?: string;
    path?: string;
  };
  extra_snippets?: string[];
}

export interface BraveSearchResponse {
  results?: BraveSearchResultItem[];
}

/**
 * Strips tracking parameters (utm_*, gclid, fbclid, etc.) and fragments from URLs.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'ref'];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Extracts normalized base domain from URL (e.g. 'technologyreview.com', 'news.ycombinator.com').
 */
export function extractDomainFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'unknown-source';
  }
}

/**
 * Parses publication date string or falls back to current time.
 */
export function parsePublicationDate(item: BraveSearchResultItem): string {
  const candidate = item.published || item.page_age || item.age;
  if (candidate) {
    const date = new Date(candidate);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Brave Search SocialConnector definition (ADR-0065, Story 2.21).
 */
export const braveSearchConnector: SocialConnector = {
  providerId: BRAVE_SEARCH_PROVIDER_ID,
  authMode: 'api_key',
  deliveryMode: 'poll',
  sourceType: 'news',

  getRateLimitConfig: () => ({
    // 2,000 requests/month on typical tier, paced at 1 req/sec in scheduler
    requestsPerWindow: 2000,
    windowSeconds: 30 * 86400,
  }),

  normalize: (rawItem: unknown): NormalizedPost => {
    const item = rawItem as BraveSearchResultItem;
    const canonicalUrl = canonicalizeUrl(item.url);
    const domain = extractDomainFromUrl(item.url);

    return {
      externalId: canonicalUrl,
      authorExternalId: `${BRAVE_SEARCH_PROVIDER_ID}:${domain}`,
      publishedAt: parsePublicationDate(item),
      rawPayload: item,
    };
  },

  supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM'],
};

/**
 * Calls Brave Search API endpoint, reclassifying network and HTTP status codes into ClassifiableError.
 */
export async function fetchBraveSearch(
  query: string,
  apiKey: string,
  endpoint: 'news' | 'web' = 'news',
  freshness?: string,
  count?: number
): Promise<BraveSearchResultItem[]> {
  const baseUrl = endpoint === 'web' ? BRAVE_WEB_SEARCH_URL : BRAVE_NEWS_SEARCH_URL;
  const searchParams = new URLSearchParams({ q: query });
  if (freshness) {
    searchParams.set('freshness', freshness);
  }
  if (count !== undefined) {
    searchParams.set('count', String(count));
  }

  const url = `${baseUrl}?${searchParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Brave Search API: ${(err as Error).message}`);
  }

  if (response.status === 401) {
    throw new ClassifiableError('http_401', 'Brave Search returned 401 (invalid subscription token)');
  }
  if (response.status === 403) {
    throw new ClassifiableError('http_403', 'Brave Search returned 403 (forbidden/unsubscribed endpoint)');
  }
  if (response.status === 429) {
    throw new ClassifiableError('rate_limit', 'Brave Search returned 429 (rate limit / quota exceeded)');
  }
  if (response.status >= 500) {
    throw new ClassifiableError('http_5xx', `Brave Search returned ${response.status}`);
  }
  if (!response.ok) {
    throw new ClassifiableError('network', `Brave Search returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as BraveSearchResponse;
  return data.results ?? [];
}

export interface ResearchSearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

/**
 * Story 2.31 (ADR-0076) — one-off web search helper for composer Deep Research.
 * Reuses the tenant credential and the existing fetch; does not persist posts.
 */
export async function searchForResearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<ResearchSearchResult[]> {
  const credentialId = await getLatestCredentialId(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant');
  if (!credentialId) {
    throw new ClassifiableError('http_401', `No Brave Search credential registered for tenant ${tenantId}`);
  }
  const apiKey = await readCredential(tenantId, credentialId);

  try {
    await acquire(`${tenantId}:${BRAVE_SEARCH_PROVIDER_ID}:research`, braveSearchConnector.getRateLimitConfig());
  } catch (err) {
    if (err instanceof QueueTtlExceededError) {
      throw new ClassifiableError('queue_ttl_exceeded', err.message);
    }
    if (err instanceof QueueDepthExceededError) {
      throw new ClassifiableError('queue_depth_exceeded', err.message);
    }
    throw err;
  }

  const rawResults = await fetchBraveSearch(query, apiKey, 'web', undefined, limit);
  return rawResults.slice(0, limit).map((item) => ({
    title: item.title,
    url: canonicalizeUrl(item.url),
    snippet: htmlToMarkdown(item.description ?? item.title),
    provider: BRAVE_SEARCH_PROVIDER_ID,
  }));
}
