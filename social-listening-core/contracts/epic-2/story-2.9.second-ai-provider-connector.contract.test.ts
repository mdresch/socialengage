/**
 * Intent — Story 2.9 (Second AIProviderConnector: Azure-hosted LLM
 * swappability validation), sourced from Story 2.1's own connector-
 * abstraction contract, Story 2.8's own follow-up note, and ADR-0038 §2/
 * Open Questions (Amendment Log, 2026-08-10: Azure OpenAI Service selected
 * over Claude in Microsoft Foundry, gpt-5-mini as the concrete deployed
 * model after gpt-4o-mini was found Deprecating at actual provisioning
 * time — see ADR-0038's own Amendment Log for both dated entries).
 *
 * Scope: a second, real AIProviderConnector (azureOpenAiConnector.ts)
 * targeting the real, live Azure OpenAI Service resource named in this
 * repo's own .env (AZURE_OPENAI_ENDPOINT/KEY/DEPLOYMENT — the same real-
 * infra test-fixture pattern Story 2.8 established for Azure AI Language),
 * using GA structured/JSON-schema-constrained output to return all four
 * enrichment fields (sentiment, sentimentScores, entities, keyPhrases,
 * detectedLanguage) in a single real HTTP call — realizing the single-
 * call efficiency argument ADR-0038 Decision §2 named as the reason an
 * LLM-based second provider was wanted at all, in contrast to Azure AI
 * Language's four separate per-capability calls (Story 2.8).
 *
 * enrichPost.ts (Story 2.8) is rewritten to be provider-agnostic: it now
 * tries each real, registered AIProviderConnector in a fixed order,
 * skipping any the calling tenant has not connected (no stored credential)
 * and failing over to the next on an exhausted/non-retryable failure from
 * a connector the tenant *has* connected — realizing Story 2.9's own AC4
 * ("fails over or skips according to configured behavior") without any
 * change to GNews's or Newswire's own ingest functions, which still only
 * ever call enrichPost(tenantId, text) (AC2).
 *
 * Contract encoded here:
 * - AC1: azureOpenAiConnector is a real AIProviderConnector, registered
 *   alongside azureAiLanguageConnector (ADR-0002's shared registry),
 *   implementing the full required interface with a distinct providerId.
 * - AC2: enrichPost() resolves either provider generically via each
 *   tenant's own stored credential — no core ingestion pipeline code
 *   (pollGNewsSearch.ts/pollNewswireFeeds.ts) needed to change for this
 *   story (structural check: neither file references azureOpenAiConnector
 *   or azure-openai directly — enrichPost() is still their only call site).
 * - AC3: rate limiting, credential resolution, and error handling are
 *   genuinely isolated per provider (two tenants, two different providers,
 *   two independent RequestGate keys; a malformed Azure OpenAI credential
 *   fails only that provider's own attempt).
 * - AC4: provider swap (a tenant using Azure OpenAI enriches successfully,
 *   the same as a tenant using Azure AI Language) and provider "removal"
 *   (a tenant with no credential for a given provider skips it without
 *   failing ingestion) are both proven with real calls; enrichPost() still
 *   never throws.
 * - AC5: two tenants on different providers are mutually unaffected — one
 *   tenant's missing/broken provider credential does not degrade the
 *   other's real enrichment call.
 *
 * Explicitly out of scope (per Story 2.9's own AC2 and ADR-0038's own
 * Decision §2): no change to azureAiLanguageConnector.ts's own analyze()
 * logic; no third provider; no cross-provider result-merging (only one
 * provider's result is ever used per post, whichever succeeds first).
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { azureAiLanguageConnector, AZURE_AI_LANGUAGE_PROVIDER_ID } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';
import { azureOpenAiConnector, AZURE_OPENAI_PROVIDER_ID } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import { enrichPost } from '../../src/connectors/azureAiLanguage/enrichPost';
import { getAIProviderConnector } from '../../src/connectors/registry';
import { acquireForAiModel } from '../../src/connectors/requestGate';

jest.setTimeout(60000);

const REAL_LANGUAGE_ENDPOINT = process.env.AZURE_AI_LANGUAGE_ENDPOINT as string;
const REAL_LANGUAGE_KEY = process.env.AZURE_AI_LANGUAGE_KEY as string;
const REAL_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT as string;
const REAL_OPENAI_KEY = process.env.AZURE_OPENAI_KEY as string;
const REAL_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT as string;

if (!REAL_LANGUAGE_ENDPOINT || !REAL_LANGUAGE_KEY) {
  throw new Error('AZURE_AI_LANGUAGE_ENDPOINT/AZURE_AI_LANGUAGE_KEY must be set (see .env) — this contract requires the real resource.');
}
if (!REAL_OPENAI_ENDPOINT || !REAL_OPENAI_KEY || !REAL_OPENAI_DEPLOYMENT) {
  throw new Error('AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_KEY/AZURE_OPENAI_DEPLOYMENT must be set (see .env) — this contract requires the real resource.');
}

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
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<string> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 5]
  );
  return rows[0].id;
}

async function seedAzureAiLanguageCredential(tenantId: string): Promise<void> {
  await storeCredential(
    tenantId,
    AZURE_AI_LANGUAGE_PROVIDER_ID,
    JSON.stringify({ endpoint: REAL_LANGUAGE_ENDPOINT, key: REAL_LANGUAGE_KEY }),
    testKeyId,
    'tenant'
  );
}

async function seedAzureOpenAiCredential(tenantId: string): Promise<void> {
  await storeCredential(
    tenantId,
    AZURE_OPENAI_PROVIDER_ID,
    JSON.stringify({ endpoint: REAL_OPENAI_ENDPOINT, key: REAL_OPENAI_KEY, deployment: REAL_OPENAI_DEPLOYMENT }),
    testKeyId,
    'tenant'
  );
}

describe('Story 2.9 — Second AIProviderConnector (Azure OpenAI, real gpt-5-mini)', () => {
  describe('AC1: azureOpenAiConnector is a real, registered AIProviderConnector alongside azureAiLanguageConnector', () => {
    it('has a distinct providerId, implements the full interface, and is discoverable via the shared registry', () => {
      expect(azureOpenAiConnector.providerId).toBe('azure-openai');
      expect(azureOpenAiConnector.providerId).not.toBe(AZURE_AI_LANGUAGE_PROVIDER_ID);
      expect(azureOpenAiConnector.authMode).toBe('api_key');
      expect(typeof azureOpenAiConnector.listModels).toBe('function');
      expect(typeof azureOpenAiConnector.getModelRateLimit).toBe('function');
      expect(typeof azureOpenAiConnector.getModelCapabilities).toBe('function');
      expect(typeof azureOpenAiConnector.analyze).toBe('function');
      expect(azureOpenAiConnector.listModels().length).toBeGreaterThan(0);

      // Registration is a real side effect of importing enrichPost.ts (see its
      // own module-top registerAIProviderConnector() calls) — both real
      // connectors are discoverable via the shared framework registry, not
      // just structurally provable via Story 2.1's own example fixtures.
      expect(getAIProviderConnector(AZURE_OPENAI_PROVIDER_ID)).toBe(azureOpenAiConnector);
      expect(getAIProviderConnector(AZURE_AI_LANGUAGE_PROVIDER_ID)).toBe(azureAiLanguageConnector);
    });

    it('analyze() rejects with no credential, never falling back to a shared key', async () => {
      await expect(azureOpenAiConnector.analyze(REAL_OPENAI_DEPLOYMENT as string, 'hello world')).rejects.toThrow();
    });
  });

  describe('AC1 (real call): a real call against the real Azure OpenAI resource returns all four enrichment fields from a single structured-output call', () => {
    it('maps a real gpt-5-mini structured-output response into AnalyzeResult', async () => {
      const credential = JSON.stringify({ endpoint: REAL_OPENAI_ENDPOINT, key: REAL_OPENAI_KEY, deployment: REAL_OPENAI_DEPLOYMENT });
      const text = 'AcmeCorp announced today that its new product launch in Berlin was a tremendous success, delighting customers across Europe.';

      const result = await azureOpenAiConnector.analyze(REAL_OPENAI_DEPLOYMENT as string, text, credential);

      expect(['positive', 'neutral', 'negative', 'mixed']).toContain(result.sentiment);
      expect(result.sentimentScores).toBeDefined();
      expect(typeof result.sentimentScores?.positive).toBe('number');
      expect(typeof result.sentimentScores?.neutral).toBe('number');
      expect(typeof result.sentimentScores?.negative).toBe('number');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities?.length).toBeGreaterThan(0);
      for (const entity of result.entities ?? []) {
        expect(typeof entity.text).toBe('string');
        expect(typeof entity.category).toBe('string');
        expect(typeof entity.confidenceScore).toBe('number');
      }
      expect(Array.isArray(result.keyPhrases)).toBe(true);
      expect(typeof result.detectedLanguage).toBe('string');
      expect(result.detectedLanguage).toBe('en');
      expect(result.modelUsed).toContain(AZURE_OPENAI_PROVIDER_ID);
    });
  });

  describe('AC2: adding this connector required no changes to core ingestion orchestration/pipeline code', () => {
    it('neither pollGNewsSearch.ts nor pollNewswireFeeds.ts references azureOpenAiConnector or azure-openai directly — enrichPost() is still their only enrichment call site', () => {
      const gnewsSrc = fs.readFileSync(path.join(__dirname, '../../src/connectors/gnews/pollGNewsSearch.ts'), 'utf-8');
      const newswireSrc = fs.readFileSync(path.join(__dirname, '../../src/connectors/newswire/pollNewswireFeeds.ts'), 'utf-8');

      expect(gnewsSrc).toContain('enrichPost(');
      expect(gnewsSrc).not.toContain('azureOpenAiConnector');
      expect(gnewsSrc).not.toContain('azure-openai');

      expect(newswireSrc).toContain('enrichPost(');
      expect(newswireSrc).not.toContain('azureOpenAiConnector');
      expect(newswireSrc).not.toContain('azure-openai');
    });
  });

  describe('AC3/AC4: provider swap — a tenant connected to Azure OpenAI enriches successfully via enrichPost(), the same as a tenant connected to Azure AI Language', () => {
    it('a tenant with only an Azure OpenAI credential enriches through azureOpenAiConnector', async () => {
      const tenantId = await createTenantFixture(`OpenAiTenant-${randomUUID()}`);
      await seedAzureOpenAiCredential(tenantId);

      const result = await enrichPost(tenantId, 'GlobeWire reported strong quarterly earnings for TechCorp today.');

      expect(result).toBeDefined();
      expect(result?.modelUsed).toContain(AZURE_OPENAI_PROVIDER_ID);
    });

    it('a tenant with only an Azure AI Language credential still enriches through azureAiLanguageConnector, unaffected by azureOpenAiConnector existing', async () => {
      const tenantId = await createTenantFixture(`LanguageTenant-${randomUUID()}`);
      await seedAzureAiLanguageCredential(tenantId);

      const result = await enrichPost(tenantId, 'GlobeWire reported strong quarterly earnings for TechCorp today.');

      expect(result).toBeDefined();
      expect(result?.modelUsed).toContain(AZURE_AI_LANGUAGE_PROVIDER_ID);
    });
  });

  describe('AC4: provider "removal" — a tenant with no credential for a given provider skips it without failing ingestion', () => {
    it('a tenant with neither provider connected resolves to undefined, never throws', async () => {
      const tenantId = await createTenantFixture(`NoCredentialTenant-${randomUUID()}`);

      await expect(enrichPost(tenantId, 'Some post text with no connected AI provider.')).resolves.toBeUndefined();
    });
  });

  describe('AC5: removing/breaking one provider does not degrade a tenant using the other provider', () => {
    it('a tenant on Azure OpenAI enriches successfully even though a different tenant\'s Azure AI Language credential is malformed', async () => {
      const brokenTenantId = await createTenantFixture(`BrokenLanguageTenant-${randomUUID()}`);
      await storeCredential(
        brokenTenantId,
        AZURE_AI_LANGUAGE_PROVIDER_ID,
        JSON.stringify({ endpoint: REAL_LANGUAGE_ENDPOINT, key: 'not-a-real-key' }),
        testKeyId,
        'tenant'
      );

      const healthyTenantId = await createTenantFixture(`HealthyOpenAiTenant-${randomUUID()}`);
      await seedAzureOpenAiCredential(healthyTenantId);

      const [brokenResult, healthyResult] = await Promise.all([
        enrichPost(brokenTenantId, 'A post that will fail enrichment.'),
        enrichPost(healthyTenantId, 'A post that should enrich successfully via Azure OpenAI.'),
      ]);

      expect(brokenResult).toBeUndefined();
      expect(healthyResult).toBeDefined();
      expect(healthyResult?.modelUsed).toContain(AZURE_OPENAI_PROVIDER_ID);
    });
  });

  describe('AC3: rate limiting is isolated per provider, not shared across providerIds', () => {
    it('two tenants on different providers acquire independently via acquireForAiModel(), neither blocking the other', async () => {
      const tenantA = await createTenantFixture(`GateTenantLanguage-${randomUUID()}`);
      const tenantB = await createTenantFixture(`GateTenantOpenAi-${randomUUID()}`);

      const languageModelId = azureAiLanguageConnector.listModels()[0];
      const openAiModelId = azureOpenAiConnector.listModels()[0];

      await expect(
        Promise.all([
          acquireForAiModel(tenantA, azureAiLanguageConnector, languageModelId),
          acquireForAiModel(tenantB, azureOpenAiConnector, openAiModelId),
        ])
      ).resolves.toBeDefined();
    });
  });

  describe('AC4/never-throws: a non-retryable Azure OpenAI failure (bad credential) is skipped, not thrown', () => {
    it('a malformed Azure OpenAI credential resolves enrichPost() to undefined, never rejects', async () => {
      const tenantId = await createTenantFixture(`BadOpenAiCredentialTenant-${randomUUID()}`);
      await storeCredential(
        tenantId,
        AZURE_OPENAI_PROVIDER_ID,
        JSON.stringify({ endpoint: REAL_OPENAI_ENDPOINT, key: 'definitely-not-a-real-key', deployment: REAL_OPENAI_DEPLOYMENT }),
        testKeyId,
        'tenant'
      );

      await expect(enrichPost(tenantId, 'A post whose enrichment credential is bad.')).resolves.toBeUndefined();
    });
  });
});
