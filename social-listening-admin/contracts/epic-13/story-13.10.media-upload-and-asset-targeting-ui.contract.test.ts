/**
 * Contract: Story 13.10 (ADR-0115, BRD-0115, FDD-0115) — Media upload and asset targeting UI (frontend).
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-1310
 *
 * Intent:
 *   Extend the PolypostComposer with real media upload to tenant-scoped Blob Storage,
 *   per-platform image/link-card preview, asset target selection for multi-page platforms,
 *   file validation feedback, and scheduled publishing with media.
 *
 * Scope:
 *   - social-listening-admin/contracts/epic-13/story-13.10.media-upload-and-asset-targeting-ui.contract.test.ts
 *   - social-listening-admin/src/lib/core-client.ts (uploadOutboundMedia, PublishOutboundPostInput)
 *   - social-listening-admin/src/app/api/outbound/media/route.ts (new BFF proxy)
 *   - social-listening-admin/src/app/api/outbound/posts/route.ts (forward new payload)
 *   - social-listening-admin/src/app/api/connectors/[platformId]/targets/route.ts (existing target proxy)
 *   - social-listening-admin/src/components/composer/PolypostComposer.tsx (drop zone, target selector, schedule)
 *   - social-listening-admin/src/components/composer/PlatformPreviewRails.tsx (per-platform preview)
 *   - social-listening-admin/src/components/composer/previews/*.tsx (image/link-card rendering)
 *   - social-listening-admin/src/components/composer/lib/mediaValidation.ts (client-side validation)
 *   - social-listening-admin/.claude/skills/polypost-composer/SKILL.md
 *   - social-listening-admin/.claude/skills/core-api-client/SKILL.md
 *   - social-listening-admin/.claude/skills/publishing-ui/SKILL.md
 *
 * Contract to encode:
 *   (1) core-client.ts exposes an uploadOutboundMedia function that POSTs multipart to /v1/outbound/media.
 *   (2) BFF routes /api/outbound/media, /api/outbound/posts and /api/connectors/:platformId/targets
 *       call the matching core-client functions at their real production call sites.
 *   (3) PolypostComposer has a drag-and-drop / file-input media drop zone and uploads files
 *       to /api/outbound/media, persisting the returned mediaId and presigned url.
 *   (4) Platform preview cards render attached images and link-card previews per target platform.
 *   (5) PolypostComposer fetches /api/connectors/:platformId/targets for facebook/instagram/linkedin
 *       and lets the user pick an assetTargets value for each.
 *   (6) File validation rejects unsupported MIME types and oversized image/video files,
 *       showing visible feedback in the composer.
 *   (7) Scheduled publishing with media is submitted via POST /api/outbound/posts with
 *       scheduledFor, assets and assetTargets in the request body.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

if (!process.env.CORE_API_BASE_URL) {
  process.env.CORE_API_BASE_URL = 'http://localhost:3001';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('base64');
}

describe('Story 13.10 — Media upload and asset targeting UI (frontend)', () => {
  describe('AC1: core-client.ts exposes media upload and publishing payload types', () => {
    it('exports uploadOutboundMedia calling POST /v1/outbound/media', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/export\s+async\s+function\s+uploadOutboundMedia\s*\(/);
      expect(source).toContain('/v1/outbound/media');
      expect(source).toContain('MediaUploadResult');
    });

    it('PublishOutboundPostInput carries assets, assetTargets and scheduledFor', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/export\s+interface\s+PublishOutboundPostInput/);
      expect(source).toMatch(/assets\?:\s*OutboundPostAsset/);
      expect(source).toMatch(/assetTargets\?:\s*Record/);
      expect(source).toMatch(/scheduledFor\?:/);
    });

    it('uploadOutboundMedia posts a FormData body and returns the media payload', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) =>
            name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
        }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(
        new Response(
          JSON.stringify({
            mediaId: 'm-123',
            url: 'https://blob.core.windows.net/media/m-123.jpg?sig=x',
            mimeType: 'image/jpeg',
            sizeBytes: 4096,
          }),
          { status: 200 }
        )
      );

      const { uploadOutboundMedia } = await import('../../src/lib/core-client');
      const form = new FormData();
      form.append('file', new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' }));
      const result = await uploadOutboundMedia(form);

      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls[0];
      const url = call[0] as string;
      expect(url).toContain('/v1/outbound/media');
      expect((call[1] as any)?.method).toBe('POST');
      expect((call[1] as any)?.body).toBeInstanceOf(FormData);
      expect(result.mediaId).toBe('m-123');
      expect(result.url).toContain('blob.core.windows.net');
    });
  });

  describe('AC2: BFF routes call the matching core-client functions', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('POST /api/outbound/media exists and proxies to uploadOutboundMedia', async () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'media', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSource = readSrc('app', 'api', 'outbound', 'media', 'route.ts');
      expect(routeSource).toMatch(/uploadOutboundMedia/);
      expect(routeSource).toMatch(/POST/);

      const uploadOutboundMediaMock = jest.fn().mockResolvedValue({
        mediaId: 'm-1',
        url: 'https://blob.core.windows.net/media/m-1.jpg?sig=x',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
      });
      jest.doMock('../../src/lib/core-client', () => ({
        uploadOutboundMedia: uploadOutboundMediaMock,
      }));

      const { POST } = await import('../../src/app/api/outbound/media/route');
      const form = new FormData();
      form.append('file', new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' }));
      const request = new Request('http://localhost:3000/api/outbound/media', {
        method: 'POST',
        body: form,
      });
      const response = await POST(request);

      expect(uploadOutboundMediaMock).toHaveBeenCalled();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.mediaId).toBe('m-1');
      expect(body.mimeType).toBe('image/jpeg');
    });

    it('POST /api/outbound/posts forwards assets, assetTargets and scheduledFor', async () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'outbound', 'posts', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSource = readSrc('app', 'api', 'outbound', 'posts', 'route.ts');
      expect(routeSource).toMatch(/publishOutboundPost/);
      expect(routeSource).toMatch(/POST/);

      const publishOutboundPostMock = jest.fn().mockResolvedValue({
        activityIds: ['a-1'],
        scheduledFor: '2026-09-03T10:00:00.000Z',
      });
      jest.doMock('../../src/lib/core-client', () => ({
        publishOutboundPost: publishOutboundPostMock,
      }));

      const { POST } = await import('../../src/app/api/outbound/posts/route');
      const payload = {
        text: 'Hello with media',
        targetPlatforms: ['facebook', 'linkedin'],
        assets: [{ type: 'image', mediaId: 'm-1' }],
        assetTargets: { facebook: 'page-1', linkedin: 'urn:li:organization:1' },
        scheduledFor: '2026-09-03T10:00:00.000Z',
        perPlatformOverrides: { linkedin: 'Hello LinkedIn' },
      };
      const request = new Request('http://localhost:3000/api/outbound/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const response = await POST(request as any);

      expect(publishOutboundPostMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: payload.assets,
          assetTargets: payload.assetTargets,
          scheduledFor: payload.scheduledFor,
        })
      );
      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.activityIds).toEqual(['a-1']);
    });

    it('GET /api/connectors/:platformId/targets returns the target list', async () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', '[platformId]', 'targets', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSource = readSrc('app', 'api', 'connectors', '[platformId]', 'targets', 'route.ts');
      expect(routeSource).toMatch(/getConnectorTargets/);

      const getConnectorTargetsMock = jest.fn().mockResolvedValue([
        { id: 'page-1', name: 'Page 1', type: 'facebook_page' },
      ]);
      jest.doMock('../../src/lib/core-client', () => ({
        getConnectorTargets: getConnectorTargetsMock,
      }));

      const { GET } = await import('../../src/app/api/connectors/[platformId]/targets/route');
      const response = await GET(
        new Request('http://localhost:3000/api/connectors/facebook/targets') as any,
        { params: Promise.resolve({ platformId: 'facebook' }) }
      );

      expect(getConnectorTargetsMock).toHaveBeenCalledWith('facebook');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.targets).toEqual([{ id: 'page-1', name: 'Page 1', type: 'facebook_page' }]);
    });
  });

  describe('AC3: Media upload drop zone in PolypostComposer', () => {
    it('PolypostComposer has drag/drop handlers and a file input for images/videos', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/handleDragOver/);
      expect(source).toMatch(/handleDragLeave/);
      expect(source).toMatch(/handleDrop/);
      expect(source).toMatch(/type\s*=\s*['"]file['"]/);
      expect(source).toMatch(/accept\s*=\s*['"].*(?:image|video)/);
    });

    it('uploads files to /api/outbound/media and stores the returned mediaId', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/\/api\/outbound\/media/);
      expect(source).toMatch(/mediaId/);
      expect(source).toMatch(/setMedia\s*\(/);
    });

    it('shows a drop-zone overlay while dragging', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/isDragging/);
      expect(source).toMatch(/Drop images and videos|Drop files|Drop media/);
    });
  });

  describe('AC4: Image/link card preview per target platform', () => {
    it('PlatformPreviewRails passes media and linkPreview to each preview card', () => {
      const source = readSrc('components', 'composer', 'PlatformPreviewRails.tsx');
      expect(source).toMatch(/getMediaForPlatform/);
      expect(source).toMatch(/linkPreview/);
    });

    it('preview cards render attached images with alt text', () => {
      const facebook = readSrc('components', 'composer', 'previews', 'FacebookPreviewCard.tsx');
      const linkedin = readSrc('components', 'composer', 'previews', 'LinkedInPreviewCard.tsx');
      expect(facebook).toMatch(/media\s*&&\s*media\.length\s*>\s*0/);
      expect(linkedin).toMatch(/media\s*&&\s*media\.length\s*>\s*0/);
      expect(facebook).toMatch(/alt\s*=\s*\{[^}]*altText/);
      expect(linkedin).toMatch(/alt\s*=\s*\{[^}]*altText/);
    });

    it('link-card preview is rendered via CardLinkPreview', () => {
      const source = readSrc('components', 'composer', 'PlatformPreviewRails.tsx');
      expect(source).toMatch(/linkPreview/);
      const facebook = readSrc('components', 'composer', 'previews', 'FacebookPreviewCard.tsx');
      const linkedin = readSrc('components', 'composer', 'previews', 'LinkedInPreviewCard.tsx');
      expect(facebook).toMatch(/CardLinkPreview/);
      expect(linkedin).toMatch(/CardLinkPreview/);
    });
  });

  describe('AC5: assetTargets selector for multi-page platforms', () => {
    it('PolypostComposer keeps an assetTargets state and fetches per-platform targets', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/assetTargets/);
      expect(source).toMatch(/\/api\/connectors/);
      expect(source).toMatch(/\/targets/);
    });

    it('renders a target selector for platforms that require a target asset', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/<select/);
      expect(source).toMatch(/setAssetTargets/);
      expect(source).toMatch(/facebook|linkedin|instagram/);
    });

    it('includes assetTargets in the outbound posts publish body', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/assetTargets/);
      expect(source).toMatch(/\/api\/outbound\/posts/);
      expect(source).toMatch(/targetPlatforms/);
    });
  });

  describe('AC6: File validation feedback', () => {
    it('exposes a client-side media validation helper with type and size limits', async () => {
      const helperPath = path.join(ADMIN_ROOT, 'src', 'components', 'composer', 'lib', 'mediaValidation.ts');
      expect(fs.existsSync(helperPath)).toBe(true);
      const source = readSrc('components', 'composer', 'lib', 'mediaValidation.ts');
      expect(source).toMatch(/validateMediaFile/);
      expect(source).toMatch(/image\/jpeg|image\/png|image\/gif|image\/webp/);
      expect(source).toMatch(/video\/mp4|video\/quicktime/);
      expect(source).toMatch(/8\s*\*\s*1024\s*\*\s*1024|8388608/);
      expect(source).toMatch(/512\s*\*\s*1024\s*\*\s*1024|536870912/);

      const { validateMediaFile } = await import(
        '../../src/components/composer/lib/mediaValidation'
      );
      const badType = new File(['x'], 'doc.txt', { type: 'text/plain' });
      expect(validateMediaFile(badType).ok).toBe(false);

      const { MAX_IMAGE_BYTES } = await import(
        '../../src/components/composer/lib/mediaValidation'
      );
      const big = new File([new ArrayBuffer(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
      expect(validateMediaFile(big).ok).toBe(false);

      const ok = new File(['x'], 'ok.jpg', { type: 'image/jpeg' });
      Object.defineProperty(ok, 'size', { value: 1024 });
      expect(validateMediaFile(ok).ok).toBe(true);
    });

    it('PolypostComposer shows validation feedback for rejected files', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/mediaUploadErrors/);
      expect(source).toMatch(/UNSUPPORTED_MEDIA_TYPE|MEDIA_TOO_LARGE/);
      expect(source).toMatch(/validateMediaFile/);
    });
  });

  describe('AC7: Scheduled publishing with media', () => {
    it('PolypostComposer stores a scheduleDate and sends scheduledFor in the publish body', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/scheduleDate/);
      expect(source).toMatch(/scheduledFor/);
      expect(source).toMatch(/scheduledFor.*scheduleDate/);
    });

    it('POST /api/outbound/posts is called with assets and scheduledFor', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/assets/);
      expect(source).toMatch(/scheduledFor/);
      expect(source).toMatch(/fetch\(['"]\/api\/outbound\/posts/);
    });

    it('handles the 202 Accepted response from the publish BFF', () => {
      const source = readSrc('components', 'composer', 'PolypostComposer.tsx');
      expect(source).toMatch(/202/);
      expect(source).toMatch(/activityIds/);
      expect(source).toMatch(/scheduledFor/);
    });
  });
});
