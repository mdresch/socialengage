# ADR-0073: Outbound Reply to Ingested Posts via Platform APIs

**Status:** Accepted (2026-08-22)

**Accepted by Menno 2026-08-22.** Authorizes an outbound reply path for ingested posts through the originating social platform, introducing an optional `SocialConnector.reply?()` method, a tenant-scoped `outbound_activities` audit table, `POST /v1/posts/:id/replies`, and a Post Detail reply composer and replies tab. v1 is deliberately limited to posts the tenant/user owns or administers.

**Source:** Menno request (2026-08-22): *"enhance the reply to a post through the social media platform it came from."*

---

## Context

### 1. Ingested posts now have a first-class UI
- ADR-0071 gives users a `PostDetailPanel` and `EnrichmentEditDrawer` on `/tenant/posts`.
- ADR-0072 gives a `PolypostComposer` for authoring *new* cross-platform posts.

Neither ADR exposes an action to **reply or comment on an already ingested post through the original platform's API**.

### 2. Existing connectors are ingest-only
- ADR-0067 (Facebook Page) and ADR-0068 (Instagram Business) ingest only the tenant's own Page/Business content; `comments`/`comments_count` are stored as aggregate counts.
- ADR-0069 (LinkedIn) authorizes `w_member_social` / `w_organization_social` for *publishing*, not yet for replying to existing posts.
- ADR-0002's `SocialConnector` contract defines `poll()` and `normalize()`; it has no outbound engagement surface.

### 3. Why this needs its own ADR
A reply is not a new post:
- It is scoped to a specific ingested `SocialPost` (`postId`) and the user's credential for that provider.
- It is a **write** action, which means stricter rate limits, user consent, audit, and error handling than ingestion.
- It is only possible where the user/administering account has write/comment permission on the original post.
- It is human-initiated, not scheduled.

Attempting to fold this into ADR-0072 would confuse the composer model and hide the new audit, credential, and rate-limit requirements.

---

## Decision

### 1. New domain: `outbound_activities`
A tenant-scoped, RLS-protected table records every outbound engagement attempt:

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `tenant_id` | RLS scope (ADR-0015) |
| `post_id` | The `social_posts` row being replied to (app-enforced, no DB FK due to `social_posts` partitioning) |
| `provider_id` | e.g. `facebook`, `instagram`, `linkedin` |
| `user_id` | The SocialEngage user who initiated the reply (ADR-0032) |
| `credential_id` | The `platform_credentials` row used (app-enforced, no DB FK due to RLS pattern) |
| `activity_type` | `'reply'` (v1); extensible for `'repost'`, `'like'`, etc. |
| `body` | User-composed text, Markdown normalized |
| `status` | `pending` → `sent` / `failed` / `delivered` |
| `external_id` | Platform's returned comment/reply ID |
| `external_url` | Deep link to the live reply |
| `error_code` | Normalized failure reason on failure |
| `created_at`, `sent_at`, `failed_at` | Audit timestamps |

This is an append-only audit table; v1 does not support editing or deleting a sent reply.

### 2. New optional `SocialConnector.reply?()`
`SocialConnector` may optionally implement:

```ts
async reply?(
  post: SocialPostSummary,
  body: string,
  credential: Credential
): Promise<{ externalId: string; externalUrl: string }>
```

- Connectors that do not implement `reply` return a clear `422` or `501` with code `reply_not_supported`.
- ADR-0048 is preserved: adding `reply` to a connector is a per-connector, non-core-pipeline change.
- `normalize()` and `poll()` remain unchanged.

### 3. New REST endpoint: `POST /v1/posts/:id/replies`
- **Auth:** requires the same bearer/Entra session as the rest of the API (ADR-0036).
- **Authorization:** the caller must have an active, user-bound (Tier-3) credential for the post's `providerId` that grants write/comment scope.
- **Validation:**
  - `postId` belongs to the tenant.
  - `body` is non-empty and within the provider's character/length limits (reuse ADR-0072 platform validation).
  - The user owns or administers the asset the original post came from (Page, Business account, LinkedIn profile/organization).
- **Behavior:**
  - Records `pending` in `outbound_activities`.
  - Calls the connector's `reply()`.
  - On success, stores `sent` + `external_id` + `external_url`.
  - On failure, stores `failed` + `error_code`.
- **Response:** returns the created `outbound_activities` row with HTTP `201 Created` on success; provider-specific failure status on failure.

A companion `GET /v1/posts/:id/replies` lists the tenant-scoped replies for a post in descending `created_at` order.

### 4. Credentials: reuse Tier-3 OAuth
- No new credential kind or table (ADR-0028, ADR-0014).
- The existing `platform_credentials` row for the user + provider is the only credential that may be used.
- v1 does **not** allow replying as a different user or as the tenant as a whole — this stays user-bound.

### 5. Rate and quota handling
- Outbound replies consume a separate `RequestGate` key per `(tenantId, providerId, 'outbound')`, distinct from ingestion polls (ADR-0003).
- Provider-specific write limits (e.g. LinkedIn's 100 posts/day, Meta's page-level engagement quota) are recorded in the connector's rate-limit configuration.
- `429` / quota-exceeded errors are retryable by the user, not auto-retried by the system.

### 6. UI integration
- A **Reply** action is added to `PostDetailPanel` (ADR-0071).
- The reply composer reuses `PolypostComposer`'s text area, character counter, and Alt-Text/image upload *only where the platform supports media in replies*.
- The UI warns if the user has no active credential for the post's provider.
- Sent replies are shown in a new **Replies** tab inside the post drawer, read from `outbound_activities`.

### 7. Scope boundaries for v1
- **In scope:** human-initiated replies to posts the tenant/user already owns or administers (own Facebook Page posts, own Instagram Business posts, own LinkedIn posts).
- **Explicitly out of v1:** replying to third-party public content, automated/bulk replies, editing or deleting replies, ingesting reply engagement counts as separate posts.

### 8. Legal and policy alignment
- Replies are only attempted on posts for which the user has a platform-granted write/comment permission.
- This ADR does not decide comment/mention **ingestion** (still deferred by ADR-0059 and ADR-0067).
- A `docs/legal/legal-compliance-register.md` pass is a prerequisite before any connector-specific story is built.

---

## Consequences

### Positive
- Closes the engagement loop: users can act on their own ingested content without leaving SocialEngage.
- Builds on already-accepted architecture (credentials, rate gate, connector interface, post drawer, composer).
- Creates an auditable, tenant-isolated record of every outbound engagement.
- Keeps the human-in-the-loop: no automated outbound posting unless a later ADR explicitly allows it.

### Negative
- Adds a new table and a new connector method to the core, increasing surface area.
- Requires primary-source verification of each platform's write/comment permissions before a connector can ship.
- Rate limits for writes are stricter; users may hit quotas quickly.
- v1 does not edit/delete replies, which may create support friction.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| Fold replies into ADR-0072's `PolypostComposer` as a special "new post" | Rejected. A reply is tied to a specific `postId` and credential, with different auth, audit, and rate-limit needs. |
| Use a third-party aggregator for outbound replies | Rejected. Violates ADR-0027 (technical intermediary only) and ADR-0014 (credential storage). |
| Reply via browser Web Intents only | Rejected. Provides no audit trail, no sent-status tracking, and inconsistent UX across platforms. |
| Implement a generic `post comments` ingestion first | Rejected. ADR-0059 already deferred comment ingestion; replying does not require ingesting third-party comments first. |

---

## Resolved Questions

1. **New table or reuse `social_posts`?** New `outbound_activities` table; a reply is not a `SocialPost`.
2. **Credential model?** Reuse existing Tier-3 `platform_credentials`.
3. **Auto-retry on failure?** No; outbound writes are human-initiated and the user sees the result.
4. **Reply to any post, or only owned posts?** v1: only posts the caller owns or administers.
5. **UI starting point?** `PostDetailPanel` with a "Reply" action, reusing `PolypostComposer` components.

---

## Related Documents
- Stories: 3.14, 2.26, 2.27, 6.38
- ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI
- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0069: LinkedIn Connector
- ADR-0068: Instagram Connector
- ADR-0067: Facebook Connector Reconfirmation
- ADR-0059: Facebook Connector Scope
- ADR-0002: Unified Provider/Connector Pattern
- ADR-0028: Credential Creation Authority by Ownership Tier
- ADR-0014: Credential Storage Envelope Encryption
- ADR-0003: Per-Tenant Per-Provider Rate Limiting
- ADR-0010: Error Handling and Auto-Disable Policy
