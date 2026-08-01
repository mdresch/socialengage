// Contract: Story 2.7 (ADR-0026) — RSS/News connector: GNews API, publication-as-Author.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-27--rssnews-connector-gnews-api-publication-as-author
//
// Intent: Story 2.7 — RSS/News connector: GNews API, publication-as-Author (ADR-0026)
// Scope: src/connectors/gnews/gnewsConnector.ts (new), src/connectors/gnews/pollGNewsSearch.ts
// (new), src/credentials/credentialStore.ts (getLatestCredentialId, a new tenant+platform
// credential lookup reader alongside its existing storeCredential/readCredential — this
// story's first real caller of a tenant-supplied, not connector-embedded, credential).
// Contract to encode: (1) a registered SocialConnector (authMode: 'api_key', deliveryMode:
// 'poll', a providerId distinct from Newswire's) authenticates using a per-tenant-stored
// GNews API key (ADR-0014's existing envelope-encrypted credential model) and polls GNews's
// real /api/v4/search endpoint via runIngestionAttempt() — proven against genuinely live
// results, not a synthetic fixture, same bar as Story 2.6; (2) each normalized post's Author
// resolves to the article's source publication (externalAuthorId = source.id, or source.name
// when id is absent; followerCount unpopulated); (3) supportedQueryFeatures is declared
// accurately (AND/OR/NOT/TERM — GNews's real native q-parameter capability, richer than
// Newswire's empty declaration) and watchlist matching genuinely falls back for node types
// GNews can't express (HASHTAG/ACCOUNT), proven against real fetched titles; (4) polling
// respects GNews's real, published, confirmed rate limit (100 requests/day, 10 articles/
// request — unlike Newswire's unconfirmed placeholder), and re-polling with no new articles
// since the last checkpoint is a correct no-op (no duplicate SocialPost rows) across two
// consecutive poll cycles.
// Explicitly out of scope: an admin-UI credential-connect flow (no such UI exists yet,
// Phase 1's "also build, not storied" scope); translateWatchlistQuery() / pushing a
// watchlist's query down as GNews's own q param (not exercised by any real connector yet,
// same accepted gap as Newswire — resolveWatchlistAstDispatch()/matchPostsForWatchlistAst()
// are proven correct independently, per ADR-0021's existing design, not wired into this
// connector's own attempt()); cross-publication de-duplication (GNews may index the same
// wire story from multiple outlets — an implementation-time decision per ADR-0026, not
// resolved here, same treatment as Newswire's cross-wire duplicates); a persisted Watchlist
// or real query-selection UI (no Watchlist table/CRUD exists anywhere yet) — this story
// hardcodes one representative query, mirroring Story 2.6's one-feed-per-wire default.
//
// Requires a real GNEWS_API_KEY environment variable (see .env.example — sign up free at
// gnews.io, no card required, per ADR-0026's own verification) loaded via dotenv in
// jest.global-setup.js, and a real Azure Key Vault reachable via `az login`, same as Story
// 5.3's credential contract. Like Story 2.6, this makes real outbound HTTP calls to GNews's
// own live Search endpoint — its content assertions tolerate live results changing between
// runs (deriving expectations from whatever was actually fetched, not a hardcoded article).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import { gnewsConnector, GNEWS_PROVIDER_ID, GNewsArticle } from '../../src/connectors/gnews/gnewsConnector';
import { pollGNewsSearch } from '../../src/connectors/gnews/pollGNewsSearch';
import { fetchGNewsSearch } from '../../src/connectors/gnews/gnewsConnector';
import { ClassifiableError } from '../../src/ingestion/errorClassification';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { resolveWatchlistAstDispatch, matchPostsForWatchlistAst } from '../../src/watchlists/dispatch';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import { MatchablePost } from '../../src/watchlists/matcher';

jest.setTimeout(60000);

const DEFAULT_TEST_QUERY = 'technology';

if (!process.env.GNEWS_API_KEY) {
  throw new Error(
    'GNEWS_API_KEY is not set. Copy .env.example to .env in social-listening-core/ and set a ' +
      'real free GNews API key (gnews.io, no card required) — see ADR-0026.'
  );
}
const REAL_GNEWS_API_KEY = process.env.GNEWS_API_KEY;

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
});

afterAll(async () => {
  const poller = await getKeyClient().beginDeleteKey(testKeyName);
  await poller.pollUntilDone();
  await closePool();
});

async function registerGNewsCredential(tenantId: string): Promise<void> {
  await storeCredential(tenantId, GNEWS_PROVIDER_ID, REAL_GNEWS_API_KEY, testKeyId);
}

/**
 * fetchGNewsSearch() called directly (not through pollGNewsSearch() /
 * runIngestionAttempt()) skips the shared retry-with-backoff path every real
 * poll cycle gets for a 'rate_limit'-classified error. AC3 needs raw
 * articles (not just ingestion counts) to build its dispatch/matching
 * fixture, so it can't reuse pollGNewsSearch()'s return shape — this gives
 * it the same resilience against GNews's real, observed short-lived burst
 * guard (confirmed transient: an identical manual call succeeded moments
 * after a 429, at 5 of 100 daily requests used — not quota exhaustion)
 * without changing anything AC3 actually asserts.
 */
async function fetchGNewsSearchWithRetry(query: string, apiKey: string, maxAttempts = 3): Promise<GNewsArticle[]> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchGNewsSearch(query, apiKey);
    } catch (err) {
      const isRateLimit = err instanceof ClassifiableError && err.kind === 'rate_limit';
      if (!isRateLimit || attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}

async function countSocialPosts(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM social_posts`);
    return rows[0].c;
  });
}

describe('Story 2.7 — GNews connector contract', () => {
  beforeAll(() => {
    __resetRegistryForTests();
    registerSocialConnector(gnewsConnector);
  });

  it('AC1: a registered connector (authMode api_key, poll, distinct providerId) authenticates with a per-tenant credential and ingests real GNews results via runIngestionAttempt()', async () => {
    expect(getSocialConnector(GNEWS_PROVIDER_ID)).toBe(gnewsConnector);
    expect(gnewsConnector.authMode).toBe('api_key');
    expect(gnewsConnector.deliveryMode).toBe('poll');
    expect(gnewsConnector.providerId).not.toBe('newswire');

    const tenantId = randomUUID();
    await registerGNewsCredential(tenantId);

    const result = await pollGNewsSearch(tenantId, DEFAULT_TEST_QUERY);
    expect(result.status).toBe('succeeded');

    const rows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ raw_payload: GNewsArticle }>(`SELECT raw_payload FROM social_posts`);
      return rows;
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.raw_payload.title).toBe('string');
      expect(row.raw_payload.url).toMatch(/^https?:\/\//);
    }
  });

  it("AC2: each post's Author resolves to the article's source publication, not an individual journalist", async () => {
    const tenantId = randomUUID();
    await registerGNewsCredential(tenantId);

    const result = await pollGNewsSearch(tenantId, DEFAULT_TEST_QUERY);
    expect(result.status).toBe('succeeded');

    const authorRows = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<{ external_author_id: string; follower_count: number | null }>(
        `SELECT external_author_id, follower_count FROM authors WHERE platform_id = $1`,
        [GNEWS_PROVIDER_ID]
      );
      return rows;
    });

    expect(authorRows.length).toBeGreaterThan(0);
    for (const row of authorRows) {
      expect(row.external_author_id.length).toBeGreaterThan(0);
      expect(row.follower_count).toBeNull();
    }
  });

  it('AC3: supportedQueryFeatures is declared as AND/OR/NOT/TERM, and watchlist matching genuinely falls back for node types GNews can\'t express', async () => {
    expect(gnewsConnector.supportedQueryFeatures).toEqual(['AND', 'OR', 'NOT', 'TERM']);

    const articles = await fetchGNewsSearchWithRetry(DEFAULT_TEST_QUERY, REAL_GNEWS_API_KEY);
    expect(articles.length).toBeGreaterThan(0);

    // A term-only AST is fully within GNews's declared capability -> native.
    // Native mode presumes the platform already filtered server-side, so
    // matchPostsForWatchlistAst() must return the real fetched batch
    // completely unchanged, not merely non-empty.
    const termAst = parseBooleanQuery(DEFAULT_TEST_QUERY);
    const termDispatch = resolveWatchlistAstDispatch(gnewsConnector, termAst);
    expect(termDispatch.mode).toBe('native');
    expect(termDispatch.unsupportedNodeTypes).toEqual([]);

    const realPosts: MatchablePost[] = articles.map((article: GNewsArticle, i: number) => ({ id: String(i), text: article.title }));
    expect(matchPostsForWatchlistAst(termDispatch, termAst, realPosts)).toEqual(realPosts);

    // A hashtag has no GNews equivalent (general news search, not a social
    // platform) -> the whole query degrades to fallback (ADR-0021). Proving
    // fallback genuinely filters (not a silent pass-through) needs a
    // controlled fixture here, not live content: real article titles never
    // literally contain "#word", so a real-content proof can't distinguish
    // "filters correctly" from "passes everything through" for this specific
    // node type the way AC1/AC2/AC4's real HTTP calls already prove
    // connectivity — this is a targeted logic proof, not a live-data
    // requirement being skipped.
    const hashtagAst = parseBooleanQuery('#unsupportedbygnews');
    const hashtagDispatch = resolveWatchlistAstDispatch(gnewsConnector, hashtagAst);
    expect(hashtagDispatch.mode).toBe('fallback');
    expect(hashtagDispatch.unsupportedNodeTypes).toEqual(['HASHTAG']);

    const fixturePosts: MatchablePost[] = [
      { id: 'match', text: 'breaking news #unsupportedbygnews trending now' },
      { id: 'no-match', text: 'breaking news with no matching tag at all' },
    ];
    const fallbackMatched = matchPostsForWatchlistAst(hashtagDispatch, hashtagAst, fixturePosts);
    expect(fallbackMatched.map((p) => p.id)).toEqual(['match']);
  });

  it('AC4: rate limit config matches GNews\'s published free-tier ceiling, and re-polling with no new articles is a correct no-op across two consecutive cycles', async () => {
    expect(gnewsConnector.getRateLimitConfig()).toEqual({ requestsPerWindow: 100, windowSeconds: 86400 });

    const tenantId = randomUUID();
    await registerGNewsCredential(tenantId);

    const first = await pollGNewsSearch(tenantId, DEFAULT_TEST_QUERY);
    expect(first.status).toBe('succeeded');

    const countAfterFirst = await countSocialPosts(tenantId);
    expect(countAfterFirst).toBeGreaterThan(0);

    const second = await pollGNewsSearch(tenantId, DEFAULT_TEST_QUERY);
    expect(second.status).toBe('succeeded');

    const countAfterSecond = await countSocialPosts(tenantId);
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
