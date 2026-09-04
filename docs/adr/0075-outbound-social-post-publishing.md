# ADR-0075: Outbound Social Post Publishing via Platform APIs

**Status:** Accepted (2026-08-23)

**Accepted by Menno 2026-08-23.** Authorizes the real outbound post publishing path that turns ADR-0072's Polypost Composer from a simulated dispatch into a system that can create new posts on connected social platform assets (Facebook Pages, LinkedIn profiles/organizations, etc.), using the same `outbound_activities` audit trail introduced in ADR-0073.

**Source:** Menno request (2026-08-22): *"Could you write the required ADR for outbound social write APIs to become available?"*

---

## Context

### 1. The composer is built but not wired to real write APIs
- ADR-0072 built the Polypost Composer with a simulated `handlePublish()` that only sets client-side state.
- ADR-0073 added an outbound reply path with `SocialConnector.reply?()` and a tenant-scoped `outbound_activities` audit table.
- The composer already collects: platform selection, per-platform text overrides, media attachments with Alt-Text, OpenGraph link cards, and scheduling intent. None of this currently reaches a provider API.

### 2. Outbound posting is a distinct architectural concern from replies
- A new post has no parent `SocialPost`; it is authored from the UI and dispatched to one or more target assets (Pages, profiles, organizations).
- It is a **write** action with its own rate limits, quotas, permission scopes, failure modes, and audit needs.
- Targeting can be per-asset (e.g. which Facebook Page, which LinkedIn organization), not just per-provider.

### 3. Existing credentials and RLS already support the per-user scoping required
- ADR-0028's ownership-tier model and ADR-0014's envelope-encrypted credential store already gate which user can act on which platform asset.
- ADR-0060/0061's per-user/per-Page Facebook machinery provides the concrete asset enumeration needed to choose a target Page.

---

## Decision

### 1. Extend `outbound_activities` for post dispatch
The table introduced in ADR-0073 gains the following v1 usage:

| Field | Notes for `'post'` activity |
|---|---|
| `id` | Primary key |
| `tenant_id` | RLS scope |
| `user_id` | Caller who authored/dispatched the post |
| `provider_id` | Target platform, e.g. `facebook`, `linkedin` |
| `credential_id` | The `platform_credentials` row used |
| `post_id` | `null` for a new post (set for a reply, ADR-0073) |
| `activity_type` | `'post'` (new v1 value) |
| `target_asset_id` | Platform-specific destination, e.g. a Facebook `pageId` or LinkedIn `authorUrn` |
| `target_asset_type` | e.g. `facebook_page`, `linkedin_person`, `linkedin_organization` |
| `body` | Final outgoing text, Markdown/plain |
| `payload` | Optional JSONB for link card, media refs, alt text, or platform-specific overrides |
| `scheduled_for` | `null` for immediate dispatch, timestamp for scheduled dispatch |
| `status` | `pending` → `sent` / `failed` / `cancelled` |
| `external_id` | Provider's returned post/activity id |
| `external_url` | Deep link to the live post |
| `error_code` | Normalized failure reason |
| `created_at`, `sent_at`, `failed_at`, `cancelled_at` | Audit timestamps |

### 2. New optional `SocialConnector.publish?()` method

```ts
async publish?(
  tenantId: string,
  userId: string,
  payload: OutboundPostPayload,
  credential: Credential
): Promise<{ externalId: string; externalUrl: string }>
```

- Connectors that do not implement `publish` return `501` or `422` with code `publish_not_supported`.
- `OutboundPostPayload` contains the final text, optional link card, optional media refs, and the `target_asset_id` chosen by the caller.
- v1 supports text and link-card posts; image/video media upload is explicitly deferred.

### 3. New REST endpoints

- `POST /v1/outbound/posts`
  - Creates one `outbound_activities` row per target asset in `pending`.
  - If `scheduled_for` is absent, immediately attempts each `publish()` and updates `status`.
  - If `scheduled_for` is present, rows stay `pending` and a separate scheduler (Story to be named) dispatches them.
  - Returns the created `outbound_activities` rows (HTTP `201` on accepted/created).
  - Validation: caller owns an active Tier-3 credential for the provider; `target_asset_id` is in the caller's enumerated asset list; text fits the platform's limits.
- `GET /v1/outbound/posts` lists the tenant's outbound posts, filterable by `status` and `providerId`.
- `DELETE /v1/outbound/posts/:id` cancels a still-`pending` row, setting `status` to `cancelled`.

### 4. Credentials and asset targeting

- Reuse existing Tier-3 `platform_credentials` (ADR-0028, ADR-0014).
- `target_asset_id` is chosen by the caller from the same enumeration already used by the UI (e.g. `GET /v1/connectors/facebook/pages`, ADR-0060).
- v1 does not allow posting as a different user or as the tenant as a whole.

### 5. Rate and quota handling

- Outbound posts use a separate `RequestGate` key `(tenantId, providerId, 'outbound_post')`, distinct from ingestion and from ADR-0073's reply gate.
- Provider-specific write limits are recorded in the connector's rate-limit configuration.
- `429` / quota-exceeded errors are surfaced to the user; no automatic retry.

### 6. Scheduling boundary

- The API accepts `scheduled_for` and stores it.
- The actual scheduler/dispatcher loop is a separate, named story; this ADR only authorizes the data shape and the immediate dispatch path.

### 7. Scope boundaries for v1

- **In scope:** immediate text/link-card posts to the user's own connected platform assets (Facebook Pages, LinkedIn profile/organization, etc.).
- **Explicitly out of v1:** image/video media upload, automated/bulk publishing, posting to third-party assets, editing or deleting a published post after dispatch.

---

## Consequences

### Positive

- Closes the authoring loop: the Polypost Composer becomes a real publishing tool, not a preview.
- Builds on already-accepted architecture (credentials, `outbound_activities`, connector interface, rate gate).
- Creates an auditable, tenant-isolated record of every outbound post.
- Keeps the human-in-the-loop: no automated posting unless a later story explicitly builds a scheduler.

### Negative

- Adds a new connector method and REST surface, increasing core surface area.
- Requires primary-source verification of each platform's write/permissions model before a connector can ship `publish()`.
- Rate limits for writes are stricter; users may hit quotas quickly.
- Media upload is deferred, so rich posts with images are not yet supported end-to-end.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| Fold outbound posts into ADR-0073's reply mechanism | Rejected. A new post has no parent `postId` and targets a different asset; conflating the two would confuse the audit and authorization model. |
| Use a third-party cross-posting service | Rejected. Violates ADR-0027 (technical intermediary only) and ADR-0014 (credential storage). |
| Post via browser-only share intents | Rejected. No audit trail, no sent-status tracking, and inconsistent UX across platforms. |
| Build image/video upload in v1 | Rejected. Adds storage, encoding, and platform upload API surface that is not a prerequisite for text/link-card dispatch; deferred. |

---

## Open Questions

- [x] ~~**[Q-0075-1]** Which platforms ship `publish()` first?~~ — **Resolved in ADR-0075 Decision §1:** Facebook Pages and LinkedIn prioritized as initial targets.
- [-] ~~**[Q-0075-2]** Does `outbound_activities` need an `edited_at` / `deleted_at` in the future?~~ — **Superseded by ADR-0119:** Editing and deleting published outbound posts architecture.
- [-] ~~**[Q-0075-3]** How are failed scheduled posts surfaced?~~ — **Superseded by ADR-0098:** Publishing and scheduling failure surfacing via Outbound Activity Log.

## Resolved Questions

Resolved 2026-08-23:

3. **How are failed scheduled posts surfaced?** The concrete surfacing contract belongs to the future scheduling ADR (ADR-0098). When the scheduler is built, scheduled post failures will be exposed through `GET /v1/outbound/posts?status=failed`, an Outbound Activity Log screen in the Tenant Admin UI, and optional tenant-scoped in-app notifications.

---

## User Stories

This ADR directly sources the following implementation stories, all blocked on its acceptance:

- **Story 2.28 — Connector Publish Framework and Outbound Post Rate Gate** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`): the optional `SocialConnector.publish?()` method and the core `outbound_post` `RequestGate`.
- **Story 2.29 — Facebook Page Post Publishing** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`): the concrete Facebook Page `publish()` implementation.
- **Story 2.30 — LinkedIn Post Publishing** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`): the concrete LinkedIn `publish()` implementation.
- **Story 3.15 — Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API** (`docs/user-stories/epic-3-data-model-storage-and-archival.md`): the `outbound_activities` table extension, `POST /v1/outbound/posts`, `GET /v1/outbound/posts`, and `DELETE` cancellation.
- **Story 6.39 — Polypost Composer Real Publish Flow** (`docs/user-stories/epic-6-tenant-admin-ui.md`): the UI that turns ADR-0072's composer previews into real dispatch calls.

## Related Documents

- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0073: Outbound Reply to Ingested Posts via Platform APIs
- ADR-0028: Credential Creation Authority by Ownership Tier
- ADR-0014: Credential Storage Envelope Encryption
- ADR-0003: Per-Tenant Per-Provider Rate Limiting
- ADR-0060: Facebook Connector — Multiple Pages per User
- ADR-0069: LinkedIn Connector
