# Technical Design Specification (TDS) — Admin UI Shape: One App Role-Gated

## 1. Document Control & Traceability Linkage

### 1.1 Metadata
| Attribute | Value |
|---|---|
| **Document Title** | TDS-0035: Admin UI Architectural Shape — Single Role-Gated Next.js Application & Server-Side Shell Segregation |
| **Document ID** | `TDS-0035` |
| **Feature Name** | Unified Admin UI Shell & Role-Gated Route Tree Segregation |
| **Version** | `1.0.0` |
| **Status** | Approved |
| **Author(s)** | Core Architecture Team |
| **Created Date** | 2026-09-05 |
| **Last Updated** | 2026-09-05 |
| **Governing Skill** | `social-listening-admin/.claude/skills/role-routing/SKILL.md` |

### 1.2 Upstream & Downstream Traceability Matrix
| Artifact Type | Reference Identifier | Title / Link | Alignment Status |
|---|---|---|---|
| **Architecture Decision Record** | `ADR-0035` | [ADR-0035: Admin UI's own shape — one role-gated Next.js app](../../adr/0035-admin-ui-shape-one-app-role-gated.md) | Invariant Source |
| **Business Requirements Doc** | `BRD-0035` | [BRD-0035: Admin UI Shape One App Role Gated](../Business-Requirements/BRD-0035-Admin-UI-Shape-One-App-Role-Gated.md) | Fully Aligned |
| **Functional Design Doc** | `FDD-0035` | [FDD-0035: Admin UI Shape One App Role Gated](../Functional-Design/FDD-0035-Admin-UI-Shape-One-App-Role-Gated.md) | Fully Aligned |
| **Governing User Story** | `Story 6.2` | [Epic 6: Tenant Management UI](../../user-stories/epic-6-tenant-management-and-admin-ui.md#story-62--role-gated-routing-shell) | Acceptance Target |
| **Related User Stories** | `Story 6.1`, `Story 6.6` | Entra Sign-In, Platform Admin Console | Related Modules |
| **Related Architecture Decisions** | `ADR-0001`, `ADR-0030`, `ADR-0036`, `ADR-0041` | Two-Repo Split, Platform Admin Tier, Session Mechanism, Identity Kind | Architectural Lineage |
| **Executable Contract Test** | `Story 6.2 Contract` | `social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts` | 100% Passing |

---

## 2. System Context & Architecture Topology

### 2.1 Context Diagram
```mermaid
flowchart TD
    subgraph Browser["Web Browser (End User)"]
        Req["HTTP Request (Cookie: admin-auth-session)"]
    end

    subgraph AdminApp["social-listening-admin (Single Next.js App)"]
        Middleware["Next.js Server Component Guard (role-routing.ts)"]
        DecryptSession["decryptSession() -> ResolvedIdentity"]
        
        subgraph RouteTrees["Segregated Server Route Trees"]
            TenantShell["/tenant/* (Tenant Users & Tenant Admins)
            - /tenant/connectors
            - /tenant/analytics
            - /tenant/settings"]
            
            PlatformShell["/platform-admin/* (Platform Admins Only)
            - /platform-admin/tenants
            - /platform-admin/operations"]
            
            PublicRoutes["/ (Home / Login / Unlinked)"]
        end
    end

    subgraph CoreAPI["social-listening-core (REST API Backend)"]
        CoreAuth["Bearer Token Validation & Postgres RLS"]
    end

    Req --> Middleware
    Middleware --> DecryptSession
    DecryptSession -->|identity.type === 'tenant_user'| TenantShell
    DecryptSession -->|identity.type === 'platform_admin'| PlatformShell
    DecryptSession -->|identity === null / unlinked| PublicRoutes
    
    TenantShell -->|Attempt /platform-admin/*| RejectPlatform["Redirect /tenant or 403"]
    PlatformShell -->|Attempt /tenant/*| RejectTenant["Redirect /platform-admin or 403"]
    
    TenantShell -->|Outbound HTTP (Bearer Auth)| CoreAuth
    PlatformShell -->|Outbound HTTP (Platform Bearer)| CoreAuth
```

### 2.2 Architectural Boundaries & Invariants
- **Single Deployable App Invariant:** Rejects deploying two separate frontend web applications (e.g. `tenant-admin-app` and `platform-admin-app`). Both audiences are served from `social-listening-admin`, minimizing CI/CD pipelines, DNS domains, and operational overhead for the Sole Operator.
- **Server-Side Route Segregation:** Client-side URL tampering cannot bypass access boundaries. Server components in `src/app/tenant/layout.tsx` and `src/app/platform-admin/layout.tsx` evaluate permissions synchronously before rendering any HTML.
- **Zero Shell for Unlinked Sessions:** If an Entra ID token is valid but has no corresponding user/tenant record in PostgreSQL (`resolveIdentity() === null`), the application renders an explicit "Unlinked Account" page (`/unlinked`), never falling through to render blank tenant shells.
- **Defense-in-Depth:** Frontend role gating provides navigational isolation. The backend (`social-listening-core`) remains the authoritative security boundary, enforcing Postgres RLS on all API requests.

---

## 3. Data Architecture & Persistence Design

### 3.1 Identity Discriminated Union
Implemented across both repos (`social-listening-core/src/identity/identityResolution.ts` and `social-listening-admin/src/lib/session.ts`):

```typescript
export interface TenantUserIdentity {
  type: 'tenant_user';
  userId: string;
  tenantId: string;
  role: 'tenant_user' | 'tenant_admin';
  email: string;
}

export interface PlatformAdminIdentity {
  type: 'platform_admin';
  adminId: string;
  email: string;
}

export type ResolvedIdentity = TenantUserIdentity | PlatformAdminIdentity;
```

---

## 4. Component Design & Detailed Processing Logic

### 4.1 Server-Side Role Routing Resolver
Implemented in `social-listening-admin/src/lib/role-routing.ts`:

```typescript
export type ShellType = 'tenant' | 'platform-admin' | null;

export function getRoleShell(identity: ResolvedIdentity | null): ShellType {
  if (!identity) return null;
  if (identity.type === 'platform_admin') return 'platform-admin';
  if (identity.type === 'tenant_user') return 'tenant';
  return null;
}

export function isShellAllowed(identity: ResolvedIdentity | null, targetShell: 'tenant' | 'platform-admin'): boolean {
  const userShell = getRoleShell(identity);
  return userShell === targetShell;
}
```

### 4.2 Route Guard Layout Pattern
Implemented in `social-listening-admin/src/app/tenant/layout.tsx`:
```typescript
export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !isShellAllowed(session.identity, 'tenant')) {
    redirect('/');
  }
  return <div className="tenant-shell-wrapper">{children}</div>;
}
```

---

## 5. Interface & Contract Specifications

### 5.1 Route Tree Hierarchy
| Route Path | Allowed Identity Type | Allowed Roles | Unauthorized Action |
|---|---|---|---|
| `/tenant/*` | `tenant_user` | `tenant_user`, `tenant_admin` | Redirect to `/` |
| `/tenant/settings` | `tenant_user` | `tenant_admin` only | Render 403 Forbidden |
| `/platform-admin/*` | `platform_admin` | N/A (distinct kind) | Redirect to `/` |
| `/unlinked` | Any / Authenticated | Unlinked Entra account | Render informative guidance |

---

## 6. Security, Tenancy & Isolation Model
- **Strict Structural Separation:** As formalized in ADR-0041, `platform_admin` is a distinct object type (`type: 'platform_admin'`), not a string value inside a user role enum. It cannot be coerced into a `tenant_user`.
- **Cross-Audience Boundary:** Platform Admins attempting `/tenant/*` routes are redirected, preventing confusion between administrative governance and tenant operational workflows.

---

## 7. Performance, Scalability & Resource Caps
- **Zero Client Hydration Overhead:** Shell permissions are evaluated purely on the server during initial SSR, completing in $< 1\text{ms}$.

---

## 8. Resilience, Recovery & Failure Semantics
- **Session Decryption Failure:** Expired or tampered cookies trigger an automatic session flush and clean redirect to login.

---

## 9. Observability, Telemetry & Auditability
- Unauthorized navigation attempts trigger security telemetry: `unauthorized_route_attempt{target_route, identity_type}`.

---

## 10. Migration, Compatibility & Rollback Strategy
- Deployed entirely within `social-listening-admin`. Fully backward-compatible with core API bearer tokens.

---

## 11. Verification, Testing & Quality Assurance
- **Story 6.2 Contract:** `social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts`
  - AC1: `getRoleShell()` accurately discriminates `tenant_user` vs `platform_admin` vs `null`.
  - AC2: Platform Admin attempting `/tenant/*` is redirected.
  - AC3: Tenant User attempting `/platform-admin/*` is redirected.
  - AC4: Unresolved session (`identity: null`) returns `null` shell and redirects to home/unlinked.

---

## 12. Open Questions & Future Enhancements

- [x] ~~**[Q-0035-1]** **One deployable vs two apps.**~~ Decided in ADR-0035: Single Next.js application with role-gated route trees.
- [ ] **[Q-0035-2]** **Granular sub-role permissions.** Evaluating custom RBAC permission sets within the tenant shell (addressed in ADR-0107).
