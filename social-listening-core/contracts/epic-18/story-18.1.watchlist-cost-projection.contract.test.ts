// Contract: Story 18.1 (ADR-0134) — Watchlist volume confidence UI and cost projection (backend)
// See docs/user-stories/epic-18-adr-0134-to-0135.md#story-181
//
// Intent: Story 18.1 — Watchlist volume confidence UI and cost projection (ADR-0134, Accepted 2026-08-28)
// Scope:
//   social-listening-core:
//     src/watchlists/previewVolumeService.ts (extend WatchlistVolumePreview with additive estimatedCost,
//       confidence inheritance, and 30-day projection calculation),
//     contracts/epic-18/story-18.1.watchlist-cost-projection.contract.test.ts (new contract test),
//     .claude/skills/watchlist-matching/SKILL.md
// Contract to encode:
//   AC1: WatchlistVolumePreview includes an optional, additive estimatedCost block
//        with storageGbPerMonth, aiEnrichmentCallsPerMonth, currency: 'USD', and confidence.
//   AC2: estimatedCost.confidence inherits the least-confident connector in breakdown:
//        'unavailable' if any connector is unavailable; else 'estimate' if any connector
//        is an estimate; else 'exact' when all connectors are exact (or breakdown is empty).
//   AC3: estimatedCost calculates monthly storage (5 KB per post) and AI enrichment calls
//        (1 call per post) projected to a 30-day month from totalEstimatedPosts and timeWindow.
//   AC4: POST /v1/watchlists/preview-volume retains tenant scoping, RLS gating, and partial
//        failure isolation while returning estimatedCost.
// Explicitly out of scope:
//   - Altering existing fields or method signatures authorized by ADR-0077 / Story 9.1.
//   - Exporting preview to CSV/PDF (deferred by ADR-0134 §4).
//   - Dynamic tenant-custom pricing tiers or multi-currency conversions.

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { createTenant } from '../../src/tenants/tenantStore';
import { createInvitedUser, resolveIdentity } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePool } from '../../src/db/pool';
import { closePlatformAdminPool } from '../../src/db/platformAdminPool';
import {
  registerSocialConnector,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import { __resetGateForTests } from '../../src/connectors/requestGate';
import { SocialConnector, NormalizedPost } from '../../src/connectors/types';
import { parseBooleanQuery } from '../../src/watchlists/ast';
import { previewWatchlistVolume, WatchlistVolumePreview } from '../../src/watchlists/previewVolumeService';

function makeExactConnector(id: string, count: number): SocialConnector {
  return {
    providerId: id,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    async count() {
      return { count, confidence: 'exact', rateLimitCost: 1 };
    },
  };
}

function makeEstimateConnector(id: string, sampleCount: number): SocialConnector {
  return {
    providerId: id,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    async sample() {
      const now = Date.now();
      const oneHourAgo = now - 3600_000;
      const posts: NormalizedPost[] = Array.from({ length: sampleCount }, (_, i) => ({
        externalId: `p-${i}`,
        authorExternalId: `a-${i}`,
        publishedAt: new Date(oneHourAgo + (i * 3600_000) / Math.max(1, sampleCount - 1)).toISOString(),
        rawPayload: {},
      }));
      return { posts, rateLimitCost: 1 };
    },
  };
}

function makeFailingConnector(id: string): SocialConnector {
  return {
    providerId: id,
    authMode: 'api_key',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 1000, windowSeconds: 3600 }),
    normalize: (raw) => raw as NormalizedPost,
    supportedQueryFeatures: ['AND', 'OR', 'NOT', 'TERM', 'HASHTAG', 'ACCOUNT'],
    async count() {
      throw new Error('Upstream platform 500 error');
    },
  };
}

async function makeTenantWithUser(): Promise<{ tenantId: string; userId: string }> {
  const tenant = await createTenant('test-actor', { name: `T-${randomUUID()}`, licenseSeatCount: 10 });
  const email = `user-${randomUUID()}@example.com`;
  const invited = await createInvitedUser(tenant.id, { email, role: 'tenant_user' });
  await resolveIdentity({ sub: `sub-${invited.id}`, email });
  return { tenantId: tenant.id, userId: invited.id };
}

describe('Story 18.1 (ADR-0134) — Watchlist Cost Projection and Volume Confidence Contract', () => {
  beforeEach(() => {
    __resetRegistryForTests();
    __resetGateForTests();
  });

  afterAll(async () => {
    await closePool();
    await closePlatformAdminPool();
  });

  describe('AC1: WatchlistVolumePreview returns estimatedCost block', () => {
    it('returns an estimatedCost object with all required fields', async () => {
      registerSocialConnector(makeExactConnector('conn-exact', 1000));
      const ast = parseBooleanQuery('acme');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact'],
      });

      expect(preview.estimatedCost).toBeDefined();
      expect(typeof preview.estimatedCost?.storageGbPerMonth).toBe('number');
      expect(typeof preview.estimatedCost?.aiEnrichmentCallsPerMonth).toBe('number');
      expect(preview.estimatedCost?.currency).toBe('USD');
      expect(['exact', 'estimate', 'unavailable']).toContain(preview.estimatedCost?.confidence);
    });
  });

  describe('AC2: estimatedCost.confidence inheritance hierarchy', () => {
    it('inherits exact when all connectors in breakdown are exact', async () => {
      registerSocialConnector(makeExactConnector('conn-exact-1', 500));
      registerSocialConnector(makeExactConnector('conn-exact-2', 1500));
      const ast = parseBooleanQuery('brand');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact-1', 'conn-exact-2'],
      });

      expect(preview.breakdown.every((b) => b.confidence === 'exact')).toBe(true);
      expect(preview.estimatedCost?.confidence).toBe('exact');
    });

    it('inherits estimate when at least one connector has estimate confidence', async () => {
      registerSocialConnector(makeExactConnector('conn-exact', 500));
      registerSocialConnector(makeEstimateConnector('conn-est', 50));
      const ast = parseBooleanQuery('brand');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact', 'conn-est'],
      });

      expect(preview.breakdown.some((b) => b.confidence === 'estimate')).toBe(true);
      expect(preview.estimatedCost?.confidence).toBe('estimate');
    });

    it('inherits unavailable when any connector is unavailable (AWS Pricing Calculator rule)', async () => {
      registerSocialConnector(makeExactConnector('conn-exact', 500));
      registerSocialConnector(makeFailingConnector('conn-fail'));
      const ast = parseBooleanQuery('brand');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact', 'conn-fail'],
      });

      expect(preview.breakdown.some((b) => b.confidence === 'unavailable')).toBe(true);
      expect(preview.estimatedCost?.confidence).toBe('unavailable');
    });

    it('defaults to exact confidence when breakdown is empty', async () => {
      const ast = parseBooleanQuery('brand');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: [],
      });

      expect(preview.totalEstimatedPosts).toBe(0);
      expect(preview.estimatedCost?.confidence).toBe('exact');
      expect(preview.estimatedCost?.storageGbPerMonth).toBe(0);
      expect(preview.estimatedCost?.aiEnrichmentCallsPerMonth).toBe(0);
    });
  });

  describe('AC3: Monthly storage and AI enrichment calculations', () => {
    it('projects to 30-day month from default 7-day time window', async () => {
      registerSocialConnector(makeExactConnector('conn-exact', 700));
      const ast = parseBooleanQuery('acme');
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact'],
      });

      // Default window = 7 days. Monthly multiplier = 30 / 7 (~4.2857)
      // 700 posts in 7 days -> 3000 posts per month
      const expectedMonthlyPosts = 3000;
      expect(preview.estimatedCost?.aiEnrichmentCallsPerMonth).toBe(expectedMonthlyPosts);

      // Storage: 3000 posts * 5 KB = 15,000 KB = ~0.0143 GB
      const expectedGb = Number(((expectedMonthlyPosts * 5 * 1024) / (1024 * 1024 * 1024)).toFixed(4));
      expect(preview.estimatedCost?.storageGbPerMonth).toBe(expectedGb);
    });

    it('projects correctly with custom timeWindow', async () => {
      registerSocialConnector(makeExactConnector('conn-exact', 1000));
      const ast = parseBooleanQuery('acme');
      // 30 day window
      const start = '2026-08-01T00:00:00.000Z';
      const end = '2026-08-31T00:00:00.000Z'; // 30 days = 30 * 86400000 ms
      const preview = await previewWatchlistVolume({
        tenantId: randomUUID(),
        ast,
        connectorIds: ['conn-exact'],
        timeWindow: { start, end },
      });

      // 1000 posts across 30 days -> 1000 monthly posts
      expect(preview.estimatedCost?.aiEnrichmentCallsPerMonth).toBe(1000);
      const expectedGb = Number(((1000 * 5 * 1024) / (1024 * 1024 * 1024)).toFixed(4));
      expect(preview.estimatedCost?.storageGbPerMonth).toBe(expectedGb);
    });
  });

  describe('AC4: POST /v1/watchlists/preview-volume HTTP integration', () => {
    it('returns 200 with estimatedCost block for tenant request', async () => {
      const app = createApp();
      const { tenantId, userId } = await makeTenantWithUser();

      registerSocialConnector(makeExactConnector('conn-http-exact', 1400));

      const res = await request(app)
        .post('/v1/watchlists/preview-volume')
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId }))
        .send({
          ast: { type: 'TERM', value: 'acme' },
          connectorIds: ['conn-http-exact'],
        });

      expect(res.status).toBe(200);
      expect(res.body.totalEstimatedPosts).toBe(1400);
      expect(res.body.estimatedCost).toBeDefined();
      expect(res.body.estimatedCost.currency).toBe('USD');
      expect(res.body.estimatedCost.confidence).toBe('exact');
      expect(res.body.estimatedCost.aiEnrichmentCallsPerMonth).toBe(6000); // 1400 * 30 / 7 = 6000
      expect(res.body.estimatedCost.storageGbPerMonth).toBeGreaterThan(0);
    });
  });
});
