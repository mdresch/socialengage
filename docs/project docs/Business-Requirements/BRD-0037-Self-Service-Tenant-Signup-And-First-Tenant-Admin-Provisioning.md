# SocialEngage – Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – BRD-0037: Self-Service Tenant Sign-up and First Tenant Admin Provisioning |
| Version | 1.0 |
| Date | 2026-08-19 |
| Author(s) | BRD Writer Agent (synthesized from ADR-0037 and project stories) |
| Approver(s) | Menno — Business Sponsor, Product Owner, Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-04 | AI Business & Requirements Analyst persona | Initial draft from ADR-0037 acceptance discussion |
| 1.0 | 2026-08-19 | BRD Writer Agent | Filled BRD template from ADR-0037, Epic 6 stories, and available product-research context |

---

## 2. Executive Summary

SocialEngage currently has no self-service path for a brand-new user to create the first tenant for their organization. Anyone who is not already linked to a tenant or explicitly invited must wait for a Platform Admin or an existing Tenant-Admin to act on their behalf. This creates a support bottleneck and slows time-to-value.

This BRD describes the business requirements for ADR-0037: a self-service sign-up flow that lets a validated Entra-authenticated user, arriving without any existing tenant or invitation, provision a new tenant and become its first Tenant-Admin. The flow deliberately preserves the project’s “invite-only, no queue” onboarding philosophy: it rejects domain matches against existing tenants (with a non-identifying, helpful message), excludes common public/free email providers from domain capture, records every rejection in a tenant-visible “Same-Domain Invite Assist” signal, and keeps Platform Admins in the loop for repeated or escalated attempts.

Expected business outcomes: a zero-touch first-tenant onboarding experience, a reduced manual provisioning load, and a clearer, safer path for colleagues on already-onboarded domains to request an invite.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Remove the Platform Admin bottleneck for the first tenant creation | A new user can create a tenant and sign in as Tenant-Admin without any manual action by the Platform Admin or another tenant member |
| 2 | Preserve the invite-only onboarding philosophy while reducing friction for legitimate colleagues | Domain-matched sign-ups surface a one-click “Invite this person” proposal to the existing Tenant-Admin instead of becoming a silent dead end |
| 3 | Maintain a defensible security posture for a publicly exposed endpoint | Every tenant creation is audited, uses a narrowly scoped authorization role, and avoids disclosing which organizations are already on the platform |
| 4 | Support faster time-to-value for self-service trials and demos | New users reach the first dashboard without email support or out-of-band coordination |

---

## 4. Scope

### 4.1 In Scope

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

### 4.2 Out of Scope

- Auto-joining an existing tenant on domain match.
- A request-then-approve queue for domain-matched sign-ups.
- DNS TXT-record domain-ownership verification for the sign-up endpoint.
- Real-time outbound security alerts (email, Slack, on-call paging) for escalations.
- Outbound notification to a rejected caller once they are later invited.
- The detailed rate-limiting and abuse-prevention mechanism (deferred to ADR-0040 / Story 5.18).
- Generic self-service onboarding checklist content beyond the sign-up and first-tenant provisioning step.

### 4.3 Assumptions

- The admin UI’s Entra External ID “Sign up and sign in” user flow is configured with email one-time-passcode (or email-with-password) verification enabled.
- Self-service sign-up at the identity-provider level remains unrestricted for as long as this feature is live.
- The first user’s email is the source of truth for the organization’s `domain`; the tenant name is supplied by the caller.
- A single domain maps to a single tenant for the purpose of self-service domain matching; multi-tenant single-domain organizations are not supported in this release.

### 4.4 Constraints

- The feature must not widen `platform_admin_role` beyond the single additional `domain` column.
- No outbound email or notification channel exists, so promises to the rejected caller are limited to in-app copy only.
- The public-email-provider denylist is a maintained code constant, not a real-time third-party service or database table.
- The endpoint must remain blocked from untrusted public traffic until rate limiting is implemented.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Prospective Tenant-Admin (new user) | Primary end user of the sign-up flow | High | Create a tenant quickly, understand why a domain is rejected, and know what to do next |
| Existing Tenant-Admin | Receives same-domain invite proposals | High | See legitimate colleague requests and invite them without friction |
| Platform Admin | Owns recovery, abuse escalation, and audit | High | Retain visibility, audit trail, and a manual recovery path for disputed domains |
| Security & Architecture Reviewer | Evaluates authorization and abuse surface | Medium | Least-privilege roles, anti-enumeration, no cross-tenant data leakage |
| Product Owner | Sponsors the feature and prioritizes gaps | High | Clear scope, named open gaps, and no speculative machinery |
| Customer Support / Operations | Handles misclassified domains and abuse reports | Medium | A recoverable, auditable process for domain corrections |

---

## 6. Current State (As-Is)

Today, a new SocialEngage user has only two ways to access the platform:

1. They already resolve to a `users` or `platform_admins` row and sign in normally.
2. An existing Tenant-Admin has created an `invited` row for them, and they sign in via the invite-link flow.

There is no path for a user who arrives with a validated Entra token but no matching row and no invitation. The backend `createTenant()` function is only reachable through `platform_admin_role`, which an unauthenticated member of the public cannot hold. As a result, the first person from any new organization must either ask the Platform Admin to create their tenant, or find an out-of-band way to be invited. This is a real support bottleneck and a barrier to self-service adoption.

**Pain points:**
- Manual provisioning is required for every new first tenant.
- The sign-up screen exists conceptually but has no safe authorization decision backing it.
- Domain match, public email exclusion, and first-admin provisioning are unresolved hand-off points.
- Rejected sign-up attempts for already-onboarded domains leave the caller and the existing Tenant-Admin with no visible signal.

---

## 7. Future State (To-Be)

A new user lands on the admin UI `/sign-up` page, enters a tenant name, and is redirected through the Entra External ID self-service sign-up user flow. After successful authentication, the admin UI calls the dedicated core self-service sign-up endpoint.

The backend then:

1. Resolves the bearer token to a validated Entra `sub` and `email` claim.
2. Checks whether the email already has an unlinked `invited` row; if so, routes the caller into the existing invite-link flow.
3. Checks whether the `sub` or `email` already belongs to an existing user or Platform Admin; if so, rejects with a clear “you already have an account” message.
4. Applies the public/free-email-provider denylist; if matched, leaves the captured `domain` as `NULL`.
5. Attempts to insert a new `tenants` row using the purpose-built `tenant_signup_role`.
6. Catches a unique-constraint violation on `domain` as a domain-match rejection, responds with a non-identifying message, and writes the attempt to the tenant-scoped `domain_signup_attempts` table.
7. On a successful `tenants` insert, opens an ordinary `app_user` tenant-scoped session and inserts the first `users` row with role `tenant_admin`.
8. Logs the tenant creation to `platform_admin_audit_log` with a clearly self-service-labeled actor identity.

For rejected same-domain attempts, the existing Tenant-Admin sees a “Same-Domain Invite Assist” item in the admin UI: one row per domain with a count of distinct verified emails, an escalation indicator when a threshold is crossed, and an expandable list with one-click pre-fill of the invite form. Repeated attempts also generate an escalation entry in the Platform Admin audit log, including the verified email addresses involved. For a wrongly assigned or squatted domain, a Platform Admin can correct the `domain` value using an audited, narrowly scoped write.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Self-service tenant creation must use a dedicated Postgres role with the minimum necessary grant (`INSERT`-only on `tenants`) | Security | Must | Role is not `platform_admin_role`; no `SELECT`/`UPDATE`/`DELETE` grants on `tenants` are given |
| NFR-002 | Every privileged write must be recorded in an existing, durable audit log | Security / Compliance | Must | `tenant_signup_role` and `platform_admin_role` write to the same `platform_admin_audit_log` mechanism |
| NFR-003 | The rejection message must never disclose the matched organization’s name, ID, or metadata | Privacy | Must | Response body and UI copy contain no tenant-identifying details beyond the generic guidance |
| NFR-004 | The sign-up flow must reuse the existing BFF/session mechanism and `Authorization: Bearer` choke point | Maintainability | Must | No parallel auth mechanism is introduced; `GET /v1/me` resolves the new identity normally |
| NFR-005 | The public-email denylist must be maintainable without a database migration for each change | Maintainability | Should | The list is version-controlled in application code and can be updated by a normal code deploy |
| NFR-006 | The endpoint must not be exposed to untrusted public traffic until rate limiting is implemented | Security | Must | Feature is flagged/conditional until ADR-0040 / Story 5.18 is accepted and built |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants` row (id, name, domain, status, license_seat_count, created_at) | Newly created tenant record | `POST /v1/tenants/self-service-signup` | Platform Admin / system | Organization metadata |
| `users` row (id, tenant_id, external_subject, email, role) | First Tenant-Admin of the new tenant | Core identity resolution after tenant creation | Tenant-Admin | Personal data; auth identity |
| Entra `sub` and `email` claims | Validated OIDC claims for the new user | Entra External ID token | Identity provider | Personal data; authentication |
| `domain_signup_attempts` (tenant_id, email, attempted_at) | Durable record of each domain-match rejection | Self-service sign-up endpoint | Matched tenant’s Tenant-Admin | Personal data; tenant-scoped |
| `platform_admin_audit_log` (actor_identity, action, metadata, created_at) | Audit trail for tenant creation, escalations, and domain corrections | Privileged actions | Platform Admin / compliance | Operational audit data |
| `invited` (id, tenant_id, email, external_subject, status) | Pre-existing invitation used by the must-check-first rule | Invite-link flow (ADR-0032) | Tenant-Admin | Personal data; tenant-scoped |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Self-service tenant creation count | Track adoption of the new sign-up flow | Product team | Daily / weekly |
| Domain-match rejection count | Understand how often users hit the existing-tenant path | Product / support | Weekly |
| Public-email provider sign-up share | Measure the volume of non-domain-linked tenants | Product / Platform Admin | Monthly |
| Same-Domain Invite Assist conversion | Count how many rejected attempts lead to a manual invite | Product / Tenant-Admin | Weekly |
| Repeated-domain escalation count | Surface potential abuse or legitimate demand spikes | Platform Admin / Security | Daily |
| Tenant-creation audit log | Compliance and incident review | Platform Admin / Compliance | On demand |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Bulk or scripted creation of many disposable tenants | Medium | Medium | Defer full design to ADR-0040 / Story 5.18; keep endpoint gated until rate limiting is in place; email OTP raises the cost of distinct identities | Product Owner |
| R-002 | Information disclosure / domain enumeration through rejection messages | Low | High | Never name the matched organization; require email OTP verification before any domain matching occurs; vague response copy | Security & Architecture |
| R-003 | Incomplete public-email denylist incorrectly links unrelated tenants | Low | Medium | Maintain a static list in code; accept manual update cadence; revisit only if demonstrated false-positive rate is a real problem | Product Owner |
| R-004 | Entra user-flow configuration drifts to skip email verification | Low | High | Add a deployment/startup check that confirms email verification is still enabled on the configured user flow | Technical Lead |
| R-005 | A wrong or squatted `domain` blocks a legitimate organization | Low | High | Provide a Platform Admin recovery path with `UPDATE(domain)` on `tenants`, fully audited | Platform Admin |
| R-006 | A future decision to restrict self-service sign-up at the Entra IdP level silently breaks this feature | Low | High | Flag the cross-ADR dependency for explicit reconciliation before ADR-0029’s open question is resolved | Product Owner |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A brand-new user can complete sign-up and land in the tenant-facing admin UI as the new tenant’s first `tenant_admin`.
- A sign-up with a public/free email provider produces a tenant whose `domain` is `NULL` and is independent of any other such sign-up.
- A sign-up whose email domain already matches an existing tenant receives a specific, non-identifying rejection message and is not joined to that tenant.
- The rejection message reassures the caller that the request has been shared with their organization’s admin without confirming the organization’s identity.
- A caller with an existing unlinked `invited` row is routed through the existing invite-link flow and no new tenant is created.
- A caller already linked to a `users` or `platform_admins` row is rejected with a clear “you already have an account” message.
- The new tenant’s `tenants` insert and first `users` insert occur atomically; a partial state surfaces a real, actionable error.
- The `platform_admin_audit_log` contains a self-service-labeled record for every successful tenant creation.
- The `domain_signup_attempts` table records every domain-match rejection, and the existing Tenant-Admin sees it as a Same-Domain Invite Assist item.
- The Same-Domain Invite Assist view shows one item per domain, an escalated state after repeated attempts, and a one-click “Invite this person” action per email that pre-fills the invite form.
- Repeated attempts crossing the escalation threshold generate a Platform Admin audit log entry with the verified email addresses behind it.
- A Platform Admin can correct a tenant’s `domain` value as an audited, scoped action.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Tenant-Admin | The primary administrator of a tenant; can invite users, manage connectors, and view tenant settings. |
| First Tenant-Admin | The user who creates a new tenant through self-service sign-up and is assigned the first `tenant_admin` role in that tenant. |
| `tenant_signup_role` | A purpose-built Postgres role with `BYPASSRLS` and `INSERT`-only grant on `tenants`, used solely for the self-service tenant creation step. |
| Public/free email provider | A consumer email domain (e.g. `gmail.com`, `outlook.com`) that is excluded from `domain` capture. |
| Domain match | The situation where a sign-up email’s non-excluded domain already exists as another tenant’s `domain`, triggering a rejection. |
| Same-Domain Invite Assist | A Tenant-Admin-facing view that surfaces rejected same-domain sign-up attempts as one-click invite proposals. |
| `domain_signup_attempts` | A tenant-scoped table recording each rejected same-domain sign-up attempt. |
| `platform_admin_audit_log` | A durable audit table used for every privileged action, including tenant creation, escalations, and domain corrections. |
| `platform_admin_role` | The Postgres role used for Platform Admin actions; explicitly locked to a small set of `tenants` columns. |
| Invite-only onboarding | The project’s default philosophy that new users join only through an explicit invitation, not through an approval queue or auto-join. |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0037: Self-service tenant sign-up — authorization mechanism for unauthenticated tenant creation, domain-match handling, and public-email-provider exclusion](../../../../docs/adr/0037-self-service-tenant-signup-and-first-tenant-admin-provisioning.md)
- [ADR-0031: Tenants table shape](../../../../docs/adr/0031-tenants-table-shape.md)
- [ADR-0032: User invitation and link flow](../../../../docs/adr/0032-user-invitation-and-link-flow.md)
- [ADR-0029: Authentication mechanism — Entra External ID](../../../../docs/adr/0029-authentication-mechanism-entra-external-id.md)
- [ADR-0030: Platform Admin bypass scope](../../../../docs/adr/0030-platform-admin-bypass-scope.md)
- [ADR-0036: Admin UI session / BFF mechanism](../../../../docs/adr/0036-admin-ui-session-and-bff-mechanism.md)
- [ADR-0040: Self-service sign-up rate limiting and abuse prevention mechanism](../../../../docs/adr/0040-self-service-signup-rate-limiting-and-abuse-prevention-mechanism.md)
- [docs/user-stories/epic-6-tenant-admin-ui.md](../../../../docs/user-stories/epic-6-tenant-admin-ui.md) — Stories 6.7 and 6.10

### 16.2 Product-Research References

- [docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md](../../../../docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md) — provides RBAC context and references `POST /v1/tenants/self-service-signup`.
- [docs/product-research/feature-designs/19-self-service-onboarding-checklist.md](../../../../docs/product-research/feature-designs/19-self-service-onboarding-checklist.md) — high-level onboarding checklist; mentions the importance of self-service sign-up and trial-to-paid conversion.

### 16.3 Missing Sources

No dedicated `self-service-tenant-signup` feature design or `self-service-tenant-signup-deep-research.md` report was found in `docs/product-research/`. The business requirements above are therefore derived primarily from ADR-0037 and the directly related user stories (Epic 6, Stories 6.7 and 6.10). A dedicated product-research brief should be added if the team wants deeper competitive or UX context.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
