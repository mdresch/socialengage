/**
 * Intent — Story 2.17 (Azure OpenAI's structured enrichment call also
 * returns a stored `summary` field), sourced from no new ADR (additive
 * widening of ADR-0002/ADR-0038's own already-Accepted AIProviderConnector
 * interface, the same pattern Story 2.8/2.9 already used for
 * sentimentScores/entities/overallConfidence).
 *
 * Scope: src/connectors/types.ts (AnalyzeResult gains optional
 * summary?: string), src/connectors/azureOpenAi/azureOpenAiConnector.ts
 * (ENRICHMENT_SCHEMA gains a required `summary` property, system prompt
 * extended to request it, response mapping extended), this contract file
 * (new), .claude/skills/azure-openai-connector/SKILL.md (updated).
 *
 * Requested directly by Menno, 2026-08-18, following this session's live
 * Wikipedia-enrichment investigation (Story 2.16). azureOpenAiConnector.ts's
 * existing single structured-output call already reads the entire input
 * text and returns five enrichment fields in one real HTTP request,
 * confirmed this session to accept a full ~37KB Wikipedia article body with
 * no size-based rejection (unlike Azure AI Language's real, confirmed
 * 5,120-character document limit, Story 2.16). This story adds one more
 * property to that same schema/call — a concise summary — at zero
 * additional API calls, not a separate summarization pass.
 *
 * A real, honest scope limitation: enrichPost.ts tries Azure AI Language
 * first (Menno's own confirmed intentional default, 2026-08-12) and it
 * succeeds for most ordinary-length content — Azure AI Language's four
 * capabilities have no summarization output of their own (real Azure AI
 * Language document summarization is a separate, asynchronous endpoint,
 * verified this session — a materially heavier build, not this story's
 * scope, tracked as a real follow-up per Menno's own "see how it works,
 * then decide" direction). `summary` is therefore populated only for posts
 * that actually reach Azure OpenAI.
 *
 * Contract encoded here:
 * - AC1: AnalyzeResult gains an optional summary field; azureAiLanguageConnector
 *   is unaffected (verified via Story 2.16's own file, no change needed here).
 * - AC2: a real call against the real Azure OpenAI resource returns a
 *   non-empty summary string alongside the five existing fields, genuinely
 *   shorter than the real input text supplied.
 * - AC3: the returned summary round-trips through insertSocialPost() into
 *   SocialPost.enrichment.summary unchanged — no new migration, no new
 *   column, since enrichment is already an unfiltered JSONB blob.
 * - AC4: a tenant whose enrichment is actually served by Azure AI Language
 *   (both providers connected/active, the existing fixed-order default)
 *   has enrichment.summary absent, not a placeholder.
 *
 * Explicitly out of scope: any UI surfacing of summary; giving Azure AI
 * Language its own summarization capability (the separate, asynchronous
 * Document Summarization endpoint — a real, named follow-up, not built
 * here); reordering PROVIDERS so Azure OpenAI runs for every post (a
 * separate decision, not made by this story); Story 2.16's own found-live
 * retryable-classification inefficiency for oversized-document fail-over
 * (tracked separately).
 */
import { randomUUID } from 'crypto';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { azureAiLanguageConnector, AZURE_AI_LANGUAGE_PROVIDER_ID } from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';
import { azureOpenAiConnector, AZURE_OPENAI_PROVIDER_ID } from '../../src/connectors/azureOpenAi/azureOpenAiConnector';
import { enrichPost } from '../../src/connectors/azureAiLanguage/enrichPost';

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

async function seedAzureOpenAiCredential(tenantId: string): Promise<void> {
  await storeCredential(
    tenantId,
    AZURE_OPENAI_PROVIDER_ID,
    JSON.stringify({ endpoint: REAL_OPENAI_ENDPOINT, key: REAL_OPENAI_KEY, deployment: REAL_OPENAI_DEPLOYMENT }),
    testKeyId,
    'tenant'
  );
  await setConnectorActivation(tenantId, AZURE_OPENAI_PROVIDER_ID, 'tenant', true);
}

async function seedAzureAiLanguageCredential(tenantId: string): Promise<void> {
  await storeCredential(
    tenantId,
    AZURE_AI_LANGUAGE_PROVIDER_ID,
    JSON.stringify({ endpoint: REAL_LANGUAGE_ENDPOINT, key: REAL_LANGUAGE_KEY }),
    testKeyId,
    'tenant'
  );
  await setConnectorActivation(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, 'tenant', true);
}

const LONG_ARTICLE_TEXT =
  'AcmeCorp today announced the launch of its new AI-powered analytics platform at a press event in Berlin. ' +
  'CEO Jane Doe said the product represents years of research into machine learning and natural language processing. ' +
  'The platform, called Insight360, integrates with existing enterprise data warehouses and provides real-time dashboards. ' +
  'Early customers including GlobalTech and Meridian Systems reported significant efficiency gains during the beta period. ' +
  'Analysts at Berlin Capital Research noted that the launch positions AcmeCorp competitively against established players ' +
  'in the business intelligence space. The company plans to expand the platform to additional European markets next quarter, ' +
  'with a North American rollout expected by year end. Industry observers have praised the product for its ease of use and ' +
  'transparent pricing model, a departure from the complex licensing schemes common among competitors in this sector.';

describe('Story 2.17 — Azure OpenAI structured enrichment gains a stored summary field', () => {
  describe('AC2: a real call against the real Azure OpenAI resource returns a non-empty summary shorter than the input', () => {
    it('maps a real gpt-5-mini structured-output response into AnalyzeResult.summary', async () => {
      const credential = JSON.stringify({ endpoint: REAL_OPENAI_ENDPOINT, key: REAL_OPENAI_KEY, deployment: REAL_OPENAI_DEPLOYMENT });

      const result = await azureOpenAiConnector.analyze(REAL_OPENAI_DEPLOYMENT as string, LONG_ARTICLE_TEXT, credential);

      expect(typeof result.summary).toBe('string');
      expect(result.summary!.length).toBeGreaterThan(0);
      expect(result.summary!.length).toBeLessThan(LONG_ARTICLE_TEXT.length);
      // The five fields this connector already returned (Story 2.9) are
      // unaffected by this addition — a real regression check, not assumed.
      expect(['positive', 'neutral', 'negative', 'mixed']).toContain(result.sentiment);
      expect(Array.isArray(result.entities)).toBe(true);
    });
  });

  describe('AC3: the returned summary round-trips through insertSocialPost() into SocialPost.enrichment.summary unchanged', () => {
    it('a real enrichPost() result for an Azure-OpenAI-only tenant stores enrichment.summary', async () => {
      const tenantId = await createTenantFixture(`SummaryPipeline-${randomUUID()}`);
      await seedAzureOpenAiCredential(tenantId);

      const run = await startIngestionRun(tenantId, {
        platformId: 'example-poll',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const enrichment = await enrichPost(tenantId, LONG_ARTICLE_TEXT);
      expect(enrichment).toBeDefined();
      expect(enrichment?.summary).toBeDefined();

      const { id } = await insertSocialPost({
        tenantId,
        authorId: null,
        acquisitionId: run.id,
        rawPayload: { text: LONG_ARTICLE_TEXT },
        enrichment: enrichment as unknown as Record<string, unknown>,
      });

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ enrichment: { summary: string } }>(`SELECT enrichment FROM social_posts WHERE id = $1`, [id])
      );
      expect(rows[0].enrichment.summary).toBe(enrichment!.summary);
    });
  });

  describe('AC4: a tenant served by Azure AI Language (the default when both providers are connected/active) has no summary field, not a placeholder', () => {
    it('enrichPost() result served by Azure AI Language carries no summary key', async () => {
      const tenantId = await createTenantFixture(`BothActiveNoSummary-${randomUUID()}`);
      await seedAzureOpenAiCredential(tenantId);
      await seedAzureAiLanguageCredential(tenantId);

      const result = await enrichPost(tenantId, 'A short post both providers could handle.');

      expect(result).toBeDefined();
      expect(result?.modelUsed).toContain(AZURE_AI_LANGUAGE_PROVIDER_ID);
      expect(result?.summary).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(result ?? {}, 'summary')).toBe(false);
    });
  });
});
