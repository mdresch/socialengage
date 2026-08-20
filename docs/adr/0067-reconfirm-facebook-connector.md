# ADR-0067: Facebook Connector (`facebook`) — Platform Connector Scope Reconfirmation, Managed Pages vs. Personal User Profiles, and Geospatial Normalization

**Status:** Proposed (2026-08-19, revised 2026-08-20)

**Source:** Follow-up to ADR-0059 (Facebook Page connector scope), ADR-0060 (Multiple Pages per user), ADR-0061 (Tier-3 poll scheduler), ADR-0064 (Geospatial country normalization), and ADR-0070 (Watchdog reconciliation & stalled alerts). This ADR consolidates and reconfirms the architectural boundaries of the Facebook connector, provides explicit analysis regarding personal user profiles versus managed business pages, updates the UI catalog description and active ingestion status, and aligns credential tiers and geospatial data handling.

---

## Context

### 1. The Social Listening Feasibility Finding for Facebook

As established in ADR-0059, Meta's Graph API surface does not provide a general keyword-search or public-content discovery endpoint (e.g. searching all public Facebook posts matching a watchlist query). The platform's access model strictly distinguishes between:
1. **Managed Facebook Pages (Business, Brand, Creator, or Public Pages):** Accessible via Page Access Tokens (`pages_show_list`, `pages_read_engagement`).
2. **Personal User Profiles / Personal Timelines (Individual Accounts):** Private or semi-private personal posts, friend feeds, and personal user timelines.

### 2. Account Personal Profile vs. Managed Business Pages Analysis

A frequent question in social listening product design is whether a platform can ingest content from an individual's **Personal User Profile / Personal Account** (e.g. `facebook.com/username`):

#### A. Technical & API Accessibility Gaps
- **Graph API Deprecation:** Following the 2018–2019 platform lockdown, Meta permanently deprecated user timeline endpoints (`/me/feed`, `/me/posts`, `/{user-id}/posts`) for third-party applications.
- **Friends & Network Invisibility:** The Graph API provides zero visibility into a user's friends list, friends' feeds, or general network interactions. Reading other people's personal posts is architecturally impossible via standard APIs.

#### B. Privacy, Terms of Service, & Compliance Walls
- **Meta Platform Terms (§3.b):** Meta explicitly prohibits third-party applications from ingesting, scraping, aggregating, or processing personal user timeline data for commercial monitoring, sentiment analysis, or surveillance.
- **GDPR / Regulatory Posture:** Processing private individual timeline posts creates significant data protection and privacy liability under EU GDPR and global privacy frameworks.

#### C. The Role of the Personal User Account in the Architecture
- The personal Facebook account serves exclusively as the **authenticating identity** during the OAuth 2.0 flow (`facebook-oauth`).
- Upon logging in, the personal account grants permission to enumerate only the **Business and Brand Pages** that the user administers (`GET /me/accounts`).
- **Strict Boundary Invariant:** The personal account's own status updates, timeline posts, photos, friends, and private profile information are **never requested, never accessed, and never ingested**.
- **Companion Outbound Sharing:** For personal timelines, the platform supports outbound sharing via the browser-based **Facebook Web Intent URI** (`https://www.facebook.com/sharer/sharer.php?u={URL}&quote={TEXT}`) with clipboard text assistance, where the end user reviews and approves the post interactively in their browser.

---

## Decision

### 1. Connector Definition, UI Description, and Active Ingestion State

A native ingestion connector is established with provider ID `facebook`.

- **Ingestion Target:** **Connected Facebook Pages only**. Personal user profiles, personal timelines, and Facebook Groups are **strictly excluded** from automated background ingestion.
- **UI Platform Presentation & Description:**
  - **Platform ID:** `facebook`
  - **Display Name:** `Facebook Page (Owned Feed)` (mandated by ADR-0059 Decision §2 to prevent generic public keyword listening misconceptions).
  - **Subtitle:** `Meta Graph API Ingestion Source`
  - **Catalog Description:** 
    > *"Ingests published posts, reactions, comments, and shares directly from your connected Facebook Business, Brand, and Creator Pages via Meta Graph API. Outbound personal profile sharing is supported via browser Web Intent."*
- **Active Ingestion vs. Paused State:**
  - When a user completes the OAuth connection and selects one or more managed Pages, the connector is in **Active Ingestion** mode.
  - The background poll scheduler continuously executes Page ingestion runs (`pollFacebookPage.ts`).
  - The connector displays "Active / Ingesting" (or "Healthy") status badges. "Paused" state applies only when no Page credentials are authenticated or when a user explicitly pauses/deactivates a connected Page.
- **Endpoint:** `GET /{page-id}/posts` (Graph API v21.0 or current LTS) requesting:
  `id, message, created_time, permalink_url, place, from, attachments, reactions.summary(total_count).limit(0).as(reactions), comments.summary(total_count).limit(0).as(comments), shares`

---

### 2. Authentication, Credential Tier, and Multi-Page Model

- **Credential Tier (Tier-3, ADR-0028/ADR-0059/ADR-0060):**
  - Facebook authentication is user-delegated OAuth (`authMode: 'oauth2'`).
  - Stored in `platform_credentials` with **`owner_type = 'user'`** (`owner_id = userId`), tenant-scoped.
  - One user can connect multiple managed Facebook Pages (ADR-0060), each stored as a distinct credential entry with its Page Access Token, Page ID, and Page Name.
- **Permissions:** Requires `pages_show_list` and `pages_read_engagement` (Standard Access for app developers/testers; Advanced Access with Meta Business Verification for third-party tenants per ADR-0059 Decision §3).
- **Token Lifecycle:** Long-lived Page Access Tokens (exchanged from 60-day user tokens) are stored encrypted. If a token is revoked or expires, the connector enters the `reconnect_required` health state (ADR-0059/ADR-0070).

---

### 3. Mapping to Canonical Schema & Engagement Normalization

| Graph API field | `SocialPostSummary` field | Notes |
|---|---|---|
| `id` | `externalId` | Graph API post ID (`{pageId}_{postId}`). |
| `permalink_url` | `url` | Canonical permalink to the published Page post. |
| `message` | `bodyMarkdown` | Normalized markdown body text. If empty, falls back to `attachments[0].description`. |
| `created_time` | `publishedAt` | Parsed to ISO 8601 UTC `Date`. |
| `from.name` / `from.id` | `author` / metadata | **Organization-as-Author (ADR-0004/0059):** `author.id = "facebook:" + from.id`, `author.username = from.id`, `author.displayName = from.name`, `author.platform = 'facebook'`. |
| `place` | Geo fields | **Country-Level Geospatial Policy (ADR-0064):** If `place.country` exists, extracts uppercase ISO 3166-1 alpha-2 code (`geoCountry: 'US'`, `geoCountryName: 'United States'`, `geoSource: 'post'`, `geoConfidence: 'high'`). **Discards** lat/lon coordinates, bounding boxes, and street addresses. If `place` is absent, sets `geoCountry = null`. |
| `reactions`, `comments`, `shares` | `rawPayload` | Persists engagement count summaries (`reactions.summary.total_count`, `comments.summary.total_count`, `shares.count`) into `rawPayload` (Story 2.18). |
| — | `providerId` | `facebook` |

- **Deduplication:** Deduped via `(tenant_id, 'facebook', externalId)` on `social_posts`.

---

### 4. Scheduler, In-Flight Concurrency, and Watchdog Integration

- **Scheduler Architecture (ADR-0061):** Polled via the Tier-3 per-user scheduler in `social-listening-core/src/scheduler/pollScheduler.ts`, iterating active user credentials for the tenant.
- **In-Flight Concurrency Guard:** Prevents overlapping ticks for the same `(tenantId, 'facebook', userId)`.
- **Watchdog Timeout Reconciliation (ADR-0070):** Ingestion runs exceeding `MAX_RUN_DURATION_MS = 15m` are automatically reconciled to prevent hung locks, and inactivity triggers `stalled` health alerts on the admin dashboard.

---

## Consequences

### Positive

- **Transparent Product Truth:** The clear distinction between Managed Pages and Personal Accounts eliminates tenant confusion and aligns with Meta's strict platform boundaries.
- **Accurate Active Ingestion Visibility:** Clarifies that Page ingestion is active and continuous upon authentication, not paused or dormant.
- **Modern Description:** Professional description replaces legacy negative disclaimers with an informative summary of Page ingestion and browser-assisted outbound personal sharing.
- **Robust Multi-Page Administration:** Users can connect multiple brand and regional pages under their tenant with granular per-page credential tracking (ADR-0060).
- **Privacy & Compliance Alignment:** Strict adherence to ADR-0064 (country-only geospatial normalization, no lat/lon coordinate storage) and zero personal timeline background scraping.
- **Full Ingestion & Analytics Parity:** Ingested Page posts flow through the standard enrichment pipeline, crisis alert radars, sentiment analytics, and human override drawer (ADR-0071).

### Negative

- **No Public Social Keyword Search:** Cannot search public conversations from arbitrary Facebook users across the web (mitigated by active search discovery connectors like Brave Search ADR-0065 and Bing Search ADR-0066).
- **Sparse Geospatial Signals:** `place` is only attached when a Page author manually tags a location; most posts will register as "Unknown" in country breakdowns.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Ingest Personal User Profile Timelines (`/me/posts`)** | **Rejected.** Prohibited by Meta Platform Terms §3.b, creates severe GDPR liability, and technically deprecated by Meta for third-party commercial applications. |
| **Scrape public Facebook Pages without tokens** | **Rejected.** Violates Meta Terms of Service, risks IP blocks, and provides brittle data. |
| **Label connector as generic "Facebook"** | **Rejected.** Misleads tenants into expecting public network listening. The label "Facebook Page (Owned Feed)" is mandatory. |

---

## Resolved Questions

1. **Personal Profile Handling:** The personal user account acts solely as an OAuth authenticator; personal timelines are strictly excluded from automated background ingestion (outbound personal posting is supported via browser Web Intent URIs).
2. **Credential Ownership:** Formally reaffirmed as Tier-3 user-delegated OAuth credentials (`owner_type = 'user'`).
3. **Geospatial Processing:** Mapped strictly to country-level ISO 3166-1 alpha-2 when `place.country` is present, discarding coordinates per ADR-0064.
4. **Active Ingestion State:** Confirmed active and continuous upon Page authentication, with status badges reflecting real operational health.

---

*Drafted 2026-08-19, revised 2026-08-20 to incorporate Personal Profile vs. Managed Page analysis, Tier-3 OAuth credential harmonization, updated catalog description, active ingestion clarification, and ADR-0064 geospatial alignment. Left **Proposed** for Menno's review and final acceptance.*
