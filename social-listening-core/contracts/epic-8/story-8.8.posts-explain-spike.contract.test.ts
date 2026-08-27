// Contract: Story 8.8 (ADR-0062 Decision §6) — POST /v1/posts/explain-spike
// See docs/user-stories/epic-8-analytics-dashboard.md#story-88
//
// Intent: Story 8.8 — AI Spike Storyteller backend endpoint.
// Scope: src/posts/spikeStorytellerService.ts (new — pure orchestration),
//        src/http/versions/v1/postsRouter.ts (extended — POST /explain-spike),
//        .claude/skills/posts-api/SKILL.md (extended),
//        .claude/skills/azure-openai-connector/SKILL.md (extended — documents
//          research() reuse for spike explanation, no new public method).
// Contract to encode:
//   (1) a valid request returns 200 with { narrative, postsAnalysed, generatedAt },
//       where postsAnalysed reflects the real count of posts in the ±1 day window;
//   (2) the customPrompt-present branch folds the user's prompt into the
//       composed prompt (verified by inspecting the fetch body sent to Azure
//       OpenAI — the customPrompt text must appear in the user message);
//   (3) no Tier-2 Azure OpenAI credential configured returns 503 with
//       { code: 'AI_UNAVAILABLE' } — never a fabricated narrative;
//   (4) platform_admin receives 403 (requireTenantUser boundary);
//   (5) the endpoint is stateless — no social_posts inserts, no new
//       enrichment persistence, no stored aggregation;
//   (6) spikeDate is required — a missing/empty spikeDate returns 400.
// Explicitly out of scope: caching; AI-backed predictive forecast; any
//   extension to azureOpenAiConnector.ts's own public interface (used as-is
//   via research()); Sentiment/Conversations/Sources tab changes; frontend
//   widget (separate admin-side contract).

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { withTenant } from '../../src/db/withTenant';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';

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
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

beforeEach(() => {
  __resetGateForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 5]
  );
  return rows[0].id;
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

/**
 * Mocks globalThis.fetch so Azure OpenAI chat/completions calls return a
 * fixed ResearchResult JSON (the shape azureOpenAiConnector.research()
 * parses). Captures the request body so the contract can verify the
 * composed prompt includes customPrompt text when present.
 */
function mockAzureOpenAiFetch(): { fetchSpy: jest.SpyInstance; lastRequestBody: () => string | undefined } {
  let lastBody: string | undefined;

  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (url.includes('example.openai.azure.com')) {
      lastBody = typeof init?.body === 'string' ? init.body : '';
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
                  keyPhrases: ['product launch', 'earnings'],
                  relatedTopics: ['market growth'],
                  searchQueries: [],
                  contextSummary: 'The spike was driven by a product launch announcement and positive earnings coverage.',
                  comparison: 'Coverage was uniformly positive.',
                }),
              },
            },
          ],
        }),
        text: async () => 'OK',
        headers: new Headers(),
      } as unknown as Response;
    }

    throw new Error(`Unexpected fetch in contract test: ${url}`);
  });

  return { fetchSpy, lastRequestBody: () => lastBody };
}

async function seedPost(
  tenantId: string,
  runId: string,
  opts: {
    publishedAt?: string;
    title?: string;
    bodyMarkdown?: string;
    keyPhrases?: string[];
    providerId?: string;
  }
): Promise<string> {
  const { id } = await insertSocialPost({
    tenantId,
    authorId: null,
    acquisitionId: runId,
    rawPayload: {
      providerId: opts.providerId ?? 'gnews',
      title: opts.title ?? 'Untitled post',
    },
    bodyMarkdown: opts.bodyMarkdown ?? 'This is the post body content.',
    publishedAt: opts.publishedAt,
    enrichment: opts.keyPhrases ? { keyPhrases: opts.keyPhrases, sentiment: 'positive' } : undefined,
  });
  return id;
}

describe('Story 8.8 — POST /v1/posts/explain-spike', () => {
  const app = createApp();

  it('AC1: valid request returns 200 with { narrative, postsAnalysed, generatedAt }', async () => {
    const tenantId = await createTenantFixture(`Spike-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });

    // Seed posts within the ±1 day window around 2026-08-15
    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-15T10:00:00.000Z',
      title: 'AcmeCorp launches new product line',
      bodyMarkdown: 'AcmeCorp today announced a major new product line.',
      keyPhrases: ['product launch', 'AcmeCorp'],
    });
    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-15T14:00:00.000Z',
      title: 'AcmeCorp earnings beat expectations',
      bodyMarkdown: 'Quarterly earnings exceeded analyst forecasts.',
      keyPhrases: ['earnings', 'AcmeCorp'],
    });
    // Seed a post outside the window — must NOT be counted
    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-20T10:00:00.000Z',
      title: 'Unrelated later post',
    });

    const { fetchSpy } = mockAzureOpenAiFetch();

    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({ spikeDate: '2026-08-15' });

    expect(res.status).toBe(200);
    expect(res.body.narrative).toBeTruthy();
    expect(typeof res.body.narrative).toBe('string');
    expect(res.body.postsAnalysed).toBe(2);
    expect(res.body.generatedAt).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('AC2: customPrompt is folded into the composed prompt sent to Azure OpenAI', async () => {
    const tenantId = await createTenantFixture(`Spike-Custom-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });

    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-15T10:00:00.000Z',
      title: 'Spike driver post',
    });

    const { lastRequestBody } = mockAzureOpenAiFetch();

    const customPrompt = 'Focus specifically on whether negative sentiment is rising';
    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({ spikeDate: '2026-08-15', customPrompt });

    expect(res.status).toBe(200);
    const body = lastRequestBody();
    expect(body).toBeTruthy();
    expect(body).toContain(customPrompt);
  });

  it('AC3: no Azure OpenAI credential configured returns 503 with { code: "AI_UNAVAILABLE" }', async () => {
    const tenantId = await createTenantFixture(`Spike-NoAI-${randomUUID()}`);
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });

    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-15T10:00:00.000Z',
      title: 'Post with no AI configured',
    });

    // No setupAzureOpenAi() call — no credential stored, no activation set
    const { fetchSpy } = mockAzureOpenAiFetch();

    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({ spikeDate: '2026-08-15' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(res.body.narrative).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC4: platform_admin receives 403', async () => {
    const tenantId = await createTenantFixture(`Spike-Admin-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);

    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', JSON.stringify({ type: 'platform_admin', adminId: randomUUID() }))
      .send({ spikeDate: '2026-08-15' });

    expect(res.status).toBe(403);
  });

  it('AC5: the endpoint is stateless — no social_posts inserts or enrichment persistence', async () => {
    const tenantId = await createTenantFixture(`Spike-Stateless-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);
    const run = await startIngestionRun(tenantId, { platformId: 'gnews', triggerType: 'poll', connectorVersion: '1.0.0' });

    await seedPost(tenantId, run.id, {
      publishedAt: '2026-08-15T10:00:00.000Z',
      title: 'Stateless test post',
    });

    const countBefore = await withTenant(tenantId, (client) =>
      client.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM social_posts`)
    );

    mockAzureOpenAiFetch();

    await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({ spikeDate: '2026-08-15' });

    const countAfter = await withTenant(tenantId, (client) =>
      client.query<{ count: string }>(`SELECT COUNT(*)::text as count FROM social_posts`)
    );

    expect(Number(countAfter.rows[0].count)).toBe(Number(countBefore.rows[0].count));
  });

  it('AC6: missing spikeDate returns 400', async () => {
    const tenantId = await createTenantFixture(`Spike-NoDate-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);

    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({});

    expect(res.status).toBe(400);
  });

  it('AC6b: empty spikeDate returns 400', async () => {
    const tenantId = await createTenantFixture(`Spike-EmptyDate-${randomUUID()}`);
    await setupAzureOpenAi(tenantId);

    const res = await request(app)
      .post('/v1/posts/explain-spike')
      .set('X-Test-Identity', testIdentityHeaderValue(tenantId))
      .send({ spikeDate: '' });

    expect(res.status).toBe(400);
  });
});
