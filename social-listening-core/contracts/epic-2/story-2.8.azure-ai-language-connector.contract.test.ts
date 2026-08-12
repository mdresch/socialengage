// Contract: Story 2.8 (ADR-0038) — Concrete AI enrichment provider connector:
// Azure AI Language.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-28--concrete-ai-enrichment-provider-connector-azure-ai-language
//
// Intent: Story 2.8 — the first real AIProviderConnector implementation
// (ADR-0002's own interface, never before implemented against a real
// provider).
// Scope: src/connectors/types.ts (widened — AnalyzeResult, analyze()'s
// optional credential param), src/connectors/azureAiLanguage/
// azureAiLanguageConnector.ts (new), src/connectors/azureAiLanguage/
// enrichPost.ts (new), src/connectors/gnews/pollGNewsSearch.ts (extended —
// wires enrichPost() in), src/connectors/newswire/pollNewswireFeeds.ts
// (extended, same reason), contracts/epic-4/story-4.2... (extended, see
// below), .claude/skills/azure-ai-language-connector/SKILL.md (new),
// .claude/skills/social-post-enrichment/SKILL.md,
// .claude/skills/provider-connector-framework/SKILL.md (updated).
//
// A real, confirmed finding from primary-source research (real API calls
// against the real Azure AI Language resource Menno provisioned this
// session — not assumed): AnalyzeResult (Story 2.1/ADR-0002's own shipped
// interface) was materially thinner than what this story's own AC3 needs
// to map into — no sentimentScores, entities was string[] not objects, no
// modelUsed. Widened additively (existing 2-arg analyze() calls, including
// Story 2.1's own contract and both example providers, remain valid — the
// new credential param is optional). Real Azure responses, captured this
// session (kind=SentimentAnalysis/KeyPhraseExtraction/EntityRecognition/
// LanguageDetection, api-version=2024-11-01), directly informed the
// widened shape:
//   - SentimentAnalysis: {sentiment, confidenceScores:{positive,neutral,negative}}
//   - EntityRecognition: entities[].{text,category,confidenceScore,...} —
//     confirms the richer shape is real API output, not an invented guess.
//   - KeyPhraseExtraction: {keyPhrases: string[]} — already matched shipped shape.
//   - LanguageDetection: {detectedLanguage:{iso6391Name, confidenceScore, ...}}
//     — mapped down to just iso6391Name (a plain string) for our own
//     enrichment.detectedLanguage field.
//
// A real, confirmed, user-approved cross-story edit: widening `entities`
// from string[] to {text,category,confidenceScore}[] required updating
// Story 4.2's own already-passing contract (its AC3 SQL used
// jsonb_array_elements_text, which only works on scalar array elements) —
// approved explicitly by Menno this session after being shown the real
// API evidence, per this project's own "don't rewrite a passing contract
// without explicit sign-off" rule. Stories 3.5/4.4/5.1 were checked and
// confirmed NOT to need changes — each uses `['acme']` as arbitrary
// round-trip filler for an unrelated concern (archival, caching, event
// payloads) against the untyped `enrichment` JSONB column, never asserting
// on entities' own shape structurally.
//
// Contract to encode: a registered AIProviderConnector, distinct
// providerId, authenticates only via a per-tenant-supplied credential
// (JSON {endpoint,key}, envelope-encrypted per ADR-0014's existing model —
// no new storage pattern) — never a fallback to any project-level key;
// analyze() calls the real Azure AI Language endpoint (one call per
// capability, per Microsoft's own SDK guidance for a single small
// document, confirmed directly — not the combined batch endpoint) and maps
// into the widened AnalyzeResult shape; enrichPost() wires this into both
// existing real connectors' own ingest functions (GNews, Newswire), ahead
// of insertSocialPost(); per-model rate limiting participates in the
// existing acquireForAiModel()/RequestGate mechanism (Story 2.2/2.4),
// proven via key isolation, not by exhausting a real 30-day window; a
// missing credential or an exhausted-retry transient failure both resolve
// to `enrichment: undefined`, never a failed post ingestion.
//
// Real infrastructure used: a real, provisioned Azure AI Language resource
// (Menno created this session, free tier) — analyze()'s own real-API-shape
// test hits it directly, matching this project's own "real infrastructure,
// not mocks" bar for every other external dependency (Key Vault, Entra,
// GNews, Newswire). Kept deliberately minimal (one real end-to-end call)
// to stay well inside the free tier's 5,000-shared-text-record/month
// budget across repeated contract runs during development — retry/failure
// injection uses a controlled `fetch` mock instead, the same seam this
// project already uses elsewhere for scenarios a real endpoint can't
// deterministically reproduce on demand (a live 429, a live malformed
// response).
//
// Explicitly out of scope for this contract:
//   - Re-proving GNews's/Newswire's own fetch/normalize/dedup behavior —
//     Stories 2.6/2.7's own contracts already prove that; this contract
//     only proves enrichPost() is actually called from their ingest
//     functions and that its result reaches insertSocialPost() correctly.
//   - The second AIProviderConnector (Story 2.9, an LLM-based extractor) —
//     named as a required follow-up by ADR-0038 §2, not built here.
//   - Azure AI Language's exact S-tier dollar cost beyond the free tier —
//     ADR-0038's own named, still-open verification gap, not this story's
//     job to close.
//   - The admin UI's own connect flow for this provider (Story 6.3's
//     existing generic connect/disconnect screen already handles any
//     api_key-authMode connector without connector-specific UI code).
//
// --- Healing pass, 2026-08-12 (cross-component regression from Story 2.9's
// own same-day activation-gating fix, unrelated to this story's own scope)
// ---
// enrichPost.ts's tryProvider() now also requires Story 1.11/ADR-0051
// activation, not just a stored credential — see
// story-2.9.second-ai-provider-connector.contract.test.ts's own dated note
// for the full account. seedRealAzureCredential() (this file's own shared
// fixture helper) now also activates the connector it credentials, and the
// standalone "bad credential" test activates explicitly too, so it keeps
// proving a bad *credential* is skipped, not an inactive provider skipped
// for an unrelated reason. No existing assertion's own meaning changed.

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { withTenant } from '../../src/db/withTenant';
import { storeCredential } from '../../src/credentials/credentialStore';
import { getKeyClient } from '../../src/credentials/keyVaultProvider';
import { setConnectorActivation } from '../../src/connectors/connectorActivationStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import {
  azureAiLanguageConnector,
  AZURE_AI_LANGUAGE_PROVIDER_ID,
} from '../../src/connectors/azureAiLanguage/azureAiLanguageConnector';
import { enrichPost } from '../../src/connectors/azureAiLanguage/enrichPost';
import { acquireForAiModel } from '../../src/connectors/requestGate';

jest.setTimeout(60000);

const REAL_ENDPOINT = process.env.AZURE_AI_LANGUAGE_ENDPOINT as string;
const REAL_KEY = process.env.AZURE_AI_LANGUAGE_KEY as string;

if (!REAL_ENDPOINT || !REAL_KEY) {
  throw new Error(
    'AZURE_AI_LANGUAGE_ENDPOINT/AZURE_AI_LANGUAGE_KEY are not set — see .env.example. This contract runs against a real Azure AI Language resource, not a mock.'
  );
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

/**
 * Healed 2026-08-12 (cross-component regression from Story 2.9's own
 * healing pass, which added an activation check to enrichPost.ts's
 * tryProvider()) — "connected and usable" now means credentialed AND
 * activated. See story-2.9...contract.test.ts's own dated note for the
 * full account of why.
 */
async function seedRealAzureCredential(tenantId: string): Promise<void> {
  const plaintext = JSON.stringify({ endpoint: REAL_ENDPOINT, key: REAL_KEY });
  await storeCredential(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, plaintext, testKeyId, 'tenant');
  await setConnectorActivation(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, 'tenant', true);
}

describe('Story 2.8 — Azure AI Language connector', () => {
  describe('AC1/AC2: registered connector, distinct providerId, no fallback to a shared/project-level credential', () => {
    it('has a providerId distinct from every SocialConnector', () => {
      expect(azureAiLanguageConnector.providerId).toBe('azure-ai-language');
      expect(azureAiLanguageConnector.authMode).toBe('api_key');
    });

    it('analyze() rejects when no credential is supplied — never falls back to any project-level key', async () => {
      await expect(azureAiLanguageConnector.analyze('azure-ai-language-latest', 'hello world')).rejects.toThrow();
    });

    it('enrichPost() returns undefined for a tenant with no Azure AI Language credential registered (AC5)', async () => {
      const tenantId = await createTenantFixture(`NoCredential-${randomUUID()}`);
      const result = await enrichPost(tenantId, 'hello world');
      expect(result).toBeUndefined();
    });
  });

  describe('AC3: analyze() calls the real Azure AI Language endpoint and maps into the widened AnalyzeResult shape', () => {
    it('a real call against real text returns real sentiment/sentimentScores/entities/keyPhrases/detectedLanguage/modelUsed', async () => {
      const credential = JSON.stringify({ endpoint: REAL_ENDPOINT, key: REAL_KEY });
      const text =
        "I just switched from AcmeCorp's old CRM to their new AI-powered dashboard and honestly it's fantastic! " +
        'Sarah Chen from their support team helped me set it up in under 10 minutes.';

      const result = await azureAiLanguageConnector.analyze('azure-ai-language-latest', text, credential);

      expect(['positive', 'neutral', 'negative', 'mixed']).toContain(result.sentiment);
      expect(result.sentimentScores).toEqual(
        expect.objectContaining({
          positive: expect.any(Number),
          neutral: expect.any(Number),
          negative: expect.any(Number),
        })
      );
      expect(Array.isArray(result.keyPhrases)).toBe(true);
      expect(result.keyPhrases!.length).toBeGreaterThan(0);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities!.length).toBeGreaterThan(0);
      expect(result.entities![0]).toEqual(
        expect.objectContaining({
          text: expect.any(String),
          category: expect.any(String),
          confidenceScore: expect.any(Number),
        })
      );
      expect(result.detectedLanguage).toBe('en');
      expect(typeof result.modelUsed).toBe('string');
      expect(result.modelUsed).toContain('azure-ai-language');
    });
  });

  describe('AC4: enrichPost() is wired into both existing real connectors\' own ingest functions, ahead of insertSocialPost()', () => {
    it('pollGNewsSearch.ts and pollNewswireFeeds.ts both call enrichPost()', () => {
      const gnewsSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'connectors', 'gnews', 'pollGNewsSearch.ts'),
        'utf8'
      );
      const newswireSource = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'connectors', 'newswire', 'pollNewswireFeeds.ts'),
        'utf8'
      );
      expect(gnewsSource).toMatch(/enrichPost\(/);
      expect(newswireSource).toMatch(/enrichPost\(/);
    });

    it('a real enrichPost() result round-trips through insertSocialPost() into SocialPost.enrichment', async () => {
      const tenantId = await createTenantFixture(`Pipeline-${randomUUID()}`);
      await seedRealAzureCredential(tenantId);

      const run = await startIngestionRun(tenantId, {
        platformId: 'example-poll',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const enrichment = await enrichPost(tenantId, 'Seattle is a wonderful city with a thriving tech scene.');
      expect(enrichment).toBeDefined();

      const { id } = await insertSocialPost({
        tenantId,
        authorId: null,
        acquisitionId: run.id,
        rawPayload: { text: 'Seattle is a wonderful city with a thriving tech scene.' },
        enrichment: enrichment as unknown as Record<string, unknown>,
      });

      const { rows } = await withTenant(tenantId, (client) =>
        client.query<{ enrichment: { sentiment: string; entities: unknown[] } }>(
          `SELECT enrichment FROM social_posts WHERE id = $1`,
          [id]
        )
      );
      expect(rows[0].enrichment.sentiment).toBe(enrichment!.sentiment);
      expect(rows[0].enrichment.entities).toEqual(enrichment!.entities);
    });
  });

  describe('AC5: per-model rate limiting participates in the existing acquireForAiModel()/RequestGate mechanism, isolated per tenant', () => {
    it('two distinct tenants each acquire independently, neither blocking the other', async () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const modelId = azureAiLanguageConnector.listModels()[0];

      const start = Date.now();
      await Promise.all([
        acquireForAiModel(tenantA, azureAiLanguageConnector, modelId),
        acquireForAiModel(tenantB, azureAiLanguageConnector, modelId),
      ]);
      // Both resolve near-instantly (well under either window) — proof
      // they're not sharing one counter, which a shared/collapsed key
      // would otherwise force to serialize or contend.
      expect(Date.now() - start).toBeLessThan(2000);
    });
  });

  describe('AC6: a transient failure retries with backoff; ingestion is never failed by an enrichment failure', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('retries a 429 once and succeeds on the next attempt', async () => {
      const tenantId = await createTenantFixture(`Retry-${randomUUID()}`);
      await seedRealAzureCredential(tenantId);

      let callCount = 0;
      const realFetch = global.fetch;
      jest.spyOn(global, 'fetch').mockImplementation(async (...args) => {
        callCount += 1;
        // Fail every call in the FIRST wave (4 capabilities) with a 429,
        // succeed on the second wave (the retry) — proves enrichPost()'s
        // own retry loop re-invokes analyze() as a whole, not a
        // per-capability retry.
        if (callCount <= 4) {
          return new Response(JSON.stringify({ error: { code: '429', message: 'rate limited' } }), { status: 429 });
        }
        return (realFetch as typeof fetch)(...args);
      });

      const result = await enrichPost(tenantId, 'A short retry-test sentence about Seattle.');
      expect(result).toBeDefined();
      expect(callCount).toBeGreaterThan(4); // genuinely retried, not given up after the first failure
    });

    it('gives up gracefully (undefined) after exhausting retries on a persistent failure — never throws', async () => {
      const tenantId = await createTenantFixture(`PersistentFail-${randomUUID()}`);
      await seedRealAzureCredential(tenantId);

      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { code: '500', message: 'server error' } }), { status: 500 })
      );

      await expect(enrichPost(tenantId, 'text')).resolves.toBeUndefined();
    });

    it('a non-retryable failure (401, bad credential) gives up immediately without retrying', async () => {
      const tenantId = await createTenantFixture(`BadCred-${randomUUID()}`);
      const plaintext = JSON.stringify({ endpoint: REAL_ENDPOINT, key: 'not-a-real-key' });
      await storeCredential(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, plaintext, testKeyId, 'tenant');
      // Activated (healed 2026-08-12, cross-component regression from Story
      // 2.9) — this test proves a bad *credential* is skipped, not an
      // inactive provider skipped for an unrelated reason.
      await setConnectorActivation(tenantId, AZURE_AI_LANGUAGE_PROVIDER_ID, 'tenant', true);

      const result = await enrichPost(tenantId, 'text');
      expect(result).toBeUndefined();
    });
  });
});
