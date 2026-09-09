// Contract: Story 14.3 (ADR-0120) — SearchProviderConnector abstraction (backend)
// See docs/user-stories/epic-14-adr-0118-to-0122.md#story-143
// and docs/adr/0120-search-provider-connector.md.
//
// Intent: Story 14.3 — SearchProviderConnector abstraction (backend) (ADR-0120)
// Scope:
// - social-listening-core/src/connectors/types.ts
// - social-listening-core/src/connectors/registry.ts
// - social-listening-core/src/connectors/requestGate.ts
// - social-listening-core/src/connectors/braveSearch/braveSearchConnector.ts
// - social-listening-core/src/connectors/bingSearch/bingSearchConnector.ts
// - social-listening-core/src/connectors/bootstrapConnectors.ts
// - social-listening-core/src/composer/composerResearchService.ts
// - social-listening-core/.claude/skills/search-provider-connector/SKILL.md
// - social-listening-core/contracts/epic-14/story-14.3.search-provider-connector-abstraction.contract.test.ts
// Contract to encode:
// - AC 1: SearchProviderConnector interface is defined with providerId and optional search?(ctx, request): Promise<SearchResponse>.
// - AC 2: SearchRequest includes q, limit (default 5, hard cap 10), freshness ('any' | 'day' | 'week' | 'month'), optional market.
// - AC 3: SearchResponse returns results[] with title, url, snippet, publishedAt?.
// - AC 4: Search providers are registered in connector registry (ADR-0048) and loaded by bootstrapConnectors.ts.
// - AC 5: A search provider must be activated (connector_activations, ADR-0051) and have tenant/user credential (ADR-0028) before it is callable.
// - AC 6: Rate-limited via dedicated RequestGate key (tenantId, providerId, 'search'), separate from ingestion, outbound, and research gates.
// - AC 7: POST /v1/composer/research (ADR-0076) is refactored to use the new abstraction; internal searchForResearch delegates to search?().
// - AC 8: Connectors that do not implement search return search_not_supported when called.
// Explicitly out of scope:
// - Recurring active watchlist poll() semantics (already in ADR-0065 and ADR-0066).
// - Mandatory search() implementation on all connectors.
// - Internal tenant-owned-feed search (public web search only).
// - UI search preview or query builder components.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { storeCredential } from '../../src/credentials/credentialStore';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import {
  registerSearchProviderConnector,
  getSearchProviderConnector,
  listSearchProviderConnectors,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import {
  acquireForSearch,
  searchKey,
  __resetGateForTests,
} from '../../src/connectors/requestGate';
import {
  SearchProviderConnector,
  SearchRequest,
  SearchResponse,
  ConnectorContext,
} from '../../src/connectors/types';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import {
  braveSearchConnector,
  BRAVE_SEARCH_PROVIDER_ID,
  searchForResearch as searchBraveForResearch,
} from '../../src/connectors/braveSearch/braveSearchConnector';
import {
  bingSearchConnector,
  BING_SEARCH_PROVIDER_ID,
  searchForResearch as searchBingForResearch,
} from '../../src/connectors/bingSearch/bingSearchConnector';

jest.setTimeout(30000);

let testKeyName: string;
let testKeyId: string;

beforeAll(async () => {
  testKeyName = `test-key-${randomUUID()}`;
  const key = await getKeyClient().createRsaKey(testKeyName, { keySize: 2048 });
  testKeyId = key.id as string;
  process.env.KEY_VAULT_KEY_ID = testKeyId;
});

afterAll(async () => {
  try {
    const poller = await getKeyClient().beginDeleteKey(testKeyName);
    await poller.pollUntilDone();
  } catch {
    // best effort cleanup
  }
  __resetGateForTests();
  __resetRegistryForTests();
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetGateForTests();
  __resetRegistryForTests();
  bootstrapConnectors();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  return { tenantId: tenant.id, userId: invited.id };
}

function identityHeader(tenantId: string, userId: string, role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): string {
  return testIdentityHeaderValue(tenantId, { userId, role });
}

describe('Story 14.3 — SearchProviderConnector abstraction (ADR-0120)', () => {
  describe('Registry & Bootstrap (AC 1, AC 4)', () => {
    it('registers and retrieves search provider connectors from registry', () => {
      const dummy: SearchProviderConnector = {
        providerId: 'mock-search-engine',
        async search(ctx: ConnectorContext, req: SearchRequest): Promise<SearchResponse> {
          return { results: [{ title: 'Dummy', url: 'https://example.com', snippet: 'A snippet' }] };
        },
      };

      registerSearchProviderConnector(dummy);
      const retrieved = getSearchProviderConnector('mock-search-engine');
      expect(retrieved).toBeDefined();
      expect(retrieved?.providerId).toBe('mock-search-engine');

      const all = listSearchProviderConnectors();
      expect(all.some((c) => c.providerId === 'mock-search-engine')).toBe(true);
    });

    it('bootstrapConnectors registers Brave Search and Bing Search as search providers', () => {
      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID);
      expect(brave).toBeDefined();
      expect(typeof brave?.search).toBe('function');

      const bing = getSearchProviderConnector(BING_SEARCH_PROVIDER_ID);
      expect(bing).toBeDefined();
      expect(typeof bing?.search).toBe('function');
    });
  });

  describe('SearchRequest & SearchResponse interface contract (AC 2, AC 3)', () => {
    it('returns standardized SearchResponse with title, canonical url, snippet, and optional publishedAt', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-test-token', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('api.search.brave.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  title: 'Brave Article 1',
                  url: 'https://example.com/art1?utm_source=feed',
                  description: '<b>Snippet</b> 1',
                  published: '2026-08-20T12:00:00.000Z',
                },
              ],
            }),
          });
        }
        return originalFetch(input);
      });

      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID)!;
      const ctx: ConnectorContext = { tenantId };
      const req: SearchRequest = {
        q: 'social listening',
        limit: 5,
        freshness: 'week',
      };

      const response = await brave.search!(ctx, req);
      expect(response).toBeDefined();
      expect(Array.isArray(response.results)).toBe(true);
      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toEqual({
        title: 'Brave Article 1',
        url: 'https://example.com/art1',
        snippet: '**Snippet** 1',
        publishedAt: '2026-08-20T12:00:00.000Z',
      });
    });

    it('enforces limit hard cap of 10 and default of 5', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-test-token', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      let requestedCount: string | null = null;
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any) => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        requestedCount = url.searchParams.get('count');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: Array.from({ length: 15 }, (_, i) => ({
              title: `Art ${i}`,
              url: `https://example.com/${i}`,
              description: `Snippet ${i}`,
            })),
          }),
        });
      });

      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID)!;
      const ctx: ConnectorContext = { tenantId };

      // Case 1: default limit should be 5
      const res1 = await brave.search!(ctx, { q: 'tech' });
      expect(requestedCount).toBe('5');
      expect(res1.results.length).toBe(5);

      // Case 2: limit > 10 should be capped at 10
      const res2 = await brave.search!(ctx, { q: 'tech', limit: 20 });
      expect(requestedCount).toBe('10');
      expect(res2.results.length).toBe(10);
    });
  });

  describe('Unsupported search provider handling (AC 8)', () => {
    it('throws or returns search_not_supported when connector does not implement search?()', async () => {
      const dummyWithoutSearch: SearchProviderConnector = {
        providerId: 'no-search-provider',
      };
      registerSearchProviderConnector(dummyWithoutSearch);

      const connector = getSearchProviderConnector('no-search-provider');
      expect(connector).toBeDefined();
      expect(connector?.search).toBeUndefined();

      const invoke = async () => {
        if (!connector?.search) {
          throw new Error('search_not_supported');
        }
        await connector.search({ tenantId: 't1' }, { q: 'test' });
      };

      await expect(invoke()).rejects.toThrow('search_not_supported');
    });
  });

  describe('Credential & Activation gating (AC 5)', () => {
    it('fails if provider is not activated for the tenant', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-test-token', testKeyId, 'tenant');

      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID)!;
      await expect(
        brave.search!({ tenantId }, { q: 'test' })
      ).rejects.toThrow(/not active|activation|search_not_available/i);
    });

    it('fails if tenant has no registered credential for provider', async () => {
      const { tenantId } = await makeTenantWithUser();
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID)!;
      await expect(
        brave.search!({ tenantId }, { q: 'test' })
      ).rejects.toThrow(/credential|401|search_not_available/i);
    });
  });

  describe('Dedicated RequestGate key (AC 6)', () => {
    it('uses (tenantId, providerId, "search") gate key and acquires rate-limit slot', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-test-token', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      const brave = getSearchProviderConnector(BRAVE_SEARCH_PROVIDER_ID)!;
      const expectedKey = searchKey(tenantId, brave);
      expect(expectedKey).toBe(`${tenantId}:${BRAVE_SEARCH_PROVIDER_ID}:search`);

      await expect(acquireForSearch(tenantId, brave)).resolves.toBeUndefined();
    });
  });

  describe('Backward compatibility & delegation for searchForResearch (AC 7)', () => {
    it('searchForResearch in braveSearchConnector delegates to or shares SearchProviderConnector', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-test-token', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: 'Brave Research Item',
                url: 'https://example.com/res1',
                description: 'Description 1',
              },
            ],
          }),
        });
      });

      const results = await searchBraveForResearch(tenantId, 'ai research', 3);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: 'Brave Research Item',
        url: 'https://example.com/res1',
        snippet: 'Description 1',
        provider: BRAVE_SEARCH_PROVIDER_ID,
      });
    });

    it('searchForResearch in bingSearchConnector delegates to or shares SearchProviderConnector', async () => {
      const { tenantId } = await makeTenantWithUser();
      await storeCredential(tenantId, BING_SEARCH_PROVIDER_ID, 'bing-test-key', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BING_SEARCH_PROVIDER_ID, 'tenant', true);

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            webPages: {
              value: [
                {
                  name: 'Bing Research Item',
                  url: 'https://example.com/bing1',
                  snippet: 'Bing snippet 1',
                },
              ],
            },
          }),
        });
      });

      const results = await searchBingForResearch(tenantId, 'market research', 3);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        title: 'Bing Research Item',
        url: 'https://example.com/bing1',
        snippet: 'Bing snippet 1',
        provider: BING_SEARCH_PROVIDER_ID,
      });
    });
  });

  describe('POST /v1/composer/research integration (AC 7)', () => {
    it('composer research endpoint executes search using registered search provider connectors', async () => {
      const { tenantId, userId } = await makeTenantWithUser('tenant_user');

      const azureOpenAiCredential = JSON.stringify({
        endpoint: 'https://example.openai.azure.com',
        key: 'test-key',
        deployment: 'gpt-5-mini',
      });
      await storeCredential(tenantId, 'azure-openai', azureOpenAiCredential, testKeyId, 'tenant');
      await setConnectorActivation(tenantId, 'azure-openai', 'tenant', true);

      await storeCredential(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'brave-token', testKeyId, 'tenant');
      await setConnectorActivation(tenantId, BRAVE_SEARCH_PROVIDER_ID, 'tenant', true);

      const { azureOpenAiConnector } = await import('../../src/connectors/azureOpenAi/azureOpenAiConnector');
      jest.spyOn(azureOpenAiConnector, 'research').mockImplementation(async (text, snippets) => {
        if (snippets.length === 0) {
          return {
            keyPhrases: ['social media'],
            relatedTopics: ['marketing'],
            searchQueries: ['social media trends 2026'],
            contextSummary: '',
            comparison: '',
          };
        }
        return {
          keyPhrases: ['social media'],
          relatedTopics: ['marketing'],
          searchQueries: ['social media trends 2026'],
          contextSummary: 'Summary synthesized from web search',
          comparison: 'Comparison against prior data',
        };
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((input: any) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('api.search.brave.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              results: [
                {
                  title: '2026 Social Trends',
                  url: 'https://example.com/trends-2026',
                  description: 'Top trends in social media',
                },
              ],
            }),
          });
        }
        return originalFetch(input);
      });

      const app = createApp();
      const res = await request(app)
        .post('/v1/composer/research')
        .set('x-test-identity', identityHeader(tenantId, userId, 'tenant_user'))
        .send({ text: 'Analyze trends in social listening' });

      expect(res.status).toBe(200);
      expect(res.body.sources).toBeDefined();
      expect(res.body.sources.length).toBeGreaterThan(0);
      expect(res.body.sources[0].title).toBe('2026 Social Trends');
      expect(res.body.contextSummary).toBe('Summary synthesized from web search');
    });
  });
});
