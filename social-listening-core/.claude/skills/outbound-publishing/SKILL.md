---
name: outbound-publishing
description: Backend service and HTTP routes for publishing and scheduling outbound social media posts across connected platforms.
---

# Outbound Publishing & Scheduling Service

Governed by **ADR-0098**, **BRD-0098**, **FDD-0098**, and **Story 11.7**.

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
   - `GET /v1/outbound/posts`
   - `PATCH /v1/outbound/activities/:id/cancel`
   - `PATCH /v1/outbound/activities/:id/reschedule`
   - `GET /v1/connectors/:platformId/targets`
