import { SocialConnector } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';

export const GNEWS_PROVIDER_ID = 'gnews';

const GNEWS_SEARCH_URL = 'https://gnews.io/api/v4/search';

/** docs.gnews.io/json-response — no author/byline field of any kind, only source (ADR-0026). */
export interface GNewsArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  lang: string;
  source: { id: string; name: string; url: string; country: string };
}

interface GNewsSearchResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

/**
 * Story 3.10 (ADR-0053 Decision §5) — GNews's free-tier content truncation
 * appends a literal marker (commonly "[+N chars]") to the plain-text
 * `content` value itself. A best-current-understanding pattern, not
 * confirmed against a real truncated response (ADR-0053 Open Question 11)
 * — revisit if a real GNews credential ever surfaces a differently-shaped
 * marker.
 */
const GNEWS_TRUNCATION_MARKER_RE = /\s*\[\+\d+(?:,\d+)? chars\]$/;

/** Strips GNews's own free-tier truncation marker from `content`, if present, before it reaches htmlToMarkdown(). */
export function stripGNewsTruncationMarker(content: string): string {
  return content.replace(GNEWS_TRUNCATION_MARKER_RE, '');
}

/**
 * GNews connector (ADR-0026): general-news search API, publication-as-Author.
 * See .claude/skills/gnews-connector/SKILL.md.
 */
export const gnewsConnector: SocialConnector = {
  providerId: GNEWS_PROVIDER_ID,
  authMode: 'api_key',
  deliveryMode: 'poll',

  // 100 requests/day, 10 articles/request — a real, published, confirmed
  // ceiling (ADR-0026's Implementation defaults), unlike Newswire's
  // unconfirmed placeholder.
  getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 86400 }),

  normalize: (rawItem) => {
    const article = rawItem as GNewsArticle;
    return {
      externalId: article.id,
      authorExternalId: article.source.id || article.source.name,
      publishedAt: article.publishedAt,
      rawPayload: article,
    };
  },

  // AND/OR/NOT/TERM map directly onto GNews's native q-parameter boolean
  // syntax (ADR-0026's Decision) — a materially richer native capability
  // than Newswire's empty declaration. HASHTAG/ACCOUNT have no GNews
  // equivalent (general news search, not a social platform with hashtags
  // or @mentions), so a watchlist using either degrades the whole query to
  // fallback (ADR-0021's whole-query-degradation rule) — not a partial gap.
  supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM'],
};

/**
 * Calls GNews's real Search endpoint, reclassifying network/HTTP failures
 * into ClassifiableError so runIngestionAttempt() can retry/dead-letter them
 * (ADR-0010) the same way any other connector's attempt() would.
 */
export async function fetchGNewsSearch(query: string, apiKey: string): Promise<GNewsArticle[]> {
  const url = `${GNEWS_SEARCH_URL}?q=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach GNews: ${(err as Error).message}`);
  }

  if (response.status === 401) throw new ClassifiableError('http_401', 'GNews returned 401 (invalid API key)');
  if (response.status === 403) throw new ClassifiableError('http_403', 'GNews returned 403');
  if (response.status === 429) throw new ClassifiableError('rate_limit', 'GNews returned 429 (rate limit exceeded)');
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `GNews returned ${response.status}`);
  if (!response.ok) throw new ClassifiableError('network', `GNews returned ${response.status}`);

  const body = (await response.json()) as GNewsSearchResponse;
  return body.articles;
}
