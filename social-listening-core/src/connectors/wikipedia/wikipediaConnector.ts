import { SocialConnector } from '../types';
import { ClassifiableError } from '../../ingestion/errorClassification';

export const WIKIPEDIA_PROVIDER_ID = 'wikipedia';

const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

/**
 * ADR-0042 Decision §1 — the Foundation's own User-Agent Policy
 * (foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:User-Agent_policy,
 * verified directly at drafting time) requires a client-identifying header
 * with contact information; non-compliant requests "may be blocked without
 * notice." A connector-operational configuration constant, not a per-tenant
 * credential — see this connector's own SKILL.md "Relation to ADR-0027."
 */
export const WIKIPEDIA_USER_AGENT = 'SocialEngage/1.0 (https://socialengage.example; contact@socialengage.example)';

export interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
}

export interface WikipediaRecentChange {
  pageid: number;
  title: string;
  revid: number;
  old_revid: number;
  timestamp: string;
}

/** One fully-fetched, ready-to-ingest revision — the shape normalize()/ingestion actually consumes. */
export interface WikipediaRevision {
  pageid: number;
  title: string;
  revid: number;
  timestamp: string;
  html: string;
  url: string;
}

interface MediaWikiErrorBody {
  error?: { code: string; info: string };
}

function classifyResponse(response: Response, context: string): void {
  if (response.status === 401) throw new ClassifiableError('http_401', `Wikipedia returned 401 (${context})`);
  if (response.status === 403) throw new ClassifiableError('http_403', `Wikipedia returned 403 (${context}) — see Wikimedia's own User-Agent Policy`);
  if (response.status === 429) throw new ClassifiableError('rate_limit', `Wikipedia returned 429 (${context})`);
  if (response.status >= 500) throw new ClassifiableError('http_5xx', `Wikipedia returned ${response.status} (${context})`);
  if (!response.ok) throw new ClassifiableError('network', `Wikipedia returned ${response.status} (${context})`);
}

async function mediaWikiFetch(params: Record<string, string>, context: string): Promise<Record<string, unknown>> {
  const url = `${WIKIPEDIA_API_URL}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': WIKIPEDIA_USER_AGENT } });
  } catch (err) {
    throw new ClassifiableError('network', `Failed to reach Wikipedia (${context}): ${(err as Error).message}`);
  }

  classifyResponse(response, context);

  const body = (await response.json()) as MediaWikiErrorBody;
  // MediaWiki's own convention (verified directly): a missing page or a
  // malformed query returns a real HTTP 200 with a JSON { error: {...} }
  // body, never a 4xx — must be checked explicitly, classifyResponse()
  // above can't see it.
  if (body.error) {
    throw new ClassifiableError('network', `Wikipedia API error (${context}): ${body.error.code} — ${body.error.info}`);
  }
  return body as Record<string, unknown>;
}

/**
 * ADR-0042 Decision §5 — article discovery. MediaWiki's CirrusSearch-backed
 * `list=search` endpoint, verified directly against the real, live API.
 */
export async function fetchWikipediaSearch(query: string, limit = 10): Promise<WikipediaSearchResult[]> {
  const body = await mediaWikiFetch({ action: 'query', list: 'search', srsearch: query, srlimit: String(limit) }, 'search');
  const query_ = (body.query as { search?: WikipediaSearchResult[] } | undefined)?.search;
  return Array.isArray(query_) ? query_ : [];
}

/**
 * ADR-0042 Decision §2 — the native "what changed since I last checked"
 * polling primitive, filtered to one already-tracked article by title
 * (`rctitle`, verified directly against the real, live API). `rclimit` is a
 * real, conservative implementation-time volume cap (ADR-0042's own named
 * "materiality/volume, left to implementation time" open question) — an
 * actively-edited article can have many qualifying revisions; this bounds
 * how many a single poll cycle re-ingests.
 */
export async function fetchWikipediaRecentChanges(title: string, limit = 10): Promise<WikipediaRecentChange[]> {
  const body = await mediaWikiFetch(
    { action: 'query', list: 'recentchanges', rctitle: title, rcprop: 'title|ids|timestamp', rclimit: String(limit) },
    'recentchanges'
  );
  const changes = (body.query as { recentchanges?: WikipediaRecentChange[] } | undefined)?.recentchanges;
  return Array.isArray(changes) ? changes : [];
}

/**
 * Fetches one specific revision's rendered content via `action=parse`
 * (verified directly against the real, live API — both the latest-revision
 * shape, `page=`, and the specific-historical-revision shape, `oldid=`).
 * Reused for both first-discovery ingestion (no `revid`, latest content)
 * and repoll ingestion (an explicit `revid` from `fetchWikipediaRecentChanges()`).
 * `SocialPost.url` (ADR-0042 Decision §4, the Foundation's own stated
 * attribution mechanism) is set here from the resolved `pageid`/`title`/
 * `revid`, never the bare article URL.
 */
export async function fetchWikipediaRevision(title: string, revid?: number): Promise<WikipediaRevision> {
  const params: Record<string, string> = revid
    ? { action: 'parse', oldid: String(revid), prop: 'text|revid' }
    : { action: 'parse', page: title, prop: 'text|revid' };
  const body = await mediaWikiFetch(params, 'parse');
  const parse = body.parse as { title: string; pageid: number; revid: number; text: string };
  return {
    pageid: parse.pageid,
    title: parse.title,
    revid: parse.revid,
    timestamp: new Date().toISOString(),
    html: parse.text,
    url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(parse.title)}&oldid=${parse.revid}`,
  };
}

/**
 * ADR-0042 (Story 2.13) — Wikipedia connector: MediaWiki Action API
 * directly, `authMode: 'none'` (self-service, no account/key), article-as-
 * Author. See .claude/skills/wikipedia-connector/SKILL.md.
 */
export const wikipediaConnector: SocialConnector = {
  providerId: WIKIPEDIA_PROVIDER_ID,
  authMode: 'none',
  deliveryMode: 'poll',

  // ADR-0042 Decision §5/Open Questions — Wikimedia publishes a rate-limits
  // policy but this pass did not fetch it to an exact numeric ceiling (the
  // ADR's own explicit instruction: "do not invent a number, verify before
  // RequestGate is sized against it"). This is a conservative, explicitly-
  // labeled placeholder, the same honest treatment ADR-0024 gave Newswire's
  // own unpublished limit — not a confirmed Wikimedia figure.
  getRateLimitConfig: () => ({ requestsPerWindow: 60, windowSeconds: 60 }),

  normalize: (rawItem) => {
    const revision = rawItem as WikipediaRevision;
    return {
      externalId: String(revision.revid),
      authorExternalId: String(revision.pageid),
      publishedAt: revision.timestamp,
      rawPayload: revision,
    };
  },

  // ADR-0042 Decision §5 — CirrusSearch's exact native-query-parameter
  // surface through the standard action=query&list=search endpoint was not
  // confirmed to this project's own primary-source bar (ADR-0042's own
  // named Open Question). Declared conservatively empty, per the ADR's own
  // explicit instruction not to assume unverified operator support —
  // watchlist matching falls back to whole-article post-fetch matching,
  // the same fallback every connector to date uses for anything unsupported.
  supportedQueryFeatures: [],
};
