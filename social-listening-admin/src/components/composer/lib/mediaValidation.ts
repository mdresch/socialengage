export const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const SUPPORTED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
]);

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

export interface MediaValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
}

function mediaTypeCategory(mimeType: string): 'image' | 'video' | 'unsupported' {
  if (SUPPORTED_IMAGE_TYPES.has(mimeType)) return 'image';
  if (SUPPORTED_VIDEO_TYPES.has(mimeType)) return 'video';
  return 'unsupported';
}

/**
 * Story 13.10 (ADR-0115) — client-side validation for media uploads.
 * Mirrors the backend limits enforced by social-listening-core's mediaAssetStore.
 */
export function validateMediaFile(file: File): MediaValidationResult {
  const category = mediaTypeCategory(file.type);
  if (category === 'unsupported') {
    return {
      ok: false,
      error: `Unsupported media type '${file.type}'. Allowed images: JPEG, PNG, GIF, WebP. Allowed videos: MP4, MOV.`,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    };
  }

  const max = category === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    return {
      ok: false,
      error: `${category} file exceeds the maximum size of ${max} bytes.`,
      code: 'MEDIA_TOO_LARGE',
    };
  }

  return { ok: true };
}
