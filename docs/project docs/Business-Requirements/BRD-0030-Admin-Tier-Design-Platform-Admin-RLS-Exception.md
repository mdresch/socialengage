# Business Requirements Document (BRD) — Admin-tier design: Platform Admin via a narrowly-scoped, audited BYPASSRLS role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage Social Listening / Insights — Admin-tier design: Platform Admin RLS exception and Tenant-Admin role enforcement |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | Menno, BRD Writer Agent |
| Approver(s) | Menno, Business Sponsor / Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | Menno | Initial draft from ADR-0030, feature design 12, and Stories 5.6–5.10 / 6.6 |
| 1.0 | 2026-08-22 | Menno | Approved as final BRD |

---

## 2. Executive Summary

SocialEngage must support two structurally different administrative roles: the **Platform Admin**, who provisions and operates the multi-tenant platform, and the **Tenant-Admin**, who manages a single tenant's users, connectors, and watchlists. Conflating these two roles into one "admin" mechanism creates an unacceptable risk that platform-level operations could become an unaudited, implicit path to any tenant's data.

This BRD captures the decision to give each admin tier its own, purpose-built access mechanism. Tenant-Admins work inside ordinary tenant-scoped Postgres Row-Level Security (RLS), with their elevated authority enforced at the application layer. Platform Admins use a dedicated, non-superuser Postgres role granted the `BYPASSRLS` attribute, but that role is locked to the `tenants` registry and a separate Platform Admin identity table — never to tenant-content tables such as `users`, `watchlists`, `social_posts`, or `platform_credentials`. Every privileged Platform Admin write is durably logged, and a narrowly-scoped break-glass path lets a Platform Admin force a Tenant-Admin credential reset (plus a Temporary Access Pass) only when a tenant's sole Tenant-Admin is locked out.

The expected business value is a hard, auditable separation between platform operations and tenant data, a defensible trust boundary for customers and compliance reviewers, and a recovery path for the most likely lockout scenario without reopening the zero-tenant-data-access boundary.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Keep Platform Admin access provisioning-only and free of tenant content | Contract and UI tests prove `platform_admin_role` has no grant on any tenant-content table |
| 2 | Give Tenant-Admin authority without a database bypass | All Tenant-Admin actions run under the ordinary `app_user` tenant-scoped session and an application-layer role check |
| 3 | Make every privileged Platform Admin action auditable | Every tenant creation, suspension, seat-count change, and break-glass execution produces a durable, queryable log row |
| 4 | Provide a safe, human-reviewed Tenant-Admin lockout recovery | A two-phase break-glass request and execution flow resets a Tenant-Admin's credential and issues a Temporary Access Pass, logged but never persisted |
| 5 | Reuse a proven Postgres primitive rather than inventing a new bypass | The `BYPASSRLS` attribute is applied to a dedicated, narrowly-scoped, non-superuser role |

---

## 4. Scope

### 4.1 In Scope

- Two distinct admin tiers: **Platform Admin** and **Tenant-Admin**, each with its own mechanism.
- A dedicated `platform_admin_role` Postgres role with the `BYPASSRLS` attribute, granted only on the `tenants` table and a separate Platform Admin identity table.
- Tenant-Admin authority enforced at the application authorization layer (resolved `role` check) while running under ordinary tenant-scoped RLS.
- Durable, queryable audit logging for every `platform_admin_role` write and every break-glass execution.
- A two-step break-glass flow: durable **request** (no Entra action) and explicit human-reviewed **execution** (password reset plus Temporary Access Pass).
- Request-time identity resolution as a documented, read-only `BYPASSRLS` use.
- Contract tests proving `platform_admin_role` cannot read or write `users`, `watchlists`, `social_posts`, or `platform_credentials`.

### 4.2 Out of Scope

- Fine-grained permission matrices beyond the three primary roles (`platform_admin`, `tenant_admin`, `tenant_user`).
- Infrastructure/operational metrics dashboards for the Platform Admin console (deferred to a future story).
- The specific Jira Service Management customer-portal configuration used to receive break-glass requests (Atlassian-side tooling, not SocialEngage scope).
- Impersonation of Tenant-Users or Tenant-Admins by Platform Admins.
- A sanctioned escalation path when a tenant has zero reachable Tenant-Admins (explicitly named as a residual gap).

### 4.3 Assumptions

- Postgres RLS is already active on all tenant-scoped tables, per ADR-0015 and Story 5.4.
- Microsoft Entra External ID remains the sole identity provider, per ADR-0029.
- The `tenants` table design (ADR-0031) and `users` table design (ADR-0032) are accepted and in place before this work is built.
- Platform Admin break-glass execution uses a verified, out-of-band channel to deliver the Temporary Access Pass to the real Tenant-Admin.

### 4.4 Constraints

- `platform_admin_role` must never hold superuser or schema-alteration privileges.
- `platform_admin_role` must not be granted on any table that carries tenant content.
- The audit log must be durable and queryable, not only an application log line.
- Break-glass execution is a human-reviewed, two-step process — never a single self-triggering automated action.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform Admin / Sole Operator (Menno) | Provisions tenants, reviews audit log, executes break-glass | High | A console that can operate the platform without hand-writing SQL and without seeing tenant data |
| Tenant-Admin | Manages one tenant's users, connectors, and watchlists | Medium | Assurance that their own elevated actions stay inside their tenant and do not need a special database bypass |
| Tenant User | Uses platform features within one tenant | Medium | Confidence that Platform Admin cannot view or alter tenant content |
| Security & Compliance Reviewer | Validates access controls and audit trails | High | Documented, versioned RLS and role boundaries with durable logs |
| Backend / Platform Engineer | Implements role scoping and bypass paths | High | A clear, least-privilege model that reuses proven Postgres primitives |
| Product Owner / Sponsor (Menno) | Accountable for scope and acceptability | High | Zero tenant-data access for Platform Admin, auditable privileged actions |

---

## 6. Current State (As-Is)

The project's documents and code already name two admin roles, but the boundary between them has been left "floated, not locked." The current situation creates the following pain points:

- **Conflated admin concepts:** "Platform Admin" and "Tenant-Admin" are both called "admin" but need structurally different access, and no decision has locked the Platform Admin boundary.
- **No governed platform bypass:** The only existing RLS bypass is the migration/bootstrap superuser, which is far too broad for routine live application traffic.
- **Unresolved emergency-access question:** ADR-0028 explicitly flagged whether Platform Admin ever gets an emergency/support-access override and left it unanswered.
- **Tenant-Admin authority unsettled:** ADR-0028 named the Tenant-Admin as the sole tier for tenant-wide credential creation but did not decide how that authority is enforced.

---

## 7. Future State (To-Be)

After this initiative is implemented, the two admin tiers are separated by design, not only by documentation.

**New or improved process:**

1. A caller's Entra token is validated and resolved to a SocialEngage identity (`tenant_id`, `user_id`, `role`) using a narrowly-scoped, read-only bypass.
2. **Tenant-Admin** actions run through the ordinary `app_user` tenant-scoped session; the application checks `users.role` before allowing tenant-wide operations such as credential creation or user invitation.
3. **Platform Admin** actions run through a dedicated `platform_admin_role` with `BYPASSRLS`, but that role is granted only on the `tenants` table and a separate Platform Admin identity table.
4. Every tenant creation, suspension, license-seat change, or break-glass execution is written to a durable `platform_admin_audit_log` row.
5. A locked-out Tenant-Admin can be recovered only through a two-phase, human-reviewed break-glass request and execution, producing a password reset and a Temporary Access Pass — shown once, then never persisted.

**Expected capabilities:**

- Platform Admin can provision and suspend tenants and adjust seat counts without any access to tenant content.
- Tenant-Admin can manage their own tenant within ordinary RLS, with no special database bypass.
- Every privileged action is traceable to an acting identity, operation, target tenant, and timestamp.
- The most common Tenant-Admin lockout has a narrow, auditable recovery path.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | `platform_admin_role` shall be a non-superuser role with no schema-alteration privileges | Security | Must | Migration and contract tests confirm the role is not `SUPERUSER` and cannot create or alter tables |
| NFR-002 | Platform Admin audit log shall be durable and queryable, not only an application log line | Compliance | Must | Audit rows are stored in Postgres and can be queried through a dedicated endpoint |
| NFR-003 | Identity resolution shall not materially increase request latency | Performance | Should | Request-time identity lookup runs in a single, column-limited query and is cached for the request lifetime |
| NFR-004 | The zero-tenant-data-access boundary for Platform Admin shall be enforceable in tests | Security | Must | The full accumulated contract suite continues to pass and includes a "no grant on tenant-content tables" test |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants` | Registry of all SocialEngage tenants, including `status`, `license_seat_count`, `active_seat_count`, `domain` | ADR-0031 / Story 5.8 | Product Owner / Technical Lead | Platform-level configuration |
| `platform_admins` | Separate Platform Admin identity table with no `tenant_id` | ADR-0030 §6 / ADR-0032 | Product Owner / Technical Lead | Platform admin identity |
| `users` | Tenant-scoped user rows with `role`, `external_subject`, `access_ends_at` | ADR-0032 / Story 5.9 | Product Owner / Technical Lead | Personal data; tenant-scoped |
| `platform_admin_audit_log` | Durable log of Platform Admin writes: actor, operation, target tenant, timestamp | ADR-0030 §5 / Story 5.7 | Product Owner / Technical Lead | High — privileged action evidence |
| Temporary Access Pass (TAP) code | One-time pass for Tenant-Admin recovery, returned once and never stored | Microsoft Entra Graph API | Security Lead | Critical — single-disclosure secret |
| Break-glass request record | Durable record of a break-glass request with status, target tenant, reporter | ADR-0030 Clarification / Story 5.13 | Product Owner / Technical Lead | High — sensitive operational record |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Platform Admin audit log | Trace every privileged platform action for compliance and incident review | Security / Compliance Reviewer | On demand |
| Break-glass request/execution log | Track tenant-admin lockout recovery events and who executed them | Platform Admin / Security Lead | On demand |
| Tenant lifecycle events | Monitor create, suspend, and seat-count changes over time | Platform Admin / Product Owner | Weekly |
| `platform_admin_role` grant tests | Confirm the role has no unauthorized table grants | Security / Backend Engineer | Continuous (CI) |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | A future migration or code change mistakenly grants `platform_admin_role` access to a tenant-content table, silently defeating RLS | Medium | High | Strict migration review, CI tests that assert table grants, and durable audit logs that catch abuse after the fact | Technical Lead |
| R-002 | The Temporary Access Pass is disclosed to the wrong party because the out-of-band delivery channel is not verified | Medium | High | Deliver TAP only through a verified channel (e.g., a Platform Admin console shown once, or a verified phone call); never log or persist the code | Security Lead |
| R-003 | Microsoft Graph API permissions needed for password reset/TAP are not confirmed before implementation | Medium | Medium | Verify current Entra/Graph documentation and permission scope before building the break-glass execution | Technical Lead |
| R-004 | A tenant with zero reachable Tenant-Admins has no recovery path | Low | High | Explicitly name the residual gap; revisit only when a real, specific need is demonstrated | Product Owner |
| R-005 | UI or code accidentally exposes tenant content on a Platform Admin screen | Low | High | Enforce the boundary in route gating, role checks, and contract tests; no Platform Admin screen renders `users`, `watchlists`, `social_posts`, or `platform_credentials` | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A dedicated `platform_admin_role` has `BYPASSRLS` and is granted only on `tenants` and a dedicated Platform Admin identity table.
- Contract tests prove `platform_admin_role` has no grant on `users`, `watchlists`, `social_posts`, or `platform_credentials`.
- Every tenant creation, suspension, and license-seat change produces a row in `platform_admin_audit_log` with actor, operation, target tenant, and timestamp.
- Tenant-Admin actions (e.g., creating tenant-wide credentials) run under the ordinary `app_user` tenant-scoped session and do not use `platform_admin_role`.
- Request-time identity resolution uses a read-only bypass role that returns `(tenant_id, user_id, role)` and has no write grants.
- Break-glass is split into a durable request step (no Entra action) and an explicit execution step (password reset plus Temporary Access Pass) performed by a Platform Admin.
- The Temporary Access Pass is returned once, never logged or persisted, and delivered through a verified out-of-band channel.
- No Platform Admin console screen renders tenant content (`users`, `watchlists`, `social_posts`, `platform_credentials`, or per-tenant analytics derived from them).

---

## 15. Glossary

| Term | Definition |
|---|---|
| `BYPASSRLS` | A Postgres role attribute that lets a role bypass row-level security policies on tables it is granted to access, independent of superuser status. |
| Row-Level Security (RLS) | Postgres feature that restricts which rows a query can return based on a policy and the current session context. |
| Platform Admin | The platform operator role that provisions/suspends tenants and adjusts seat counts, with zero access to tenant content. |
| Tenant-Admin | The administrator of a single tenant, who manages users, connectors, and watchlists within that tenant. |
| Break-glass | A narrow, audited, human-reviewed recovery path for a locked-out Tenant-Admin. |
| Temporary Access Pass (TAP) | A one-time Entra credential that lets a user sign in and re-register a lost MFA method. |
| JIT | "Just-in-time" — short-lived elevation of privileges for a specific action, revoked immediately afterward. |
| Identity resolution | Mapping a validated Entra token `sub` to a SocialEngage `(tenant_id, user_id, role)` before any tenant-scoped query runs. |

---

## 16. Appendices

### 16.1 Reference documents

- [ADR-0030: Admin-tier design — Platform Admin via a narrowly-scoped, audited BYPASSRLS role; Tenant-Admin via ordinary tenant-scoped RLS plus an application-layer role check](../../adr/0030-admin-tier-design-platform-admin-rls-exception.md)
- [Feature design: 12 — Multi-user workspaces and RBAC](../../product-research/feature-designs/12-multi-user-workspaces-and-rbac.md)
- `docs/design/platform-admin-console-mockup-2026-08-03.html` — layout/flow reference for the Platform Admin console (plain HTML, not Next.js)
- `docs/design/README.md` — design-folder status and limitations

**Missing source:** A `docs/product-research/reports/<feature>-deep-research.md` file for this feature does not exist in the repository; no competitive deep-research brief is therefore cited.

### 16.2 Related user stories

| Epic / Story | One-line intent | Key acceptance criteria |
|---|---|---|
| Epic 5, Story 5.7 — Platform Admin's audited, narrowly-scoped RLS bypass | As a platform operator provisioning or suspending a tenant, I want my actions to run through a database role that can see the tenant registry but nothing else, with every write durably logged, so that platform administration never becomes an unaudited path to tenant data. | 1. `platform_admin_role` has `BYPASSRLS` and only `SELECT`/`INSERT`/`UPDATE` on `tenants` and its own identity table. 2. Every write is durably logged. 3. Tenant-Admin actions do not use `platform_admin_role`. |
| Epic 5, Story 5.8 — `tenants` table with its own RLS policy | As a Tenant-Admin, I want to see my own tenant's name, status, and seat counts through the same tenant-scoped session I already use, so that viewing my own tenant's settings needs no special-case authorization. | 1. `tenants` has an RLS policy scoped by `id`. 2. A tenant-scoped session sees exactly one row. 3. `platform_admin_role` can create and update `status`/`license_seat_count`. |
| Epic 5, Story 5.9 — `users` table, RLS, and request-time identity resolution | As an authenticated caller, I want my Entra identity resolved to my SocialEngage tenant, role, and status before any tenant-scoped query runs, so that every subsequent request is correctly and automatically scoped to my own tenant. | 1. `users` has an RLS policy. 2. A read-only bypass role resolves `sub` to `(tenant_id, user_id, role)`. 3. Unmatched `sub` is rejected. 4. Platform Admin is not a `users` row. |
| Epic 5, Story 5.10 — Retire `X-Tenant-Id` as a trust mechanism | As a platform operator responsible for security posture, I want every `/v1` endpoint to derive tenant identity exclusively from a validated bearer token, so that the `X-Tenant-Id` spoofing vector is closed. | 1. No route reads `X-Tenant-Id` as a trust source. 2. A mismatched `X-Tenant-Id` header does not affect behavior. |
| Epic 7, Story 6.6 — Platform Admin console | As Platform Admin, I want a console to provision/suspend tenants, adjust license seats, execute a break-glass Tenant-Admin credential reset, and review the audit log, so that I can operate the platform without hand-writing SQL while the zero-tenant-data-access boundary stays enforced. | 1. Tenant list and provisioning forms call real core endpoints. 2. Two-phase break-glass flow is implemented. 3. Audit log is read-only. 4. No screen renders tenant-content data. |

### 16.3 Supporting designs

- `docs/design/platform-admin-console-mockup-2026-08-03.html` — covers tenant list, provisioning, break-glass confirmation flow, and audit log. Illustrative layout only; the exact two-phase workflow and `access_ends_at` model must be reconciled against ADR-0030/0032 before implementation.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | — | | |
