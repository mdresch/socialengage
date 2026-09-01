# ADR-0115: Publishing — media upload and asset targeting

**Status:** Accepted (2026-08-28)

**Authorizes:** the media upload flow, per-asset targeting, and multi-asset dispatch rules for `POST /v1/outbound/posts` (ADR-0098).

**Source:** `docs/product-research/feature-designs/07-publishing-and-scheduling.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Text-only publishing is not enough
`docs/product-research/feature-designs/07-publishing-and-scheduling.md` and `ADR-0098` authorize basic publishing. Most real posts include images or videos. This ADR adds media upload, asset targeting, and the per-asset dispatch rules.

### 2. Platform asset rules vary
Facebook, Instagram, LinkedIn, and X have different image/video size, format, and caption rules. The connector must translate the platform-agnostic asset request into platform-specific uploads.

### 3. Asset targeting is required for multi-page connectors
A single tenant may have multiple Facebook Pages or LinkedIn pages. The composer must let the user pick which asset receives which post.

---

## Decision

### 1. Media upload endpoint
```
POST /v1/outbound/media
Content-Type: multipart/form-data

Response:
{
  mediaId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}
```

- The file is uploaded to Azure Blob Storage under a tenant-scoped container.
- A `media_assets` table tracks `id`, `tenant_id`, `owner_id`, `blob_path`, `mime_type`, `size_bytes`, and `created_at`.
- The response `url` is a presigned Blob URL valid for 24 hours, used by connectors to download and re-upload.

### 2. Asset model in `OutboundPost`
```ts
{
  text: string;
  assets?: Array<{
    type: 'image' | 'video' | 'link-card';
    mediaId?: string;              // references media_assets
    url?: string;                  // for link cards
    alt?: string;
    target?: string;               // platform-specific asset/page id
  }>;
  assetTargets: Record<string, string>; // platformId -> target asset/page id
}
```

### 3. Per-asset targeting
- `assetTargets` maps `platformId` to the target page/account (e.g. Facebook Page ID, LinkedIn Page URN).
- `GET /v1/connectors/:platformId/targets` lists available targets for the user (pages, boards, accounts).
- If a platform requires a target and none is selected, the request returns `400 MISSING_ASSET_TARGET`.
- A single post can target different pages on different platforms.

### 4. Connector asset translation
- Each `SocialConnector` with `publish?()` implements `uploadAssets()` or receives `mediaId` URLs and handles the platform-specific upload in `publish()`.
- `OutboundPost` assets are generic; the connector decides how many images, videos, or link cards the platform allows.
- If the platform rejects an asset (format, size), `publish()` returns a `422 PLATFORM_ASSET_REJECTED` with the reason.

### 5. Media validation
- Supported image types: JPEG, PNG, GIF, WebP.
- Supported video types: MP4, MOV (where the platform supports it).
- Max image size: 8 MB.
- Max video size: 512 MB (v1 supports only images and link cards for most connectors).
- Images are validated for width/height where the platform publishes limits.

### 6. Link cards
- `type='link-card'` uses OpenGraph metadata from the provided `url`.
- The connector may generate a link card preview or attach the URL directly.
- `image` for a link card is optional and can be provided as a `mediaId`.

---

## Consequences

1. **Rich posts:** users can publish images, videos, and link cards.
2. **Multi-page publishing:** one composed post can go to multiple pages/accounts per platform.
3. **Blob storage cost:** media uploads increase storage and egress.
4. **Connector complexity:** each `publish?()` connector must handle asset upload and validation.

---

## Alternatives considered

1. **Store media in the database as `bytea` or `text`.**
   - *Rejected:* it bloats Postgres. Blob Storage is the right place for media.

2. **Require pre-uploaded public URLs for media.**
   - *Rejected:* users do not always have a CDN. The platform provides the upload path.

3. **Allow a single asset to target all platforms without per-asset targeting.**
   - *Rejected:* different platforms (and pages) require different targeting. Per-asset targeting is necessary.

---

## Open questions

- Should video upload be supported in v1, or deferred to v2?
- How is asset expiry handled? Should unreferenced media be cleaned up after 30 days?
- Should `media_assets` include a thumbnail or preview for the UI?
- How does the composer preview a multi-image post across different platforms?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0098` (publishing and scheduling), `ADR-0101` (connector capabilities)
