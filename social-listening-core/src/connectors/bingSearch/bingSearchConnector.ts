import { SocialConnector, NormalizedPost } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { acquire, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';
import { htmlToMarkdown } from '../../content/htmlToMarkdown';

export const BING_SEARCH_PROVIDER_ID = 'bing-search';

const BING_NEWS_SEARCH_URL = 'https://api.bing.microsoft.com/v7.0/news/search';
const BING_WEB_SEARCH_URL = 'https://api.bing.microsoft.com/v7.0/search';

/** Azure Grounding with Bing Search standard transaction price ($14.00 per 1,000 transactions). */
export const AZURE_SEARCH_COST_PER_TRANSACTION = 0.014;

export interface BingProviderItem {
  _type?: string;
  name?: string;
  image?: unknown;
}

export interface BingSearchItem {
  _type?: string;
  name: string;
  url: string;
  description?: string;
  snippet?: string;
  datePublished?: string;
  dateLastCrawled?: string;
  provider?: BingProviderItem[];
  language?: string;
  category?: string;
  about?: Array<{ name: string }>;
}

export interface BingNewsSearchResponse {
  _type?: string;
  readLink?: string;
  totalEstimatedMatches?: number;
  value?: BingSearchItem[];
}

export interface BingWebSearchResponse {
  _type?: string;
  webPages?: {
    totalEstimatedMatches?: number;
    value?: BingSearchItem[];
  };
}

/**
 * Strips tracking parameters (utm_*, gclid, fbclid, msclkid, ref, source, etc.),
 * lowercases scheme and hostname, strips standard www., and removes URL fragments.
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./i, '');
    parsed.hash = '';

    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'msclkid',
      'ref',
      'source',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Extracts normalized base domain from URL (e.g. 'reuters.com', 'techcrunch.com').
 */
export function extractDomainFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().replace(/^www\./i, '');
  } catch {
    return 'unknown-source';
  }
}

/**
 * Deterministically maps lookback window (in hours) to Bing's freshness parameter.
 * - Lookback <= 48h -> 'Day'
 * - Lookback 3 to 7 days (49h - 168h) -> 'Week'
 * - Lookback > 7 days (> 168h) -> 'Month'
 */
export function lookbackToFreshness(lookbackHours: number): 'Day' | 'Week' | 'Month' {
  if (lookbackHours <= 48) {
    return 'Day';
  }
  if (lookbackHours <= 168) {
    return 'Week';
  }
  return 'Month';
}

/**
 * Parses publication date from Bing search item or falls back to current time.
 */
export function parsePublicationDate(item: BingSearchItem): string {
  const candidate = item.datePublished || item.dateLastCrawled;
  if (candidate) {
    const date = new Date(candidate);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Calculates estimated Azure Cognitive Services / Grounding with Bing Search cost in USD.
 */
export function calculateAzureSearchCost(apiCalls: number): number {
  return Number((apiCalls * AZURE_SEARCH_COST_PER_TRANSACTION).toFixed(4));
}

/**
 * Bing Search SocialConnector definition (ADR-0066, Story 2.22).
 */
export const bingSearchConnector: SocialConnector = {
  providerId: BING_SEARCH_PROVIDER_ID,
  authMode: 'api_key',
  deliveryMode: 'poll',
  sourceType: 'news',

  getRateLimitConfig: () => ({
    // 150 transactions per second max, quota-safe 1-4 hour polling schedule
    requestsPerWindow: 5000,
    windowSeconds: 30 * 86400,
  }),

  normalize: (rawItem: unknown): NormalizedPost => {
    const item = rawItem as BingSearchItem;
    const canonicalUrl = canonicalizeUrl(item.url);
    const domain = extractDomainFromUrl(item.url);

    return {
      externalId: canonicalUrl,
      authorExternalId: `${BING_SEARCH_PROVIDER_ID}:${domain}`,
      publishedAt: parsePublicationDate(item),
      rawPayload: item,
    };
  },

  supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM'],
};

export interface FetchBingSearchOptions {
  endpoint?: 'news' | 'web';
  freshness?: 'Day' | 'Week' | 'Month' | string;
  mkt?: string;
  setLang?: string;
  count?: number;
  offset?: number;
}

/**
 * Calls Bing Search API endpoint via Azure AI Services, reclassifying network and HTTP status codes into ClassifiableError.
 */
export async function fetchBingSearch(
  query: string,
  apiKey: string,
  options: FetchBingSearchOptions = {}
): Promise<BingSearchItem[]> {
  const endpoint = options.endpoint ?? 'news';
  const baseUrl = endpoint === 'web' ? BING_WEB_SEARCH_URL : BING_NEWS_SEARCH_URL;

  const searchParams = new URLSearchParams({
    q: query,
    count: String(options.count ?? 25),
    mkt: options.mkt ?? 'en-US',
  });

  if (options.freshness) {
    searchParams.set('freshness', options.freshness);
  }
  if (options.setLang) {
    searchParams.set('setLang', options.setLang);
  }
  if (options.offset !== undefined && options.offset > 0) {
    searchParams.set('offset', String(options.offset));
  }

  const url = `${baseUrl}?${searchParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Bing Search API: ${(err as Error).message}`);
  }

  if (response.status === 401) {
    throw new ClassifiableError('http_401', 'Bing Search returned 401 (invalid or missing subscription key)');
  }
  if (response.status === 403) {
    throw new ClassifiableError('http_403', 'Bing Search returned 403 (forbidden / invalid subscription tier)');
  }
  if (response.status === 429) {
    throw new ClassifiableError('rate_limit', 'Bing Search returned 429 (rate limit or quota exceeded)');
  }
  if (response.status >= 500) {
    throw new ClassifiableError('http_5xx', `Bing Search returned HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new ClassifiableError('network', `Bing Search returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as BingNewsSearchResponse & BingWebSearchResponse;
  if (endpoint === 'web') {
    return data.webPages?.value ?? [];
  }
  return data.value ?? [];
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
  const credentialId = await getLatestCredentialId(tenantId, BING_SEARCH_PROVIDER_ID, 'tenant');
  if (!credentialId) {
    throw new ClassifiableError('http_401', `No Bing Search credential registered for tenant ${tenantId}`);
  }
  const apiKey = await readCredential(tenantId, credentialId);

  try {
    await acquire(`${tenantId}:${BING_SEARCH_PROVIDER_ID}:research`, bingSearchConnector.getRateLimitConfig());
  } catch (err) {
    if (err instanceof QueueTtlExceededError) {
      throw new ClassifiableError('queue_ttl_exceeded', err.message);
    }
    if (err instanceof QueueDepthExceededError) {
      throw new ClassifiableError('queue_depth_exceeded', err.message);
    }
    throw err;
  }

  const rawResults = await fetchBingSearch(query, apiKey, { endpoint: 'web', count: limit, mkt: 'en-US' });
  return rawResults.slice(0, limit).map((item) => ({
    title: item.name,
    url: canonicalizeUrl(item.url),
    snippet: htmlToMarkdown(item.snippet ?? item.description ?? item.name),
    provider: BING_SEARCH_PROVIDER_ID,
  }));
}
