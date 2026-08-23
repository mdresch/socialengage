# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0069 Social Engage – LinkedIn Connector — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer (regenerated) |
| Reviewer(s) | Menno Drescher (Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0069 (LinkedIn Connector), BRD-0069-LinkedIn-Connector.md, Story 2.25 (epic-2), Story 6.35 (epic-6), ADR-0002/0003/0009/0010/0014/0015/0018/0028/0070 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0069 (Accepted, 2026-08-20) and BRD-0069 into the functional design for the `linkedin` ingestion connector: a Tier-3, confidential-client OAuth 2.0 connector that connects LinkedIn member (and, when partner-approved, organization) accounts, manages the 60-day access / up-to-1-year refresh token lifecycle, enforces Rest.li rate limits and a 1-hour polling guardrail, and normalizes LinkedIn posts and authors into the platform's canonical data model.

### 2.2 Scope

- **In scope:**
  - Confidential-client OAuth 2.0 authorization-code flow, tenant-scoped `state` parameter storage/validation.
  - Access-token (60-day) and refresh-token (up to 1-year) lifecycle management with persisted `refreshTokenExpiresAt`, proactive `expiring_soon` warnings, and deterministic `expired`/`revoked` classification on `invalid_grant`.
  - Rest.li rate-limit header parsing and `RequestGate` integration (ADR-0003).
  - Scheduler-level minimum 1-hour polling guardrail, with sub-hour cadence gated behind `linkedin.org.enabled` and verified partner-tier status.
  - Standard member scopes available self-service; optional organization scopes with graceful degradation when not approved.
  - Normalization of LinkedIn API responses into canonical `SocialPost` and `Author` records; raw payloads held only in memory during normalization.
  - Best-effort, idempotent OAuth revocation on disconnect, and tenant-scoped LinkedIn data deletion (GDPR erasure, ADR-0018).
  - Admin UI: platform definition, OAuth connect/callback, connector status screen (health, token-expiry, scope-degradation badges), and post feed/detail drawer presentation.
- **Out of scope:**
  - LinkedIn advertising campaign creation or ad analytics.
  - Direct-message or InMail monitoring.
  - Real-time push webhooks (not offered by LinkedIn on the standard partner tier).
  - Third-party aggregator integrations (Ayrshare, Buffer).
  - Public-client PKCE-only OAuth flow.
  - LinkedIn outbound publishing — governed separately by ADR-0075 / Story 2.30.
  - Blocking credential disconnection on token-revocation failure.

### 2.3 Target Audience

Backend engineers (`social-listening-core`), frontend engineers (`social-listening-admin`), QA/contract authors, product owner, compliance/DPO reviewer.

---

## 3. Context and Background

Social Engage already ingests RSS, news, tenant-owned feeds, Wikipedia, Facebook, and Instagram content, but has no native LinkedIn integration. LinkedIn is a primary channel for professional/B2B engagement, and its absence leaves tenants unable to track professional network conversations, personal posts, or company-page activity inside the unified post feed — forcing reliance on LinkedIn-native tools or third-party aggregators, which increases manual work and credential-exposure risk, and is a competitive gap against platforms such as Sprout Social and Sprinklr.

ADR-0069 governs the LinkedIn-specific integration on top of the already-decided connector architecture: credential storage (ADR-0014), rate-limit enforcement (ADR-0003), error handling/auto-disable (ADR-0010), connector health derivation (ADR-0009), tenant isolation (ADR-0015), and data retention (ADR-0018). It is implemented by Story 2.25 (backend) and Story 6.35 (UI). LinkedIn's key constraints — 60-day access tokens, up-to-1-year refresh tokens, per-member daily and per-endpoint Rest.li quotas, prohibition on long-term raw-payload retention, and no push webhooks — directly shape this design.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Expand coverage to professional/B2B audiences through native LinkedIn ingestion | LinkedIn connector available in the tenant connector grid; OAuth connection completes within one session |
| G2 | Eliminate reliance on third-party aggregators for LinkedIn data | 100% of LinkedIn ingest traffic uses the platform-managed credential and connector flow |
| G3 | Maintain GDPR and platform-terms compliance for OAuth data and retention | No raw LinkedIn API payloads retained; disconnect triggers tenant-scoped data deletion |
| G4 | Provide reliable, transparent LinkedIn ingestion health and token status | Connector health and token-expiry badges are accurate and surfaced on the status screen |
| G5 | Protect operational stability with safe, scheduler-enforced polling | No tenant exceeds LinkedIn daily rate limits; scheduler rejects sub-1-hour intervals outside approved partner scopes |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Connector Registration & Catalog Presentation

- **Description:** Registers a native `linkedin` connector in the platform catalog as a Tier-3 OAuth ingestion source.
- **Triggers:** Platform catalog render; connector registry lookup during scheduler ticks.
- **Inputs:** None (static definition).
- **Processing:** Platform ID `linkedin`; display name `LinkedIn`; subtitle `OAuth Ingestion Source`; description "Ingests published posts, comments, reactions, and company page analytics via LinkedIn REST API."; `category: 'Ingestion'`, `authMode: 'oauth'`, `deliveryMode: 'poll'`, `personalScopeAllowed: true`, `tenantScopeAllowed: false` (Tier-3 user credential only).
- **Outputs:** Connector entry visible in the platform catalog and connectors screen.
- **Error handling:** N/A (static registration).
- **Edge cases:** None specific to this capability.

### 5.2 Feature / Capability: OAuth Authorization & Tenant-Scoped State Isolation

- **Description:** Authenticates a tenant user via LinkedIn's confidential-client OAuth 2.0 authorization-code flow, protecting the callback against cross-tenant CSRF.
- **Triggers:** User initiates "Connect LinkedIn" from the admin UI (`getAuthUrl`); LinkedIn redirects back to the callback endpoint.
- **Inputs:** Tenant ID; requested scopes; LinkedIn authorization code and `state` on callback.
- **Processing:**
  1. Generate a cryptographically secure 32-byte hex `state` value.
  2. Store it server-side under cache key `linkedin:oauth:state:{tenantId}:{state}` with a strict 10-minute TTL.
  3. Build and return the LinkedIn authorize URL including the `state` parameter and requested member (and, if applicable, organization) scopes.
  4. On callback: validate the `state` key exists, verify the callback context's `tenantId` matches the key's tenant segment, then immediately invalidate/delete the key.
  5. Exchange the authorization code for `access_token` + `refresh_token` using the confidential client (`client_id` + `client_secret`).
  6. Persist the credential via envelope encryption (Azure Key Vault, ADR-0014/ADR-0028) with `refreshTokenExpiresAt = now + 365 days`.
- **Outputs:** Persisted Tier-3 credential; user redirected to a connected/success state in the admin UI.
- **Error handling:** A missing/expired/tenant-mismatched `state` key rejects the callback without exchanging the code or persisting a credential. A failed code exchange aborts the flow with a user-facing error.
- **Edge cases:** A `state` value reused after its 10-minute TTL has expired is treated as invalid; a callback whose `tenantId` does not match the cached key's tenant segment is rejected as a potential CSRF attempt.

### 5.3 Feature / Capability: Token Lifecycle, Refresh & Proactive Expiry Warnings

- **Description:** Manages the 60-day access token and up-to-1-year refresh token lifecycle, refreshing proactively and surfacing expiry warnings before failures occur.
- **Triggers:** Automatic invocation by the connector core before surfacing a `401` (`refreshToken()`); scheduled/background proactive refresh when within the expiry warning window.
- **Inputs:** Stored credential (`access_token`, `refresh_token`, `refreshTokenExpiresAt`).
- **Processing:**
  - On successful refresh: update `access_token` (new 60-day expiry). If LinkedIn returns a new `refresh_token`, store it and update `refreshTokenExpiresAt` to `now + 365 days`; if omitted, retain the existing `refresh_token` and its existing `refreshTokenExpiresAt`.
  - Surface `credentialStatus: 'expiring_soon'` when the access token is within 7 days of its 60-day expiry (triggers proactive background refresh).
  - Surface `credentialStatus: 'expiring_soon'` when the refresh token is within 30 days of `refreshTokenExpiresAt` (prompts the tenant administrator to re-authenticate; cannot be auto-resolved by refresh).
  - On refresh failure with `invalid_grant`: if `now > refreshTokenExpiresAt`, set `credentialStatus = 'expired'` (reason: "Refresh token expired (>1 year)"); if `now <= refreshTokenExpiresAt`, set `credentialStatus = 'revoked'` (reason: "Authorization revoked by user or password changed"). Either outcome transitions connector health to `reconnect_required` (ADR-0070) and halts blind retries.
- **Outputs:** Updated credential record; `ConnectorHealth`/`credentialStatus` state; `ConnectorIngestionAlertEvent` on `reconnect_required`.
- **Error handling:** Non-`invalid_grant` refresh failures (e.g. transient network error) are retried per standard backoff rather than immediately classified as `expired`/`revoked`.
- **Edge cases:** A refresh response that omits `refresh_token` repeatedly over successive refreshes continues to extend only `access_token` expiry while the original `refreshTokenExpiresAt` ceiling approaches; a refresh occurring exactly at the 7-day or 30-day boundary is treated as within the warning window (inclusive).

### 5.4 Feature / Capability: OAuth Scope Tiers & Graceful Organization-Scope Degradation

- **Description:** Splits LinkedIn OAuth scopes into a self-service member tier and a partner-gated organization tier, ensuring the connector remains fully functional and `healthy` when organization scopes are unavailable.
- **Triggers:** OAuth authorization and every subsequent poll/health evaluation.
- **Inputs:** Granted scope set from the OAuth consent; `linkedin.org.enabled` feature flag; tenant partner-tier verification status.
- **Processing:**
  - Member scopes (`openid`/`r_liteprofile`, `email`/`r_emailaddress`, `w_member_social`, `r_member_social`) are requested and available immediately upon app creation.
  - Organization scopes (`w_organization_social`, `r_organization_social`) require LinkedIn Marketing Developer Partner Programme approval and are gated behind the `linkedin.org.enabled` feature flag.
  - If organization scopes are not granted, the connector continues operating normally for member-level posts and remains in `healthy` status — it never fails due to a missing organization scope.
  - The status screen surfaces a non-blocking informational notice: "Organization features unavailable — partner scope approval pending."
- **Outputs:** Connector health remains `healthy`; informational badge rendered in the UI when organization scopes are absent.
- **Error handling:** A `403 Forbidden` due to a missing scope on an organization-specific call gracefully degrades that specific feature rather than failing the whole poll (see 5.7).
- **Edge cases:** A tenant that later obtains partner approval and grants organization scopes transitions from the degraded to full-feature state without requiring credential re-creation, only re-authorization to add the new scopes.

### 5.5 Feature / Capability: Rest.li Rate-Limit Header Parsing & Request Gating

- **Description:** Parses LinkedIn's Rest.li gateway rate-limit headers and integrates with the shared, tenant-scoped `RequestGate` to prevent exceeding LinkedIn's quotas.
- **Triggers:** Every LinkedIn API response.
- **Inputs:** Response headers.
- **Processing:**
  - Parses headers defensively and case-insensitively, in priority order: limit — `x-restli-gateway-ratelimit-limit` (fallback `x-ratelimit-limit`); remaining — `x-restli-gateway-ratelimit-remaining` (fallback `x-ratelimit-remaining`); reset — `x-restli-gateway-ratelimit-reset` (fallback `x-ratelimit-reset`).
  - `x-restli-gateway-ratelimit-reset` is returned in epoch seconds; the parser explicitly converts it to epoch milliseconds (`resetEpochSeconds * 1000`) before computing backoff delays.
  - Live header state dynamically overrides the conservative static baseline (`100 requests/day`, `fixed-window` strategy) enforced per `(tenantId, 'linkedin')` via the shared `RequestGate` (ADR-0003).
  - Requests that would exceed the limit are queued until reset rather than dropped.
- **Outputs:** Updated `RateLimitState` for the tenant/provider pair; queued or immediately-executed requests.
- **Error handling:** Missing or malformed rate-limit headers fall back to the static baseline config rather than failing the request.
- **Edge cases:** LinkedIn returning only the generic `x-ratelimit-*` headers (not the Rest.li-prefixed variants) is handled transparently by the fallback chain.

### 5.6 Feature / Capability: Scheduler-Enforced Polling Guardrails

- **Description:** Enforces a minimum 1-hour polling cadence at the scheduler level (not merely as advisory configuration), protecting against LinkedIn's per-member and per-endpoint quotas.
- **Triggers:** Any request (manual, scheduled, or configuration-driven) to poll LinkedIn for a given `(tenantId, 'linkedin')`.
- **Inputs:** Requested poll interval; `linkedin.org.enabled` feature flag; tenant partner-tier verification flag.
- **Processing:**
  - Default cadence: at most once per hour (`minPollIntervalSeconds = 3600`) per `(tenantId, 'linkedin')`.
  - The Tier-3 poll scheduler strictly rejects any requested interval `< 3600` seconds with a validation error, unless both: `linkedin.org.enabled === true`, AND the tenant possesses a verified partner-tier flag with elevated API quotas.
  - Every poll attempt — including rate-limited or queued runs — creates an `IngestionRun` record (ADR-0005) so `ConnectorHealth` derivation (ADR-0009) remains accurate.
- **Outputs:** Accepted or rejected poll-interval configuration; `IngestionRun` audit records.
- **Error handling:** A rejected sub-1-hour interval surfaces a validation error to the configuring caller; it does not silently clamp to 1 hour.
- **Edge cases:** A tenant that loses verified partner-tier status after previously being granted sub-hour polling reverts to the 1-hour minimum on the next scheduling evaluation.

### 5.7 Feature / Capability: LinkedIn-Specific Error Classification

- **Description:** Classifies LinkedIn/Rest.li error responses into retryable vs. non-retryable categories with deterministic lifecycle actions.
- **Triggers:** Any error response from a LinkedIn API call during polling.
- **Inputs:** HTTP status code, LinkedIn error body (e.g. `invalid_grant`).
- **Processing:**
  | Error Code / Condition | Classification | Behavior |
  |---|---|---|
  | `401` (access token expired) | Transient before refresh | Invokes `refreshToken()`; retries on success; on failure evaluates `refreshTokenExpiresAt` and marks `reconnect_required` |
  | `401` / `invalid_grant` | Non-retryable | Classifies `revoked` or `expired` via `refreshTokenExpiresAt`; enters `reconnect_required` (ADR-0070) |
  | `403` (scope missing) | Non-retryable | Gracefully degrades the affected feature; surfaces informational badge (5.4) |
  | `429` Too Many Requests | Retryable | Parses `Retry-After` or `x-restli-gateway-ratelimit-reset` (epoch seconds); exponential backoff with jitter |
  | `5xx` Server Error | Retryable | Exponential backoff with jitter |
  | Malformed query/payload | Non-retryable | Logs error, halts the run, surfaces failure to admin |
- **Outputs:** Updated connector/credential health state; retried or halted requests; alert events where applicable.
- **Error handling:** Covered by the classification table itself; any error code not listed defaults to a conservative non-retryable, logged failure.
- **Edge cases:** A `403` on an organization-scoped endpoint while member-scoped endpoints continue succeeding must not flip the whole connector to `reconnect_required` — only the degraded feature is affected.

### 5.8 Feature / Capability: Post Ingestion & Canonical Normalization

- **Description:** Polls LinkedIn for member (and, when available, organization) post activity and normalizes results into the platform's canonical `SocialPost` and `Author` models.
- **Triggers:** Scheduler tick honoring the 1-hour (or partner-verified shorter) cadence (5.6), gated by `RequestGate` (5.5).
- **Inputs:** Stored credential; watchlist configuration.
- **Processing:**
  - `poll(credential, watchlist)` fetches LinkedIn post/engagement data at the governed cadence; each poll attempt (including rate-limited/queued runs) is recorded as an `IngestionRun`.
  - `normalize(raw)` maps the LinkedIn response to `{ post: SocialPost, author: Author }`: `author.id = "linkedin:" + memberId`, `author.displayName = firstName + ' ' + lastName`.
  - Raw API payloads are held only in memory during `normalize()` and are never written to permanent storage (per LinkedIn Terms of Service and ADR-0018); only normalized/derived data is retained long-term.
- **Outputs:** New `SocialPost` and `Author` records visible in the tenant's post feed.
- **Error handling:** See 5.7 for error classification during polling; a normalization failure on a single malformed item is logged and that item is skipped rather than failing the entire run.
- **Edge cases:** A post authored by an organization page (when organization scopes are granted) still normalizes through the same `Author` shape, using the organization's identifier in place of a personal `memberId`.

### 5.9 Feature / Capability: Disconnect, Best-Effort Revocation & GDPR Data Erasure

- **Description:** Allows a tenant to disconnect LinkedIn, revoking the OAuth grant on a best-effort basis and purging tenant-scoped LinkedIn data.
- **Triggers:** `DELETE /connectors/linkedin/disconnect` invoked by an authorized user.
- **Inputs:** Stored credential (refresh token preferred, access token fallback).
- **Processing:**
  1. Call `https://www.linkedin.com/oauth/v2/revoke` passing the stored refresh token (fallback: access token). Refresh tokens remain valid even after the 60-day access token has expired, giving more reliable revocation.
  2. Treat revocation as best-effort and idempotent: a non-200 response is logged at `WARN` (not `ERROR`) and does **not** block disconnection.
  3. Delete the envelope-encrypted credential from the database and Azure Key Vault (ADR-0014/ADR-0028).
  4. Enqueue deletion of tenant-scoped LinkedIn-sourced `SocialPost` and `Author` records per ADR-0018's GDPR right-to-erasure retention policy.
- **Outputs:** Credential removed; disconnect confirmation to the user; queued data-deletion job.
- **Error handling:** A revoke-endpoint failure (network error, non-200) never blocks steps 3–4; disconnection always completes from the tenant's perspective.
- **Edge cases:** Disconnecting an already-`reconnect_required` (revoked/expired) credential still attempts best-effort revocation and always completes credential erasure and data-deletion enqueueing.

### 5.10 Feature / Capability: Admin UI — Connector Status, Health & Scope-Degradation Badges

- **Description:** Surfaces LinkedIn connector health, token-expiry, and organization-scope status to Tenant Administrators and connected users.
- **Triggers:** Tenant Admin/user navigates to the connectors or connector-status screen.
- **Inputs:** Connector/credential health state from the backend.
- **Processing:**
  - Renders `linkedin` in the "Connectors" (Ingestion) section.
  - If organization scopes are pending/missing, displays the non-blocking "Organization features unavailable — partner scope approval pending." badge/callout.
  - Shows operational telemetry: Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 1h").
  - Surfaces `expiring_soon` badge per the 7-day/30-day thresholds (5.3).
  - Displays `reconnect_required` badge and alert banner if the token is revoked or refresh fails.
  - Renders a "Re-sync now" button, gated on the credential owner or `tenant_admin` role, for on-demand polling.
- **Outputs:** Rendered status screen reflecting current backend health.
- **Error handling:** A re-sync request is subject to the same scheduler guardrails (5.6) and rate gate (5.5) as scheduled polls — it cannot bypass the 1-hour minimum.
- **Edge cases:** A tenant with no connected LinkedIn credential shows the connector as available-but-not-connected.

### 5.11 Feature / Capability: Admin UI — Post Feed Card & Detail Drawer Presentation

- **Description:** Renders ingested LinkedIn content in the unified post feed and detail drawer with provider-specific attribution.
- **Triggers:** Post feed or detail drawer render for a post where `provider === 'linkedin'`.
- **Inputs:** Normalized `SocialPost`/`Author` records.
- **Processing:**
  - Post card header displays a `LinkedIn` badge, author attribution (e.g. "By: John Smith" or "Acme Corp"), and publication timestamp.
  - Renders body text from the canonical Markdown.
  - Displays engagement counters (reactions, comments, shares).
  - Detail drawer telemetry row displays **Provider:** `LinkedIn`, **Author ID:** `linkedin:{memberId}`, and the post permalink.
- **Outputs:** Rendered feed card and detail drawer.
- **Error handling:** A post with no engagement data omits the counters rather than showing a false zero.
- **Edge cases:** An organization-authored post displays the organization's display name in place of an individual member's name, following the same `Author` rendering path.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Administrator | Connects/manages the LinkedIn connector, monitors health, triggers re-sync, disconnects |
| Tenant User / Social Listening Analyst | Reviews ingested LinkedIn posts and engagement in the post feed |
| Content Marketer | Relies on LinkedIn coverage of personal profile and (when approved) company-page activity |
| Compliance / Data Protection Officer | Verifies GDPR consent, encryption, and erasure behavior |
| Background Scheduler | System actor; executes Tier-3 polling ticks per user/tenant respecting the 1-hour guardrail |
| LinkedIn REST API / OAuth Service | External system actor |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 2.25 | Core backend engineer / social listening analyst | Have a dedicated `linkedin` connector implementing confidential-client OAuth, 60-day token refresh with persisted `refreshTokenExpiresAt`, Rest.li rate-limit parsing, scheduler-level 1-hour guardrails, and graceful scope degradation | The platform securely ingests LinkedIn posts and engagement while adhering to LinkedIn API constraints and GDPR retention policy | Confidential client code exchange and `refreshTokenExpiresAt` initialization verified; refresh-retention and `invalid_grant` classification verified; epoch-seconds-to-ms header conversion verified; scheduler rejects <3600s interval without partner flag |
| Story 6.35 | Tenant Administrator or User | Connect LinkedIn member/company accounts via OAuth, view operational health and scope availability on the status screen, and view ingested posts in the feed/drawer | Our team can monitor professional network discussions and company-page interactions seamlessly | Platform definition registers `linkedin` with Tier-3 scope; scope-degradation badge renders when org scopes pending; status screen shows telemetry, `expiring_soon`, and `reconnect_required` badges; post card/drawer render attribution and engagement |

Story 2.25 is marked **Implemented**; Story 6.35 is marked **Ready, not yet built** in `docs/user-stories/epic-6-tenant-admin-ui.md` as of this FDD's writing — both sourced from ADR-0069. (Note: `CLAUDE.md`'s epic status snapshot may lag; the story file itself is authoritative for current build status.)

### 6.3 Workflow Diagrams / Steps

**Connect flow (interactive):**
1. Tenant Admin/User selects "Connect LinkedIn" in the admin UI.
2. System generates a secure `state`, caches it under `linkedin:oauth:state:{tenantId}:{state}` (10m TTL), and redirects to LinkedIn's authorize URL with requested member (and optionally organization) scopes.
3. User authenticates and consents on LinkedIn; LinkedIn redirects back with an authorization code and `state`.
4. System validates the `state` (existence + tenant match), invalidates it, and exchanges the code for `access_token` + `refresh_token` via the confidential client.
5. System persists the credential (envelope-encrypted) with `refreshTokenExpiresAt = now + 365 days`; connector becomes active.
6. If organization scopes were not granted, the status screen shows the non-blocking partner-scope-pending badge; member-level ingestion proceeds normally.

**Ingestion flow (background, per scheduler tick):**
1. Tier-3 scheduler evaluates the configured poll interval against the 1-hour guardrail (rejecting anything shorter unless partner-verified).
2. `RequestGate` checks/enforces the tenant-scoped Rest.li rate limit before issuing the call.
3. Connector polls LinkedIn; response headers are parsed for live rate-limit state (epoch-seconds-to-ms conversion).
4. On success: `normalize()` maps results to `SocialPost`/`Author`; raw payload discarded after normalization; `IngestionRun` recorded.
5. On `401`: attempt `refreshToken()`; retry on success, else classify `expired`/`revoked` and enter `reconnect_required` with an alert.
6. On `403` (missing scope): degrade only the affected feature; connector stays `healthy`.
7. On `429`/`5xx`: back off (per `Retry-After` or exponential/jitter) and retry within the same or a later tick; `IngestionRun` still recorded for the attempt.

**Disconnect flow:**
1. User requests disconnect.
2. System calls LinkedIn's revoke endpoint with the refresh token (fallback access token); failure is logged at WARN and does not block the next steps.
3. Credential deleted from database and Key Vault.
4. Tenant-scoped LinkedIn data deletion enqueued (GDPR erasure).

---

## 7. Data Requirements

### 7.1 Data Inputs

- LinkedIn OAuth authorization code and `state` (callback).
- LinkedIn OAuth token endpoint response (`access_token`, `refresh_token`, expiry metadata).
- LinkedIn REST API v2 / Community Management API post and engagement data.
- LinkedIn Rest.li rate-limit response headers.

### 7.2 Data Outputs

- Envelope-encrypted `platform_credentials` row (Tier-3) with `refreshTokenExpiresAt`.
- Normalized `SocialPost` and `Author` records in the post feed.
- `IngestionRun` audit records per poll attempt.
- `ConnectorHealth` / `credentialStatus` state and `ConnectorIngestionAlertEvent` records.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `platform_credentials` (Tier-3) | `owner_type='user'`, `owner_id` (userId), `tenantId`, encrypted `access_token`, encrypted `refresh_token`, `refreshTokenExpiresAt` (ISO 8601 UTC), `credentialStatus` (`healthy`/`expiring_soon`/`expired`/`revoked`) | Belongs to a user/tenant; one credential per connected LinkedIn account |
| `linkedin:oauth:state:{tenantId}:{state}` (cache key) | `tenantId`, `state`, 10-minute TTL | Transient CSRF-protection record, deleted on use or expiry |
| `SocialPost` (LinkedIn) | `providerId='linkedin'`, `bodyMarkdown`, `publishedAt`, engagement counts (reactions/comments/shares), `permalink` | One row per ingested LinkedIn post; author resolved via `Author` |
| `Author` (LinkedIn) | `id` (`"linkedin:" + memberId`), `displayName` (`firstName + ' ' + lastName`, or organization name) | Denormalized/linked onto each `SocialPost` row |
| `IngestionRun` | `tenantId`, `providerId='linkedin'`, timestamp, outcome | One row per poll attempt (including rate-limited/queued runs); feeds `ConnectorHealth` derivation |
| `ConnectorHealth` / `credentialStatus` | `healthy` \| `expiring_soon` \| `expired` \| `revoked` \| `reconnect_required` | Derived from `IngestionRun` outcomes and token-lifecycle events |
| `ConnectorIngestionAlertEvent` | `alertType` (`reconnect_required`), `tenantId`, `providerId='linkedin'` | Emitted on `invalid_grant` classification; surfaced on the status screen |

### 7.4 Validation Rules

- `refreshTokenExpiresAt` must always be a valid ISO 8601 UTC timestamp; set to `now + 365 days` on initial authorization and updated only when LinkedIn issues a new `refresh_token`.
- `credentialStatus` transitions must follow the defined state set (`healthy`, `expiring_soon`, `expired`, `revoked`) — no ad hoc statuses.
- Rate-limit reset values must be normalized to epoch milliseconds internally regardless of the header's epoch-seconds source format.
- Poll interval configuration must be rejected (not silently clamped) if `< 3600` seconds and partner verification is not active.
- No raw LinkedIn API JSON may be persisted to any durable store; only the fields extracted into `SocialPost`/`Author` are retained.
- `author.id` must always follow the `linkedin:{memberId}` format (or organization-equivalent identifier) for uniqueness and cross-reference.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | LinkedIn is a Tier-3 user-credential connector; tenant-wide credential sharing is not allowed. | Credential storage |
| BR2 | Organization features (`w_organization_social`, `r_organization_social`) are gated behind the `linkedin.org.enabled` feature flag and verified partner status. | Scope handling |
| BR3 | When organization scopes are missing, the connector continues in `healthy` status and displays the partner-scope-pending informational notice. | Scope degradation |
| BR4 | `expiring_soon` is shown when the access token is within 7 days of expiry, or the refresh token is within 30 days of `refreshTokenExpiresAt`. | Token lifecycle |
| BR5 | `invalid_grant` during refresh is classified `expired` when `now > refreshTokenExpiresAt`; otherwise `revoked`. | Token lifecycle |
| BR6 | Disconnect calls LinkedIn's revoke endpoint preferring the refresh token; non-200 responses are logged at WARN and do not block credential erasure. | Disconnect |
| BR7 | The scheduler rejects any poll interval below 3600 seconds unless `linkedin.org.enabled === true` and the tenant has a verified partner-tier flag. | Scheduling |
| BR8 | Only normalized `SocialPost` and `Author` data may be retained; raw LinkedIn JSON is held in memory only during `normalize()`. | Data retention |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| LinkedIn OAuth authorize/token endpoint | Outbound (system → LinkedIn) | Authorization-code exchange, token refresh | HTTPS / OAuth 2.0 |
| LinkedIn REST API v2 / Community Management API | Outbound (system → LinkedIn) | Post/engagement polling | HTTPS REST / JSON, Rest.li headers |
| LinkedIn OAuth revoke endpoint | Outbound (system → LinkedIn) | Best-effort grant revocation on disconnect | HTTPS / OAuth 2.0 |
| Azure Key Vault | Internal | Envelope encryption of access/refresh tokens | ADR-0014/ADR-0028 |
| `RequestGate` (ADR-0003) | Internal | Tenant-scoped rate-limit and concurrency gating | In-process |
| Tier-3 poll scheduler | Internal | Enforces 1-hour polling guardrail, invokes `poll()` | In-process scheduling |
| `ConnectorHealth` service (ADR-0009) | Internal | Derives health from `IngestionRun` and token-lifecycle events | In-process |
| Watchdog reconciliation (ADR-0070) | Internal | Alerts on `reconnect_required`/stalled state | In-process / event |
| Postgres RLS (ADR-0015) | Internal | Tenant isolation for credentials, posts, `IngestionRun` | Database |
| `social-listening-admin` connectors/status/feed UI | Internal (upstream consumer) | Renders connect flow, health, feed, drawer | Internal API / React components |

---

## 10. Non-Functional Considerations

- **Performance:** 1-hour polling guardrail and `RequestGate` integration bound outbound call volume within LinkedIn's per-member and per-endpoint quotas.
- **Security / access control:** Tokens envelope-encrypted (Azure Key Vault), never exposed to browser JS; confidential-client `client_secret` never leaves the server; tenant-scoped `state` prevents cross-tenant CSRF.
- **Scalability:** Tenant-scoped `RequestGate` and scheduler guardrails scale independently per `(tenantId, 'linkedin')` without cross-tenant contention.
- **Reliability / availability:** Automatic refresh-before-401 behavior, exponential backoff with jitter on `429`/`5xx`, and `IngestionRun` audit records for every attempt (including queued/rate-limited ones) keep health derivation accurate under transient failure.
- **Audit and logging:** `IngestionRun` records every poll attempt; revoke failures logged at WARN (not ERROR) per the non-blocking disconnect design; `ConnectorIngestionAlertEvent` provides an auditable `reconnect_required` trail.
- **Compliance / privacy:** No raw API payload retention beyond `normalize()`; explicit OAuth consent; tenant-scoped GDPR erasure on disconnect; Postgres RLS isolation of all LinkedIn-derived data.
- **Accessibility:** Status-screen badges and post feed/drawer follow the admin UI's existing accessibility patterns (not newly introduced by this connector).
- **Localization / internationalization:** No connector-specific localization requirements beyond the admin UI's existing i18n handling.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| `401` access token expired | No visible error (transparent refresh) | `refreshToken()` invoked automatically; request retried on success |
| `401` / `invalid_grant`, `now > refreshTokenExpiresAt` | "LinkedIn account needs to be reconnected" | `credentialStatus = 'expired'`; `reconnect_required`; alert emitted |
| `401` / `invalid_grant`, `now <= refreshTokenExpiresAt` | "LinkedIn account needs to be reconnected" | `credentialStatus = 'revoked'`; `reconnect_required`; alert emitted |
| `403` missing organization scope | "Organization features unavailable — partner scope approval pending." | Affected feature degrades gracefully; connector remains `healthy` |
| `429` Too Many Requests | No user-facing error (transparent retry) | Backoff per `Retry-After`/`x-restli-gateway-ratelimit-reset`; no credential change |
| `5xx` Server Error | No user-facing error (transparent retry) | Exponential backoff with jitter |
| Malformed query/payload | Ingestion run marked failed on status screen | Error logged, run halted, failure surfaced to admin |
| Sub-1-hour poll interval requested without partner verification | Configuration rejected with validation error | Scheduler refuses to accept the interval |
| Disconnect revoke call fails/non-200 | Disconnect still completes | Logged at WARN; credential erased; data deletion enqueued regardless |

---

## 12. Assumptions and Dependencies

- Social Engage holds a LinkedIn Marketing Developer Platform app with a confidential client `client_id`/`client_secret`.
- Azure Key Vault and the existing credential envelope-encryption service remain available (ADR-0014).
- The `SocialConnector` framework, `RequestGate`, poll scheduler, and `IngestionRun` audit mechanisms are already in place (ADR-0002, ADR-0003, ADR-0005).
- A Tenant Admin or appropriately-roled user can consent to LinkedIn OAuth scopes.
- Depends on: ADR-0002 (`SocialConnector` interface), ADR-0003 (`RequestGate`), ADR-0009 (connector health derivation), ADR-0010 (error handling/auto-disable), ADR-0014/ADR-0028 (credential encryption), ADR-0015 (tenant isolation/RLS), ADR-0018 (data retention), ADR-0070 (watchdog reconciliation & alerts).
- Story 2.25 depends on Story 2.1 (unified connector interface), Story 2.2 (rate-limiting request gate), Story 1.16/ADR-0070 (watchdog reconciliation & alerts).
- Story 6.35 depends on Story 2.25 (backend), Story 6.3 (connector connect/disconnect), Story 6.5 (connector status view), Story 6.14 (post feed client).
- LinkedIn outbound publishing (`publish()`, Story 2.30) is a related but separately-governed capability (ADR-0075) and is explicitly out of scope for this FDD.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should the platform pursue LinkedIn Marketing Developer Partner Programme approval proactively, or wait for tenant demand before requesting organization scopes? | Product Owner | Before first tenant requests company-page coverage |
| Q2 | Should sub-hour polling ever be offered even to partner-verified tenants, given LinkedIn's per-member daily quota risk? | Technical Lead | When first partner-tier tenant is onboarded |

---

## 14. Appendix

### Glossary

See BRD-0069 §15 for the full glossary (Confidential-client OAuth 2.0, Rest.li, `RequestGate`, `IngestionRun`, `SocialConnector`, `refreshTokenExpiresAt`, `invalid_grant`).

### Reference links

- [ADR-0069: LinkedIn Connector](../../adr/0069-linkedin-connector.md)
- [BRD-0069-LinkedIn-Connector.md](../Business-Requirements/BRD-0069-LinkedIn-Connector.md)
- [docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) — Story 2.25
- [docs/user-stories/epic-6-tenant-admin-ui.md](../../user-stories/epic-6-tenant-admin-ui.md) — Story 6.35
- [docs/user-stories/README.md](../../user-stories/README.md) — Epic index
- [docs/product-research/feature-designs/01-multi-source-ingestion.md](../../product-research/feature-designs/01-multi-source-ingestion.md) — general multi-source ingestion context (LinkedIn named only as a v2 candidate; predates and is superseded by ADR-0069)
- Related ADRs: ADR-0002 (connector interface), ADR-0003 (rate limiting), ADR-0009 (health derivation), ADR-0010 (error classification/auto-disable), ADR-0014/ADR-0028 (credential encryption), ADR-0015 (tenant isolation), ADR-0018 (data retention), ADR-0070 (watchdog reconciliation & alerts)

### Feature-design / research cross-reference

No dedicated `docs/product-research/feature-designs/` or `docs/product-research/reports/` file specifically covers the LinkedIn connector. The BRD itself notes no dedicated LinkedIn deep-research brief was found in `docs/product-research/reports/`; this FDD, like the BRD, relies on ADR-0069 and the implementation stories as the primary sources.

### Diagrams

None supplied; see Section 6.3 for the textual connect, ingestion, and disconnect workflow steps.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | FDD Writer (regenerated) | Regenerated from ADR-0069 and BRD-0069 to replace a defective batch-generated FDD (wrong H1 and flat BR-table-only Section 5) with a genuine per-capability functional design. |
