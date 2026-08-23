# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0068 Instagram Business Connector — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated) |
| Reviewer(s) | Menno (Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0068 (Instagram Connector), BRD-0068-Instagram-Connector.md, Story 2.24 (epic-2), Story 6.34 (epic-6), ADR-0059/0060/0061/0064/0067/0070 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0068 (Accepted, 2026-08-20) and BRD-0068 into the functional design for the `instagram` ingestion connector: a Tier-3, OAuth-authenticated connector that ingests published photos, videos (including Reels), and carousel albums from connected Instagram Business and Creator accounts via the Meta Graph API, and presents that content in the Tenant Admin UI post feed and detail drawer.

### 2.2 Scope

- **In scope:**
  - `instagram` connector registration and catalog presentation.
  - Meta OAuth 2.0 authentication, Facebook-Page-based Instagram account discovery, and multi-account selection.
  - Tier-3 (`owner_type = 'user'`) credential storage in `platform_credentials`, with per-account tracking in `instagram_connected_accounts`.
  - Media ingestion (`GET /{ig-user-id}/media`), single-row carousel modeling, canonical schema mapping, caption normalization, author mapping, and country-level geospatial extraction.
  - Bounded lookback pagination (30-day / 100-item ceiling) and incremental short-circuit polling.
  - Deterministic Graph API error reclassification (`190`, `10`, `100`) to `reconnect_required`, alert emission, sequential multi-account pacing, and rate-limit handling.
  - Tier-3 scheduler integration, in-flight concurrency guarding, and watchdog timeout reconciliation.
  - Admin UI: connector status/health display, post feed card presentation, and post detail carousel gallery rendering.
- **Out of scope:**
  - Ingestion of personal Instagram accounts or personal timeline feeds (not supported by the Meta Graph API; prohibited under Meta Platform Terms §3.b).
  - Instagram Stories (24-hour ephemeral content).
  - Public hashtag or profile scraping without OAuth tokens.
  - Direct publishing, replying, or outbound engagement from the admin UI via this connector.
  - Periodic background engagement re-sync (deferred to a future v2 refresh story).
  - Granular geolocation beyond country ISO alpha-2.

### 2.3 Target Audience

Backend engineers (`social-listening-core`), frontend engineers (`social-listening-admin`), QA/contract authors, product owner, and UX reviewers.

---

## 3. Context and Background

Social Listening / Insights already ingests GNews, Newswire, tenant-owned RSS feeds, Wikipedia, and Facebook Page content, but has no compliant ingestion path for Instagram — a high-impact visual channel for brand campaigns, product launches, and creator partnerships. Teams monitoring visual brand presence must rely on manual review or external tools, and there is a risk of ad-hoc, non-compliant scraping attempts to fill the gap.

ADR-0068 establishes the Instagram connector as a follow-up to the Facebook Page connector (ADR-0059), the multi-asset-per-user credential model (ADR-0060), the Tier-3 poll scheduler (ADR-0061), country-level geospatial normalization (ADR-0064), the Facebook connector reconfirmation (ADR-0067), and watchdog reconciliation/stalled alerts (ADR-0070). It is implemented by Story 2.24 (backend, `social-listening-core`) and Story 6.34 (UI, `social-listening-admin`).

Business value: richer owned-channel listening coverage, a clean single-row carousel model that avoids analytics double-counting, bounded historical ingestion that protects Meta Graph API quotas and scheduler tick budgets, and deterministic credential-health transparency for tenant users.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Expand visual social channel coverage | Instagram Business/Creator posts appear in the unified post feed alongside Facebook, Wikipedia, and news sources |
| G2 | Maintain platform compliance and data privacy | Zero ingestion of personal Instagram accounts or unauthorized scraping; all access via Meta Graph API with user-delegated OAuth |
| G3 | Improve operational clarity for Instagram credentials | `reconnect_required` alerts raised within one polling tick for invalid/expired tokens, permission revocation, or unlinked accounts |
| G4 | Protect API quotas and scheduler stability | Initial ingestion bounded to 30 days or 100 posts (whichever is reached first); rate-limit responses honored without credential invalidation |
| G5 | Deliver accurate attribution and engagement visibility | Every Instagram post displays hosting `@username`, parent Facebook Page, like count, and comment count |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Connector Registration & Catalog Presentation

- **Description:** Registers a native ingestion connector with provider ID `instagram` in the platform connector catalog, presented as a distinct "Instagram Business" source to avoid confusion with public/personal Instagram access.
- **Triggers:** Platform catalog render (admin UI connectors screen); connector registry lookup during scheduler ticks.
- **Inputs:** None (static definition).
- **Processing:**
  - Platform ID: `instagram`.
  - Display name: `Instagram Business` (mandated to prevent public hashtag/scraping misconceptions).
  - Subtitle: `Meta Graph API Ingestion Source`.
  - Catalog description: "Ingests published photos, videos, carousels, and reels directly from your connected Instagram Business and Creator accounts via Meta Graph API."
  - `category: 'Ingestion'`, `authMode: 'oauth'`, `personalScopeAllowed: true`, `tenantScopeAllowed: false` (Tier-3 user credential only).
- **Outputs:** Connector entry visible in the platform catalog and connectors screen.
- **Error handling:** N/A (static registration); a missing/malformed registry entry fails connector-list rendering, which is caught by existing platform-catalog tests.
- **Edge cases:** None specific to this capability.

### 5.2 Feature / Capability: OAuth Authentication & Facebook-Page-Based Account Discovery

- **Description:** Authenticates the user via Meta OAuth 2.0 (Facebook Login for Business) and deterministically discovers Instagram Business/Creator accounts linked to the user's administered Facebook Pages, eliminating manual account-ID entry.
- **Triggers:** User initiates "Connect Instagram" from the admin UI.
- **Inputs:** Meta OAuth authorization code/callback; requested scopes `instagram_basic`, `pages_show_list`, `pages_read_engagement`.
- **Processing:**
  1. Initiate OAuth flow requesting the three scopes above (Standard Access for internal dev/testing; Advanced Access via Meta Business Verification required before third-party tenant onboarding).
  2. On successful callback, call `GET /me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}`.
  3. Build the list of Facebook Pages the user administers, each carrying its linked `instagram_business_account` (if any).
  4. Present the discovered accounts to the user for selection (see 5.3); accounts without a linked `instagram_business_account` are not selectable.
- **Outputs:** In-memory/session list of candidate Instagram Business/Creator accounts with avatar, `@username`, and parent Facebook Page name.
- **Error handling:** OAuth denial or callback failure aborts the connect flow with a user-facing error and no credential is stored. An account-discovery call that fails or returns zero linked Instagram accounts surfaces an explanatory empty state (no Pages, or no Pages have a linked Instagram Business/Creator account).
- **Edge cases:** A user administers multiple Pages, only some of which have linked Instagram accounts; a Page's linked Instagram account is itself a Creator (not Business) account — both are eligible per ADR-0068 §1.

### 5.3 Feature / Capability: Multi-Account Selection & Tier-3 Credential Storage

- **Description:** Persists user-selected Instagram Business/Creator accounts as Tier-3, user-owned credentials, supporting multiple connected accounts per user.
- **Triggers:** User submits the account picker selection.
- **Inputs:** One or more selected `instagram_business_account` IDs from the discovery step.
- **Processing:**
  - Each selected account is stored as a distinct credential entry in `instagram_connected_accounts`, referencing the encrypted long-lived Page Access Token in `platform_credentials`.
  - Credential ownership: `owner_type = 'user'`, `owner_id = userId`, tenant-scoped (per ADR-0028/0059/0067).
  - A single user may connect multiple Instagram accounts across their administered Pages.
- **Outputs:** New rows in `instagram_connected_accounts` and `platform_credentials`; connector transitions to Active Ingestion state.
- **Error handling:** Duplicate selection of an already-connected account is a no-op / update rather than a duplicate row. Token persistence failure aborts the connect flow and surfaces an error without leaving a partial credential.
- **Edge cases:** User selects zero accounts (picker submit disabled/no-op); user later disconnects one of several connected accounts without affecting the others.

### 5.4 Feature / Capability: Active Ingestion State & Scheduler Integration

- **Description:** Once one or more Instagram accounts are connected, the connector enters Active Ingestion mode and is polled continuously by the Tier-3 per-user scheduler.
- **Triggers:** Tier-3 scheduler tick (`pollUser(tenantId, userId)`).
- **Inputs:** Active Instagram account credentials for the tenant/user.
- **Processing:**
  - Scheduler architecture per ADR-0061: `pollScheduler.ts` iterates active Instagram account credentials for the tenant and invokes `pollInstagramAccount` per account.
  - In-flight concurrency guard prevents overlapping ticks for the same `(tenantId, 'instagram', userId)` key.
  - Watchdog timeout reconciliation (ADR-0070): runs exceeding `MAX_RUN_DURATION_MS = 15m` are automatically reconciled to release stuck locks, and `stalled` alerts are surfaced if polling ceases entirely.
- **Outputs:** Ingestion run records; connector health status (`healthy` / `reconnect_required` / `stalled`).
- **Error handling:** A run exceeding the 15-minute watchdog threshold is force-reconciled and a `stalled` alert is emitted; the in-flight guard is released so the next tick can proceed.
- **Edge cases:** No active Instagram credentials exist for a tenant/user (connector remains in "Paused" state); a user with many connected accounts whose combined polling approaches the tick time budget (mitigated by sequential pacing, see 5.9).

### 5.5 Feature / Capability: Media Ingestion, Pagination & Lookback Bounds

- **Description:** Fetches published media from each connected account via the Instagram Graph API and bounds both initial and incremental ingestion to protect API quotas and scheduler tick time.
- **Triggers:** Scheduler tick per connected Instagram account.
- **Inputs:** `igUserId`, stored access token, optional pagination cursor.
- **Processing:**
  - Calls `GET /{ig-user-id}/media` (Graph API v21.0 or LTS) requesting `id, caption, media_type, media_url, thumbnail_url, permalink, timestamp, username, like_count, comments_count, children{id,media_type,media_url,thumbnail_url}, location`.
  - Results are strictly newest-first (descending `timestamp`).
  - **Initial ingestion:** paginates with `limit = 25` (max 50) until either: (a) the oldest fetched item's `timestamp` is older than `now - 30 days`, OR (b) total fetched items reach the hard ceiling of 100 media items — whichever condition is reached first.
  - **Incremental polling:** applies the same 30-day lookback ceiling, and additionally halts pagination immediately upon encountering a media item whose `externalId` already exists in `social_posts` for that `(tenantId, providerId, igUserId)` (existing-ID short-circuit).
- **Outputs:** A bounded, ordered set of new media items to be mapped into `SocialPostSummary` rows (see 5.6).
- **Error handling:** See 5.8 (Graph API error classification) for authentication/permission failures encountered mid-pagination; a transient network/HTTP failure during pagination is retried per standard connector retry policy without advancing the cursor.
- **Edge cases:** An account with zero media returns an empty result and no rows are created; an account whose entire recent history was already ingested short-circuits on the very first item; a carousel or video item that straddles the 100-item/30-day boundary is included only if it is reached before the boundary is crossed.

### 5.6 Feature / Capability: Single-Row Carousel Modeling & Canonical Schema Mapping

- **Description:** Maps each Graph API media object deterministically into exactly one `SocialPostSummary` row, preserving carousel gallery structure, author identity, and caption content.
- **Triggers:** Each media item returned by the bounded fetch in 5.5.
- **Inputs:** Raw Graph API media object.
- **Processing:**
  - **Row model:** Every media object (including `CAROUSEL_ALBUM`) creates exactly one `social_posts` row (`externalId: instagram_{igUserId}_{mediaId}`); carousel slides are never split into separate rows.
  - **Carousel children:** for `CAROUSEL_ALBUM` items, `children.data` is stored in `rawPayload.children` in the exact original Meta display order (never reordered), capped at 10 items; if more than 10 exist, the first 10 are kept and `rawPayload.childrenTruncated = true` is set.
  - **URL handling:** `permalink` is stored as the permanent canonical `SocialPost.url`; `media_url`/`thumbnail_url` are stored in `rawPayload` as best-effort preview URLs only (Meta CDN signed URLs expire and are never treated as permanent assets or background-refreshed).
  - **Author mapping:** `author.id = "instagram:" + igUserId`, `author.username = username`, `author.displayName = username` (or account name), `author.platform = 'instagram'`.
  - **Caption normalization:** `caption` is converted to canonical Markdown (`bodyMarkdown`). If `caption` is empty, falls back deterministically to a media-type summary: `[Instagram Photo]`, `[Instagram Video]`, or `[Instagram Carousel]`.
  - **Hosting profile dependency:** `rawPayload.igUserId`, `rawPayload.username`, and `rawPayload.pageName` (parent Facebook Page name) are always stored, and surfaced in the UI as e.g. `[Instagram Business] 📍 @acmeglobal · 2h ago`.
  - **Engagement counters:** `like_count` and `comments_count` are captured into `rawPayload` at ingestion time as a point-in-time snapshot (no periodic re-sync in this scope).
  - **Reels:** published Reels are ingested as `media_type: 'VIDEO'`; ephemeral 24-hour Stories are excluded entirely (never fetched).
  - **Deduplication:** strictly keyed on `externalId`.
- **Outputs:** One `social_posts` row per media item, feeding the standard NLP enrichment pipeline (ADR-0038/ADR-0055) — captions expected to yield sparse key-phrase/sentiment signals given the visual-first nature of the content.
- **Error handling:** A media object missing a required field (e.g. no `timestamp`) is rejected/logged rather than persisted with a null critical field; a carousel with zero children persists `rawPayload.children = []`.
- **Edge cases:** A caption consisting only of whitespace or emoji is treated as "empty" for fallback purposes; a carousel exactly at the 10-child boundary does not set `childrenTruncated`; an account renamed between ingestion runs surfaces the latest `username` on the next poll without altering already-stored historical rows' `rawPayload.username` from prior runs.

### 5.7 Feature / Capability: Country-Level Geospatial Extraction

- **Description:** Extracts a coarse, privacy-conscious geospatial signal from media location tags, consistent with the platform's country-only geospatial policy (ADR-0064).
- **Triggers:** Each media item mapped in 5.6.
- **Inputs:** `location` field from the Graph API media object (if present).
- **Processing:** If `location.country` is present, maps to uppercase ISO 3166-1 alpha-2 and sets `geoCountry`, `geoSource: 'post'`. Raw coordinates are always discarded. If no location is present, `geoCountry` defaults to `null`.
- **Outputs:** `geoCountry` (nullable) and `geoSource` fields on the post.
- **Error handling:** An unrecognized/non-standard country value is treated as absent (`geoCountry: null`) rather than stored raw.
- **Edge cases:** Location tags are optional and rare on Instagram media; most posts are expected to register as "Unknown" in country breakdowns (documented limitation, not a defect).

### 5.8 Feature / Capability: Graph API Error Reclassification & Reconnect Alerts

- **Description:** Deterministically classifies specific Meta Graph API error codes as credential/authorization failures requiring user reconnection, distinct from transient or rate-limit errors.
- **Triggers:** Any Graph API response returned during polling that carries an error payload.
- **Inputs:** Graph API error code (`code` field) from the response.
- **Processing:**
  - Error `190` (invalid/expired token or password changed), error `10` (permission revoked or app capability disabled), and error `100` (invalid parameter / IG account unlinked from Facebook Page / Business asset removed) are immediately reclassified to `http_401` / `reconnect_required`.
  - Connector health for the affected account is updated to `reconnect_required` (per ADR-0070 health model).
  - The corresponding row in `instagram_connected_accounts` is marked as requiring reconnection.
  - A `ConnectorIngestionAlertEvent` is emitted with `alertType: 'reconnect_required'`.
  - Token refresh itself is performed only via the user-driven OAuth re-connection flow in the UI (no silent server-side refresh).
- **Outputs:** Updated connector/account health status; emitted alert event; UI reconnect banner/badge.
- **Error handling:** Any other (non-190/10/100) Graph API error is treated as a standard transient/operational failure and does not flip the account into `reconnect_required`.
- **Edge cases:** A token that is valid but the linked Instagram account was unlinked from the Facebook Page mid-cycle (error `100`) is treated identically to an expired token for alerting purposes; multiple accounts under the same user can independently enter `reconnect_required` without affecting each other's polling.

### 5.9 Feature / Capability: Multi-Account Pacing & Rate-Limit Handling

- **Description:** Paces polling across a user's multiple connected Instagram accounts to avoid bursting Meta Graph API rate limits, and handles rate-limit responses without invalidating credentials.
- **Triggers:** A scheduler tick that covers more than one connected Instagram account for the same user.
- **Inputs:** Ordered list of connected accounts; Graph API `X-App-Usage` headers; rate-limit error responses.
- **Processing:**
  - Accounts are polled **sequentially** (never in parallel) within a user's tick, with an inter-account pacing delay of 1.2s plus jitter.
  - Rate-limit responses (error codes `4`, `17`, or HTTP `429`) parse the `Retry-After` header when provided; if absent, exponential backoff with jitter is applied.
  - Rate-limit handling never invalidates the credential or flips the account to `reconnect_required`.
- **Outputs:** Deferred/retried fetch attempts; no credential state change on rate-limit.
- **Error handling:** Repeated rate-limit responses beyond a bounded retry budget defer the remaining accounts to the next scheduled tick rather than blocking the tick indefinitely.
- **Edge cases:** A user with a very large number of connected accounts whose sequential pacing approaches the scheduler tick time budget (bounded by the per-account 30-day/100-item ingestion cap and the watchdog's 15-minute run ceiling).

### 5.10 Feature / Capability: Admin UI — Connector Status, Health & Re-sync

- **Description:** Surfaces Instagram connector health, connected-account count, and manual re-sync controls to Tenant Administrators and connected users.
- **Triggers:** Tenant Admin/user navigates to the connectors or connector-status screen.
- **Inputs:** Connector/account health state from the backend (`healthy`, `reconnect_required`, `stalled`).
- **Processing:**
  - Renders `instagram` in the "Connectors" (Ingestion) section with connected-account count.
  - Displays "Active / Ingesting" (or "Healthy") badge when at least one Instagram credential is active; "Paused" when none are.
  - Displays `reconnect_required` badge/banner for accounts needing reconnection.
  - Renders a "Re-sync now" on-demand polling button, gated on the credential owner or a `tenant_admin` role.
- **Outputs:** Rendered status screen reflecting current backend health.
- **Error handling:** A re-sync request against an account already mid-run is rejected or queued per the existing in-flight concurrency guard (5.4), not silently duplicated.
- **Edge cases:** A tenant with zero connected Instagram accounts shows the connector as available-but-not-connected rather than erroring.

### 5.11 Feature / Capability: Admin UI — Post Feed Card & Detail Drawer Presentation

- **Description:** Renders ingested Instagram content in the unified post feed and detail drawer with clear hosting attribution, media previews, and carousel galleries.
- **Triggers:** Post feed or detail drawer render for a post where `provider === 'instagram'`.
- **Inputs:** `SocialPostSummary` row and its `rawPayload` fields.
- **Processing:**
  - Post card header displays an `Instagram Business` badge, hosting account badge (e.g. `📍 @acmeglobal`), and publication timestamp.
  - Renders a visual media preview using `thumbnail_url` where available, gracefully falling back to the canonical `permalink` for navigation (no background re-fetch attempts of expired preview URLs).
  - Displays engagement counters (`❤️ {likeCount}` · `💬 {commentsCount}`).
  - Detail drawer, for `mediaType === 'CAROUSEL_ALBUM'`, renders an interactive/multi-thumbnail gallery from `rawPayload.children` in preserved display order; if `rawPayload.childrenTruncated === true`, shows a "View full gallery on Instagram" link pointing to `url`.
  - Detail drawer displays a telemetry row: hosting Instagram account (`@username (ID: {igUserId})`) and parent Facebook Page name.
- **Outputs:** Rendered feed card and detail drawer.
- **Error handling:** A missing/expired `thumbnail_url` falls back to the permalink link without a broken-image error state; a post with no engagement data omits the counters rather than showing zeroes as if verified-zero.
- **Edge cases:** A `VIDEO` (including Reel) post with no thumbnail; a carousel with exactly one child (still rendered as a gallery, not collapsed to a single image, to remain consistent with `media_type`).

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Administrator | Initiates/manages the Instagram OAuth connection, selects accounts, monitors health, triggers re-sync |
| Tenant User (account owner) | May independently connect their own Instagram Business/Creator accounts (Tier-3, user-bound credential) |
| Social Listening Analyst | Reviews ingested Instagram posts, engagement, and carousel galleries in the post feed |
| Background Scheduler | System actor; executes Tier-3 polling ticks per user/account |
| Meta Graph API | External system actor; source of truth for Instagram Business/Creator account data |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 2.24 | Core backend engineer / social listening analyst | Have a dedicated `instagram` ingestion connector querying `/{ig-user-id}/media` for connected accounts | Published photos, videos, Reels, and carousels are ingested with single-row carousel modeling, bounded pagination, deterministic error handling, and hosting attribution | Standard/video/carousel mapping verified; single-row carousel with ordered `rawPayload.children` (+truncation flag); 30-day/100-item pagination precedence; errors `190`/`10`/`100` reclassified to `reconnect_required` with alert emission |
| Story 6.34 | Tenant Administrator or User | Connect Instagram Business/Creator accounts via Meta OAuth, select accounts via a picker modal, monitor health, and review posts (including carousels/Reels) in the feed and drawer | Our team can manage visual brand listening alongside other social channels | Platform definition registers `instagram` with Tier-3 scope; post card renders hosting handle + media preview; detail panel renders carousel gallery from `rawPayload.children`; status screen shows operational metrics and `reconnect_required` badge |

Both stories are marked **Implemented** in `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` and `docs/user-stories/epic-6-tenant-admin-ui.md` respectively, sourced from ADR-0068.

### 6.3 Workflow Diagrams / Steps

**Connect flow (interactive):**
1. Tenant Admin/User selects "Connect Instagram" in the admin UI.
2. System initiates Meta OAuth 2.0 authorization requesting `instagram_basic`, `pages_show_list`, `pages_read_engagement`.
3. User authenticates and authorizes with Meta; Meta redirects back with an authorization code.
4. System exchanges the code for a Page Access Token and calls `GET /me/accounts?fields=id,name,instagram_business_account{...}`.
5. System presents the multi-account picker modal listing each discovered Instagram Business/Creator account (avatar, `@username`, parent Page name).
6. User selects one or more accounts and submits.
7. System stores each selected account as a Tier-3 credential (`platform_credentials`, `owner_type='user'`) and a row in `instagram_connected_accounts`; connector transitions to Active Ingestion.

**Ingestion flow (background, per scheduler tick):**
1. Tier-3 scheduler invokes `pollUser(tenantId, userId)`, iterating the user's active Instagram accounts.
2. In-flight guard checks no overlapping run exists for `(tenantId, 'instagram', userId)`; if clear, proceeds (else skips this tick for that key).
3. For each account (sequentially, 1.2s+jitter apart): call `GET /{ig-user-id}/media`, paginate under the 30-day/100-item (initial) or existing-ID short-circuit (incremental) rule.
4. Map each returned media item to a `SocialPostSummary` row per §5.6, including carousel children and geospatial extraction.
5. On a Graph API error `190`/`10`/`100`: mark `reconnect_required`, emit alert, stop polling that account for this tick.
6. On rate-limit response: back off per `Retry-After`/exponential backoff, continue on the next eligible slot.
7. If the run exceeds 15 minutes, the watchdog reconciles it and emits a `stalled` alert.
8. Newly ingested posts flow into the standard NLP enrichment pipeline and become visible in the post feed.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Meta Graph API OAuth authorization response (access token, granted scopes).
- `GET /me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}` — account discovery.
- `GET /{ig-user-id}/media` with fields `id, caption, media_type, media_url, thumbnail_url, permalink, timestamp, username, like_count, comments_count, children{id,media_type,media_url,thumbnail_url}, location` — media ingestion.

### 7.2 Data Outputs

- `platform_credentials` rows (Tier-3, encrypted token).
- `instagram_connected_accounts` rows (selected accounts, reconnect status).
- `social_posts` rows (`SocialPostSummary`) per ingested media item, feeding the post feed, detail drawer, and NLP enrichment pipeline.
- `ConnectorIngestionAlertEvent` records for `reconnect_required` and `stalled` conditions.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `platform_credentials` (Tier-3) | `owner_type='user'`, `owner_id` (userId), `tenantId`, encrypted long-lived Page Access Token | One user may own multiple credential rows (one per connected Instagram account); scoped to a tenant |
| `instagram_connected_accounts` | `igUserId`, `username`, parent `pageName`, reconnect-status flag | References a `platform_credentials` row; belongs to a user/tenant |
| `social_posts` (`SocialPostSummary`) | `externalId` (`instagram_{igUserId}_{mediaId}`), `providerId='instagram'`, `url` (permalink), `bodyMarkdown`, `publishedAt`, `author`, `geoCountry`, `geoSource`, `rawPayload` | One row per Graph API media object (including carousels); belongs to a tenant; author resolved via `rawPayload.igUserId`/`username` |
| `rawPayload` (JSON, on `social_posts`) | `igUserId`, `username`, `pageName`, `mediaType` (`IMAGE`/`VIDEO`/`CAROUSEL_ALBUM`), `mediaUrl`, `thumbnailUrl`, `children[]` (ordered, max 10), `childrenTruncated`, `like_count`, `comments_count` | Embedded structure on `social_posts`; `children` is an ordered array of child media objects for carousel galleries |
| `author` | `id` (`"instagram:" + igUserId`), `username`, `displayName`, `platform='instagram'` | Denormalized onto each `social_posts` row |
| `ConnectorIngestionAlertEvent` | `alertType` (`reconnect_required` \| `stalled`), `tenantId`, `providerId='instagram'`, account reference | Emitted per ADR-0070 watchdog/error-classification model; surfaced on the connector status screen |

### 7.4 Validation Rules

- `externalId` must be unique per `(tenantId, providerId, igUserId, mediaId)`; deduplication is strictly keyed on `externalId`.
- `rawPayload.children` must never exceed 10 stored items; `childrenTruncated` must be `true` whenever the source carousel exceeded 10 children, and absent/`false` otherwise.
- `geoCountry`, when set, must be a valid uppercase ISO 3166-1 alpha-2 code; otherwise `null`.
- `bodyMarkdown` must never be empty — falls back to a deterministic media-type summary string when `caption` is empty.
- `platform_credentials` rows for this connector must always carry `owner_type = 'user'` (Tier-3); tenant-wide (`owner_type = 'tenant'`) credentials are not permitted for Instagram.
- Pagination for initial ingestion must stop at the first of: oldest item timestamp `< now - 30 days`, or 100 total items fetched.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Instagram Business and Creator accounts are the only ingestible Instagram account types; personal accounts are strictly excluded and inaccessible via the Graph API. | Account discovery, ingestion |
| BR2 | Each Instagram Business/Creator account is discovered only through a linked Facebook Page administered by the authenticating user — no manual account-ID entry path exists. | OAuth/account discovery |
| BR3 | Instagram credentials are Tier-3 (`owner_type='user'`), tenant-scoped; a single user may connect multiple accounts, each a distinct credential entry. | Credential storage |
| BR4 | Graph API errors `190`, `10`, and `100` immediately and deterministically trigger `reconnect_required` status and alert emission; no other error code does. | Error handling |
| BR5 | Carousel albums are represented as exactly one post row with up to 10 ordered child media items in `rawPayload.children`; slides are never split into separate rows. | Media mapping |
| BR6 | `media_url`/`thumbnail_url` are best-effort, expiring preview URLs; `permalink` is the sole permanent content reference. | Media preview handling |
| BR7 | Geospatial extraction is limited to country ISO alpha-2 derived from `location.country`; raw coordinates are always discarded. | Geospatial processing |
| BR8 | Initial ingestion per account is bounded by the first of: oldest item > 30 days old, or 100 total items fetched; incremental polling additionally short-circuits on the first already-seen `externalId`. | Pagination/lookback |
| BR9 | Multi-account polling within a user tick executes sequentially with 1.2s+jitter pacing; rate-limit responses use `Retry-After`/exponential backoff and never invalidate credentials. | Pacing/rate limiting |
| BR10 | Instagram Stories (ephemeral, 24h) are never fetched or persisted. | Ingestion scope |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Meta Graph API (OAuth) | Outbound (system → Meta) | User authentication, account discovery (`/me/accounts`) | HTTPS / OAuth 2.0 / JSON |
| Meta Graph API (`/{ig-user-id}/media`) | Outbound (system → Meta) | Media ingestion, pagination | HTTPS REST / JSON |
| `platform_credentials` store | Internal | Encrypted Tier-3 credential persistence | Database (encrypted at rest) |
| `instagram_connected_accounts` store | Internal | Per-account reconnect-status tracking | Database |
| `social_posts` store | Internal | Canonical post persistence, feeding feed/drawer/analytics | Database |
| Tier-3 poll scheduler (`pollScheduler.ts`) | Internal | Invokes per-user Instagram polling ticks | In-process scheduling |
| Watchdog reconciliation (ADR-0070) | Internal | Detects/reconciles hung ingestion runs, emits `stalled` alerts | In-process / event |
| `ConnectorIngestionAlertEvent` bus | Internal (outbound to UI/alerting) | Surfaces `reconnect_required`/`stalled` alerts | Internal event |
| NLP enrichment pipeline (ADR-0038/0055) | Internal (downstream consumer) | Sentiment/key-phrase enrichment of ingested captions | Internal pipeline |
| `social-listening-admin` connectors/status/feed UI | Internal (upstream consumer) | Renders connect flow, health, post feed, detail drawer | Internal API / React components |

---

## 10. Non-Functional Considerations

- **Performance:** Sequential multi-account polling with 1.2s+jitter pacing bounds outbound request rate; 30-day/100-item lookback ceiling bounds initial-ingestion run time.
- **Security / access control:** All tokens encrypted at rest (matches existing `platform_credentials` practice); Tier-3 credentials are strictly user-owned and tenant-scoped; no system-wide Instagram credentials exist.
- **Scalability:** In-flight concurrency guard per `(tenantId, 'instagram', userId)` prevents overlapping runs as account/user counts grow; per-account bounded pagination keeps per-tick cost predictable.
- **Reliability / availability:** Watchdog reconciliation (15-minute run ceiling) prevents hung locks from permanently blocking future polling; rate-limit handling avoids unnecessary credential invalidation.
- **Audit and logging:** `ConnectorIngestionAlertEvent` provides an auditable trail of `reconnect_required`/`stalled` conditions per account.
- **Accessibility:** Post feed/detail drawer carousel gallery and media previews follow the admin UI's existing accessibility patterns (not newly introduced by this connector).
- **Compliance / privacy:** Zero ingestion of personal Instagram account data; strict country-level-only geospatial extraction; adherence to Meta Platform Terms §3.b and GDPR data-minimization expectations.
- **Localization / internationalization:** No connector-specific localization requirements beyond the admin UI's existing i18n handling.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Graph API error `190` (expired/invalid token) | "Instagram account needs to be reconnected" (reconnect badge/banner) | Account flagged `reconnect_required`; `ConnectorIngestionAlertEvent` emitted; polling for that account halts until reconnection |
| Graph API error `10` (permission revoked) | "Instagram account needs to be reconnected" | Same as above |
| Graph API error `100` (invalid parameter / account unlinked) | "Instagram account needs to be reconnected" | Same as above |
| Rate-limit response (`4`, `17`, HTTP 429) | No user-facing error (transparent retry) | Backoff per `Retry-After` or exponential backoff with jitter; credential remains valid; no alert emitted |
| Ingestion run exceeds 15 minutes | Connector shows "stalled" status | Watchdog force-reconciles the run, releases the in-flight guard, emits `stalled` alert |
| OAuth authorization denied/failed | "Instagram connection could not be completed" | No credential stored; connect flow aborted cleanly |
| Zero Instagram accounts discovered | "No Instagram Business or Creator accounts found on your Facebook Pages" | Picker modal shows an explanatory empty state; no credential stored |
| Expired `media_url`/`thumbnail_url` at render time | Preview gracefully omitted / falls back to link | UI falls back to canonical `permalink`; no background re-fetch attempted |

---

## 12. Assumptions and Dependencies

- The authenticating user has one or more Facebook Pages with linked Instagram Business or Creator accounts.
- Meta Graph API v21.0 or a supported LTS version remains available and stable.
- Standard Access permissions suffice for internal development/testing; Advanced Access (Meta Business Verification) is obtained before onboarding third-party tenants.
- Long-lived Page Access Tokens can be stored and reused for periodic polling without per-run re-authentication.
- Depends on: ADR-0059 (Facebook Page connector scope), ADR-0060 (multi-asset-per-user credential model), ADR-0061 (Tier-3 poll scheduler), ADR-0064 (geospatial country normalization), ADR-0067 (Facebook connector reconfirmation), ADR-0070 (watchdog reconciliation & stalled alerts).
- Story 2.24 depends on Story 2.15 (Facebook connector), Story 2.18 (engagement counts), Story 2.20 (country geospatial normalization), Story 6.27 (multi-asset credential model), Story 1.16 (watchdog reconciliation & alerts).
- Story 6.34 depends on Story 2.24 (backend), Story 6.3 (connector connect/disconnect), Story 6.5 (connector status view), Story 6.14 (post feed client), Story 6.27 (multi-asset picker pattern).

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a dedicated v2 story add periodic background engagement (`like_count`/`comments_count`) re-sync after initial ingestion, given counts are currently a point-in-time snapshot? | Product Owner | Future v2 refresh story (explicitly deferred, not scheduled) |
| Q2 | Should Advanced Access (Meta Business Verification) onboarding be tracked as a formal prerequisite gate before enabling Instagram for new third-party tenants? | Technical Lead | Before first third-party tenant onboarding |

---

## 14. Appendix

### Glossary

See BRD-0068 §15 for the full glossary (Instagram Business Account, Instagram Creator Account, Instagram Graph API, `CAROUSEL_ALBUM`, Reel, Tier-3 Credential, Long-lived Page Access Token, `reconnect_required`, `SocialPostSummary`, `rawPayload`).

### Reference links

- [ADR-0068: Instagram Connector](../../adr/0068-instagram-connector.md)
- [BRD-0068-Instagram-Connector.md](../Business-Requirements/BRD-0068-Instagram-Connector.md)
- [docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) — Story 2.24
- [docs/user-stories/epic-6-tenant-admin-ui.md](../../user-stories/epic-6-tenant-admin-ui.md) — Story 6.34
- [docs/user-stories/README.md](../../user-stories/README.md) — Epic index
- Related ADRs: ADR-0059 (Facebook Page connector), ADR-0060 (multi-asset credentials), ADR-0061 (Tier-3 scheduler), ADR-0064 (geospatial normalization), ADR-0067 (Facebook reconfirmation), ADR-0070 (watchdog reconciliation & alerts)

### Feature-design / research cross-reference

No dedicated `docs/product-research/feature-designs/` or `docs/product-research/reports/` file specifically covers the Instagram connector. `docs/product-research/feature-designs/01-multi-source-ingestion.md` mentions Instagram only in passing, as an open v2-connector candidate — it predates and is superseded by ADR-0068 and is not a source-of-record for this FDD.

### Diagrams

None supplied; see Section 6.3 for the textual connect and ingestion workflow steps.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (regenerated) | Regenerated from ADR-0068 and BRD-0068 to replace a defective batch-generated FDD (wrong H1 and flat BR-table-only Section 5) with a genuine per-capability functional design. |
