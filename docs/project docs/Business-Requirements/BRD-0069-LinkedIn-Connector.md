# Business Requirements Document — LinkedIn Connector

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Social Engage – LinkedIn Connector Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-20 |
| Author(s) | Menno Drescher |
| Approver(s) | Menno Drescher |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-20 | Menno Drescher | Initial draft from ADR-0069 and related stories |
| 1.0 | 2026-08-20 | Menno Drescher | Approved for implementation |

---

## 2. Executive Summary

LinkedIn is a primary channel for professional and B2B social engagement. Today, Social Engage has no native LinkedIn integration; tenants must monitor professional conversations, company pages, and employee advocacy outside the platform, fragmenting the listening workflow and limiting the value of the unified dashboard.

This initiative adds a LinkedIn `SocialConnector` to `social-listening-core` and the matching setup, status, and post-feed experience in `social-listening-admin`. The connector will use a server-side, confidential-client OAuth 2.0 flow, proactively manage 60-day access and one-year refresh token lifecycles, enforce LinkedIn Rest.li rate limits through the existing `RequestGate`, poll at a safe one-hour cadence, and gracefully degrade when LinkedIn Marketing Developer Partner Programme organization scopes are not yet approved.

The expected business value is a single, tenant-isolated, GDPR-compliant view of LinkedIn posts and engagement inside Social Engage, reducing the need for third-party aggregators and protecting customer credentials through platform-controlled envelope encryption.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Expand Social Engage coverage to professional/B2B audiences through native LinkedIn ingestion | LinkedIn connector is available in the tenant connector grid and completes OAuth connection within one session |
| 2 | Eliminate reliance on third-party aggregators for LinkedIn data | 100% of LinkedIn ingest traffic uses the platform-managed credential and connector flow |
| 3 | Maintain GDPR and platform-terms compliance for OAuth data and retention | No raw LinkedIn API payloads are retained; disconnect triggers tenant-scoped data deletion; audit pass |
| 4 | Provide reliable, predictable LinkedIn ingestion with transparent health and token status | Connector health and token-expiry badges are accurate and surfaced on the status screen |
| 5 | Protect operational stability with safe, rate-limited, scheduler-enforced polling | No tenant exceeds LinkedIn daily rate limits; scheduler rejects sub-one-hour poll intervals outside approved partner scopes |

---

## 4. Scope

### 4.1 In Scope

- Confidential-client OAuth 2.0 authorization-code flow for LinkedIn.
- Tenant-scoped state parameter storage and validation (10-minute TTL).
- Access-token (60 days) and refresh-token (up to one year) lifecycle management with persisted `refreshTokenExpiresAt`.
- Automatic refresh before surfacing 401 errors and deterministic `invalid_grant` classification (`expired` vs. `revoked`).
- Rest.li rate-limit header parsing and `RequestGate` integration per `(tenantId, 'linkedin')`.
- Scheduler-level minimum one-hour polling guardrail for standard tiers; shorter intervals allowed only when the `linkedin.org.enabled` feature flag and partner-tier verification are both active.
- Standard member scopes (`openid`, `r_liteprofile`, `email`, `r_emailaddress`, `w_member_social`, `r_member_social`) out of the box.
- Optional organization scopes (`w_organization_social`, `r_organization_social`) with graceful degradation when not approved.
- LinkedIn post and author normalization into the canonical `SocialPost` and `Author` data models.
- Best-effort, idempotent OAuth revocation on disconnect; non-blocking if LinkedIn's revoke endpoint is unreachable.
- Tenant-scoped LinkedIn data deletion on disconnect aligned with ADR-0018.
- Admin UI platform definition, OAuth connect/callback, connector status screen, and post feed/drawer presentation.
- `ConnectorHealth` status derivation, `expiring_soon` warnings, and `reconnect_required` alerts.

### 4.2 Out of Scope

- LinkedIn advertising campaign creation or ad analytics.
- Direct-message or InMail monitoring.
- Real-time push webhooks (LinkedIn does not offer them on the standard partner tier).
- Third-party aggregator integrations (e.g., Ayrshare, Buffer).
- Public-client PKCE-only OAuth flow.
- LinkedIn outbound publishing (governed by ADR-0075 / Story 2.30, not this BRD).
- Blocking credential disconnection if token revocation fails.

### 4.3 Assumptions

- Social Engage holds a LinkedIn Marketing Developer Platform app with a confidential client `client_id` and `client_secret`.
- Azure Key Vault and the existing credential envelope-encryption service remain available (ADR-0014).
- The `SocialConnector` framework, `RequestGate`, poll scheduler, and `IngestionRun` audit mechanisms are already in place (ADR-0002, ADR-0003, ADR-0005).
- A Tenant Admin or user with the appropriate role can consent to LinkedIn OAuth scopes.

### 4.4 Constraints

- LinkedIn access tokens expire after 60 days and must be refreshed.
- LinkedIn refresh tokens are valid for up to one year from initial issuance.
- Organization-page scopes require LinkedIn Marketing Developer Partner Programme approval.
- LinkedIn enforces per-member daily post limits and per-endpoint Rest.li call quotas.
- LinkedIn Terms of Service prohibit long-term retention of raw API responses.
- Standard-tier polling is limited to one hour minimum per tenant/connector.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Connects and manages the LinkedIn connector | High | Clear OAuth flow, scope/status visibility, re-sync and disconnect controls |
| Tenant User / Social Listening Analyst | Reviews ingested LinkedIn posts and engagement | High | Accurate, normalized post feed; timely but not overwhelming poll cadence |
| Content Marketer | Uses LinkedIn as a professional publishing/listening channel | Medium | Confidence that company page and personal profiles are covered |
| Compliance / Data Protection Officer | Ensures GDPR and platform-terms adherence | Medium | Consent, encrypted tokens, tenant-scoped erasure, no raw payload retention |
| Platform Administrator | Monitors cross-tenant connector health | Low | Aggregate connector counts, error rates, no tenant data leakage |

---

## 6. Current State (As-Is)

Social Engage ingests public and owned content from RSS, news, tenant-owned feeds, Wikipedia, and Facebook, but LinkedIn is not yet a connected source. As a result:

- Tenants cannot track professional network conversations, personal posts, or company-page activity inside the unified feed.
- Brand and social-selling teams must switch to LinkedIn-native tools or third-party aggregators, increasing manual work and credential exposure.
- There is no mechanism to alert users when LinkedIn OAuth tokens are about to expire or have been revoked.
- Professional/B2B listening coverage is a competitive gap against Sprout Social, Sprinklr, and similar platforms.

---

## 7. Future State (To-Be)

After implementation, a tenant administrator will open the Connectors screen, select LinkedIn, and complete an OAuth consent flow. The backend will store the credential in an envelope-encrypted form, schedule one-hour polls, and begin normalizing LinkedIn posts into the shared post stream.

Expected capabilities:

- LinkedIn appears as a first-class connector with its own platform card, icon, and OAuth setup.
- Posts from connected LinkedIn member profiles (and, when approved, company pages) display in the post feed with author attribution, canonical Markdown body, and engagement counts.
- The connector status screen shows last ingestion attempt, polling cadence, token expiry status, and a non-blocking badge when organization features are pending.
- Token refresh and revocation are handled automatically; disconnect purges the credential and tenant-scoped LinkedIn data.
- Rate limits and polling cadence are enforced without manual oversight, preventing tenant accounts from being throttled.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a tenant user to connect a LinkedIn account via a confidential-client OAuth 2.0 flow. | Must | Authorization URL, state validation, code exchange, and credential persistence are verified by contract tests. | Product Owner |
| BR-002 | The system shall manage LinkedIn access and refresh token lifecycles with persisted `refreshTokenExpiresAt`. | Must | Proactive `expiring_soon` warnings, automatic refresh, and `expired`/`revoked` classification are contract-tested. | Product Owner |
| BR-003 | The system shall parse and enforce LinkedIn Rest.li rate-limit headers through the existing `RequestGate`. | Must | Headers are converted from epoch seconds to milliseconds and live limits override the 100/day baseline. | Product Owner |
| BR-004 | The system shall enforce a one-hour minimum poll interval unless partner-tier scope verification is active. | Must | Tier-3 scheduler rejects `< 3600` second intervals without `linkedin.org.enabled` and verified partner status. | Product Owner |
| BR-005 | The system shall continue member-level ingestion when organization scopes are missing and surface a non-blocking informational badge. | Must | Connector remains healthy; status screen shows the partner-scope-pending notice. | Product Owner |
| BR-006 | The system shall support disconnect and best-effort token revocation with tenant-scoped data deletion. | Must | Revoke call uses refresh token when possible; non-200 responses are logged at WARN and do not block erasure; data purge is enqueued. | Product Owner |
| BR-007 | The system shall normalize LinkedIn API responses into canonical `SocialPost` and `Author` records. | Must | `author.id` is `linkedin:{memberId}`, `author.displayName` is `firstName + ' ' + lastName`; raw payloads are discarded. | Product Owner |
| BR-008 | The system shall display LinkedIn posts in the post feed and detail drawer with provider-specific attribution. | Should | Post card shows LinkedIn badge, author, published time, engagement counts, and detail drawer shows `linkedin:{memberId}` and permalink. | Product Owner |
| BR-009 | The system shall provide on-demand re-sync for authorized users from the connector status screen. | Should | "Re-sync now" button is gated on credential owner or `tenant_admin` role. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All LinkedIn credentials must be stored using platform envelope encryption and never exposed to the browser. | Security | Must | Penetration-style review confirms no raw token material in logs, responses, or client bundles. |
| NFR-002 | LinkedIn-derived data and credentials must be isolated by `tenant_id` using Postgres RLS. | Security | Must | Contract tests prove cross-tenant read attempts are blocked. |
| NFR-003 | Raw LinkedIn API payloads must not be retained beyond immediate operational needs. | Compliance | Must | No raw payload column or log line persists after `normalize()`; audit of `social_posts` table confirms `rawPayload` is not used for LinkedIn. |
| NFR-004 | LinkedIn polling must remain available despite LinkedIn transient errors and rate limits. | Reliability | Should | Retry with exponential backoff and jitter; queued runs create `IngestionRun` records. |
| NFR-005 | Connector health status must be derived from real ingestion runs, not mocked. | Maintainability | Must | `ConnectorHealth` transitions match `IngestionRun` outcomes and token lifecycle events. |
| NFR-006 | The connector must support the standard, self-service member scopes without partner approval. | Usability | Must | OAuth scope list is split into member and organization tiers. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | LinkedIn is a Tier-3 user-credential connector; tenant-wide credential sharing is not allowed for this source. |
| BRU-002 | Organization features (`w_organization_social`, `r_organization_social`) are gated behind the `linkedin.org.enabled` feature flag and verified partner status. |
| BRU-003 | When organization scopes are missing, the connector continues in `healthy` status and displays: "Organization features unavailable — partner scope approval pending." |
| BRU-004 | `expiring_soon` is shown when the access token is within seven days of expiry or the refresh token is within 30 days of `refreshTokenExpiresAt`. |
| BRU-005 | `invalid_grant` during refresh is classified as `expired` when `now > refreshTokenExpiresAt`; otherwise it is classified as `revoked`. |
| BRU-006 | Disconnect calls `https://www.linkedin.com/oauth/v2/revoke` preferring the refresh token; non-200 responses are logged at WARN and do not block credential erasure. |
| BRU-007 | The scheduler rejects any poll interval below 3600 seconds unless `linkedin.org.enabled === true` and the tenant has a verified partner-tier flag. |
| BRU-008 | Only normalized `SocialPost` and `Author` data may be retained; raw LinkedIn JSON is held in memory only during `normalize()`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| LinkedIn OAuth access token | Short-lived 60-day token for API calls | LinkedIn OAuth token endpoint | LinkedIn | Highly sensitive |
| LinkedIn OAuth refresh token | Long-lived token used to refresh access token | LinkedIn OAuth token endpoint | LinkedIn | Highly sensitive |
| `refreshTokenExpiresAt` | ISO 8601 UTC timestamp of refresh token ceiling | Derived at authorization/refresh | Social Engage | Internal |
| `linkedin:oauth:state:{tenantId}:{state}` | Short-lived, tenant-isolated CSRF state key | Social Engage cache | Social Engage | Internal |
| `SocialPost` (LinkedIn) | Normalized post with body, published time, engagement counts | `normalize()` of LinkedIn API response | Social Engage | Tenant data |
| `Author` (LinkedIn) | Normalized author (`linkedin:{memberId}`, display name) | `normalize()` of LinkedIn API response | Social Engage | Personal data |
| `IngestionRun` | Audit record of each LinkedIn poll attempt | Poll scheduler | Social Engage | Internal |
| `ConnectorHealth` / `CredentialStatus` | Derived health and token expiry status | Connector health service | Social Engage | Internal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| LinkedIn ingestion volume | Number of posts ingested per tenant per day | Tenant Admin, Analyst | Daily / Real-time |
| LinkedIn rate-limit saturation | Remaining Rest.li quota and reset time | Platform Admin, Operations | Real-time |
| Connector health transitions | `healthy`, `expiring_soon`, `reconnect_required` counts | Tenant Admin, Operations | Real-time |
| Token refresh success/failure | Track `invalid_grant` `expired` vs. `revoked` classification | Operations | Weekly |
| Disconnect / data erasure completions | Confirm GDPR right-to-erasure execution | Compliance Officer | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | LinkedIn Marketing Developer Partner Programme approval delays or rejects organization-scope requests. | Medium | Medium | Gate organization features behind a feature flag and ship member-level ingestion first. | Product Owner |
| R-002 | Annual one-year refresh-token expiry forces users to re-authenticate. | High | Medium | Surface 30-day and 7-day proactive warnings and provide one-click reconnect. | Product Owner |
| R-003 | One-hour standard polling cadence creates up to one-hour latency for engagement metrics. | High | Medium | Document the constraint; reserve sub-hour cadence for verified partner tiers. | Product Owner |
| R-004 | LinkedIn does not offer push webhooks; real-time reaction tracking is not possible on standard tiers. | High | High | Accept poll-only model; consider future partner-tier real-time options only after explicit scope. | Product Owner |
| R-005 | Rate-limit headers may be inconsistent, causing over- or under-polling. | Low | Medium | Defensive, case-insensitive header parsing with fallbacks and scheduler gating. | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | `SocialConnector` interface and connector registry (ADR-0002) | Internal / Technical | Technical Lead | Already implemented |
| D-002 | `RequestGate` rate-limit framework (ADR-0003) | Internal / Technical | Technical Lead | Already implemented |
| D-003 | Envelope-encrypted credential storage (ADR-0014, ADR-0028) | Internal / Technical | Technical Lead | Already implemented |
| D-004 | Tenant-scoped data retention and deletion (ADR-0018) | Internal / Technical | Technical Lead | Already implemented |
| D-005 | Postgres RLS and tenant isolation (ADR-0015) | Internal / Technical | Technical Lead | Already implemented |
| D-006 | Connector health derivation and watchdog alerts (ADR-0009, ADR-0070) | Internal / Technical | Technical Lead | Already implemented |
| D-007 | Error classification and auto-disable (ADR-0010) | Internal / Technical | Technical Lead | Already implemented |
| D-008 | LinkedIn REST API v2 / Community Management API | External | Product Owner | LinkedIn app + partner registration |
| D-009 | Story 2.25 — LinkedIn connector backend implementation | Internal | Development Team | Implemented |
| D-010 | Story 6.35 — LinkedIn Admin UI setup, status, and feed | Internal | Development Team | Implemented |

---

## 14. Acceptance Criteria

1. A tenant can complete the LinkedIn OAuth flow, and the credential is stored with `refreshTokenExpiresAt` initialized to `now + 365 days`.
2. The connector polls at most once per hour per `(tenantId, 'linkedin')`, and the scheduler rejects `< 3600` second intervals without partner verification.
3. `parseRateLimitHeaders()` correctly converts `x-restli-gateway-ratelimit-reset` epoch seconds to milliseconds and falls back to generic rate-limit headers.
4. Missing organization scopes do not fail the connector; the status screen displays the partner-scope-pending informational badge.
5. Token refresh is invoked before a 401 is surfaced, and `invalid_grant` is classified as `expired` or `revoked` based on `refreshTokenExpiresAt`.
6. Disconnect calls LinkedIn's revoke endpoint using the refresh token, logs non-200 responses at WARN, erases the credential, and enqueues tenant-scoped data deletion.
7. Ingested LinkedIn posts are normalized to `SocialPost` and `Author` and appear in the post feed with the LinkedIn badge, author attribution, engagement counts, and a detail drawer showing the `linkedin:{memberId}` author ID and permalink.
8. Contract tests in `social-listening-core` and `social-listening-admin` pass for Story 2.25 and Story 6.35.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Confidential-client OAuth 2.0 | A server-side OAuth flow that uses a `client_id` and `client_secret` to exchange an authorization code for tokens. |
| Rest.li | LinkedIn's URI- and header-based API protocol; the LinkedIn gateway returns `x-restli-gateway-ratelimit-*` headers. |
| `RequestGate` | The platform's shared per-tenant, per-provider rate-limit and concurrency gate. |
| `IngestionRun` | An audit record created for every poll attempt, including queued or rate-limited runs. |
| `SocialConnector` | The unified connector interface that Social Engage uses for all social sources. |
| `refreshTokenExpiresAt` | The persisted ISO 8601 UTC timestamp of a LinkedIn refresh token's one-year ceiling. |
| `invalid_grant` | An OAuth error returned when a refresh or authorization code is invalid, used by the connector to distinguish `expired` from `revoked`. |

---

## 16. Appendices

### Appendix A — Reference Documents

- ADR-0069: LinkedIn Connector — `docs/adr/0069-linkedin-connector.md`
- Feature design: Multi-source ingestion — `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Feature design index — `docs/product-research/feature-designs.md`
- No dedicated LinkedIn deep-research brief was found in `docs/product-research/reports/` at the time of writing; this BRD relies on the ADR and the implementation stories.

### Appendix B — Related User Stories

- **Story 2.25** (`docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`) — LinkedIn backend connector: OAuth, token lifecycle, Rest.li rate limiting, and one-hour polling guardrails. Status: Implemented.
- **Story 6.35** (`docs/user-stories/epic-6-tenant-admin-ui.md`) — LinkedIn setup screen, scope degradation badge, and post feed/drawer presentation. Status: Implemented.

### Appendix C — LinkedIn OAuth Scopes

#### Member Scopes (Standard — self-service)

| Scope | Purpose |
|---|---|
| `openid` / `r_liteprofile` | Read member profile, display name, and avatar. |
| `email` / `r_emailaddress` | Member identity verification and account linkage. |
| `w_member_social` | Create, edit, and delete posts on behalf of the member. |
| `r_member_social` | Read post engagement (reactions, comments, impressions) on member posts. |

#### Organization Scopes (Partner-tier — gated)

| Scope | Purpose |
|---|---|
| `w_organization_social` | Publish posts to organization / company pages administered by the member. |
| `r_organization_social` | Read organization page post analytics and follower demographics. |

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno Drescher | | 2026-08-20 |
| Product Owner | Menno Drescher | | 2026-08-20 |
| Technical Lead | Menno Drescher | | 2026-08-20 |
| Other Stakeholder | | | |
