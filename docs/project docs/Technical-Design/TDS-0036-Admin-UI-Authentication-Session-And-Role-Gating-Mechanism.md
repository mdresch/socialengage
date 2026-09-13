# Technical Design Specification (TDS) — Admin UI Authentication Session & Role-Gating Mechanism

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0036: Admin UI Authentication Session & Role-Gating Mechanism — Encrypted HTTP-Only Cookie Session, Entra OIDC & `GET /v1/me` Identity Resolution |
| **Document ID** | `TDS-0036` |
| **Feature Name** | Encrypted Session Cookie Management, OIDC Callback & `GET /v1/me` Endpoint |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-admin/.claude/skills/admin-session/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0036` | [ADR-0036: Admin UI authentication session and role-gating mechanism](../../adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0036` | [BRD-0036: Admin UI Authentication Session And Role Gating Mechanism](../Business-Requirements/BRD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0036` | [FDD-0036: Admin UI Authentication Session And Role Gating Mechanism](../Functional-Design/FDD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md) | Fully Aligned |
| **Governing User Stories** | `Story 5.11`, `Story 6.1` | [Epic 5](../../user-stories/epic-5-security-isolation-and-messaging.md#story-511--get-v1me-expose-a-signed-in-callers-own-resolved-identity-over-http) / [Epic 6](../../user-stories/epic-6-tenant-management-and-admin-ui.md#story-61--nextjs-scaffold-and-entra-external-id-sign-in) | Acceptance Targets |
| **Related User Stories** | `Story 6.2`, `Story 6.7` | Role-Gated Shell, Self-Service Signup | Sibling Modules |
| **Related Architecture Decisions** | `ADR-0029`, `ADR-0035`, `ADR-0041` | Entra ID Auth, One App Role-Gated, Platform Admin Identity Kind | Architectural Lineage |
| **Executable Contract Tests** | `Story 5.11 & 6.1 Contracts` | `social-listening-core/contracts/epic-5/story-5.11.get-v1-me.contract.test.ts`<br>`social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
sequenceDiagram
    autonumber
    actor User as Admin User
    participant Browser as Browser Client
    participant BFF as social-listening-admin (Next.js)
    participant Entra as Entra External ID (OIDC)
    participant Core as social-listening-core (GET /v1/me)
    participant DB as PostgreSQL (users / tenants)

    User->>Browser: Click "Sign In with Entra ID"
    Browser->>BFF: GET /api/auth/login
    BFF-->>Browser: 302 Redirect to Entra Authorization Endpoint
    Browser->>Entra: User Authenticates & Consents
    Entra-->>Browser: 302 Redirect to /api/auth/callback?code=...
    Browser->>BFF: GET /api/auth/callback?code=...
    BFF->>Entra: POST /token (Exchange code for ID & Access Tokens)
    Entra-->>BFF: { access_token, id_token }
    BFF->>Core: GET /v1/me (Authorization: Bearer <access_token>)
    Core->>DB: Lookup user by Entra oid / sub
    DB-->>Core: ResolvedIdentity (tenant_user | platform_admin)
    Core-->>BFF: 200 OK (ResolvedIdentity JSON)
    BFF->>BFF: Encrypt session payload with AES-256-GCM
    BFF-->>Browser: 302 Redirect to /tenant (Set-Cookie: admin-auth-session; HttpOnly; Secure; SameSite=Lax)
    Browser->>BFF: GET /tenant (Cookie: admin-auth-session)
    BFF->>BFF: Decrypt session, verify role, render Server Components
    BFF-->>Browser: 200 OK (Rendered HTML)
```

### 2.2 Architectural Boundaries & Invariants
- **Encrypted HTTP-Only Cookie Session:** Frontend authentication relies on a stateless, encrypted session cookie (`admin-auth-session`) sealed via AES-256-GCM (`iron-session`). Client-side JavaScript cannot access session tokens (`document.cookie` is empty), mitigating XSS token theft.
- **Authoritative Identity Hydration via `GET /v1/me`:** The Next.js BFF never assumes tenant membership from unverified ID token claims. Identity hydration requires calling `GET /v1/me` on `social-listening-core`.
- **Anti-Spoofing Enforcement:** `GET /v1/me` derives caller identity **strictly from verified JWT bearer claims** (`req.identity`). It ignores query parameters, body payloads, or headers attempting to forge `tenantId`, `userId`, or `role`.
- **Stateless Decoupling:** The session cookie contains both the decrypted `ResolvedIdentity` and the upstream Entra bearer token, allowing Next.js Server Components to perform authorized core API fetches without local database dependencies.

---

## 3. Data Architecture & Persistence Design

### 3.1 Encrypted Session Cookie Payload
Defined in `social-listening-admin/src/lib/session.ts`:

```typescript
export interface SessionData {
  accessToken: string;
  idToken?: string;
  expiresAt: number;             // Unix timestamp in seconds
  identity: ResolvedIdentity;    // TenantUserIdentity | PlatformAdminIdentity
}
```

### 3.2 `GET /v1/me` Response DTO
Implemented in `social-listening-core/src/http/versions/v1/meRouter.ts`:
```typescript
export type GetMeResponse =
  | {
      type: 'tenant_user';
      userId: string;
      tenantId: string;
      role: 'tenant_user' | 'tenant_admin';
      email: string;
    }
  | {
      type: 'platform_admin';
      adminId: string;
      email: string;
    };
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Backend `GET /v1/me` Handler
```typescript
import { Router, Request, Response } from 'express';
import { getResolvedIdentity } from '../auth/requireTenantUser';

export const meRouter = Router();

meRouter.get('/', (req: Request, res: Response) => {
  // Read authenticated identity attached by upstream authMiddleware
  const identity = getResolvedIdentity(req);
  
  if (!identity) {
    return res.status(403).json({ error: 'Unresolved identity' });
  }

  // Pure pass-through of resolved identity DTO
  return res.status(200).json(identity);
});
```

### 4.2 Next.js Session Seal & Unseal
```typescript
import { sealData, unsealData } from 'iron-session';

const SESSION_PASSWORD = process.env.SESSION_SECRET!; // 32+ char secret
const COOKIE_NAME = 'admin-auth-session';

export async function encryptSession(data: SessionData): Promise<string> {
  return sealData(data, { password: SESSION_PASSWORD, ttl: 86400 });
}

export async function decryptSession(cookieValue: string): Promise<SessionData | null> {
  try {
    return await unsealData<SessionData>(cookieValue, { password: SESSION_PASSWORD, ttl: 86400 });
  } catch {
    return null;
  }
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Core API Endpoint Contract
`GET /v1/me`

- **Headers:** `Authorization: Bearer <valid_jwt>`
- **HTTP 200 OK Response (Tenant Admin):**
```json
{
  "type": "tenant_user",
  "userId": "usr-8a291fbc-91d2-430c-9972-e1d882049b1a",
  "tenantId": "tnt-4f2791e8-782a-4311-8729-12e098481234",
  "role": "tenant_admin",
  "email": "sarah@acme-corp.com"
}
```
- **HTTP 200 OK Response (Platform Admin):**
```json
{
  "type": "platform_admin",
  "adminId": "adm-0912384a-1293-4123-8912-123981249812",
  "email": "operator@socialengage.internal"
}
```
- **HTTP 401 Unauthorized:** Missing or invalid Bearer token.
- **HTTP 403 Forbidden:** Valid token, but user is not registered in `users` or `platform_admins`.

---

## 6. Security, Tenancy & Isolation Model
- **Cookie Security Flags:** `admin-auth-session` is configured with `HttpOnly = true`, `Secure = true` (in production), and `SameSite = Lax`, completely defending against cross-site script access and CSRF login attacks.
- **No Token Storage in LocalStorage:** Web browser local storage is strictly avoided for token retention.

---

## 7. Performance, Scalability & Resource Caps
- **Stateless Decryption:** Decoding session cookies requires only symmetric AES-256 decryption, taking $< 0.5\text{ms}$ per request with zero database round-trips for cached sessions.

---

## 8. Resilience, Recovery & Failure Semantics
- **Clock Skew / Expiration:** If `expiresAt` is in the past, Server Components automatically trigger a redirect to `/api/auth/login` to refresh tokens seamlessly.

---

## 9. Observability, Telemetry & Auditability
- Authentication failures and identity mismatches log to platform security logs:
  - `admin_auth_success{identity_type, tenant_id}`
  - `admin_auth_rejected{reason}`

---

## 10. Migration, Compatibility & Rollback Strategy
- Additive endpoint (`GET /v1/me`) and Next.js route handlers. Rollback reverts session cookie decryption logic.

---

## 11. Verification, Testing & Quality Assurance
- **Story 5.11 Contract:** `social-listening-core/contracts/epic-5/story-5.11.get-v1-me.contract.test.ts`
  - AC1/AC2: Validates 401 rejection on missing/invalid auth.
  - AC3: Proves 403 rejection on unlinked identity.
  - AC4: Validates return of camelCase `ResolvedIdentity` for all 3 shapes (`tenant_admin`, `tenant_user`, `platform_admin`).
  - AC5: Proves immunity to spoofed header/body parameters.
- **Story 6.1 Contract:** `social-listening-admin/contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts`
  - Validates session sealing and unsealing via iron-session.

---

## 12. Open Questions & Future Enhancements

- [x] ~~**[Q-0036-1]** **Identity retrieval endpoint.**~~ Decided in ADR-0036 §5: Implemented as `GET /v1/me`.
- [ ] **[Q-0036-2]** **Automatic token refresh.** Supporting background refresh token rotation in Next.js middleware prior to session cookie expiration.
