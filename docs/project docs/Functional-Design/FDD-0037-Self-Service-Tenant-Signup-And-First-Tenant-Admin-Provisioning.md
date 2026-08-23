# SocialEngage – Business Requirements Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | SocialEngage – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md, ../Business-Requirements/BRD-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md and the business requirements in BRD-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md into functional design for **Self Service Tenant Signup And First Tenant Admin Provisioning**.
SocialEngage currently has no self-service path for a brand-new user to create the first tenant for their organization. Anyone who is not already linked to a tenant or explicitly invited must wait for a Platform Admin or an existing Tenant-Admin to act on their behalf. This creates a support bottleneck and slows time-to-value.

This BRD describes the business requirements for ADR-0037: a self-service sign-up flow that lets a validated Entra-authenticated user, arriving without any existing tenant or invitation, provision a new tenant and become its first Tenant-Admin. The flow deliberately preserves the project’s “invite-only, no queue” onboarding philosophy: it rejects domain matches against existing tenants (with a non-identifying, helpful message), excludes common public/free email providers from domain capture, records every rejection in a tenant-visible “Same-Domain Invite Assist” signal, and keeps Platform Admins in the loop for repeated or escalated attempts.

Expected business outcomes: a zero-touch first-tenant onboarding experience, a reduced manual provisioning load, and a clearer, safer path for colleagues on already-onboarded domains to request an invite.

---

### 2.2 Scope
**In scope:**
- A self-service sign-up flow in the admin UI (`/sign-up`) for users with no existing tenant, no existing `platform_admins` row, and no unlinked `invited` row.
- A new, narrowly scoped backend authorization path for creating the `tenants` row itself (`tenant_signup_role`, `INSERT`-only on `tenants`).
- Automatic insertion of the first `users` row as a `tenant_admin` for the newly created tenant, via the ordinary tenant-scoped `app_user` path.
- Public/free email provider exclusion, leaving the captured `domain` as `NULL` for those sign-ups and creating an independent tenant.
- Domain-match rejection when a non-excluded email domain already belongs to an existing tenant.
- A vague, non-identifying rejection message that points the caller to request an invite from their own organization’s admin.
- A durable, tenant-scoped `domain_signup_attempts` record for every rejected domain-match attempt.
- A “Same-Domain Invite Assist” view for existing Tenant-Admins, with one-click pre-fill of the existing invite flow.
- Escalation of repeated attempts against the same domain to the Platform Admin audit log.
- Extension of the Platform Admin role to allow `UPDATE(domain)` on `tenants` for recovery from a wrong or squatted domain.
- Audit logging of every self-service tenant creation and of every privileged Platform Admin recovery action.

**Out of scope:**
- Auto-joining an existing tenant on domain match.
- A request-then-approve queue for domain-matched sign-ups.
- DNS TXT-record domain-ownership verification for the sign-up endpoint.
- Real-time outbound security alerts (email, Slack, on-call paging) for escalations.
- Outbound notification to a rejected caller once they are later invited.
- The detailed rate-limiting and abuse-prevention mechanism (deferred to ADR-0040 / Story 5.18).
- Generic self-service onboarding checklist content beyond the sign-up and first-tenant provisioning step.

## 3. Context and Background
**This is a real, currently undesigned gap, confirmed directly against the corpus rather than assumed:**

- ADR-0031 §5 (Accepted, `domain` column) *names* self-service sign-up as a real, expected event but explicitly states: "The exact 'rerouting' behavior on a domain match is also not decided here... is a sign-up/invite-flow UX decision for whoever builds candidate ADR #4's own story, not designed by this schema-level ADR," and separately names, as its own unresolved Open Question, "the public/free-email-provider exclusion mechanism for `domain` matching."
- ADR-0032 §6 (Accepted, "Invite/link flow") designs only the case where an *already-existing* Tenant-Admin creates an `invited` row for a *new colleague* inside their *own already-existing* tenant. It does not touch who creates the very first tenant, or its first Tenant-Admin — this table's own schema has no `INSERT`-then-immediately-`tenant_admin` path for a caller who arrives with no `tenant_id` at all.
- ADR-0029 §4 (Accepted) confirms Entra External ID's own "user flows" support self-service sign-up at the identity-provider level, and states the general rule that "an authenticated Entra sign-in with no matching invitation is rejected at the application layer (401/403)." It does not carve out any exception to that rule — because at the time it was drafted, no candidate feature needed one. This ADR is the first to need one.
- `tenantStore.ts`'s `createTenant()` (Story 5.8, ADR-0031) is callable only through `platform_admin_role` — confirmed directly: `migrations/0017_create_tenants.sql` grants `SELECT, INSERT` on `tenants` only to `platform_admin_role`, nothing to `app_user`, and no third role exists yet with any grant on this table. A self-service sign-up caller is, by definition, unauthenticated-until-that-moment and nowhere near a Platform Admin identity. **Widening `platform_admin_role`'s own grant to accommodate this would directly violate ADR-0030 §2's already-locked boundary** ("Platform Admin's bypass scope is locked in, not left floating a second time... it is never granted, and must never be used to query... any other tenant-content table" — and, by the same logic, must never be reachable by an arbitrary, unauthenticated-until-the-instant-before caller either).
- `docs/user-stories/epic-6-admin-ui.md` (Stories 6.1–6.6, drafted 2026-08-04) covers sign-*in* only (Story 6.1) — it assumes either an already-linked identity or a pre-existing `invited` row created by someone else. It does not cover initial sign-up.
- ADR-0036 (Proposed, same drafting pass as this one) designs the admin UI's session/BFF mechanism and names, but does not build, `GET /v1/me`. This ADR's own required backend surface (§5, below) composes with that mechanism rather than duplicating it.

**Why this needs its own ADR, applying this series' own established bar (ADR-0027/0028/0035/0036's "ordinary CRUD/UI surface doesn't need one; a hard-to-reverse authorization/abuse/security decision does"):** this is not a new field or a new screen. It requires resolving, before any code can be written safely:

1. **How an unauthenticated-until-that-instant caller gets tenant-creation authority** without widening `platform_admin_role`'s own locked boundary (ADR-0030 §2) or inventing an ungoverned second bypass.
2. **Abuse/rate-limiting** — nothing today stops one person, or one script, from creating unlimited tenants; `createTenant()`'s own doc comment says plainly "this function only proves the mechanics, it does not check who's calling."
3. **The domain-match "rerouting" UX** ADR-0031 §5 explicitly named and explicitly declined to design.
4. **The public-email-provider exclusion mechanism** ADR-0031 §5 explicitly named as its own open gap.
5. **A narrow, explicit exception to ADR-0029 §4's own general rule** ("an authenticated Entra sign-in with no matching invitation is rejected") — this is the one case where that rejection must not apply.

Every one of these is a hard-to-reverse authorization or abuse-surface decision, not a copy or layout question — squarely the kind of decision this series reserves an ADR for.
SocialEngage currently has no self-service path for a brand-new user to create the first tenant for their organization. Anyone who is not already linked to a tenant or explicitly invited must wait for a Platform Admin or an existing Tenant-Admin to act on their behalf. This creates a support bottleneck and slows time-to-value.

This BRD describes the business requirements for ADR-0037: a self-service sign-up flow that lets a validated Entra-authenticated user, arriving without any existing tenant or invitation, provision a new tenant and become its first Tenant-Admin. The flow deliberately preserves the project’s “invite-only, no queue” onboarding philosophy: it rejects domain matches against existing tenants (with a non-identifying, helpful message), excludes common public/free email providers from domain capture, records every rejection in a tenant-visible “Same-Domain Invite Assist” signal, and keeps Platform Admins in the loop for repeated or escalated attempts.

Expected business outcomes: a zero-touch first-tenant onboarding experience, a reduced manual provisioning load, and a clearer, safer path for colleagues on already-onboarded domains to request an invite.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Remove the Platform Admin bottleneck for the first tenant creation | A new user can create a tenant and sign in as Tenant-Admin without any manual action by the Platform Admin or another tenant member |
| 2 | Preserve the invite-only onboarding philosophy while reducing friction for legitimate colleagues | Domain-matched sign-ups surface a one-click “Invite this person” proposal to the existing Tenant-Admin instead of becoming a silent dead end |
| 3 | Maintain a defensible security posture for a publicly exposed endpoint | Every tenant creation is audited, uses a narrowly scoped authorization role, and avoids disclosing which organizations are already on the platform |
| 4 | Support faster time-to-value for self-service trials and demos | New users reach the first dashboard without email support or out-of-band coordination |

---

**Positive consequences (from ADR):**
**Positive**
- Resolves ADR-0031 §5's own explicitly-named "not decided here" gap (rerouting UX) and its own named Open Question (public-email exclusion mechanism) directly, rather than leaving both open a second time.
- **Added at acceptance (§8):** §3's own previously-named UX cost (a legitimate not-yet-invited colleague has zero visible path) is materially softened, not left as a pure dead-end — the Tenant-Admin gets a proposed, one-click-actionable signal instead of relying purely on out-of-band word-of-mouth, and repeated attempts are durably reviewable by Platform Admin rather than invisible.
- Reuses every mechanism this project has already built wherever possible — the existing partial unique index (domain-match detection), the existing `platform_admin_audit_log`/`logPlatformAdminAction()` (audit trail), the existing `app_user`/`withTenant()` path (first-user insert), and ADR-0032 §6's existing invite-link flow (§6, must-check-first) — introducing exactly one new thing (`tenant_signup_role`) rather than a parallel set of new mechanisms.
- `tenant_signup_role`'s grant is even narrower than `platform_admin_role`'s own (`INSERT`-only, no `SELECT`, no `UPDATE`) — a compromise of this role cannot read or alter any existing tenant, only ever attempt to create a new one, and even that is fully audited.
- Names, rather than silently defers a second time, the one real remaining abuse gap (bulk/scripted tenant creation) — visible for a future decision instead of hidden.
- **Added post-acceptance (§9):** a wrong or squatted `domain` value is now recoverable — a real gap this ADR itself would otherwise have introduced with no way out is closed, via a minimally-scoped, fully-audited Platform Admin grant extension rather than new machinery.

**Negative**
- **A real, new Postgres role and grant to provision and keep correctly scoped** — genuine, if small, operational surface, the same trade-off ADR-0032 §5 already accepted for `identity_resolver_role` and named honestly there ("a small but genuine increase in the database's own role-management complexity").
- **The domain-match rejection (§3) has a real, accepted UX cost, now partially but not fully mitigated:** a legitimate not-yet-invited colleague at an already-onboarded organization still has zero *self-service* path — §8b's Same-Domain Invite Assist makes their attempt visible and actionable to the Tenant-Admin, but access still depends entirely on that Tenant-Admin choosing to act; this is a deliberate trade-off against reopening the "no request-then-approve queue" philosophy, not a costless choice, and not a full fix.
- **§8's new tenant-scoped `domain_signup_attempts` table (§8b) is a real, new, if small, schema/migration surface**, and its escalation thresholds (30 days / 3 attempts) are unanalyzed template defaults needing eventual tuning against real usage — the same trade-off every other numeric default in this series accepted (ADR-0017–0019's own precedent).
- **§8c's escalation signal is durably logged, not actually alerted on in real time** — a Platform Admin must still go look at `platform_admin_audit_log` to see it; this is a real, named gap versus true "trigger security alerts" until an outbound-alerting capability is built (Open Questions, below).
- **The public-email-provider denylist (§4) is permanently incomplete by construction** — a real, ongoing maintenance burden and a real, if bounded, false-negative risk, accepted rather than solved.
- **The bulk/scripted-abuse gap (§7) is a genuine, currently-unresolved risk**, not a hypothetical one — this ADR decides the authorization *shape* but does not close the volumetric abuse surface; whoever builds this story must treat §7's Open Question as a precondition for exposing this endpoint publicly, not an optional hardening pass. **Its severity is bounded, not eliminated, by §7's own added note (post-acceptance):** a successfully-abused tenant is an empty shell with zero ambient access to any external system — every connector requires its own separate, vendor-issued end-user credential (ADR-0027, ADR-0028) — so the real cost of this gap is resource consumption/operational nuisance, not unauthorized data or system access.
- **§9's Platform Admin recovery path is manual, not instant** — a legitimate organization blocked by a squatted or misclassified domain must still reach Menno (or a future support process) and wait for a Platform Admin action; not a self-service fix, an accepted trade-off against building heavier automated dispute-resolution machinery this problem's current, low likelihood doesn't yet justify.
- **A real, named tension with ADR-0029's own still-open Open Question (§5)** — this feature's continued existence depends on that question never being resolved toward IdP-level self-service restriction; a future security-hardening decision could silently break this feature if that dependency isn't checked at the time.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a validated, not-yet-linked Entra user to create a new tenant and become its first Tenant-Admin | Must | A successful sign-up creates one `tenants` row, one `users` row with role `tenant_admin`, and the caller resolves to `tenant_admin` on the next request | Product Owner |
| BR-002 | The system shall exclude common public/free email providers from domain capture | Must | A sign-up using a denylisted provider creates a tenant with `domain` set to `NULL`; two such sign-ups produce independent tenants | Product Owner |
| BR-003 | The system shall reject sign-ups whose non-excluded email domain already matches an existing tenant’s domain | Must | The response contains a specific, non-identifying message; no second tenant is created; no automatic join occurs | Product Owner |
| BR-004 | The system shall route an existing, unlinked `invited` row to the existing invite-link flow before any tenant creation | Must | A caller with a matching `invited` row is never provisioned a new tenant; their external subject is linked to the invited `users` row | Product Owner |
| BR-005 | The system shall reject sign-ups from an identity that already belongs to a tenant or is a Platform Admin | Must | Existing `users` or `platform_admins` rows return a clear “you already have an account” message | Product Owner |
| BR-006 | The system shall collect the tenant name from the caller before provisioning | Must | The new `tenants` row contains the caller-supplied name; the caller never supplies email or domain | Product Owner |
| BR-007 | The system shall write every self-service tenant creation to a durable audit log | Must | `platform_admin_audit_log` contains a self-service-labeled record with the actor identity and tenant identifier | Product Owner |
| BR-008 | The system shall record every domain-match rejection to a tenant-scoped `domain_signup_attempts` table | Must | The record contains `tenant_id`, `email`, and `attempted_at`; it is visible only to that tenant’s Tenant-Admin | Product Owner |
| BR-009 | The system shall surface a Same-Domain Invite Assist view to the matched tenant’s Tenant-Admin | Should | One item per domain, expandable email list, escalation state, and one-click pre-fill of the invite form | Product Owner |
| BR-010 | The system shall escalate repeated same-domain attempts to the Platform Admin audit log | Should | Crossing the configured threshold writes an escalation entry with the verified email addresses behind it | Product Owner |
| BR-011 | The system shall allow a Platform Admin to correct a tenant’s `domain` value as an audited action | Should | `UPDATE(domain)` is logged and limited to the `platform_admin_role` grant scope | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Prospective Tenant-Admin (new user) | Primary end user of the sign-up flow | High | Create a tenant quickly, understand why a domain is rejected, and know what to do next |
| Existing Tenant-Admin | Receives same-domain invite proposals | High | See legitimate colleague requests and invite them without friction |
| Platform Admin | Owns recovery, abuse escalation, and audit | High | Retain visibility, audit trail, and a manual recovery path for disputed domains |
| Security & Architecture Reviewer | Evaluates authorization and abuse surface | Medium | Least-privilege roles, anti-enumeration, no cross-tenant data leakage |
| Product Owner | Sponsors the feature and prioritizes gaps | High | Clear scope, named open gaps, and no speculative machinery |
| Customer Support / Operations | Handles misclassified domains and abuse reports | Medium | A recoverable, auditable process for domain corrections |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.11 | epic-5-security-isolation-and-messaging.md | As admin UI (or any future authenticated REST caller) that holds a validated bearer token but has no way to know its own resolved tenant/role/Platform-Admin ... | `GET /v1/me` is mounted in `createV1Router()` (`src/http/versions/v1/router.ts`) behind the same `authMiddleware` (`createTenantAuthMiddleware()`) every othe... |
| Story 5.15 | epic-5-security-isolation-and-messaging.md | As brand-new user who is not yet part of any SocialEngage tenant, I want a backend endpoint that provisions my own tenant and makes me its first Tenant-Admin... | `POST /v1/tenants/self-service-signup` is the **one** route in this project accepting a validly-signed Entra bearer token that resolves to no `users` row and... |
| Story 5.16 | epic-5-security-isolation-and-messaging.md | As Tenant-Admin, I want to see, and act on, same-domain sign-up attempts against my own tenant, so that a legitimate not-yet-invited colleague's attempt is v... | `GET /v1/tenants/domain-signup-attempts` returns the caller's own tenant's `domain_signup_attempts` rows, RLS-scoped exactly like every other tenant-content ... |
| Story 5.18 | epic-5-security-isolation-and-messaging.md | As platform operator exposing the one unauthenticated-until-resolved endpoint in this project, I want sign-up attempts rate-limited by IP address and by veri... | A new, dedicated rate-limiting mechanism — structurally independent of `RequestGate` (ADR-0003/ADR-0020), which stays scoped to `(tenantId, providerId)` — re... |
| Story 6.7 | epic-6-tenant-admin-ui.md | As brand-new user who is not yet part of any SocialEngage tenant, I want to sign up and, if I'm the first person from my organization to do so, become the Te... | A "Sign up" entry point exists alongside Story 6.1's sign-in page, distinct from it, and triggers Entra External ID's own self-service sign-up user flow (con... |
| Story 6.10 | epic-6-tenant-admin-ui.md | As Tenant-Admin, I want to see same-domain sign-up attempts against my own tenant, with a one-click way to invite a legitimate colleague, so that a not-yet-i... | Reads `GET /v1/tenants/domain-signup-attempts` (Story 5.16), showing one item per domain (always the caller's own tenant's matched domain, per Story 5.16's o... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants` row (id, name, domain, status, license_seat_count, created_at) | Newly created tenant record | `POST /v1/tenants/self-service-signup` | Platform Admin / system | Organization metadata |
| `users` row (id, tenant_id, external_subject, email, role) | First Tenant-Admin of the new tenant | Core identity resolution after tenant creation | Tenant-Admin | Personal data; auth identity |
| Entra `sub` and `email` claims | Validated OIDC claims for the new user | Entra External ID token | Identity provider | Personal data; authentication |
| `domain_signup_attempts` (tenant_id, email, attempted_at) | Durable record of each domain-match rejection | Self-service sign-up endpoint | Matched tenant’s Tenant-Admin | Personal data; tenant-scoped |
| `platform_admin_audit_log` (actor_identity, action, metadata, created_at) | Audit trail for tenant creation, escalations, and domain corrections | Privileged actions | Platform Admin / compliance | Operational audit data |
| `invited` (id, tenant_id, email, external_subject, status) | Pre-existing invitation used by the must-check-first rule | Invite-link flow (ADR-0032) | Tenant-Admin | Personal data; tenant-scoped |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A sign-up email whose domain appears on the public/free-email-provider denylist does not produce a captured `domain` on the new tenant. |
| BRU-002 | The `tenants.domain` column is subject to a partial unique index: only one tenant can hold a given non-NULL `domain`. |
| BRU-003 | Domain-match rejection messages must be generic and must not name, identify, or describe the matched organization. |
| BRU-004 | If an `invited` row exists for the sign-up email in any tenant, the invite-link flow takes precedence over tenant creation. |
| BRU-005 | If the Entra `sub` or email already resolves to a `users` or `platform_admins` row, the sign-up is rejected outright. |
| BRU-006 | The `tenant_signup_role` is allowed `INSERT` only on `tenants` and `INSERT` only on `platform_admin_audit_log`; it has no other table grants. |
| BRU-007 | The first `users` row for a newly created tenant is inserted using the ordinary `app_user` role in a tenant-scoped `withTenant` session, not by the bypass role. |
| BRU-008 | Repeated same-domain attempts crossing the escalation threshold (template default: 3 attempts within a rolling 30 days) generate a Platform Admin audit log escalation. |
| BRU-009 | The Same-Domain Invite Assist view may pre-fill the invite form but must never send an automatic invite or auto-join the caller. |
| BRU-010 | Platform Admin correction of `domain` is an audited action and is limited to the `domain` column of the `tenants` table. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0031 — `tenants` table shape and `domain` column | Architectural | Menno | Accepted |
| D-002 | ADR-0032 — invite-link flow and `invited` row handling | Architectural | Menno | Accepted |
| D-003 | ADR-0029 — Entra External ID authentication and the invite-only default | Architectural | Menno | Accepted; open IdP-restriction question to be reconciled |
| D-004 | ADR-0030 — locked Platform Admin bypass scope | Architectural | Menno | Accepted |
| D-005 | ADR-0036 — admin UI BFF session, `Authorization: Bearer` choke point, `GET /v1/me` | Architectural | Menno | Accepted |
| D-006 | ADR-0040 — self-service sign-up rate limiting and abuse prevention | Architectural | Menno | Ready; must be built before untrusted exposure |
| D-007 | Story 5.11 — `GET /v1/me` endpoint | Backend contract | Technical Lead | Built |
| D-008 | Story 5.15 — `POST /v1/tenants/self-service-signup` endpoint | Backend contract | Technical Lead | Built |
| D-009 | Story 5.16 — `GET /v1/tenants/domain-signup-attempts` | Backend contract | Technical Lead | Built |
| D-010 | Story 6.1 — Next.js scaffold and Entra sign-in | Frontend contract | Technical Lead | Built |
| D-011 | Story 6.7 — self-service sign-up UI | Frontend contract | Product Owner | Built |
| D-012 | Story 6.10 — Same-Domain Invite Assist view | Frontend contract | Product Owner | Built |

---

- The admin UI’s Entra External ID “Sign up and sign in” user flow is configured with email one-time-passcode (or email-with-password) verification enabled.
- Self-service sign-up at the identity-provider level remains unrestricted for as long as this feature is live.
- The first user’s email is the source of truth for the organization’s `domain`; the tenant name is supplied by the caller.
- A single domain maps to a single tenant for the purpose of self-service domain matching; multi-tenant single-domain organizations are not supported in this release.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Self-service tenant creation must use a dedicated Postgres role with the minimum necessary grant (`INSERT`-only on `tenants`) | Security | Must | Role is not `platform_admin_role`; no `SELECT`/`UPDATE`/`DELETE` grants on `tenants` are given |
| NFR-002 | Every privileged write must be recorded in an existing, durable audit log | Security / Compliance | Must | `tenant_signup_role` and `platform_admin_role` write to the same `platform_admin_audit_log` mechanism |
| NFR-003 | The rejection message must never disclose the matched organization’s name, ID, or metadata | Privacy | Must | Response body and UI copy contain no tenant-identifying details beyond the generic guidance |
| NFR-004 | The sign-up flow must reuse the existing BFF/session mechanism and `Authorization: Bearer` choke point | Maintainability | Must | No parallel auth mechanism is introduced; `GET /v1/me` resolves the new identity normally |
| NFR-005 | The public-email denylist must be maintainable without a database migration for each change | Maintainability | Should | The list is version-controlled in application code and can be updated by a normal code deploy |
| NFR-006 | The endpoint must not be exposed to untrusted public traffic until rate limiting is implemented | Security | Must | Feature is flagged/conditional until ADR-0040 / Story 5.18 is accepted and built |

---

## 11. Error Handling and Exceptions
**Positive**
- Resolves ADR-0031 §5's own explicitly-named "not decided here" gap (rerouting UX) and its own named Open Question (public-email exclusion mechanism) directly, rather than leaving both open a second time.
- **Added at acceptance (§8):** §3's own previously-named UX cost (a legitimate not-yet-invited colleague has zero visible path) is materially softened, not left as a pure dead-end — the Tenant-Admin gets a proposed, one-click-actionable signal instead of relying purely on out-of-band word-of-mouth, and repeated attempts are durably reviewable by Platform Admin rather than invisible.
- Reuses every mechanism this project has already built wherever possible — the existing partial unique index (domain-match detection), the existing `platform_admin_audit_log`/`logPlatformAdminAction()` (audit trail), the existing `app_user`/`withTenant()` path (first-user insert), and ADR-0032 §6's existing invite-link flow (§6, must-check-first) — introducing exactly one new thing (`tenant_signup_role`) rather than a parallel set of new mechanisms.
- `tenant_signup_role`'s grant is even narrower than `platform_admin_role`'s own (`INSERT`-only, no `SELECT`, no `UPDATE`) — a compromise of this role cannot read or alter any existing tenant, only ever attempt to create a new one, and even that is fully audited.
- Names, rather than silently defers a second time, the one real remaining abuse gap (bulk/scripted tenant creation) — visible for a future decision instead of hidden.
- **Added post-acceptance (§9):** a wrong or squatted `domain` value is now recoverable — a real gap this ADR itself would otherwise have introduced with no way out is closed, via a minimally-scoped, fully-audited Platform Admin grant extension rather than new machinery.

**Negative**
- **A real, new Postgres role and grant to provision and keep correctly scoped** — genuine, if small, operational surface, the same trade-off ADR-0032 §5 already accepted for `identity_resolver_role` and named honestly there ("a small but genuine increase in the database's own role-management complexity").
- **The domain-match rejection (§3) has a real, accepted UX cost, now partially but not fully mitigated:** a legitimate not-yet-invited colleague at an already-onboarded organization still has zero *self-service* path — §8b's Same-Domain Invite Assist makes their attempt visible and actionable to the Tenant-Admin, but access still depends entirely on that Tenant-Admin choosing to act; this is a deliberate trade-off against reopening the "no request-then-approve queue" philosophy, not a costless choice, and not a full fix.
- **§8's new tenant-scoped `domain_signup_attempts` table (§8b) is a real, new, if small, schema/migration surface**, and its escalation thresholds (30 days / 3 attempts) are unanalyzed template defaults needing eventual tuning against real usage — the same trade-off every other numeric default in this series accepted (ADR-0017–0019's own precedent).
- **§8c's escalation signal is durably logged, not actually alerted on in real time** — a Platform Admin must still go look at `platform_admin_audit_log` to see it; this is a real, named gap versus true "trigger security alerts" until an outbound-alerting capability is built (Open Questions, below).
- **The public-email-provider denylist (§4) is permanently incomplete by construction** — a real, ongoing maintenance burden and a real, if bounded, false-negative risk, accepted rather than solved.
- **The bulk/scripted-abuse gap (§7) is a genuine, currently-unresolved risk**, not a hypothetical one — this ADR decides the authorization *shape* but does not close the volumetric abuse surface; whoever builds this story must treat §7's Open Question as a precondition for exposing this endpoint publicly, not an optional hardening pass. **Its severity is bounded, not eliminated, by §7's own added note (post-acceptance):** a successfully-abused tenant is an empty shell with zero ambient access to any external system — every connector requires its own separate, vendor-issued end-user credential (ADR-0027, ADR-0028) — so the real cost of this gap is resource consumption/operational nuisance, not unauthorized data or system access.
- **§9's Platform Admin recovery path is manual, not instant** — a legitimate organization blocked by a squatted or misclassified domain must still reach Menno (or a future support process) and wait for a Platform Admin action; not a self-service fix, an accepted trade-off against building heavier automated dispute-resolution machinery this problem's current, low likelihood doesn't yet justify.
- **A real, named tension with ADR-0029's own still-open Open Question (§5)** — this feature's continued existence depends on that question never being resolved toward IdP-level self-service restriction; a future security-hardening decision could silently break this feature if that dependency isn't checked at the time.

## 12. Assumptions and Dependencies
- The admin UI’s Entra External ID “Sign up and sign in” user flow is configured with email one-time-passcode (or email-with-password) verification enabled.
- Self-service sign-up at the identity-provider level remains unrestricted for as long as this feature is live.
- The first user’s email is the source of truth for the organization’s `domain`; the tenant name is supplied by the caller.
- A single domain maps to a single tenant for the purpose of self-service domain matching; multi-tenant single-domain organizations are not supported in this release.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Bulk or scripted creation of many disposable tenants | Medium | Medium | Defer full design to ADR-0040 / Story 5.18; keep endpoint gated until rate limiting is in place; email OTP raises the cost of distinct identities | Product Owner |
| R-002 | Information disclosure / domain enumeration through rejection messages | Low | High | Never name the matched organization; require email OTP verification before any domain matching occurs; vague response copy | Security & Architecture |
| R-003 | Incomplete public-email denylist incorrectly links unrelated tenants | Low | Medium | Maintain a static list in code; accept manual update cadence; revisit only if demonstrated false-positive rate is a real problem | Product Owner |
| R-004 | Entra user-flow configuration drifts to skip email verification | Low | High | Add a deployment/startup check that confirms email verification is still enabled on the configured user flow | Technical Lead |
| R-005 | A wrong or squatted `domain` blocks a legitimate organization | Low | High | Provide a Platform Admin recovery path with `UPDATE(domain)` on `tenants`, fully audited | Platform Admin |
| R-006 | A future decision to restrict self-service sign-up at the Entra IdP level silently breaks this feature | Low | High | Flag the cross-ADR dependency for explicit reconciliation before ADR-0029’s open question is resolved | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md`
- BRD: `../Business-Requirements/BRD-0037-Self-Service-Tenant-Signup-And-First-Tenant-Admin-Provisioning.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md](../../../../docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Feature design: `docs/product-research/feature-designs/19-self-service-onboarding-checklist.md](../../../../docs/product-research/feature-designs/19-self-service-onboarding-checklist.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Deep research: _No deep-research report found._
- User stories: see extracted stories above