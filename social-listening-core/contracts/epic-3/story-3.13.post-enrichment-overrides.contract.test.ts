import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePool, getPool } from '../../src/db/pool';
import { closeAdminPool } from '../../src/db/adminPool';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { insertSocialPost } from '../../src/posts/socialPostStore';
import * as enrichPostModule from '../../src/connectors/azureAiLanguage/enrichPost';

/**
 * Contract Test for Story 3.13 — Post Enrichment Overrides API & Precedence Guard (ADR-0071)
 *
 * Verifies:
 * - AC1: PATCH /v1/posts/:id/enrichment updates sentiment, sentimentScore, keyPhrases, detectedLanguage, geoCountry, summary.
 * - AC2: Validation and sanitization (sentiment auto-scoring, key phrases sanitization & deduplication, ISO 639-1 language validation, ISO 3166-1 alpha-2 geo normalization).
 * - AC3: Audit history and override schema in enrichment.override (isOverridden: true, overriddenAt, overriddenByUserId, overriddenFields, originalValues, aiHistory).
 * - AC4: Re-enrichment precedence guard: POST /v1/posts/:id/enrich returns 409 Conflict when isOverridden === true unless force === true.
 * - AC5: Multi-tenant RLS isolation: cross-tenant PATCH attempts return 404 Not Found.
 */

jest.setTimeout(30000);

afterAll(async () => {
  await closeAdminPool();
  await closePool();
});

async function makeTenantWithUser(role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

function identityHeader(tenantId: string, userId: string, role: 'tenant_admin' | 'tenant_user' = 'tenant_user'): string {
  return testIdentityHeaderValue(tenantId, { userId, role });
}

describe('Story 3.13 Contract: Post Enrichment Overrides API & Precedence Guard (ADR-0071)', () => {
  const app = createApp();
  let tenantA: string;
  let userA: string;
  let tenantB: string;
  let userB: string;
  let acquisitionIdA: string;
  let acquisitionIdB: string;

  beforeAll(async () => {
    const tA = await makeTenantWithUser('tenant_user');
    tenantA = tA.tenantId;
    userA = tA.userId;

    const tB = await makeTenantWithUser('tenant_user');
    tenantB = tB.tenantId;
    userB = tB.userId;

    const runA = await startIngestionRun(tenantA, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    acquisitionIdA = runA.id;

    const runB = await startIngestionRun(tenantB, {
      platformId: 'example-poll',
      triggerType: 'poll',
      connectorVersion: '1.0.0',
    });
    acquisitionIdB = runB.id;
  });

  describe('AC1 & AC3: PATCH /v1/posts/:id/enrichment updates fields and writes override audit metadata', () => {
    it('successfully overrides enrichment fields and records audit lineage', async () => {
      const initialEnrichment = {
        sentiment: 'neutral',
        sentimentScore: 0.5,
        keyPhrases: ['original phrase', 'cloud'],
        detectedLanguage: 'en',
        geoCountry: 'US',
        geoCountryName: 'United States',
        summary: 'Original AI summary',
      };

      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Test Post for Override' },
        enrichment: initialEnrichment,
      });

      const patchPayload = {
        sentiment: 'positive',
        sentimentScore: 0.95,
        keyPhrases: ['Updated Tech', 'ai innovation'],
        detectedLanguage: 'en',
        geoCountry: 'GB',
        summary: 'Corrected human summary note',
      };

      const res = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send(patchPayload);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(post.id);
      expect(res.body.enrichment).toBeDefined();
      expect(res.body.enrichment.sentiment).toBe('positive');
      expect(res.body.enrichment.sentimentScore).toBe(0.95);
      expect(res.body.enrichment.keyPhrases).toEqual(['Updated Tech', 'ai innovation']);
      expect(res.body.enrichment.geoCountry).toBe('GB');
      expect(res.body.enrichment.geoCountryName).toBe('United Kingdom');
      expect(res.body.enrichment.summary).toBe('Corrected human summary note');

      // Check override audit metadata
      const override = res.body.enrichment.override;
      expect(override).toBeDefined();
      expect(override.isOverridden).toBe(true);
      expect(override.overriddenByUserId).toBe(userA);
      expect(override.overriddenAt).toBeDefined();
      expect(Array.isArray(override.overriddenFields)).toBe(true);
      expect(override.overriddenFields).toEqual(
        expect.arrayContaining(['sentiment', 'sentimentScore', 'keyPhrases', 'geoCountry', 'summary'])
      );
      expect(override.originalValues).toEqual(
        expect.objectContaining({
          sentiment: 'neutral',
          sentimentScore: 0.5,
          geoCountry: 'US',
        })
      );
    });

    it('auto-assigns default sentiment score when sentiment is updated without sentimentScore', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Post with default scoring' },
        enrichment: { sentiment: 'neutral', sentimentScore: 0.5 },
      });

      const res = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ sentiment: 'negative' });

      expect(res.status).toBe(200);
      expect(res.body.enrichment.sentiment).toBe('negative');
      expect(res.body.enrichment.sentimentScore).toBe(0.2); // Default for negative
    });
  });

  describe('AC2: Validation and Sanitization Rules', () => {
    it('sanitizes keyPhrases by stripping HTML, trimming whitespace, and deduplicating case-insensitively', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Post for phrase sanitization' },
      });

      const res = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({
          keyPhrases: [
            '  <b>Artificial Intelligence</b>  ',
            'artificial intelligence', // duplicate case-insensitive
            '   ', // empty phrase
            'Cloud Computing',
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.enrichment.keyPhrases).toEqual([
        'Artificial Intelligence',
        'Cloud Computing',
      ]);
    });

    it('rejects invalid ISO 639-1 language codes with 400 Bad Request', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Post for lang validation' },
      });

      const res = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ detectedLanguage: 'invalid-lang-code' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_LANGUAGE_CODE');
    });

    it('rejects invalid sentiment value or out-of-bounds sentiment score with 400 Bad Request', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Post for score validation' },
      });

      const res1 = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ sentiment: 'super_happy' as any });

      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ sentimentScore: 1.5 });

      expect(res2.status).toBe(400);
    });

    it('clears geoCountryName when geoCountry is set to null', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Post for geo clear' },
        enrichment: { geoCountry: 'US', geoCountryName: 'United States' },
      });

      const res = await request(app)
        .patch(`/v1/posts/${post.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ geoCountry: null });

      expect(res.status).toBe(200);
      expect(res.body.enrichment.geoCountry).toBeNull();
      expect(res.body.enrichment.geoCountryName).toBeNull();
    });
  });

  describe('AC4: Re-Enrichment Precedence Guard on POST /v1/posts/:id/enrich', () => {
    it('returns 409 Conflict when attempting to re-enrich an overridden post without force: true', async () => {
      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Overridden Post' },
        enrichment: {
          sentiment: 'positive',
          override: {
            isOverridden: true,
            overriddenAt: new Date().toISOString(),
            overriddenByUserId: userA,
            overriddenFields: ['sentiment'],
          },
        },
      });

      const res = await request(app)
        .post(`/v1/posts/${post.id}/enrich`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ENRICHMENT_MANUALLY_OVERRIDDEN');
      expect(res.body.override).toBeDefined();
    });

    it('allows re-enrichment when force: true is explicitly provided and archives previous override in aiHistory', async () => {
      const enrichSpy = jest.spyOn(enrichPostModule, 'enrichPost').mockResolvedValueOnce({
        sentiment: 'neutral',
        sentimentScore: 0.5,
        keyPhrases: ['re-enriched'],
        detectedLanguage: 'en',
        modelUsed: 'azure-openai-gpt-5-mini',
      } as any);

      const post = await insertSocialPost({
        tenantId: tenantA,
        authorId: null,
        acquisitionId: acquisitionIdA,
        rawPayload: { title: 'Overridden Post Force Re-enrich' },
        enrichment: {
          sentiment: 'positive',
          override: {
            isOverridden: true,
            overriddenAt: new Date().toISOString(),
            overriddenByUserId: userA,
            overriddenFields: ['sentiment'],
            originalValues: { sentiment: 'neutral' },
          },
        },
      });

      const res = await request(app)
        .post(`/v1/posts/${post.id}/enrich`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ force: true });

      expect(res.status).toBe(200);
      expect(res.body.enrichment).toBeDefined();
      expect(res.body.enrichment.override?.isOverridden).toBe(false);
      expect(res.body.enrichment.override?.aiHistory?.length).toBeGreaterThan(0);
      enrichSpy.mockRestore();
    });
  });

  describe('AC5: Multi-Tenant RLS and 404 Isolation', () => {
    it('returns 404 Not Found when a tenant tries to PATCH a post belonging to another tenant', async () => {
      const postTenantB = await insertSocialPost({
        tenantId: tenantB,
        authorId: null,
        acquisitionId: acquisitionIdB,
        rawPayload: { title: 'Tenant B Post' },
        enrichment: { sentiment: 'neutral' },
      });

      const res = await request(app)
        .patch(`/v1/posts/${postTenantB.id}/enrichment`)
        .set('X-Test-Identity', identityHeader(tenantA, userA))
        .send({ sentiment: 'negative' });

      expect(res.status).toBe(404);
    });
  });
});
