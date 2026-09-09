---
name: outbound-publishing
description: Backend service and HTTP routes for publishing and scheduling outbound social media posts across connected platforms.
---

# Outbound Publishing & Scheduling Service

Governed by **ADR-0098**, **BRD-0098**, **FDD-0098**, and **Story 11.7**.

## Contracts that constrain this component

- `social-listening-core/contracts/epic-11/story-11.7.publishing-and-scheduling.contract.test.ts` — Story 11.7 contract test.
- `social-listening-core/contracts/epic-13/story-13.9.publishing-media-upload-and-asset-targeting.contract.test.ts` — Story 13.9 contract test.

## Key Architecture & Responsibilities

1. **`outbound_activities` Audit Table**:
   - `activity_type = 'post'`
   - `status`: `scheduled`, `publishing`, `published`, `pending`, `sent`, `failed`, `cancelled`.
   - `scheduled_for`: UTC timestamp for future scheduled execution.
   - `published_at`: UTC timestamp of successful platform publication.
   - `target_asset_id` and `target_asset_type`: Platform target page/account identifiers.

2. **Publishing Service (`outboundPublishingService.ts`)**:
   - `createOutboundPost(tenantId, userId, options)`:
     - Validates `targetPlatforms` and `assetTargets`.
     - Fails closed with `400 MISSING_ASSET_TARGET` if a target is required (e.g. Facebook Page, LinkedIn Organization) but omitted.
     - Persists activities with `status='scheduled'` or dispatches immediately.
     - Returns `HTTP 202 Accepted` with `{ activityIds, scheduledFor }`.
   - `cancelOutboundActivity(tenantId, activityId)`:
     - Cancels scheduled activity; rejects already published activities with `409 CANNOT_CANCEL_PUBLISHED`.
   - `rescheduleOutboundActivity(tenantId, activityId, newScheduledFor)`:
     - Updates `scheduled_for` timestamp.
   - `getPlatformTargets(tenantId, userId, platformId)`:
     - Returns available pages/accounts for the connected connector.

3. **Background Scheduler Worker (`outboundPublishScheduler.ts`)**:
   - `runScheduledPublishBatch()`:
     - Finds due activities where `status = 'scheduled' AND scheduled_for <= now()`.
     - Transitions to `publishing` and executes `connector.publish()`.
     - Updates status to `published` or `failed`.

4. **HTTP Routes**:
   - `POST /v1/outbound/posts` (202 Accepted)
   - `POST /v1/outbound/media` (200 OK) — Story 13.9 media upload
   - `GET /v1/outbound/posts`
   - `PATCH /v1/outbound/activities/:id/cancel`
   - `PATCH /v1/outbound/activities/:id/reschedule`
   - `GET /v1/connectors/:platformId/targets`

## Story 13.9 (ADR-0115) — Media Assets & Asset Targeting

- `createOutboundPost()` accepts an `assets` array and `assetTargets` map.
- Image/video assets reference `mediaId` values from the `media_assets` table.
- `link-card` assets carry an external `url` and an optional preview `mediaId`.
- Before persistence, `resolveMediaAssets()` converts `mediaId` references into 24-hour presigned Azure Blob URLs.
- Resolved assets are stored in `outbound_activities.assets` and `outbound_activities.payload` and passed to `connector.publish()`.
- Connectors may reject unsupported assets with `ClassifiableError('platform_asset_rejected')`, which becomes the activity `error_code`.
- v1 Facebook and LinkedIn connectors are text-only; posts with assets to those platforms fail with `platform_asset_rejected`.
