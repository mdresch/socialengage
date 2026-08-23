# Business Requirements Document — LinkedIn Connector

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — LinkedIn Connector |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0069-linkedin-connector.md, ../Business-Requirements/BRD-0069-LinkedIn-Connector.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0069-linkedin-connector.md and the business requirements in BRD-0069-LinkedIn-Connector.md into functional design for **LinkedIn Connector**.
LinkedIn is a primary channel for professional and B2B social engagement. Today, Social Engage has no native LinkedIn integration; tenants must monitor professional conversations, company pages, and employee advocacy outside the platform, fragmenting the listening workflow and limiting the value of the unified dashboard.

This initiative adds a LinkedIn `SocialConnector` to `social-listening-core` and the matching setup, status, and post-feed experience in `social-listening-admin`. The connector will use a server-side, confidential-client OAuth 2.0 flow, proactively manage 60-day access and one-year refresh token lifecycles, enforce LinkedIn Rest.li rate limits through the existing `RequestGate`, poll at a safe one-hour cadence, and gracefully degrade when LinkedIn Marketing Developer Partner Programme organization scopes are not yet approved.

The expected business value is a single, tenant-isolated, GDPR-compliant view of LinkedIn posts and engagement inside Social Engage, reducing the need for third-party aggregators and protecting customer credentials through platform-controlled envelope encryption.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- LinkedIn advertising campaign creation or ad analytics.
- Direct-message or InMail monitoring.
- Real-time push webhooks (LinkedIn does not offer them on the standard partner tier).
- Third-party aggregator integrations (e.g., Ayrshare, Buffer).
- Public-client PKCE-only OAuth flow.
- LinkedIn outbound publishing (governed by ADR-0075 / Story 2.30, not this BRD).
- Blocking credential disconnection if token revocation fails.

## 3. Context and Background
Social Engage requires users to connect their social media accounts so the platform can act on their behalf — publishing content, monitoring engagement, responding to comments, and surfacing analytics. LinkedIn is a primary channel for professional audiences and is a prerequisite for the platform's core value proposition.

LinkedIn exposes its capabilities through the LinkedIn Marketing Developer Platform and the LinkedIn REST API (v2 / Community Management API), gated behind OAuth 2.0. Unlike open platforms, LinkedIn enforces strict API partner tiers; certain scopes (e.g. organization page management, deep analytics) require explicit approval from LinkedIn's Partner Programme.

This ADR governs how the LinkedIn connector fits into the established connector architecture. It does not re-decide credential storage mechanics (ADR-0014), rate-limit enforcement (ADR-0003), error handling and auto-disable (ADR-0010), connector health derivation (ADR-0009), tenant isolation (ADR-0015), or data retention (ADR-0018) — those decisions apply here by reference. This ADR decides the LinkedIn-specific integration: the OAuth flow, scopes, token lifecycle, error classification, scheduler guardrails, and connector implementation of the `SocialConnector` interface.
LinkedIn is a primary channel for professional and B2B social engagement. Today, Social Engage has no native LinkedIn integration; tenants must monitor professional conversations, company pages, and employee advocacy outside the platform, fragmenting the listening workflow and limiting the value of the unified dashboard.

This initiative adds a LinkedIn `SocialConnector` to `social-listening-core` and the matching setup, status, and post-feed experience in `social-listening-admin`. The connector will use a server-side, confidential-client OAuth 2.0 flow, proactively manage 60-day access and one-year refresh token lifecycles, enforce LinkedIn Rest.li rate limits through the existing `RequestGate`, poll at a safe one-hour cadence, and gracefully degrade when LinkedIn Marketing Developer Partner Programme organization scopes are not yet approved.

The expected business value is a single, tenant-isolated, GDPR-compliant view of LinkedIn posts and engagement inside Social Engage, reducing the need for third-party aggregators and protecting customer credentials through platform-controlled envelope encryption.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Expand Social Engage coverage to professional/B2B audiences through native LinkedIn ingestion | LinkedIn connector is available in the tenant connector grid and completes OAuth connection within one session |
| 2 | Eliminate reliance on third-party aggregators for LinkedIn data | 100% of LinkedIn ingest traffic uses the platform-managed credential and connector flow |
| 3 | Maintain GDPR and platform-terms compliance for OAuth data and retention | No raw LinkedIn API payloads are retained; disconnect triggers tenant-scoped data deletion; audit pass |
| 4 | Provide reliable, predictable LinkedIn ingestion with transparent health and token status | Connector health and token-expiry badges are accurate and surfaced on the status screen |
| 5 | Protect operational stability with safe, rate-limited, scheduler-enforced polling | No tenant exceeds LinkedIn daily rate limits; scheduler rejects sub-one-hour poll intervals outside approved partner scopes |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
Social Engage will integrate LinkedIn as a `SocialConnector` implementation under the unified connector pattern (ADR-0002), using the **OAuth 2.0 Authorization Code Flow (confidential client)** using `client_id` and `client_secret` via the LinkedIn REST API v2.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Connects and manages the LinkedIn connector | High | Clear OAuth flow, scope/status visibility, re-sync and disconnect controls |
| Tenant User / Social Listening Analyst | Reviews ingested LinkedIn posts and engagement | High | Accurate, normalized post feed; timely but not overwhelming poll cadence |
| Content Marketer | Uses LinkedIn as a professional publishing/listening channel | Medium | Confidence that company page and personal profiles are covered |
| Compliance / Data Protection Officer | Ensures GDPR and platform-terms adherence | Medium | Consent, encrypted tokens, tenant-scoped erasure, no raw payload retention |
| Platform Administrator | Monitors cross-tenant connector health | Low | Aggregate connector counts, error rates, no tenant data leakage |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.25 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer / social listening analyst, I want a dedicated `linkedin` ingestion connector in `social-listening-core` implementing OAuth 2.0 conf... | **LinkedIn Connector Client (`linkedinConnector.ts`):**; **Token Refresh & Lifecycle Management (`refreshToken()`):**; **Rest.li Rate-Limit Header Extraction... |
| Story 6.35 | epic-6-tenant-admin-ui.md | As Tenant Administrator or User, I want to connect our organization's LinkedIn member and company accounts via OAuth, view connector operational health and s... | **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**; **OAuth Connect & Callback Flow:**; **Graceful Scope Degradation ... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- Social Engage holds a LinkedIn Marketing Developer Platform app with a confidential client `client_id` and `client_secret`.
- Azure Key Vault and the existing credential envelope-encryption service remain available (ADR-0014).
- The `SocialConnector` framework, `RequestGate`, poll scheduler, and `IngestionRun` audit mechanisms are already in place (ADR-0002, ADR-0003, ADR-0005).
- A Tenant Admin or user with the appropriate role can consent to LinkedIn OAuth scopes.

Social Engage will integrate LinkedIn as a `SocialConnector` implementation under the unified connector pattern (ADR-0002), using the **OAuth 2.0 Authorization Code Flow (confidential client)** using `client_id` and `client_secret` via the LinkedIn REST API v2.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All LinkedIn credentials must be stored using platform envelope encryption and never exposed to the browser. | Security | Must | Penetration-style review confirms no raw token material in logs, responses, or client bundles. |
| NFR-002 | LinkedIn-derived data and credentials must be isolated by `tenant_id` using Postgres RLS. | Security | Must | Contract tests prove cross-tenant read attempts are blocked. |
| NFR-003 | Raw LinkedIn API payloads must not be retained beyond immediate operational needs. | Compliance | Must | No raw payload column or log line persists after `normalize()`; audit of `social_posts` table confirms `rawPayload` is not used for LinkedIn. |
| NFR-004 | LinkedIn polling must remain available despite LinkedIn transient errors and rate limits. | Reliability | Should | Retry with exponential backoff and jitter; queued runs create `IngestionRun` records. |
| NFR-005 | Connector health status must be derived from real ingestion runs, not mocked. | Maintainability | Must | `ConnectorHealth` transitions match `IngestionRun` outcomes and token lifecycle events. |
| NFR-006 | The connector must support the standard, self-service member scopes without partner approval. | Usability | Must | OAuth scope list is split into member and organization tiers. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- Social Engage holds a LinkedIn Marketing Developer Platform app with a confidential client `client_id` and `client_secret`.
- Azure Key Vault and the existing credential envelope-encryption service remain available (ADR-0014).
- The `SocialConnector` framework, `RequestGate`, poll scheduler, and `IngestionRun` audit mechanisms are already in place (ADR-0002, ADR-0003, ADR-0005).
- A Tenant Admin or user with the appropriate role can consent to LinkedIn OAuth scopes.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | LinkedIn Marketing Developer Partner Programme approval delays or rejects organization-scope requests. | Medium | Medium | Gate organization features behind a feature flag and ship member-level ingestion first. | Product Owner |
| R-002 | Annual one-year refresh-token expiry forces users to re-authenticate. | High | Medium | Surface 30-day and 7-day proactive warnings and provide one-click reconnect. | Product Owner |
| R-003 | One-hour standard polling cadence creates up to one-hour latency for engagement metrics. | High | Medium | Document the constraint; reserve sub-hour cadence for verified partner tiers. | Product Owner |
| R-004 | LinkedIn does not offer push webhooks; real-time reaction tracking is not possible on standard tiers. | High | High | Accept poll-only model; consider future partner-tier real-time options only after explicit scope. | Product Owner |
| R-005 | Rate-limit headers may be inconsistent, causing over- or under-polling. | Low | Medium | Defensive, case-insensitive header parsing with fallbacks and scheduler gating. | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0069-linkedin-connector.md`
- BRD: `../Business-Requirements/BRD-0069-LinkedIn-Connector.md`
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above