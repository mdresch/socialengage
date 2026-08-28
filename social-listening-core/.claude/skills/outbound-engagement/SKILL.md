---
name: outbound-engagement
description: Outbound engagement service for social connectors — replies, comments, and future write actions. Read this before touching src/outbound/outboundEngagementService.ts, SocialConnector.reply?(), or RequestGate outbound gating.
---

# Outbound Engagement Service

## What this is

The `outboundEngagementService` in `src/outbound/outboundEngagementService.ts` executes human-initiated, user-bound outbound actions against the originating social platform for an already-ingested `SocialPost`. v1 is limited to `reply` (comments), but the shape is intentionally extensible to `repost`, `like`, etc. It does not persist the `outbound_activities` row itself; that is the REST endpoint's responsibility (Story 3.14, ADR-0073 §3). It returns an `outbound_activities`-shaped result with `status`, `externalId`, `externalUrl`, and `errorCode`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0073 | Outbound reply path: optional `SocialConnector.reply?()`, separate `RequestGate` key `(tenantId, providerId, 'outbound')`, `outbound_activities` audit table, and `POST /v1/posts/:id/replies` | 2.26 / 3.14 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.26.connector-reply-framework.contract.test.ts` — `SocialConnector` accepts an optional `reply?()`; `outboundEngagementService.invoke()` calls it and returns `sent`/`failed` rows; connectors without `reply()` fail with `reply_not_supported`; `ClassifiableError` thrown from `reply()` maps to the row's `errorCode`.
- `contracts/epic-2/story-2.27.facebook-page-reply-implementation.contract.test.ts` — the first real `SocialConnector.reply()` call site; `outboundEngagementService.invoke()` with `facebookConnector` exercises the full outbound path from gate to `POST /{post-id}/comments` and back.
- `contracts/epic-3/story-3.14.outbound-reply-audit.contract.test.ts` — `outbound_activities` table, `src/outbound/outboundActivityStore.ts`, `POST /v1/posts/:id/replies`, and `GET /v1/posts/:id/replies` are real; the REST endpoint persists the audit row and maps `ClassifiableError` to provider-appropriate HTTP statuses.
- `contracts/epic-3/story-3.15.outbound-post-publishing-audit.contract.test.ts` (ADR-0075) — the same `outbound_activities` table now also holds `activity_type='post'` rows with `target_asset_id`, `payload`, `scheduled_for`, and `cancelled_at`; the `activityType`/`status` unions are widened accordingly.

## How to extend this safely

- **Adding a new outbound action type:** generalize `activityType: 'reply'` to a union and add an optional method on `SocialConnector` (e.g., `repost?()`). Keep the same `acquireForOutbound()` gate and `outbound_activities`-shaped return. If the new action needs a different rate limit, add `getOutboundRateLimitConfig?()` to the connector; if the new action's gate must be independent, split the `outbound` key (e.g., `outbound:repost`) in `requestGate.ts`.
- **Calling `reply()` from a REST endpoint:** the endpoint is responsible for resolving the user's credential, validating that the post belongs to the tenant, recording the `outbound_activities` row, and returning it (Story 3.14). Call `outboundEngagementService.invoke()` and use the returned `externalId`/`externalUrl` to populate the `sent` row.
- **Reclassifying connector reply errors:** a connector's `reply()` should throw `ClassifiableError('missing_permission' | 'post_not_found' | 'reconnect_required' | 'rate_limited' | ...)` for recoverable/platform-meaningful failures. Any other thrown error is treated as `'network'` by `invoke()`.

## Load-bearing constraints — do not change casually

- **Outbound and ingestion gates must remain separate keys (ADR-0073 §5).** `acquireForOutbound()` uses `(tenantId, providerId, 'outbound')` in `requestGate.ts`. Collapsing this into the ingestion `(tenantId, providerId)` key would let heavy outbound reply bursts starve ingestion or vice versa.
- **`outboundEngagementService.invoke()` must not persist `outbound_activities` in v1.** Its job is to execute the connector action and return a row-shaped result; the REST endpoint (Story 3.14) owns persistence so it can return HTTP 201 and handle the `pending`/`sent`/`failed` status transition.
- **`reply()` is always user-bound (ADR-0073 §4).** It requires a per-user credential for the post's provider. Do not allow a tenant-wide credential or a cross-user credential to be used for an outbound reply.
- **The `SocialConnector.reply?()` signature is fixed:** `(post: SocialPostSummary, body: string, credential: string) => Promise<{ externalId: string; externalUrl: string }>`. Changing it requires updating the contract and every connector-specific `reply()` implementation.

## Known gaps / deferred work

- **Real connector-specific reply implementations (Facebook, Instagram, LinkedIn) are not yet built.** Story 2.27 begins the Facebook `reply()` implementation; other platforms are deferred to their own stories.
- **REST endpoint `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies` are built in Story 3.14**; `outboundEngagementService` still does not persist the row, but the endpoint does via `src/outbound/outboundActivityStore.ts`.
- **The `outbound_activities` table is created in Story 3.14 and extended for `post` rows in Story 3.15**; `outboundEngagementService` returns a row-shaped object that the reply endpoint persists.
- **The separate `outbound-post` component (new post publishing, Story 2.28/3.15) uses a sibling service** in `src/outbound/outboundPublishService.ts` and a separate `RequestGate` key `outbound_post`.

## Relations to other components

- Calls into `src/connectors/requestGate.ts` (`acquireForOutbound()`) — relationship asserted by `story-2.26` contract's AC4 gate isolation tests.
- Calls into `src/connectors/types.ts` (`SocialConnector.reply?()`) — relationship asserted by `story-2.26` contract's AC1 and AC2.
- Calls into `src/ingestion/errorClassification.ts` (`ClassifiableError`) — relationship asserted by `story-2.26` contract's AC2 and AC3.
- Sibling to `src/outbound/outboundPublishService.ts` (new post publishing, Story 2.28) — both use the same row-shape pattern but separate `RequestGate` keys and `activity_type` values.
