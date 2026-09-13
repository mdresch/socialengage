# Technical Design Specification (TDS) — Authentication Mechanism: Entra External ID

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0029: Authentication Mechanism: Entra External ID |
| **Document ID** | `TDS-0029` |
| **Feature Name** | Thin Pluggable OIDC Authentication via Microsoft Entra External ID |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-04 |
| **Last Updated** | 2026-09-04 |
| **Governing Skill** | `social-listening-core/.claude/skills/entra-external-id-auth/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0029` | [ADR-0029: Authentication mechanism — Microsoft Entra External ID](../../adr/0029-authentication-mechanism-entra-external-id.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0029` | [BRD-0029: Authentication Mechanism — Microsoft Entra External ID](../Business-Requirements/BRD-0029-Authentication-Mechanism-Entra-External-ID.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0029` | [FDD-0029: Authentication Mechanism — Microsoft Entra External ID](../Functional-Design/FDD-0029-Authentication-Mechanism-Entra-External-ID.md) | Fully Aligned |
| **Governing User Story** | `Story 5.6` | [Epic 5: Security, Isolation and Messaging](../../user-stories/epic-5-security-isolation-and-messaging.md#story-56--authentication-via-microsoft-entra-external-id) | Acceptance Target |
| **Executable Contract Test** | `Story 5.6 Contract` | `contracts/epic-5/story-5.6.entra-external-id-auth.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph ClientBrowser["User Browser / Client App"]
        AdminApp["social-listening-admin (Next.js)"]
        EntraLogin["Entra CIAM Hosted Login UI<br/>(OAuth 2.0 Auth Code + PKCE)"]
    end

    subgraph IdentityProvider["Microsoft Entra External ID (Single External Tenant)"]
        OIDC_Config[".well-known/openid-configuration"]
        JWKS_Endpoint["JWKS Public Key Set"]
    end

    subgraph BackendAPI["social-listening-core API Gateway"]
        AuthMiddleware["JWT Verification Middleware (jose / jsonwebtoken)"]
        IdentityResolver["src/identity/identityResolution.ts"]
        PGDB[("PostgreSQL (users & tenants tables)")]
    end

    AdminApp -->|1. Redirect for Login| EntraLogin
    EntraLogin -->|2. Issue JWT Bearer Token (sub, email)| AdminApp
    AdminApp -->|3. API Request: Authorization: Bearer <token>| AuthMiddleware
    
    AuthMiddleware -->|Fetch Public Keys (Cached)| JWKS_Endpoint
    AuthMiddleware -->|Extract opaque 'sub'| IdentityResolver
    IdentityResolver -->|Lookup users.external_subject = sub| PGDB
    IdentityResolver -->|Inject Resolved TenantContext| BusinessRoutes["Business Logic & Routes"]
```

### 2.2 Architectural Boundaries & Invariants
- **Single Entra External Tenant Invariant:** Exactly one Entra external tenant is provisioned for the entire SocialEngage platform. The Entra tenant is *not* partitioned per SocialEngage customer organization.
- **`tid` Non-Discrimination Invariant:** The token `tid` claim represents the shared Entra directory ID and is identical for all users. It must never be used to identify or resolve a SocialEngage tenant.
- **Pluggable OIDC / Zero SDK Invariant:** `social-listening-core` performs standard OIDC JWT/JWKS signature and issuer verification using standard libraries (`jose`). It never calls Microsoft Graph API or uses Entra-specific SDKs (e.g. MSAL) on the request validation hot path.
- **Postgres Authority Invariant:** Tenant memberships, RBAC roles (`platform_admin`, `tenant_admin`, `tenant_user`), seat limits, and access expiration (`access_ends_at`) are stored and enforced exclusively in PostgreSQL. Entra is an identity provider, not an authorization store.
- **Opaque Subject Binding:** The `sub` claim is treated as an opaque string and matched against `users.external_subject`. No tenant or role claims inside the token are trusted.

---

## 3. Data Architecture & Persistence Design

### 3.1 Mapping Table Schema: `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_subject VARCHAR(255) UNIQUE, -- Opaque sub claim from Entra ID
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'tenant_user',
  status user_status NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_external_subject ON users(external_subject);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
```

### 3.2 Invite-Only Onboarding Resolution
1. Admin creates user record with `status = 'invited'`, `email = 'user@tenant.com'`, and `external_subject = NULL`.
2. User authenticates via Entra External ID.
3. On first API call, the identity resolver detects `external_subject IS NULL` and matches on verified `email` within `tenant_id`.
4. It sets `external_subject = token.sub` and transitions `status = 'active'` in an atomic transaction.

---

## 4. API, Interface & Integration Contract Design

### 4.1 OIDC Discovery & Verification Config
Configured via environment variables:
```typescript
export interface OidcConfig {
  issuer: string;         // https://<subdomain>.ciamlogin.com/<tenant-id>/v2.0
  jwksUri: string;        // https://<subdomain>.ciamlogin.com/<tenant-id>/discovery/v2.0/keys
  audience: string;       // api://social-listening-core (client ID)
  cacheTtlMs: number;     // 24 * 60 * 60 * 1000 (JWKS cache TTL)
}
```

### 4.2 Auth Middleware Interface (`src/http/auth/tokenAuthMiddleware.ts`)
```typescript
export interface AuthenticatedIdentity {
  sub: string;
  userId: string;
  tenantId: string;
  role: 'platform_admin' | 'tenant_admin' | 'tenant_user';
  email: string;
}

export interface AuthenticatedRequest extends Request {
  identity?: AuthenticatedIdentity;
}
```

### 4.3 Request Error Contracts
- **Missing Authorization Header:** HTTP `401 Unauthorized` with `{ "error": "Unauthorized", "message": "Missing Bearer token" }`.
- **Expired or Invalid Signature:** HTTP `401 Unauthorized` with `{ "error": "Unauthorized", "message": "Invalid token signature or expired" }`.
- **Unmapped User / Missing Invitation:** HTTP `403 Forbidden` with `{ "error": "Forbidden", "message": "User not authorized for any tenant" }`.

---

## 5. Rate Limiting, Concurrency & Flow Control

- **JWKS Cache Flow Control:** Public signing keys from the JWKS endpoint are cached in memory using LRU/TTL caching (default 24 hours). If a key ID (`kid`) is unrecognized, a single force-refresh is permitted with rate-throttling (max 1 refresh per minute) to prevent DoS attacks against the discovery endpoint.
- **API Request Gating:** Standard HTTP requests are rate-limited via `RequestGate` after authentication.

---

## 6. Security, Identity & Credential Governance

- **Token Replay & Expiry:** Middleware rejects tokens where `exp < Math.floor(Date.now() / 1000)`.
- **Audience Validation:** Middleware strictly asserts `aud === process.env.ENTRA_AUDIENCE`.
- **Test Claims Bypass:** For automated testing, `src/http/auth/testClaimsBypassMiddleware.ts` provides a deterministic mock identity bypass that is strictly disabled when `NODE_ENV === 'production'`.

---

## 7. Error Handling, Resilience & Failure Classification

### 7.1 Failure Modes Matrix
| Failure Scenario | Classification | HTTP Code | System Action |
|---|---|---|---|
| Unsigned Token | Security Violation | 401 | Immediate rejection; log warning |
| Expired Token | Auth Error | 401 | Reject; prompt client to refresh token |
| Entra JWKS Unreachable | Upstream Fault | 503 | Use cached JWKS; if expired, fail closed with 503 |
| Uninvited Sign-in | Auth Error | 403 | Log uninvited access attempt; block data access |

---

## 8. Testing & Contract Gate Plan

### 8.1 Contract Tests
Contract test file: `contracts/epic-5/story-5.6.entra-external-id-auth.contract.test.ts`.

| Test ID | Scenario | Verification Method |
|---|---|---|
| `TEST-AUTH-01` | Valid token authorizes request | Generate mock RSA-signed JWT matching mock JWKS. Assert request succeeds with 200. |
| `TEST-AUTH-02` | Missing header returns 401 | Call protected route without `Authorization` header. Assert 401 Unauthorized. |
| `TEST-AUTH-03` | Expired token returns 401 | Submit token with past expiration time. Assert 401 Unauthorized. |
| `TEST-AUTH-04` | Wrong audience returns 401 | Submit token with foreign `aud`. Assert 401 Unauthorized. |
| `TEST-AUTH-05` | Uninvited user returns 403 | Submit valid token for unknown `sub`/`email`. Assert 403 Forbidden. |

---

## 9. Component Skill (`SKILL.md`) Documentation Updates

Updates to `.claude/skills/entra-external-id-auth/SKILL.md`:
- **Boundary Rule:** Never parse or trust Entra groups or directory roles for authorization.
- **Tenant Scope Rule:** Never use `tid` to identify a SocialEngage tenant.
- **Discovery Standard:** Only use standard OIDC discovery endpoints; avoid proprietary Microsoft Graph calls in authorization middleware.

---

## 10. Observability, Metrics & Operational Telemetry

- **Metrics:**
  - `auth_token_verification_success_total` (counter)
  - `auth_token_verification_failure_total{reason}` (counter)
  - `auth_jwks_refresh_duration_seconds` (histogram)
- **Structured Logs:**
  ```json
  {
    "event": "auth_token_verified",
    "sub": "auth0|123456",
    "tenantId": "...",
    "role": "tenant_admin",
    "durationMs": 1.2
  }
  ```

---

## 11. Migration, Rollout & Feature Gating

- **Phased Cutover:** Retires temporary `X-Tenant-Id` header (governed by ADR-0033 / TDS-0033).
- **Environment Parity:** Staging and production configure real Entra CIAM tenant; CI runs against mock OIDC discovery servers.

---

## 12. Technical Assumptions, Dependencies & Open Questions

### 12.1 Assumptions & Dependencies
- **[A-0029-1]** Single shared Microsoft Entra External ID tenant.
- **[D-0029-1]** Standard OIDC JWT verification library (`jose`).

### 12.2 Open Questions
- [ ] **[Q-0029-1]** *Overage Pricing Rate:* Confirm exact per-MAU charge beyond the free 50,000 MAU ceiling upon commercial launch. *(Status: Deferred to commercial launch phase).*
