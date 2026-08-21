# ADR-0068: Instagram Connector (`instagram`) — Platform Connector Scope, Business/Creator Account Model, Hosting Profile Dependency, and Tier-3 OAuth Harmonization

**Status:** Accepted (2026-08-20)

**Source:** Follow-up to ADR-0059 (Facebook Page connector scope), ADR-0060 (Multiple assets per user), ADR-0061 (Tier-3 poll scheduler), ADR-0064 (Geospatial country normalization), ADR-0067 (Facebook connector reconfirmation), and ADR-0070 (Watchdog reconciliation & stalled alerts). This ADR establishes the architectural boundaries, Graph API ingestion mechanisms, Tier-3 OAuth credential model, media and carousel normalization, pagination/lookback bounds, and error classification for the Instagram connector.

---

## Context

### 1. The Instagram Graph API Surface & Account Access Model

Meta provides public content and business ingestion for Instagram exclusively through the **Instagram Graph API** (part of Meta Graph API v21.0+). The API access model strictly distinguishes between account types:

1. **Instagram Professional Accounts (Business & Creator Accounts):**
   - Must be linked to a Facebook Page administered by the authenticating user.
   - Fully accessible via Page/User Access Tokens with `instagram_basic` and `pages_read_engagement` permissions.
   - Allows reading published media (`GET /{ig-user-id}/media`), captions, permalinks, media types, and aggregate engagement counts (`like_count`, `comments_count`).
   - Includes standard feed posts, carousel albums, and published Reels (`media_type: 'VIDEO'`).
2. **Personal Instagram Accounts:**
   - **Strictly inaccessible.** Following the deprecation of legacy Instagram APIs in 2018–2020, Meta does not provide any public API endpoints or third-party access to personal user feeds, stories, or followers.
   - Automated ingestion or web scraping of personal Instagram profiles is strictly prohibited under Meta Platform Terms (§3.b) and introduces severe GDPR privacy compliance liability.

### 2. Account Discovery via Linked Facebook Pages

Because every Instagram Business or Creator account is tethered to a parent Facebook Page within Meta Business Suite, account discovery is handled deterministically during OAuth:
- Upon user authorization via Facebook Login for Business, the system queries:
  ```http
  GET /me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url,followers_count}
  ```
- This returns each Facebook Page alongside its connected `instagram_business_account` object (if one exists), enabling a seamless multi-account selection picker in the UI without manual ID entry.

---

## Decision

### 1. Connector Definition, UI Description, and Ingestion State

A native ingestion connector is established with provider ID `instagram`.

- **Ingestion Target:** **Connected Instagram Business and Creator accounts only**. Personal Instagram profiles and personal feeds are **strictly excluded**.
- **UI Platform Presentation & Description:**
  - **Platform ID:** `instagram`
  - **Display Name:** `Instagram Business` (mandated to prevent public hashtag/scraping misconceptions).
  - **Subtitle:** `Meta Graph API Ingestion Source`
  - **Catalog Description:** 
    > *"Ingests published photos, videos, carousels, and reels directly from your connected Instagram Business and Creator accounts via Meta Graph API."*
- **Active Ingestion vs. Paused State:**
  - Connecting and selecting one or more Instagram accounts places the connector in **Active Ingestion** mode.
  - The background poll scheduler continuously executes Instagram media ingestion runs (`pollInstagramAccount.ts`).
  - Displays "Active / Ingesting" (or "Healthy") status badges. "Paused" state applies only when no Instagram credentials are active.
- **Endpoint & Requested Fields:** `GET /{ig-user-id}/media` (Graph API v21.0 or LTS) requesting:
  `id, caption, media_type, media_url, thumbnail_url, permalink, timestamp, username, like_count, comments_count, children{id,media_type,media_url,thumbnail_url}, location`

---

### 2. Authentication, Credential Tier, and Multi-Account Model

- **Credential Tier (Tier-3, ADR-0028/ADR-0059/ADR-0067):**
  - Instagram authentication is user-delegated OAuth 2.0 (`authMode: 'oauth2'`).
  - Stored in `platform_credentials` with **`owner_type = 'user'`** (`owner_id = userId`), tenant-scoped.
  - A user can connect multiple Instagram Business/Creator accounts across their administered Pages, each tracked as a distinct credential entry in `instagram_connected_accounts`.
- **Permissions:** Requires `instagram_basic`, `pages_show_list`, and `pages_read_engagement` (Standard Access for internal development/testing; Advanced Access via Meta Business Verification for third-party tenants).
- **Token Lifecycle & Error Reclassification:**
  - Long-lived Page Access Tokens associated with the Instagram account are stored encrypted.
  - The connector monitors Graph API response error codes:
    - **Error `190`:** Invalid/expired token or password changed.
    - **Error `10`:** Permission revoked or app capability disabled.
    - **Error `100`:** Invalid parameter, IG account unlinked from Facebook Page, or Business asset removed.
  - When encountering these errors, `pollInstagram` immediately reclassifies the error to `http_401` / `reconnect_required`, updates connector health to `reconnect_required` (ADR-0070), marks the account row in `instagram_connected_accounts` as requiring reconnection, and emits a `ConnectorIngestionAlertEvent` (`alertType: 'reconnect_required'`). Token refresh is performed via the OAuth re-connection flow in the UI.

---

### 3. Ingestion Strategy, Pagination, & Lookback Bounds

- **Ordering & Incremental Polling Short-Circuit:**
  - Meta Graph API `/media` returns results strictly in **descending chronological order by `timestamp` (newest first)**.
  - During incremental polling, pagination halts at the first media object whose `externalId` already exists in `social_posts` for that `(tenantId, providerId, igUserId)`.
- **Lookback Bounds & Precedence (Whichever Reached First):**
  - **Initial Ingestion Cap:** On initial account connection, the connector paginates with `limit = 25` (max 50) until **whichever condition is reached first**:
    1. The oldest fetched item's `timestamp` is older than `(now - 30 days)`, **OR**
    2. Total fetched items reach the hard ceiling of **100 media items**.
  - **Incremental Polling:** Applies the same 30-day lookback ceiling while using the existing-ID short-circuit rule.
- **Pacing & Rate Limiting:**
  - Multi-account polling within a user's Tier-3 tick executes **sequentially** with an inter-account pacing delay (1.2s jitter) to prevent bursting against Meta Graph API rate limits (`X-App-Usage` headers).
  - Rate limit responses (`4`, `17`, HTTP `429`) parse the `Retry-After` header when provided, falling back to exponential backoff with jitter without invalidating credentials.

---

### 4. Canonical Schema Mapping, Carousel Normalization, & Media Previews

#### A. Post Dependency on Hosting Instagram Account
Every ingested media post carries an explicit dependency on the hosting Instagram Business account:
- `rawPayload.igUserId`: Unique Meta Instagram Business user ID.
- `rawPayload.username`: Instagram handle (e.g. `acmeglobal`).
- `rawPayload.pageName`: Name of the parent Facebook Page linked to the account.
- **UI Attribution:** Post cards, drawers, and analytics filters prominently display the hosting handle (e.g. `[Instagram Business] 📍 @acmeglobal · 2h ago`).

#### B. Carousel Album (`CAROUSEL_ALBUM`) & Media Modeling
- **Single Parent Post Row Model:** Each media object returned by `/media` creates exactly **one `SocialPostSummary` row** in `social_posts` (`externalId: instagram_{igUserId}_{mediaId}`).
- **Gallery Children Persistence & Display Order:**
  - For `CAROUSEL_ALBUM` media items, child elements (`children.data`) are stored in `rawPayload.children` in the **exact original display order returned by Meta Graph API** (do not reorder).
  - Capped at a maximum of **10 child items** for UI rendering performance; if a carousel exceeds 10 items, the first 10 are preserved and `rawPayload.childrenTruncated = true` is set.
- **Media Previews & Expiry Policy:**
  - `permalink` is stored as the permanent, immutable canonical post URL (`SocialPost.url`).
  - `media_url` and `thumbnail_url` are persisted into `rawPayload` at ingestion time as best-effort preview URLs. They are **not treated as permanent static assets** (Meta CDN signed URLs expire over time).
  - UI components prefer `thumbnail_url` for list/grid previews where available, and gracefully fall back to the canonical `permalink` for permanent content navigation without attempting background URL re-fetching.

#### C. Author Resolution & Caption Normalization
- **Author Mapping:** Mapped as `author.id = "instagram:" + igUserId`, `author.username = username`, `author.displayName = username` (or account name), `author.platform = 'instagram'`.
- **Body Text (`bodyMarkdown`):** `caption` is converted to canonical markdown. If `caption` is empty (common for visual-first posts), falls back deterministically to a media type summary (e.g., `[Instagram Photo]`, `[Instagram Video]`, `[Instagram Carousel]`). Deduplication remains strictly keyed on `externalId`.
- **Enrichment Expectation:** Posts with short or absent captions are enriched through the standard NLP pipeline (ADR-0038/ADR-0055), with the understanding that key phrases and sentiment signals may be sparse.
- **Engagement Counters:** Aggregate counts `like_count` and `comments_count` are captured into `rawPayload` at ingestion time. (Periodic background engagement re-sync is deferred to a dedicated v2 refresh story).

#### D. Mapping Summary

| Meta Graph API Field | `SocialPostSummary` / `rawPayload` Field | Notes |
|---|---|---|
| `id` | `externalId` | Meta Media ID (`instagram_{igUserId}_{mediaId}`). |
| `permalink` | `url` | Canonical permalink to the Instagram post. |
| `caption` | `bodyMarkdown` | Normalized caption markdown. Fallback to deterministic type summary if empty. |
| `timestamp` | `publishedAt` | Parsed to ISO 8601 UTC `Date`. |
| `username` / `igUserId` | `author` | `author.id = "instagram:" + igUserId`, `author.displayName = username`. |
| `igUserId` / `username` | `rawPayload.igUserId`, `rawPayload.username` | **Hosting Profile Dependency:** Identifies the specific publishing Instagram account. |
| `media_type` | `rawPayload.mediaType` | `IMAGE`, `VIDEO` (including Reels), `CAROUSEL_ALBUM`. |
| `media_url` / `thumbnail_url` | `rawPayload.mediaUrl`, `rawPayload.thumbnailUrl` | Best-effort preview URLs; permanent access via `permalink`. |
| `children` | `rawPayload.children` | Array of child media objects (preserved display order, max 10) for gallery rendering. |
| `like_count`, `comments_count` | `rawPayload` | Aggregate engagement summaries at ingestion snapshot. |
| `location` | Geo fields | **Country-Level Geospatial Policy (ADR-0064):** Maps country ISO alpha-2 if explicit (`geoSource: 'post'`); raw coordinates discarded. Defaults to `geoCountry: null`. |
| — | `providerId` | `instagram` |

---

### 5. Scheduler, In-Flight Concurrency, and Watchdog Integration

- **Scheduler Architecture (ADR-0061):** Polled via the Tier-3 per-user scheduler in `pollScheduler.ts` (`pollUser(tenantId, userId)`), iterating active Instagram account credentials for the tenant.
- **In-Flight Concurrency Guard:** Prevents overlapping ticks for `(tenantId, 'instagram', userId)`.
- **Watchdog Timeout Reconciliation (ADR-0070):** Ingestion runs exceeding `MAX_RUN_DURATION_MS = 15m` are automatically reconciled to prevent hung locks, with `stalled` alerts surfaced if polling ceases.

---

## Consequences

### Positive

- **Rich Visual Channel Coverage:** Ingests high-impact brand campaigns, product launches, visual announcements, and creator partnerships including Reels.
- **Clean Single-Row Carousel Model:** Avoids feed clutter and analytics double-counting by storing carousel items as single posts while carrying gallery children in `rawPayload`.
- **Bounded Lookback & Quota Protection:** 30-day / 100-item caps prevent runaway initial ingestion times and protect API quotas.
- **Deterministic Error Recovery:** Precise classification of Graph API errors (`190`, `10`, `100`) triggers immediate `reconnect_required` status and user alert banners.
- **Seamless Account Discovery:** Automated enumeration of Instagram Business accounts linked to Facebook Pages eliminates manual ID entry.
- **Clear Profile Attribution:** Unambiguous display of hosting `@username` across post feeds, inspection drawers, and analytics views.
- **Privacy-First & Compliant:** Zero private timeline scraping, strict country-level geospatial extraction (ADR-0064), and adherence to Meta Terms §3.b.

### Negative

- **No General Social Keyword Discovery:** Limited to connected owned/managed business accounts (complemented by Brave Search ADR-0065 and Bing Search ADR-0066 for public web/news discovery).
- **Transient Media Preview URLs:** Meta CDN signed URLs expire over time; the UI must gracefully fall back to canonical `permalink` or `thumbnail_url`.
- **Sparse Geospatial Signals:** Location tags are optional on Instagram media; most posts will register as "Unknown" in country breakdowns.
- **Stories Excluded:** Instagram Stories are ephemeral (24h expiry) and excluded from persistent social listening storage.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Ingest each carousel slide as a separate post row** | **Rejected.** Fragmenting carousel slides into multiple rows distorts analytics post volume, creates duplicate feed entries with identical captions, and fractures comment counts. |
| **Unbounded historical ingestion on first connect** | **Rejected.** Pulling unlimited historical media causes severe scheduler tick timeouts and consumes Graph API rate limits. Bounded to 30 days / 100 items (whichever is reached first). |
| **Classify as Tier-2 Tenant Credential** | **Rejected.** Instagram accounts are administered via individual personal Facebook OAuth logins; they must be modeled as Tier-3 user-bound credentials (`owner_type = 'user'`) matching ADR-0028/0059/0067. |
| **Scrape public Instagram hashtags/profiles without tokens** | **Rejected.** Violates Meta Terms of Service, triggers aggressive IP rate limits/blocks, and creates compliance liabilities. |
| **Ingest personal Instagram accounts** | **Rejected.** Graph API does not support personal user accounts; deprecated by Meta since 2018–2020. |

---

## Resolved Questions

1. **Carousel & Media Modeling:** Modeled as a single parent `SocialPostSummary` row with `rawPayload.children` containing the child gallery items in original Meta display order (capped at 10 items).
2. **Lookback & Ingestion Bounds:** Bounded to 30 days or 100 media items (whichever is reached first) on initial fetch, with newest-first cursor pagination (`limit = 25`).
3. **Account Discovery:** Handled automatically via `GET /me/accounts?fields=instagram_business_account{...}` during the OAuth flow.
4. **Token Invalidation & Unlinks:** Errors `190`, `10`, and `100` deterministically trigger `reconnect_required` health status and alert events.
5. **Credential Ownership:** Formally classified as Tier-3 user-delegated OAuth credentials (`owner_type = 'user'`).
6. **Hosting Account Attribution:** Every post explicitly stores `igUserId` and `username` in `rawPayload` and displays the hosting account handle on the post card and detail drawer.
7. **Reels & Video Posts:** Published Reels are ingested as `media_type: 'VIDEO'`; ephemeral 24h Stories are explicitly excluded.
8. **Geospatial Processing:** Mapped strictly to country-level ISO 3166-1 alpha-2 when `location.country` is present, discarding coordinates per ADR-0064.

---

*Accepted 2026-08-20 by Menno with single-row carousel modeling (ordered children in `rawPayload`, 10-item cap), bounded 30-day/100-item pagination precedence, newest-first short-circuit incremental polling, Graph API error code reclassification (`190`/`10`/`100` $\rightarrow$ `reconnect_required`), sequential inter-account pacing, and media URL stability safeguards.*


