/**
 * Contract: Story 12.1 (ADR-0101, BRD-0101, FDD-0101) — Multi-source connector capability matrix (backend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-121--connector-capability-matrix-backend
 * and docs/adr/0101-multi-source-connector-capability-matrix.md
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { bootstrapConnectors } from '../../src/connectors/bootstrapConnectors';
import {
  getSocialConnector,
  listSocialConnectors,
  getConnectorCapabilities,
  listConnectorCapabilities,
  registerSocialConnector,
  __resetRegistryForTests,
} from '../../src/connectors/registry';
import { SocialConnector, SocialConnectorCapabilities } from '../../src/connectors/types';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
});

async function createTenantFixture(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

describe('Story 12.1 — Connector capability matrix (backend)', () => {
  let tenant: { id: string };
  let user: { id: string };
  let app: any;

  beforeAll(async () => {
    bootstrapConnectors();
    tenant = await createTenantFixture(`Tenant Capability ${Date.now()}`);
    user = await createInvitedUser(tenant.id, {
      email: `capability-tester-${Date.now()}@example.com`,
    });
    app = createApp();
  });

  describe('AC1 & AC2: SocialConnector getCapabilities and registry resolution', () => {
    it('all bootstrapped connectors return valid SocialConnectorCapabilities with sourceType', () => {
      const connectors = listSocialConnectors();
      expect(connectors.length).toBeGreaterThanOrEqual(5);

      for (const connector of connectors) {
        const caps = getConnectorCapabilities(connector.providerId, tenant.id);
        expect(caps).toBeDefined();
        expect(caps.sourceType).toBeDefined();
        expect(['social', 'news', 'forum', 'review', 'broadcast', 'blog', 'wiki']).toContain(caps.sourceType);
        expect(caps.poll).toBeDefined();
      }
    });

    it('returns realistic capability objects for core platform connectors', () => {
      const facebookCaps = getConnectorCapabilities('facebook', tenant.id);
      expect(facebookCaps.sourceType).toBe('social');
      expect(facebookCaps.publish).toBeDefined();
      expect(facebookCaps.publish?.supportsScheduling).toBe(true);
      expect(facebookCaps.reply).toBe(true);

      const gnewsCaps = getConnectorCapabilities('gnews', tenant.id);
      expect(gnewsCaps.sourceType).toBe('news');
      expect(gnewsCaps.poll).toBeTruthy();

      const wikiCaps = getConnectorCapabilities('wikipedia', tenant.id);
      expect(wikiCaps.sourceType).toBe('wiki');
      expect(wikiCaps.poll).toBeTruthy();

      const youtubeCaps = getConnectorCapabilities('youtube', tenant.id);
      expect(youtubeCaps.sourceType).toBe('social');
      expect(youtubeCaps.poll).toBeTruthy();
    });

    it('listConnectorCapabilities returns metadata and capabilities for all providers', () => {
      const all = listConnectorCapabilities(tenant.id);
      expect(all.length).toBeGreaterThanOrEqual(5);
      const fb = all.find((c) => c.platformId === 'facebook');
      expect(fb).toBeDefined();
      expect(fb?.authMode).toBe('oauth');
      expect(fb?.capabilities.sourceType).toBe('social');
    });

    it('allows dynamic registration of custom connectors with explicit capabilities', () => {
      const customCaps: SocialConnectorCapabilities = {
        sourceType: 'forum',
        poll: { cadenceMs: 30000, supportsTimeWindow: true },
        count: { supportsExactCount: true },
        reply: true,
        backfill: { supportsHistorical: true, maxLookbackDays: 30 },
      };

      const customConnector: SocialConnector = {
        providerId: 'custom-forum',
        authMode: 'api_key',
        deliveryMode: 'poll',
        getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 60 }),
        getOutboundRateLimitConfig: () => ({ requestsPerWindow: 50, windowSeconds: 60 }),
        normalize: () => ({
          externalId: '1',
          authorExternalId: 'a',
          publishedAt: '2026-08-28T00:00:00Z',
          rawPayload: {},
        }),
        getCapabilities: () => customCaps,
      };

      registerSocialConnector(customConnector);

      const resolved = getConnectorCapabilities('custom-forum');
      expect(resolved).toEqual(customCaps);
      expect(resolved.sourceType).toBe('forum');
      expect(resolved.backfill?.maxLookbackDays).toBe(30);
    });
  });

  describe('AC3: GET /v1/connectors/capabilities endpoint', () => {
    it('returns 200 with list of registered connectors and their capabilities', async () => {
      const res = await request(app)
        .get('/v1/connectors/capabilities')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.connectors)).toBe(true);
      expect(res.body.connectors.length).toBeGreaterThanOrEqual(5);

      const first = res.body.connectors[0];
      expect(first.platformId).toBeDefined();
      expect(first.name).toBeDefined();
      expect(first.authMode).toBeDefined();
      expect(first.capabilities).toBeDefined();
      expect(first.capabilities.sourceType).toBeDefined();
    });

    it('requires authentication and rejects unauthenticated callers with 401', async () => {
      const res = await request(app).get('/v1/connectors/capabilities');
      expect(res.status).toBe(401);
    });
  });

  describe('AC4: GET /v1/connectors/:platformId/health includes capabilities', () => {
    it('returns combined health and capabilities for a valid connector', async () => {
      const res = await request(app)
        .get('/v1/connectors/facebook/health')
        .set('x-test-identity', testIdentityHeaderValue(tenant.id, { userId: user.id }));

      expect(res.status).toBe(200);
      expect(res.body.platformId).toBe('facebook');
      expect(res.body.capabilities).toBeDefined();
      expect(res.body.capabilities.sourceType).toBe('social');
      expect(res.body.capabilities.publish).toBeDefined();
    });
  });
});
