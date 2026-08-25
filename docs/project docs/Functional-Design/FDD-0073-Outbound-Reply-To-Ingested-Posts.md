# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0073 Outbound Reply to Ingested Posts via Platform APIs — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated from ADR-0073 / BRD-0073) |
| Reviewer(s) | Menno — Product Owner / Sole Developer |
| Status | Approved |
| Related Documents | ADR-0073, BRD-0073, ADR-0071 (`PostDetailPanel`), ADR-0072 (`PolypostComposer`), ADR-0002 (`SocialConnector`), ADR-0028/0014 (credentials), ADR-0003 (rate limiting), Stories 2.26, 2.27, 3.14, 6.38 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0073 (Accepted, 2026-08-22) and BRD-0073 into a functional design for letting a tenant's user reply to an already-ingested post through the social platform it originally came from, without leaving SocialEngage. It defines the `outbound_activities` audit table, the optional `SocialConnector.reply?()` connector method, the `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies` endpoints, and the `PostDetailPanel` Reply action and Replies tab.

ADR-0073's status is Accepted, so this FDD reflects a settled design; no further ADR-level decisions are pending. Two of its four component stories are already Built (2.26, 2.27); the audit-table/API story (3.14) and the UI story (6.38) are Ready but not yet built as of this writing — this FDD describes the full target design regardless of build status.

### 2.2 Scope

- **In scope:** the `outbound_activities` table (reply rows), the optional `reply?()` connector method and its unsupported-provider failure path, `POST /v1/posts/:id/replies`, `GET /v1/posts/:id/replies`, the dedicated outbound `RequestGate`, the `PostDetailPanel` Reply action, `ReplyComposerDrawer`, and the Replies tab. Human-initiated replies only, restricted to posts the tenant/user owns or administers.
- **Out of scope:** replying to third-party public content; automated, scheduled, or bulk replies; editing or deleting a sent reply; ingesting reply/comment engagement as separate `SocialPost` rows; media/image replies (unless a specific platform explicitly supports them and a later story adds it); connector-specific `reply()` implementations beyond the Facebook Page connector (LinkedIn/Instagram `reply()` are future, per-connector work); replying as a different user or as "the tenant" collectively.

### 2.3 Target Audience

Backend and frontend engineers implementing Stories 2.26/2.27/3.14/6.38, QA writing contract tests, and the Product Owner reviewing acceptance criteria.

---

## 3. Context and Background

- **Problem:** `PostDetailPanel` (ADR-0071) and `PolypostComposer` (ADR-0072) give users a first-class view of ingested posts and a way to author new cross-platform posts, but no way to reply to a post already ingested through the platform it came from. Users who want to engage with their own content must leave SocialEngage and use the native platform UI, losing any audit trail.
- **Business/user value:** closes the engagement loop — users can act on their own ingested content (own Facebook Page posts, own Instagram Business posts, own LinkedIn posts) without switching tools, and every attempt is auditable.
- **Source requirements:** ADR-0073, BRD-0073, Stories 2.26, 2.27, 3.14, 6.38.
- **Constraints/dependencies:** must reuse the existing Tier-3 `platform_credentials` model (ADR-0028/ADR-0014) — no new credential kind or table; must reuse the `SocialConnector` contract (ADR-0002) as an *optional* extension so existing ingest-only connectors are unaffected; must use a `RequestGate` key distinct from ingestion polling and from the ADR-0075 outbound-post gate (ADR-0003); a reply is a **write** action and therefore carries stricter authorization, audit, and rate-limit requirements than the read-only ingestion pipeline.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable direct replies to ingested posts the tenant/user owns or administers | A Tenant-User clicks Reply on an owned Facebook Page post, submits, and sees the live reply URL in the Replies tab |
| G2 | Maintain an auditable, tenant-isolated record of every outbound reply attempt | Every `POST /v1/posts/:id/replies` call produces an `outbound_activities` row with status, credential, user, and provider |
| G3 | Keep a human in the loop for v1 | No automated, scheduled, or bulk outbound replies are possible without a later ADR |
| G4 | Reuse already-accepted architecture rather than growing new surface area | Reply flow reuses Tier-3 credentials, `RequestGate`, `SocialConnector`, and the Post Detail UI with no new credential table |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `SocialConnector.reply?()` (optional connector method)

- **Description:** An optional method connectors may implement to send a reply/comment to an existing post on the originating platform, using the caller's stored credential.
- **Triggers:** Invoked by the reply-dispatch service after `POST /v1/posts/:id/replies` passes validation.
- **Inputs:** `post: SocialPostSummary` (the ingested post being replied to), `body: string` (the composed reply text), `credential: Credential` (the caller's active Tier-3 `platform_credentials` row for the post's provider).
- **Processing:**
  - The connector authenticates to the platform's write/comment API using the supplied credential.
  - The connector submits `body` as a comment/reply on the platform post identified from `post`.
  - `poll()` and `normalize()` on the connector are unaffected — `reply?()` is additive only, preserving ADR-0048 (per-connector, non-core-pipeline change).
- **Outputs:** On success, `{ externalId: string; externalUrl: string }` — the platform's returned comment/reply ID and a deep link to the live reply.
- **Error handling:** Connectors that do not implement `reply` cause the caller (the dispatch service) to short-circuit with a `422`/`501` response and code `reply_not_supported`, without invoking anything. Connectors that implement `reply()` but encounter a platform-side failure (auth expired, permission denied, rate-limited, content rejected) throw a classifiable error that the dispatch service normalizes into an `error_code`.
- **Edge cases:** Credential valid but lacking platform-side write/comment permission (platform 403); Page/Business/organization asset no longer administered by the user (mid-session revocation); platform enforces stricter reply length limits than SocialEngage's own validation.

### 5.2 Feature / Capability: Outbound reply audit table (`outbound_activities`)

- **Description:** A tenant-scoped, RLS-protected, append-only table recording every outbound engagement attempt (v1: `activity_type = 'reply'`; the same table is shared with ADR-0075's `'post'` activity type).
- **Triggers:** A row is inserted at the start of every `POST /v1/posts/:id/replies` request (status `pending`) and updated once the connector call resolves.
- **Inputs:** `tenant_id`, `post_id`, `provider_id`, `user_id`, `credential_id`, `activity_type='reply'`, `body`.
- **Processing:** Insert `pending` row prior to the connector call; on connector success, update to `sent` with `external_id`/`external_url`/`sent_at`; on connector failure, update to `failed` with `error_code`/`failed_at`. No DB-enforced foreign key into `social_posts` (partitioned) or `platform_credentials` (RLS pattern) — both references are app-enforced, matching the `post_watchlist_matches` precedent.
- **Outputs:** A durable, queryable audit row per reply attempt, tenant-isolated by RLS.
- **Error handling:** If the row cannot be written (DB error) the request fails before any connector call is attempted, so no reply is ever sent without a corresponding audit row.
- **Edge cases:** A row stuck in `pending` if the process crashes mid-call (v1 has no reconciliation job for this — noted as an assumption in §12); `status='delivered'` is reserved for a future platform-confirmed-delivery signal, not populated in v1.

### 5.3 Feature / Capability: `POST /v1/posts/:id/replies`

- **Description:** REST endpoint that validates and dispatches a reply to an ingested post through its originating platform.
- **Triggers:** User submits the `ReplyComposerDrawer` form in the Admin UI, or any authenticated API caller.
- **Inputs:** Path parameter `id` (the `social_posts` row id); JSON body `{ body: string }`; bearer/Entra session (ADR-0036).
- **Processing (in order):**
  1. Authenticate the caller via the existing bearer/Entra session mechanism.
  2. Resolve `postId` and confirm it belongs to the caller's tenant; return `404` if not (cross-tenant posts are invisible, not merely forbidden).
  3. Validate `body` is non-empty and within the post's provider's character/length limits (reusing ADR-0072's platform validation rules).
  4. Load the caller's active, user-bound (Tier-3) `platform_credentials` row for the post's `provider_id`. If none exists, is inactive, is not owned by the caller, or the connector has no `reply()` implementation, return `422` with code `REPLY_NOT_AVAILABLE` (surfaced to the connector layer as `reply_not_supported` when the cause is a missing method).
  5. Confirm the caller owns or administers the asset the original post came from (Page, Business account, LinkedIn profile/organization) — enforced by the credential/asset binding, not a separate permission check.
  6. Acquire the outbound `RequestGate` slot for `(tenantId, providerId, 'outbound')`; if exhausted, return `429`.
  7. Insert a `pending` `outbound_activities` row.
  8. Call the connector's `reply(post, body, credential)`.
  9. On success, update the row to `sent` with `external_id`/`external_url`/`sent_at`; on failure, update to `failed` with a normalized `error_code`/`failed_at`.
- **Outputs:** `201 Created` with the created/updated `outbound_activities` row on success; a provider-appropriate failure status (with the `failed` row still returned/referenced) on failure.
- **Error handling:** `404` (cross-tenant or unknown post), `422` (`REPLY_NOT_AVAILABLE`, invalid/missing body), `429` (rate-gate exhausted or platform quota), platform-specific write errors surfaced with a normalized `error_code`. None of these are auto-retried by the system.
- **Edge cases:** Reply attempted immediately after credential deactivation (race between UI state and server validation — server re-validates); post that was deleted/archived on the platform since ingestion; provider silently truncates or rejects the reply text despite passing SocialEngage's own length check.

### 5.4 Feature / Capability: `GET /v1/posts/:id/replies`

- **Description:** Lists the tenant-scoped outbound reply activities for a given post.
- **Triggers:** `PostDetailPanel`'s Replies tab loading or refreshing.
- **Inputs:** Path parameter `id` (post id); bearer/Entra session; optional pagination cursor.
- **Processing:** Resolve the post within the caller's tenant (RLS-scoped); query `outbound_activities` where `post_id` matches and `activity_type = 'reply'`, ordered by `created_at DESC`; apply cursor pagination if the result set may exceed 50 rows.
- **Outputs:** A list of `outbound_activities` rows (body, status, external link, error code, timestamps) for the post.
- **Error handling:** `404` for a post outside the caller's tenant; empty list (not an error) when no replies exist yet.
- **Edge cases:** Post with a large number of reply attempts (pagination); mixed `sent`/`failed`/`pending` rows shown together in one list.

### 5.5 Feature / Capability: Reply action, `ReplyComposerDrawer`, and Replies tab (UI)

- **Description:** The `PostDetailPanel` surface that lets a user initiate, compose, and review replies to an ingested post.
- **Triggers:** User opens a post in `PostDetailPanel` and clicks **Reply**.
- **Inputs:** The displayed post's `provider_id`, the caller's credential state for that provider, user-typed reply text.
- **Processing:**
  - The Reply button is shown only when the post's provider is supported (i.e., its connector implements `reply()`) *and* the caller has an active Tier-3 credential for it; otherwise it is disabled with an explanatory tooltip.
  - Clicking Reply opens a cascading `ReplyComposerDrawer` (same slide/push pattern as `EnrichmentEditDrawer`), reusing `PolypostComposer`'s text area and character counter. Media upload and AI assist are disabled for v1.
  - Submitting calls `POST /v1/posts/:id/replies`.
  - On `201 Created`, the drawer closes, the new reply is optimistically appended to the Replies tab, and a success toast appears.
  - On failure, an error toast appears and the row is shown with status `failed`.
- **Outputs:** An updated Replies tab reflecting the new attempt; live deep link to the sent reply when successful.
- **Error handling:** Missing-credential state disables the button pre-emptively; server-side `422`/`429`/write errors surface as toasts with the normalized error/code.
- **Edge cases:** User has credentials for the provider but not for the specific administered asset the post belongs to (server still authoritative); character-limit differences between platforms shown live in the counter; drawer left open across a session credential change.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant-User | Author of replies to owned ingested posts |
| Tenant-Social-Care-Agent | Rapid responder composing replies from the post detail view |
| Tenant-Admin | Enables/manages credentials; reviews reply activity for audit purposes |
| Platform-Admin | Infrastructure owner; must have zero access to tenant reply content or `outbound_activities` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (key) |
|---|---|---|---|---|
| Story 2.26 — Connector Reply Framework and Outbound Rate Gate (Built, `social-listening-core@e3df7d9`) | Core backend engineer | Add an optional `reply?()` method on `SocialConnector` and an outbound execution path | Connectors can implement reply behavior without forcing every existing connector to support it | `SocialConnector` gains an optional `reply?(post, body, credential)` method; unsupported connectors fail cleanly; outbound calls use a dedicated `RequestGate` key |
| Story 2.27 — Facebook Page Reply Implementation (Built, `social-listening-core@2da26eb`) | Tenant User managing a connected Facebook Page | Have the `facebook` connector implement `reply()` | I can post a comment on an ingested Facebook Page post from within SocialEngage | Uses the stored long-lived Page access token; calls Meta's comments endpoint; maps the response to `externalId`/`externalUrl`; Meta error codes are reclassified into normalized `error_code`s |
| Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API (Ready, not yet built) | Tenant User or Tenant-Admin | Have a tenant-scoped record of every reply attempt and a REST endpoint to create one | Outbound engagement is auditable, retryable, and tied to the credential/user that performed it | Migration creates `outbound_activities` with the specified columns and no DB FKs; endpoint validates tenant ownership (`404` cross-tenant) and credential availability (`422 REPLY_NOT_AVAILABLE`) |
| Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab (Ready, not yet built) | Tenant User or Tenant-Admin | Click "Reply" on a post, compose the reply in a drawer, and see it listed | I can engage with my own posts without leaving the SocialEngage admin UI | Reply button gated on provider support + active credential; `ReplyComposerDrawer` reuses `PolypostComposer` text/character-count UI; success/failure toasts and optimistic Replies-tab update |

Related (not part of this ADR's own scope but referencing it): Epic 11's Unified Social Inbox design (`docs/user-stories/epic-11-adr-0095-to-0100.md`) notes `POST /v1/inbox/:id/reply` proxying to this ADR-0073 endpoint and its `InboxItemDetail` reusing the same reply composer — informational context, not a dependency this FDD's scope requires.

### 6.3 Workflow Diagrams / Steps

**Primary flow — user replies to an owned post:**

1. User opens an ingested post in `PostDetailPanel`.
2. UI checks the post's `provider_id` against supported connectors and the user's active Tier-3 credentials; the **Reply** button is enabled only if both checks pass.
3. User clicks **Reply**; `ReplyComposerDrawer` slides/pushes in, reusing the `PolypostComposer` text area and character counter.
4. User types reply text; the UI enforces the provider's character limit live.
5. User submits. UI calls `POST /v1/posts/:id/replies` with `{ body }`.
6. Server authenticates the caller, confirms tenant ownership of the post (`404` otherwise), validates `body`, and loads the caller's active credential for the provider (`422 REPLY_NOT_AVAILABLE` otherwise).
7. Server acquires the outbound `RequestGate` slot (`429` if exhausted).
8. Server inserts a `pending` `outbound_activities` row.
9. Server calls the connector's `reply(post, body, credential)`.
10. On success: row updated to `sent` with `external_id`/`external_url`; server returns `201 Created`.
11. On failure: row updated to `failed` with `error_code`; server returns the corresponding error status.
12. UI: on `201`, closes the drawer, appends the reply to the Replies tab, shows a success toast. On failure, shows an error toast and displays the row as `failed` in the Replies tab.
13. User (or anyone in the tenant) can reopen the post's Replies tab at any time; `GET /v1/posts/:id/replies` returns all attempts newest-first.

**Secondary flow — unsupported provider or missing credential:**

1. User opens a post whose provider's connector has no `reply()`, or for which the user has no active credential.
2. Reply button renders disabled with a tooltip explaining why (no credential / provider not supported).
3. No API call is made unless the user bypasses the UI (e.g., direct API call), in which case the server still returns `422 REPLY_NOT_AVAILABLE`.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Ingested `social_posts` row (post being replied to), sourced from the existing ingestion pipeline.
- Caller identity and tenant, from the Entra-backed session (ADR-0036).
- Caller's active Tier-3 `platform_credentials` row for the post's provider (ADR-0028/ADR-0014).
- User-composed reply text (`body`) from the `ReplyComposerDrawer`.

### 7.2 Data Outputs

- `outbound_activities` rows (one per attempt), consumed by `GET /v1/posts/:id/replies` and rendered in the Replies tab.
- Platform-side artifacts: a live comment/reply on the originating post, referenced by `external_id`/`external_url`.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `outbound_activities` | `id` (PK); `tenant_id` (RLS scope); `post_id`; `provider_id`; `user_id`; `credential_id`; `activity_type` (`'reply'` in this FDD's scope, extensible to `'repost'`, `'like'`, and `'post'` per ADR-0075); `body`; `status` (`pending` → `sent` / `failed` / `delivered`); `external_id`; `external_url`; `error_code`; `created_at`, `sent_at`, `failed_at` | App-enforced (no DB FK) reference to `social_posts.id` (partitioned table); app-enforced (no DB FK) reference to `platform_credentials.id`; scoped to `tenant_id` under RLS (ADR-0015); attributed to `user_id` (ADR-0032) |
| `social_posts` (existing, referenced) | `id`, `tenant_id`, `provider_id`, plus existing ingestion fields | Target of the reply; one post may have many `outbound_activities` rows |
| `platform_credentials` (existing, referenced) | `id`, `tenant_id`, `user_id`, `provider_id`, active/inactive state, granted scopes | The credential used to authenticate the `reply()` call; must be user-bound (Tier-3) and active |

### 7.4 Validation Rules

- `post_id` must resolve to a `social_posts` row within the caller's tenant (else `404`).
- `body` must be non-empty and within the post's provider's character/length limit.
- `credential_id` resolved must be active, user-bound (Tier-3), owned by the caller, and for the post's `provider_id` (else `422 REPLY_NOT_AVAILABLE`).
- `activity_type` is fixed to `'reply'` for this flow.
- `status` transitions are one-directional: `pending` → (`sent` | `failed`); no transition back to `pending` and no edit/delete once set (append-only, per BRU-006).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | A reply can only be attempted on an ingested post the caller's tenant/user owns or administers. | `POST /v1/posts/:id/replies` |
| BR2 | The caller must have an active, user-bound Tier-3 `platform_credentials` row for the post's `provider_id` with the platform's required write/comment permission. | `POST /v1/posts/:id/replies` |
| BR3 | The reply body must be non-empty and within the provider's character/length limits. | `POST /v1/posts/:id/replies`, `ReplyComposerDrawer` |
| BR4 | `SocialConnector.reply?()` is optional; connectors that do not implement it return `reply_not_supported`. | Connector dispatch layer |
| BR5 | Outbound replies are human-initiated only; v1 does not allow scheduled, automated, or bulk replies. | Entire reply flow |
| BR6 | `outbound_activities` is append-only; sent replies cannot be edited or deleted in v1. | `outbound_activities` |
| BR7 | Platform-Admin cannot create or read tenant replies. | `outbound_activities`, both endpoints |
| BR8 | `429` and quota-exceeded failures are retryable by the user, not auto-retried by the system. | `POST /v1/posts/:id/replies` |
| BR9 | Outbound replies consume a `RequestGate` key distinct from ingestion polling and from the ADR-0075 outbound-post gate. | Rate limiting |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `PostDetailPanel` (Admin UI) | Outbound to API | Render Reply action, host `ReplyComposerDrawer`, show Replies tab | HTTPS/JSON via BFF session |
| `POST /v1/posts/:id/replies` | Inbound from Admin UI / API caller | Create and dispatch a reply | REST/JSON, Entra bearer session |
| `GET /v1/posts/:id/replies` | Inbound from Admin UI | List reply activity for a post | REST/JSON, Entra bearer session |
| `SocialConnector.reply?()` (per-connector, e.g. Facebook) | Outbound to platform | Submit the reply via the platform's write/comment API | Platform-specific REST (e.g. Meta Graph API `POST /{post-id}/comments`) |
| `platform_credentials` store | Inbound (read) | Resolve the caller's active Tier-3 credential for the provider | Internal data access, envelope-encrypted (ADR-0014) |
| `RequestGate` | Internal | Rate-limit outbound reply calls per `(tenantId, providerId, 'outbound')` | Internal service call |
| `outbound_activities` table | Internal | Persist audit rows for every attempt | Postgres, RLS-scoped (ADR-0015) |

---

## 10. Non-Functional Considerations

- **Performance:** Reply dispatch is synchronous from the caller's perspective (no background queue in v1); acceptable latency is bounded by the platform's own API response time plus `RequestGate` acquisition.
- **Security / access control:** RLS enforces tenant isolation on `outbound_activities`; only the credential-owning user may use their own Tier-3 credential; Platform-Admin access is explicitly rejected (BR7/NFR-003).
- **Scalability:** A dedicated `RequestGate` key isolates outbound reply writes from both ingestion polling and outbound post publishing (ADR-0075), preventing one from starving the others.
- **Reliability / availability:** `429`/quota errors are surfaced to the user, not auto-retried, to avoid amplifying platform rate-limit pressure (NFR-002).
- **Audit and logging:** Every attempt — success or failure — produces a permanent, append-only `outbound_activities` row (NFR-004); no API or UI path may edit or delete these rows.
- **Accessibility:** `ReplyComposerDrawer` and Replies tab follow the same accessibility patterns already established for `EnrichmentEditDrawer` and `PolypostComposer`.
- **Localization / internationalization:** Reply body text is user-authored, Markdown-normalized like other post bodies (ADR-0073 §1); no new localization requirement beyond existing UI copy conventions.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Post belongs to another tenant | Generic "not found" (post not shown as existing) | `404 Not Found`; no `outbound_activities` row created |
| Reply body empty or exceeds provider limit | Inline validation error in `ReplyComposerDrawer` | `422 Unprocessable Entity`; request rejected before any row insert or connector call |
| No active/owned Tier-3 credential for provider | Error toast; Reply button pre-emptively disabled with tooltip | `422 Unprocessable Entity`, code `REPLY_NOT_AVAILABLE`; no connector call made |
| Connector has no `reply()` implementation | Error toast referencing unsupported provider | `422`/`501` with code `reply_not_supported` |
| Outbound `RequestGate` exhausted | "Rate limit reached, try again later" toast | `429 Too Many Requests`; no auto-retry |
| Platform-side write/comment failure (permission revoked, content rejected, platform quota) | Error toast with normalized reason | `outbound_activities` row updated to `failed` with normalized `error_code`; response status reflects the classified failure |
| Platform-Admin attempts to read/create a reply | Access denied | Request rejected by auth/authorization layer before reaching `outbound_activities` |

---

## 12. Assumptions and Dependencies

- ADR-0071 (`PostDetailPanel`/`EnrichmentEditDrawer`) and ADR-0072 (`PolypostComposer`) are accepted and available for reuse.
- Existing Tier-3 `platform_credentials` and OAuth flows (ADR-0014, ADR-0028) and the Facebook/LinkedIn/Instagram connectors can be reused without modification to their ingestion behavior.
- The `SocialConnector` contract already supports `poll()` and `normalize()` without breaking changes when `reply?()` is added.
- The caller genuinely holds a platform-granted write/comment permission on the original asset; SocialEngage trusts but also validates this via the credential's recorded scopes.
- v1 has no reconciliation job for `outbound_activities` rows stuck in `pending` after a process crash mid-call; this is an accepted gap, not a designed behavior.
- A `docs/legal/legal-compliance-register.md` pass is a prerequisite before any connector-specific reply implementation (beyond Facebook) ships.
- Primary-source verification of each platform's exact write/comment OAuth scope (e.g., Meta's `pages_manage_engagement`) occurs per-connector, before that connector's `reply()` ships (see Story 2.27 AC1).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a background reconciliation process eventually detect and resolve `outbound_activities` rows stuck in `pending` after a crash? | Technical Lead | Post-v1, if support friction warrants it |
| Q2 | Will LinkedIn's and Instagram's `reply()` implementations require additional OAuth scopes beyond what's already granted for `publish()`/ingestion? | Technical Lead | Before each connector's reply story is scoped |
| Q3 | Should v1.5 add media/image replies where the platform explicitly supports them? | Product Owner | Future ADR/story, not v1 |

---

## 14. Appendix

**Glossary**

| Term | Definition |
|---|---|
| `SocialConnector.reply?()` | Optional connector method that sends a reply to an existing post on a provider platform. |
| `outbound_activities` | Tenant-scoped, RLS-protected audit table for outbound engagement such as replies and posts. |
| Tier-3 credential | A user-bound `platform_credentials` row owned and activated by the individual user (ADR-0028). |
| `RequestGate` | Per-tenant, per-provider rate-limit tracker used to isolate outbound writes from ingestion. |
| `PostDetailPanel` | UI panel that displays an ingested post and its actions (ADR-0071). |
| `ReplyComposerDrawer` | Cascading drawer in `PostDetailPanel` for composing a reply to the displayed post. |
| Replies tab | UI tab listing all `outbound_activities` rows with `activity_type='reply'` for a given post. |

**Reference links**

- [ADR-0073: Outbound Reply to Ingested Posts via Platform APIs](../../adr/0073-outbound-reply-to-ingested-posts.md)
- [BRD-0073: Outbound Reply to Ingested Posts via Platform APIs](../Business-Requirements/BRD-0073-Outbound-Reply-To-Ingested-Posts.md)
- [ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI](../../adr/0071-human-in-the-loop-post-enrichment-overrides-and-cascading-drawer-ui.md)
- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../../adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md)
- [ADR-0002: Unified Provider/Connector Pattern](../../adr/0002-unified-provider-connector-pattern.md)
- [ADR-0028: Credential Creation Authority by Ownership Tier](../../adr/0028-credential-creation-authority-scoped-by-ownership-tier.md)
- [ADR-0014: Credential Storage Envelope Encryption](../../adr/0014-credential-storage-envelope-encryption-oauth-first.md)
- [ADR-0003: Per-Tenant Per-Provider Rate Limiting](../../adr/0003-per-tenant-per-provider-rate-limiting.md)
- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for ADR-0073; the ADR itself defines the feature surface. Related product-research context that mentions this outbound reply foundation: [Feature design: Unified Social Inbox](../../product-research/feature-designs/06-unified-social-inbox.md), [Feature design: Publishing and Scheduling](../../product-research/feature-designs/07-publishing-and-scheduling.md).
- Stories: [Story 2.26 — Connector Reply Framework and Outbound Rate Gate](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md), [Story 2.27 — Facebook Page Reply Implementation](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md), [Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API](../../user-stories/epic-3-data-model-storage-and-archival.md), [Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab](../../user-stories/epic-6-tenant-admin-ui.md)

**Revision history**

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer | Regenerated from ADR-0073/BRD-0073 with a genuine per-capability Section 5 breakdown, replacing the prior defective BRD-duplicate/flat-table version. |
