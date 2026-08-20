# ADR-0029: LinkedIn OAuth Account Connection

**Status:** Proposed  
**Date:** 2026-08-19  
**Author:** Menno Drescher  
**Project:** Social Engage  
**Source:** Connector Framework §3 — Social Connector interface (ADR-0002)

---

## Context

Social Engage requires users to connect their social media accounts so the platform can act on their behalf — publishing content, monitoring engagement, responding to comments, and surfacing analytics. LinkedIn is a primary channel for professional audiences and is a prerequisite for the platform's core value proposition.

LinkedIn exposes its capabilities through the LinkedIn Marketing Developer Platform and the LinkedIn REST API (v2), both gated behind OAuth 2.0. Unlike some platforms, LinkedIn enforces strict API partner tiers; certain scopes (e.g. advertising analytics, organization management) require explicit approval from LinkedIn's Partner Programme.

This ADR governs how the LinkedIn connector fits into the established connector architecture. It does not re-decide credential storage mechanics (ADR-0014), rate-limit enforcement (ADR-0003), error handling and auto-disable (ADR-0010), connector health derivation (ADR-0009), tenant isolation (ADR-0015), or data retention (ADR-0018) — those decisions apply here by reference. This ADR decides only what is specific to the LinkedIn integration: the OAuth flow, the scopes, the token lifecycle, and the connector's implementation of the `SocialConnector` interface.

Key constraints driving this decision:

- LinkedIn does not allow long-lived user tokens; access tokens expire after 60 days and must be refreshed using a refresh token (valid for 1 year).
- LinkedIn's API enforces per-member daily limits (e.g. 100 posts/day) and per-endpoint API call quotas that must be tracked per `(tenantId, providerId)` (ADR-0003).
- LinkedIn's Terms of Service prohibit storing raw API responses beyond what is operationally necessary; only derived/aggregated data may be retained long-term (aligned with ADR-0018).
- The integration must comply with GDPR: user authorization is explicit, token storage is encrypted (ADR-0014), and users must be able to revoke access and have their tokens and derived data deleted on request.
- LinkedIn does not offer push webhooks for post engagement on the standard partner tier; this connector is therefore a **poll-mode** connector (`deliveryMode: 'poll'`).

---

## Decision

Social Engage will integrate LinkedIn as a `SocialConnector` implementation under the unified connector pattern (ADR-0002), using OAuth 2.0 Authorization Code Flow with PKCE via the LinkedIn REST API v2.

### 1. Connector interface implementation

The LinkedIn connector implements `SocialConnector` with the following characteristics:

```typescript
const linkedInConnector: SocialConnector = {
  providerId: 'linkedin',
  authMode: 'oauth',
  deliveryMode: 'poll',

  getRateLimitConfig(): RateLimitConfig {
    return {
      strategy: 'fixed-window',
      requestsPerWindow: 100,          // per-member daily post limit
      windowSeconds: 86400,
      supportsLiveHeaders: true,        // LinkedIn returns X-RateLimit-* headers
    };
  },

  parseRateLimitHeaders(headers: Headers): Partial<RateLimitState> {
    // Read X-RateLimit-Remaining and X-RateLimit-Reset; live state
    // takes priority over static config per ADR-0003.
  },

  getAuthUrl(tenantId: string): string { /* generate PKCE challenge, build authorize URL */ },

  async handleAuthCallback(code: string): Promise<Credential> {
    // Exchange code for access_token + refresh_token.
    // Credential stored via envelope encryption in Azure Key Vault (ADR-0014).
  },

  async refreshToken(credential: Credential): Promise<Credential> {
    // Called automatically by the core before surfacing a 401 to the tenant (ADR-0010).
    // On success: update stored credential in Key Vault.
    // On failure: surface credential_status = 'expired'; do not retry blindly.
  },

  async poll(credential: Credential, watchlist: Watchlist): Promise<RawPost[]> {
    // Poll LinkedIn at most once per hour per (tenantId, platformId) to stay within limits.
    // Rate-limit gate enforced by shared RequestGate per ADR-0003.
    // Each poll recorded as an IngestionRun (ADR-0005).
  },

  normalize(raw: RawPost): { post: SocialPost; author: Author } {
    // Map LinkedIn response to platform-internal data model on ingest.
    // Raw payloads are not persisted; only normalized data is stored (ADR-0018).
  },
};
```

### 2. OAuth scopes

Scopes requested at authorization:

| Scope | Purpose |
|---|---|
| `r_liteprofile` | Read member display name and profile image |
| `r_emailaddress` | Identify the member for account linkage |
| `w_member_social` | Create, edit, delete posts on behalf of the member |
| `r_member_social` | Read likes, comments, shares, impressions on member posts |
| `w_organization_social` | Publish to organization pages the member administers |
| `r_organization_social` | Read organization post analytics and follower stats |

Scopes requiring LinkedIn Partner Programme approval (`r_organization_social` beyond basic metrics) are requested at authorization time. The feature set degrades gracefully when a scope is unavailable (see Consequences).

### 3. Token lifecycle and storage

- Tokens are stored via **envelope encryption backed by Azure Key Vault** (ADR-0014). This ADR does not re-specify the storage mechanism; it delegates entirely to ADR-0014.
- The `credentialStatus` field on `ConnectorHealth` (derived per ADR-0009) surfaces `expiring_soon` when the access token is within 7 days of its 60-day expiry, prompting proactive refresh.
- `refreshToken()` is invoked by the core automatically before surfacing a failure to the tenant (ADR-0010). If the refresh token itself has expired (>1 year), the credential status becomes `expired` and the connector auto-disables with a clear reason — the tenant is prompted to re-authorize.
- No LinkedIn credentials or raw tokens are exposed to the client at any point.

### 4. Rate-limit integration

LinkedIn rate limits are enforced per `(tenantId, 'linkedin')` via the shared `RequestGate` (ADR-0003), not globally. Where LinkedIn returns live rate-limit state in response headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`), `parseRateLimitHeaders()` updates the gate's live state, which takes priority over the static declared config. Requests that would exceed the limit are queued and retried after window reset; they are never dropped silently and never counted against the tenant's quota wastefully.

### 5. Error classification (LinkedIn-specific)

Following ADR-0010's retryable / non-retryable split:

| Error | Classification | Response |
|---|---|---|
| `401 Unauthorized` (token expired) | Non-retryable before refresh attempt | Attempt `refreshToken()`; if refresh fails → `failing`, surface to tenant |
| `403 Forbidden` (scope not granted) | Non-retryable | Surface to tenant with scope context; disable affected feature |
| `429 Too Many Requests` | Retryable | Exponential backoff; `RequestGate` updates live state from response headers |
| `5xx` transient | Retryable | Exponential backoff |
| Malformed watchlist | Non-retryable | Surface to tenant immediately |

After the failure threshold (ADR-0023: proportional threshold, not a single global number) is crossed, the connector auto-disables for that tenant. `ConnectorHealth` reflects `disconnected` with a reason; health is never stored separately but derived from `IngestionRun` history (ADR-0009).

### 6. Disconnect and revocation

Disconnect is triggered via the standard `DELETE /connectors/linkedin/disconnect` endpoint (platform API surface). The implementation must:

1. Call `https://www.linkedin.com/oauth/v2/revoke` with the stored access token to revoke the grant at LinkedIn's end.
2. Delete the envelope-encrypted credential from Azure Key Vault (per ADR-0014 and ADR-0028 creation-authority rules for credential lifecycle).
3. Enqueue deletion of derived analytics data per ADR-0018's retention and deletion policy.

This satisfies the GDPR right-to-erasure obligation for LinkedIn-sourced data.

### 7. Data retention

Raw LinkedIn API response payloads must not be stored beyond immediate operational need. On ingest, `normalize()` transforms each response into the platform's internal `SocialPost` / `Author` data model; the raw payload is held only transiently in memory during the ingestion pipeline. Debug logging of raw payloads (if enabled for incident diagnostics) is subject to ADR-0018's purge schedule, not retained as permanent records. Derived analytics data follows ADR-0018's archival and deletion tiers.

### 8. Tenant isolation

All credential storage, rate-limit state, `IngestionRun` records, and `ConnectorHealth` derivation are scoped to the tenant. Postgres row-level security (ADR-0015) ensures no cross-tenant data access. One tenant's failing or rate-limited LinkedIn connector has no effect on any other tenant's ingestion.

---

## Alternatives Considered

**A. Third-party social aggregator (e.g. Ayrshare, Buffer API)**  
Rejected. It introduces a critical dependency on a third-party intermediary that holds tenant tokens outside the platform's security perimeter (contradicting ADR-0014); it increases per-action cost at scale; and it prevents the platform from supporting advanced or custom LinkedIn features as needs evolve.

**B. Browser automation / scraping**  
Rejected categorically — this violates LinkedIn's Terms of Service and would expose tenants to account suspension.

**C. Server-to-server token only (no OAuth)**  
Rejected. The core use cases — publishing on behalf of members, reading member-level engagement — require acting on behalf of individual members, which mandates OAuth per LinkedIn's API requirements.

---

## Consequences

**Positive**

- Full control over the OAuth flow and token lifecycle within Social Engage's own security perimeter; no third-party intermediary holds tokens.
- The LinkedIn connector is a first-class citizen of the unified `SocialConnector` interface (ADR-0002): it benefits from the shared `RequestGate` (ADR-0003), automatic refresh-before-fail (ADR-0010), derived `ConnectorHealth` (ADR-0009), and envelope-encrypted Key Vault storage (ADR-0014) with zero bespoke logic for any of these cross-cutting concerns.
- Enables both member-level and organization-level actions under a single integration.
- Positions the platform for LinkedIn Marketing Partner Programme application, unlocking higher-tier API access and higher rate limits.
- Explicit user consent model (OAuth + PKCE) aligns with GDPR requirements for processing personal data.

**Negative / Risks**

- **LinkedIn partner tier gating.** Some scopes (e.g. deep organization analytics) require partner approval, which is not guaranteed and may delay feature delivery. Mitigation: apply for partner status early; design features behind those scopes to degrade gracefully when unavailable, surfacing a clear in-product explanation rather than a silent error.
- **Token expiry management.** The 60-day access token lifecycle requires a reliable proactive-refresh mechanism. A missed refresh breaks the tenant's connection silently. Mitigation: `credentialStatus: 'expiring_soon'` is surfaced 7 days before expiry (ADR-0009); proactive refresh runs on a background schedule; if the refresh fails, the tenant is notified and prompted to re-authorize before the connector auto-disables.
- **Refresh token expiry.** The 1-year refresh token expiry means a tenant who has not used LinkedIn features for a year will need to re-authorize. Mitigation: surface a warning via `credentialStatus: 'expiring_soon'` as the 1-year mark approaches; document the re-authorization flow clearly in the tenant-facing UI.
- **Rate limits.** LinkedIn enforces per-member daily limits. Mitigation: the shared `RequestGate` enforces limits per `(tenantId, 'linkedin')` (ADR-0003); live header state takes priority over static config; tenants receive clear UI feedback when limits are approached or hit.
- **API versioning.** LinkedIn has historically deprecated API versions with limited notice. Mitigation: pin to versioned endpoints; subscribe to LinkedIn's developer changelog; the `normalize()` adapter layer isolates business logic from raw API shape changes.
- **No push webhooks.** On the standard partner tier LinkedIn does not offer webhooks for post engagement. Polling is capped at once per hour per `(tenantId, 'linkedin')` to stay within rate limits, which means engagement data has up to 1-hour latency. Mitigation: document the latency clearly; re-evaluate when LinkedIn webhook access becomes available through the Partner Programme.
- **Data retention compliance.** Raw API payloads must not be stored long-term per LinkedIn's ToS. Mitigation: `normalize()` transforms on ingest; raw payloads are transient; debug logs are subject to ADR-0018's purge schedule.

---

## Implementation Notes

- Redirect URI must be registered in the LinkedIn Developer App dashboard and match exactly the value sent in the OAuth authorize request.
- PKCE code verifier and challenge must be generated per-request; the code verifier must not be logged or stored persistently.
- The `handleAuthCallback()` implementation must validate the `state` parameter to prevent CSRF.
- LinkedIn's `r_liteprofile` scope returns `localizedFirstName`, `localizedLastName`, and `profilePicture`; map these to the platform's `Author` record (ADR-0004: Author normalized separately from Post).
- Poll frequency: default once per hour per `(tenantId, 'linkedin')`; configurable down to once per 15 minutes if the tenant's LinkedIn partner tier allows higher limits (gate this behind a feature flag until partner status is confirmed).
- `IngestionRun` records (ADR-0005) are created for every poll attempt — successful or not — and are the sole source of truth for `ConnectorHealth` derivation (ADR-0009).
- Service Bus events emitted after successful normalization follow ADR-0012 (thin events: IDs and minimal fields only; full post data fetched via REST on demand) and ADR-0019 (event schema versioning).

---

## Relation to Other ADRs

| ADR | Relation |
|---|---|
| ADR-0002 | LinkedIn connector implements `SocialConnector`; `authMode: 'oauth'`, `deliveryMode: 'poll'` |
| ADR-0003 | Rate limits enforced per `(tenantId, 'linkedin')` via `RequestGate`; live header state preferred |
| ADR-0004 | `Author` normalized once from `r_liteprofile`; not duplicated per post |
| ADR-0005 | Every poll attempt recorded as an `IngestionRun` |
| ADR-0009 | `ConnectorHealth` derived from `IngestionRun` history; `credentialStatus` lives on `Credential` |
| ADR-0010 | LinkedIn-specific error classification table above; refresh-before-fail; auto-disable after threshold |
| ADR-0012 | Post-ingest events are thin; full data fetched via REST |
| ADR-0014 | Token storage via envelope encryption in Azure Key Vault; this ADR does not re-specify storage |
| ADR-0015 | Tenant isolation via Postgres RLS applies to all LinkedIn-sourced records |
| ADR-0018 | Raw payloads transient; derived data follows archival/deletion tiers |
| ADR-0019 | Events emitted after normalization follow schema versioning policy |
| ADR-0023 | Proportional failure threshold governs when the LinkedIn connector auto-disables |
| ADR-0028 | Credential creation authority check precedes storage; revocation follows credential lifecycle rules |

---

## References

- [LinkedIn OAuth 2.0 Authorization Code Flow (Microsoft Learn)](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn Marketing Developer Platform](https://learn.microsoft.com/en-us/linkedin/marketing/)
- [LinkedIn API Rate Limits](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits)
- [LinkedIn Partner Programme](https://business.linkedin.com/marketing-solutions/marketing-partners)
- ADR-0002: Unified Provider Connector Pattern
- ADR-0003: Per-tenant per-provider rate limiting
- ADR-0005: IngestionRun as audit anchor
- ADR-0009: ConnectorHealth derived not stored
- ADR-0010: Error handling and auto-disable policy
- ADR-0014: Credential storage envelope encryption
- ADR-0018: Data retention and archival policy
- ADR-0023: Proportional connector failure threshold
- ADR-0028: Credential creation authority