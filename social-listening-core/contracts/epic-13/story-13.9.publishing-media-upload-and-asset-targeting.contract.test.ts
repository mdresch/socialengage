/**
 * Contract: Story 13.9 (ADR-0115, BRD-0115, FDD-0115) — Publishing media upload and asset targeting.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-139
 *
 * Intent:
 *   Add a tenant-scoped `media_assets` table, a `POST /v1/outbound/media` multipart
 *   upload endpoint that stores files in Azure Blob and returns a 24h presigned URL,
 *   media format/size validation, feature gating, and `assets`/`assetTargets` support
 *   in `POST /v1/outbound/posts`. Connector `publish()` receives generic assets and
 *   can return `platform_asset_rejected`.
 *
 * Scope:
 *   - social-listening-core/migrations/0070_create_media_assets.sql
 *   - social-listening-core/src/media/mediaAssetStore.ts (new)
 *   - social-listening-core/src/media/mediaBlobClient.ts (new)
 *   - social-listening-core/src/http/routes/mediaAssetsRouter.ts (new)
 *   - social-listening-core/src/http/routes/publishingRoutes.ts
 *   - social-listening-core/src/publishing/outboundPublishingService.ts
 *   - social-listening-core/src/outbound/outboundPublishService.ts
 *   - social-listening-core/src/connectors/types.ts
 *   - social-listening-core/src/ingestion/errorClassification.ts
 *   - social-listening-core/.claude/skills/media-assets/SKILL.md (new)
 *   - social-listening-core/.claude/skills/outbound-publishing/SKILL.md (update)
 *
 * Contract to encode:
 *   (1) `POST /v1/outbound/media` uploads an image to tenant-scoped Blob and returns
 *       `mediaId`, `url`, `mimeType`, `sizeBytes`.
 *   (2) `media_assets` records `tenant_id`, `owner_id`, `blob_path`, `mime_type`,
 *       `size_bytes`, and `created_at`.
 *   (3) The returned `url` is a presigned Blob URL valid for 24 hours.
 *   (4) Upload is feature-gated by `media_upload`; disabled returns `403 FEATURE_NOT_AVAILABLE`.
 *   (5) Image uploads are validated (JPEG/PNG/GIF/WebP, max 8 MB) and rejected with
 *       `UNSUPPORTED_MEDIA_TYPE` or `MEDIA_TOO_LARGE`.
 *   (6) Video uploads are validated (MP4/MOV, max 512 MB) and rejected with
 *       `UNSUPPORTED_MEDIA_TYPE` or `MEDIA_TOO_LARGE`.
 *   (7) `GET /v1/connectors/:platformId/targets` returns pages/accounts for the platform.
 *   (8) `POST /v1/outbound/posts` accepts `assets` and `assetTargets` and passes them
 *       to the connector as resolved presigned URLs.
 *   (9) Missing required `assetTargets` for a platform returns `400 MISSING_ASSET_TARGET`.
 *   (10) A connector that rejects an asset returns `platform_asset_rejected` as the
 *       activity error code.
 *   (11) `link-card` assets are accepted as part of a post's `assets` array.
 *
 * Explicitly out of scope:
 *   - Real Facebook/LinkedIn/X image/video native upload logic in this pass
 *     (connector-specific and landed by later stories).
 *   - Thumbnail/previews and automatic unreferenced-media cleanup.
 *   - Width/height dimension validation beyond MIME/size.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../../src/http/app';
import { testIdentityHeaderValue } from '../../src/testUtils/testIdentityHeader';
import { closePlatformAdminPool, getPlatformAdminPool } from '../../src/db/platformAdminPool';
import { closeAdminPool, getAdminPool } from '../../src/db/adminPool';
import { closePool } from '../../src/db/pool';
import { createInvitedUser } from '../../src/identity/identityResolution';
import { updateTenantFeatureGates } from '../../src/tenants/tenantStore';
import { registerSocialConnector } from '../../src/connectors/registry';
import { ClassifiableError } from '../../src/ingestion/errorClassification';

jest.setTimeout(30000);

afterAll(async () => {
  await closePlatformAdminPool();
  await closeAdminPool();
  await closePool();
});

const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(8, 0)]);
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(8, 0)]);

function tenantUserHeader(tenantId: string, userId: string): string {
  return testIdentityHeaderValue(tenantId, { userId, role: 'tenant_user' });
}

async function seedTenant(name: string): Promise<{ id: string }> {
  const { rows } = await getPlatformAdminPool().query<{ id: string }>(
    `INSERT INTO tenants (name, license_seat_count) VALUES ($1, $2) RETURNING id`,
    [name, 10]
  );
  return rows[0];
}

function setFeature(tenantId: string, feature: string, enabled: boolean) {
  return updateTenantFeatureGates(tenantId, { [feature]: enabled });
}

interface GenericAsset {
  type: string;
  mediaId?: string;
  url?: string;
  imageUrl?: string;
  alt?: string;
}

function installTestPublisher() {
  registerSocialConnector({
    providerId: 'test-publisher',
    authMode: 'none',
    deliveryMode: 'poll',
    getRateLimitConfig: () => ({ requestsPerWindow: 100, windowSeconds: 60 }),
    normalize: (raw: unknown) => ({
      externalId: 'test-1',
      authorExternalId: 'test-author',
      publishedAt: new Date().toISOString(),
      rawPayload: raw,
    }),
    targetAssets: async () => [
      { id: 'test-page-1', name: 'Test Page One', type: 'test_page' },
      { id: 'test-page-2', name: 'Test Page Two', type: 'test_page' },
    ],
    publish: async (_tenantId, _userId, payload) => {
      const assets = ((payload as any).assets as GenericAsset[]) || [];
      if (assets.some((a) => a.type === 'video')) {
        throw new ClassifiableError('platform_asset_rejected' as any, 'test-publisher does not support video assets in v1.');
      }
      if (assets.some((a) => a.type === 'link-card')) {
        const invalid = assets.filter((a) => a.type === 'link-card' && !a.url);
        if (invalid.length > 0) {
          throw new ClassifiableError('platform_asset_rejected' as any, 'test-publisher requires a URL for every link-card.');
        }
      }
      if (assets.some((a) => a.type === 'image' && !a.url)) {
        throw new ClassifiableError('platform_asset_rejected' as any, 'test-publisher requires a resolved URL for every image.');
      }
      return { externalId: `test-${Date.now()}`, externalUrl: 'https://example.com/post/test' };
    },
    getCapabilities: () => ({
      sourceType: 'social',
      poll: false,
      publish: { supportsScheduling: true, supportedAssetTypes: ['text', 'image', 'link-card'] },
    }),
  });
}

describe('Story 13.9 — Publishing media upload and asset targeting', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    installTestPublisher();
    app = createApp();
  });

  it('AC1: POST /v1/outbound/media uploads an image and returns mediaId, url, mimeType, sizeBytes', async () => {
    const tenant = await seedTenant(`T-13.9-ac1-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', VALID_PNG, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mediaId: expect.any(String),
      url: expect.any(String),
      mimeType: 'image/png',
      sizeBytes: VALID_PNG.length,
    });

    const { rows } = await getAdminPool().query(
      `SELECT * FROM media_assets WHERE id = $1`,
      [res.body.mediaId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].tenant_id).toBe(tenant.id);
    expect(rows[0].owner_id).toBe(user.id);
    expect(typeof rows[0].blob_path).toBe('string');
    expect(rows[0].blob_path.length).toBeGreaterThan(0);
    expect(rows[0].mime_type).toBe('image/png');
    expect(Number(rows[0].size_bytes)).toBe(VALID_PNG.length);
    expect(rows[0].created_at).not.toBeNull();

    // Presigned URL check: HTTPS and contains SAS query parameters.
    expect(res.body.url).toMatch(/^https:\/\//);
    expect(res.body.url).toMatch(/[?&](se|sig|sv)=/);

    // The URL is usable for 24 hours and returns the original bytes.
    const download = await fetch(res.body.url);
    expect(download.status).toBe(200);
    const blob = Buffer.from(await download.arrayBuffer());
    expect(blob).toEqual(VALID_PNG);

    // SAS expiry is roughly 24 hours.
    const urlObj = new URL(res.body.url);
    const se = urlObj.searchParams.get('se');
    expect(se).not.toBeNull();
    const expiry = new Date(se as string).getTime();
    const now = Date.now();
    expect(expiry).toBeGreaterThan(now + 23 * 60 * 60 * 1000);
    expect(expiry).toBeLessThan(now + 25 * 60 * 60 * 1000);

    // Test fixture cleanup is intentionally omitted here; the contract does not
    // rely on a helper that would not exist during the RED phase. Blobs written
    // by this test are small and idempotent.
  });

  it('AC2: upload is gated by the media_upload feature', async () => {
    const tenant = await seedTenant(`T-13.9-ac2-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });
    await setFeature(tenant.id, 'media_upload', false);

    const res = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', VALID_PNG, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FEATURE_NOT_AVAILABLE');
  });

  it('AC3: image uploads are validated for supported type and max 8 MB', async () => {
    const tenant = await seedTenant(`T-13.9-ac3-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const unsupported = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', Buffer.from('BMP'), { filename: 'test.bmp', contentType: 'image/bmp' });

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const prev = process.env.MEDIA_MAX_IMAGE_BYTES;
    process.env.MEDIA_MAX_IMAGE_BYTES = '10';
    try {
      const tooLarge = await request(app)
        .post('/v1/outbound/media')
        .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
        .attach('file', Buffer.alloc(20), { filename: 'large.png', contentType: 'image/png' });

      expect(tooLarge.status).toBe(400);
      expect(tooLarge.body.code).toBe('MEDIA_TOO_LARGE');
    } finally {
      if (prev === undefined) delete process.env.MEDIA_MAX_IMAGE_BYTES;
      else process.env.MEDIA_MAX_IMAGE_BYTES = prev;
    }
  });

  it('AC4: video uploads are validated for supported type and max 512 MB', async () => {
    const tenant = await seedTenant(`T-13.9-ac4-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const unsupported = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', Buffer.from('AVI'), { filename: 'clip.avi', contentType: 'video/x-msvideo' });

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const prev = process.env.MEDIA_MAX_VIDEO_BYTES;
    process.env.MEDIA_MAX_VIDEO_BYTES = '10';
    try {
      const validButSmall = await request(app)
        .post('/v1/outbound/media')
        .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
        .attach('file', Buffer.alloc(5), { filename: 'small.mp4', contentType: 'video/mp4' });

      expect(validButSmall.status).toBe(200);
      expect(validButSmall.body.mimeType).toBe('video/mp4');

      const tooLarge = await request(app)
        .post('/v1/outbound/media')
        .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
        .attach('file', Buffer.alloc(20), { filename: 'large.mp4', contentType: 'video/mp4' });

      expect(tooLarge.status).toBe(400);
      expect(tooLarge.body.code).toBe('MEDIA_TOO_LARGE');
    } finally {
      if (prev === undefined) delete process.env.MEDIA_MAX_VIDEO_BYTES;
      else process.env.MEDIA_MAX_VIDEO_BYTES = prev;
    }
  });

  it('AC5: GET /v1/connectors/:platformId/targets returns pages/accounts', async () => {
    const tenant = await seedTenant(`T-13.9-ac5-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .get('/v1/connectors/test-publisher/targets')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id));

    expect(res.status).toBe(200);
    expect(res.body.platformId).toBe('test-publisher');
    expect(Array.isArray(res.body.targets)).toBe(true);
    expect(res.body.targets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.targets[0]).toHaveProperty('id');
    expect(res.body.targets[0]).toHaveProperty('name');
    expect(res.body.targets[0]).toHaveProperty('type');
  });

  it('AC6: POST /v1/outbound/posts accepts assets and assetTargets and resolves media URLs', async () => {
    const tenant = await seedTenant(`T-13.9-ac6-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const uploadRes = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', VALID_JPEG, { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(uploadRes.status).toBe(200);
    const mediaId = uploadRes.body.mediaId;

    const postRes = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .send({
        text: 'Rich post with image',
        targetPlatforms: ['test-publisher'],
        assetTargets: { 'test-publisher': 'test-page-1' },
        assets: [{ type: 'image', mediaId, alt: 'Alt text' }],
      });

    expect(postRes.status).toBe(202);
    expect(postRes.body.activityIds).toHaveLength(1);

    const { rows } = await getAdminPool().query(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [postRes.body.activityIds[0]]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].provider_id).toBe('test-publisher');
    expect(rows[0].target_asset_id).toBe('test-page-1');
    expect(rows[0].status).toBe('published');
    expect(rows[0].external_id).toBeTruthy();

    const payload = rows[0].payload || {};
    expect(payload.assetTargets).toMatchObject({ 'test-publisher': 'test-page-1' });
    expect(Array.isArray(payload.assets)).toBe(true);
    expect(payload.assets.length).toBe(1);
    expect(payload.assets[0]).toMatchObject({
      type: 'image',
      mediaId,
      url: expect.any(String),
      alt: 'Alt text',
    });
  });

  it('AC7: missing required assetTargets for a platform returns 400 MISSING_ASSET_TARGET', async () => {
    const tenant = await seedTenant(`T-13.9-ac7-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const res = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .send({
        text: 'No target post',
        targetPlatforms: ['facebook'],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_ASSET_TARGET');
  });

  it('AC8: connector asset translation returns platform_asset_rejected for unsupported assets', async () => {
    const tenant = await seedTenant(`T-13.9-ac8-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    // Upload a tiny, valid video so the mediaId resolves before the connector
    // rejects the asset type.
    const uploadRes = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', Buffer.alloc(5), { filename: 'clip.mp4', contentType: 'video/mp4' });
    expect(uploadRes.status).toBe(200);
    const mediaId = uploadRes.body.mediaId;

    const postRes = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .send({
        text: 'Video post',
        targetPlatforms: ['test-publisher'],
        assets: [{ type: 'video', mediaId }],
      });

    expect(postRes.status).toBe(202);

    const { rows } = await getAdminPool().query(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [postRes.body.activityIds[0]]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].error_code).toBe('platform_asset_rejected');
  });

  it('AC9: link-card asset with optional mediaId is accepted', async () => {
    const tenant = await seedTenant(`T-13.9-ac9-${randomUUID()}`);
    const user = await createInvitedUser(tenant.id, { email: `user-${randomUUID()}@example.com` });

    const uploadRes = await request(app)
      .post('/v1/outbound/media')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .attach('file', VALID_PNG, { filename: 'card.png', contentType: 'image/png' });
    expect(uploadRes.status).toBe(200);
    const mediaId = uploadRes.body.mediaId;

    const postRes = await request(app)
      .post('/v1/outbound/posts')
      .set('X-Test-Identity', tenantUserHeader(tenant.id, user.id))
      .send({
        text: 'Check this out',
        targetPlatforms: ['test-publisher'],
        assets: [{ type: 'link-card', url: 'https://example.com/article', mediaId }],
      });

    expect(postRes.status).toBe(202);
    const { rows } = await getAdminPool().query(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [postRes.body.activityIds[0]]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('published');
    const payload = rows[0].payload || {};
    expect(payload.assets[0]).toMatchObject({
      type: 'link-card',
      url: 'https://example.com/article',
      mediaId,
    });
  });
});
