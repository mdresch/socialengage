# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0033 Retire `X-Tenant-Id` as the Tenant-Identity Trust Mechanism — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0033-retire-x-tenant-id-header-placeholder.md, ../Business-Requirements/BRD-0033-Retire-X-Tenant-Id-Header-Placeholder.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0033-retire-x-tenant-id-header-placeholder.md and the business requirements in BRD-0033-Retire-X-Tenant-Id-Header-Placeholder.md into functional design for **Retire X Tenant Id Header Placeholder**.
SocialEngage's every `/v1` endpoint currently trusts a client-supplied `X-Tenant-Id` header as the entire tenant-identity boundary. This means any caller can claim any `tenantId` simply by setting a header, leaving the tenant boundary entirely unauthenticated. The project's own risk register (`Business-Case-v6.0.md` Risk R-04) rates this as a release-blocking, high-severity spoofing risk.

This BRD records the business requirements for retiring `X-Tenant-Id` as a trust mechanism. Instead of trusting a client header, every `/v1` request must carry `Authorization: Bearer <token>`, which is validated and resolved server-side to a `ResolvedIdentity` (tenant, user, role) in a single middleware mounted at the top of the `/v1` router stack. The existing tenant-scoped functions keep their exact signatures; only the top-of-stack source of the `tenantId` value changes.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing vector, a single cryptographically verified source of tenant identity across all `/v1` routes, preservation of the existing function-call surface, and a one-time, coordinated cutover that does not require a `/v2` API version under the documented ADR-0017 exception.

---

### 2.2 Scope
**In scope:**
- Removing `X-Tenant-Id` as a trust source from every existing `/v1` route handler (`connectorsRouter.ts`, `watchlistsRouter.ts`, `postsRouter.ts`, `topicsRouter.ts`, and any others).
- Mounting the bearer-token authentication/identity-resolution middleware once at the top of the `/v1` router stack, not per-route.
- Updating the source of `tenantId` passed into all existing tenant-scoped helper functions from the resolved request identity.
- Reworking the existing contract-test suite to establish tenant context without relying on `X-Tenant-Id`.
- Treating any client-supplied `X-Tenant-Id` header as inert — it may be logged, but it must never influence authorization, tenant scoping, or responses.
- Documenting the reasoned, one-time exception to ADR-0017's version-bump requirement.

**Out of scope:**
- Introducing a `/v2` API version for this change (ADR-0017 exception applies only to this one-time authentication cutover).
- Staging a transitional period in which both `X-Tenant-Id` and bearer tokens are accepted as trust sources.
- Implementing per-connector, per-watchlist, or fine-grained permissions beyond the existing `tenant_admin`/`tenant_user`/`platform_admin` roles.
- Building new admin-UI screens (covered in Epic 6 / `social-listening-admin`).
- Changing the underlying Entra External ID OIDC issuer configuration or the token-validation rules (governed by ADR-0029).

## 3. Context and Background
Every `/v1` router in `social-listening-core` (`connectorsRouter.ts`, `watchlistsRouter.ts`, `postsRouter`, `topicsRouter`, and every contract test exercising them — 132/132 currently passing, per `docs/implementation-plan.md`) trusts a client-supplied `X-Tenant-Id` header as its entire tenant-identity boundary, verified directly in `connectorsRouter.ts`: `const tenantId = req.header('X-Tenant-Id')`. `Business-Case-v6.0.md`'s own Risk R-04 rates this "High (certain, if triggered)... release-blocking... once external users are contemplated." ADR-0029–0032 now give this project a real authentication mechanism and a real path from a validated token to a resolved `(tenantId, userId, role)`. This ADR is the mechanical cutover: retiring the header everywhere it is currently trusted.
SocialEngage's every `/v1` endpoint currently trusts a client-supplied `X-Tenant-Id` header as the entire tenant-identity boundary. This means any caller can claim any `tenantId` simply by setting a header, leaving the tenant boundary entirely unauthenticated. The project's own risk register (`Business-Case-v6.0.md` Risk R-04) rates this as a release-blocking, high-severity spoofing risk.

This BRD records the business requirements for retiring `X-Tenant-Id` as a trust mechanism. Instead of trusting a client header, every `/v1` request must carry `Authorization: Bearer <token>`, which is validated and resolved server-side to a `ResolvedIdentity` (tenant, user, role) in a single middleware mounted at the top of the `/v1` router stack. The existing tenant-scoped functions keep their exact signatures; only the top-of-stack source of the `tenantId` value changes.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing vector, a single cryptographically verified source of tenant identity across all `/v1` routes, preservation of the existing function-call surface, and a one-time, coordinated cutover that does not require a `/v2` API version under the documented ADR-0017 exception.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the release-blocking `X-Tenant-Id` tenant-identity spoofing risk (Risk R-04) | No `/v1` route reads `X-Tenant-Id`; a mismatched header has zero effect on behavior, verified by tests |
| 2 | Establish a single, server-side source of tenant identity for all `/v1` endpoints | 100% of `/v1` requests derive `tenantId` from a validated bearer token resolved by the auth middleware |
| 3 | Minimize the production-code blast radius of the cutover | All tenant-scoped functions (`withTenant`, `storeCredential`, `getCachedConnectorHealth`, etc.) retain their existing signatures; only the call site supplying `tenantId` changes |
| 4 | Execute a coordinated, one-time cutover with `social-listening-admin` | Admin UI is updated in the same deployment window; no independent downstream consumer is broken, per the documented ADR-0017 exception |

---

**Positive consequences (from ADR):**
**Positive**
- Closes `Business-Case-v6.0.md`'s Risk R-04 directly — the single dependency every other row in that document's own dependency matrix sits behind.
- The "one seam, not every function" design (§2) keeps this genuinely foundational change's *code* blast radius small, even though its *test* blast radius (§5) is large.

**Negative**
- **This is, without qualification, the largest blast-radius change in this entire seven-ADR batch.** Every one of this project's ~130+ existing contract tests that sets `X-Tenant-Id` needs rework to keep passing once the header stops being trusted — this is stated plainly, not softened, because minimizing the *production* code seam (§2) does not shrink the *test* rework (§5) at all.
- Any transitional period accepting both mechanisms (kept for safety while tests are migrated) reopens the exact spoofing vector §3 exists to close, unless the header is demoted to fully inert (read, logged, and discarded) rather than genuinely accepted as a fallback — a real operational tension between "make the migration easier" and "close the security gap immediately," named here rather than resolved by wishful thinking.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall reject every `/v1` request that lacks a valid `Authorization: Bearer` token with `401` before it reaches a protected handler | Must | Contract test confirms `401` for missing, malformed, and wrong-issuer tokens | Backend Engineering |
| BR-002 | The system shall derive `tenantId` for every `/v1` endpoint exclusively from the token-resolved `ResolvedIdentity` | Must | No `/v1` handler uses `req.header('X-Tenant-Id')` to set the tenant context | Backend Engineering |
| BR-003 | The system shall ignore any `X-Tenant-Id` header present in a request and never allow it to override the token-resolved tenant | Must | A test sending a mismatched `X-Tenant-Id` confirms no behavior change or data leak | Backend Engineering |
| BR-004 | The system shall keep every existing tenant-scoped function signature unchanged; only the call site supplying `tenantId` may change | Must | Code review confirms `withTenant`, `storeCredential`, `getCachedConnectorHealth`, and similar helpers are untouched except at call sites | Backend Engineering |
| BR-005 | The system shall run the existing contract-test suite without any test relying on `X-Tenant-Id` as the authentication mechanism | Must | Full suite passes after tests are migrated to an approved test harness | QA / Backend Engineering |
| BR-006 | The system shall mount the token-validation and identity-resolution middleware once at the top of the `/v1` stack | Must | `createV1Router()` (or equivalent) mounts one shared middleware; no route re-implements auth | Backend Engineering |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Admin / Security & Compliance Reviewer | Owns security posture and audit | High | Cryptographic tenant boundary, no client-trusted header, auditability of privileged access |
| Backend Engineer | Implements auth middleware and route changes | High | Clear single seam, unchanged downstream signatures, deterministic test harness |
| QA / Contract-Test Author | Reworks ~130+ contract tests | High | A reliable test-only authentication mechanism, full suite green before merge |
| Product Owner | Owns release readiness and scope | Medium | Spoofing risk closed without expanding scope to v2 or permissions redesign |
| Tenant Admin | Manages users and connectors | Medium | Continued ability to manage tenant-scoped data without workflow disruption |
| Tenant User | Uses watchlists and posts | Medium | No visible change to sign-in or data access, except the underlying auth is stronger |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.9 | epic-5-security-isolation-and-messaging.md | As authenticated caller, I want my Entra identity resolved to my SocialEngage tenant, role, and status before any tenant-scoped query runs, so that every sub... | `users` has an active RLS policy identical in shape to every other tenant-scoped table (`tenant_id = current_setting('app.tenant_id', ...)`).; A narrowly-sco... |
| Story 5.10 | epic-5-security-isolation-and-messaging.md | As platform operator responsible for this project's own stated security posture, I want every `/v1` endpoint to derive tenant identity exclusively from a val... | No `/v1` route reads `req.header('X-Tenant-Id')` to determine tenant identity — verified by a repository-wide check (or equivalent test) that no route handle... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Authorization: Bearer` token | Entra-issued access token presented by the client | HTTP request header → Entra External ID | Backend / Security | Authentication secret (transient) |
| `X-Tenant-Id` header | Client-supplied, untrusted header; retained only as inert input | HTTP request header | Client / Backend | Untrusted; must not be used for authorization |
| `ResolvedIdentity` (`tenantId`, `userId`, `role`) | Server-side caller context resolved from token and `users`/`platform_admins` tables | `resolveIdentity()` + Postgres | Backend | PII / role context (internal) |
| RLS tenant context | `tenant_id` set on the database session via `withTenant()` | `withTenant()` using resolved `tenantId` | Backend | Internal authorization context |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A client-supplied `X-Tenant-Id` header is untrusted and inert; it must never influence authorization, tenant scoping, or response content. |
| BRU-002 | The token-resolved `ResolvedIdentity` is the single source of truth for `tenantId`, `userId`, and `role` on every request. |
| BRU-003 | No `/v1` route handler may independently re-read or re-validate tenant identity outside the shared middleware. |
| BRU-004 | The ADR-0017 API-versioning exception is limited to this one-time authentication-mechanism cutover and does not apply to future breaking changes. |
| BRU-005 | Every contract test that previously set `X-Tenant-Id` must obtain tenant context through an approved test-harness mechanism before the build is considered passing. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0029 — Entra token validation | Architectural | Sponsor | In place |
| D-002 | ADR-0031 / ADR-0032 — `tenants`/`users` schemas and `resolveIdentity()` | Architectural | Sponsor | In place via Story 5.9 |
| D-003 | ADR-0030 — Platform-admin bypass and audit boundaries | Architectural | Sponsor | In place |
| D-004 | Story 5.9 — Request-time identity resolution | Internal | Backend Engineering | Ready in Phase 4.5 |
| D-005 | `social-listening-admin` coordinated bearer-token cutover | Internal | Frontend Engineering | Same release window as Story 5.10 |
| D-006 | `Business-Case-v6.0.md` Risk R-04 (business context) | Reference | Product Owner | In place |
| D-007 | ADR-0017 — API versioning policy (exception noted) | Reference | Tech Lead | In place |

---

- ADR-0029 (Entra token validation), ADR-0030 (bypass/audit), ADR-0031/ADR-0032 (`tenants`/`users` schemas and identity resolution), and Story 5.9 are in place or ready.
- The only current consumer of `/v1` is the same-project `social-listening-admin`, so a coordinated one-time cutover is possible.
- The existing ~130+ contract tests can be updated to use an approved test-harness authentication mechanism.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No `/v1` endpoint may rely on a client-supplied `X-Tenant-Id` header for authentication or tenant boundary | Security | Must | Repository-wide search and a dedicated spoof test confirm zero trust of the header |
| NFR-002 | Identity resolution must happen in exactly one middleware per request | Maintainability / Performance | Must | Code review shows one middleware at the top of `/v1`; no per-route re-validation |
| NFR-003 | No alternative client-supplied tenant-identity source may be introduced alongside the bearer token | Security | Must | Architecture review confirms `ResolvedIdentity` is the only tenant source |
| NFR-004 | Any test-only authentication bypass or test-JWKS mechanism must be environment-gated and unreachable in production | Security / Compliance | Must | Build artifact review and environment checks confirm test harnesses do not ship to production |

---

## 11. Error Handling and Exceptions
**Positive**
- Closes `Business-Case-v6.0.md`'s Risk R-04 directly — the single dependency every other row in that document's own dependency matrix sits behind.
- The "one seam, not every function" design (§2) keeps this genuinely foundational change's *code* blast radius small, even though its *test* blast radius (§5) is large.

**Negative**
- **This is, without qualification, the largest blast-radius change in this entire seven-ADR batch.** Every one of this project's ~130+ existing contract tests that sets `X-Tenant-Id` needs rework to keep passing once the header stops being trusted — this is stated plainly, not softened, because minimizing the *production* code seam (§2) does not shrink the *test* rework (§5) at all.
- Any transitional period accepting both mechanisms (kept for safety while tests are migrated) reopens the exact spoofing vector §3 exists to close, unless the header is demoted to fully inert (read, logged, and discarded) rather than genuinely accepted as a fallback — a real operational tension between "make the migration easier" and "close the security gap immediately," named here rather than resolved by wishful thinking.

## 12. Assumptions and Dependencies
- ADR-0029 (Entra token validation), ADR-0030 (bypass/audit), ADR-0031/ADR-0032 (`tenants`/`users` schemas and identity resolution), and Story 5.9 are in place or ready.
- The only current consumer of `/v1` is the same-project `social-listening-admin`, so a coordinated one-time cutover is possible.
- The existing ~130+ contract tests can be updated to use an approved test-harness authentication mechanism.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Substantial rework of ~130+ contract tests delays the cutover | High | High | Allocate explicit Story 5.10 time, use an approved test harness, and run full-suite validation | QA / Backend Engineering |
| R-002 | A residual `X-Tenant-Id` reference remains trusted in a route handler | Medium | High | Repository-wide search, dedicated spoof tests, and security code review | Security / Backend Engineering |
| R-003 | `social-listening-admin` and `social-listening-core` are released out of sync | Medium | Medium | Coordinate the cutover in the same deployment window; use the existing `GET /v1/me` contract already committed by Story 6.1 | Product Owner / Backend Engineering |
| R-004 | A staged transition re-accepts `X-Tenant-Id`, reopening the spoofing vector | Medium | High | Enforce ADR-0033 §3: header is inert; never merge both trust mechanisms | Security / Tech Lead |
| R-005 | The ADR-0017 exception is mistakenly reused for future breaking changes | Low | Medium | Document the exception as narrow and one-time; require a new ADR for any similar departure | Tech Lead |

---

## 14. Appendix
- ADR: `../../adr/0033-retire-x-tenant-id-header-placeholder.md`
- BRD: `../Business-Requirements/BRD-0033-Retire-X-Tenant-Id-Header-Placeholder.md`
- Feature design: `docs/product-research/feature-designs/11-api-and-integrations.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above