# BRD-0041: Platform Admin is a Distinct Identity Kind, Not a Role Value

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Platform Admin Identity Distinctness – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-06 |
| Author(s) | AI Business & Requirements Analyst, per Menno's request |
| Approver(s) | Menno, Sponsor |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-06 | AI Business & Requirements Analyst | Initial BRD derived from accepted ADR-0041 and Feature Design 12 (Multi-user Workspaces and RBAC) |

---

## 2. Executive Summary

**What problem are we solving?** Platform Admin and Tenant-Admin have been treated as two values of the same role field in mental models and in code, even though the project's data model already makes them structurally different kinds of identity. This confusion directly caused a routing bug in which a Platform Admin session was silently handled as a tenant identity because the consuming code assumed every resolved identity had a `.role` field.

**Who is affected?** Any current or future contributor who writes or reviews code that consumes resolved identities in `social-listening-core` or `social-listening-admin`, plus the project's Platform-Admin, Tenant-Admin, and Tenant-User personas whose access boundaries depend on the distinction being preserved.

**What is the proposed solution at a glance?** Elevate the existing practice of structural distinctness to a formal, project-wide, cross-layer business rule: Platform Admin is a distinct *kind* of identity, never a value inside the tenant-user role enumeration; every consumer of a resolved identity must first narrow on the identity's `type` discriminant and handle both variants exhaustively.

**What business value do we expect?** A citable rule that prevents the same category error from recurring, protects the platform/tenant data boundary, and eliminates the need for future authors to reconstruct the distinction from four separately-scoped ADRs each time they touch identity-handling code.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the design-level gap that allowed a Platform Admin to be treated as a tenant identity | No new identity-consuming code defaults or optionally-chains a `tenant_user`-only field without first narrowing on `type` |
| 2 | Make the Platform Admin / Tenant-Admin distinction a citable, project-wide business rule | All future identity-handling changes can be reviewed against ADR-0041 and this BRD |
| 3 | Preserve the platform/tenant access boundary at every layer | Platform Admin sessions never render or authorize as tenant sessions, and vice versa |
| 4 | Keep governance cost low by documenting the rule without changing accepted prior ADRs | ADR-0030, ADR-0032, ADR-0035, and ADR-0036 each receive a "Note on relation to ADR-0041" and remain otherwise unchanged |

---

## 4. Scope

### 4.1 In Scope

- Formalizing Platform Admin as a distinct identity *kind*, separate from the tenant-user role field.
- Requiring type-narrowed, exhaustive handling of resolved identities in all code, present and future, in either repository.
- Annotating ADR-0030, ADR-0032, ADR-0035, and ADR-0036 with a dated "Note on relation to ADR-0041" confirming they already satisfy this rule.
- Naming and tracking two small follow-up actions: removal of the unused `AdminRole` flat-enum type and a decision on mechanical enforcement.

### 4.2 Out of Scope

- Changing the database schema, Postgres role grants, or `ResolvedIdentity` shape (already implemented).
- Removing the unused `AdminRole` type within this BRD or ADR.
- Implementing a lint rule, type-level exhaustiveness check, or other mechanical enforcement.
- Creating a user story; ADR-0041 is a no-story, category-1 ADR.

### 4.3 Assumptions

- The `ResolvedIdentity` discriminated union in `social-listening-core` already correctly models the two identity kinds.
- The four related ADRs (ADR-0030, ADR-0032, ADR-0035, ADR-0036) are Accepted and will not be edited in place.
- Code review is the primary enforcement mechanism until a mechanical check is added.

### 4.4 Constraints

- The BRD and ADR are documentation-only; no build work or contract changes may result directly from ADR-0041.
- The rule must be stated in business terms while still giving technical contributors a clear, actionable standard.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor, Product Owner, Technical Lead | High | A single, durable rule that prevents the Platform Admin / Tenant-Admin confusion from recurring |
| Platform-Admin (persona) | Operates the platform without accessing tenant data | High | Clear assurance that platform sessions cannot be mistaken for tenant sessions |
| Tenant-Admin (persona) | Manages a single tenant's users, connectors, and settings | Medium | Confidence that the platform operator cannot be accidentally treated as a tenant user or admin |
| Tenant-User (persona) | Works within one tenant's scope | Low | Uninterrupted access, with no leaked platform-level privileges |
| AI Delivery Agent / future contributors | Writes and reviews identity-handling code | High | A citable, explicit standard to check new code against |

---

## 6. Current State (As-Is)

**Current process:**
1. A caller authenticates through Entra External ID.
2. `resolveIdentity()` returns a discriminated union: either a `tenant_user` carrying `role`, `tenantId`, and `userId`, or a `platform_admin` carrying `adminId` only.
3. Four prior ADRs already make Platform Admin structurally distinct at the database, table, route-tree, and UX-gating layers.
4. The `social-listening-admin` role-routing shell and its skill file already fix the concrete bug by narrowing on the identity's `type` before using `role`.

**Pain points:**
- No project-wide rule previously stated that the identity's own *type* is the source of truth at every layer.
- A real bug occurred because one component blind-cast the identity and branched on `.role`, which is undefined for Platform Admin.
- An unused `AdminRole = 'tenant_admin' | 'tenant_user' | 'platform_admin'` type still exists in `social-listening-admin/src/lib/role-routing.ts`, re-encoding the wrong model.
- Future authors would otherwise have to re-derive the distinction from four separately-scoped ADRs.

---

## 7. Future State (To-Be)

**New or improved process:**
1. ADR-0041 is accepted as the durable, project-wide rule that Platform Admin is a distinct identity *kind*.
2. Every consumer of `ResolvedIdentity` (or any future equivalent) first checks `type` before reading `role`, `tenantId`, or `userId`.
3. Every branch on identity kind has explicit `tenant_user` and `platform_admin` cases, with no silent fallthrough to a tenant assumption.
4. No new single-shape role-flattened type is introduced; the existing `AdminRole` dead code is removed as a separate follow-up.
5. ADR-0030, ADR-0032, ADR-0035, and ADR-0036 carry dated "Note on relation to ADR-0041" annotations.

**Expected capabilities:**
- A citable standard for all future identity-handling code.
- A clear statement that asking "what is a Platform Admin's role?" is a category error.
- Preservation of the platform/tenant boundary without new schema or endpoint work.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Platform Admin must be modeled and treated as a distinct identity *kind*, never as a value within the tenant-user role field | Must | Prose and type definitions state Platform Admin and Tenant-Admin as two different kinds; no new code treats `platform_admin` as a role value | Product Owner |
| BR-002 | All code that consumes a resolved identity must narrow on the identity's `type` discriminant before reading any type-specific field | Must | Review of new identity-consuming code shows `type` is checked before `role`, `tenantId`, or `userId` is accessed | Technical Lead |
| BR-003 | Identity branches must be exhaustive, with explicit cases for `platform_admin` and `tenant_user` and no silent, privilege-assuming fallthrough | Must | No default/else branch treats an un-narrowed or unrecognized identity as a tenant user; where the language supports it, an exhaustiveness check is recommended | Technical Lead |
| BR-004 | Identity types must not be re-flattened into a single shape for convenience (e.g., one flat role enum containing `platform_admin`) | Must | No new flat role enum is introduced; existing unused `AdminRole` type is flagged for removal | Technical Lead |
| BR-005 | The four related ADRs must carry a dated note confirming their relationship to and satisfaction of ADR-0041 | Must | ADR-0030, ADR-0032, ADR-0035, and ADR-0036 each contain a "Note on relation to ADR-0041" | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The identity-distinctness rule must be documented as a durable, citable project standard | Maintainability | Must | ADR-0041 and this BRD are the authoritative references; no contributor must re-derive the rule |
| NFR-002 | The platform/tenant access boundary must be preserved at every layer | Security | Must | No resolved-identity consumer can access tenant-content tables or UI routes when it represents a Platform Admin, and vice versa |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The `role` field (`'tenant_admin'` or `'tenant_user'`) is a property that exists only on a `tenant_user`-kind identity. |
| BRU-002 | It is a category error to ask "what is a Platform Admin's role?" or to default a missing `role` to any tenant value. |
| BRU-003 | Any code that reads a `tenant_user`-only field must first narrow the identity on its `type` discriminant. |
| BRU-004 | Flat role enumerations that include `platform_admin` alongside tenant roles are not permitted, including in unused or dead code. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ResolvedIdentity` (discriminated union) | The runtime representation of the caller's identity; `tenant_user` carries `role`, `tenantId`, `userId`; `platform_admin` carries `adminId` only | `social-listening-core/src/identity/identityResolution.ts` | Technical Lead | High — controls all access decisions |
| `platform_admin_role` (Postgres role) | Dedicated database role with `BYPASSRLS`, locked to `tenants` and its own identity table only | ADR-0030 | Technical Lead | High — platform-level privilege |
| `platform_admins` table | Separate table for Platform Admin identities, with no `tenant_id` column and no `tenant_isolation` policy | ADR-0032 | Technical Lead | High — platform identity data |
| `users` table | Tenant-scoped user records carrying `role` (`tenant_admin` / `tenant_user`) | ADR-0032 | Technical Lead | High — tenant identity data |
| `platform_admin_audit_log` | Audit trail for privileged Platform Admin actions | Feature Design 12 | Technical Lead | High — compliance and accountability |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| New identity-consuming code review coverage | Track whether new code is checked against ADR-0041 / BRD-0041 before merge | Technical Lead, Sponsor | Per change |
| Residual `AdminRole` / flat-enum instances | Confirm the named dead-code follow-up is removed and no new flattened types are introduced | Technical Lead | Per release |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The rule is documented but not mechanically enforced, so a future violation could pass review undetected | Medium | High | Plan a follow-up to evaluate and add a lint rule, type-level exhaustiveness check, or contract-test convention; until then, enforce through code review | Technical Lead |
| R-002 | The unused `AdminRole` flat-enum type in `social-listening-admin/src/lib/role-routing.ts` remains as a live counter-example | Low | Medium | Create a separate code-cleanup item to remove the dead type; do not treat it as part of this ADR/BRD | AI Delivery Agent |
| R-003 | A future contributor re-introduces the "Platform Admin is a role value" mental model in a new component | Medium | High | Reference ADR-0041 in component skill files, code comments, and PR templates; require identity review for any new route or API surface | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0030 (Platform Admin database role and grants) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-002 | ADR-0032 (separate `platform_admins` table) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-003 | ADR-0035 (admin UI as one role-gated app) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-004 | ADR-0036 (UI role-gating is a layered convenience, not the security boundary) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-005 | Shipped `ResolvedIdentity` discriminated-union implementation in `social-listening-core` | Internal / already built | Technical Lead | Already in place |
| D-006 | `social-listening-admin/src/lib/role-routing.ts` and its `SKILL.md` | Internal / already built | Technical Lead | Already in place; named for cleanup of unused `AdminRole` |

---

## 14. Acceptance Criteria

- ADR-0041 is accepted and this BRD is approved by Menno.
- A "Note on relation to ADR-0041" is appended to ADR-0030, ADR-0032, ADR-0035, and ADR-0036.
- No user story is created for ADR-0041 (it remains a no-story, category-1 ADR).
- The rule is stated clearly enough that any new identity-consuming code can be checked against it.
- The unused `AdminRole` type is flagged for removal as a separate follow-up, not as part of this BRD.
- A decision on mechanical enforcement (lint / type check / contract test) is tracked as a future, separately-scoped follow-up.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Platform Admin | An operator of the platform, modeled in its own table and Postgres role, with no tenant scope. |
| Tenant-Admin | A user within a tenant who can manage tenant users, connectors, watchlists, and settings. |
| Tenant User | A standard user within a tenant, constrained by RLS and carrying a `role` field. |
| ResolvedIdentity | The runtime discriminated-union representation of the authenticated caller; either `tenant_user` or `platform_admin`. |
| Discriminated Union | A type that carries a tag (`type`) identifying which variant is present; consumers must narrow on the tag before accessing variant-specific fields. |
| RLS (Row-Level Security) | Postgres mechanism that filters rows per tenant using a tenant-scoped policy. |
| BYPASSRLS | A Postgres privilege that bypasses row-level security, reserved for the dedicated `platform_admin_role`. |
| Role Enum (tenant) | The `role` field values `'tenant_admin'` and `'tenant_user'`, which apply only to `tenant_user`-kind identities. |

---

## 16. Appendices

### Reference Documents

- **ADR-0041:** `docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md` — the accepted architecture decision from which this BRD is derived.
- **Feature Design 12:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` — the related high-level feature design for workspaces and role-based access.
- **Implementation Log (healing pass):** `docs/implementation-log.md` — the 2026-08-06 entry describing the concrete bug and fix that motivated ADR-0041.
- **Skill file:** `social-listening-admin/.claude/skills/role-routing-shell/SKILL.md` — the component-level guidance that now warns against the wrong mental model.
- **Epic 7 boundary note:** `docs/user-stories/epic-7-platform-admin-ui.md` — restates the Platform Admin / tenant-content boundary and references ADR-0041.

### Missing / Not Applicable Sources

- No deep-research brief was found for the identity/RBAC feature (`docs/product-research/reports/<feature>-deep-research.md` does not exist for this topic).
- No user stories were created for ADR-0041 itself (no-story ADR, category 1 per `docs/user-stories/README.md`).

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-06 |
| Product Owner | Menno | | 2026-08-06 |
| Technical Lead | Menno | | 2026-08-06 |
| Other Stakeholder | — | | |
