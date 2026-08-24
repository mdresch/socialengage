import { SocialConnector, ConnectorContext, ConnectorCountResult, TimeWindow, WatchlistAST } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';
import { AstNode } from '../../watchlists/ast';
import { getLatestCredentialId, readCredential } from '../../credentials/credentialStore';
import { acquireForProvider, QueueTtlExceededError, QueueDepthExceededError } from '../requestGate';

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
 * Story 3.10 (ADR-0053 Decision §5), confirmed 2026-08-17 against a real,
 * live GNews response (Open Question 11, previously unconfirmed — no
 * credential was available at drafting time): the real marker has no `+`
 * sign — `"... [1966 chars]"`, not `"[+1966 chars]"` as originally assumed
 * from commonly-reported (but unverified) GNews behavior. The `+` is kept
 * optional here rather than removed outright, defensively, in case GNews
 * varies the format across plans/responses — either shape strips cleanly.
 */
const GNEWS_TRUNCATION_MARKER_RE = /\s*\[\+?\d+(?:,\d+)? chars\]$/;

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

  // Story 9.1 (ADR-0077 §1) — GNews's Search response carries a
  // `totalArticles` total-results field, so this connector implements
  // `count?()` returning `confidence: 'exact'`. Resolves the tenant's own
  // stored API key (ADR-0027) and gates through the shared `RequestGate`
  // before delegating to `countGNewsSearch()`, the same credential + gate
  // discipline `pollGNewsSearch()` already established.
  count: async (ctx: ConnectorContext, args: { ast: WatchlistAST; timeWindow: TimeWindow }): Promise<ConnectorCountResult> => {
    const credentialId = await getLatestCredentialId(ctx.tenantId, GNEWS_PROVIDER_ID, 'tenant');
    if (!credentialId) {
      throw new ClassifiableError('http_401', `No GNews credential registered for tenant ${ctx.tenantId}`);
    }
    const apiKey = await readCredential(ctx.tenantId, credentialId);
    try {
      await acquireForProvider(ctx.tenantId, gnewsConnector);
    } catch (err) {
      if (err instanceof QueueTtlExceededError) throw new ClassifiableError('queue_ttl_exceeded', err.message);
      if (err instanceof QueueDepthExceededError) throw new ClassifiableError('queue_depth_exceeded', err.message);
      throw err;
    }
    return countGNewsSearch(astToGNewsQuery(args.ast), apiKey);
  },
};

/**
 * Story 9.1 (ADR-0077 §1) — serializes a WatchlistAST into GNews's own
 * q-parameter boolean syntax (AND/OR/NOT + bare terms), the same native
 * capability `supportedQueryFeatures` declares above. HASHTAG/ACCOUNT leaves
 * serialize as their bare value defensively, but the preview controller's
 * `astCapabilityCheck` already routes a query using them to the
 * `unsupported_query` warning before this is reached for a real GNews count.
 */
export function astToGNewsQuery(ast: AstNode): string {
  switch (ast.type) {
    case 'AND':
      return `${astToGNewsQuery(ast.left)} AND ${astToGNewsQuery(ast.right)}`;
    case 'OR':
      return `${astToGNewsQuery(ast.left)} OR ${astToGNewsQuery(ast.right)}`;
    case 'NOT':
      return `NOT ${astToGNewsQuery(ast.operand)}`;
    case 'HASHTAG':
    case 'ACCOUNT':
      return ast.value;
    case 'TERM':
      return ast.value;
  }
}

/**
 * Story 9.1 (ADR-0077 §1) — reads GNews's `totalArticles` total-results field
 * for a query and returns a `ConnectorCountResult` with `confidence: 'exact'`.
 * Exported separately from the connector's `count?()` so the total-results
 * path is verifiable against a mocked fetch without a live API key or Key
 * Vault credential round-trip — the connector's own `count?()` resolves the
 * tenant credential and gates the call, then delegates here.
 */
export async function countGNewsSearch(query: string, apiKey: string): Promise<ConnectorCountResult> {
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
  return {
    count: body.totalArticles ?? 0,
    confidence: 'exact',
    rateLimitCost: 1,
  };
}

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
