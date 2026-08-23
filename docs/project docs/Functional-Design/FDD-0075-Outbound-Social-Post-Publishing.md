# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0075 Outbound Social Post Publishing — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Functional Design synthesis from ADR-0075 and BRD-0075 |
| Reviewer(s) | Menno — Product Owner / Sole Developer / Technical Lead |
| Status | Approved (source ADR-0075 is Accepted 2026-08-23; source BRD-0075 is Draft/Pending review — see Section 13) |
| Related Documents | ADR-0075 (Outbound Social Post Publishing via Platform APIs), BRD-0075 (Outbound Social Post Publishing), ADR-0072 (Polypost Composer), ADR-0073 (Outbound Reply), ADR-0028 (Credential Creation Authority), ADR-0014 (Credential Storage Envelope Encryption), ADR-0003 (Per-Tenant Per-Provider Rate Limiting), ADR-0060 (Facebook Multiple Pages), ADR-0069 (LinkedIn Connector), Feature design 07 (Publishing and scheduling), Stories 2.28, 2.29, 2.30, 3.15, 6.39 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0075's accepted architecture decision and BRD-0075's business requirements into a functional design for **Outbound Social Post Publishing**: the mechanism by which a `Tenant-User` composes a new (non-reply) post in the Polypost Composer and dispatches it — immediately or on a schedule — to one or more of their own connected platform assets (Facebook Pages, LinkedIn profiles/organizations), turning the composer's previously simulated `handlePublish()` into a real, auditable write path.

### 2.2 Scope

- **In scope:**
  - The optional `SocialConnector.publish?()` connector method and its contract.
  - The `outbound_activities` table extension for `activity_type = 'post'` (target asset, payload, scheduling, cancellation columns).
  - `POST /v1/outbound/posts`, `GET /v1/outbound/posts`, `DELETE /v1/outbound/posts/:id`.
  - Immediate (synchronous) dispatch of text and link-card posts to Facebook Pages (Story 2.29) and LinkedIn profiles/organizations (Story 2.30).
  - The `scheduled_for` data shape and pending-row storage for scheduled posts (the dispatch scheduler/worker loop itself is out of scope of this FDD — it is authorized only as a data shape here and designed in ADR-0098/its own FDD).
  - The dedicated `outbound_post` `RequestGate` rate/quota key.
  - Per-asset targeting (`target_asset_id`, `target_asset_type`) drawn from each connector's existing asset enumeration.
  - The Polypost Composer's real publish flow (Story 6.39): `PublishTargetsDialog`, per-target status/result rendering.

- **Out of scope:**
  - Image/video media upload (deferred to ADR-0115).
  - Automated/bulk publishing, recurring posts, CSV bulk upload.
  - Posting to assets not owned/enumerated by the caller, or posting "as the tenant."
  - Editing or deleting a post after it has been dispatched (`sent`).
  - The scheduler/dispatcher worker's own execution loop, retry policy, and failure-surfacing UI (ADR-0098 and its own story/FDD).
  - Optimal send-time prediction, AI-powered scheduling, and multi-stage approval workflows (v1.5+/v2).
  - Connectors other than Facebook and LinkedIn implementing `publish()` (future stories may add more; the framework is provider-agnostic but v1 ships only these two).

### 2.3 Target Audience

Core backend engineers (connector and API implementation), Tenant Admin UI engineers (Polypost Composer), QA (contract test authors), and the Product Owner/Technical Lead (Menno, all three roles on this solo project).

---

## 3. Context and Background

- **Problem/opportunity:** The Polypost Composer (ADR-0072) already lets a user compose, preview, and per-platform-customize a post, but `handlePublish()` only mutates client-side UI state — nothing is actually sent to a platform. This leaves SocialEngage as a listening-only tool even though it has already built the credential, asset-enumeration, and preview machinery a real publishing tool needs.
- **Business/user value:** Closes the authoring loop end-to-end, making SocialEngage directly comparable to Sprout Social, Hootsuite, and Sprinklr as a social media management suite, not just a listening/insights tool — without adopting a third-party cross-posting intermediary (which ADR-0027 prohibits).
- **Source requirements:** ADR-0075 (architecture decision, Accepted 2026-08-23); BRD-0075 (business requirements, Draft/Pending review); Stories 2.28, 2.29, 2.30, 3.15, 6.39.
- **Relevant constraints/dependencies:**
  - Depends on ADR-0073's `outbound_activities` table (already shipped for `'reply'`) being extended, not replaced.
  - Depends on ADR-0028/ADR-0014 credential storage/ownership-tier machinery (Tier-3 credentials only — no system-wide or non-owner credentials may publish).
  - Depends on ADR-0060 (Facebook multi-Page enumeration) and ADR-0069 (LinkedIn connector) for target-asset enumeration.
  - Depends on ADR-0003's per-tenant/per-provider rate-limiting (`RequestGate`) pattern, extended with a new key.
  - The scheduler/dispatcher execution loop is explicitly a separate, later concern (ADR-0098) — this FDD's Section 5 capabilities stop at "store a pending row with `scheduled_for`."

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Make the Polypost Composer's Publish action real | A `Tenant-User` publishes a text/link-card post to a connected Facebook Page and is shown the live `external_url`. |
| G2 | Support deferred (scheduled) publishing | `POST /v1/outbound/posts` with `scheduledFor` stores a `pending` row per target with `scheduled_for` set; no synchronous dispatch occurs. |
| G3 | Provide a complete, tenant-isolated audit trail | Every dispatch attempt (immediate or scheduled) produces exactly one `outbound_activities` row per target with `status`, timestamps, and (on success) `external_id`/`external_url`, or (on failure) a normalized `error_code`. |
| G4 | Keep publishing strictly human-in-the-loop for v1 | No `outbound_activities` row transitions to `sent` except via an explicit `POST /v1/outbound/posts` call or a future, separately-authorized scheduler; nothing is auto-dispatched by this feature alone. |
| G5 | Enforce ownership-tier and asset-permission boundaries | Every dispatch validates the caller owns an active Tier-3 credential for the provider and that `target_asset_id` is in the caller's own enumerated asset list; `Platform-Admin` is refused entirely. |
| G6 | Isolate outbound-post rate limiting from ingestion and replies | Outbound post dispatch consumes a dedicated `(tenantId, providerId, 'outbound_post')` `RequestGate` key, never the ingestion or reply gate. |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `SocialConnector.publish?()` (connector contract)

- **Description:** An optional method on the `SocialConnector` interface that a connector implements to support creating a new post on a provider platform on behalf of a tenant's user.
- **Triggers:** Called by the core outbound-publish execution path (see 5.3) once per target, never called directly by the UI.
- **Inputs:** `tenantId: string`, `userId: string`, `payload: OutboundPostPayload` (final outgoing text, optional link card, optional media refs — v1 always empty/unsupported for media, and the `target_asset_id` chosen by the caller), `credential: Credential` (the resolved, decrypted Tier-3 credential for the provider).
- **Processing:**
  - If a connector does not implement `publish`, the execution path treats the target as unsupported (`publish_not_supported`) without ever attempting a call.
  - If implemented, the connector is responsible for: resolving the concrete provider write endpoint from `target_asset_id`, mapping `payload` into the provider's request shape, invoking the provider's write API, and normalizing the provider's response and errors into the connector-neutral shape below.
- **Outputs:** On success, `Promise<{ externalId: string; externalUrl: string }>`. On failure, the connector throws/returns a classifiable error carrying a normalized `error_code` (see 5.5's error taxonomy), never a raw provider error.
- **Error handling:** Connectors that do not implement `publish` cause the execution path to respond with `501` (framework-level "not implemented") or `422` with code `publish_not_supported` (endpoint-level, since v1 always resolves this before calling — see 5.3). Implemented connectors must reclassify provider-specific error codes into the shared taxonomy (`reconnect_required`, `missing_permission`, `rate_limited`, `target_asset_not_found`) rather than leaking provider-specific codes to callers.
- **Edge cases:** A credential that was valid at OAuth-connect time but predates a since-added write scope must fail cleanly as `missing_permission` (not throw an unhandled exception), so the UI can prompt reconnection rather than showing an opaque failure.

### 5.2 Feature / Capability: Facebook Page `publish()` (Story 2.29)

- **Description:** The concrete `facebook` connector implementation of `publish?()`, targeting a specific connected Facebook Page.
- **Triggers:** Invoked by the outbound-publish execution path when a target's `providerId = 'facebook'`.
- **Inputs:** The Page's `pageId` (as `target_asset_id`), the resolved Page access token (from the stored, envelope-encrypted credential), and the outgoing `message` text (plus, when present, link-card fields).
- **Processing:** Resolves the Page access token; calls the Meta Graph API's Page feed publish endpoint with `message` (and link-card fields where provided). The exact write permission (expected `pages_manage_posts`) must be primary-source verified against current Meta Graph API documentation before this connector ships — this FDD does not assume the scope name is final.
- **Outputs:** Maps the provider's returned post id to `externalId`; constructs `externalUrl` as a deep link of the form `https://www.facebook.com/{page-id}/posts/{externalId}` (or the primary-source-verified equivalent permalink shape).
- **Error handling:** Meta error codes are reclassified into the shared taxonomy: `190`/`10` → `reconnect_required`; permission-denied/insufficient-scope → `missing_permission`; `4`/`17`/`32`/`80000` → `rate_limited`; invalid Page id/`803` → `target_asset_not_found`.
- **Edge cases:** Page credentials created before the write scope existed must resolve to `missing_permission`, not a generic failure, so the composer can specifically prompt "reconnect this Page."

### 5.3 Feature / Capability: LinkedIn `publish()` (Story 2.30)

- **Description:** The concrete `linkedin` connector implementation of `publish?()`, targeting a connected LinkedIn profile or organization.
- **Triggers:** Invoked by the outbound-publish execution path when a target's `providerId = 'linkedin'`.
- **Inputs:** The author URN (as `target_asset_id`, either a person or organization URN), the resolved OAuth token, and the outgoing text ("commentary").
- **Processing:** Calls the LinkedIn UGC Posts API (or its primary-source-verified successor) with the author URN and text. Required scopes (expected `w_member_social` and/or `w_organization_social`) must be primary-source verified; if not already requested by the existing OAuth flow, the connector's scope-degradation logic is updated accordingly.
- **Outputs:** Maps the returned post `id` to `externalId`; constructs `externalUrl` of the form `https://www.linkedin.com/feed/update/urn:li:share:{externalId}` (or the verified equivalent).
- **Error handling:** LinkedIn/Rest.li errors reclassified: token/permission failures → `reconnect_required` or `missing_permission`; `403` quota/rate-limit → `rate_limited`; invalid author URN → `target_asset_not_found`.
- **Edge cases:** Credentials predating the required write scope resolve to `missing_permission`. Ingestion (`pollLinkedIn.ts`) is unaffected — `publish()` is reachable only through the outbound post path, never the polling scheduler.

### 5.4 Feature / Capability: `POST /v1/outbound/posts` (create/dispatch outbound post)

- **Description:** The REST endpoint that creates one `outbound_activities` row per requested target and, for immediate posts, synchronously attempts dispatch via each target's connector `publish()`.
- **Triggers:** An authenticated `Tenant-User`/`Tenant-Admin` request from the Polypost Composer's confirm-publish action, or any other authenticated caller within the tenant.
- **Inputs:** JSON body: `text`/`message` (non-empty, checked against each target platform's length limit), `perPlatformOverrides` (optional partial record keyed by target), `media` (optional array — v1 always rejects or ignores non-empty media per the deferred-media scope boundary), `linkPreview`/link-card fields (optional), `targets` (array of `{ providerId, targetAssetId }`, at least one required), `scheduledFor` (optional ISO 8601 timestamp).
- **Processing:**
  1. Authenticate and resolve the caller's `tenantId`/`userId`; RLS scopes all reads/writes to that tenant.
  2. For each target: load the caller's active Tier-3 `platform_credentials` row for `providerId`. Reject the target (do not reject the whole request) if: the connector has no `publish?()`, the credential is missing/inactive, the caller does not own the credential, or `targetAssetId` is not present in the caller's enumerated asset list for that provider — respond for that target with `422`/code `PUBLISH_NOT_AVAILABLE` (or `publish_not_supported` per 5.1) as appropriate.
  3. Insert one `outbound_activities` row per target with `activity_type = 'post'`, `status = 'pending'`, the resolved `provider_id`, `credential_id`, `target_asset_id`, `target_asset_type`, `body` (the final per-target text after overrides), `payload` (link card/media refs/platform overrides), and `scheduled_for` (`null` for immediate).
  4. If `scheduledFor` is absent: for each inserted row, synchronously call `outboundPublishService.publish()` (which delegates to the target connector's `publish()`), consume one unit from the `(tenantId, providerId, 'outbound_post')` `RequestGate`, and update the row to `sent` (with `external_id`, `external_url`, `sent_at`) or `failed` (with `error_code`, `failed_at`) based on the outcome.
  5. If `scheduledFor` is present: rows remain `pending` with `scheduled_for` set; no `publish()` call is made by this endpoint — a later, separately-authorized scheduler is responsible for dispatch (out of this FDD's scope; see Section 2.2).
- **Outputs:** `201 Created` with the created/updated `outbound_activities` rows when every target either succeeded (immediate) or was accepted as `pending` (scheduled). `207 Multi-Status` (or an equivalent partial-failure status) when at least one target failed synchronously while at least one other succeeded, with per-target results in the response body.
- **Error handling:** Per-target validation failures return `422` with a normalized `error_code` for that target without blocking other targets in the same request. `429` is returned (with no automatic retry) when the outbound-post `RequestGate` is exhausted for a `(tenantId, providerId)` pair. `Platform-Admin` callers receive `403` on the endpoint as a whole (see 5.7).
- **Edge cases:** A request whose `targets` array mixes a provider with `publish()` (Facebook) and one without (LinkedIn, until Story 2.30 ships) must succeed for the supported target and fail only that unsupported target with `publish_not_supported`, not fail the entire request. Text that fits the general validator but exceeds one specific platform's limit fails only that target.

### 5.5 Feature / Capability: `GET /v1/outbound/posts` (list/filter)

- **Description:** Lists the calling tenant's outbound post activity rows.
- **Triggers:** Composer/Outbound Activity Log UI reads, or any authenticated tenant caller.
- **Inputs:** Optional query filters: `status` (`pending`/`sent`/`failed`/`cancelled`), `providerId`.
- **Processing:** RLS-scoped read restricted to the caller's tenant; applies the optional filters; excludes rows belonging to other tenants unconditionally (RLS-enforced, not just application-layer filtered).
- **Outputs:** A list of `outbound_activities` rows (both `'reply'` and `'post'` activity types may coexist in the table, but this capability is scoped to what the caller requests/filters).
- **Error handling:** Invalid filter values (unrecognized `status`) return `400`. `Platform-Admin` receives `403`.
- **Edge cases:** An empty result set (no outbound posts yet, or a filter that matches nothing) returns `200` with an empty array, not an error.

### 5.6 Feature / Capability: `DELETE /v1/outbound/posts/:id` (cancel pending)

- **Description:** Cancels a still-`pending` (i.e., not yet dispatched) scheduled outbound post.
- **Triggers:** User action from the Outbound Activity Log / composer UI, or any authenticated tenant caller who owns the row.
- **Inputs:** The `outbound_activities` row `id` (path parameter).
- **Processing:** Loads the row (RLS-scoped to the caller's tenant); if `status = 'pending'`, sets `status = 'cancelled'` and `cancelled_at = now()`. If the row is already `sent`, `failed`, or `cancelled`, no state change occurs.
- **Outputs:** `200`/`204` on successful cancellation with the updated row (or no body); the row's terminal `cancelled` state is then immutable.
- **Error handling:** `404` if the row does not exist or does not belong to the caller's tenant. `409` (or `422`) if the row is not in `pending` status (already `sent`/`failed`/`cancelled`) — a `sent` or `failed` post cannot be cancelled. `Platform-Admin` receives `403`.
- **Edge cases:** A race between a scheduler about to dispatch a row and a concurrent cancel request must not result in both a `sent` and a `cancelled` terminal state for the same row — the future scheduler's row-locking design (out of this FDD's scope) is responsible for that guarantee; this endpoint's own responsibility is limited to atomically checking-and-setting `status` only when it is still `pending`.

### 5.7 Feature / Capability: Outbound post rate/quota gate

- **Description:** A dedicated `RequestGate` key isolating outbound post write-traffic accounting from ingestion polling and from ADR-0073's reply gate.
- **Triggers:** Every synchronous `publish()` attempt made by `POST /v1/outbound/posts` (5.4).
- **Inputs:** `(tenantId, providerId, 'outbound_post')` as the gate key; the connector's configured provider-specific write rate limit.
- **Processing:** Before calling a target's `publish()`, the execution path consumes one unit against this gate. If the gate reports exhaustion, `publish()` is not called for that target.
- **Outputs:** On exhaustion, the target's row is marked `failed` with a rate-limit `error_code` (or the request-level response returns `429` for that target, per 5.4), consistent with the shared error taxonomy's `rate_limited` code.
- **Error handling:** No automatic retry occurs on `429`/quota exhaustion — the caller must re-attempt explicitly (a new `POST /v1/outbound/posts` call).
- **Edge cases:** Two targets in the same request for the same `(tenantId, providerId)` pair both consume from the same gate bucket — a burst of many targets to one provider in a single composer dispatch can itself exhaust the gate before every target is attempted; later targets in that same request must fail cleanly with `rate_limited`, not hang or be silently skipped.

### 5.8 Feature / Capability: `Platform-Admin` exclusion

- **Description:** Enforces that platform-level administrators have zero access to any tenant's outbound posting capability, consistent with the project's existing tenant-content isolation posture.
- **Triggers:** Any call to `POST`/`GET`/`DELETE /v1/outbound/posts*` made with a `Platform-Admin` identity.
- **Inputs:** The caller's resolved role (from `GET /v1/me`/session identity resolution).
- **Processing:** The endpoint layer checks role before any tenant-scoped logic executes.
- **Outputs:** `403 Forbidden`, no `outbound_activities` row created, read, or mutated.
- **Error handling:** Consistent `403` response shape across all three outbound-post endpoints.
- **Edge cases:** A `Platform-Admin` who is also, separately, provisioned as a `Tenant-User` in some tenant (if the platform ever allows dual roles) is out of scope for this FDD; v1 assumes the roles are disjoint, per existing role-model ADRs.

### 5.9 Feature / Capability: Polypost Composer real publish flow (Story 6.39)

- **Description:** The Tenant Admin UI change that replaces the composer's simulated `handlePublish()` with real calls to `POST /v1/outbound/posts`.
- **Triggers:** A `Tenant-User`/`Tenant-Admin` clicking **Publish now** (or **Schedule for later**) in the `PublishTargetsDialog` after selecting one or more target assets and composing content.
- **Inputs:** The composer's in-progress state (text, per-platform overrides, selected target assets' `targetAssetId`s, optional link preview), forwarded via a same-origin BFF proxy route to core's `POST /v1/outbound/posts`.
- **Processing:** `handleConfirmPublish` calls the client's `publishPost()` helper with the assembled payload. Non-Facebook target platforms (e.g. LinkedIn, until Story 2.30 ships) are rendered disabled in the dialog with an explanatory note rather than being silently omitted. The composer validates platform selection and content before the dialog opens, and fails early if the user has no active Facebook Pages available to select.
- **Outputs:** On `201`/`207`, the dialog closes and a per-target status list/toast is shown, listing the live `external_url` for each successful target and the normalized `error_code` for each failed one.
- **Error handling:** `422`/`429`/`5xx` responses are surfaced as per-target error toasts; the composer does not treat a partial failure as blocking the successful targets' results from being shown.
- **Edge cases:** A user with zero connected Facebook Pages and no other publish-capable provider must be prevented from reaching the dialog at all (rather than reaching it and finding every option disabled).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| `Tenant-User` | Composes and publishes/schedules outbound posts to their own connected assets. |
| `Tenant-Social-Care-Agent` | Uses the same composer/publish flow to move from inbox triage to public publishing. |
| `Tenant-Admin` | Publishes/schedules posts; can see outbound post status and cancel/reschedule; in a future story, configures approval workflows. |
| `Tenant-Brand-Reputation-Manager` | Consumer of outbound post status for crisis-response content review (review-before-publish workflows are v1.5+, out of this FDD's scope). |
| `Platform-Admin` | Explicitly excluded — zero access to any tenant's outbound posting capability or `outbound_activities` data. |
| Core outbound-publish execution path | System actor: resolves credentials/targets, calls connector `publish()`, updates row status. |
| Facebook / LinkedIn connector | System actor: translates the neutral `OutboundPostPayload` into a provider-specific write call and normalizes the response/error. |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 | `Tenant-User` | publish a composed post immediately to a connected Facebook Page | it goes live without leaving SocialEngage | `POST /v1/outbound/posts` (no `scheduledFor`) returns `201` with a `sent` row carrying `external_id`/`external_url`; the composer shows the live URL. |
| US2 | `Tenant-User` | schedule a post for a future time | I can plan content in advance | `POST /v1/outbound/posts` with `scheduledFor` returns `201` with a `pending` row carrying `scheduled_for`; no synchronous dispatch occurs. |
| US3 | `Tenant-User` | cancel a scheduled post before it goes out | I can change my mind without it publishing | `DELETE /v1/outbound/posts/:id` on a `pending` row sets `status='cancelled'`; a `sent`/`failed` row is refused with `409`/`422`. |
| US4 | `Tenant-User`/`Tenant-Admin` | see the status of every outbound post I've attempted | I know what published, what's pending, and what failed | `GET /v1/outbound/posts` (optionally filtered by `status`/`providerId`) lists the tenant's rows with status, `external_id`/`external_url`, or `error_code`. |
| US5 | `Tenant-User` | be told clearly why a post to one target failed while others succeeded | I can fix or retry just the failed one | A multi-target `POST /v1/outbound/posts` response distinguishes per-target success/failure (`207`), each carrying its own `error_code`. |
| US6 | `Platform-Admin` | (negative case) attempt to call any outbound post endpoint | — (must be refused) | All three endpoints return `403` for a `Platform-Admin` caller, with no data created/read/mutated. |

### 6.3 Workflow Diagrams / Steps

**Immediate publish (US1):**
1. `Tenant-User` composes text (and optional link card) in the Polypost Composer and opens `PublishTargetsDialog`.
2. User selects one or more target assets (e.g. a specific Facebook Page) and clicks **Publish now**.
3. UI calls `publishPost()` → same-origin BFF proxy → core `POST /v1/outbound/posts` with `targets`, `text`/overrides, no `scheduledFor`.
4. Core authenticates the caller and, per target: validates the Tier-3 credential and `target_asset_id` ownership; inserts an `outbound_activities` row as `pending`.
5. Core consumes one unit of the `(tenantId, providerId, 'outbound_post')` `RequestGate` per target, then calls that target's connector `publish()`.
6. Connector calls the provider write API, maps the response (or a classified error) back to core.
7. Core updates the row to `sent` (with `external_id`/`external_url`) or `failed` (with `error_code`).
8. Core responds `201` (all succeeded) or `207` (partial failure) with the per-target rows.
9. UI closes the dialog and renders a per-target result list with live URLs and/or error messages.

**Scheduled publish (US2) — storage boundary only:**
1–4. Same as above through credential/target validation.
5. Because `scheduledFor` is present, core inserts the row as `pending` with `scheduled_for` set and does **not** call `publish()`.
6. Core responds `201` with the `pending` row(s).
7. *(Out of this FDD's scope: a separately-authorized scheduler later locks and dispatches the row, transitioning it to `sent`/`failed`.)*

**Cancel (US3):**
1. User selects a `pending` row in the Outbound Activity Log/composer and requests cancellation.
2. UI calls `DELETE /v1/outbound/posts/:id`.
3. Core atomically checks-and-sets `status='cancelled'` only if still `pending`; otherwise returns a conflict.
4. UI reflects the row's new terminal state.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Composer state (text, per-platform overrides, selected target assets, optional link-card fields, optional scheduling intent) from the Polypost Composer UI.
- The caller's identity (`tenantId`, `userId`, role) from the resolved session (`GET /v1/me`).
- The caller's Tier-3 `platform_credentials` (envelope-encrypted, ADR-0014) for each target provider.
- Each connector's existing asset enumeration (e.g. `GET /v1/connectors/facebook/pages`) as the source of truth for which `target_asset_id` values the caller may use.
- Provider write-API responses/errors (Meta Graph API, LinkedIn UGC Posts API) consumed only inside the relevant connector.

### 7.2 Data Outputs

- `outbound_activities` rows (`activity_type='post'`), persisted with full audit timestamps.
- HTTP responses from the three REST endpoints, consumed by the Tenant Admin UI.
- Live, externally-visible posts on the target platform (Facebook Page feed, LinkedIn feed) as the ultimate real-world side effect of a successful dispatch.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `outbound_activities` (extended) | `id` (PK); `tenant_id` (RLS scope); `user_id` (caller); `provider_id` (e.g. `facebook`, `linkedin`); `credential_id`; `post_id` (`null` for a new post — non-null only for the ADR-0073 reply case); `activity_type` (`'reply'` \| `'post'`); `target_asset_id` (new, e.g. Facebook `pageId` or LinkedIn `authorUrn`); `target_asset_type` (new, e.g. `facebook_page`, `linkedin_person`, `linkedin_organization`); `body` (final outgoing text); `payload` (new, JSONB — link card, media refs, alt text, platform overrides); `scheduled_for` (new, nullable timestamp); `status` (`pending` → `sent` \| `failed` \| `cancelled`, widened to include `cancelled`); `external_id`; `external_url`; `error_code`; `created_at`, `sent_at`, `failed_at`, `cancelled_at` (new) | Belongs to one `tenant` (RLS); references one `platform_credentials` row via `credential_id`; references one `users` row via `user_id`; optionally references one ingested `SocialPost` via `post_id` (reply case only, not used for `'post'` activities). |
| `platform_credentials` (existing, ADR-0014/ADR-0028) | `id`; `tenant_id`; `user_id` (owner, for Tier-3); `provider_id`; `status` (active/inactive); envelope-encrypted secret material | One credential can back many `outbound_activities` rows (both replies and posts); scoped to the owning user for Tier-3. |
| Connector asset enumeration (existing, e.g. ADR-0060) | `target_asset_id`; `target_asset_type`; display name; ownership/permission indicator | Read-only source of truth consulted (not persisted here) to validate `target_asset_id` on every `POST /v1/outbound/posts` call. |
| `OutboundPostPayload` (in-memory contract, not persisted directly) | `text`; optional link card fields; optional media refs (v1: unsupported/empty); `target_asset_id` | Constructed per-target from the request body's `text`/`perPlatformOverrides`/`media`/`linkPreview` and passed into `SocialConnector.publish?()`. |

### 7.4 Validation Rules

- `text`/`message` is required and non-empty; per-target, it must additionally fit that platform's length limit.
- `targets` must contain at least one `{ providerId, targetAssetId }` entry.
- For each target: the caller must own an **active** Tier-3 credential for `providerId`; `targetAssetId` must appear in the caller's enumerated, permitted asset list for that provider; the connector must implement `publish?()`.
- `scheduledFor`, when present, must be a valid ISO 8601 timestamp (logically in the future; a past timestamp's handling is either rejected at the API layer or treated as immediately due, per the eventual scheduler's contract — out of this FDD's scope to fully define).
- `status` transitions are one-directional and constrained: `pending → sent`, `pending → failed`, `pending → cancelled` only; no transition is permitted out of a terminal state (`sent`, `failed`, `cancelled`).
- `media` is accepted syntactically but v1 provides no working upload path — payloads that require real media dispatch either fail with an explicit not-yet-supported error or are silently limited to text/link-card only, per the connector's own capability.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Only a caller with an active Tier-3 credential for a provider may post to that provider's assets. | `POST /v1/outbound/posts` |
| BR2 | `target_asset_id` must belong to the caller's own enumerated, permitted asset list — never an asset the caller does not own/administer. | `POST /v1/outbound/posts` |
| BR3 | `Platform-Admin` may not create, list, or cancel outbound posts under any circumstance. | All three outbound-post endpoints |
| BR4 | A `pending` row may be cancelled; a `sent` or `failed` row may not. | `DELETE /v1/outbound/posts/:id` |
| BR5 | `SocialConnector.publish?()` is optional; a provider without it is `publish_not_supported`, never a silent no-op or a crash. | Connector framework, `POST /v1/outbound/posts` |
| BR6 | v1 supports text and link-card posts only; any implied image/video dispatch is out of scope and must fail explicitly, not silently drop the media. | `OutboundPostPayload`, connector `publish()` |
| BR7 | Outbound post dispatch consumes a rate-limit unit from the dedicated `(tenantId, providerId, 'outbound_post')` gate — never the ingestion or reply gate. | `POST /v1/outbound/posts` synchronous dispatch |
| BR8 | No automatic retry occurs after a `429`/rate-limited failure. | Connector `publish()`, outbound execution path |
| BR9 | A new post has no parent `post_id` — `post_id` is populated only for the pre-existing reply activity type, never for `activity_type='post'`. | `outbound_activities` |
| BR10 | Every dispatch attempt (immediate or scheduled) results in exactly one `outbound_activities` row per target — never zero (silently dropped) and never more than one per target per request. | `POST /v1/outbound/posts` |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Polypost Composer (Tenant Admin UI) | Outbound (UI → core) | Compose and dispatch/schedule outbound posts | HTTPS/JSON, same-origin BFF proxy → `POST/GET/DELETE /v1/outbound/posts*` |
| `outbound_activities` table (Postgres, RLS) | Bidirectional (core ↔ store) | Persist and audit every outbound post attempt | SQL, tenant-scoped RLS |
| `platform_credentials` store (ADR-0014) | Inbound (core reads) | Resolve the envelope-encrypted Tier-3 credential for a target provider | Internal, decrypted in-process only |
| Meta Graph API (Facebook) | Outbound (connector → provider) | Publish a post to a connected Facebook Page's feed | HTTPS/JSON, OAuth Page access token |
| LinkedIn UGC Posts API | Outbound (connector → provider) | Publish a post authored as a connected LinkedIn person/organization URN | HTTPS/JSON, OAuth token |
| Connector asset enumeration endpoints (e.g. `GET /v1/connectors/facebook/pages`) | Inbound (core reads) | Validate `target_asset_id` against the caller's permitted assets | Internal REST/JSON |
| `RequestGate` rate limiter (ADR-0003) | Bidirectional (core ↔ gate state) | Enforce the dedicated outbound-post write quota per `(tenantId, providerId)` | Internal |
| Future scheduler/dispatcher (ADR-0098, out of this FDD's scope) | Inbound (reads `pending` rows) | Dispatch `scheduled_for`-bearing rows once due | Internal, not defined here |

---

## 10. Non-Functional Considerations

- **Performance:** Immediate dispatch is synchronous within the request/response cycle of `POST /v1/outbound/posts`; a multi-target request performs one connector call per target, so response latency scales with target count and provider latency — no batching/parallelization guarantee is asserted by this FDD.
- **Security/access control:** RLS enforces tenant isolation on all `outbound_activities` reads/writes; `Platform-Admin` is refused at the endpoint layer before any tenant-scoped logic runs; Tier-3 credential ownership is re-checked on every dispatch (not cached indefinitely), consistent with ADR-0028.
- **Scalability:** The dedicated `outbound_post` `RequestGate` key isolates outbound-post write volume from ingestion polling and reply traffic, preventing one from starving the other's quota.
- **Reliability/availability:** No automatic retry after `429`/rate-limit failures — the design deliberately leaves retry as an explicit user action, avoiding retry storms against already-strict platform write limits.
- **Audit and logging:** Every dispatch attempt (success or failure) is persisted as a row with full timestamps and a normalized `error_code`/`external_id`/`external_url`; nothing is dispatched without a corresponding audit row, and terminal states (`sent`, `failed`, `cancelled`) are immutable.
- **Accessibility:** Not directly addressed by this FDD; inherited from the Polypost Composer's existing UI accessibility posture (ADR-0072).
- **Localization/internationalization:** Not addressed; outgoing post text is passed through as authored, with no locale-specific transformation defined here.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Connector has no `publish()` implementation for the target provider | "Publishing to this platform isn't supported yet." | Target rejected with `422`/`publish_not_supported` (or framework-level `501`); other targets in the same request are unaffected. |
| Caller has no active Tier-3 credential for the target provider, or does not own it | "Reconnect your account for this platform to publish." | `422`/`PUBLISH_NOT_AVAILABLE` for that target. |
| `target_asset_id` not in the caller's enumerated asset list | "You don't have permission to post to this Page/account." | `422` for that target; no row is silently created against an unauthorized asset. |
| Credential predates the required write scope | "Reconnect this account to grant posting permission." | `missing_permission` classified error; row set to `failed`. |
| Provider token expired/invalidated | "Reconnect your account." | `reconnect_required` classified error; row set to `failed`. |
| Outbound-post rate limit exhausted | "You've hit the posting limit for this platform — try again later." | `429` for that target (or row `failed` with `rate_limited`); no automatic retry. |
| Invalid/unrecognized target asset id at the provider | "This Page/account could not be found." | `target_asset_not_found` classified error; row set to `failed`. |
| `scheduledFor` present | (no immediate error surface) | Row stored as `pending` with `scheduled_for`; dispatch deferred to the out-of-scope scheduler. |
| `DELETE` on a non-`pending` row | "This post has already been sent/cancelled and can no longer be cancelled." | `409`/`422`; no state change. |
| `Platform-Admin` calls any outbound-post endpoint | "Not authorized." | `403`; no data created, read, or mutated. |
| Partial multi-target failure | Per-target success/failure list shown in the composer | `207 Multi-Status` (or equivalent) with per-target results in the body. |

---

## 12. Assumptions and Dependencies

- **Assumed true:**
  - The Polypost Composer (ADR-0072) already collects platform selection, per-platform text overrides, link cards, media attachments with Alt-Text, and scheduling intent — this feature reuses that state rather than redesigning composition.
  - The `outbound_activities` table from ADR-0073 exists and is extendable (additive columns and widened check constraints) without breaking the existing `'reply'` usage.
  - Facebook Pages and LinkedIn are the correct v1 platform targets because asset enumeration and OAuth credential machinery already exist for both.
- **External dependencies:**
  - Meta Graph API (Page feed publish endpoint and permission model) — requires primary-source verification before Story 2.29 ships.
  - LinkedIn UGC Posts API (or successor) and its scope model — requires primary-source verification before Story 2.30 ships.
  - Existing Tier-3 credential storage (ADR-0014/ADR-0028) and asset enumeration (ADR-0060/ADR-0069).
  - The `RequestGate` rate-limiting primitive (ADR-0003).
- **Pending decisions:**
  - The concrete scheduler/dispatcher design (worker loop, locking strategy, failure-surfacing UI) is deferred to ADR-0098 and is explicitly not resolved by this FDD.
  - Exact Meta/LinkedIn permission scope names are pending primary-source verification at implementation time (Stories 2.29/2.30), not fixed by this document.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Which platforms ship `publish()` first, and in what order beyond Facebook/LinkedIn? | Technical Lead | Resolved for v1 (Facebook then LinkedIn, per Stories 2.29/2.30); future platforms TBD. |
| Q2 | Does `outbound_activities` need an `edited_at`/`deleted_at` in the future, once post editing/deletion after dispatch is considered? | Technical Lead | Deferred to a later ADR; v1 explicitly excludes post-dispatch editing/deletion. |
| Q3 | How are failed *scheduled* post dispatches surfaced to the user (notification, activity log, both)? | Product Owner | Resolved in principle by ADR-0075's Resolved Questions (via `GET /v1/outbound/posts?status=failed`, an Outbound Activity Log screen, and optional in-app notifications) but the concrete UI/notification design belongs to the future scheduling ADR-0098 and its own FDD. |
| Q4 | What is the exact Meta Graph API write permission scope name (`pages_manage_posts` assumed)? | Technical Lead | To be primary-source verified during Story 2.29 implementation. |
| Q5 | What is the exact LinkedIn write scope/endpoint (UGC Posts API assumed, `w_member_social`/`w_organization_social` assumed)? | Technical Lead | To be primary-source verified during Story 2.30 implementation. |

**Note on source-document status (per this FDD's own governance):** ADR-0075 is **Accepted** (2026-08-23), so its architectural decisions are treated here as settled. BRD-0075 is still marked **Draft/Pending review** as of the date of this FDD; nothing in this FDD depends on a BRD detail that is not also independently stated in the Accepted ADR, but the BRD's own approval remains formally outstanding and should be tracked to closure separately from this document.

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| `SocialConnector.publish?()` | Optional connector method that creates a new post on a provider platform. |
| `outbound_activities` | Tenant-scoped audit table for both replies (ADR-0073) and posts (this ADR-0075). |
| `target_asset_id` | Platform-specific destination for an outbound post (e.g. Facebook `pageId`, LinkedIn `authorUrn`). |
| `target_asset_type` | Classifies the kind of destination asset, e.g. `facebook_page`, `linkedin_person`, `linkedin_organization`. |
| `perPlatformOverrides` | Custom text/fields supplied for a specific target platform/asset, distinct from the base composed text. |
| `RequestGate` | The project's per-tenant/per-provider rate-limiting primitive (ADR-0003), here keyed additionally by `'outbound_post'`. |
| Polypost Composer | The Tenant Admin UI for composing, previewing, and dispatching outbound posts (ADR-0072). |

### Reference links

- [ADR-0075: Outbound Social Post Publishing via Platform APIs](../../adr/0075-outbound-social-post-publishing.md)
- [BRD-0075: Outbound Social Post Publishing](../Business-Requirements/BRD-0075-Outbound-Social-Post-Publishing.md)
- [Feature design 07: Publishing and scheduling](../../product-research/feature-designs/07-publishing-and-scheduling.md)
- [Deep Research Brief 07: Publishing and Scheduling](../../product-research/reports/07-publishing-and-scheduling-deep-research.md)
- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../../adr/0072-*.md)
- [ADR-0073: Outbound Reply to Ingested Posts via Platform APIs](../../adr/0073-*.md)
- [ADR-0028: Credential Creation Authority by Ownership Tier](../../adr/0028-*.md)
- [ADR-0014: Credential Storage Envelope Encryption](../../adr/0014-*.md)
- [ADR-0003: Per-Tenant Per-Provider Rate Limiting](../../adr/0003-*.md)
- [ADR-0060: Facebook Connector — Multiple Pages per User](../../adr/0060-*.md)
- [ADR-0069: LinkedIn Connector](../../adr/0069-*.md)
- Related stories: 2.28 (Connector Publish Framework and Outbound Post Rate Gate), 2.29 (Facebook Page Post Publishing), 2.30 (LinkedIn Post Publishing), 3.15 (Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API), 6.39 (Polypost Composer Real Publish Flow) — all in `docs/user-stories/`.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | Functional Design synthesis from ADR-0075/BRD-0075 | Full regeneration replacing a defective prior version that duplicated the BRD's content verbatim under the wrong document type. |
