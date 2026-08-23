# Business Requirements Document — ADR-0032: `users` Table Shape, RLS, and the Request-Time Identity-Resolution Path

## 1. Document Control

|| Field | Value |
|---|---|---|
|| Document Title | SocialEngage `users` Table Shape, RLS, and Request-Time Identity Resolution — Business Requirements Document |
|| Version | 1.0 |
|| Date | 2026-08-19 |
|| Author(s) | AI Business & Requirements Analyst |
|| Approver(s) | Menno |
|| Status | Approved |

### Revision History

|| Version | Date | Author | Description of Changes |
|---|---|---|---|---|
|| 0.1 | 2026-08-19 | AI Business & Requirements Analyst | Initial draft from ADR-0032, related ADRs, feature design, and user stories |
|| 1.0 | 2026-08-19 | Menno | Accepted as BRD-0032 |

---

## 2. Executive Summary

SocialEngage currently has no `users` table and no authenticated identity that maps a caller to a tenant, role, and lifecycle state. `Stakeholder-Register.md` S-08 explicitly flags this as a missing foundation: before any Platform Admin, Tenant-Admin, Tenant Reader, or Tenant Business Analyst persona can use the system, there must be a concrete, tenant-scoped user record that every request can resolve to. ADR-0032 closes that gap by defining the `users` table shape, its Row-Level Security (RLS) boundary, a narrow request-time identity-resolution path, and the invitation/activation/offboarding lifecycle.

This BRD records the business need to replace the legacy `X-Tenant-Id` trust mechanism with a real bearer-token-to-user resolution chain. The result is a `users` table that is a genuine foreign-key target for tenant content and user-bound credentials, a separate Platform Admin identity table that never touches tenant data, and a dedicated read-only `identity_resolver_role` that bootstraps each request without ever writing data or bypassing tenant isolation for routine queries.

The expected business value is a trustworthy multi-tenant identity foundation: validated tenant membership, least-privilege access, auditable lifecycle changes, and a clean path from Entra sign-in to the correct SocialEngage role and data scope.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
|---|---|---|---|
|| 1 | Create a real, tenant-scoped `users` table as the canonical identity record | Every authenticated caller resolves to one and only one `users` or `platform_admins` row |
|| 2 | Enforce tenant isolation for user records using the same RLS pattern as all other tenant-scoped tables | A caller can only see, invite, or modify users within their own tenant |
|| 3 | Replace client-supplied tenant claims with validated token-based identity resolution | No `/v1` route trusts `X-Tenant-Id` for authorization (backed by ADR-0033) |
|| 4 | Support the full user lifecycle: invite, link, active, scheduled/offboarded, and reactivated | Tenant-Admin can manage membership without engineering help; reactivation works by clearing the end-of-access timestamp |
|| 5 | Keep Platform Admin outside the `users` table | Platform Admin has its own table and cannot access tenant content through the `users` RLS path |
|| 6 | Minimize the blast radius of identity-resolution privileges | `identity_resolver_role` has only `SELECT` on the minimum columns needed, and no write access at all |

---

## 4. Scope

### 4.1 In Scope

- The `users` table columns, defaults, constraints, and value sets defined in ADR-0032 §1.
- A tenant-scoped RLS policy on `users` identical in shape to every other tenant-scoped table.
- A dedicated, `SELECT`-only `identity_resolver_role` that resolves a bearer token's `sub` claim to `(tenant_id, user_id, role, status, external_subject)` at the start of each request.
- The invite/link flow: a Tenant-Admin creates an `invited` user; first successful Entra sign-in with a matching email links the `external_subject` and transitions the user to `active`.
- The `access_ends_at` lifecycle mechanism: a nullable timestamp that replaces any `'suspended'` status value, where `NULL` means active indefinitely, a past/present timestamp means access has ended, and a future timestamp means scheduled expiration.
- The active/ended check: a user is active only when `status = 'active'` and `access_ends_at` is either `NULL` or in the future.
- Profile-field ownership in the `users` table (`display_name`), filled by the Tenant-Admin or the user, never synced from Entra.
- The `users.id` column as the future foreign-key target for user-bound credentials and other per-user records.
- A separate `platform_admins` table with no `tenant_id` and no tenant-isolation policy.

### 4.2 Out of Scope

- A `'suspended'` value in `status` — removed in favor of `access_ends_at`.
- Separate `role` values for Tenant Reader and Tenant Business Analyst in v1; both map to `tenant_user`.
- A separate user-role join table or multi-role support for a single user.
- The exact audit-log schema for `access_ends_at` writes (inherits the unresolved audit mechanism from ADR-0030/ADR-0031; `access_ends_at` changes are named as requiring audit, but the mechanism is not designed here).
- Resolution of the seat-count race condition inherited from ADR-0031 §3.
- The `platform_credentials.user_id` column and ownership-tier logic (candidate ADR #6; only the target `users.id` is named here).
- Capturing which token/claims version issued the `external_subject` value.

### 4.3 Assumptions

- ADR-0029 (Entra External ID as authentication mechanism) is accepted and provides a validated `sub` and `email` claim.
- ADR-0030 (Platform Admin tier and break-glass) is accepted, providing the `platform_admin_role` and a separate Platform Admin identity table.
- ADR-0031 (`tenants` table shape) is accepted, giving the `tenant_id` referent.
- ADR-0015 (Postgres RLS for tenant isolation) and ADR-0016 (Postgres as the database engine) remain in place.
- ADR-0033 (retire `X-Tenant-Id` as a trust mechanism) is accepted, making token-based resolution the only tenant boundary.

### 4.4 Constraints

- Minimal database machinery: no ORM, no triggers beyond existing `updated_at` conventions, no stored-procedure seat enforcement; schema changes are SQL migrations.
- `identity_resolver_role` must be narrower than `platform_admin_role`; a compromise of one must not imply a compromise of the other.
- `platform_admin_role` must never read or write tenant-content tables through the `users` table path.
- A user's internal `id` must remain decoupled from the Entra `sub` claim to protect against future IdP changes.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|---|
|| Tenant-Admin | Day-to-day administrator of one tenant | High | Invite, list, and offboard users; respect the license-seat ceiling; reactivate users cleanly |
|| Tenant User | End user within a tenant | High | Sign in, see only their own tenant's data, trust that their role is correct |
|| Platform Admin | Platform operator | High | Operate the platform without any implicit access to tenant users or content |
|| Security / Compliance | Risk and audit | High | Least-privilege roles, fail-closed RLS, auditable access lifecycle changes |
|| Engineering | Backend implementation | High | A clear schema and resolution contract to build against |
|| New Invited User | Person without an account yet | Medium | Be invited by email and link to SocialEngage on first sign-in without manual provisioning |

---

## 6. Current State (As-Is)

`Stakeholder-Register.md` S-08 states that "no code, table, or authenticated identity exists yet" for the Platform Admin, Tenant-Admin, Tenant Reader, or Tenant Business Analyst personas. In the current implementation:

- There is no `users` table anywhere in the project.
- Tenant isolation has been built using an `X-Tenant-Id` header that the caller supplies, which is a spoofing risk.
- There is no mapping between a validated Entra token and a SocialEngage tenant, role, or user record.
- No concept of an invited, active, suspended, or reactivated user exists.
- There is no foundation for user-bound credentials, per-user watchlists, or per-user RBAC.

**Pain points:**
- Authentication (Entra) is separated from authorization (tenant/role membership), so a valid token does not yet determine what a caller can access.
- Every table that will hold user-owned data needs a real `user_id` foreign key target.
- Platform Admin, Tenant-Admin, and tenant user are indistinguishable in the data model.
- The `X-Tenant-Id` header cannot be trusted for production authorization.

---

## 7. Future State (To-Be)

A `users` table becomes the canonical, tenant-scoped record of every tenant member. Each authenticated request begins by resolving the Entra `sub` claim through a narrowly scoped, read-only bypass role to discover the caller's `(tenant_id, user_id, role, status, external_subject)`. Once resolved, all subsequent queries run through the ordinary tenant-scoped `withTenant()` path. A separate `platform_admins` table serves the Platform Admin persona; it is structurally outside the tenant isolation model.

**Expected capabilities:**
- A Tenant-Admin can invite users by email; the seat is consumed only when the invited user first links their identity at sign-in.
- A Tenant-Admin can end or schedule the end of a user's access by setting `access_ends_at`, and can reactivate a user by clearing it.
- Every caller is resolved to a role (`tenant_admin` or `tenant_user` for v1) before any business logic runs.
- A caller whose `sub` matches no record is rejected, even if the Entra token is valid.
- Profile data is owned by SocialEngage, not mirrored from Entra.
- Future user-bound credentials and per-user records can reference a stable, SocialEngage-generated `users.id`.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|---|
|| BR-001 | The system shall provide a `users` table that stores every tenant member with a SocialEngage-generated primary key, a linked tenant, a resolvable email, a display name, a role, a lifecycle status, and invitation/activation/expiration timestamps | Must | Table exists with columns, defaults, and value sets matching ADR-0032 §1; primary key is decoupled from Entra `sub` | Product Owner |
|| BR-002 | The system shall enforce the same tenant-scoped RLS policy on `users` as on every other tenant-scoped table | Must | A caller sees only users whose `tenant_id` matches their resolved tenant; cross-tenant reads/writes are blocked | Product Owner |
|| BR-003 | The system shall resolve a caller's identity at the start of each request using a dedicated `identity_resolver_role` that can only read the minimum columns needed | Must | `identity_resolver_role` is granted `SELECT` only on `users(id, tenant_id, role, status, external_subject)` and the equivalent minimal columns of `platform_admins`; it has no write grants and is distinct from `platform_admin_role` | Product Owner |
|| BR-004 | The system shall reject any authenticated caller whose token `sub` matches neither a `users` row nor a `platform_admins` row | Must | Requests with unmatched but valid Entra tokens receive `401`/`403` before any tenant-scoped work occurs | Product Owner |
|| BR-005 | The system shall support an invite/link flow in which a Tenant-Admin creates an `invited` user by email and the row is linked to the caller's Entra `sub` on the first matching sign-in | Must | Invited rows have `external_subject = NULL`; on first successful Entra sign-in with matching email, `external_subject` is populated and `status` becomes `active` | Product Owner |
|| BR-006 | The system shall maintain a `platform_admins` identity table that is entirely separate from `users` | Must | `platform_admins` has no `tenant_id` and no tenant-isolation policy; ordinary tenant-scoped sessions see zero rows from it | Product Owner |
|| BR-007 | The system shall treat a user as currently active only when `status = 'active'` and `access_ends_at` is `NULL` or in the future | Must | A user with a past `access_ends_at` is treated as not active; a user with a future `access_ends_at` remains active until that time | Product Owner |
|| BR-008 | The system shall allow a Tenant-Admin to set, clear, or update a user's `access_ends_at` and reflect the change in the tenant's active seat count | Must | Setting a now-or-past timestamp offboards the user and decrements the active seat count; setting a future timestamp schedules offboarding; clearing the timestamp reactivates the user subject to the license ceiling | Product Owner |
|| BR-009 | The system shall own the user's display name and future profile fields inside the `users` table, not sync them from Entra | Must | `display_name` is read from and written to the `users` table; no business logic derives it from Entra claims | Product Owner |
|| BR-010 | The system shall expose the `users.id` value as the stable foreign-key target for future user-bound records (e.g., credentials, watchlists) | Should | `users.id` is referenced by a single, documented candidate future feature | Product Owner |

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|---|
|| NFR-001 | Identity resolution must be read-only and use the narrowest possible database privileges | Security | Must | A repository-wide check confirms `identity_resolver_role` has no `INSERT`/`UPDATE`/`DELETE` grants and is used only before the ordinary `withTenant()` call |
|| NFR-002 | The `users` RLS policy must be fail-closed | Security | Must | A session without `app.tenant_id` set returns zero rows; a tenant-scoped session returns only that tenant's rows |
|| NFR-003 | User activation must respect the tenant's license seat ceiling | Compliance | Must | A new activation is rejected when `active_seat_count >= license_seat_count` |
|| NFR-004 | All schema changes must be delivered as SQL migrations | Maintainability | Must | The `users` and `platform_admins` tables, RLS policies, and role grants exist in numbered migration files |
|| NFR-005 | `access_ends_at` lifecycle writes must be auditable | Compliance | Should | Every change to `access_ends_at` is recorded with actor, timestamp, and before/after value, flowing into the project-wide audit mechanism once it is decided |

Priority levels: Must / Should / Could / Won't (MoSCoW)

---

## 9. Business Rules

|| ID | Rule |
|---|---|
|| BRU-001 | Every `users` row belongs to exactly one tenant (`tenant_id` is not null and references `tenants.id`). |
|| BRU-002 | Platform Admin is never a row in the `users` table. |
|| BRU-003 | The `role` column accepts only `tenant_admin` and `tenant_user` in v1; Tenant Reader and Tenant Business Analyst are not separate roles. |
|| BRU-004 | The `status` column accepts only `invited` and `active`; there is no `'suspended'` value. |
|| BRU-005 | A user is currently active only if `status = 'active'` and `access_ends_at` is `NULL` or `access_ends_at > now()`. |
|| BRU-006 | Clearing `access_ends_at` back to `NULL` reactivates the account as of that action. |
|| BRU-007 | Every write to `access_ends_at` (setting, updating, or clearing) is an auditable event. |
|| BRU-008 | A user may hold only one role at a time in v1. |
|| BRU-009 | A user's internal `id` is generated by SocialEngage and is not the same as the Entra `sub` claim. |
|| BRU-010 | A valid Entra sign-in by itself does not grant SocialEngage access; the caller must also match a `users` or `platform_admins` row. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|---|
|| `users.id` | SocialEngage-generated primary key for a tenant member | SocialEngage | Engineering | Internal identifier |
|| `users.tenant_id` | Tenant to which the user belongs | `tenants.id` | Engineering | Internal reference |
|| `users.external_subject` | Entra `sub` claim; `NULL` until first sign-in links an invited row | Entra token | Engineering | Identity correlation |
|| `users.email` | Contact email used for invitations and sign-in matching | Request body at invite; Entra token at link | Product / Tenant-Admin | Personal data |
|| `users.display_name` | Human-readable name set by Tenant-Admin or the user | SocialEngage | Product / User | Personal data |
|| `users.role` | `tenant_admin` or `tenant_user` | SocialEngage / invitation | Product | Authorization |
|| `users.status` | `invited` or `active` | Lifecycle events | Product | Authorization |
|| `users.invited_at` | Timestamp when the user was invited | SocialEngage | Engineering | Operational |
|| `users.activated_at` | Timestamp when the user first linked their identity | Entra sign-in event | Engineering | Operational |
|| `users.access_ends_at` | Nullable timestamp ending or scheduling the end of access | Tenant-Admin action | Product | Authorization / Audit |
|| `platform_admins.id` | Primary key for the Platform Admin identity table | SocialEngage | Engineering | Internal identifier |
|| `platform_admins.external_subject` | Entra `sub` claim for Platform Admin | Entra token | Engineering | Identity correlation |
|| `platform_admins.email` | Platform Admin contact email | SocialEngage | Platform Admin | Personal data |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
|| Active vs. invited user counts by tenant | Track adoption and license consumption | Tenant-Admin / Platform Admin | Real-time in admin UI |
|| Seat usage vs. license ceiling | Prevent over-invitation and support license planning | Tenant-Admin / Platform Admin | Real-time in admin UI |
|| `access_ends_at` change history | Audit who ended or reactivated a user's access | Tenant-Admin / Compliance | On demand |
|| Identity resolution failures | Detect unmatched sign-ins and misconfigured Entra flows | Platform Admin / Security | Daily |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
|| R-001 | A fourth Postgres role (`identity_resolver_role`) adds operational provisioning and scoping complexity | Medium | Low | Document the role's narrow grants; verify by repository test that it cannot write or read beyond its columns | Engineering |
|| R-002 | The seat-count race condition inherited from ADR-0031 could allow over-allocation under concurrent activations | Medium | High | Implement seat checks inside the same transaction that updates `status`; accept residual concurrency risk until a dedicated follow-up ADR resolves it | Engineering |
|| R-003 | Future need to split Tenant Reader and Tenant Business Analyst will require a schema migration | Low | Medium | Accept the v1 trade-off; document the deferred decision explicitly as an Open Question | Product Owner |
|| R-004 | A compromised `identity_resolver_role` could leak a limited identity map | Low | High | Scope the role to a five-column `SELECT` only, with no write access, and keep it separate from `platform_admin_role` | Security |
|| R-005 | Keeping Platform Admin in a separate table may require extra maintenance compared to a nullable `tenant_id` | Low | Low | Accept the cleaner separation; the separate table is small and intentional per ADR-0041 | Engineering |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|---|
|| D-001 | ADR-0029: Authentication mechanism (Entra External ID) | Decision / Architecture | Product Owner | Accepted |
|| D-002 | ADR-0030: Platform Admin tier and break-glass design | Decision / Architecture | Product Owner | Accepted |
|| D-003 | ADR-0031: `tenants` table shape and RLS | Decision / Architecture | Product Owner | Accepted |
|| D-004 | ADR-0033: Retire `X-Tenant-Id` as a trust mechanism | Decision / Architecture | Product Owner | Accepted |
|| D-005 | Story 5.9 — `users` table, RLS, and request-time identity resolution | Implementation | Engineering | Ready |
|| D-006 | Story 1.9 — User invitation and offboarding REST surface | Implementation | Engineering | Ready |
|| D-007 | Story 5.17 — Audit trail for `access_ends_at` writes | Implementation | Engineering | Ready |
|| D-008 | Story 6.8 — Tenant-Admin user invitation and management screen | UI | Product / Engineering | Built |
|| D-009 | Story 6.14 — Access-history view | UI | Product / Engineering | Built |
|| D-010 | `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` | Feature context | Product | Already available |

---

## 14. Acceptance Criteria

- The `users` table exists with the columns, constraints, and default values described in ADR-0032 §1, and `users.id` is generated independently of the Entra `sub` claim.
- The `users` RLS policy matches the ADR-0015 fail-closed pattern and allows a tenant-scoped session to see and modify only its own tenant's rows.
- `identity_resolver_role` is a dedicated, `SELECT`-only role with grants limited to the specific columns needed to resolve identity, and it is distinct from `platform_admin_role`.
- A request whose `sub` matches no `users` and no `platform_admins` row is rejected with `401`/`403` before any tenant-scoped work.
- The invite/link flow works: an `invited` row with `external_subject = NULL` is linked and activated at first successful Entra sign-in with a matching email.
- The active/ended check behaves correctly: past `access_ends_at` = not active; future `access_ends_at` = active until that time; `NULL` = active indefinitely.
- Setting or clearing `access_ends_at` updates `active_seat_count` correctly and respects the license seat ceiling.
- Platform Admin is resolved from a separate `platform_admins` table that has no `tenant_id` and no tenant-isolation policy.
- `display_name` is read from and written to the `users` table, not derived from Entra.

---

## 15. Glossary

|| Term | Definition |
|---|---|
|| `access_ends_at` | A nullable timestamp on a `users` row that marks when a user's access ends or is scheduled to end; `NULL` means active indefinitely. |
|| Entra `sub` | The subject claim from an Entra External ID token that uniquely identifies a signed-in identity. |
|| `external_subject` | The column on `users` and `platform_admins` that stores the linked Entra `sub` value. |
|| `identity_resolver_role` | A dedicated Postgres role with `BYPASSRLS` and `SELECT`-only grants used once per request to resolve the caller's identity. |
|| Platform Admin | The platform operator persona, modeled in its own `platform_admins` table, outside the `users` table. |
|| RLS | Row-Level Security, the Postgres feature used to enforce tenant isolation at the database layer. |
|| `tenant_admin` | The tenant administrator role, allowed to invite users and manage tenant membership. |
|| `tenant_user` | The ordinary tenant member role in v1, replacing the deferred Tenant Reader / Tenant Business Analyst split. |
|| `users.id` | The SocialEngage-generated primary key for a tenant member, used as a stable foreign-key target. |

---

## 16. Appendices

- **Source ADR:** `docs/adr/0032-users-table-shape-and-rls.md`
- **Related ADRs:**
  - `docs/adr/0029-authentication-mechanism-entra-external-id.md`
  - `docs/adr/0030-admin-tier-design-platform-admin-rls-exception.md`
  - `docs/adr/0031-tenants-table-shape.md`
  - `docs/adr/0033-retire-x-tenant-id-as-trust-mechanism.md`
- **Feature design:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- **Deep-research brief:** No matching `docs/product-research/reports/<feature>-deep-research.md` was found for this feature; explicitly noted as missing.
- **Related user stories:**
  - `docs/user-stories/epic-5-security-isolation-and-messaging.md` — Story 5.9: `users` table, RLS, and request-time identity resolution
  - `docs/user-stories/epic-1-repository-and-api-foundation.md` — Story 1.9: User invitation and offboarding REST surface
  - `docs/user-stories/epic-5-security-isolation-and-messaging.md` — Story 5.17: Audit trail for `access_ends_at` writes
  - `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.8: Tenant-Admin user invitation and management screen
  - `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.14: Access-history view

---

## 17. Approval

|| Role | Name | Signature | Date |
|---|---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
