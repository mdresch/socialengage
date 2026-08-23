# Business Requirements Document — Admin UI Authentication, Session and Role-Gating Mechanism

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage Admin UI — Authentication, Session and Role-Gating Business Requirements |
| Version | 1.0 |
| Date | 2026-08-04 |
| Author(s) | AI Business & Requirements Analyst (BRD Writer Agent) |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-04 | AI Business & Requirements Analyst | Initial BRD derived from ADR-0036 and related user stories |

---

## 2. Executive Summary

The `social-listening-admin` Next.js application needs its own secure authentication and session mechanism before any admin screens can be built. The back-end already validates Entra External ID bearer tokens and resolves them to a concrete role (`tenant_admin`, `tenant_user`, or `platform_admin`) through `resolveIdentity()` in `social-listening-core`, but the admin UI has no sign-in flow, no session state, and no safe way to attach tokens to core API calls. In addition, Entra’s own token does not carry role or tenant membership, so the UI must ask `social-listening-core` for the caller’s resolved identity.

The accepted architecture (ADR-0036) is a server-side, Backend-for-Frontend (BFF) session: the browser never holds a bearer or refresh token. The authorization code and PKCE exchange are performed in a Next.js Route Handler, tokens are stored in an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie, and `src/lib/core-client.ts` remains the single place that attaches `Authorization: Bearer <token>` to requests. Role-gating in the UI is a layered UX convenience — a coarse middleware redirect for unauthenticated callers and a per-request resolved-identity check to render the right route tree and affordances — while the real security boundary remains `social-listening-core`’s Row-Level Security and application-layer role checks.

This BRD captures the business requirements, dependencies, and acceptance criteria needed to implement the first real admin sign-in and role-gating scaffold (Story 6.1) and the prerequisite `GET /v1/me` core identity endpoint (Story 5.11).

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure admin UI session tokens are never exposed to browser JavaScript | No bearer, access, or refresh token is present in `localStorage`, `sessionStorage`, client-readable cookies, or rendered HTML; verified by contract tests |
| 2 | Re-use the core identity model across the UI and API | The UI renders only the route tree and actions that match the resolved identity returned by `GET /v1/me`; no second, UI-only notion of role is created |
| 3 | Keep the existing `core-client.ts` choke point intact | `core-client.ts` is the only module in `social-listening-admin` that constructs the `Authorization` header for core API calls |
| 4 | Enable the rest of the Admin UI epic to build on a stable auth foundation | Stories 6.2–6.6 are unblocked and can rely on the shared session and role-gating mechanism |
| 5 | Limit the blast radius of common client-side vulnerabilities | A successful XSS attack in the admin UI cannot leak a bearer token because no token is accessible to browser JS |

---

## 4. Scope

### 4.1 In Scope

- A server-side, BFF-style sign-in flow using Authorization Code + PKCE against the Entra External ID tenant already provisioned in `social-listening-core`.
- An encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie storing a server-side session reference; exact library/implementation left to the implementation story.
- `core-client.ts` as the single choke point for attaching the bearer token to every `social-listening-core` call.
- Exact-match redirect-URI registration per environment on the `social-listening-admin` Entra app registration.
- A hard, server-side 8-hour absolute session lifetime from sign-in, regardless of activity.
- Core-side `GET /v1/me` identity-exposure endpoint that returns `resolveIdentity()`’s result and is derived exclusively from the caller’s validated bearer token.
- Two-layer role gating in the UI: coarse unauthenticated-redirect middleware and a per-request role check that decides which route tree and affordances to render.
- Graceful redirect to sign-in when a session is missing, invalid, or expired.
- Server-side sign-out that clears the session and cookie.

### 4.2 Out of Scope

- Adopting a third-party auth framework (e.g., Auth.js/NextAuth.js) at v1; the decision is to hand-build a minimal OIDC/PKCE flow with a generic library and revisit Auth.js only after its Entra External ID support is verified.
- Client-side token storage or any design that exposes bearer tokens to browser JavaScript.
- A dedicated product-research feature design for this BRD; no matching feature design was found (see Appendices).
- Solving the broader application-level secrets-management strategy for production (e.g., key vault rotation, multi-environment provisioning); this BRD states the minimum key-management requirements only.

### 4.3 Assumptions

- The Entra External ID tenant and test app registration provisioned for `social-listening-core` can be reused or extended for `social-listening-admin`.
- `social-listening-admin` will be a Next.js App Router application, and its data fetching will be server-side (Route Handlers, Server Components, or Server Actions).
- `core-client.ts`’s current environment-variable design remains the only path to `social-listening-core`; the session must be compatible with that server-only pattern.
- `social-listening-core` already provides `resolveIdentity()` and the `createTenantAuthMiddleware()` seam; the UI only needs a new, read-only HTTP surface for that result.

### 4.4 Constraints

- The bearer token must never be reachable by browser JavaScript or any client-side script.
- The encryption key for the session cookie must be at least 256 bits of randomness, sourced from an environment variable, and never committed to source control.
- Each real environment (local dev, staging, production) must pre-register its own exact `redirect_uri` on the Entra app registration; wildcards or pattern-matched URIs are not allowed.
- The design must remain compatible with the already-shipped `core-client.ts` module and its contract (Story 1.1).

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Sponsor / Product Owner / Solo Developer) | Authorizes the architecture, owns both repos | High | A secure, maintainable auth scaffold that unblocks the rest of the Admin UI epic |
| Tenant Admin | Manages tenant users, connectors, and settings | High | Can sign in and reach the tenant-facing admin route tree |
| Tenant User | Uses the admin UI for permitted actions | High | Can sign in and see only the screens and actions their role allows |
| Platform Admin | Operates the platform across tenants | High | Can sign in and reach the Platform Admin route tree |
| Security & Architecture Reviewer | Reviews ADR and implementation | Medium | Clear evidence that tokens are server-side and role-gating is layered correctly |

---

## 6. Current State (As-Is)

`social-listening-admin` is an empty shell: no Next.js scaffold, no pages or route tree, and no sign-in mechanism. Only `src/lib/core-client.ts` and the Story 1.1 contract exist. The module reads `CORE_API_BASE_URL` from a non-`NEXT_PUBLIC_` environment variable, which means it is intended to run only in server-side Node.js code, not in the browser.

On the core side, `social-listening-core` already validates Entra External ID tokens (Story 5.6), resolves them through `resolveIdentity()` (Story 5.9 / ADR-0032), and attaches the resolved identity to every authenticated `/v1` route through `createTenantAuthMiddleware()` (Story 5.10). However, no HTTP endpoint exposes that resolved identity back to the caller, so the admin UI has no way to know whether a signed-in user is a `tenant_admin`, `tenant_user`, or `platform_admin` without calling `core`.

**Pain points:**
- No secure session mechanism exists for the admin UI.
- No core endpoint returns the resolved identity the UI needs for role-gating.
- A client-side token design would force a rewrite of `core-client.ts` and reintroduce XSS token-theft risk.
- Without this foundation, the rest of the Admin UI epic (connectors, watchlists, Platform Admin console) cannot be built.

---

## 7. Future State (To-Be)

After implementation, `social-listening-admin` is a real Next.js (App Router) application. An unauthenticated user visiting any page is redirected to a sign-in page. Sign-in performs an Authorization Code + PKCE exchange with the Entra External ID tenant entirely in a server-side Route Handler. The resulting tokens are stored in an encrypted server-side session; the browser receives only an opaque session cookie. `src/lib/core-client.ts` reads the session on every call and attaches the bearer token itself, remaining the only module that does so.

The admin UI calls `GET /v1/me` on `social-listening-core` after sign-in, receives the resolved identity (`tenant_user` or `platform_admin` with the associated IDs and role), and stores that in the server-side session. Coarse Next.js Middleware redirects unauthenticated traffic to sign-in. Server-side layout or route checks then decide whether to render the tenant-facing tree or the Platform Admin tree, and whether to show `tenant_admin`-only affordances such as tenant-wide connector connect actions.

**Expected capabilities:**
- Secure, tokenless-in-browser sign-in for `tenant_admin`, `tenant_user`, and `platform_admin` callers.
- 8-hour absolute session ceiling enforced server-side.
- Single `core-client.ts` choke point for all authenticated core API calls.
- Role-appropriate navigation and affordances without creating a second source of role truth.
- Graceful sign-out and session expiry handling.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The admin UI shall provide a server-side sign-in flow using Authorization Code + PKCE against the Entra External ID tenant | Must | A real sign-in succeeds against the live Entra tenant; no token values reach the browser JS | Product Owner |
| BR-002 | The session shall be represented by an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` cookie | Must | Cookie flags and encryption verified directly; oversized token payloads handled without exposing values to the client | Product Owner |
| BR-003 | Each environment shall register an exact-match `redirect_uri` on the Entra app registration | Must | A mismatched `redirect_uri` is rejected by Entra before the application processes the response | Product Owner |
| BR-004 | `core-client.ts` shall remain the sole module that attaches the `Authorization: Bearer <token>` header for core API calls | Must | Structural check finds no second ad-hoc bearer-token construction elsewhere in `src/` | Product Owner |
| BR-005 | The admin UI shall obtain the resolved identity from a new core `GET /v1/me` endpoint and store it in the server-side session | Must | The resolved identity matches `resolveIdentity()` output; identity is never derived from Entra token claims | Product Owner |
| BR-006 | The UI shall apply layered role gating: a coarse unauthenticated-redirect layer and a per-request resolved-identity layer | Must | Unauthenticated requests redirect to sign-in; `platform_admin` and `tenant_user` reach their correct route trees; `tenant_admin`-only actions are hidden from `tenant_user` | Product Owner |
| BR-007 | The session shall enforce an 8-hour absolute maximum lifetime from sign-in, regardless of activity | Must | A session older than 8 hours is rejected and the caller is redirected to sign-in, even on active use | Product Owner |
| BR-008 | The sign-out action shall clear the server-side session and the browser cookie | Must | After sign-out, the prior session cannot be reused to reach a protected page | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No bearer, access, or refresh token shall be placed in browser-reachable storage or rendered HTML | Security | Must | Contract tests confirm absence of token values in cookies, headers sent to client, and HTML payloads |
| NFR-002 | Unauthenticated middleware redirects shall complete within the Next.js runtime budget | Performance | Should | No measurable delay beyond the standard Next.js Middleware/Route Handler overhead |
| NFR-003 | Session expiry and invalid-session states shall redirect the caller to sign-in without exposing raw errors | Reliability | Must | Contract tests show clean redirect for expired, missing, or tampered sessions |
| NFR-004 | The v1 implementation shall prefer a generic, minimal OIDC/PKCE library over an unverified Entra-External-ID-specific auth framework | Maintainability | Must | Code review confirms no third-party auth framework is adopted at v1 unless Entra External ID support is verified first |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Bearer, access, and refresh tokens shall never be placed in `localStorage`, `sessionStorage`, client-readable cookies, or any value reachable by browser JavaScript. |
| BRU-002 | `src/lib/core-client.ts` is the only module in `social-listening-admin` that constructs the `Authorization: Bearer <token>` header for `social-listening-core`. |
| BRU-003 | The admin UI shall determine role and tenant from the `GET /v1/me` response, never by decoding the Entra-issued token’s claims. |
| BRU-004 | The authorization request’s `redirect_uri` must be an exact-match, pre-registered value on the `social-listening-admin` Entra app registration; wildcards and pattern URIs are prohibited. |
| BRU-005 | The session cookie encryption key must have at least 256 bits of entropy, be sourced from an environment variable, and never be committed to source control. |
| BRU-006 | A session is valid for a maximum of 8 hours from the original sign-in, enforced server-side regardless of user activity. |
| BRU-007 | UI role-gating is a usability convenience; the real security boundary is `social-listening-core`’s Row-Level Security and application-layer 403 responses. |
| BRU-008 | `GET /v1/me` shall derive the returned identity exclusively from the caller’s validated bearer token; client-supplied `tenantId`, `userId`, `adminId`, or `role` overrides are ignored. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Session cookie reference | Opaque `{ sid }` or equivalent encrypted reference to a server-side session | `social-listening-admin` server-side session store | `social-listening-admin` | Medium (session control) |
| Resolved identity | `{ type, tenantId?, userId?, role?, adminId? }` returned by `GET /v1/me` | `social-listening-core` (`resolveIdentity()`) | `social-listening-core` | High (role / tenant membership) |
| Entra tokens | id_token, access_token, refresh_token obtained during sign-in | Microsoft Entra External ID | Microsoft / Tenant | Very High |
| Session encryption key | 256-bit random application secret used to encrypt the session cookie | Environment variable | `social-listening-admin` ops | Very High |
| `redirect_uri` registry | Exact URIs pre-registered in the Entra app registration for each environment | Microsoft Entra admin portal | Operations | High |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Successful vs. failed sign-in attempts | Detect authentication anomalies or Entra configuration drift | Product Owner / Operations | Daily during rollout |
| Session expiry events | Confirm the 8-hour ceiling is enforced as expected | Security Reviewer / Product Owner | Weekly |
| Core-client bearer attachment failures | Catch regressions in the single-choke-point pattern | Product Owner | Continuous (CI) |
| Role-gated route mismatch incidents | Measure whether UI role checks align with core 403 responses | Product Owner | Monthly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Hand-building PKCE/redirect logic creates ongoing maintenance burden | Medium | High | Revisit Auth.js/NextAuth.js once its Entra External ID support is verified directly; keep the OIDC flow minimal | Product Owner |
| R-002 | `GET /v1/me` endpoint was missing when Story 6.1 was drafted | Low (resolved) | High | Build Story 5.11 in `social-listening-core` before completing end-to-end Story 6.1 ACs; already accepted and built | Product Owner |
| R-003 | No real production secrets-management strategy exists for application-level keys | Medium | High | Enforce 256-bit random keys, env-var-only provisioning, and never commit values; track broader gap in `docs/open-items-and-deferred-work.md` | Product Owner |
| R-004 | BFF pattern constrains all future admin UI screens to server-side data fetching | Medium | Medium | Document the constraint in the component skill; design every later screen against Server Components/Route Handlers/Server Actions | Product Owner |
| R-005 | Entra token set exceeds browser cookie size, forcing an in-memory session store | Low (resolved) | Medium | Use a small encrypted `{ sid }` reference instead of storing tokens in the cookie; document load-bearing constraints | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Entra External ID tenant and `social-listening-admin` app registration with exact-match redirect URIs | External | Operations / Menno | 2026-08-04 (provisioned with Story 6.1) |
| D-002 | `social-listening-core` `GET /v1/me` endpoint (Story 5.11) | Internal | `social-listening-core` delivery | 2026-08-05 (built and contract-verified) |
| D-003 | `src/lib/core-client.ts` single-choke-point contract (Story 1.1) | Internal | `social-listening-admin` | Already exists |
| D-004 | Next.js App Router server-side cookie / session APIs | Internal | `social-listening-admin` | Story 6.1 implementation |
| D-005 | ADR-0029 §2 (Entra as pluggable OIDC token issuer; role not in token claims) | Internal (governing) | Architecture | Accepted |
| D-006 | ADR-0035 (one role-gated app, two route trees) | Internal (governing) | Architecture | Accepted |

---

## 14. Acceptance Criteria

- Unauthenticated requests to any admin UI route (other than the sign-in page) redirect to sign-in.
- Sign-in completes a real Authorization Code + PKCE exchange against the live Entra External ID tenant.
- The authorization request uses an exact-match `redirect_uri` registered on the app registration.
- The session cookie is `httpOnly`, `Secure`, `SameSite=Lax`, and its encryption key is at least 256 bits of real randomness stored in an environment variable.
- No bearer, access, or refresh token appears in browser-readable storage, server-rendered HTML, or client-side JavaScript.
- `core-client.ts` is the only module that builds `Authorization: Bearer <token>`; no ad-hoc bearer construction exists elsewhere.
- After sign-in, the UI calls `GET /v1/me` and stores the resolved identity from `social-listening-core` in the server-side session; the resolved identity is never derived from Entra claims.
- `GET /v1/me` in `social-listening-core` returns only `req.identity` and ignores any client-supplied identity override.
- `tenant_admin`, `tenant_user`, and `platform_admin` callers are routed to or shown the correct screens and affordances.
- A `tenant_user` does not see `tenant_admin`-only affordances, but the underlying core still returns `403` if an unauthorized call is made.
- Sessions expire after an 8-hour absolute lifetime from sign-in, regardless of activity, and redirect to sign-in on the next request.
- Sign-out clears the session and cookie, and the prior session cannot be reused.

---

## 15. Glossary

| Term | Definition |
|---|---|
| BFF (Backend-for-Frontend) | A pattern where the server-side UI layer owns token handling and the browser never sees API access tokens. |
| PKCE | Proof Key for Code Exchange, an OAuth 2.0 extension that prevents authorization-code interception. |
| `httpOnly` cookie | A cookie flag that prevents JavaScript from reading the cookie value. |
| Resolved identity | The result of `resolveIdentity()`: either `{ type: 'tenant_user', tenantId, userId, role }` or `{ type: 'platform_admin', adminId }`. |
| Entra External ID | Microsoft’s CIAM identity product used for tenant and platform-admin sign-in. |
| Role gating | Hiding or redirecting UI routes and actions based on the caller’s resolved role; not the real security boundary. |
| Session ceiling | The hard 8-hour absolute maximum lifetime of an admin UI session. |
| Exact-match redirect URI | A pre-registered `redirect_uri` value that must match the authorization request exactly, with no wildcards. |

---

## 16. Appendices

### Reference documents

- `docs/adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md` — source ADR (Accepted 2026-08-04).
- `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.1 (Next.js scaffold and Entra sign-in) and Story 6.2 (role-gated routing shell).
- `docs/user-stories/epic-5-security-isolation-and-messaging.md` — Story 5.11 (`GET /v1/me` core identity endpoint).
- `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` — closest related feature design, used only for context; it is not a dedicated admin-auth feature design.
- `social-listening-admin/.claude/skills/admin-auth-session/SKILL.md` — implementation skill describing the BFF session constraints and the `src/proxy.ts` naming convention.
- `social-listening-admin/src/lib/core-client.ts` and `.claude/skills/core-api-client/SKILL.md` — existing server-only core client and choke-point contract.

### Missing source note

No dedicated `docs/product-research/feature-designs/<admin-auth>.md` file and no `docs/product-research/reports/<admin-auth>-deep-research.md` file were found for ADR-0036. This BRD was produced from the ADR, the related user stories, and the closest feature-design cross-reference (12-multi-user-workspaces-and-rbac.md).

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-04 |
| Product Owner | Menno | | 2026-08-04 |
| Technical Lead | Menno | | 2026-08-04 |
| Other Stakeholder | (Security & Architecture Reviewer) | | |
