---
name: media-assets
description: Tenant-scoped media upload, storage in Azure Blob, and presigned URL resolution for outbound posts.
---

# Media Assets

Governed by **ADR-0115**, **BRD-0115**, **FDD-0115**, and **Story 13.9**.

## Key Architecture & Responsibilities

1. **Upload Endpoint (`POST /v1/outbound/media`)**:
   - Multipart/form-data, single `file` field.
   - Feature-gated by `media_upload`; disabled tenants get `403 FEATURE_NOT_AVAILABLE`.
   - Validates MIME type and size before storage.
   - Returns `{ mediaId, url, mimeType, sizeBytes }`, where `url` is a 24-hour presigned Azure Blob SAS URL.

2. **Validation Rules**:
   - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`; max `MEDIA_MAX_IMAGE_BYTES` (default 8 MB).
   - Videos: `video/mp4`, `video/quicktime` (MOV); max `MEDIA_MAX_VIDEO_BYTES` (default 512 MB).
   - Rejected with `400 UNSUPPORTED_MEDIA_TYPE` or `400 MEDIA_TOO_LARGE`.

3. **Storage (`mediaBlobClient.ts`)**:
   - Azure Blob container `social-listening-media` (override with `MEDIA_CONTAINER_NAME`).
   - `DefaultAzureCredential` and user-delegation SAS tokens (24-hour lifetime).
   - Blob path pattern: `media/{tenantId}/{mediaId}.{ext}`.
   - Container is created on first upload (`createIfNotExists`).

4. **Metadata Table (`media_assets`)**:
   - `id`, `tenant_id`, `owner_id`, `blob_path`, `mime_type`, `size_bytes`, `created_at`.
   - RLS scoped by `tenant_id`.

5. **Asset Resolution (`mediaAssetStore.ts`)**:
   - `createMediaAsset(input)` uploads and records a new media asset.
   - `getMediaAssetById(tenantId, mediaId)` fetches metadata for a tenant-scoped asset.
   - `resolveMediaAssets(tenantId, assets)` resolves `mediaId` references in an outbound post into presigned URLs:
     - `image`/`video` assets receive `url`.
     - `link-card` assets with a preview `mediaId` receive `imageUrl` while preserving their own `url`.
   - Missing `mediaId` references throw `400 MEDIA_ASSET_NOT_FOUND`.

## Consumer: Outbound Publishing

`outboundPublishingService.createOutboundPost()` calls `resolveMediaAssets()` before persisting the activity. The resolved `assets` array and `assetTargets` map are stored in `outbound_activities.payload` and passed to `connector.publish()`.

Connectors receive `OutboundPostPayload.assets` with presigned URLs and may:
- Translate them into platform-specific uploads, or
- Reject them with `ClassifiableError('platform_asset_rejected', ...)`.

The v1 Facebook and LinkedIn connectors are text-only and will reject any post that includes assets.
