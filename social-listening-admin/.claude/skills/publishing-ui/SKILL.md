---
name: publishing-ui
description: Frontend UI components and BFF routes for composing, scheduling, and managing outbound social posts across connected networks.
---

# Outbound Publishing & Scheduling UI

Governed by **ADR-0098**, **BRD-0098**, **FDD-0098**, and **Story 11.8**.

## Contracts that constrain this component

- `social-listening-admin/contracts/epic-11/story-11.8.publishing-ui.contract.test.ts` — Story 11.8 contract test.

## Architecture & Responsibilities

1. **Client Methods (`core-client.ts`)**:
   - `publishOutboundPost(input)`: calls `POST /v1/outbound/posts` (returns `202 Accepted` with `activityIds` and `scheduledFor`).
   - `listOutboundPosts(options)`: calls `GET /v1/outbound/posts` with status and provider filters.
   - `cancelOutboundActivity(activityId)`: calls `PATCH /v1/outbound/activities/:id/cancel`.
   - `rescheduleOutboundActivity(activityId, scheduledFor)`: calls `PATCH /v1/outbound/activities/:id/reschedule`.
   - `getConnectorTargets(platformId)`: calls `GET /v1/connectors/:platformId/targets`.

2. **BFF Proxy Routes**:
   - `POST /api/outbound/posts`
   - `GET /api/outbound/posts`
   - `PATCH /api/outbound/activities/[id]/cancel`
   - `PATCH /api/outbound/activities/[id]/reschedule`
   - `GET /api/connectors/[platformId]/targets`

3. **Components**:
   - `OutboundComposerModal.tsx`: modal supporting text composition, multi-network selection, asset targeting (Facebook Pages, LinkedIn Organizations), and dispatch mode ("Publish Now" vs "Schedule for Later" with local datetime picker).
   - `OutboundPostsView.tsx`: table queue displaying scheduled, publishing, published, failed, and cancelled posts with filter tabs, cancel buttons, and a rescheduling modal.
   - `/tenant/posts/outbound`: dedicated route page.
