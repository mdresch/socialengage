import { randomUUID } from 'crypto';
import { withTenant } from '../db/withTenant';
import {
  ensureMediaContainer,
  uploadMediaBlob,
  generateMediaDownloadUrl,
} from './mediaBlobClient';

export interface MediaAsset {
  id: string;
  tenantId: string;
  ownerId: string;
  blobPath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MediaUploadResult {
  mediaId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaAssetInput {
  tenantId: string;
  ownerId: string;
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export class MediaValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime', // MOV
]);

export function maxImageBytes(): number {
  return Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 8 * 1024 * 1024);
}

export function maxVideoBytes(): number {
  return Number(process.env.MEDIA_MAX_VIDEO_BYTES ?? 512 * 1024 * 1024);
}

function mediaTypeCategory(mimeType: string): 'image' | 'video' | 'unsupported' {
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.has(mimeType)) return 'video';
  return 'unsupported';
}

/**
 * Story 13.9 (ADR-0115) — validates the MIME type and size of an uploaded media
 * file before any bytes are written to Blob Storage or the `media_assets` table.
 */
export function validateMediaUpload(mimeType: string, sizeBytes: number): void {
  const category = mediaTypeCategory(mimeType);
  if (category === 'unsupported') {
    throw new MediaValidationError(
      `Unsupported media type '${mimeType}'. Allowed images: JPEG, PNG, GIF, WebP. Allowed videos: MP4, MOV.`,
      'UNSUPPORTED_MEDIA_TYPE'
    );
  }
  const max = category === 'image' ? maxImageBytes() : maxVideoBytes();
  if (sizeBytes > max) {
    throw new MediaValidationError(
      `${category} file exceeds the maximum size of ${max} bytes.`,
      'MEDIA_TOO_LARGE'
    );
  }
}

function mimeToExtension(mimeType: string): string | undefined {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  };
  return map[mimeType];
}

/**
 * Story 13.9 (ADR-0115) — uploads a media file to tenant-scoped Blob Storage and
 * persists its metadata in the `media_assets` table, returning a 24-hour
 * presigned download URL.
 */
export async function createMediaAsset(input: MediaAssetInput): Promise<MediaUploadResult> {
  validateMediaUpload(input.mimeType, input.sizeBytes);

  const mediaId = randomUUID();
  const ext = mimeToExtension(input.mimeType) ?? 'bin';
  const blobPath = `media/${input.tenantId}/${mediaId}.${ext}`;

  await ensureMediaContainer();
  await uploadMediaBlob(blobPath, input.buffer, input.mimeType);

  await withTenant(input.tenantId, async (client) => {
    await client.query(
      `INSERT INTO media_assets
         (id, tenant_id, owner_id, blob_path, mime_type, size_bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [mediaId, input.tenantId, input.ownerId, blobPath, input.mimeType, input.sizeBytes]
    );
  });

  const url = await generateMediaDownloadUrl(blobPath);
  return {
    mediaId,
    url,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}

/**
 * Story 13.9 (ADR-0115) — fetches a single media asset by id, scoped to the
 * tenant via RLS.
 */
export async function getMediaAssetById(tenantId: string, mediaId: string): Promise<MediaAsset | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<any>(
      `SELECT id, tenant_id, owner_id, blob_path, mime_type, size_bytes, created_at
       FROM media_assets WHERE id = $1`,
      [mediaId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      ownerId: r.owner_id,
      blobPath: r.blob_path,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes),
      createdAt: r.created_at.toISOString(),
    };
  });
}

/**
 * Canonical asset attached to an `OutboundPost`. Mirrors the BRD/FDD payload:
 * images and videos reference a `mediaId`; link-cards carry an external `url`
 * and optionally a preview `mediaId`.
 */
export interface OutboundAsset {
  type: 'image' | 'video' | 'link-card';
  mediaId?: string;
  url?: string;
  imageUrl?: string;
  alt?: string;
  target?: string;
}

/**
 * Story 13.9 (ADR-0115) — resolves `mediaId` references in an `OutboundPost`
 * payload into 24-hour presigned Blob URLs. For images and videos the resolved
 * URL is placed in `url`; for link-cards it is placed in `imageUrl` so the
 * link's own `url` is preserved.
 *
 * Throws `MediaValidationError` (MEDIA_ASSET_NOT_FOUND) if a referenced mediaId
 * does not belong to the tenant.
 */
export async function resolveMediaAssets(
  tenantId: string,
  assets: OutboundAsset[]
): Promise<OutboundAsset[]> {
  if (!assets || assets.length === 0) return [];

  const requestedMediaIds = assets
    .map((a) => a.mediaId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const rows: any[] =
    requestedMediaIds.length > 0
      ? await withTenant(tenantId, async (client) => {
          const { rows } = await client.query<any>(
            `SELECT id, blob_path, mime_type, size_bytes
             FROM media_assets
             WHERE id = ANY($1::uuid[])`,
            [requestedMediaIds]
          );
          return rows;
        })
      : [];

  const byId = new Map<string, { blobPath: string; mimeType: string; sizeBytes: number }>();
  for (const r of rows) {
    byId.set(r.id, {
      blobPath: r.blob_path,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes),
    });
  }

  const resolved: OutboundAsset[] = [];
  for (const asset of assets) {
    if (asset.mediaId) {
      const media = byId.get(asset.mediaId);
      if (!media) {
        throw new MediaValidationError(
          `Media asset '${asset.mediaId}' not found for this tenant.`,
          'MEDIA_ASSET_NOT_FOUND'
        );
      }
      const url = await generateMediaDownloadUrl(media.blobPath);
      if (asset.type === 'link-card') {
        resolved.push({ ...asset, imageUrl: url });
      } else {
        resolved.push({ ...asset, url });
      }
    } else {
      resolved.push(asset);
    }
  }
  return resolved;
}
