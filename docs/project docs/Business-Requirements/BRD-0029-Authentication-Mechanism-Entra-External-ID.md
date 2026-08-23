# BRD-0029 — Authentication Mechanism: Microsoft Entra External ID

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Authentication Mechanism: Microsoft Entra External ID Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-19 | AI Business & Requirements Analyst | Initial draft from ADR-0029, Story 5.6, and related feature designs |
| 1.0 | 2026-08-19 | AI Business & Requirements Analyst | Approved per ADR-0029 acceptance (2026-08-03) |

---

## 2. Executive Summary

SocialEngage currently has no authentication mechanism. Every `/v1` endpoint relies on a client-supplied `X-Tenant-Id` header as the entire tenant boundary, which the project risk register rates as High/High and release-blocking once external users are contemplated. This BRD establishes the business requirements for replacing that trust-on-the-client mechanism with a real, cryptographically verified authentication layer.

The approved solution is to integrate **Microsoft Entra External ID** as a thin, pluggable OpenID Connect (OIDC) token issuer. SocialEngage will provision exactly one Entra "external tenant" that is shared by every SocialEngage customer organization. Two app registrations inside that tenant will support the admin web UI and the core API. The backend will validate bearer tokens using standard OIDC/JWKS discovery only, will never call Entra-specific APIs to make authorization decisions, and will treat the token's `sub` claim as the canonical external identifier. Tenant membership, role, and license status will continue to live exclusively in SocialEngage's own Postgres tables and RLS policies.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing risk, alignment with the project's established Azure-native precedent, a free-tier CIAM option at current scale, and a bounded migration path should a different OIDC provider ever be chosen.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the release-blocking authentication gap and retire trust in the client-supplied `X-Tenant-Id` header | Every `/v1` request is rejected (`401`) when it lacks a valid, verified bearer token |
| 2 | Adopt an Azure-native customer-identity provider consistent with the existing Key Vault/Service Bus/Postgres precedent | Microsoft Entra External ID is the sole supported authentication provider at launch |
| 3 | Keep the core authorization path provider-portable so future migration is bounded | No Entra-specific SDK or Microsoft Graph call is used in `social-listening-core` request authorization |
| 4 | Enforce the project's invite-only, license-gated onboarding model | Any authenticated caller with no matching `invited` user row is rejected at the application layer |
| 5 | Maintain a single source of truth for each user data field | Profile, role, and license data are owned by Postgres; Entra carries only bare OIDC auth claims |

---

## 4. Scope

### 4.1 In Scope

- Selection and use of **Microsoft Entra External ID** as the project's initial CIAM / OIDC provider.
- Provisioning of exactly one Entra "external tenant" shared across all SocialEngage customer organizations.
- Creation of two app registrations inside that tenant: `social-listening-admin` (interactive client, Authorization Code + PKCE) and `social-listening-core` (API resource whose access tokens the core validates).
- Standard OIDC/JWKS token validation inside `social-listening-core` for every `/v1` request.
- Extraction and propagation of the `sub` claim as the canonical external identifier.
- The rule that tenant membership, role, and license data are enforced exclusively by SocialEngage's own Postgres tables and RLS policies.
- Application-layer enforcement of the invite-only onboarding model: a matching `invited` user row must exist before an Entra-authenticated caller is admitted.
- The data-ownership principle: one owner per field, no dual-write or sync model.

### 4.2 Out of Scope

- One Entra tenant per SocialEngage customer organization.
- A bespoke username/password + session-store authentication implementation.
- Auth0, Clerk, Supabase Auth, or Firebase Authentication as the initial provider (they remain viable future migrations only).
- Machine-to-machine (M2M) / client-credentials authentication.
- Cross-tenant B2B federation with each customer's own Microsoft 365/Entra workforce directory.
- Detailed admin UI sign-in/session implementation (governed by ADR-0036 and Story 6.1).
- The detailed `tenants`/`users` table schema, RLS policies, and request-time identity resolution (governed by ADR-0031/0032 and Stories 5.8–5.9).
- The final removal of `X-Tenant-Id` from all route handlers (governed by ADR-0033 and Story 5.10).

### 4.3 Assumptions

- The project has or will create an Azure subscription capable of hosting one Entra External ID tenant.
- The first 50,000 monthly active users (MAU) free tier will cover current and near-term volume.
- The solo-operator scale of the project means a single Entra external tenant is operationally appropriate.
- No enterprise customer requires B2B federation or Active Directory attribute sync in v1.

### 4.4 Constraints

- Entra External ID is the selected provider and is not re-litigated at this stage.
- The core authorization path must not depend on any Entra-specific SDK or Microsoft Graph API.
- The design must preserve the option to migrate to another OIDC-compliant provider with minimal authorization-model rework.
- The solution must respect the ownership-tier rules established in ADR-0028 for credential creation.
- The invite-only application check cannot be bypassed by Entra's own self-service sign-up user flow.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Provisions tenant, invites users, manages seats | High | Secure sign-in, clear invite flow, no spoofing of tenant context |
| Tenant-User | Signs in to consume/curate social listening data | High | Reliable, familiar Microsoft sign-in experience |
| Platform-Admin | Operates the platform and creates/suspends tenants | High | Audited, narrowly-scoped admin access without bypassing auth |
| Menno | Sponsor, Product Owner, Technical Lead | High | Azure-native, free at current scale, portable, no bespoke auth |
| Security / Compliance reviewer | Validates security posture | High | Cryptographic token verification, no `X-Tenant-Id` trust, auditability |
| Engineering / Delivery team | Builds and maintains the system | Medium | Clear boundaries, standard libraries, no provider lock-in in core |

---

## 6. Current State (As-Is)

**Current process:**

1. Every `/v1` endpoint receives a client-supplied `X-Tenant-Id` header.
2. The header is treated as the entire tenant boundary for the request.
3. Application and database access control rely on this self-declared value.

**Pain points:**

- Any client can claim any `X-Tenant-Id` value, creating a direct tenant-boundary spoofing risk.
- The project risk register (`Business-Case-v6.0.md` §2/§6, Risk R-04) rates this as High likelihood / High impact and release-blocking for external users.
- There is no cryptographic proof of caller identity, so there is no basis for role- or license-aware access decisions.
- The current model blocks the project's multi-tenant product ambitions because it cannot safely onboard real customers.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Every request to `social-listening-core` presents an `Authorization: Bearer <token>` header.
2. The core validates the token's issuer, signature, and audience using standard OIDC discovery and the Entra tenant's published JWKS endpoint.
3. The core extracts the `sub` claim and passes it to request-time identity resolution, which looks up the caller in SocialEngage's own `users` or Platform Admin tables.
4. Once resolved, the caller's `tenant_id`, `user_id`, `role`, and `status` set the Postgres RLS session context for all downstream queries.
5. The admin UI obtains tokens for the interactive client using a standard OIDC redirect/PKCE flow and stores them in a server-side BFF session.
6. An authenticated caller with no matching invited user or Platform Admin record is rejected at the application layer (`401`/`403`).

**Expected capabilities:**

- Every `/v1` request is cryptographically authenticated before any application logic runs.
- Tenant, role, and license status are resolved from SocialEngage's own Postgres data, not inferred from Entra directory constructs.
- The core's authorization model remains intact if the OIDC provider is later swapped.
- Onboarding remains invite-only and license-gated even though the IdP may permit self-service sign-up.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall validate every bearer token's signature and issuer against the Entra external tenant's published JWKS/OIDC discovery document before authorizing any `/v1` request | Must | A request with an invalid, expired, or wrong-issuer token is rejected with `401` before any route handler executes | Engineering |
| BR-002 | Token validation in `social-listening-core` shall use only standard, generic JWT/OIDC verification | Must | No Entra-specific SDK (e.g. MSAL) or Microsoft Graph API call is made on the request-authorization path | Engineering |
| BR-003 | The system shall extract the token's `sub` claim and make it available to downstream identity resolution as an opaque string | Must | `sub` is the only claim used to match `users.external_subject` or `platform_admins.external_subject`; `tid` and `oid` are not used for this purpose | Engineering |
| BR-004 | The system shall create exactly two app registrations inside the single Entra external tenant: `social-listening-admin` (interactive client, Authorization Code + PKCE) and `social-listening-core` (API resource) | Must | Both registrations exist in the same external tenant; the core validates tokens issued for the `social-listening-core` audience | Engineering |
| BR-005 | The system shall interpret the Entra `tid` claim as the same constant value for all callers and never use it to determine SocialEngage tenant membership | Must | No code path maps `tid` to a SocialEngage `tenant_id` | Engineering |
| BR-006 | The system shall enforce invite-only onboarding at the application layer | Must | An authenticated Entra sign-in with no matching `invited` user row for that email is rejected (`401`/`403`); upon first successful sign-in, `external_subject` is populated from `sub` and status moves to `active` | Engineering |
| BR-007 | The system shall store and enforce tenant membership, role, and license/seat status exclusively in SocialEngage's own Postgres tables and RLS policies | Must | Profile/role/license data are not fetched from Entra groups, directory roles, or organizational attributes | Engineering |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No `/v1` endpoint may rely on a client-supplied `X-Tenant-Id` header for authentication or tenant boundary | Security | Must | Repository-wide check or test confirms no route handler trusts the header |
| NFR-002 | Missing or malformed `Authorization` headers are rejected before any tenant-scoped query | Reliability | Must | A request with no token receives `401` and is not treated as anonymous/default tenant |
| NFR-003 | The core's token validation layer is Entra-agnostic except for issuer/JWKS configuration values | Maintainability | Must | Code review confirms no Entra-specific library in the core authorization path |
| NFR-004 | Invite-only onboarding is auditable and cannot be bypassed by a valid Entra token alone | Compliance | Should | Contract tests prove an uninvited but valid token is rejected |
| NFR-005 | Monthly active user (MAU) volume is tracked so the 50,000 free-tier limit is visible | Scalability | Should | A dashboard or log metric reports unique authenticated users per month |
| NFR-006 | OIDC issuer, JWKS URI, and audience values are external configuration, not hard-coded | Maintainability | Should | A configuration change can point the core at a different OIDC provider without code edits |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The Entra `tid` claim is constant across all SocialEngage tenants and must never be read or used to determine SocialEngage tenant membership. |
| BRU-002 | The `sub` claim is the only canonical external identifier; it is used purely as an opaque foreign key into Postgres and is never treated as an authorization decision itself. |
| BRU-003 | `social-listening-core` must not call an Entra-specific SDK or Microsoft Graph API to make any authorization decision at request time. |
| BRU-004 | A person may sign in only if a `users` row in `invited` status exists for their email; at first successful sign-in, `external_subject` is set from the token's `sub` and status moves to `active`. |
| BRU-005 | Every user data field has exactly one owner: by default Postgres; exception A is live data from an external platform via the user's own credential; exception B is a field explicitly assigned to Entra at the time it is introduced. No field is ever owned by two systems. |
| BRU-006 | Exactly two app registrations are created inside one shared Entra external tenant: `social-listening-admin` and `social-listening-core`. |
| BRU-007 | While ADR-0037 self-service tenant sign-up remains live, Entra's own user-flow self-service sign-up must not be restricted at the IdP configuration level. |
| BRU-008 | The `oid` claim, even if present in the token, must never be used to match `users.external_subject` or `platform_admins.external_subject`; only `sub` is permitted. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Bearer token (ID / access) | Short-lived JWT issued by Entra External ID; carries `sub`, `email`, `tid`, possibly `oid` | Microsoft Entra External ID | Microsoft / Entra tenant | High – authentication credential |
| `sub` claim | Opaque, immutable subject identifier for the caller | Entra token | Microsoft | High – links to user record |
| `users.external_subject` | Link between an Entra `sub` and a SocialEngage user | Postgres `users` table | SocialEngage | High – identity mapping |
| `users.email` | Email used at invitation and matched to Entra token email at first sign-in | Postgres `users` table | SocialEngage | Personal data |
| `users.status` | `invited` or `active`; controls whether a resolved user may proceed | Postgres `users` table | SocialEngage | Operational |
| `users.role` | `tenant_user` or `tenant_admin`; used for role gating | Postgres `users` table | SocialEngage | Operational |
| `users.tenant_id` | SocialEngage tenant the user belongs to | Postgres `users` table | SocialEngage | Operational |
| `platform_admins.external_subject` | Link between an Entra `sub` and a Platform Admin | Postgres platform-admin table | SocialEngage | High – identity mapping |
| Entra external tenant metadata | Tenant ID, issuer URL, JWKS URI, client IDs | Azure portal / infrastructure config | SocialEngage / Azure | High – infrastructure configuration |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Monthly active users (MAU) | Track Entra free-tier consumption and anticipate overage | Finance / Menno | Monthly |
| Token validation failure rate | Detect misconfigured clients, expired tokens, or attacks | Security / Engineering | Real-time / daily |
| Successful sign-in count | Measure adoption and onboarding throughput | Product / Menno | Daily |
| Unmatched-token rejection count | Monitor invite-only enforcement effectiveness | Security / Engineering | Daily |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Provider lock-in: password hashes and Entra sign-up/sign-in UI customizations are not portable to another CIAM provider | Medium | Medium | Keep the core authorization model entirely in Postgres/RLS; a future swap only requires re-pointing OIDC config and rebuilding the UI sign-up flow, not the authorization model | Technical Lead |
| R-002 | Per-MAU overage price beyond the 50,000 free tier is not confirmed | Medium | Medium | Monitor MAU monthly; verify pricing directly with Microsoft before crossing the free threshold | Product Owner |
| R-003 | A bug in the application-layer invite check allows an uninvited but valid Entra user to sign in | Low | High | Cover the check with contract tests and consider defense-in-depth review of the user-flow configuration | Engineering |
| R-004 | Confusion between `oid` and `sub` claims leads to `external_subject` being seeded with the wrong value | Medium | High | Use only `sub` for matching; verify against a real token before any production seeding; update operational skill guidance | Engineering |
| R-005 | Entra's own self-service sign-up cannot be disabled cleanly at the tenant level while still allowing invited first sign-in | Low | Medium | Rely on the application-layer rejection as the primary control; revisit IdP-level restrictions only in a separate, explicitly-scoped decision | Security |
| R-006 | A future provider swap forces every existing user through a password reset or re-linking window | Low | Medium | Plan for a parallel-running re-link or forced-reset window as part of any future migration | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0028 (credential-creation authority tiers) | Internal | Technical Lead | Already accepted – governs who can create tenant-wide vs. user-bound credentials |
| D-002 | ADR-0031 (`tenants` table and RLS) | Internal | Technical Lead | Already accepted – provides the tenant target for identity resolution |
| D-003 | ADR-0032 (`users` table, RLS, and request-time identity resolution) | Internal | Technical Lead | Already accepted – defines how `sub` is resolved to `(tenant_id, user_id, role, status)` |
| D-004 | ADR-0033 (retire `X-Tenant-Id`) | Internal | Technical Lead | Already accepted – consumes this authentication mechanism |
| D-005 | ADR-0036 (admin UI session and OIDC client flow) | Internal | Technical Lead | Already accepted – implements the interactive sign-in / BFF session |
| D-006 | ADR-0037 (self-service tenant sign-up) | Internal | Technical Lead | Already accepted – depends on keeping Entra self-service sign-up unrestricted |
| D-007 | Microsoft Entra External ID service and Azure subscription | External | Menno / Azure | Already available |
| D-008 | Story 5.6 — Authentication via Microsoft Entra External ID | Internal | Engineering | Ready for implementation |

---

## 14. Acceptance Criteria

- `social-listening-core` validates a bearer token's signature and issuer against the Entra external tenant's published JWKS/OIDC discovery document; no request is authorized on an unverified or unsigned token.
- Token validation uses standard OIDC/JWT verification only; no Entra-specific SDK call or Graph API call occurs on the request-authorization path.
- The token's `sub` claim is extracted and passed to downstream identity resolution as an opaque string; it is never parsed for, or trusted to carry, tenant, role, or license information.
- A request bearing an invalid, expired, or wrong-issuer token is rejected with `401` before any application logic runs.
- A request with no `Authorization` header is rejected with `401`, not silently treated as an anonymous or default-tenant request.
- Exactly one Entra external tenant is provisioned for the product, and exactly two app registrations (`social-listening-admin`, `social-listening-core`) live inside it.
- The `tid` claim is treated as a constant and is never used to derive a SocialEngage tenant.
- The `oid` claim, if present, is never used to match `external_subject`; only `sub` is used.
- An authenticated Entra sign-in with no matching `invited` user row for that email is rejected at the application layer.
- Tenant membership, role, and license/seat status are owned and enforced by SocialEngage's own Postgres tables and RLS policies, not by Entra groups or directory attributes.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Entra External ID** | Microsoft's Azure-native customer-identity and access management (CIAM) service, successor to Azure AD B2C, designed for consumer and business-customer-facing applications. |
| **OIDC** | OpenID Connect, an authentication layer on top of OAuth 2.0 that lets clients verify user identity based on an identity provider's token. |
| **JWKS** | JSON Web Key Set, a set of public keys published by the identity provider and used to verify token signatures. |
| **`sub` claim** | The "subject" claim in an OIDC token; the opaque, immutable identifier for the authenticated user. |
| **`tid` claim** | The "tenant ID" claim in an Entra token; for this product it is constant because only one Entra external tenant is used. |
| **`oid` claim** | The "object ID" claim in an Entra token; present in this project's tokens but distinct from `sub` and not used for matching. |
| **External tenant (Entra)** | A single Entra directory configured exclusively for Microsoft Entra External ID scenarios. |
| **SocialEngage tenant** | A customer organization / workspace inside the SocialEngage application, represented by a row in the Postgres `tenants` table. |
| **RLS** | Postgres Row-Level Security, used to enforce that a database session only sees rows belonging to the resolved tenant. |
| **MAU** | Monthly Active Users; the pricing dimension for Entra External ID, with the first 50,000 MAU free. |
| **PKCE** | Proof Key for Code Exchange, an OAuth 2.0 extension that secures the Authorization Code flow for public clients. |
| **Bearer token** | A token presented in the `Authorization: Bearer <token>` header and validated by the API. |
| **Identity resolution** | The process of mapping a validated `sub` claim to a SocialEngage user or Platform Admin record, including tenant, role, and status. |
| **App registration** | An application object in Entra that defines the client or API resource and its token audience. |

---

## 16. Appendices

### Reference documents

- [ADR-0029: Authentication mechanism — Microsoft Entra External ID, integrated as a thin, pluggable OIDC token issuer](../../adr/0029-authentication-mechanism-entra-external-id.md)
- [Story 5.6 — Authentication via Microsoft Entra External ID](../../user-stories/epic-5-security-isolation-and-messaging.md#story-56--authentication-via-microsoft-entra-external-id)
- [ADR-0028: Credential-creation authority scoped by ownership tier](../../adr/0028-credential-creation-authority.md)
- [ADR-0031: `tenants` table with its own RLS policy](../../adr/0031-tenants-table-and-rls-policy.md)
- [ADR-0032: `users` table, RLS, and request-time identity resolution](../../adr/0032-users-table-rls-identity-resolution.md)
- [ADR-0033: Retire `X-Tenant-Id` as a trust mechanism](../../adr/0033-retire-x-tenant-id.md)
- [ADR-0036: Admin UI authentication and BFF session](../../adr/0036-admin-ui-authentication.md)
- [ADR-0037: Self-service tenant sign-up and first Tenant-Admin provisioning](../../adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md)
- [Feature design: 12 — Multi-user workspaces and RBAC](../../product-research/feature-designs/12-multi-user-workspaces-and-rbac.md)
- [Feature design: 11 — API and integrations](../../product-research/feature-designs/11-api-and-integrations.md)

### Missing source note

No dedicated `docs/product-research/reports/<feature>-deep-research.md` file exists specifically for the Entra External ID authentication mechanism. The BRD instead draws the authentication / RBAC context from the related feature-design files (12 and 11) and the user stories above.

### External references

- Microsoft Entra External ID tenant configurations: `https://learn.microsoft.com/en-us/entra/external-id/tenant-configurations`
- Microsoft ID token claims reference: `https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference`
- Microsoft Entra External ID self-service sign-up: `https://learn.microsoft.com/en-us/entra/external-id/self-service-sign-up-overview`
- Microsoft Entra External ID pricing: `https://azure.microsoft.com/en-us/pricing/details/microsoft-entra-external-id/`
- Troubleshooting signature validation errors: `https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/troubleshooting-signature-validation-errors`

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-19 |
| Product Owner | Menno | — | 2026-08-19 |
| Technical Lead | Menno | — | 2026-08-19 |
| Other Stakeholder | — | — | — |
