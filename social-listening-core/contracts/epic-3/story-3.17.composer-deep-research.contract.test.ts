// Contract: Story 3.17 (ADR-0076) — POST /v1/composer/research Deep Research endpoint
// See docs/user-stories/epic-3-data-model-storage-and-archival.md#story-317
//
// Intent: Story 3.17 — POST /v1/composer/research Deep Research endpoint (ADR-0076).
// Scope: src/composer/composerResearchService.ts,
//        src/http/versions/v1/composerRouter.ts,
//        src/http/versions/v1/router.ts,
//        .claude/skills/composer-research/SKILL.md,
//        .claude/skills/azure-openai-connector/SKILL.md,
//        .claude/skills/provider-connector-framework/SKILL.md
// Contract to encode:
//   (1) a valid request returns 200 with the full ComposerResearchResult shape;
//   (2) no active research-capable AI provider returns 422 AI_PROVIDER_NOT_CAPABLE;
//   (3) no active search provider returns 422 SEARCH_PROVIDER_UNAVAILABLE;
//   (4) platform_admin receives 403;
//   (5) maxSearchResultsPerQuery > 10 returns 422 RESEARCH_TOO_LARGE;
//   (6) the call does not create social_posts or post_watchlist_matches rows.
// Explicitly out of scope: caching; async background jobs; media/image analysis;
//   persistence of research results; UI (Story 6.41).

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
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { withTenant } from '../../src/db/withTenant';

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
  await closeAdminPool();
  await closePlatformAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetGateForTests();
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

const azureOpenAiCredential = JSON.stringify({
  endpoint: 'https://example.openai.azure.com',
  key: 'test-key',
  deployment: 'gpt-5-mini',
});

async function setupAzureOpenAi(tenantId: string): Promise<void> {
  await storeCredential(tenantId, 'azure-openai', azureOpenAiCredential, testKeyId, 'tenant');
  await setConnectorActivation(tenantId, 'azure-openai', 'tenant', true);
}

async function setupBrave(tenantId: string): Promise<void> {
  await storeCredential(tenantId, 'brave-search', 'brave-test-token', testKeyId, 'tenant');
  await setConnectorActivation(tenantId, 'brave-search', 'tenant', true);
}

async function setupBing(tenantId: string): Promise<void> {
  await storeCredential(tenantId, 'bing-search', 'bing-test-key', testKeyId, 'tenant');
  await setConnectorActivation(tenantId, 'bing-search', 'tenant', true);
}

function mockFetch(): { fetchSpy: jest.SpyInstance } {
  let azureCallCount = 0;

  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (url.includes('example.openai.azure.com')) {
      azureCallCount += 1;
      if (azureCallCount === 1) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            model: 'gpt-5-mini',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    keyPhrases: ['SocialEngage'],
                    relatedTopics: ['social listening'],
                    searchQueries: ['SocialEngage news'],
                    contextSummary: 'Extraction summary placeholder',
                    comparison: 'Extraction comparison placeholder',
                  }),
                },
              },
            ],
          }),
          text: async () => 'OK',
          headers: new Headers(),
        } as unknown as Response;
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          model: 'gpt-5-mini',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  keyPhrases: ['SocialEngage'],
                  relatedTopics: ['social listening'],
                  searchQueries: ['SocialEngage news'],
                  contextSummary: 'Current public conversation is active around social listening tools.',
                  comparison: 'The draft focuses on the product launch and aligns with the current conversation.',
                }),
              },
            },
          ],
        }),
        text: async () => 'OK',
        headers: new Headers(),
      } as unknown as Response;
    }

    if (url.includes('api.search.brave.com')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          results: [
            {
              url: 'https://example.com/brave-article?utm_source=feed',
              title: 'Brave article on SocialEngage',
              description: 'A brave look at the SocialEngage launch.',
            },
          ],
        }),
        text: async () => 'OK',
        headers: new Headers(),
      } as unknown as Response;
    }

    if (url.includes('api.bing.microsoft.com')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          webPages: {
            value: [
              {
                url: 'https://example.com/bing-article?ref=news',
                name: 'Bing article on SocialEngage',
                snippet: 'A bing look at the SocialEngage launch.',
              },
            ],
          },
        }),
        text: async () => 'OK',
        headers: new Headers(),
      } as unknown as Response;
    }

    throw new Error(`Unexpected fetch in contract test: ${url}`);
  });

  return { fetchSpy };
}

describe('Story 3.17 — POST /v1/composer/research', () => {
  const app = createApp();

  it('AC1: valid request returns 200 with all ComposerResearchResult fields', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);
    await setupBing(tenantId);
    const { fetchSpy } = mockFetch();

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'We are launching SocialEngage for social listening.',
        maxSearchResultsPerQuery: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        keyPhrases: expect.any(Array),
        relatedTopics: expect.any(Array),
        searchQueries: expect.any(Array),
        sources: expect.any(Array),
        contextSummary: expect.any(String),
        comparison: expect.any(String),
      })
    );
    expect(res.body.keyPhrases).toContain('SocialEngage');
    expect(res.body.searchQueries).toContain('SocialEngage news');
    expect(res.body.sources).toHaveLength(2);
    expect(res.body.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Brave article on SocialEngage', provider: 'brave-search' }),
        expect.objectContaining({ title: 'Bing article on SocialEngage', provider: 'bing-search' }),
      ])
    );
    expect(res.body.contextSummary).toContain('Current public conversation');
    expect(res.body.comparison).toContain('draft');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('AC2: no active Azure OpenAI credential/activation returns 422 AI_PROVIDER_NOT_CAPABLE', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupBrave(tenantId);
    await setupBing(tenantId);

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'We are launching SocialEngage.',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('AI_PROVIDER_NOT_CAPABLE');
  });

  it('AC3: no active Brave/Bing credential/activation returns 422 SEARCH_PROVIDER_UNAVAILABLE', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'We are launching SocialEngage.',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SEARCH_PROVIDER_UNAVAILABLE');
  });

  it('AC4: platform_admin gets 403', async () => {
    const { tenantId } = await makeTenantWithUser();

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }))
      .send({
        text: 'We are launching SocialEngage.',
      });

    expect(res.status).toBe(403);
  });

  it('AC5: maxSearchResultsPerQuery > 10 returns 422 RESEARCH_TOO_LARGE', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);
    await setupBing(tenantId);

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'We are launching SocialEngage.',
        maxSearchResultsPerQuery: 11,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESEARCH_TOO_LARGE');
  });

  it('AC6: the call does not create social_posts or post_watchlist_matches rows', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);
    await setupBing(tenantId);
    mockFetch();

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({
        text: 'We are launching SocialEngage for social listening.',
      });

    expect(res.status).toBe(200);

    await withTenant(tenantId, async (client) => {
      const posts = await client.query('SELECT 1 FROM social_posts WHERE tenant_id = $1', [tenantId]);
      const matches = await client.query('SELECT 1 FROM post_watchlist_matches WHERE tenant_id = $1', [tenantId]);
      expect(posts.rowCount).toBe(0);
      expect(matches.rowCount).toBe(0);
    });
  });
});
