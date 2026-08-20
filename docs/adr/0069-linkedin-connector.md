# ADR-0069: LinkedIn Connector (`linkedin`) — OAuth 2.0 Account Connection, Token Lifecycle, and Ingestion Architecture

**Status:** Accepted (2026-08-20)  
**Date:** 2026-08-19 (Revised and Accepted 2026-08-20)  
**Author:** Menno Drescher  
**Project:** Social Engage  
**Source:** Connector Framework §3 — Social Connector interface (ADR-0002)

---

## Context

Social Engage requires users to connect their social media accounts so the platform can act on their behalf — publishing content, monitoring engagement, responding to comments, and surfacing analytics. LinkedIn is a primary channel for professional audiences and is a prerequisite for the platform's core value proposition.

LinkedIn exposes its capabilities through the LinkedIn Marketing Developer Platform and the LinkedIn REST API (v2 / Community Management API), gated behind OAuth 2.0. Unlike open platforms, LinkedIn enforces strict API partner tiers; certain scopes (e.g. organization page management, deep analytics) require explicit approval from LinkedIn's Partner Programme.

This ADR governs how the LinkedIn connector fits into the established connector architecture. It does not re-decide credential storage mechanics (ADR-0014), rate-limit enforcement (ADR-0003), error handling and auto-disable (ADR-0010), connector health derivation (ADR-0009), tenant isolation (ADR-0015), or data retention (ADR-0018) — those decisions apply here by reference. This ADR decides the LinkedIn-specific integration: the OAuth flow, scopes, token lifecycle, error classification, scheduler guardrails, and connector implementation of the `SocialConnector` interface.

### Key Constraints

- **Token Lifecycle:** LinkedIn access tokens expire after 60 days and must be refreshed using a refresh token (valid for up to 1 year from initial issuance).
- **Rate Limits & Quotas:** LinkedIn enforces per-member daily limits (e.g. 100 posts/day) and per-endpoint Rest.li API call quotas that must be tracked per `(tenantId, providerId)` (ADR-0003).
- **Data Retention & Privacy:** LinkedIn Terms of Service prohibit storing raw API responses beyond immediate operational needs; only normalized/derived data may be retained long-term (aligned with ADR-0018).
- **GDPR Compliance:** User authorization is explicit, token storage is envelope-encrypted (ADR-0014), and users must be able to disconnect, revoke access, and have tenant-scoped LinkedIn-derived data deleted on request.
- **Poll Mode Delivery:** LinkedIn does not offer push webhooks for post engagement on the standard partner tier; this connector operates strictly in **poll mode** (`deliveryMode: 'poll'`).

---

## Decision

Social Engage will integrate LinkedIn as a `SocialConnector` implementation under the unified connector pattern (ADR-0002), using the **OAuth 2.0 Authorization Code Flow (confidential client)** using `client_id` and `client_secret` via the LinkedIn REST API v2.

### 1. Connector Interface Implementation

The LinkedIn connector implements `SocialConnector` with the following characteristics:

```typescript
const linkedInConnector: SocialConnector = {
  providerId: 'linkedin',
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig(): RateLimitConfig {
    return {
      strategy: 'fixed-window',
      requestsPerWindow: 100,          // conservative per-member daily post limit baseline
      windowSeconds: 86400,
      supportsLiveHeaders: true,        // LinkedIn returns Rest.li rate limit headers
      minPollIntervalSeconds: 3600,     // strict baseline: at most once per hour
    };
  },

  parseRateLimitHeaders(headers: Headers): Partial<RateLimitState> {
    // Defensively and case-insensitively parse LinkedIn Rest.li gateway headers first:
    // 1. 'x-restli-gateway-ratelimit-remaining' (fallback: 'x-ratelimit-remaining')
    // 2. 'x-restli-gateway-ratelimit-reset' (epoch seconds; converted to epoch ms)
    // 3. 'x-restli-gateway-ratelimit-limit' (fallback: 'x-ratelimit-limit')
    // Live header state dynamically overrides static config per ADR-0003.
  },

  getAuthUrl(tenantId: string, state: string): string {
    // Build authorize URL with cryptographically secure, tenant-scoped state parameter
  },

  async handleAuthCallback(code: string, state: string): Promise<Credential> {
    // Validate state from tenant-scoped cache (TTL 10m, CSRF prevention).
    // Exchange authorization code for access_token + refresh_token via confidential client flow.
    // Store credential with explicit refreshTokenExpiresAt via envelope encryption in Azure Key Vault (ADR-0014, ADR-0028).
  },

  async refreshToken(credential: Credential): Promise<Credential> {
    // Invoked automatically by core before surfacing a 401 (ADR-0010).
    // On success: updates access_token. If LinkedIn returned a new refresh_token,
    // updates refresh_token and its refreshTokenExpiresAt (+365 days); otherwise retains existing refresh_token.
    // On failure: evaluates stored refreshTokenExpiresAt to classify as 'expired' or 'revoked'; halts blind retries.
  },

  async poll(credential: Credential, watchlist: Watchlist): Promise<RawPost[]> {
    // Poll LinkedIn at most once per hour per (tenantId, 'linkedin').
    // Higher frequencies (down to 15m) are strictly gated behind partner status verification
    // and the `linkedin.org.enabled` feature flag.
    // Rate-limit gate enforced by shared RequestGate per ADR-0003.
    // Each poll attempt (including rate-limited queued runs) is recorded as an IngestionRun (ADR-0005).
  },

  normalize(raw: RawPost): { post: SocialPost; author: Author } {
    // Map LinkedIn response to platform-internal data model on ingest.
    // Raw payloads are transient and not stored permanently (ADR-0018).
  },
};
```

---

### 2. OAuth Scopes & Graceful Degradation

Scopes are structured into two distinct tiers:

#### A. Member Scopes (Standard Tier — Self-Service)
Available immediately upon app creation for member-level publishing and analytics:

| Scope | Purpose |
|---|---|
| `openid` / `r_liteprofile` | Read member profile, display name, and avatar |
| `email` / `r_emailaddress` | Member identity verification and account linkage |
| `w_member_social` | Create, edit, and delete posts on behalf of the member |
| `r_member_social` | Read post engagement (reactions, comments, impressions) on member posts |

#### B. Organization Scopes (Partner Tier — Gated)
Requires approved access under LinkedIn's Marketing Developer Partner Programme:

| Scope | Purpose |
|---|---|
| `w_organization_social` | Publish posts to organization / company pages administered by the member |
| `r_organization_social` | Read organization page post analytics and follower demographics |

#### Graceful Scope Degradation
Organization-level features are gated behind the `linkedin.org.enabled` feature flag. If organization scopes are not granted (e.g. partner approval pending), the connector continues operating normally for member-level posts and surfaces a non-blocking informational status in the Admin UI:
> *"Organization features unavailable — partner scope approval pending."*

The connector remains in `healthy` status and does not fail.

---

### 3. Token Lifecycle, Refresh, and State Parameter Isolation

- **State Parameter Storage & Tenant Isolation:**
  - The `state` parameter is generated as a cryptographically secure 32-byte hex string.
  - Stored server-side in a short-lived, tenant-isolated cache key: `linkedin:oauth:state:{tenantId}:{state}` with a strict **TTL of 10 minutes**.
  - On callback, the backend validates that the `state` key exists, verifies that the callback context's `tenantId` matches the key's tenant segment (preventing cross-tenant CSRF attacks), and immediately invalidates/deletes the key.
- **Envelope Encryption Storage:** Tokens are encrypted with a tenant-scoped Data Encryption Key (DEK) backed by Azure Key Vault Key Encryption Key (KEK) per ADR-0014. No raw tokens are exposed to client browsers.
- **Refresh Token Expiry Persistence (`refreshTokenExpiresAt`):**
  - An explicit `refreshTokenExpiresAt` timestamp (ISO 8601 UTC) is persisted in the credential metadata.
  - On initial authorization, it is set to `now + 365 days`.
  - When invoking `refreshToken()`, LinkedIn returns a new `access_token` (60 days) and **may or may not** return a new `refresh_token`.
  - If a new `refresh_token` is present in the response, it is stored and `refreshTokenExpiresAt` is updated to `now + 365 days`. If absent, the existing `refresh_token` and its existing `refreshTokenExpiresAt` are retained.
- **Proactive Warnings on `ConnectorHealth`:**
  - `credentialStatus: 'expiring_soon'` is surfaced when the access token is within **7 days** of its 60-day expiry (triggering proactive background refresh).
  - `credentialStatus: 'expiring_soon'` is surfaced when the refresh token is within **30 days** of its `refreshTokenExpiresAt` date (prompting the tenant administrator to re-authenticate).
- **Deterministic `invalid_grant` Classification:**
  - When token refresh returns an `invalid_grant` error from LinkedIn:
    - If `now > refreshTokenExpiresAt`: set `credentialStatus = 'expired'` with reason `"Refresh token expired (>1 year)"`.
    - If `now <= refreshTokenExpiresAt`: set `credentialStatus = 'revoked'` with reason `"Authorization revoked by user or password changed"`.
  - Transitions connector health to `reconnect_required` (ADR-0070), halts blind retries, and emits `ConnectorIngestionAlertEvent`.

---

### 4. Rate-Limit Integration & Rest.li Header Parsing

- **Tenant-Scoped Rate Limiting:** Enforced per `(tenantId, 'linkedin')` via the shared `RequestGate` (ADR-0003).
- **Rest.li Header Extraction & Epoch Units:**
  - `parseRateLimitHeaders()` parses headers defensively and case-insensitively in the following priority order:
    1. Limit: `x-restli-gateway-ratelimit-limit` (fallback: `x-ratelimit-limit`)
    2. Remaining: `x-restli-gateway-ratelimit-remaining` (fallback: `x-ratelimit-remaining`)
    3. Reset: `x-restli-gateway-ratelimit-reset` (fallback: `x-ratelimit-reset`)
  - **Reset Unit Conversion:** `x-restli-gateway-ratelimit-reset` is returned by LinkedIn in **epoch seconds**. The parser explicitly converts this to epoch milliseconds (`resetEpochSeconds * 1000`) before computing backoff delays.
- **Dynamic Override & Queuing:** Live header state dynamically overrides the conservative baseline (`100 requests/day`). Requests encountering rate limits are queued until reset rather than dropped.

---

### 5. Polling Frequency Guardrails & Scheduler-Level Enforcement

- **Default Cadence:** Polling executes at most **once per hour** (`minPollIntervalSeconds = 3600`) per `(tenantId, 'linkedin')`.
- **Scheduler-Level Enforcement:**
  - Guardrails are enforced at the **scheduler level** in `social-listening-core` (not merely advisory config).
  - The Tier-3 poll scheduler strictly rejects any requested interval < 3600 seconds with a validation error unless:
    1. `linkedin.org.enabled === true` feature flag is active.
    2. The tenant possesses a verified partner-tier flag with elevated API quotas.
- **Audit Tracking:** Every poll attempt (including rate-limited or queued runs) creates an `IngestionRun` record (ADR-0005) so `ConnectorHealth` derivation (ADR-0009) remains mathematically accurate.

---

### 6. Error Classification (LinkedIn-Specific)

| Error Code / Condition | Classification | Behavior & Lifecycle Action |
|---|---|---|
| `401 Unauthorized` (access token expired) | Transient before refresh | Invokes `refreshToken()`. If refresh succeeds, retries request. If refresh fails, evaluates `refreshTokenExpiresAt` and marks `reconnect_required` |
| `401 Unauthorized` / `invalid_grant` | Non-retryable | Classifies as `revoked` or `expired` via `refreshTokenExpiresAt`; enters `reconnect_required` (ADR-0070) |
| `403 Forbidden` (scope missing) | Non-retryable | Gracefully degrades affected feature; surfaces informational badge |
| `429 Too Many Requests` | Retryable | Parses `Retry-After` or `x-restli-gateway-ratelimit-reset` (epoch seconds); exponential backoff with jitter |
| `5xx Server Error` | Retryable | Exponential backoff with jitter |
| Malformed query / payload | Non-retryable | Logs error, halts run, surfaces failure to admin |

---

### 7. Disconnect, Best-Effort Revocation, and GDPR Deletion

When a tenant disconnects LinkedIn (`DELETE /connectors/linkedin/disconnect`):

1. **Refresh-Token-Preferred Revocation:**
   - The backend calls `https://www.linkedin.com/oauth/v2/revoke` passing the **stored refresh token** (or access token if refresh token is unavailable). Refresh tokens remain valid even if the 60-day access token has expired, ensuring reliable grant revocation.
   - Revocation is treated as **best-effort and idempotent**: if revocation returns a non-200 response, it is logged at `WARN` level (not `ERROR`) and **does not block** disconnection.
2. **Credential Erasure:** The envelope-encrypted credential is deleted from the database and Azure Key Vault (ADR-0014, ADR-0028).
3. **Tenant-Scoped Data Deletion:** Enqueues deletion of tenant-scoped LinkedIn-sourced `SocialPost` and `Author` records per ADR-0018's GDPR right-to-erasure retention policy.

---

### 8. Data Retention & Tenant Isolation

- **Transient Raw Payloads:** Raw LinkedIn API responses are held only in memory during the ingestion pipeline; `normalize()` extracts normalized `SocialPost` / `Author` entities. Raw JSON payloads are discarded (ADR-0018).
- **Postgres Row-Level Security (RLS):** All LinkedIn records, credentials, and `IngestionRun` entries are isolated by `tenant_id` (ADR-0015).

---

## Consequences

### Positive

- **Direct Enterprise Integration:** Provides native LinkedIn connection without third-party aggregator dependencies (Ayrshare, Buffer).
- **Tier-3 Architecture Alignment:** Integrates seamlessly with `SocialConnector` (ADR-0002), `RequestGate` (ADR-0003), derived health (ADR-0009), error classification (ADR-0010), and watchdog alerts (ADR-0070).
- **Robust Token Management:** Handles 60-day access token refresh, conditional 1-year refresh token retention with persisted `refreshTokenExpiresAt`, and precise `revoked` vs. `expired` reason tracking.
- **Fail-Safe Disconnection:** Refresh-token-preferred revocation with non-blocking error logging ensures tenants never become stuck if tokens are already expired.
- **Graceful Partner Scope Degradation:** Standard member features work out of the box; missing organization scopes do not fail the connector.
- **GDPR Compliant:** Envelope-encrypted storage, explicit OAuth consent, and clean tenant-scoped data purging on disconnect.

### Negative / Risks

- **Partner Programme Requirements:** Deep company page analytics require Partner Programme vetting; org features are gated behind `linkedin.org.enabled`.
- **1-Year Re-Authentication:** Tenants must re-authenticate annually when the refresh token expires.
- **1-Hour Ingestion Cadence:** Standard rate limits restrict polling to 1-hour intervals, introducing up to 1-hour latency for engagement metrics.
- **No Push Webhooks:** Lacks real-time push events for post engagement on standard tiers.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Third-Party Aggregator (Ayrshare, Buffer)** | **Rejected.** Exposes credentials outside the platform perimeter (violating ADR-0014) and limits custom feature flexibility. |
| **Web Scraping / Browser Automation** | **Rejected.** Violates LinkedIn Terms of Service; risks tenant account suspension. |
| **Public Client PKCE Only** | **Rejected.** Backend is a secure server-side confidential client; uses standard confidential client flow with `client_secret`. |
| **Blocking Disconnect on Revoke Failure** | **Rejected.** If tokens have expired or LinkedIn's revoke endpoint fails, tenants would be unable to disconnect their accounts. |

---

## Resolved Questions

1. **OAuth Client Type:** Server-side confidential client flow using `client_id` and `client_secret`.
2. **State Parameter Isolation:** Stored in tenant-scoped cache key (`linkedin:oauth:state:{tenantId}:{state}`) with 10-minute TTL.
3. **Refresh Token Expiry:** Persists `refreshTokenExpiresAt` (ISO 8601 UTC) and surfaces 30-day re-auth warnings.
4. **`invalid_grant` Classification:** Evaluates `now > refreshTokenExpiresAt` to distinguish `expired` vs. `revoked`.
5. **Revocation Semantics:** Prefers refresh token; best-effort and non-blocking with WARN-level logging on failure.
6. **Header Parsing & Units:** Defensively parses Rest.li gateway headers (`x-restli-gateway-ratelimit-*`), converting reset epoch seconds to milliseconds.
7. **Polling Guardrails:** Enforced at the scheduler level (1h minimum baseline; <1h gated by `linkedin.org.enabled` and partner status).
8. **Scope Degradation:** Missing org scopes surface a non-blocking info notice while keeping member features healthy.

---

*Accepted 2026-08-20 by Menno with confidential client OAuth, tenant-scoped state caching (10m TTL), persisted `refreshTokenExpiresAt`, refresh-token-preferred revocation, scheduler-enforced 1-hour polling guardrail, Rest.li epoch seconds conversion, and graceful scope degradation.*
