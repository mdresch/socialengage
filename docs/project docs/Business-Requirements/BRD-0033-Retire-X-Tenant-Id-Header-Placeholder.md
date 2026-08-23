# BRD-0033 — Retire `X-Tenant-Id` as the Tenant-Identity Trust Mechanism

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Retire `X-Tenant-Id` as the Tenant-Identity Trust Mechanism Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | AI Business & Requirements Analyst | Initial draft from ADR-0033, Story 5.10, and related feature design |
| 1.0 | 2026-08-19 | AI Business & Requirements Analyst | Approved per ADR-0033 acceptance (2026-08-03) |

---

## 2. Executive Summary

SocialEngage's every `/v1` endpoint currently trusts a client-supplied `X-Tenant-Id` header as the entire tenant-identity boundary. This means any caller can claim any `tenantId` simply by setting a header, leaving the tenant boundary entirely unauthenticated. The project's own risk register (`Business-Case-v6.0.md` Risk R-04) rates this as a release-blocking, high-severity spoofing risk.

This BRD records the business requirements for retiring `X-Tenant-Id` as a trust mechanism. Instead of trusting a client header, every `/v1` request must carry `Authorization: Bearer <token>`, which is validated and resolved server-side to a `ResolvedIdentity` (tenant, user, role) in a single middleware mounted at the top of the `/v1` router stack. The existing tenant-scoped functions keep their exact signatures; only the top-of-stack source of the `tenantId` value changes.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing vector, a single cryptographically verified source of tenant identity across all `/v1` routes, preservation of the existing function-call surface, and a one-time, coordinated cutover that does not require a `/v2` API version under the documented ADR-0017 exception.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the release-blocking `X-Tenant-Id` tenant-identity spoofing risk (Risk R-04) | No `/v1` route reads `X-Tenant-Id`; a mismatched header has zero effect on behavior, verified by tests |
| 2 | Establish a single, server-side source of tenant identity for all `/v1` endpoints | 100% of `/v1` requests derive `tenantId` from a validated bearer token resolved by the auth middleware |
| 3 | Minimize the production-code blast radius of the cutover | All tenant-scoped functions (`withTenant`, `storeCredential`, `getCachedConnectorHealth`, etc.) retain their existing signatures; only the call site supplying `tenantId` changes |
| 4 | Execute a coordinated, one-time cutover with `social-listening-admin` | Admin UI is updated in the same deployment window; no independent downstream consumer is broken, per the documented ADR-0017 exception |

---

## 4. Scope

### 4.1 In Scope

- Removing `X-Tenant-Id` as a trust source from every existing `/v1` route handler (`connectorsRouter.ts`, `watchlistsRouter.ts`, `postsRouter.ts`, `topicsRouter.ts`, and any others).
- Mounting the bearer-token authentication/identity-resolution middleware once at the top of the `/v1` router stack, not per-route.
- Updating the source of `tenantId` passed into all existing tenant-scoped helper functions from the resolved request identity.
- Reworking the existing contract-test suite to establish tenant context without relying on `X-Tenant-Id`.
- Treating any client-supplied `X-Tenant-Id` header as inert — it may be logged, but it must never influence authorization, tenant scoping, or responses.
- Documenting the reasoned, one-time exception to ADR-0017's version-bump requirement.

### 4.2 Out of Scope

- Introducing a `/v2` API version for this change (ADR-0017 exception applies only to this one-time authentication cutover).
- Staging a transitional period in which both `X-Tenant-Id` and bearer tokens are accepted as trust sources.
- Implementing per-connector, per-watchlist, or fine-grained permissions beyond the existing `tenant_admin`/`tenant_user`/`platform_admin` roles.
- Building new admin-UI screens (covered in Epic 6 / `social-listening-admin`).
- Changing the underlying Entra External ID OIDC issuer configuration or the token-validation rules (governed by ADR-0029).

### 4.3 Assumptions

- ADR-0029 (Entra token validation), ADR-0030 (bypass/audit), ADR-0031/ADR-0032 (`tenants`/`users` schemas and identity resolution), and Story 5.9 are in place or ready.
- The only current consumer of `/v1` is the same-project `social-listening-admin`, so a coordinated one-time cutover is possible.
- The existing ~130+ contract tests can be updated to use an approved test-harness authentication mechanism.

### 4.4 Constraints

- `X-Tenant-Id` must not be trusted once the change ships.
- Auth/identity resolution must not be duplicated in each route handler.
- The contract-test rework is large and must be completed before the build passes.
- The ADR-0017 exception is explicitly narrow and does not weaken the policy for future breaking changes.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Admin / Security & Compliance Reviewer | Owns security posture and audit | High | Cryptographic tenant boundary, no client-trusted header, auditability of privileged access |
| Backend Engineer | Implements auth middleware and route changes | High | Clear single seam, unchanged downstream signatures, deterministic test harness |
| QA / Contract-Test Author | Reworks ~130+ contract tests | High | A reliable test-only authentication mechanism, full suite green before merge |
| Product Owner | Owns release readiness and scope | Medium | Spoofing risk closed without expanding scope to v2 or permissions redesign |
| Tenant Admin | Manages users and connectors | Medium | Continued ability to manage tenant-scoped data without workflow disruption |
| Tenant User | Uses watchlists and posts | Medium | No visible change to sign-in or data access, except the underlying auth is stronger |

---

## 6. Current State (As-Is)

**Current process:**
1. A client sends a request to any `/v1` endpoint with an `X-Tenant-Id` header.
2. The route handler reads `req.header('X-Tenant-Id')` directly.
3. The handler passes the header value into tenant-scoped helpers and `withTenant(tenantId, ...)`.
4. Row-Level Security (RLS) uses the claimed `tenantId` for query scoping.

**Pain points:**
- Any caller can claim any `tenantId`, creating a direct tenant-boundary spoofing risk.
- There is no cryptographic verification of the caller's identity or tenant membership.
- The risk register flags this as a release-blocking issue once external users are considered.
- The test suite depends on the same header, masking the security gap under passing tests.

---

## 7. Future State (To-Be)

**New or improved process:**
1. Every `/v1` request carries `Authorization: Bearer <Entra-issued token>`.
2. A single authentication middleware validates the token (per ADR-0029) and resolves it to a `ResolvedIdentity` (`tenantId`, `userId`, `role`) per ADR-0032.
3. The middleware attaches the resolved identity to `req` once, at the top of the `/v1` stack.
4. Route handlers and helpers continue to call `withTenant(tenantId, ...)`, `storeCredential(tenantId, ...)`, etc., but the `tenantId` now comes from `req.identity.tenantId`.
5. If a client also sends `X-Tenant-Id`, the value is ignored; if the `Authorization` token is missing or invalid, the request is rejected with `401` before any protected handler runs.

**Expected capabilities:**
- A cryptographic, server-side tenant boundary across all `/v1` endpoints.
- One auth/identity seam, not duplicated per route.
- No production route trusts a client-supplied `X-Tenant-Id`.
- A test-only authentication replacement for the contract suite that does not affect production.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall reject every `/v1` request that lacks a valid `Authorization: Bearer` token with `401` before it reaches a protected handler | Must | Contract test confirms `401` for missing, malformed, and wrong-issuer tokens | Backend Engineering |
| BR-002 | The system shall derive `tenantId` for every `/v1` endpoint exclusively from the token-resolved `ResolvedIdentity` | Must | No `/v1` handler uses `req.header('X-Tenant-Id')` to set the tenant context | Backend Engineering |
| BR-003 | The system shall ignore any `X-Tenant-Id` header present in a request and never allow it to override the token-resolved tenant | Must | A test sending a mismatched `X-Tenant-Id` confirms no behavior change or data leak | Backend Engineering |
| BR-004 | The system shall keep every existing tenant-scoped function signature unchanged; only the call site supplying `tenantId` may change | Must | Code review confirms `withTenant`, `storeCredential`, `getCachedConnectorHealth`, and similar helpers are untouched except at call sites | Backend Engineering |
| BR-005 | The system shall run the existing contract-test suite without any test relying on `X-Tenant-Id` as the authentication mechanism | Must | Full suite passes after tests are migrated to an approved test harness | QA / Backend Engineering |
| BR-006 | The system shall mount the token-validation and identity-resolution middleware once at the top of the `/v1` stack | Must | `createV1Router()` (or equivalent) mounts one shared middleware; no route re-implements auth | Backend Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No `/v1` endpoint may rely on a client-supplied `X-Tenant-Id` header for authentication or tenant boundary | Security | Must | Repository-wide search and a dedicated spoof test confirm zero trust of the header |
| NFR-002 | Identity resolution must happen in exactly one middleware per request | Maintainability / Performance | Must | Code review shows one middleware at the top of `/v1`; no per-route re-validation |
| NFR-003 | No alternative client-supplied tenant-identity source may be introduced alongside the bearer token | Security | Must | Architecture review confirms `ResolvedIdentity` is the only tenant source |
| NFR-004 | Any test-only authentication bypass or test-JWKS mechanism must be environment-gated and unreachable in production | Security / Compliance | Must | Build artifact review and environment checks confirm test harnesses do not ship to production |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A client-supplied `X-Tenant-Id` header is untrusted and inert; it must never influence authorization, tenant scoping, or response content. |
| BRU-002 | The token-resolved `ResolvedIdentity` is the single source of truth for `tenantId`, `userId`, and `role` on every request. |
| BRU-003 | No `/v1` route handler may independently re-read or re-validate tenant identity outside the shared middleware. |
| BRU-004 | The ADR-0017 API-versioning exception is limited to this one-time authentication-mechanism cutover and does not apply to future breaking changes. |
| BRU-005 | Every contract test that previously set `X-Tenant-Id` must obtain tenant context through an approved test-harness mechanism before the build is considered passing. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `Authorization: Bearer` token | Entra-issued access token presented by the client | HTTP request header → Entra External ID | Backend / Security | Authentication secret (transient) |
| `X-Tenant-Id` header | Client-supplied, untrusted header; retained only as inert input | HTTP request header | Client / Backend | Untrusted; must not be used for authorization |
| `ResolvedIdentity` (`tenantId`, `userId`, `role`) | Server-side caller context resolved from token and `users`/`platform_admins` tables | `resolveIdentity()` + Postgres | Backend | PII / role context (internal) |
| RLS tenant context | `tenant_id` set on the database session via `withTenant()` | `withTenant()` using resolved `tenantId` | Backend | Internal authorization context |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Contract-test migration coverage | Track % of tests no longer relying on `X-Tenant-Id` | QA / Backend | Daily during cutover |
| `/v1` authentication rejection rate | Monitor 401/403 rates after deployment | Security / Backend | Per release / ongoing |
| `X-Tenant-Id` trust-source scan | Ensure no `/v1` handler reintroduces header trust | Security / Backend | Per PR and per release |
| Route-handler auth audit | Count of routes still referencing `req.header('X-Tenant-Id')` | Tech Lead | Per release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Substantial rework of ~130+ contract tests delays the cutover | High | High | Allocate explicit Story 5.10 time, use an approved test harness, and run full-suite validation | QA / Backend Engineering |
| R-002 | A residual `X-Tenant-Id` reference remains trusted in a route handler | Medium | High | Repository-wide search, dedicated spoof tests, and security code review | Security / Backend Engineering |
| R-003 | `social-listening-admin` and `social-listening-core` are released out of sync | Medium | Medium | Coordinate the cutover in the same deployment window; use the existing `GET /v1/me` contract already committed by Story 6.1 | Product Owner / Backend Engineering |
| R-004 | A staged transition re-accepts `X-Tenant-Id`, reopening the spoofing vector | Medium | High | Enforce ADR-0033 §3: header is inert; never merge both trust mechanisms | Security / Tech Lead |
| R-005 | The ADR-0017 exception is mistakenly reused for future breaking changes | Low | Medium | Document the exception as narrow and one-time; require a new ADR for any similar departure | Tech Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- No `/v1` route reads `req.header('X-Tenant-Id')` to determine tenant identity — verified by a repository-wide check (or equivalent test) that no route handler references it as a trust source.
- A request that includes an `X-Tenant-Id` header is unaffected by its value — the resolved, token-derived tenant is used regardless of what the header claims, verified by a test sending a mismatched header and confirming no behavior change or data leak.
- Every existing tenant-scoped function's signature (`withTenant`, `storeCredential`, `getCachedConnectorHealth`, etc.) is unchanged — only the call site supplying `tenantId` changes.
- A request with a missing or invalid `Authorization` token is rejected (`401`) before reaching any route handler that previously trusted `X-Tenant-Id`.

---

## 15. Glossary

| Term | Definition |
|---|---|
| ADR | Architecture Decision Record |
| `ResolvedIdentity` | The server-side object (`tenantId`, `userId`, `role` or `adminId`) resolved from a validated bearer token and the `users`/`platform_admins` tables |
| `X-Tenant-Id` | The client-supplied HTTP header that is being retired as a tenant-identity trust mechanism |
| Bearer token | An Entra-issued access token presented in the `Authorization: Bearer` header |
| Tenant boundary | The logical and technical separation that ensures one tenant's data is not accessible to another |
| Spoofing | The ability of a client to falsify its identity or tenant membership, e.g., by setting an arbitrary header |
| RLS | Row-Level Security in Postgres, which enforces tenant scoping at the database query layer |
| Middleware | Code that runs before a route handler, in this case to validate tokens and resolve identity |
| Contract tests | Fast, deterministic tests that exercise a component's public contract and behavior |
| ADR-0017 exception | The documented, one-time departure from the API-versioning policy for this authentication cutover |

---

## 16. Appendices

### 16.1 Reference documents

- [ADR-0033: Retire `X-Tenant-Id` as the tenant-identity trust mechanism](../../adr/0033-retire-x-tenant-id-header-placeholder.md)
- [Business-Case-v6.0.md — Risk R-04 context](../Business-Case-v6.0.md)
- [Feature design: 12 — Multi-user workspaces and RBAC](../../product-research/feature-designs/12-multi-user-workspaces-and-rbac.md)

### 16.2 Related user stories

- [Story 5.10 — Retire `X-Tenant-Id` as a trust mechanism](../../user-stories/epic-5-security-isolation-and-messaging.md)

### 16.3 Related ADRs

- [ADR-0029: Authentication mechanism (Microsoft Entra External ID)](../../adr/0029-authentication-mechanism-entra-external-id.md)
- [ADR-0030: Admin tier design and platform-admin RLS exception](../../adr/0030-admin-tier-design-platform-admin-rls-exception.md)
- [ADR-0031: `tenants` schema and identity resolution](../../adr/0031-tenants-schema-and-identity-resolution.md)
- [ADR-0032: `users` table, RLS, and request-time identity resolution](../../adr/0032-users-table-rls-and-request-time-identity-resolution.md)
- [ADR-0017: API versioning and compatibility policy](../../adr/0017-api-versioning-and-compatibility-policy.md)

### 16.4 Deep-research brief

No dedicated `docs/product-research/reports/<feature>-deep-research.md` file was found for this ADR. Business and security context is drawn from the source ADR, `Business-Case-v6.0.md` Risk R-04, and the related multi-user-workspaces-and-RBAC feature design.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-19 |
| Product Owner | Menno | | 2026-08-19 |
| Technical Lead | Menno | | 2026-08-19 |
| Other Stakeholder | — | | |
