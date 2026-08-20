// Contract: Story 2.21 (ADR-0065) — Active Watchlist Sourcing via Brave Search API:
// Polling connector, query transformation, and junction linking.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-221
//
// Intent: Story 2.21 — Brave Search polling connector for active watchlist topic discovery (ADR-0065)
// Scope: touches src/connectors/braveSearch/braveSearchConnector.ts,
// src/connectors/braveSearch/braveSearchQueryBuilder.ts,
// src/connectors/braveSearch/pollBraveSearch.ts,
// src/connectors/bootstrapConnectors.ts,
// .claude/skills/brave-search-connector/SKILL.md,
// contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts
// Contract to encode:
// - AC1: SocialConnector interface shape (providerId: 'brave-search', authMode: 'api_key', deliveryMode: 'poll', rateLimitConfig, registration)
// - AC2: Active watchlist querying & pacing loop (constructs query for keyword/hashtag/account OR-expressions and boolean_query AST; sequential 1.2s pacing delay between watchlist requests)
// - AC3: Dual discovery & in-process AST validation (only snippets matching exact watchlist rules are ingested, non-matching search results are filtered out)
// - AC4: Domain / Publication as Author mapping (authorExternalId: 'brave-search:' + domain, displayName: domain/source)
// - AC5: Canonical ingestion, deduplication on URL, and automatic post_watchlist_matches junction linking
// - AC6: Quota & Error handling (401/403 -> http_401/http_403 non-retryable; 429 -> rate_limit retryable; 5xx -> http_5xx retryable)
// Explicitly out of scope: Full-text scraping of external web pages; Admin UI setup screen (Story 6.30).

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import { withTenant } from '../../src/db/withTenant';
import { getSocialConnector, registerSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import {
  braveSearchConnector,
  BRAVE_SEARCH_PROVIDER_ID,
  fetchBraveSearch,
  BraveSearchResultItem,
  canonicalizeUrl,
  extractDomainFromUrl,
} from '../../src/connectors/braveSearch/braveSearchConnector';
import {
  buildBraveSearchQuery,
  validateCandidateMatch,
} from '../../src/connectors/braveSearch/braveSearchQueryBuilder';
import {
  pollBraveSearch,
  ingestBraveSearchResults,
  setPacingDelayForTests,
} from '../../src/connectors/braveSearch/pollBraveSearch';
import { startIngestionRun, completeIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { createWatchlist, Watchlist } from '../../src/watchlists/watchlistStore';
import { ClassifiableError } from '../../src/ingestion/errorClassification';

jest.setTimeout(60000);

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
  // Reduce pacing delay in tests from 1.2s to 1ms
  setPacingDelayForTests(1);
});

afterAll(async () => {
  setPacingDelayForTests(1200);
  try {
    const poller = await getKeyClient().beginDeleteKey(testKeyName);
    await poller.pollUntilDone();
  } catch {
    // best effort cleanup
  }
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const { rows: tenantRows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, 5) RETURNING id`,
    [`Brave Tenant ${randomUUID()}`]
  );
  const tenantId = tenantRows[0].id;

  const { rows: userRows } = await getAdminPool().query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_admin', 'active') RETURNING id`,
    [tenantId, `user-${randomUUID()}@example.com`]
  );
  const userId = userRows[0].id;

  return { tenantId, userId };
}

describe('Story 2.21 — Brave Search Active Watchlist Connector contract', () => {
  describe('AC1: Connector definition and registry metadata', () => {
    it('implements SocialConnector with providerId "brave-search", authMode "api_key", deliveryMode "poll"', () => {
      expect(braveSearchConnector.providerId).toBe('brave-search');
      expect(braveSearchConnector.authMode).toBe('api_key');
      expect(braveSearchConnector.deliveryMode).toBe('poll');
      expect(braveSearchConnector.supportedQueryFeatures).toEqual(
        expect.arrayContaining(['AND', 'OR', 'NOT', 'TERM'])
      );

      const rateLimit = braveSearchConnector.getRateLimitConfig();
      expect(rateLimit.requestsPerWindow).toBeGreaterThanOrEqual(1);
      expect(rateLimit.windowSeconds).toBeGreaterThan(0);
    });

    it('normalizes a BraveSearchResultItem into NormalizedPost with domain-derived author', () => {
      const item: BraveSearchResultItem = {
        url: 'https://www.technologyreview.com/2026/08/20/ai-agent-breakthrough?utm_source=feed',
        title: 'New AI Agent Breakthrough Announced',
        description: 'Researchers have published a new paradigm for agentic pair programming.',
        published: '2026-08-20T10:00:00Z',
      };

      const normalized = braveSearchConnector.normalize(item);
      expect(normalized.externalId).toBe('https://www.technologyreview.com/2026/08/20/ai-agent-breakthrough');
      expect(normalized.authorExternalId).toBe('brave-search:technologyreview.com');
      expect(normalized.publishedAt).toBe('2026-08-20T10:00:00.000Z');
      expect(normalized.rawPayload).toEqual(item);
    });
  });

  describe('AC2: Query construction from watchlists and URL canonicalisation', () => {
    it('constructs an OR-query for keyword watchlists with multiple terms', () => {
      const watchlist: Watchlist = {
        id: randomUUID(),
        name: 'AI Monitor',
        matchType: 'keyword',
        terms: ['artificial intelligence', 'machine learning', 'deepmind'],
        platformIds: ['brave-search'],
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const query = buildBraveSearchQuery(watchlist);
      expect(query).toBe('"artificial intelligence" OR "machine learning" OR "deepmind"');
    });

    it('constructs a hashtag OR-query for hashtag watchlists', () => {
      const watchlist: Watchlist = {
        id: randomUUID(),
        name: 'Hashtags',
        matchType: 'hashtag',
        terms: ['ai', 'tech'],
        platformIds: ['brave-search'],
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const query = buildBraveSearchQuery(watchlist);
      expect(query).toBe('"#ai" OR "#tech"');
    });

    it('passes boolean queries formatted for search syntax', () => {
      const watchlist: Watchlist = {
        id: randomUUID(),
        name: 'Boolean AI',
        matchType: 'boolean',
        terms: null,
        booleanQuery: '("cloud" OR "azure") AND "security"',
        platformIds: ['brave-search'],
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const query = buildBraveSearchQuery(watchlist);
      expect(query).toBe('("cloud" OR "azure") AND "security"');
    });

    it('canonicalizes URLs by stripping tracking parameters and standardizing schemes', () => {
      const rawUrl = 'https://news.ycombinator.com/item?id=12345&utm_source=twitter&utm_medium=social#comments';
      const canonical = canonicalizeUrl(rawUrl);
      expect(canonical).toBe('https://news.ycombinator.com/item?id=12345');
      expect(extractDomainFromUrl(rawUrl)).toBe('news.ycombinator.com');
    });
  });

  describe('AC3: Dual discovery & in-process AST validation', () => {
    it('accepts candidate items matching the exact watchlist criteria and rejects false positives', () => {
      const watchlist: Watchlist = {
        id: randomUUID(),
        name: 'Quantum Computing',
        matchType: 'keyword',
        terms: ['quantum computing'],
        platformIds: ['brave-search'],
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const matchingCandidate: BraveSearchResultItem = {
        url: 'https://science.org/article-1',
        title: 'New Advances in Quantum Computing',
        description: 'Scientists achieved quantum computing coherence at room temperature.',
      };

      const nonMatchingCandidate: BraveSearchResultItem = {
        url: 'https://science.org/article-2',
        title: 'Classical Supercomputers Break Records',
        description: 'New semiconductor architecture boosts processing speed.',
      };

      expect(validateCandidateMatch(watchlist, matchingCandidate)).toBe(true);
      expect(validateCandidateMatch(watchlist, nonMatchingCandidate)).toBe(false);
    });

    it('evaluates boolean AST predicates strictly against candidate title and snippet', () => {
      const watchlist: Watchlist = {
        id: randomUUID(),
        name: 'Tesla Battery',
        matchType: 'boolean',
        terms: null,
        booleanQuery: 'Tesla AND (battery OR gigafactory)',
        platformIds: ['brave-search'],
        isActive: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const match1: BraveSearchResultItem = {
        url: 'https://electrek.co/item-1',
        title: 'Tesla expands battery manufacturing facility',
        description: 'Production ramps up significantly in Nevada.',
      };

      const match2: BraveSearchResultItem = {
        url: 'https://electrek.co/item-2',
        title: 'Tesla inaugurates new Gigafactory',
        description: 'Vehicle delivery times drop across regions.',
      };

      const fail: BraveSearchResultItem = {
        url: 'https://electrek.co/item-3',
        title: 'Tesla releases new software update for infotainment',
        description: 'Features new games and UI tweaks.',
      };

      expect(validateCandidateMatch(watchlist, match1)).toBe(true);
      expect(validateCandidateMatch(watchlist, match2)).toBe(true);
      expect(validateCandidateMatch(watchlist, fail)).toBe(false);
    });
  });

  describe('AC4 & AC5: Ingestion, Author mapping, deduplication, and post_watchlist_matches junction persistence', () => {
    it('ingests validated articles, maps publication as Author, deduplicates on URL, and persists post_watchlist_matches', async () => {
      const { tenantId, userId } = await makeTenantWithUser();

      const watchlist = await createWatchlist(tenantId, userId, {
        name: 'Autonomous AI',
        matchType: 'keyword',
        terms: ['autonomous agents', 'agentic AI'],
        platformIds: ['brave-search'],
      });

      const candidateResults: BraveSearchResultItem[] = [
        {
          url: 'https://arstechnica.com/information-technology/2026/08/autonomous-agents-rise/?utm_campaign=rss',
          title: 'The Rise of Autonomous Agents in Production',
          description: 'Software teams deploy agentic AI workflows across engineering teams.',
          published: '2026-08-20T14:30:00Z',
        },
        {
          url: 'https://techcrunch.com/2026/08/20/unrelated-venture-funding/',
          title: 'Venture Firm Raises $500M Fund for FinTech',
          description: 'Focus on European payment processors and digital banking.',
          published: '2026-08-20T12:00:00Z',
        },
      ];

      const run = await startIngestionRun(tenantId, {
        platformId: BRAVE_SEARCH_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const { postsIngested, postsSkipped } = await ingestBraveSearchResults(
        tenantId,
        run.id,
        candidateResults,
        watchlist
      );

      expect(postsIngested).toBe(1);
      expect(postsSkipped).toBe(0);

      // Verify post exists and is linked in post_watchlist_matches
      await withTenant(tenantId, async (client) => {
        const { rows } = await client.query<{
          id: string;
          author_id: string;
          body_markdown: string;
          published_at: Date;
        }>(`SELECT id, author_id, body_markdown, published_at FROM social_posts WHERE tenant_id = $1`, [tenantId]);

        expect(rows).toHaveLength(1);
        const post = rows[0];
        expect(post.body_markdown).toContain('Software teams deploy agentic AI');

        // Check Author mapping
        const { rows: authorRows } = await client.query<{
          external_author_id: string;
          display_name: string;
        }>(`SELECT external_author_id, display_name FROM authors WHERE id = $1`, [post.author_id]);
        expect(authorRows[0].external_author_id).toBe('brave-search:arstechnica.com');
        expect(authorRows[0].display_name).toBe('arstechnica.com');

        // Check post_watchlist_matches junction table
        const { rows: matchRows } = await client.query<{ watchlist_id: string }>(
          `SELECT watchlist_id FROM post_watchlist_matches WHERE tenant_id = $1 AND post_id = $2`,
          [tenantId, post.id]
        );
        expect(matchRows.map((r) => r.watchlist_id)).toContain(watchlist.id);
      });

      // Second ingestion with the same canonical URL is skipped (deduplication)
      const secondRun = await startIngestionRun(tenantId, {
        platformId: BRAVE_SEARCH_PROVIDER_ID,
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const secondResult = await ingestBraveSearchResults(
        tenantId,
        secondRun.id,
        candidateResults,
        watchlist
      );

      expect(secondResult.postsIngested).toBe(0);
      expect(secondResult.postsSkipped).toBe(1);
    });
  });

  describe('AC6: Error handling & classification in fetchBraveSearch', () => {
    it('reclassifies HTTP 401 and 403 into non-retryable credential ClassifiableErrors', async () => {
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(fetchBraveSearch('test', 'invalid-key')).rejects.toThrow(
        expect.objectContaining({ kind: 'http_401' })
      );

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(fetchBraveSearch('test', 'forbidden-key')).rejects.toThrow(
        expect.objectContaining({ kind: 'http_403' })
      );

      global.fetch = originalFetch;
    });

    it('reclassifies HTTP 429 into retryable rate_limit ClassifiableError', async () => {
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      await expect(fetchBraveSearch('test', 'valid-key')).rejects.toThrow(
        expect.objectContaining({ kind: 'rate_limit' })
      );

      global.fetch = originalFetch;
    });

    it('reclassifies HTTP 5xx into retryable http_5xx ClassifiableError', async () => {
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(fetchBraveSearch('test', 'valid-key')).rejects.toThrow(
        expect.objectContaining({ kind: 'http_5xx' })
      );

      global.fetch = originalFetch;
    });
  });

  describe('End-to-end pollBraveSearch execution with active watchlists', () => {
    it('executes pollBraveSearch across active tenant watchlists using stored API key', async () => {
      const { tenantId, userId } = await makeTenantWithUser();

      // Store Tier-2 tenant credential
      await storeCredential(
        tenantId,
        BRAVE_SEARCH_PROVIDER_ID,
        'test-brave-subscription-token-12345',
        testKeyId,
        'tenant'
      );

      // Create two watchlists for brave-search
      const wl1 = await createWatchlist(tenantId, userId, {
        name: 'Space Exploration',
        matchType: 'keyword',
        terms: ['Mars rover', 'Perseverance'],
        platformIds: ['brave-search'],
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any, init: any) => {
        const urlStr = typeof input === 'string' ? input : input?.url ?? '';
        if (urlStr.includes('api.search.brave.com')) {
          if (urlStr.includes('Mars')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  results: [
                    {
                      url: 'https://nasa.gov/mars-perseverance-update-2026',
                      title: 'Perseverance Mars Rover Discovers Novel Rock Core Samples',
                      description: 'NASA Perseverance rover finds fascinating sedimentary deposits on Mars.',
                      published: '2026-08-20T16:00:00Z',
                    },
                  ],
                }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ results: [] }),
          } as Response);
        }
        return originalFetch(input, init);
      });

      const result = await pollBraveSearch(tenantId);
      expect(result.status).toBe('succeeded');

      // Verify post, match, and run record persisted
      await withTenant(tenantId, async (client) => {
        const { rows: runRows } = await client.query<{ status: string; posts_ingested: number }>(
          `SELECT status, posts_ingested FROM ingestion_runs WHERE id = $1`,
          [result.runId]
        );
        expect(runRows).toHaveLength(1);
        expect(runRows[0].status).toBe('succeeded');
        expect(runRows[0].posts_ingested).toBe(1);

        const { rows } = await client.query<{ id: string; external_id: string }>(
          `SELECT id, raw_payload->>'externalId' AS external_id FROM social_posts WHERE tenant_id = $1`,
          [tenantId]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].external_id).toBe('https://nasa.gov/mars-perseverance-update-2026');

        const { rows: matchRows } = await client.query<{ watchlist_id: string }>(
          `SELECT watchlist_id FROM post_watchlist_matches WHERE tenant_id = $1 AND post_id = $2`,
          [tenantId, rows[0].id]
        );
        expect(matchRows.map((r) => r.watchlist_id)).toContain(wl1.id);
      });

      global.fetch = originalFetch;
    });
  });
});
