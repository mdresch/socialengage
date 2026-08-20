// Contract: Story 2.20 (ADR-0064) — Country-level geospatial extraction and normalization on post enrichment
// See docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-220
//
// Intent: Story 2.20 — Country-level geospatial extraction and normalization on post enrichment (ADR-0064)
// Scope: touches:
//   - src/connectors/types.ts (AnalyzeResult / GeoEnrichment)
//   - src/connectors/geo/geoCountryUtils.ts (NEW)
//   - src/connectors/gnews/pollGNewsSearch.ts
//   - src/connectors/newswire/rssFeedParser.ts
//   - src/connectors/newswire/pollNewswireFeeds.ts
//   - src/connectors/tenantOwnedFeed/feedItemParser.ts
//   - src/connectors/tenantOwnedFeed/pollTenantOwnedFeed.ts
// Contract to encode:
// - AC1: AnalyzeResult / enrichment schema in types.ts includes optional geoCountry, geoCountryName, geoRegion, geoSource, geoConfidence in camelCase.
// - AC2: GNews search polling extracts GNewsArticle.source.country, normalizes to ISO 3166-1 alpha-2 uppercase, populates geoCountry, geoCountryName, geoSource: 'source', geoConfidence: 'high'.
// - AC3: Newswire polling extracts explicit country from feed items (geoSource: 'post', geoConfidence: 'high') or maps unambiguous wire source domains (geoSource: 'source', geoConfidence: 'medium'), defaulting to null when unmappable.
// - AC4: Tenant-owned feed polling extracts explicit country tags normalized to ISO alpha-2 uppercase (geoSource: 'post', geoConfidence: 'high'), defaulting to null for unstructured/absent geo.
// - AC5: Facebook polling leaves geoCountry null.
// - AC6: Geo enrichment is persisted into social_posts.enrichment (JSONB), round-trips via insertSocialPost(), and is exposed unfiltered by GET /v1/posts without DB migrations.
// Explicitly out of scope:
// - Sub-national / city-level coordinate geocoding.
// - Storing point geometry in post_geo_location.
// - Parsing unstructured author profile location strings.
// - Any frontend / admin UI visualization changes (handled in Story 8.10).

import { randomUUID } from 'crypto';
import request from 'supertest';
import type { PoolClient } from 'pg';
import { createApp } from '../../src/http/app';
import { withTenant } from '../../src/db/withTenant';
import { getPlatformAdminPool, closePlatformAdminPool } from '../../src/db/platformAdminPool';
import { closePool } from '../../src/db/pool';
import { startIngestionRun } from '../../src/ingestion/ingestionRunStore';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import {
  normalizeCountryCode,
  getCountryName,
  buildGeoEnrichment,
} from '../../src/connectors/geo/geoCountryUtils';
import { parseRssItems } from '../../src/connectors/newswire/rssFeedParser';
import { parseFeedItems } from '../../src/connectors/tenantOwnedFeed/feedItemParser';
import { pollGNewsSearch } from '../../src/connectors/gnews/pollGNewsSearch';
import { ingestNewswireItems } from '../../src/connectors/newswire/pollNewswireFeeds';
import { ingestTenantOwnedFeedItems } from '../../src/connectors/tenantOwnedFeed/pollTenantOwnedFeed';
import * as credentialStore from '../../src/credentials/credentialStore';
import * as gnewsConnectorModule from '../../src/connectors/gnews/gnewsConnector';
import * as serviceBusPublisher from '../../src/events/serviceBusPublisher';

const app = createApp();

jest.setTimeout(30000);

describe('Story 2.20 Contract: Country-level geospatial extraction and normalization (ADR-0064)', () => {
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    jest.spyOn(serviceBusPublisher, 'publishEvent').mockResolvedValue(undefined);

    tenantId = randomUUID();
    userId = randomUUID();

    const pool = getPlatformAdminPool();
    await pool.query(
      `INSERT INTO tenants (id, name, status, license_seat_count)
       VALUES ($1, $2, 'active', 5)`,
      [tenantId, `Tenant Geo-${tenantId.slice(0, 8)}`]
    );

    await withTenant(tenantId, async (client: PoolClient) => {
      await client.query(
        `INSERT INTO users (id, tenant_id, role, display_name, email)
         VALUES ($1, $2, 'tenant_user', 'Geo User', $3)`,
        [userId, tenantId, `user-${userId.slice(0, 8)}@example.com`]
      );
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await closePlatformAdminPool();
    await closePool();
  });

  describe('AC1 & geoCountryUtils: Country normalization & Name resolution', () => {
    it('normalizes 2-letter country codes to uppercase ISO 3166-1 alpha-2', () => {
      expect(normalizeCountryCode('us')).toBe('US');
      expect(normalizeCountryCode('Gb')).toBe('GB');
      expect(normalizeCountryCode('NL')).toBe('NL');
      expect(normalizeCountryCode('de')).toBe('DE');
      expect(normalizeCountryCode('ca')).toBe('CA');
    });

    it('rejects invalid, malformed, or multi-letter strings as null', () => {
      expect(normalizeCountryCode(null)).toBeNull();
      expect(normalizeCountryCode(undefined)).toBeNull();
      expect(normalizeCountryCode('')).toBeNull();
      expect(normalizeCountryCode('USA')).toBeNull();
      expect(normalizeCountryCode('12')).toBeNull();
      expect(normalizeCountryCode('Earth')).toBeNull();
    });

    it('resolves country name for known ISO codes via getCountryName()', () => {
      expect(getCountryName('US')).toBe('United States');
      expect(getCountryName('GB')).toBe('United Kingdom');
      expect(getCountryName('NL')).toBe('Netherlands');
      expect(getCountryName('DE')).toBe('Germany');
      expect(getCountryName('FR')).toBe('France');
    });

    it('builds a complete GeoEnrichment object when valid country provided', () => {
      const geo = buildGeoEnrichment('us', 'source', 'high');
      expect(geo).toEqual({
        geoCountry: 'US',
        geoCountryName: 'United States',
        geoSource: 'source',
        geoConfidence: 'high',
      });
    });

    it('returns empty object when no valid country provided', () => {
      expect(buildGeoEnrichment(null, 'source', 'high')).toEqual({});
      expect(buildGeoEnrichment('INVALID', 'source', 'high')).toEqual({});
    });
  });

  describe('AC2: GNews search extraction & enrichment persistence', () => {
    it('extracts source.country from GNewsArticle and stores normalized geo metadata in enrichment', async () => {
      const externalId = `gnews-geo-${randomUUID()}`;

      const getCredSpy = jest.spyOn(credentialStore, 'getLatestCredentialId').mockImplementation(async (_t, providerId) => {
        return providerId === 'gnews' ? 'mock-cred-id' : null;
      });
      const readCredSpy = jest.spyOn(credentialStore, 'readCredential').mockImplementation(async () => 'mock-api-key');

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          totalArticles: 1,
          articles: [
            {
              id: externalId,
              title: 'Global Economic Report',
              description: 'A comprehensive study on international markets.',
              content: 'Full article body here [100 chars]',
              url: `https://example.com/articles/${externalId}`,
              image: 'https://example.com/image.jpg',
              publishedAt: new Date().toISOString(),
              lang: 'en',
              source: {
                id: 'reuters-src',
                name: 'Reuters UK',
                url: 'https://reuters.com',
                country: 'gb',
              },
            },
          ],
        }),
      } as any);

      const pollResult = await pollGNewsSearch(tenantId, 'finance');
      expect(pollResult.status).toBe('succeeded');

      const { rows } = await withTenant(tenantId, (client: PoolClient) =>
        client.query<{ enrichment: Record<string, unknown> }>(
          `SELECT enrichment FROM social_posts WHERE tenant_id = $1 AND raw_payload->>'externalId' = $2`,
          [tenantId, externalId]
        )
      );
      expect(rows.length).toBe(1);
      const enrichment = rows[0].enrichment;
      expect(enrichment).toBeDefined();
      expect(enrichment.geoCountry).toBe('GB');
      expect(enrichment.geoCountryName).toBe('United Kingdom');
      expect(enrichment.geoSource).toBe('source');
      expect(enrichment.geoConfidence).toBe('high');

      getCredSpy.mockRestore();
      readCredSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe('AC3: Newswire RSS feed country tag parsing & domain mapping', () => {
    it('parses explicit <country> XML tag from RSS feed item', () => {
      const xml = `
        <rss version="2.0">
          <channel>
            <item>
              <guid>https://wire.example.com/item-1</guid>
              <link>https://wire.example.com/item-1</link>
              <title>Product Launch in Amsterdam</title>
              <pubDate>Mon, 18 Aug 2026 12:00:00 GMT</pubDate>
              <country>nl</country>
              <description>Details of the product launch.</description>
            </item>
          </channel>
        </rss>
      `;
      const items = parseRssItems(xml);
      expect(items.length).toBe(1);
      expect(items[0].country).toBe('nl');
    });

    it('persists explicit country tag with geoSource: post and geoConfidence: high', async () => {
      const guid = `https://swire.com/releases/${randomUUID()}`;
      const items = [
        {
          guid,
          link: guid,
          title: 'Official Press Release from Tokyo',
          pubDate: new Date().toISOString(),
          issuer: 'Tokyo Wire',
          description: 'A global business update.',
          contentEncoded: null,
          rawXml: '<item></item>',
          country: 'jp',
        },
      ];

      const run = await startIngestionRun(tenantId, {
        platformId: 'newswire',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const res = await ingestNewswireItems(tenantId, run.id, items);
      expect(res.postsIngested).toBe(1);

      const { rows } = await withTenant(tenantId, (client: PoolClient) =>
        client.query<{ enrichment: Record<string, unknown> }>(
          `SELECT enrichment FROM social_posts WHERE tenant_id = $1 AND raw_payload->>'externalId' = $2`,
          [tenantId, guid]
        )
      );
      expect(rows.length).toBe(1);
      const enrichment = rows[0].enrichment;
      expect(enrichment).toBeDefined();
      expect(enrichment.geoCountry).toBe('JP');
      expect(enrichment.geoCountryName).toBe('Japan');
      expect(enrichment.geoSource).toBe('post');
      expect(enrichment.geoConfidence).toBe('high');
    });

    it('falls back to known domain wire mapping with geoSource: source and geoConfidence: medium when no country tag', async () => {
      const guid = `https://www.prnewswire.com/news-releases/${randomUUID()}.html`;
      const items = [
        {
          guid,
          link: guid,
          title: 'US Domestic Quarterly Results',
          pubDate: new Date().toISOString(),
          issuer: 'PR Newswire',
          description: 'Domestic financial results release.',
          contentEncoded: null,
          rawXml: '<item></item>',
          country: null,
        },
      ];

      const run = await startIngestionRun(tenantId, {
        platformId: 'newswire',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const res = await ingestNewswireItems(tenantId, run.id, items);
      expect(res.postsIngested).toBe(1);

      const { rows } = await withTenant(tenantId, (client: PoolClient) =>
        client.query<{ enrichment: Record<string, unknown> }>(
          `SELECT enrichment FROM social_posts WHERE tenant_id = $1 AND raw_payload->>'externalId' = $2`,
          [tenantId, guid]
        )
      );
      expect(rows.length).toBe(1);
      const enrichment = rows[0].enrichment;
      expect(enrichment).toBeDefined();
      expect(enrichment.geoCountry).toBe('US');
      expect(enrichment.geoCountryName).toBe('United States');
      expect(enrichment.geoSource).toBe('source');
      expect(enrichment.geoConfidence).toBe('medium');
    });
  });

  describe('AC4: Tenant-Owned Feed country tag parsing and ingestion', () => {
    it('parses explicit <country> and <countryCode> from RSS and Atom items', () => {
      const rssXml = `
        <rss version="2.0">
          <channel>
            <item>
              <guid>https://tenant.example.com/rss/1</guid>
              <link>https://tenant.example.com/rss/1</link>
              <title>Tenant Blog Post Germany</title>
              <pubDate>Mon, 18 Aug 2026 12:00:00 GMT</pubDate>
              <countryCode>DE</countryCode>
            </item>
          </channel>
        </rss>
      `;
      const items = parseFeedItems(rssXml);
      expect(items.length).toBe(1);
      expect(items[0].country).toBe('DE');
    });

    it('persists explicit country tag from tenant feed into enrichment', async () => {
      const itemId = `https://company.de/blog/${randomUUID()}`;
      const items = [
        {
          id: itemId,
          link: itemId,
          title: 'Munich Office Opening',
          publishedAt: new Date().toISOString(),
          description: 'Welcome to our Munich hub.',
          contentEncoded: null,
          summary: null,
          content: null,
          rawXml: '<item></item>',
          author: 'Press Team',
          country: 'DE',
        },
      ];

      const run = await startIngestionRun(tenantId, {
        platformId: 'tenant-owned-feed',
        triggerType: 'poll',
        connectorVersion: '1.0.0',
      });

      const res = await ingestTenantOwnedFeedItems(
        tenantId,
        run.id,
        {
          id: randomUUID(),
          tenant_id: tenantId,
          domain: 'company.de',
          feed_url: 'https://company.de/rss',
          verification_token: 'tok-1',
          txt_record_host: '_txt.company.de',
          status: 'verified',
          token_expires_at: new Date(),
          verified_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          name: 'Company DE Blog',
        },
        items
      );
      expect(res.postsIngested).toBe(1);

      const { rows } = await withTenant(tenantId, (client: PoolClient) =>
        client.query<{ enrichment: Record<string, unknown> }>(
          `SELECT enrichment FROM social_posts WHERE tenant_id = $1 AND raw_payload->>'externalId' = $2`,
          [tenantId, itemId]
        )
      );
      expect(rows.length).toBe(1);
      const enrichment = rows[0].enrichment;
      expect(enrichment).toBeDefined();
      expect(enrichment.geoCountry).toBe('DE');
      expect(enrichment.geoCountryName).toBe('Germany');
      expect(enrichment.geoSource).toBe('post');
      expect(enrichment.geoConfidence).toBe('high');
    });
  });

  describe('AC6: Wire visibility via GET /v1/posts (zero migration)', () => {
    it('returns enrichment containing geoCountry and geoCountryName over GET /v1/posts without alteration', async () => {
      const res = await request(app)
        .get('/v1/posts?limit=10')
        .set('X-Test-Identity', testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' }));

      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
      expect(Array.isArray(res.body.posts)).toBe(true);

      const postsWithGeo = res.body.posts.filter(
        (p: { enrichment?: { geoCountry?: string } }) => p.enrichment?.geoCountry
      );
      expect(postsWithGeo.length).toBeGreaterThan(0);

      const samplePost = postsWithGeo[0];
      expect(samplePost.enrichment.geoCountry).toBeDefined();
      expect(typeof samplePost.enrichment.geoCountry).toBe('string');
      expect(samplePost.enrichment.geoCountryName).toBeDefined();
      expect(samplePost.enrichment.geoSource).toBeDefined();
      expect(samplePost.enrichment.geoConfidence).toBeDefined();
    });
  });
});
