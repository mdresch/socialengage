# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0036 Admin UI Authentication, Session and Role-Gating Mechanism — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md, ../Business-Requirements/BRD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0036-admin-ui-authentication-session-and-role-gating-mechanism.md and the business requirements in BRD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md into functional design for **Admin UI Authentication Session And Role Gating Mechanism**.
The `social-listening-admin` Next.js application needs its own secure authentication and session mechanism before any admin screens can be built. The back-end already validates Entra External ID bearer tokens and resolves them to a concrete role (`tenant_admin`, `tenant_user`, or `platform_admin`) through `resolveIdentity()` in `social-listening-core`, but the admin UI has no sign-in flow, no session state, and no safe way to attach tokens to core API calls. In addition, Entra’s own token does not carry role or tenant membership, so the UI must ask `social-listening-core` for the caller’s resolved identity.

The accepted architecture (ADR-0036) is a server-side, Backend-for-Frontend (BFF) session: the browser never holds a bearer or refresh token. The authorization code and PKCE exchange are performed in a Next.js Route Handler, tokens are stored in an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie, and `src/lib/core-client.ts` remains the single place that attaches `Authorization: Bearer <token>` to requests. Role-gating in the UI is a layered UX convenience — a coarse middleware redirect for unauthenticated callers and a per-request resolved-identity check to render the right route tree and affordances — while the real security boundary remains `social-listening-core`’s Row-Level Security and application-layer role checks.

This BRD captures the business requirements, dependencies, and acceptance criteria needed to implement the first real admin sign-in and role-gating scaffold (Story 6.1) and the prerequisite `GET /v1/me` core identity endpoint (Story 5.11).

---

### 2.2 Scope
**In scope:**
- A server-side, BFF-style sign-in flow using Authorization Code + PKCE against the Entra External ID tenant already provisioned in `social-listening-core`.
- An encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie storing a server-side session reference; exact library/implementation left to the implementation story.
- `core-client.ts` as the single choke point for attaching the bearer token to every `social-listening-core` call.
- Exact-match redirect-URI registration per environment on the `social-listening-admin` Entra app registration.
- A hard, server-side 8-hour absolute session lifetime from sign-in, regardless of activity.
- Core-side `GET /v1/me` identity-exposure endpoint that returns `resolveIdentity()`’s result and is derived exclusively from the caller’s validated bearer token.
- Two-layer role gating in the UI: coarse unauthenticated-redirect middleware and a per-request role check that decides which route tree and affordances to render.
- Graceful redirect to sign-in when a session is missing, invalid, or expired.
- Server-side sign-out that clears the session and cookie.

**Out of scope:**
- Adopting a third-party auth framework (e.g., Auth.js/NextAuth.js) at v1; the decision is to hand-build a minimal OIDC/PKCE flow with a generic library and revisit Auth.js only after its Entra External ID support is verified.
- Client-side token storage or any design that exposes bearer tokens to browser JavaScript.
- A dedicated product-research feature design for this BRD; no matching feature design was found (see Appendices).
- Solving the broader application-level secrets-management strategy for production (e.g., key vault rotation, multi-environment provisioning); this BRD states the minimum key-management requirements only.

## 3. Context and Background
Real backend authentication now exists and is fully wired: Story 5.6 (ADR-0029) validates an Entra External ID bearer token; Story 5.9 (ADR-0032 §5) resolves it via `resolveIdentity()` to `{ type: 'tenant_user', tenantId, userId, role }` or `{ type: 'platform_admin', adminId }`; Story 5.10 (ADR-0033) mounts both as `createTenantAuthMiddleware()`, the one seam every `/v1` route (except `/v1/health`) now requires. `social-listening-admin` has none of this — no Next.js scaffold exists at all (confirmed directly: `package.json` carries no `next`/`react` dependency; `src/` contains only `lib/core-client.ts`), so the admin UI's own sign-in flow, session mechanism, and how it attaches a bearer token to its calls into core are all still fully undecided.

Three things this project has already decided constrain, without fully answering, this question:

- **ADR-0029 §2** states the admin UI's sign-in flow "may reasonably use a standard OIDC client library, including Microsoft's, for the interactive redirect/PKCE dance itself — that is a UI-layer implementation choice, not an architectural dependency the core inherits." This settles that the *core* never depends on which library the UI picks; it does not settle what the UI itself should do, and is not itself an ADR for the UI's own mechanism.
- **ADR-0029 §2** also states, without qualification: tenant membership, role, and license status are "owned and enforced exclusively by SocialEngage's own Postgres tables... never inferred from any Entra-side group membership, organizational-role claim, or directory attribute." This has a direct, previously unstated consequence for the admin UI: **it cannot determine a signed-in caller's role (`tenant_admin` vs `tenant_user` vs Platform Admin) by decoding the Entra-issued token itself** — role isn't in the token's claims at all, by this project's own design. The UI must ask `social-listening-core` for the resolved identity. **No endpoint for this exists.** Checked directly: `src/identity/identityResolution.ts`'s `resolveIdentity()` is called only internally, inside `createTenantAuthMiddleware()`, and attached to `req.identity` for route handlers to read via `requireTenantUser()`/`requireTenantUserIdentity()` — nothing exposes the resolved identity itself over HTTP. This is a real, previously unnamed gap, not a hypothetical one.
- **`src/lib/core-client.ts`'s own existing design already implies an answer to where the bearer token must live.** It reads its base URL from `process.env.CORE_API_BASE_URL` — a bare environment variable, not a `NEXT_PUBLIC_`-prefixed one — which Next.js only ever inlines into server-side code, never into a browser bundle. This module, as it exists today (Story 1.1, unmodified since), can only run in a Node.js/server context (a Route Handler, Server Component, or Server Action), not in client-side JavaScript. Any admin-UI authentication design that requires the browser to hold and directly attach a bearer token to `core-client.ts`'s own calls would be incompatible with this already-shipped module without first rewriting it — a real, concrete piece of evidence, not a hypothetical preference, for where session state needs to live.

**Why this is architecturally significant enough for its own ADR, applying this series' own bar (ADR-0027/0028/0035's "one user story per ADR" default, departed from only for a stated, checked reason):** unlike Story 1.5's watchlist CRUD or Story 1.6/1.7's connect/disconnect endpoints — ordinary CRUD surface this project's own convention (`docs/implementation-plan.md`, `docs/user-stories/README.md`) already treats as not warranting an ADR — this decision is not a new field or endpoint shape. It is a hard-to-reverse choice with real security consequences (where a bearer token physically lives; whether it is ever reachable by an XSS payload in the browser), a real new cross-repo dependency this project did not previously know it needed (a core-side identity-exposure endpoint), and a real trade-off between a maintained third-party library and this project's own "thin, pluggable OIDC issuer" principle (ADR-0029 §2) that a future maintainer would have to re-derive from scratch if it weren't written down now. It is the direct UI-side analogue of Story 5.6 being "the root; nothing else in this phase can be built first" for the backend — every other admin-UI story (connect flow, watchlist management, connector status, Platform Admin console) needs this decided first.
The `social-listening-admin` Next.js application needs its own secure authentication and session mechanism before any admin screens can be built. The back-end already validates Entra External ID bearer tokens and resolves them to a concrete role (`tenant_admin`, `tenant_user`, or `platform_admin`) through `resolveIdentity()` in `social-listening-core`, but the admin UI has no sign-in flow, no session state, and no safe way to attach tokens to core API calls. In addition, Entra’s own token does not carry role or tenant membership, so the UI must ask `social-listening-core` for the caller’s resolved identity.

The accepted architecture (ADR-0036) is a server-side, Backend-for-Frontend (BFF) session: the browser never holds a bearer or refresh token. The authorization code and PKCE exchange are performed in a Next.js Route Handler, tokens are stored in an encrypted, `httpOnly`, `Secure`, `SameSite=Lax` session cookie, and `src/lib/core-client.ts` remains the single place that attaches `Authorization: Bearer <token>` to requests. Role-gating in the UI is a layered UX convenience — a coarse middleware redirect for unauthenticated callers and a per-request resolved-identity check to render the right route tree and affordances — while the real security boundary remains `social-listening-core`’s Row-Level Security and application-layer role checks.

This BRD captures the business requirements, dependencies, and acceptance criteria needed to implement the first real admin sign-in and role-gating scaffold (Story 6.1) and the prerequisite `GET /v1/me` core identity endpoint (Story 5.11).

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Ensure admin UI session tokens are never exposed to browser JavaScript | No bearer, access, or refresh token is present in `localStorage`, `sessionStorage`, client-readable cookies, or rendered HTML; verified by contract tests |
| 2 | Re-use the core identity model across the UI and API | The UI renders only the route tree and actions that match the resolved identity returned by `GET /v1/me`; no second, UI-only notion of role is created |
| 3 | Keep the existing `core-client.ts` choke point intact | `core-client.ts` is the only module in `social-listening-admin` that constructs the `Authorization` header for core API calls |
| 4 | Enable the rest of the Admin UI epic to build on a stable auth foundation | Stories 6.2–6.6 are unblocked and can rely on the shared session and role-gating mechanism |
| 5 | Limit the blast radius of common client-side vulnerabilities | A successful XSS attack in the admin UI cannot leak a bearer token because no token is accessible to browser JS |

---

**Positive consequences (from ADR):**
**Positive**
- Reuses ADR-0029/ADR-0032's identity model exactly — no second, UI-side notion of "role" is invented; the UI is a consumer of the same resolved identity the backend already computes, not a second source of truth for it (consistent with ADR-0029 §3's own "exactly one source of truth per field" principle).
- Bounds the admin UI's own XSS blast radius concretely: no bearer/refresh token is ever placed anywhere a browser-side script could read it, regardless of what other client-side code this UI eventually ships.
- No rework required to `core-client.ts`'s already-shipped, Story-1.1-contract-verified environment-variable design — the server-side-session decision is the one consistent with what already exists, not a competing design that would force a change to already-tested code.
- Role-gating's two-layer shape mirrors the backend's own already-proven pattern (one seam plus a per-route check) rather than introducing an unrelated design for the UI half of this project — less conceptual drift for whoever maintains both repos (today, only Menno).

**Negative**
- **A real, new, previously-unnamed cross-repo dependency:** `GET /v1/me` (or equivalent) does not exist in `social-listening-core` today — confirmed directly, not assumed. Story 6.1 (below) cannot be built end-to-end until it exists. `docs/implementation-plan.md`'s existing Phase 1/Phase 3 "also build, not storied" framing did not previously name this gap.
- **Rejecting NextAuth.js/Auth.js at v1 is a real cost, not a costless caution.** It means hand-building and maintaining PKCE/redirect/token-exchange/refresh logic that a maintained library would otherwise absorb — genuine, ongoing solo-developer maintenance burden, accepted here specifically because the one piece this project actually needs (Entra External ID/CIAM support) is not confirmed solid in that library, not because bespoke auth code is preferred in general. If Story 6.1's own implementation-time verification finds Auth.js's CIAM support solid after all, this trade-off should be revisited, not treated as permanently settled by this ADR.
- **This ADR's own verification of Auth.js's Entra External ID support is a web-search-level check, not the primary-source depth ADR-0029 held its own Entra claims to** (reading Microsoft's or Auth.js's own documentation directly, or attempting a real sign-in). Named honestly as a real limit on this Decision's own evidentiary basis, not glossed over — Open Questions, below.
- The BFF/session-cookie pattern requires the admin UI's screens to be built consistently against Next.js's server-side data-fetching model (Server Components/Route Handlers/Server Actions calling `core-client.ts`), not a client-side-fetch-heavy SPA style — a real constraint on every future admin-UI story's own implementation approach, not just Story 6.1's.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno (Sponsor / Product Owner / Solo Developer) | Authorizes the architecture, owns both repos | High | A secure, maintainable auth scaffold that unblocks the rest of the Admin UI epic |
| Tenant Admin | Manages tenant users, connectors, and settings | High | Can sign in and reach the tenant-facing admin route tree |
| Tenant User | Uses the admin UI for permitted actions | High | Can sign in and see only the screens and actions their role allows |
| Platform Admin | Operates the platform across tenants | High | Can sign in and reach the Platform Admin route tree |
| Security & Architecture Reviewer | Reviews ADR and implementation | Medium | Clear evidence that tokens are server-side and role-gating is layered correctly |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.11 | epic-5-security-isolation-and-messaging.md | As admin UI (or any future authenticated REST caller) that holds a validated bearer token but has no way to know its own resolved tenant/role/Platform-Admin ... | `GET /v1/me` is mounted in `createV1Router()` (`src/http/versions/v1/router.ts`) behind the same `authMiddleware` (`createTenantAuthMiddleware()`) every othe... |
| Story 5.12 | epic-5-security-isolation-and-messaging.md |  | `GET /v1/admin/tenants` lists every tenant (`id`, `name`, `domain`, `status`, `licenseSeatCount`, `activeSeatCount`, `createdAt`) — reachable only through a ... |
| Story 5.17 | epic-5-security-isolation-and-messaging.md | As Tenant-Admin (or Platform Admin, for the break-glass path), I want every change to a user's `access_ends_at` durably recorded — who changed it, when, and ... | `user_access_audit_log` (new table): `id`, `tenant_id`, `user_id`, `changed_by` (the acting user's own `id`), `previous_value` (nullable timestamptz), `new_v... |
| Story 6.1 | epic-6-tenant-admin-ui.md | As admin UI developer standing up the first real screen this project has ever shipped, I want `social-listening-admin` scaffolded as a real Next.js app with ... | `social-listening-admin` is a real Next.js (App Router) application — `next`/`react` are real dependencies, a `pages/`-or-`app/`-rooted structure exists — wh... |
| Story 6.2 | epic-6-tenant-admin-ui.md |  | Two structurally separate route trees exist: a tenant-facing tree (for `tenant_admin`/`tenant_user` resolved identities) and a Platform-Admin-facing tree (fo... |
| Story 6.7 | epic-6-tenant-admin-ui.md | As brand-new user who is not yet part of any SocialEngage tenant, I want to sign up and, if I'm the first person from my organization to do so, become the Te... | A "Sign up" entry point exists alongside Story 6.1's sign-in page, distinct from it, and triggers Entra External ID's own self-service sign-up user flow (con... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Session cookie reference | Opaque `{ sid }` or equivalent encrypted reference to a server-side session | `social-listening-admin` server-side session store | `social-listening-admin` | Medium (session control) |
| Resolved identity | `{ type, tenantId?, userId?, role?, adminId? }` returned by `GET /v1/me` | `social-listening-core` (`resolveIdentity()`) | `social-listening-core` | High (role / tenant membership) |
| Entra tokens | id_token, access_token, refresh_token obtained during sign-in | Microsoft Entra External ID | Microsoft / Tenant | Very High |
| Session encryption key | 256-bit random application secret used to encrypt the session cookie | Environment variable | `social-listening-admin` ops | Very High |
| `redirect_uri` registry | Exact URIs pre-registered in the Entra app registration for each environment | Microsoft Entra admin portal | Operations | High |

---

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Entra External ID tenant and `social-listening-admin` app registration with exact-match redirect URIs | External | Operations / Menno | 2026-08-04 (provisioned with Story 6.1) |
| D-002 | `social-listening-core` `GET /v1/me` endpoint (Story 5.11) | Internal | `social-listening-core` delivery | 2026-08-05 (built and contract-verified) |
| D-003 | `src/lib/core-client.ts` single-choke-point contract (Story 1.1) | Internal | `social-listening-admin` | Already exists |
| D-004 | Next.js App Router server-side cookie / session APIs | Internal | `social-listening-admin` | Story 6.1 implementation |
| D-005 | ADR-0029 §2 (Entra as pluggable OIDC token issuer; role not in token claims) | Internal (governing) | Architecture | Accepted |
| D-006 | ADR-0035 (one role-gated app, two route trees) | Internal (governing) | Architecture | Accepted |

---

- The Entra External ID tenant and test app registration provisioned for `social-listening-core` can be reused or extended for `social-listening-admin`.
- `social-listening-admin` will be a Next.js App Router application, and its data fetching will be server-side (Route Handlers, Server Components, or Server Actions).
- `core-client.ts`’s current environment-variable design remains the only path to `social-listening-core`; the session must be compatible with that server-only pattern.
- `social-listening-core` already provides `resolveIdentity()` and the `createTenantAuthMiddleware()` seam; the UI only needs a new, read-only HTTP surface for that result.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No bearer, access, or refresh token shall be placed in browser-reachable storage or rendered HTML | Security | Must | Contract tests confirm absence of token values in cookies, headers sent to client, and HTML payloads |
| NFR-002 | Unauthenticated middleware redirects shall complete within the Next.js runtime budget | Performance | Should | No measurable delay beyond the standard Next.js Middleware/Route Handler overhead |
| NFR-003 | Session expiry and invalid-session states shall redirect the caller to sign-in without exposing raw errors | Reliability | Must | Contract tests show clean redirect for expired, missing, or tampered sessions |
| NFR-004 | The v1 implementation shall prefer a generic, minimal OIDC/PKCE library over an unverified Entra-External-ID-specific auth framework | Maintainability | Must | Code review confirms no third-party auth framework is adopted at v1 unless Entra External ID support is verified first |

---

## 11. Error Handling and Exceptions
**Positive**
- Reuses ADR-0029/ADR-0032's identity model exactly — no second, UI-side notion of "role" is invented; the UI is a consumer of the same resolved identity the backend already computes, not a second source of truth for it (consistent with ADR-0029 §3's own "exactly one source of truth per field" principle).
- Bounds the admin UI's own XSS blast radius concretely: no bearer/refresh token is ever placed anywhere a browser-side script could read it, regardless of what other client-side code this UI eventually ships.
- No rework required to `core-client.ts`'s already-shipped, Story-1.1-contract-verified environment-variable design — the server-side-session decision is the one consistent with what already exists, not a competing design that would force a change to already-tested code.
- Role-gating's two-layer shape mirrors the backend's own already-proven pattern (one seam plus a per-route check) rather than introducing an unrelated design for the UI half of this project — less conceptual drift for whoever maintains both repos (today, only Menno).

**Negative**
- **A real, new, previously-unnamed cross-repo dependency:** `GET /v1/me` (or equivalent) does not exist in `social-listening-core` today — confirmed directly, not assumed. Story 6.1 (below) cannot be built end-to-end until it exists. `docs/implementation-plan.md`'s existing Phase 1/Phase 3 "also build, not storied" framing did not previously name this gap.
- **Rejecting NextAuth.js/Auth.js at v1 is a real cost, not a costless caution.** It means hand-building and maintaining PKCE/redirect/token-exchange/refresh logic that a maintained library would otherwise absorb — genuine, ongoing solo-developer maintenance burden, accepted here specifically because the one piece this project actually needs (Entra External ID/CIAM support) is not confirmed solid in that library, not because bespoke auth code is preferred in general. If Story 6.1's own implementation-time verification finds Auth.js's CIAM support solid after all, this trade-off should be revisited, not treated as permanently settled by this ADR.
- **This ADR's own verification of Auth.js's Entra External ID support is a web-search-level check, not the primary-source depth ADR-0029 held its own Entra claims to** (reading Microsoft's or Auth.js's own documentation directly, or attempting a real sign-in). Named honestly as a real limit on this Decision's own evidentiary basis, not glossed over — Open Questions, below.
- The BFF/session-cookie pattern requires the admin UI's screens to be built consistently against Next.js's server-side data-fetching model (Server Components/Route Handlers/Server Actions calling `core-client.ts`), not a client-side-fetch-heavy SPA style — a real constraint on every future admin-UI story's own implementation approach, not just Story 6.1's.

## 12. Assumptions and Dependencies
- The Entra External ID tenant and test app registration provisioned for `social-listening-core` can be reused or extended for `social-listening-admin`.
- `social-listening-admin` will be a Next.js App Router application, and its data fetching will be server-side (Route Handlers, Server Components, or Server Actions).
- `core-client.ts`’s current environment-variable design remains the only path to `social-listening-core`; the session must be compatible with that server-only pattern.
- `social-listening-core` already provides `resolveIdentity()` and the `createTenantAuthMiddleware()` seam; the UI only needs a new, read-only HTTP surface for that result.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Hand-building PKCE/redirect logic creates ongoing maintenance burden | Medium | High | Revisit Auth.js/NextAuth.js once its Entra External ID support is verified directly; keep the OIDC flow minimal | Product Owner |
| R-002 | `GET /v1/me` endpoint was missing when Story 6.1 was drafted | Low (resolved) | High | Build Story 5.11 in `social-listening-core` before completing end-to-end Story 6.1 ACs; already accepted and built | Product Owner |
| R-003 | No real production secrets-management strategy exists for application-level keys | Medium | High | Enforce 256-bit random keys, env-var-only provisioning, and never commit values; track broader gap in `docs/open-items-and-deferred-work.md` | Product Owner |
| R-004 | BFF pattern constrains all future admin UI screens to server-side data fetching | Medium | Medium | Document the constraint in the component skill; design every later screen against Server Components/Route Handlers/Server Actions | Product Owner |
| R-005 | Entra token set exceeds browser cookie size, forcing an in-memory session store | Low (resolved) | Medium | Use a small encrypted `{ sid }` reference instead of storing tokens in the cookie; document load-bearing constraints | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0036-admin-ui-authentication-session-and-role-gating-mechanism.md`
- BRD: `../Business-Requirements/BRD-0036-Admin-UI-Authentication-Session-And-Role-Gating-Mechanism.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md``
- Feature design: `docs/product-research/feature-designs/<admin-auth>.md``
- Deep research: `docs/product-research/reports/<admin-auth>-deep-research.md``
- User stories: see extracted stories above