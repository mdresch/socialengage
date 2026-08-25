# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0029 Authentication Mechanism: Microsoft Entra External ID — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0029-authentication-mechanism-entra-external-id.md, ../Business-Requirements/BRD-0029-Authentication-Mechanism-Entra-External-ID.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0029-authentication-mechanism-entra-external-id.md and the business requirements in BRD-0029-Authentication-Mechanism-Entra-External-ID.md into functional design for **Authentication Mechanism Entra External ID**.
SocialEngage currently has no authentication mechanism. Every `/v1` endpoint relies on a client-supplied `X-Tenant-Id` header as the entire tenant boundary, which the project risk register rates as High/High and release-blocking once external users are contemplated. This BRD establishes the business requirements for replacing that trust-on-the-client mechanism with a real, cryptographically verified authentication layer.

The approved solution is to integrate **Microsoft Entra External ID** as a thin, pluggable OpenID Connect (OIDC) token issuer. SocialEngage will provision exactly one Entra "external tenant" that is shared by every SocialEngage customer organization. Two app registrations inside that tenant will support the admin web UI and the core API. The backend will validate bearer tokens using standard OIDC/JWKS discovery only, will never call Entra-specific APIs to make authorization decisions, and will treat the token's `sub` claim as the canonical external identifier. Tenant membership, role, and license status will continue to live exclusively in SocialEngage's own Postgres tables and RLS policies.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing risk, alignment with the project's established Azure-native precedent, a free-tier CIAM option at current scale, and a bounded migration path should a different OIDC provider ever be chosen.

---

### 2.2 Scope
**In scope:**
- Selection and use of **Microsoft Entra External ID** as the project's initial CIAM / OIDC provider.
- Provisioning of exactly one Entra "external tenant" shared across all SocialEngage customer organizations.
- Creation of two app registrations inside that tenant: `social-listening-admin` (interactive client, Authorization Code + PKCE) and `social-listening-core` (API resource whose access tokens the core validates).
- Standard OIDC/JWKS token validation inside `social-listening-core` for every `/v1` request.
- Extraction and propagation of the `sub` claim as the canonical external identifier.
- The rule that tenant membership, role, and license data are enforced exclusively by SocialEngage's own Postgres tables and RLS policies.
- Application-layer enforcement of the invite-only onboarding model: a matching `invited` user row must exist before an Entra-authenticated caller is admitted.
- The data-ownership principle: one owner per field, no dual-write or sync model.

**Out of scope:**
- One Entra tenant per SocialEngage customer organization.
- A bespoke username/password + session-store authentication implementation.
- Auth0, Clerk, Supabase Auth, or Firebase Authentication as the initial provider (they remain viable future migrations only).
- Machine-to-machine (M2M) / client-credentials authentication.
- Cross-tenant B2B federation with each customer's own Microsoft 365/Entra workforce directory.
- Detailed admin UI sign-in/session implementation (governed by ADR-0036 and Story 6.1).
- The detailed `tenants`/`users` table schema, RLS policies, and request-time identity resolution (governed by ADR-0031/0032 and Stories 5.8–5.9).
- The final removal of `X-Tenant-Id` from all route handlers (governed by ADR-0033 and Story 5.10).

## 3. Context and Background
No authentication mechanism exists anywhere in this project. Every `/v1` endpoint trusts a client-supplied `X-Tenant-Id` header as its entire tenant boundary — `Business-Case-v6.0.md` §2/§6 name this explicitly ("`X-Tenant-Id` remains an unauthenticated client-supplied placeholder") and Risk R-04 rates it High/High, "release-blocking... once external users are contemplated." `docs/adr/README.md`'s 2026-07-30 governance note lists "(1) authentication mechanism — blocks everything else" as the first of seven still-undrafted candidate ADRs; this is that ADR.

Two already-Accepted ADRs constrain, without deciding, this one: **ADR-0027** requires that whoever "the connecting party" turns out to be (a tenant or an individual user) independently holds their own credential with each data source — orthogonal to *how SocialEngage itself* authenticates a caller, which is this ADR's actual subject. **ADR-0028** requires that tenant-wide credential creation be restricted to a "Tenant-Admin" role and user-bound credential activation to the owning user alone — it explicitly declined to decide Tenant-Admin's "exact identity, authentication, and RLS mechanics," leaving that to this batch (candidate ADR #2). This ADR gives the underlying authentication mechanism those constraints will run on top of; it does not itself decide Admin-tier mechanics (#2), the `tenants`/`users` schemas (#3/#4), or how `X-Tenant-Id` is actually retired in code (#5) — each is its own, later ADR in this same batch.
SocialEngage currently has no authentication mechanism. Every `/v1` endpoint relies on a client-supplied `X-Tenant-Id` header as the entire tenant boundary, which the project risk register rates as High/High and release-blocking once external users are contemplated. This BRD establishes the business requirements for replacing that trust-on-the-client mechanism with a real, cryptographically verified authentication layer.

The approved solution is to integrate **Microsoft Entra External ID** as a thin, pluggable OpenID Connect (OIDC) token issuer. SocialEngage will provision exactly one Entra "external tenant" that is shared by every SocialEngage customer organization. Two app registrations inside that tenant will support the admin web UI and the core API. The backend will validate bearer tokens using standard OIDC/JWKS discovery only, will never call Entra-specific APIs to make authorization decisions, and will treat the token's `sub` claim as the canonical external identifier. Tenant membership, role, and license status will continue to live exclusively in SocialEngage's own Postgres tables and RLS policies.

The expected business outcomes are: closure of the `X-Tenant-Id` spoofing risk, alignment with the project's established Azure-native precedent, a free-tier CIAM option at current scale, and a bounded migration path should a different OIDC provider ever be chosen.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the release-blocking authentication gap and retire trust in the client-supplied `X-Tenant-Id` header | Every `/v1` request is rejected (`401`) when it lacks a valid, verified bearer token |
| 2 | Adopt an Azure-native customer-identity provider consistent with the existing Key Vault/Service Bus/Postgres precedent | Microsoft Entra External ID is the sole supported authentication provider at launch |
| 3 | Keep the core authorization path provider-portable so future migration is bounded | No Entra-specific SDK or Microsoft Graph call is used in `social-listening-core` request authorization |
| 4 | Enforce the project's invite-only, license-gated onboarding model | Any authenticated caller with no matching `invited` user row is rejected at the application layer |
| 5 | Maintain a single source of truth for each user data field | Profile, role, and license data are owned by Postgres; Entra carries only bare OIDC auth claims |

---

**Positive consequences (from ADR):**
**Positive**
- Consistent with this project's own established Azure-native precedent, and free at this project's current and realistically near-term scale (50,000 MAU free, confirmed primary source).
- The "thin, pluggable OIDC issuer" design bounds the blast radius of a future provider swap concretely: per §2/§3, a future migration to another OIDC-compliant provider is mainly (a) a re-point of OIDC issuer/JWKS configuration, since `social-listening-core` never calls an Entra-specific API to authorize a request; (b) a one-time forced password reset or parallel-running re-linking window for existing users (true of any provider-to-provider migration — password hashes are never portable, regardless of which two providers are involved); and (c) rebuilding whatever sign-up/sign-in UI customization existed (Entra's "user flows," or the equivalent on any future provider) — not a rebuild of the authorization model itself, since that already lives entirely in SocialEngage's own Postgres tables per §2/§3.
- "Single source of truth per field" (§3) prevents a class of bug this project has not yet had occasion to hit but would eventually: a profile field silently drifting because two systems both claim to own it.

**Negative**
- **A genuine, unavoidable lock-in remains, named plainly rather than hidden:** password/credential migration is never portable to a new provider under any design — a future swap still requires a forced reset or a parallel-running re-linking window for every existing user. Entra's own sign-up/sign-in UI customization ("user flows") is not portable either — a future provider swap requires rebuilding that UI layer specifically. Both are true of every CIAM provider's equivalent customization layer, not an Entra-specific penalty, but they are real costs of *any* future migration, not eliminated by this ADR's thin-issuer design — only bounded to those two items instead of a full authorization-model rewrite.
- The exact per-MAU overage rate is not confirmed to this project's own primary-source bar (§5) — a real, if currently low-stakes, gap.
- Invite-only enforcement is an application-layer check, not an Entra-native one (§4) — a bug that skips or misconfigures that check would let any successfully-authenticated Entra user in, regardless of invitation status; this is a real implementation risk to flag for whoever builds candidate ADR #4's story, not eliminated by this ADR.
- The `oid`-vs-`sub` claim question (§2) is left genuinely unresolved, not asserted either way — a future implementer must verify directly against a real token from this project's own external tenant before assuming either claim's availability.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall validate every bearer token's signature and issuer against the Entra external tenant's published JWKS/OIDC discovery document before authorizing any `/v1` request | Must | A request with an invalid, expired, or wrong-issuer token is rejected with `401` before any route handler executes | Engineering |
| BR-002 | Token validation in `social-listening-core` shall use only standard, generic JWT/OIDC verification | Must | No Entra-specific SDK (e.g. MSAL) or Microsoft Graph API call is made on the request-authorization path | Engineering |
| BR-003 | The system shall extract the token's `sub` claim and make it available to downstream identity resolution as an opaque string | Must | `sub` is the only claim used to match `users.external_subject` or `platform_admins.external_subject`; `tid` and `oid` are not used for this purpose | Engineering |
| BR-004 | The system shall create exactly two app registrations inside the single Entra external tenant: `social-listening-admin` (interactive client, Authorization Code + PKCE) and `social-listening-core` (API resource) | Must | Both registrations exist in the same external tenant; the core validates tokens issued for the `social-listening-core` audience | Engineering |
| BR-005 | The system shall interpret the Entra `tid` claim as the same constant value for all callers and never use it to determine SocialEngage tenant membership | Must | No code path maps `tid` to a SocialEngage `tenant_id` | Engineering |
| BR-006 | The system shall enforce invite-only onboarding at the application layer | Must | An authenticated Entra sign-in with no matching `invited` user row for that email is rejected (`401`/`403`); upon first successful sign-in, `external_subject` is populated from `sub` and status moves to `active` | Engineering |
| BR-007 | The system shall store and enforce tenant membership, role, and license/seat status exclusively in SocialEngage's own Postgres tables and RLS policies | Must | Profile/role/license data are not fetched from Entra groups, directory roles, or organizational attributes | Engineering |

### 5.1 Architecture Decision
**Provider (fixed input, not re-litigated):** Microsoft Entra External ID — Microsoft's Azure-native customer-identity and access management (CIAM) service, the successor to Azure AD B2C. Confirmed directly against Microsoft's own tenant-configurations documentation: *"Effective May 1, 2025, Azure AD B2C will no longer be available to purchase for new customers"* (`learn.microsoft.com/en-us/entra/external-id/tenant-configurations`) — B2C is not merely superseded in Menno's framing, it is literally unpurchasable for a new project as of this drafting date, which independently confirms there is no live "stay on B2C" alternative to weigh.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Provisions tenant, invites users, manages seats | High | Secure sign-in, clear invite flow, no spoofing of tenant context |
| Tenant-User | Signs in to consume/curate social listening data | High | Reliable, familiar Microsoft sign-in experience |
| Platform-Admin | Operates the platform and creates/suspends tenants | High | Audited, narrowly-scoped admin access without bypassing auth |
| Menno | Sponsor, Product Owner, Technical Lead | High | Azure-native, free at current scale, portable, no bespoke auth |
| Security / Compliance reviewer | Validates security posture | High | Cryptographic token verification, no `X-Tenant-Id` trust, auditability |
| Engineering / Delivery team | Builds and maintains the system | Medium | Clear boundaries, standard libraries, no provider lock-in in core |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 1.13 | epic-1-repository-and-api-foundation.md | As Tenant-Admin who has connected, verified, and activated a connector, I want that connector to actually poll on a real, recurring cadence without me doing ... | `bootstrapConnectors()` (new) registers every real `SocialConnector`/`AIProviderConnector` module (GNews, Newswire, tenant-owned-feed, Azure AI Language, Azu... |
| Story 5.6 | epic-5-security-isolation-and-messaging.md | As person signing in to SocialEngage (an invited tenant user, a Tenant-Admin, or Platform Admin), I want to authenticate through Microsoft Entra External ID ... | `social-listening-core` validates a bearer token's signature and issuer against the Entra external tenant's own published JWKS/OIDC discovery document — no r... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The project has or will create an Azure subscription capable of hosting one Entra External ID tenant.
- The first 50,000 monthly active users (MAU) free tier will cover current and near-term volume.
- The solo-operator scale of the project means a single Entra external tenant is operationally appropriate.
- No enterprise customer requires B2B federation or Active Directory attribute sync in v1.

**Provider (fixed input, not re-litigated):** Microsoft Entra External ID — Microsoft's Azure-native customer-identity and access management (CIAM) service, the successor to Azure AD B2C. Confirmed directly against Microsoft's own tenant-configurations documentation: *"Effective May 1, 2025, Azure AD B2C will no longer be available to purchase for new customers"* (`learn.microsoft.com/en-us/entra/external-id/tenant-configurations`) — B2C is not merely superseded in Menno's framing, it is literally unpurchasable for a new project as of this drafting date, which independently confirms there is no live "stay on B2C" alternative to weigh.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | No `/v1` endpoint may rely on a client-supplied `X-Tenant-Id` header for authentication or tenant boundary | Security | Must | Repository-wide check or test confirms no route handler trusts the header |
| NFR-002 | Missing or malformed `Authorization` headers are rejected before any tenant-scoped query | Reliability | Must | A request with no token receives `401` and is not treated as anonymous/default tenant |
| NFR-003 | The core's token validation layer is Entra-agnostic except for issuer/JWKS configuration values | Maintainability | Must | Code review confirms no Entra-specific library in the core authorization path |
| NFR-004 | Invite-only onboarding is auditable and cannot be bypassed by a valid Entra token alone | Compliance | Should | Contract tests prove an uninvited but valid token is rejected |
| NFR-005 | Monthly active user (MAU) volume is tracked so the 50,000 free-tier limit is visible | Scalability | Should | A dashboard or log metric reports unique authenticated users per month |
| NFR-006 | OIDC issuer, JWKS URI, and audience values are external configuration, not hard-coded | Maintainability | Should | A configuration change can point the core at a different OIDC provider without code edits |

---

## 11. Error Handling and Exceptions
**Positive**
- Consistent with this project's own established Azure-native precedent, and free at this project's current and realistically near-term scale (50,000 MAU free, confirmed primary source).
- The "thin, pluggable OIDC issuer" design bounds the blast radius of a future provider swap concretely: per §2/§3, a future migration to another OIDC-compliant provider is mainly (a) a re-point of OIDC issuer/JWKS configuration, since `social-listening-core` never calls an Entra-specific API to authorize a request; (b) a one-time forced password reset or parallel-running re-linking window for existing users (true of any provider-to-provider migration — password hashes are never portable, regardless of which two providers are involved); and (c) rebuilding whatever sign-up/sign-in UI customization existed (Entra's "user flows," or the equivalent on any future provider) — not a rebuild of the authorization model itself, since that already lives entirely in SocialEngage's own Postgres tables per §2/§3.
- "Single source of truth per field" (§3) prevents a class of bug this project has not yet had occasion to hit but would eventually: a profile field silently drifting because two systems both claim to own it.

**Negative**
- **A genuine, unavoidable lock-in remains, named plainly rather than hidden:** password/credential migration is never portable to a new provider under any design — a future swap still requires a forced reset or a parallel-running re-linking window for every existing user. Entra's own sign-up/sign-in UI customization ("user flows") is not portable either — a future provider swap requires rebuilding that UI layer specifically. Both are true of every CIAM provider's equivalent customization layer, not an Entra-specific penalty, but they are real costs of *any* future migration, not eliminated by this ADR's thin-issuer design — only bounded to those two items instead of a full authorization-model rewrite.
- The exact per-MAU overage rate is not confirmed to this project's own primary-source bar (§5) — a real, if currently low-stakes, gap.
- Invite-only enforcement is an application-layer check, not an Entra-native one (§4) — a bug that skips or misconfigures that check would let any successfully-authenticated Entra user in, regardless of invitation status; this is a real implementation risk to flag for whoever builds candidate ADR #4's story, not eliminated by this ADR.
- The `oid`-vs-`sub` claim question (§2) is left genuinely unresolved, not asserted either way — a future implementer must verify directly against a real token from this project's own external tenant before assuming either claim's availability.

## 12. Assumptions and Dependencies
- The project has or will create an Azure subscription capable of hosting one Entra External ID tenant.
- The first 50,000 monthly active users (MAU) free tier will cover current and near-term volume.
- The solo-operator scale of the project means a single Entra external tenant is operationally appropriate.
- No enterprise customer requires B2B federation or Active Directory attribute sync in v1.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Provider lock-in: password hashes and Entra sign-up/sign-in UI customizations are not portable to another CIAM provider | Medium | Medium | Keep the core authorization model entirely in Postgres/RLS; a future swap only requires re-pointing OIDC config and rebuilding the UI sign-up flow, not the authorization model | Technical Lead |
| R-002 | Per-MAU overage price beyond the 50,000 free tier is not confirmed | Medium | Medium | Monitor MAU monthly; verify pricing directly with Microsoft before crossing the free threshold | Product Owner |
| R-003 | A bug in the application-layer invite check allows an uninvited but valid Entra user to sign in | Low | High | Cover the check with contract tests and consider defense-in-depth review of the user-flow configuration | Engineering |
| R-004 | Confusion between `oid` and `sub` claims leads to `external_subject` being seeded with the wrong value | Medium | High | Use only `sub` for matching; verify against a real token before any production seeding; update operational skill guidance | Engineering |
| R-005 | Entra's own self-service sign-up cannot be disabled cleanly at the tenant level while still allowing invited first sign-in | Low | Medium | Rely on the application-layer rejection as the primary control; revisit IdP-level restrictions only in a separate, explicitly-scoped decision | Security |
| R-006 | A future provider swap forces every existing user through a password reset or re-linking window | Low | Medium | Plan for a parallel-running re-link or forced-reset window as part of any future migration | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0029-authentication-mechanism-entra-external-id.md`
- BRD: `../Business-Requirements/BRD-0029-Authentication-Mechanism-Entra-External-ID.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above