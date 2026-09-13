// Contract: Story 14.4 (ADR-0121) — Composer Deep Research caching, re-trigger, and cost telemetry (backend)
// See docs/user-stories/epic-14-adr-0118-to-0122.md#story-144--composer-deep-research-caching-re-trigger-and-cost-telemetry-backend
//
// Intent: Story 14.4 — Composer Deep Research caching, re-trigger, and cost telemetry (backend).
// Scope: migrations/0075_create_research_cache_and_runs.sql,
//        src/composer/composerResearchService.ts,
//        src/composer/composerResearchStore.ts,
//        src/http/versions/v1/composerRouter.ts,
//        .claude/skills/composer-research/SKILL.md
//
// Contract to encode:
//   (1) AC1: A valid request caches results in `research_cache` keyed by text_hash. Subsequent identical request
//       returns the cached result with cache_hit=true, without making new AI/search calls.
//   (2) AC1: text_hash normalizes whitespace and casing, but differs when text or providers change.
//   (3) AC2: POST /v1/composer/research?refresh=true bypasses cache, re-runs pipeline, and updates cache row.
//   (4) AC3: `research_runs` table records every request (tenant_id, user_id, text_hash, ai_provider_id,
//       search_provider_ids, cache_hit, tokens_in, tokens_out, estimated_cost_usd, created_at).
//   (5) AC4: `research_daily_request_cap` (default 50, max 500) returns 429 RESEARCH_DAILY_CAP_EXCEEDED when exceeded.
//   (6) AC5: `research_monthly_cost_cap_usd` returns 422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED when exceeded.
//   (7) AC6: Multi-tenant RLS isolation: tenant B cannot read or hit tenant A's research_cache or research_runs.

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

jest.setTimeout(40000);

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

function mockFetch(customSummary?: string): { fetchSpy: jest.SpyInstance; getAzureCallCount: () => number } {
  let azureCallCount = 0;

  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (url.includes('example.openai.azure.com')) {
      azureCallCount += 1;
      if (azureCallCount % 2 === 1) {
        // Extraction
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
                    contextSummary: '',
                    comparison: '',
                  }),
                },
              },
            ],
          }),
          text: async () => 'OK',
          headers: new Headers(),
        } as unknown as Response;
      }

      // Synthesis
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
                  contextSummary: customSummary ?? 'Current public conversation is active around social listening tools.',
                  comparison: 'The draft focuses on the product launch and aligns with current trends.',
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
              url: 'https://example.com/brave-article',
              title: 'Brave article on SocialEngage',
              description: 'A brave look at the SocialEngage launch.',
            },
          ],
        }),
        text: async () => 'OK',
        headers: new Headers(),
      } as unknown as Response;
    }

    throw new Error(`Unexpected fetch in contract test: ${url}`);
  });

  return { fetchSpy, getAzureCallCount: () => azureCallCount };
}

describe('Story 14.4 — Composer Deep Research Caching, Retrigger & Cost Telemetry', () => {
  const app = createApp();

  it('AC1 & AC3: Caches research result on miss, serves from cache on hit with 0 LLM calls, and logs research_runs telemetry', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);

    const { getAzureCallCount } = mockFetch();

    // 1. Initial request (Cache Miss)
    const res1 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: '  Launching SocialEngage for brand intelligence!  ' });

    expect(res1.status).toBe(200);
    expect(res1.body.contextSummary).toContain('Current public conversation');
    expect(getAzureCallCount()).toBe(2); // extraction + synthesis

    // Check research_cache and research_runs in DB
    await withTenant(tenantId, async (client) => {
      const cacheRows = await client.query('SELECT * FROM research_cache WHERE tenant_id = $1', [tenantId]);
      expect(cacheRows.rows).toHaveLength(1);
      expect(cacheRows.rows[0].result_json.contextSummary).toContain('Current public conversation');
      expect(new Date(cacheRows.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());

      const runRows = await client.query('SELECT * FROM research_runs WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
      expect(runRows.rows).toHaveLength(1);
      expect(runRows.rows[0].user_id).toBe(userId);
      expect(runRows.rows[0].cache_hit).toBe(false);
      expect(runRows.rows[0].ai_provider_id).toBe('azure-openai');
      expect(runRows.rows[0].search_provider_ids).toEqual(['brave-search']);
      expect(Number(runRows.rows[0].tokens_in)).toBeGreaterThan(0);
      expect(Number(runRows.rows[0].tokens_out)).toBeGreaterThan(0);
      expect(Number(runRows.rows[0].estimated_cost_usd)).toBeGreaterThan(0);
    });

    // 2. Second identical request (with slight whitespace/casing difference to test normalization)
    const res2 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'launching socialengage for brand intelligence!' });

    expect(res2.status).toBe(200);
    expect(res2.body.contextSummary).toContain('Current public conversation');
    // Azure calls should NOT have increased because it hit the cache!
    expect(getAzureCallCount()).toBe(2);

    // Verify research_runs logged a cache hit
    await withTenant(tenantId, async (client) => {
      const runRows = await client.query('SELECT * FROM research_runs WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
      expect(runRows.rows).toHaveLength(2);
      expect(runRows.rows[1].cache_hit).toBe(true);
      expect(Number(runRows.rows[1].tokens_in)).toBe(0);
      expect(Number(runRows.rows[1].tokens_out)).toBe(0);
      expect(Number(runRows.rows[1].estimated_cost_usd)).toBe(0);
    });
  });

  it('AC2: ?refresh=true bypasses cache, calls pipeline, and overwrites cache row', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);

    const { getAzureCallCount } = mockFetch('First summary');

    // First run creates cache
    const res1 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Product update announcements' });

    expect(res1.status).toBe(200);
    expect(getAzureCallCount()).toBe(2);

    // Refresh run with ?refresh=true
    const res2 = await request(app)
      .post('/v1/composer/research?refresh=true')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Product update announcements' });

    expect(res2.status).toBe(200);
    expect(getAzureCallCount()).toBe(4); // re-executed pipeline

    await withTenant(tenantId, async (client) => {
      const cacheRows = await client.query('SELECT * FROM research_cache WHERE tenant_id = $1', [tenantId]);
      expect(cacheRows.rows).toHaveLength(1); // overwritten, not duplicated

      const runRows = await client.query('SELECT * FROM research_runs WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
      expect(runRows.rows).toHaveLength(2);
      expect(runRows.rows[1].cache_hit).toBe(false);
      expect(Number(runRows.rows[1].estimated_cost_usd)).toBeGreaterThan(0);
    });
  });

  it('AC4: Enforces research_daily_request_cap (default 50) and returns 429 RESEARCH_DAILY_CAP_EXCEEDED', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);
    mockFetch();

    // Configure daily cap = 2 in tenant_settings
    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO tenant_settings (tenant_id, research_daily_request_cap)
         VALUES ($1, 2)
         ON CONFLICT (tenant_id) DO UPDATE SET research_daily_request_cap = 2`,
        [tenantId]
      );
    });

    // Request 1: OK
    const res1 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Post 1' });
    expect(res1.status).toBe(200);

    // Request 2: OK
    const res2 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Post 2' });
    expect(res2.status).toBe(200);

    // Request 3: Exceeds daily cap
    const res3 = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Post 3' });
    expect(res3.status).toBe(429);
    expect(res3.body.code).toBe('RESEARCH_DAILY_CAP_EXCEEDED');
  });

  it('AC5: Enforces research_monthly_cost_cap_usd and returns 422 RESEARCH_MONTHLY_COST_CAP_EXCEEDED', async () => {
    const { tenantId, userId } = await makeTenantWithUser();
    await setupAzureOpenAi(tenantId);
    await setupBrave(tenantId);
    mockFetch();

    // Set a tiny monthly cap: $0.0001
    await withTenant(tenantId, async (client) => {
      await client.query(
        `INSERT INTO tenant_settings (tenant_id, research_monthly_cost_cap_usd)
         VALUES ($1, 0.0001)
         ON CONFLICT (tenant_id) DO UPDATE SET research_monthly_cost_cap_usd = 0.0001`,
        [tenantId]
      );
      // Pre-insert a run that exhausted the cap
      await client.query(
        `INSERT INTO research_runs (tenant_id, user_id, text_hash, ai_provider_id, search_provider_ids, cache_hit, estimated_cost_usd, created_at)
         VALUES ($1, $2, 'hash1', 'azure-openai', ARRAY['brave-search'], false, 0.0002, NOW())`,
        [tenantId, userId]
      );
    });

    const res = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantId, userId))
      .send({ text: 'Should be blocked by monthly cost cap' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESEARCH_MONTHLY_COST_CAP_EXCEEDED');
  });

  it('AC6 & AC7: Multi-tenant RLS prevents cross-tenant cache hit and leakage', async () => {
    const tenantA = await makeTenantWithUser();
    const tenantB = await makeTenantWithUser();
    await setupAzureOpenAi(tenantA.tenantId);
    await setupBrave(tenantA.tenantId);
    await setupAzureOpenAi(tenantB.tenantId);
    await setupBrave(tenantB.tenantId);

    const { getAzureCallCount } = mockFetch();

    // Tenant A executes research
    const resA = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantA.tenantId, tenantA.userId))
      .send({ text: 'Confidential launch strategy' });
    expect(resA.status).toBe(200);
    expect(getAzureCallCount()).toBe(2);

    // Tenant B requests the exact same text
    const resB = await request(app)
      .post('/v1/composer/research')
      .set('X-Test-Identity', identityHeader(tenantB.tenantId, tenantB.userId))
      .send({ text: 'Confidential launch strategy' });
    expect(resB.status).toBe(200);
    // Tenant B must NOT hit Tenant A's cache! Must execute pipeline for Tenant B.
    expect(getAzureCallCount()).toBe(4);

    // Verify Tenant B's RLS view only sees its own cache & runs
    await withTenant(tenantB.tenantId, async (client) => {
      const cacheRows = await client.query('SELECT * FROM research_cache');
      expect(cacheRows.rows).toHaveLength(1);
      expect(cacheRows.rows[0].tenant_id).toBe(tenantB.tenantId);

      const runRows = await client.query('SELECT * FROM research_runs');
      expect(runRows.rows).toHaveLength(1);
      expect(runRows.rows[0].tenant_id).toBe(tenantB.tenantId);
    });
  });
});
