# Technical Design Specification (TDS) — LinkedIn Connector (OAuth 2.0 & Ingestion Architecture)

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0069: LinkedIn Connector — OAuth 2.0 Account Connection, Token Lifecycle, and Ingestion Architecture |
| **Document ID** | `TDS-0069` |
| **Feature Name** | LinkedIn Ingestion Connector, Rest.li Rate Limiting, and Confidential OAuth 2.0 Engine |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Connector Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/linkedin-connector/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0069` | [ADR-0069: LinkedIn Connector](../../adr/0069-linkedin-connector.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0069` | [BRD-0069: LinkedIn Connector](../Business-Requirements/BRD-0069-LinkedIn-Connector.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0069` | [FDD-0069: LinkedIn Connector](../Functional-Design/FDD-0069-LinkedIn-Connector.md) | Fully Aligned |
| **Governing User Story** | `Story 2.25` | [Epic 2: Ingestion Connectors and Rate Limits](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-225--linkedin-connector-oauth-20-account-connection-and-ingestion) | Acceptance Target |
| **Publishing User Story** | `Story 2.30` | [Epic 2: Ingestion Connectors and Rate Limits](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md#story-230--linkedin-post-publishing) | Outbound Invariant Target |
| **Executable Contract Test** | `Story 2.25 Contract` | `contracts/epic-2/story-2.25.linkedin-connector.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph LinkedInOAuth["LinkedIn OAuth 2.0 Service"]
        AuthDialog["Authorization Dialog (openid, profile, w_member_social, r_organization_social)"]
        TokenEndpoint["POST /oauth/v2/accessToken (code exchange & refresh)"]
    end

    subgraph RestLiAPI["LinkedIn REST API (v2 / Community Management API)"]
        MemberPosts["GET /v2/ugcPosts?q=authors&authors=List(urn:li:person:{id})"]
        OrgPosts["GET /v2/organizationalEntityAcls?q=roleAssignee"]
    end

    subgraph CoreEngine["social-listening-core"]
        Router["linkedinOAuthRouter.ts -> State validation & token exchange"]
        TokenManager["Token Lifecycle Manager -> Automatic refresh before 60-day expiry"]
        RequestGate["RequestGate -> Defensively parse Rest.li headers"]
        Poller["pollLinkedIn.ts -> Hourly scheduled cadence"]
        Normalizer["linkedinNormalizer.ts -> Transient payload processing"]
    end

    subgraph Storage["PostgreSQL (Encrypted Secrets & Audit)"]
        Creds["platform_credentials (refresh_token valid 365d, access_token 60d)"]
        Posts["social_posts (external_id: urn:li:share:{id} or urn:li:ugcPost:{id})"]
        Runs["ingestion_runs (audit anchor)"]
    end

    Router -->|1. OAuth Handshake| AuthDialog
    AuthDialog -->|2. Return Authorization Code| Router
    Router -->|3. Exchange Code| TokenEndpoint
    TokenEndpoint -->|4. Save Tokens & Expiry| Creds

    Poller -->|5. Validate / Refresh Token| TokenManager
    TokenManager -->|Refresh if expired| TokenEndpoint
    Poller -->|6. Paced Outbound Fetch| RequestGate
    RequestGate -->|7. Rest.li Call| MemberPosts
    RequestGate -->|7b. Org Posts (if granted)| OrgPosts
    MemberPosts -->|8. Transient Normalization| Normalizer
    Normalizer -->|9. Persist Normalized Post| Posts
    Normalizer -->|10. Record Run| Runs
```

### 2.2 Architectural Boundaries & Invariants
- **Two-Tier Scope Graceful Degradation:**
  - Standard Tier: `openid`, `profile`, `w_member_social` (Member personal sharing & monitoring).
  - Partner Tier: `r_organization_social`, `rw_organization_admin`, `w_organization_social` (Organization Page management).
  - If organization permissions are withheld by LinkedIn or the user, the connector degrades gracefully to member-level operations without failing the connection.
- **Strict 60-Day / 365-Day Token Lifecycle:**
  - Access tokens expire after **60 days**; refresh tokens expire after **365 days**.
  - `refreshToken()` is executed automatically prior to making API calls when `expiresAt` is within 5 days.
  - If refresh fails, the credential is immediately marked `reconnect_required`, halting automated retries to prevent account lockouts.
- **Poll Cadence Bound:** Polling cadence is strictly capped at **at most once per hour (3,600s)** per tenant-platform tuple under standard tier limits.
- **Data Retention Prohibition (ADR-0018 Compliance):** LinkedIn Terms prohibit long-term persistence of raw API responses. The raw payload is strictly transient in memory; only normalized `SocialPost` fields and synthetic metrics are committed to PostgreSQL.
- **Live Rest.li Header Parsing:** Dynamically parses `x-restli-gateway-ratelimit-remaining` and `x-restli-gateway-ratelimit-reset` to throttle calls dynamically before 429 errors occur.

---

## 3. Data Architecture & Persistence Design

### 3.1 Credential Metadata Payload (`platform_credentials.encrypted_secret`)
```json
{
  "accessToken": "AQV...",
  "accessTokenExpiresAt": "2026-10-20T12:00:00.000Z",
  "refreshToken": "AQU...",
  "refreshTokenExpiresAt": "2027-08-20T12:00:00.000Z",
  "scope": "openid profile w_member_social r_organization_social",
  "personUrn": "urn:li:person:abcdef123",
  "organizationUrns": ["urn:li:organization:987654"]
}
```

---

## 4. API, Interface & Integration Contract Design

### 4.1 Rate Limit Header Parser (`src/connectors/linkedin/rateLimitParser.ts`)
```typescript
export function parseLinkedInRateLimitHeaders(headers: Record<string, string | undefined>): Partial<RateLimitState> {
  const remaining = headers['x-restli-gateway-ratelimit-remaining'] ?? headers['x-ratelimit-remaining'];
  const resetEpochSec = headers['x-restli-gateway-ratelimit-reset'] ?? headers['x-ratelimit-reset'];
  const limit = headers['x-restli-gateway-ratelimit-limit'] ?? headers['x-ratelimit-limit'];

  const state: Partial<RateLimitState> = {};

  if (remaining !== undefined) {
    state.remainingRequests = parseInt(remaining, 10);
  }
  if (resetEpochSec !== undefined) {
    state.windowResetAt = new Date(parseInt(resetEpochSec, 10) * 1000);
  }
  if (limit !== undefined) {
    state.totalLimit = parseInt(limit, 10);
  }

  return state;
}
```

### 4.2 LinkedIn Normalizer (`src/connectors/linkedin/linkedinNormalizer.ts`)
```typescript
export interface LinkedInUgcPost {
  id: string; // urn:li:ugcPost:123456789
  author: string; // urn:li:person:abc or urn:li:organization:xyz
  created: { time: number };
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: string;
      media?: Array<{ originalUrl: string }>;
    };
  };
}

export function normalizeLinkedInPost(
  post: LinkedInUgcPost,
  authorMetadata: { displayName: string; handle?: string; isOrg: boolean }
): NormalizedSocialPost {
  const content = post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary?.text ?? '';
  const mediaUrls = post.specificContent['com.linkedin.ugc.ShareContent'].media?.map(m => m.originalUrl) ?? [];

  return {
    externalId: post.id,
    platform: 'linkedin',
    content,
    publishedAt: new Date(post.created.time),
    url: `https://www.linkedin.com/feed/update/${post.id}`,
    mediaUrls,
    author: {
      id: post.author,
      name: authorMetadata.displayName,
      handle: authorMetadata.handle ?? authorMetadata.displayName,
      isOrganization: authorMetadata.isOrg
    },
    // Raw payload explicitly omitted to honor LinkedIn Terms on storage
    rawPayload: {}
  };
}
```

---

## 5. Rate Limiting, Concurrency & Flow Control

- **Fixed-Window Baseline:** Configured with `requestsPerWindow: 100`, `windowSeconds: 86400` (daily limit), and `minPollIntervalSeconds: 3600`.
- **Rest.li Dynamic Throttling:** When `x-restli-gateway-ratelimit-remaining` reaches $< 5$, `RequestGate` immediately sets internal gate state to `closed` until `windowResetAt`, avoiding HTTP 429 penalties.

---

## 6. Security, Identity & Credential Governance

- **Confidential Client Flow:** The OAuth client secret is stored securely in Azure Key Vault and injected via environment variable `LINKEDIN_CLIENT_SECRET`.
- **CSRF Defense:** Authorization requests include a cryptographically random, tenant-scoped `state` parameter cached in memory with a 10-minute TTL.

---

## 7. Error Handling, Resilience & Failure Classification

| HTTP Status / Response | Classification | System Behavior |
|---|---|---|
| HTTP 401 (Expired Token) | Automated Retryable | Executes `refreshToken()`; retries call with refreshed token. |
| HTTP 401 (Revoked / Refresh Expired) | Non-Retryable | Sets health status to `reconnect_required`; halts polling; alerts admin. |
| HTTP 403 (Scope Restricted) | Non-Retryable | Degrades to member-only operations; logs feature gating notice. |
| HTTP 429 (Rate Limit Exceeded) | Retryable | Respects `Retry-After` header; enters backoff queue. |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-2/story-2.25.linkedin-connector.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-LI-01` | OAuth code exchange | Verify exchange produces `accessToken` and `refreshToken` with correct expiration timestamps. |
| `TEST-LI-02` | Automated token refresh | Mock 401 response; verify `refreshToken()` is automatically invoked and request retried. |
| `TEST-LI-03` | Rest.li rate limit header parsing | Parse sample response headers; assert `remainingRequests` and `windowResetAt` match header values. |
| `TEST-LI-04` | Transient raw payload policy | Ingest LinkedIn post; assert stored `raw_payload` in database contains zero cached response blobs. |
| `TEST-LI-05` | Graceful scope degradation | Connect with member-only scopes; assert organization post polling is skipped without error. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/linkedin-connector/SKILL.md`:
- **Token Expiry Standard:** Document the 60-day access token and 365-day refresh token lifecycle.
- **Data Retention Rule:** Reiterate that raw API JSON responses must never be committed to long-term database storage.
- **Hourly Baseline:** Confirm that polling cadence must not exceed once per hour under standard tier.

---

## 10. Observability, Metrics & Operational Telemetry

- `linkedin_token_refresh_total{status="success|failure"}` (counter)
- `linkedin_restli_ratelimit_remaining` (gauge)
- `linkedin_ingested_ugc_posts_total` (counter)

---

## 11. Migration, Rollout & Feature Gating

- Multi-tenant deployment via standard OAuth registration.
- Feature flag `linkedin.org.enabled` gates organization-level querying to approved partners.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0069-1]** LinkedIn Developer Application registered with confidential client credentials.
- **[D-0069-1]** Rest.li API v2 compatibility.

### 12.2 Open Questions
- [x] **[Q-0069-1]** *Partner Tier Scoping:* Addressed via two-tier graceful degradation.
- [x] **[Q-0069-2]** *Data Retention:* Resolved by transient parsing without permanent raw payload persistence.
