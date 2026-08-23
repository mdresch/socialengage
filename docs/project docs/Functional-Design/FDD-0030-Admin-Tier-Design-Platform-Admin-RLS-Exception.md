# Business Requirements Document (BRD) — Admin-tier design: Platform Admin via a narrowly-scoped, audited BYPASSRLS role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Admin-tier design: Platform Admin via a narrowly-scoped, audited BYPASSRLS role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0030-admin-tier-design-platform-admin-rls-exception.md, ../Business-Requirements/BRD-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0030-admin-tier-design-platform-admin-rls-exception.md and the business requirements in BRD-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md into functional design for **Admin Tier Design Platform Admin RLS Exception**.
SocialEngage must support two structurally different administrative roles: the **Platform Admin**, who provisions and operates the multi-tenant platform, and the **Tenant-Admin**, who manages a single tenant's users, connectors, and watchlists. Conflating these two roles into one "admin" mechanism creates an unacceptable risk that platform-level operations could become an unaudited, implicit path to any tenant's data.

This BRD captures the decision to give each admin tier its own, purpose-built access mechanism. Tenant-Admins work inside ordinary tenant-scoped Postgres Row-Level Security (RLS), with their elevated authority enforced at the application layer. Platform Admins use a dedicated, non-superuser Postgres role granted the `BYPASSRLS` attribute, but that role is locked to the `tenants` registry and a separate Platform Admin identity table — never to tenant-content tables such as `users`, `watchlists`, `social_posts`, or `platform_credentials`. Every privileged Platform Admin write is durably logged, and a narrowly-scoped break-glass path lets a Platform Admin force a Tenant-Admin credential reset (plus a Temporary Access Pass) only when a tenant's sole Tenant-Admin is locked out.

The expected business value is a hard, auditable separation between platform operations and tenant data, a defensible trust boundary for customers and compliance reviewers, and a recovery path for the most likely lockout scenario without reopening the zero-tenant-data-access boundary.

---

### 2.2 Scope
**In scope:**
- Two distinct admin tiers: **Platform Admin** and **Tenant-Admin**, each with its own mechanism.
- A dedicated `platform_admin_role` Postgres role with the `BYPASSRLS` attribute, granted only on the `tenants` table and a separate Platform Admin identity table.
- Tenant-Admin authority enforced at the application authorization layer (resolved `role` check) while running under ordinary tenant-scoped RLS.
- Durable, queryable audit logging for every `platform_admin_role` write and every break-glass execution.
- A two-step break-glass flow: durable **request** (no Entra action) and explicit human-reviewed **execution** (password reset plus Temporary Access Pass).
- Request-time identity resolution as a documented, read-only `BYPASSRLS` use.
- Contract tests proving `platform_admin_role` cannot read or write `users`, `watchlists`, `social_posts`, or `platform_credentials`.

**Out of scope:**
- Fine-grained permission matrices beyond the three primary roles (`platform_admin`, `tenant_admin`, `tenant_user`).
- Infrastructure/operational metrics dashboards for the Platform Admin console (deferred to a future story).
- The specific Jira Service Management customer-portal configuration used to receive break-glass requests (Atlassian-side tooling, not SocialEngage scope).
- Impersonation of Tenant-Users or Tenant-Admins by Platform Admins.
- A sanctioned escalation path when a tenant has zero reachable Tenant-Admins (explicitly named as a residual gap).

## 3. Context and Background
Two tiers of "admin" are named in this project's own documents and must not be conflated, because they need structurally different mechanisms:

- **Tenant-Admin** — `Stakeholder-Register.md`'s own persona entry: "manages that tenant's own users, connectors, and watchlists" *within one tenant*. ADR-0028 already names this role as the sole holder of tenant-wide credential-creation authority, without deciding its mechanics.
- **Platform Admin** — the brainstorm's provisioning-only role: create/suspend a SocialEngage tenant, set its license/seat count, with a boundary that "leans toward... zero tenant-data access" but was left "floated, not locked."

This project's own codebase already contains a real, working precedent for a database-level RLS exception, just not one built for live application traffic: every migration (`migrations/0002_enable_rls_social_posts.sql` and every RLS-enabling migration since) runs as the Postgres bootstrap/superuser role, and `credential-envelope-encryption`'s own `SKILL.md` states the underlying mechanic plainly — "superuser/table-owner RLS bypass." Postgres never applies RLS to a superuser (no override exists), and `docs/adr/README.md`'s own Story 5.4 contract test comment confirms this is understood and relied on today ("superusers and table owners bypass RLS unconditionally"). This is the "migration role's existing superuser bypass" `docs/adr/README.md`'s 2026-07-30 note names as the shape candidate ADR #2 should follow — but reusing the *migration* role directly for live Platform Admin traffic would be far broader than needed (full schema-alteration rights, not just a row-level bypass) and is rejected below.

Postgres exposes the narrower primitive this ADR actually needs: `BYPASSRLS` is a role attribute independently grantable to any role via `ALTER ROLE ... BYPASSRLS`, separate from superuser status — a role can bypass RLS without holding any of a superuser's other privileges. This project has not yet used that narrower form; only the bootstrap superuser's blanket bypass exists today.
SocialEngage must support two structurally different administrative roles: the **Platform Admin**, who provisions and operates the multi-tenant platform, and the **Tenant-Admin**, who manages a single tenant's users, connectors, and watchlists. Conflating these two roles into one "admin" mechanism creates an unacceptable risk that platform-level operations could become an unaudited, implicit path to any tenant's data.

This BRD captures the decision to give each admin tier its own, purpose-built access mechanism. Tenant-Admins work inside ordinary tenant-scoped Postgres Row-Level Security (RLS), with their elevated authority enforced at the application layer. Platform Admins use a dedicated, non-superuser Postgres role granted the `BYPASSRLS` attribute, but that role is locked to the `tenants` registry and a separate Platform Admin identity table — never to tenant-content tables such as `users`, `watchlists`, `social_posts`, or `platform_credentials`. Every privileged Platform Admin write is durably logged, and a narrowly-scoped break-glass path lets a Platform Admin force a Tenant-Admin credential reset (plus a Temporary Access Pass) only when a tenant's sole Tenant-Admin is locked out.

The expected business value is a hard, auditable separation between platform operations and tenant data, a defensible trust boundary for customers and compliance reviewers, and a recovery path for the most likely lockout scenario without reopening the zero-tenant-data-access boundary.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep Platform Admin access provisioning-only and free of tenant content | Contract and UI tests prove `platform_admin_role` has no grant on any tenant-content table |
| 2 | Give Tenant-Admin authority without a database bypass | All Tenant-Admin actions run under the ordinary `app_user` tenant-scoped session and an application-layer role check |
| 3 | Make every privileged Platform Admin action auditable | Every tenant creation, suspension, seat-count change, and break-glass execution produces a durable, queryable log row |
| 4 | Provide a safe, human-reviewed Tenant-Admin lockout recovery | A two-phase break-glass request and execution flow resets a Tenant-Admin's credential and issues a Temporary Access Pass, logged but never persisted |
| 5 | Reuse a proven Postgres primitive rather than inventing a new bypass | The `BYPASSRLS` attribute is applied to a dedicated, narrowly-scoped, non-superuser role |

---

**Positive consequences (from ADR):**
**Positive**
- Reuses a real, already-proven Postgres primitive (`BYPASSRLS`/superuser exemption) this project already depends on for migrations and `pg_cron`, rather than inventing a new bypass mechanism from scratch.
- Locks in a boundary the brainstorm explicitly left floating, and directly resolves ADR-0028's flagged Open Question rather than leaving it open a second time in this batch.
- Keeps Tenant-Admin's authorization model maximally simple: zero new database mechanism, reuses ADR-0015's existing RLS wholesale.
- **Added at review, 2026-08-03:** a real, narrowly-scoped recovery path now exists for the single most likely lockout scenario (a tenant's only Tenant-Admin losing their own credential) — without reintroducing any broader tenant-data access, and without widening `platform_admin_role`'s already-locked Postgres grant at all (§3).

**Negative**
- `BYPASSRLS` is an unconditional, row-level bypass for whatever tables a role holding it is granted access to. A future migration or code change that mistakenly grants `platform_admin_role` access to a tenant-content table (not just `tenants`) would silently defeat RLS for that table, with no additional guardrail beyond code review and the audit log catching it *after* the fact — not preventing it. This is a real, named risk of the chosen mechanism, not a costless one.
- **Revised at review, 2026-08-03 (was: "declining an emergency-access override... accepted gap"):** a break-glass path now exists, but only for the Tenant-Admin-credential-reset case. A tenant with **zero** remaining reachable Tenant-Admins and no other recovery contact still has no sanctioned path back in under this ADR — named as a real, remaining gap, not solved by this addition, and not addressed further here (Open Questions, below). The Graph API mechanism itself (§3) is also not yet verified against Microsoft's current documentation — a real, if narrow, implementation-readiness gap for whoever builds candidate ADR #4's story.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a Platform Admin to create, suspend, and adjust the license seat count of a SocialEngage tenant | Must | `POST /v1/admin/tenants` and `PATCH /v1/admin/tenants/:id` are reachable only through `platform_admin_role`; `active_seat_count` is never written by Platform Admin | Product Owner |
| BR-002 | The system shall prevent Platform Admin from reading or writing any tenant-content table | Must | Contract tests assert `platform_admin_role` has no grant on `users`, `watchlists`, `social_posts`, or `platform_credentials` | Technical Lead |
| BR-003 | The system shall allow a Tenant-Admin to manage the tenant's users, connectors, and watchlists using ordinary tenant-scoped RLS | Must | Tenant-Admin actions use `app_user` and `withTenant()`; elevated actions are gated by an application-layer role check | Product Owner |
| BR-004 | The system shall resolve every authenticated request to a SocialEngage identity before any tenant-scoped query | Must | A read-only bypass role maps the Entra `sub` claim to `(tenant_id, user_id, role)` and then the rest of the request runs through ordinary RLS | Technical Lead |
| BR-005 | The system shall record every Platform Admin privileged write in a durable, queryable audit log | Must | Each log row contains acting identity, operation, target tenant, and timestamp; a contract test proves the log is created on tenant-suspension | Product Owner |
| BR-006 | The system shall support a two-phase break-glass flow for a locked-out Tenant-Admin | Must | A request phase records the request with no Entra action; an execute phase explicitly picked up by a Platform Admin performs the reset and is logged | Product Owner |
| BR-007 | The system shall issue a Temporary Access Pass as part of break-glass execution for a lost MFA device | Must | The TAP is returned once to the caller, never logged or persisted, and is delivered through a verified out-of-band channel | Security Lead |
| BR-008 | The system shall store Platform Admin identity in a table separate from `users` | Must | The Platform Admin table has no `tenant_id` column and returns zero rows under any ordinary tenant-scoped session | Technical Lead |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Admin / Sole Operator (Menno) | Provisions tenants, reviews audit log, executes break-glass | High | A console that can operate the platform without hand-writing SQL and without seeing tenant data |
| Tenant-Admin | Manages one tenant's users, connectors, and watchlists | Medium | Assurance that their own elevated actions stay inside their tenant and do not need a special database bypass |
| Tenant User | Uses platform features within one tenant | Medium | Confidence that Platform Admin cannot view or alter tenant content |
| Security & Compliance Reviewer | Validates access controls and audit trails | High | Documented, versioned RLS and role boundaries with durable logs |
| Backend / Platform Engineer | Implements role scoping and bypass paths | High | A clear, least-privilege model that reuses proven Postgres primitives |
| Product Owner / Sponsor (Menno) | Accountable for scope and acceptability | High | Zero tenant-data access for Platform Admin, auditable privileged actions |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 5.6 | epic-5-security-isolation-and-messaging.md | As person signing in to SocialEngage (an invited tenant user, a Tenant-Admin, or Platform Admin), I want to authenticate through Microsoft Entra External ID ... | `social-listening-core` validates a bearer token's signature and issuer against the Entra external tenant's own published JWKS/OIDC discovery document — no r... |
| Story 5.7 | epic-5-security-isolation-and-messaging.md | As platform operator provisioning or suspending a SocialEngage tenant, I want my actions to run through a database role that can see the tenant registry but ... | A dedicated Postgres role (e.g. `platform_admin_role`) is granted the `BYPASSRLS` attribute and `SELECT`/`INSERT`/`UPDATE` **only** on the `tenants` table an... |
| Story 5.12 | epic-5-security-isolation-and-messaging.md |  | `GET /v1/admin/tenants` lists every tenant (`id`, `name`, `domain`, `status`, `licenseSeatCount`, `activeSeatCount`, `createdAt`) — reachable only through a ... |
| Story 5.13 | epic-5-security-isolation-and-messaging.md |  | `POST /v1/admin/tenants/:id/break-glass/request` records a pending request (target tenant, who/what reported it, `status: 'requested'`) — performs no Entra-s... |
| Story 5.14 | epic-5-security-isolation-and-messaging.md |  | `GET /v1/admin/audit-log` returns audit entries (`actorIdentity`, `operation`, `targetTenantId`, `detail`, `createdAt`), reachable only through a `platform_a... |
| Story 6.6 | epic-7-platform-admin-ui.md |  | Tenant list screen: name, domain, status, seat ceiling/active count, created date (ADR-0031's schema) — reading from a new `GET /v1/admin/tenants`-shaped cor... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants` | Registry of all SocialEngage tenants, including `status`, `license_seat_count`, `active_seat_count`, `domain` | ADR-0031 / Story 5.8 | Product Owner / Technical Lead | Platform-level configuration |
| `platform_admins` | Separate Platform Admin identity table with no `tenant_id` | ADR-0030 §6 / ADR-0032 | Product Owner / Technical Lead | Platform admin identity |
| `users` | Tenant-scoped user rows with `role`, `external_subject`, `access_ends_at` | ADR-0032 / Story 5.9 | Product Owner / Technical Lead | Personal data; tenant-scoped |
| `platform_admin_audit_log` | Durable log of Platform Admin writes: actor, operation, target tenant, timestamp | ADR-0030 §5 / Story 5.7 | Product Owner / Technical Lead | High — privileged action evidence |
| Temporary Access Pass (TAP) code | One-time pass for Tenant-Admin recovery, returned once and never stored | Microsoft Entra Graph API | Security Lead | Critical — single-disclosure secret |
| Break-glass request record | Durable record of a break-glass request with status, target tenant, reporter | ADR-0030 Clarification / Story 5.13 | Product Owner / Technical Lead | High — sensitive operational record |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | `platform_admin_role` has the `BYPASSRLS` attribute and is granted `SELECT`/`INSERT`/`UPDATE` only on the `tenants` table and its own Platform Admin identity table. |
| BRU-002 | A Tenant-Admin's elevated authority (e.g., tenant-wide credential creation, user invitation) is enforced at the application authorization layer, never by a database bypass. |
| BRU-003 | Every write performed through `platform_admin_role` (tenant creation, suspension, license-seat change, break-glass execution) is logged with the acting Platform Admin identity, operation, target tenant, and timestamp. |
| BRU-004 | Break-glass is limited to forcing a credential reset and Temporary Access Pass for an existing Tenant-Admin; it is not a general view/edit override, not impersonation, and does not extend to Tenant Users. |
| BRU-005 | Platform Admin never learns or sets the Tenant-Admin's new credential value; the Tenant-Admin completes their own password-reset flow with Entra. |
| BRU-006 | Sentinel-value hacks and direct reuse of the migration superuser role for live Platform Admin traffic are rejected alternatives. |
| BRU-007 | A tenant with zero reachable Tenant-Admins has no sanctioned escalation path in this version; the gap is explicitly named and not assumed solved. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0029 — Microsoft Entra External ID authentication | Internal / Architecture | Technical Lead | Already accepted; identity resolution depends on it |
| D-002 | ADR-0015 — Postgres Row-Level Security tenant isolation | Internal / Architecture | Technical Lead | Already accepted; tenant-scoped session model |
| D-003 | ADR-0028 — Credential/connector ownership tiers | Internal / Architecture | Product Owner | Already accepted; defines Tenant-Admin authority |
| D-004 | ADR-0031 — `tenants` table shape | Internal / Architecture | Technical Lead | Already accepted; Platform Admin writes target this table |
| D-005 | ADR-0032 — `users` table, RLS, and request-time identity resolution | Internal / Architecture | Technical Lead | Already accepted; defines `resolveIdentity()` path |
| D-006 | ADR-0041 — Platform Admin as a structurally distinct identity | Internal / Architecture | Technical Lead | Already accepted; reinforces the zero-tenant-content boundary |
| D-007 | Story 5.6 — Entra authentication | Internal / Delivery | AI Delivery Agent | Already built |
| D-008 | Story 5.7 — Platform Admin's audited, narrowly-scoped RLS bypass | Internal / Delivery | AI Delivery Agent | Already built |
| D-009 | Story 5.8 — `tenants` table with RLS | Internal / Delivery | AI Delivery Agent | Already built |
| D-010 | Story 5.9 — `users` table and identity resolution | Internal / Delivery | AI Delivery Agent | Already built |
| D-011 | Story 6.6 — Platform Admin console UI | Internal / Delivery | AI Delivery Agent | Built; renders provision, update, break-glass, audit log |

---

- Postgres RLS is already active on all tenant-scoped tables, per ADR-0015 and Story 5.4.
- Microsoft Entra External ID remains the sole identity provider, per ADR-0029.
- The `tenants` table design (ADR-0031) and `users` table design (ADR-0032) are accepted and in place before this work is built.
- Platform Admin break-glass execution uses a verified, out-of-band channel to deliver the Temporary Access Pass to the real Tenant-Admin.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `platform_admin_role` shall be a non-superuser role with no schema-alteration privileges | Security | Must | Migration and contract tests confirm the role is not `SUPERUSER` and cannot create or alter tables |
| NFR-002 | Platform Admin audit log shall be durable and queryable, not only an application log line | Compliance | Must | Audit rows are stored in Postgres and can be queried through a dedicated endpoint |
| NFR-003 | Identity resolution shall not materially increase request latency | Performance | Should | Request-time identity lookup runs in a single, column-limited query and is cached for the request lifetime |
| NFR-004 | The zero-tenant-data-access boundary for Platform Admin shall be enforceable in tests | Security | Must | The full accumulated contract suite continues to pass and includes a "no grant on tenant-content tables" test |

---

## 11. Error Handling and Exceptions
**Positive**
- Reuses a real, already-proven Postgres primitive (`BYPASSRLS`/superuser exemption) this project already depends on for migrations and `pg_cron`, rather than inventing a new bypass mechanism from scratch.
- Locks in a boundary the brainstorm explicitly left floating, and directly resolves ADR-0028's flagged Open Question rather than leaving it open a second time in this batch.
- Keeps Tenant-Admin's authorization model maximally simple: zero new database mechanism, reuses ADR-0015's existing RLS wholesale.
- **Added at review, 2026-08-03:** a real, narrowly-scoped recovery path now exists for the single most likely lockout scenario (a tenant's only Tenant-Admin losing their own credential) — without reintroducing any broader tenant-data access, and without widening `platform_admin_role`'s already-locked Postgres grant at all (§3).

**Negative**
- `BYPASSRLS` is an unconditional, row-level bypass for whatever tables a role holding it is granted access to. A future migration or code change that mistakenly grants `platform_admin_role` access to a tenant-content table (not just `tenants`) would silently defeat RLS for that table, with no additional guardrail beyond code review and the audit log catching it *after* the fact — not preventing it. This is a real, named risk of the chosen mechanism, not a costless one.
- **Revised at review, 2026-08-03 (was: "declining an emergency-access override... accepted gap"):** a break-glass path now exists, but only for the Tenant-Admin-credential-reset case. A tenant with **zero** remaining reachable Tenant-Admins and no other recovery contact still has no sanctioned path back in under this ADR — named as a real, remaining gap, not solved by this addition, and not addressed further here (Open Questions, below). The Graph API mechanism itself (§3) is also not yet verified against Microsoft's current documentation — a real, if narrow, implementation-readiness gap for whoever builds candidate ADR #4's story.

## 12. Assumptions and Dependencies
- Postgres RLS is already active on all tenant-scoped tables, per ADR-0015 and Story 5.4.
- Microsoft Entra External ID remains the sole identity provider, per ADR-0029.
- The `tenants` table design (ADR-0031) and `users` table design (ADR-0032) are accepted and in place before this work is built.
- Platform Admin break-glass execution uses a verified, out-of-band channel to deliver the Temporary Access Pass to the real Tenant-Admin.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A future migration or code change mistakenly grants `platform_admin_role` access to a tenant-content table, silently defeating RLS | Medium | High | Strict migration review, CI tests that assert table grants, and durable audit logs that catch abuse after the fact | Technical Lead |
| R-002 | The Temporary Access Pass is disclosed to the wrong party because the out-of-band delivery channel is not verified | Medium | High | Deliver TAP only through a verified channel (e.g., a Platform Admin console shown once, or a verified phone call); never log or persist the code | Security Lead |
| R-003 | Microsoft Graph API permissions needed for password reset/TAP are not confirmed before implementation | Medium | Medium | Verify current Entra/Graph documentation and permission scope before building the break-glass execution | Technical Lead |
| R-004 | A tenant with zero reachable Tenant-Admins has no recovery path | Low | High | Explicitly name the residual gap; revisit only when a real, specific need is demonstrated | Product Owner |
| R-005 | UI or code accidentally exposes tenant content on a Platform Admin screen | Low | High | Enforce the boundary in route gating, role checks, and contract tests; no Platform Admin screen renders `users`, `watchlists`, `social_posts`, or `platform_credentials` | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0030-admin-tier-design-platform-admin-rls-exception.md`
- BRD: `../Business-Requirements/BRD-0030-Admin-Tier-Design-Platform-Admin-RLS-Exception.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above