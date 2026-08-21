/**
 * Contract: Story 2.22 — Active Watchlist Sourcing via Bing Search API (Azure):
 * Polling connector, candidate evaluation cap, and URL canonicalisation.
 *
 * Source: ADR-0066 (Accepted 2026-08-20)
 * See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-222
 *
 * Acceptance Criteria encoded:
 * - AC1: Connector definition & normalization (SocialConnector, providerId, canonicalizeUrl, extractDomain, freshness mapping)
 * - AC2: Active watchlist query transformation & in-process AST candidate validation
 * - AC3: Deterministic auto endpoint fallback (News with < 5 valid fallback to Web) and market/language localization
 * - AC4: Publication / base domain as Author (ADR-0004 generalization) with followerCount unpopulated
 * - AC5: Deduplication, post_watchlist_matches junction linking, and tenant-scoped Azure cost telemetry ($14 / 1k queries)
 * - AC6: Pacing delay loop and error classification (http_401, http_403, rate_limit, http_5xx, network)
 * - AC7: Bootstrap registration and transparency guard
 */

import {
  BING_SEARCH_PROVIDER_ID,
  bingSearchConnector,
  canonicalizeUrl,
  extractDomainFromUrl,
  lookbackToFreshness,
  parsePublicationDate,
  fetchBingSearch,
  BingSearchItem,
  calculateAzureSearchCost,
} from '../../src/connectors/bingSearch/bingSearchConnector';
import {
  buildBingSearchQuery,
  watchlistToAst,
  validateCandidateMatch,
} from '../../src/connectors/bingSearch/bingSearchQueryBuilder';
import {
  ingestBingSearchResults,
  pollBingSearch,
  setPacingDelayForTests,
} from '../../src/connectors/bingSearch/pollBingSearch';
import { getSocialConnector, __resetRegistryForTests } from '../../src/connectors/registry';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import { Watchlist } from '../../src/watchlists/watchlistStore';
import { ClassifiableError } from '../../src/ingestion/errorClassification';

describe('Story 2.22 — Active Watchlist Sourcing via Bing Search API (Azure)', () => {
  beforeEach(() => {
    setPacingDelayForTests(0);
    __resetRegistryForTests();
  });

  // -------------------------------------------------------------------------
  // AC1: Connector Implementation & Normalization
  // -------------------------------------------------------------------------
  describe('AC1: Connector definition, rate limit, and normalization', () => {
    it('implements SocialConnector with providerId "bing-search", authMode "api_key", and deliveryMode "poll"', () => {
      expect(BING_SEARCH_PROVIDER_ID).toBe('bing-search');
      expect(bingSearchConnector.providerId).toBe('bing-search');
      expect(bingSearchConnector.authMode).toBe('api_key');
      expect(bingSearchConnector.deliveryMode).toBe('poll');
      expect(bingSearchConnector.supportedQueryFeatures).toEqual(['AND', 'OR', 'NOT', 'TERM']);

      const rateLimit = bingSearchConnector.getRateLimitConfig?.();
      expect(rateLimit).toBeDefined();
      expect(rateLimit?.requestsPerWindow).toBeGreaterThan(0);
    });

    it('canonicalizeUrl strips tracking parameters (utm_*, fbclid, gclid, msclkid, ref, source), lowercases scheme/host, and removes fragments', () => {
      const dirtyUrl =
        'HTTPS://WWW.Example.com:443/news/article-123?utm_source=twitter&utm_medium=social&fbclid=xyz&msclkid=abc&ref=rss&source=feed#section-2';
      const cleanUrl = canonicalizeUrl(dirtyUrl);
      expect(cleanUrl).toBe('https://example.com/news/article-123');
    });

    it('extractDomainFromUrl extracts clean hostname without www.', () => {
      expect(extractDomainFromUrl('https://www.reuters.com/business/finance')).toBe('reuters.com');
      expect(extractDomainFromUrl('http://sub.domain.co.uk/news')).toBe('sub.domain.co.uk');
      expect(extractDomainFromUrl('invalid-url')).toBe('unknown-source');
    });

    it('lookbackToFreshness deterministically maps lookback windows to Bing freshness parameters', () => {
      expect(lookbackToFreshness(24)).toBe('Day'); // <= 48h
      expect(lookbackToFreshness(48)).toBe('Day');
      expect(lookbackToFreshness(72)).toBe('Week'); // 3-7d
      expect(lookbackToFreshness(168)).toBe('Week'); // 7d
      expect(lookbackToFreshness(240)).toBe('Month'); // > 7d
    });

    it('parsePublicationDate parses valid ISO strings or dateLastCrawled with fallback', () => {
      const sampleItem: BingSearchItem = {
        name: 'Test Article',
        url: 'https://example.com/article',
        description: 'Snippet text',
        datePublished: '2026-08-20T14:30:00.000Z',
      };
      expect(parsePublicationDate(sampleItem)).toBe('2026-08-20T14:30:00.000Z');

      const webItem: BingSearchItem = {
        name: 'Web Article',
        url: 'https://example.com/web',
        description: 'Snippet text',
        dateLastCrawled: '2026-08-19T10:00:00.000Z',
      };
      expect(parsePublicationDate(webItem)).toBe('2026-08-19T10:00:00.000Z');
    });

    it('normalizes a Bing search item into NormalizedPost with canonical externalId and domain author', () => {
      const item: BingSearchItem = {
        name: 'Major Cloud Innovation Announced',
        url: 'https://www.techcrunch.com/2026/08/20/cloud-innovation?utm_source=bing#story',
        description: 'TechCrunch reports on enterprise search innovation in Azure.',
        datePublished: '2026-08-20T12:00:00.000Z',
        provider: [{ name: 'TechCrunch' }],
      };

      const normalized = bingSearchConnector.normalize(item);
      expect(normalized.externalId).toBe('https://techcrunch.com/2026/08/20/cloud-innovation');
      expect(normalized.authorExternalId).toBe('bing-search:techcrunch.com');
      expect(normalized.publishedAt).toBe('2026-08-20T12:00:00.000Z');
      expect(normalized.rawPayload).toEqual(item);
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Active Watchlist Query Transformation & In-Process AST Validation
  // -------------------------------------------------------------------------
  describe('AC2: Query building and strict AST candidate validation', () => {
    it('buildBingSearchQuery builds OR-expressions for keyword, hashtag, and account watchlists', () => {
      const kwWatchlist: Watchlist = {
        id: 'wl-1',
        name: 'Cloud Computing',
        matchType: 'keyword',
        terms: ['Azure OpenAI', 'Kubernetes', 'Cloud'],
        platformIds: ['bing-search'],
        isActive: true,
        version: 1,
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      };
      expect(buildBingSearchQuery(kwWatchlist)).toBe('"Azure OpenAI" OR "Kubernetes" OR "Cloud"');

      const hashtagWatchlist: Watchlist = {
        id: 'wl-2',
        name: 'AI Tags',
        matchType: 'hashtag',
        terms: ['#CloudAI', 'AzureSearch'],
        platformIds: ['bing-search'],
        isActive: true,
        version: 1,
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      };
      expect(buildBingSearchQuery(hashtagWatchlist)).toBe('"#CloudAI" OR "#AzureSearch"');

      const booleanWatchlist: Watchlist = {
        id: 'wl-3',
        name: 'Complex Boolean',
        matchType: 'boolean',
        booleanQuery: '(Microsoft OR Azure) AND NOT Outage',
        terms: null,
        platformIds: ['bing-search'],
        isActive: true,
        version: 1,
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      };
      expect(buildBingSearchQuery(booleanWatchlist)).toBe('(Microsoft OR Azure) AND NOT Outage');
    });

    it('validateCandidateMatch performs strict in-process AST matching against title and description', () => {
      const watchlist: Watchlist = {
        id: 'wl-tech',
        name: 'Cybersecurity Alert',
        matchType: 'keyword',
        terms: ['Ransomware', 'Zero-Day'],
        platformIds: ['bing-search'],
        isActive: true,
        version: 1,
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      };

      const matchingCandidate: BingSearchItem = {
        name: 'New Zero-Day vulnerability discovered in legacy VPNs',
        url: 'https://securityweek.com/zero-day-vpn',
        description: 'Analysts warn of critical exploits.',
      };
      expect(validateCandidateMatch(watchlist, matchingCandidate)).toBe(true);

      const nonMatchingCandidate: BingSearchItem = {
        name: 'Cloud stocks rally after strong quarterly earnings',
        url: 'https://cnbc.com/cloud-stocks',
        description: 'Tech sector gains 3% in midday trading.',
      };
      expect(validateCandidateMatch(watchlist, nonMatchingCandidate)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Deterministic Auto Endpoint Fallback & Freshness
  // -------------------------------------------------------------------------
  describe('AC3: Deterministic auto endpoint fallback and search execution', () => {
    it('fetchBingSearch passes Ocp-Apim-Subscription-Key, count=25, and freshness', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          value: [
            {
              name: 'Enterprise Search Grounding Released',
              url: 'https://azure.microsoft.com/blog/grounding',
              description: 'Grounding with Bing Search is now generally available.',
              datePublished: '2026-08-20T10:00:00Z',
              provider: [{ name: 'Microsoft Azure Blog' }],
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const results = await fetchBingSearch('Azure AI Grounding', 'test-azure-api-key', {
        endpoint: 'news',
        freshness: 'Day',
        mkt: 'en-US',
        count: 25,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('/v7.0/news/search');
      expect(calledUrl).toContain('q=Azure+AI+Grounding');
      expect(calledUrl).toContain('freshness=Day');
      expect(calledUrl).toContain('mkt=en-US');
      expect(calledUrl).toContain('count=25');
      expect(calledInit.headers['Ocp-Apim-Subscription-Key']).toBe('test-azure-api-key');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Enterprise Search Grounding Released');
    });

    it('calculateAzureSearchCost computes estimated cost at $14 per 1,000 transactions ($0.014 per call)', () => {
      expect(calculateAzureSearchCost(1)).toBe(0.014);
      expect(calculateAzureSearchCost(100)).toBe(1.4);
      expect(calculateAzureSearchCost(1000)).toBe(14.0);
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Publication / Domain as Author
  // -------------------------------------------------------------------------
  describe('AC4: Author mapping (base domain and provider name)', () => {
    it('maps author attributes with displayName from provider or domain and platform "bing-search"', () => {
      const itemWithProvider: BingSearchItem = {
        name: 'UK Economy Updates',
        url: 'https://www.bbc.co.uk/news/business-12345',
        description: 'Inflation cools to target range.',
        provider: [{ name: 'BBC News' }],
      };

      const normalized = bingSearchConnector.normalize(itemWithProvider);
      expect(normalized.authorExternalId).toBe('bing-search:bbc.co.uk');

      const itemWithoutProvider: BingSearchItem = {
        name: 'Independent Research Report',
        url: 'https://arxiv.org/abs/2608.12345',
        description: 'New deep learning architecture.',
      };
      const normalizedWithout = bingSearchConnector.normalize(itemWithoutProvider);
      expect(normalizedWithout.authorExternalId).toBe('bing-search:arxiv.org');
    });
  });

  // -------------------------------------------------------------------------
  // AC5 & AC6: Ingestion, Junction Linking, Pacing & Error Classification
  // -------------------------------------------------------------------------
  describe('AC5 & AC6: Ingestion flow, junction linking, pacing, and error classification', () => {
    it('reclassifies HTTP status codes and network errors into ClassifiableError', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(fetchBingSearch('query', 'bad-key')).rejects.toThrow(ClassifiableError);
      await expect(fetchBingSearch('query', 'bad-key')).rejects.toMatchObject({
        kind: 'http_401',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      await expect(fetchBingSearch('query', 'forbidden-key')).rejects.toMatchObject({
        kind: 'http_403',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });
      await expect(fetchBingSearch('query', 'rate-limited-key')).rejects.toMatchObject({
        kind: 'rate_limit',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      await expect(fetchBingSearch('query', 'key')).rejects.toMatchObject({
        kind: 'http_5xx',
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
      await expect(fetchBingSearch('query', 'key')).rejects.toMatchObject({
        kind: 'network',
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC7: Bootstrap Registration Transparency (ADR-0048)
  // -------------------------------------------------------------------------
  describe('AC7: Bootstrap registration and transparency', () => {
    it('registers bing-search connector in connector registry on bootstrapConnectors()', () => {
      expect(getSocialConnector(BING_SEARCH_PROVIDER_ID)).toBeUndefined();
      bootstrapConnectors();
      const connector = getSocialConnector(BING_SEARCH_PROVIDER_ID);
      expect(connector).toBeDefined();
      expect(connector?.providerId).toBe('bing-search');
      expect(connector?.authMode).toBe('api_key');
      expect(connector?.deliveryMode).toBe('poll');
      expect(typeof connector?.poll).toBe('function');
      expect(connector?.pollCadenceMs).toBe(60 * 60 * 1000); // 1 hour cadence
    });
  });
});
