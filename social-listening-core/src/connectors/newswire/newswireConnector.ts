import { SocialConnector } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { ParsedRssItem, parseRssItems } from './rssFeedParser';

export const NEWSWIRE_PROVIDER_ID = 'newswire';

/**
 * One representative feed per wire (ADR-0024: "feed subset to poll... is an
 * implementation-time choice tied to watchlist/tenant demand, not fixed by
 * this ADR"). Both verified live and open, no login, before this file was
 * written.
 */
export const DEFAULT_NEWSWIRE_FEED_URLS: string[] = [
  'https://www.globenewswire.com/RssFeed/industry/1-Energy/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Energy',
  'https://www.prnewswire.com/rss/news-releases-list.rss',
];

/**
 * Newswire connector (ADR-0024): GlobeNewswire + PR Newswire direct public
 * RSS, issuer-as-Author. See .claude/skills/newswire-connector/SKILL.md.
 */
export const newswireConnector: SocialConnector = {
  providerId: NEWSWIRE_PROVIDER_ID,
  authMode: 'none',
  deliveryMode: 'poll',

  // Conservative fixed-window placeholder — neither wire publishes a rate
  // limit for its public feeds (ADR-0024's Implementation defaults).
  getRateLimitConfig: () => ({ requestsPerWindow: 12, windowSeconds: 60 }),

  normalize: (rawItem) => {
    const item = rawItem as ParsedRssItem;
    return {
      externalId: item.guid,
      authorExternalId: item.issuer ?? 'unknown',
      publishedAt: new Date(item.pubDate).toISOString(),
      rawPayload: item,
    };
  },

  // Expected minimal-to-empty at launch (ADR-0024) — every watchlist query
  // falls back to whole-query post-fetch matching for this connector.
  supportedQueryFeatures: [],
};

/**
 * Fetches and parses one Newswire feed, reclassifying network/HTTP failures
 * into ClassifiableError so runIngestionAttempt() can retry/dead-letter them
 * (ADR-0010) the same way any other connector's attempt() would.
 */
export async function fetchNewswireFeed(feedUrl: string): Promise<ParsedRssItem[]> {
  let response: Response;
  try {
    response = await fetch(feedUrl);
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach ${feedUrl}: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new ClassifiableError('http_401', `${feedUrl} returned 401`);
  if (response.status === 403) throw new ClassifiableError('http_403', `${feedUrl} returned 403`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `${feedUrl} returned ${response.status}`);
  if (!response.ok) throw new ClassifiableError('network', `${feedUrl} returned ${response.status}`);

  const xml = await response.text();
  return parseRssItems(xml);
}
