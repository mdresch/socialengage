// Contract: Story 2.24 (ADR-0068) — Instagram Business Connector: Tier-3 OAuth Poller,
// Single-Row Carousel Normalization, Lookback Pagination, and Error Reclassification.
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-224
//
// Intent:
// 1. SocialConnector for providerId 'instagram' with authMode 'oauth', deliveryMode 'poll'.
// 2. Single-row carousel modeling with gallery children in rawPayload.children in Meta display order (capped at 10, childrenTruncated flag).
// 3. Lookback bounds: 30-day ceiling and 100-item ceiling on initial ingestion; newest-first short-circuit on incremental ticks.
// 4. Country-level geospatial normalization on location.country (ADR-0064).
// 5. Graph API error reclassification (190, 10, 100) to reconnect_required with alert publishing.

import { randomUUID } from 'crypto';
import { closePool } from '../../src/db/pool';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { getAdminPool, closeAdminPool } from '../../src/db/adminPool';
import {
  instagramConnector,
  fetchInstagramMedia,
  captionToMarkdown,
  InstagramMediaItem,
} from '../../src/connectors/instagram/instagramConnector';
import {
  pollInstagramAccount,
  pollInstagram,
} from '../../src/connectors/instagram/pollInstagram';
import {
  upsertConnectedAccount,
  getConnectedAccountByIgUserId,
  InstagramConnectedAccount,
} from '../../src/connectors/instagram/instagramConnectedAccountsStore';
import { findSocialPostByExternalId, getSocialPostById } from '../../src/posts/socialPostStore';
import * as credentialStore from '../../src/credentials/credentialStore';
import * as serviceBusPublisher from '../../src/events/serviceBusPublisher';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closePool();
  await closeAdminPool();
});

describe('Story 2.24 Contract: Instagram Business Connector (ADR-0068)', () => {
  let tenantId: string;
  let userId: string;
  let igUserId: string;
  let credentialId: string;
  let account: InstagramConnectedAccount;
  let publishedEvents: unknown[] = [];

  beforeAll(async () => {
    const { rows: tenantRows } = await getPlatformAdminPool().query<{ id: string }>(
      `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
      [`IG Test Tenant ${randomUUID().slice(0, 8)}`, 5]
    );
    tenantId = tenantRows[0].id;

    const { rows: userRows } = await getAdminPool().query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, role, status) VALUES ($1, $2, 'tenant_user', 'active') RETURNING id`,
      [tenantId, `user-${randomUUID().slice(0, 8)}@example.com`]
    );
    userId = userRows[0].id;

    igUserId = `ig_${randomUUID().slice(0, 8)}`;

    const { rows: credRows } = await getAdminPool().query<{ id: string }>(
      `INSERT INTO platform_credentials (tenant_id, platform_id, wrapped_dek, key_vault_key_id, iv, auth_tag, ciphertext, status, owner_type, user_id)
       VALUES ($1, 'instagram', '\\x00', 'key_mock', '\\x00', '\\x00', '\\x00', 'valid', 'user', $2) RETURNING id`,
      [tenantId, userId]
    );
    credentialId = credRows[0].id;

    account = await upsertConnectedAccount(tenantId, userId, {
      igUserId,
      username: 'acme_global',
      pageId: 'page_12345',
      pageName: 'Acme Official',
      credentialId,
    });

    jest.spyOn(credentialStore, 'readCredential').mockResolvedValue(
      JSON.stringify({
        igUserId,
        pageAccessToken: 'IG_EAAB_mock_token_123',
        username: 'acme_global',
        pageId: 'page_12345',
        pageName: 'Acme Official',
      })
    );

    publishedEvents = [];
    jest.spyOn(serviceBusPublisher, 'publishEvent').mockImplementation(async (_t, event) => {
      publishedEvents.push(event);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC1: Connector Definition & Client Fetching
  // -------------------------------------------------------------------------
  describe('AC1: Connector Definition & Client Fetching', () => {
    it('implements SocialConnector with providerId instagram and authMode oauth', () => {
      expect(instagramConnector.providerId).toBe('instagram');
      expect(instagramConnector.authMode).toBe('oauth');
      expect(instagramConnector.deliveryMode).toBe('poll');
      expect(instagramConnector.supportedQueryFeatures).toEqual([]);
    });

    it('fetchInstagramMedia requests required fields including children and location', async () => {
      let capturedUrl = '';
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as unknown as Response;
      });

      try {
        await fetchInstagramMedia(igUserId, 'mock_token');
        expect(capturedUrl).toContain(`/${igUserId}/media`);
        expect(capturedUrl).toContain('children{id,media_type,media_url,thumbnail_url}');
        expect(capturedUrl).toContain('location');
        expect(capturedUrl).toContain('media_type');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('captionToMarkdown falls back deterministically for empty captions', () => {
      expect(captionToMarkdown('Hello world', 'IMAGE')).toBe('Hello world');
      expect(captionToMarkdown('', 'IMAGE')).toBe('[Instagram Photo]');
      expect(captionToMarkdown(undefined, 'VIDEO')).toBe('[Instagram Video]');
      expect(captionToMarkdown('   ', 'CAROUSEL_ALBUM')).toBe('[Instagram Carousel]');
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Single-Row Carousel Modeling & 10-Item Gallery Truncation
  // -------------------------------------------------------------------------
  describe('AC2: Single-Row Carousel Modeling & Gallery Persistence', () => {
    it('creates exactly one SocialPost row with ordered children and truncation flag when > 10 items', async () => {
      const carouselMediaId = `media_${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      // Create 12 child items
      const childItems = Array.from({ length: 12 }, (_, i) => ({
        id: `child_${i + 1}`,
        media_type: 'IMAGE' as const,
        media_url: `https://cdn.instagram.com/child_${i + 1}.jpg`,
      }));

      const mockCarouselItem: InstagramMediaItem = {
        id: carouselMediaId,
        caption: 'Look at our 12-item spring collection! #fashion',
        media_type: 'CAROUSEL_ALBUM',
        permalink: `https://instagram.com/p/${carouselMediaId}`,
        timestamp: now,
        username: 'acme_global',
        like_count: 350,
        comments_count: 42,
        children: { data: childItems },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [mockCarouselItem] }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: igUserId, username: 'acme_global', followers_count: 15000 }),
        } as unknown as Response;
      });

      try {
        const result = await pollInstagramAccount(tenantId, userId, account);
        expect(result.status).toBe('succeeded');

        const externalId = `instagram_${igUserId}_${carouselMediaId}`;
        const post = await findSocialPostByExternalId(tenantId, 'instagram', externalId);
        expect(post).toBeDefined();

        const fullPost = await getSocialPostById(tenantId, post!.id);
        const raw = fullPost!.rawPayload as Record<string, unknown>;

        expect(raw.externalId).toBe(externalId);
        expect(raw.mediaType).toBe('CAROUSEL_ALBUM');
        expect(raw.igUserId).toBe(igUserId);
        expect(raw.username).toBe('acme_global');
        expect(raw.pageName).toBe('Acme Official');
        expect(raw.childrenTruncated).toBe(true);

        const children = raw.children as unknown[];
        expect(Array.isArray(children)).toBe(true);
        expect(children.length).toBe(10); // Capped at 10 items
        expect((children[0] as { id: string }).id).toBe('child_1');
        expect((children[9] as { id: string }).id).toBe('child_10');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Lookback Bounds & Incremental Short-Circuit
  // -------------------------------------------------------------------------
  describe('AC3: Lookback Bounds Precedence & Incremental Halting', () => {
    it('halts pagination when items are older than 30 days', async () => {
      const freshMediaId = `media_fresh_${randomUUID().slice(0, 8)}`;
      const staleMediaId = `media_stale_${randomUUID().slice(0, 8)}`;

      const freshTimestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      const staleTimestamp = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(); // 35 days ago (older than 30d)

      const items: InstagramMediaItem[] = [
        {
          id: freshMediaId,
          caption: 'Fresh post',
          media_type: 'IMAGE',
          permalink: `https://instagram.com/p/${freshMediaId}`,
          timestamp: freshTimestamp,
        },
        {
          id: staleMediaId,
          caption: 'Stale post',
          media_type: 'IMAGE',
          permalink: `https://instagram.com/p/${staleMediaId}`,
          timestamp: staleTimestamp,
        },
      ];

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: items }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: igUserId, username: 'acme_global' }),
        } as unknown as Response;
      });

      try {
        const result = await pollInstagramAccount(tenantId, userId, account);
        expect(result.status).toBe('succeeded');

        const freshPost = await findSocialPostByExternalId(tenantId, 'instagram', `instagram_${igUserId}_${freshMediaId}`);
        expect(freshPost).toBeDefined();

        const stalePost = await findSocialPostByExternalId(tenantId, 'instagram', `instagram_${igUserId}_${staleMediaId}`);
        expect(stalePost).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('short-circuits pagination immediately upon encountering an existing post ID', async () => {
      // Step 1: Insert an existing post first
      const existingMediaId = `media_existing_${randomUUID().slice(0, 8)}`;
      const olderMediaId = `media_older_${randomUUID().slice(0, 8)}`;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: existingMediaId,
                  caption: 'Already ingested',
                  media_type: 'IMAGE',
                  permalink: `https://instagram.com/p/${existingMediaId}`,
                  timestamp: new Date().toISOString(),
                },
                {
                  id: olderMediaId,
                  caption: 'Should not reach',
                  media_type: 'IMAGE',
                  permalink: `https://instagram.com/p/${olderMediaId}`,
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: igUserId, username: 'acme_global' }),
        } as unknown as Response;
      });

      try {
        // Initial run ingests both
        await pollInstagramAccount(tenantId, userId, account);

        const existingPost = await findSocialPostByExternalId(tenantId, 'instagram', `instagram_${igUserId}_${existingMediaId}`);
        expect(existingPost).toBeDefined();

        // Next run: encountering the first item as existing short-circuits immediately
        const secondRun = await pollInstagramAccount(tenantId, userId, account);
        expect(secondRun.status).toBe('succeeded');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Geospatial Extraction (ADR-0064)
  // -------------------------------------------------------------------------
  describe('AC4: Geospatial Normalization on Location Country', () => {
    it('extracts ISO 3166-1 alpha-2 country from location.country tag', async () => {
      const geoMediaId = `media_geo_${randomUUID().slice(0, 8)}`;
      const mockItem: InstagramMediaItem = {
        id: geoMediaId,
        caption: 'Sunset in Amsterdam!',
        media_type: 'IMAGE',
        permalink: `https://instagram.com/p/${geoMediaId}`,
        timestamp: new Date().toISOString(),
        location: {
          id: 'loc_123',
          name: 'Amsterdam Central',
          country: 'NL',
        },
      };

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('/media')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [mockItem] }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: igUserId, username: 'acme_global' }),
        } as unknown as Response;
      });

      try {
        await pollInstagramAccount(tenantId, userId, account);
        const post = await findSocialPostByExternalId(tenantId, 'instagram', `instagram_${igUserId}_${geoMediaId}`);
        expect(post).toBeDefined();

        const fullPost = await getSocialPostById(tenantId, post!.id);
        const enrichment = fullPost!.enrichment as Record<string, unknown>;
        expect(enrichment.geoCountry).toBe('NL');
        expect(enrichment.geoCountryName).toBe('Netherlands');
        expect(enrichment.geoSource).toBe('post');
        expect(enrichment.geoConfidence).toBe('high');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Error Reclassification & Alert Emission (ADR-0070)
  // -------------------------------------------------------------------------
  describe('AC5: Graph API Error Reclassification & Reconnect Alert', () => {
    it('reclassifies error 190 to http_401, updates account to reconnect_required, and publishes alert', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            error: {
              code: 190,
              type: 'OAuthException',
              message: 'Error validating access token: Session has expired.',
            },
          }),
        } as unknown as Response;
      });

      try {
        const result = await pollInstagramAccount(tenantId, userId, account);
        expect(result.status).toBe('failed');

        // Check connected account row transitioned to 'reconnect_required'
        const updatedAccount = await getConnectedAccountByIgUserId(tenantId, userId, igUserId);
        expect(updatedAccount?.status).toBe('reconnect_required');

        // Check ConnectorIngestionAlertEvent published
        const alert = publishedEvents.find(
          (e) => (e as { alertType?: string }).alertType === 'reconnect_required'
        ) as { alertType: string; platformId: string; userId: string; severity: string } | undefined;

        expect(alert).toBeDefined();
        expect(alert?.platformId).toBe('instagram');
        expect(alert?.userId).toBe(userId);
        expect(alert?.severity).toBe('warning');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC6: REST Endpoints (ADR-0068 Decision §2/§5): GET/DELETE .../instagram/accounts and /oauth/select-accounts
  // -------------------------------------------------------------------------
  describe('AC6: REST Endpoints (OAuth & Account Management)', () => {
    function authAs(tId: string, uId: string) {
      return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        (req as unknown as { identity: unknown }).identity = { type: 'tenant_user', tenantId: tId, userId: uId, role: 'tenant_user' };
        next();
      };
    }

    it('GET /v1/connectors/instagram/accounts returns only the calling user accounts', async () => {
      const express = (await import('express')).default;
      const request = (await import('supertest')).default;
      const { createV1Router } = await import('../../src/http/versions/v1/router');

      const app = express();
      app.use(express.json());
      app.use('/v1', createV1Router(authAs(tenantId, userId), authAs(tenantId, userId)));

      const res = await request(app).get('/v1/connectors/instagram/accounts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.accounts)).toBe(true);
      expect(res.body.accounts.some((a: { igUserId: string }) => a.igUserId === igUserId)).toBe(true);
    });

    it('DELETE /v1/connectors/instagram/accounts/:id soft-removes the account', async () => {
      const express = (await import('express')).default;
      const request = (await import('supertest')).default;
      const { createV1Router } = await import('../../src/http/versions/v1/router');

      const app = express();
      app.use(express.json());
      app.use('/v1', createV1Router(authAs(tenantId, userId), authAs(tenantId, userId)));

      const res = await request(app).delete(`/v1/connectors/instagram/accounts/${account.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('removed');
    });
  });
});

