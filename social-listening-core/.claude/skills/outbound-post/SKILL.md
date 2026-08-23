---
name: outbound-post
description: Outbound post publishing service for social connectors — new, original posts dispatched to connected platform assets. Read this before touching src/outbound/outboundPublishService.ts, SocialConnector.publish?(), or RequestGate outbound post gating.
---

# Outbound Post Service

## What this is

The `outboundPublishService` in `src/outbound/outboundPublishService.ts` executes human-initiated, user-bound outbound *post* actions: publishing a new, original post to one connected platform asset (a Facebook Page, a LinkedIn profile/organization, etc.). v1 is limited to text/link-card posts; media upload, scheduling dispatch, bulk publishing, and third-party assets are explicitly deferred. It does not persist the `outbound_activities` row itself; that is the REST endpoint's responsibility (Story 3.15, ADR-0075 §3). It returns an `outbound_activities`-shaped result with `status`, `externalId`, `externalUrl`, `errorCode`, and `targetAssetId`/`targetAssetType`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0075 | Outbound post publishing path: optional `SocialConnector.publish?()`, separate `RequestGate` key `(tenantId, providerId, 'outbound_post')`, `outbound_activities` audit table extension for `activity_type='post'`, and `POST /v1/outbound/posts` | 2.28 |
| ADR-0073 | `outbound_activities` audit table and `SocialConnector.reply?()` — the outbound reply path that established the same row-shape pattern this component reuses | 2.26 |
| ADR-0052 | `SocialConnector` optional-method pattern and connector cadence; `publish?()` follows the same opt-in discipline as `reply?()` | 1.13 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.28.connector-publish-framework.contract.test.ts` (ADR-0075) — `SocialConnector` accepts an optional `publish?()`; `outboundPublishService.invoke()` calls it and returns `sent`/`failed` rows with `activityType='post'`; connectors without `publish()` fail with `publish_not_supported`; `ClassifiableError` thrown from `publish()` maps to the row's `errorCode`; `RequestGate` tracks `outbound_post` separately from `outbound` (reply).

## How to extend this safely

- **Adding a new outbound post action type:** this service owns the *new post* action. If a future action needs its own gate (e.g., `outbound:repost`), add a sibling `acquireFor...` in `requestGate.ts` rather than overloading the `outbound_post` key.
- **Calling `publish()` from a REST endpoint:** the endpoint is responsible for resolving the user's credential, validating the target asset against the caller's enumerated assets, recording the `outbound_activities` row, and returning it (Story 3.15). Call `outboundPublishService.invoke()` and use the returned `externalId`/`externalUrl` to populate the `sent` row.
- **Reclassifying connector publish errors:** a connector's `publish()` should throw `ClassifiableError('missing_permission' | 'target_asset_not_found' | 'reconnect_required' | 'rate_limited' | 'media_not_supported' | ...)` for recoverable/platform-meaningful failures. Any other thrown error is treated as `'network'` by `invoke()`.
- **Adding a `publish?()` implementation for a new platform:** implement the platform-specific method and set `getOutboundRateLimitConfig?()` to the platform's real write/quote limit; `outboundPublishService.invoke()` will gate and call it. Do not change `SocialConnector.publish?()`'s signature without updating this contract and every implementation.

## Load-bearing constraints — do not change casually

- **`outbound_post` and `outbound` (reply) gates must remain separate keys (ADR-0075 §5).** `acquireForOutboundPost()` uses `(tenantId, providerId, 'outbound_post')` in `requestGate.ts`. Collapsing this into the reply `outbound` key would let heavy post publishing starve replies or vice versa.
- **`outboundPublishService.invoke()` must not persist `outbound_activities` in v1.** Its job is to execute the connector action and return a row-shaped result; the REST endpoint (Story 3.15) owns persistence so it can return HTTP 201 and handle the `pending`/`sent`/`failed` status transition.
- **`publish()` is always user-bound (ADR-0075 §4).** It requires a per-user credential and a target asset that belongs to the caller. Do not allow a tenant-wide credential or a cross-user credential to be used for an outbound post.
- **The `SocialConnector.publish?()` signature is fixed:** `(tenantId: string, userId: string, payload: OutboundPostPayload, credential: string) => Promise<{ externalId: string; externalUrl: string }>`. Changing it requires updating this contract and every connector-specific `publish()` implementation.
- **The set of `ErrorKind` values for publish is load-bearing.** Adding a new publish-specific code requires a contract change and an explicit decision about whether it is retryable or credential-class.

## Known gaps / deferred work

- **Real connector-specific `publish()` implementations (Facebook, Instagram, LinkedIn) are not yet built.** Story 2.29 begins the Facebook `publish()` implementation; other platforms are deferred to their own stories.
- **REST endpoint `POST /v1/outbound/posts` and `GET /v1/outbound/posts` are Story 3.15**, not built in this component.
- **The `outbound_activities` table extension for `activity_type='post'` is created in Story 3.15**; `outboundPublishService` only returns a row-shaped object that matches its intended contents.
- **Media upload, scheduled dispatch, bulk publishing, and third-party assets are out of scope for v1** (ADR-0075 §7).

## Relations to other components

- Calls into `src/connectors/requestGate.ts` (`acquireForOutboundPost()`) — relationship asserted by `story-2.28` contract's AC4 gate isolation tests.
- Calls into `src/connectors/types.ts` (`SocialConnector.publish?()` and `OutboundPostPayload`) — relationship asserted by `story-2.28` contract's AC1.
- Calls into `src/ingestion/errorClassification.ts` (`ClassifiableError`) — relationship asserted by `story-2.28` contract's AC2 and AC3.
- Sibling to `src/outbound/outboundEngagementService.ts` (replies) — both use the same row-shape pattern but separate `RequestGate` keys and `activity_type` values.
