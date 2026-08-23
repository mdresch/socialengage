# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0041 Platform Admin Is a Distinct Identity Kind, Not a Role Value — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | AI Delivery Agent (FDD synthesis pass) |
| Reviewer(s) | Menno (Sponsor / Technical Lead) |
| Status | Approved (documents an already-Accepted, no-story ADR) |
| Related Documents | ADR-0041, BRD-0041, ADR-0030, ADR-0032, ADR-0035, ADR-0036, Feature Design 12 (Multi-user Workspaces and RBAC) |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0041's architecture decision and BRD-0041's business requirements into the concrete functional rule that governs any code, in either repository, that consumes a resolved identity. ADR-0041 is **Accepted** (2026-08-06) and is a **no-story, category-1 ADR** — its Decision is already fully satisfied by shipped code (`ResolvedIdentity` in `social-listening-core`, and the type-narrowed `isResolvedIdentity()`/`isShellAllowed()` handling in `social-listening-admin`). This FDD is therefore not a design for new build work; it is the functional specification of a standing rule that every future identity-consuming change must be checked against, and the record of the two small named follow-ups (removing the dead `AdminRole` type; deciding on mechanical enforcement) that remain open.

### 2.2 Scope

- **In scope:** the rule that Platform Admin and Tenant-Admin/Tenant-User are structurally distinct identity *kinds*; the type-narrowing and exhaustive-handling behavior required of any code that consumes a `ResolvedIdentity`; the prohibition on re-flattening identity into a single-shape role enum; the annotation of ADR-0030/0032/0035/0036 with "Note on relation to ADR-0041"; the two named follow-ups (dead-code removal, mechanical enforcement) as tracked, not built, items.
- **Out of scope:** any change to the `ResolvedIdentity` discriminated union's shape, the Postgres schema, role grants, or route-tree structure (all already decided by ADR-0030/0032/0035/0036 and not reopened here); implementing a lint rule or type-level exhaustiveness check (named as an open question only); removing `social-listening-admin/src/lib/role-routing.ts`'s unused `AdminRole` type (named as a follow-up, not performed by this ADR/BRD/FDD).

### 2.3 Target Audience

Any engineer or AI agent (human or automated Delivery Agent) writing or reviewing identity-consuming code in `social-listening-core` or `social-listening-admin`; QA/reviewers checking new routes, endpoints, or UI shells against the platform/tenant boundary; the Documentation Steward auditing cross-ADR consistency.

---

## 3. Context and Background

`social-listening-admin`'s `getRoleShell()` once branched on a resolved identity's `.role` field without first checking the identity's `type` discriminant. Because a real `platform_admin`-kind identity carries no `role` field at all, this silently routed Platform Admin sessions into the tenant-facing UI shell rather than the Platform-Admin-facing one — a real breach of the platform/tenant boundary, not a cosmetic bug. The bug was found and fixed the same day (`social-listening-admin@1f8960e`), but the fix closed only the one call site. Four prior Accepted ADRs (ADR-0030: dedicated `platform_admin_role` Postgres role; ADR-0032 §3: separate `platform_admins` table with no `tenant_id`; ADR-0035: route-tree split on identity type; ADR-0036 §4: UI role-gating as a UX convenience only, not the real security boundary) each already treat Platform Admin as structurally distinct — but only locally, scoped to their own layer. None previously stated, as a general cross-layer principle, that every consumer of a resolved identity — in either repository, at any layer — must preserve that distinctness by construction. ADR-0041 closes that design-level gap at Menno's direct request, following the healing pass that fixed the concrete instance.

A live, present-tense counter-example exists at the time of ADR-0041's acceptance: `social-listening-admin/src/lib/role-routing.ts` still defines an unused `AdminRole = 'tenant_admin' | 'tenant_user' | 'platform_admin'` flat-role type — dead code, but code that re-encodes the exact wrong mental model this ADR argues against.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | State, as a durable project-wide rule, that Platform Admin is a distinct identity kind, never a role value | Rule is written once, in ADR-0041/BRD-0041, and cited rather than re-derived by future identity-handling changes |
| G2 | Ensure every future identity-consuming code path narrows on `type` before reading a type-specific field | No new code reads `role`, `tenantId`, or `userId` off an unnarrowed identity value |
| G3 | Eliminate silent, privilege-assuming fallthrough in identity branching | Every branch on identity kind has an explicit `platform_admin` case and an explicit `tenant_user` case; no default/else treats an unrecognized identity as the lower-privilege tenant case |
| G4 | Prevent re-introduction of a flattened, single-shape identity type | No new flat role enum spanning both identity kinds is introduced anywhere in either repository |
| G5 | Preserve governance hygiene without editing Accepted ADR text | ADR-0030, ADR-0032, ADR-0035, and ADR-0036 each carry a dated "Note on relation to ADR-0041," with their own Decision/Consequences text unchanged |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Identity Kind Discrimination Rule

- **Description:** Establishes that a resolved identity's `type` field (`'tenant_user'` or `'platform_admin'`) is the sole source of truth for what kind of caller is present. `role` is meaningful only on a `tenant_user`-kind identity; asking "what is a Platform Admin's role" is a category error, not an edge case to be handled by defaulting.
- **Triggers:** Any point in either repository where a resolved identity value (produced by `resolveIdentity()` or any future equivalent) is consumed — an HTTP handler, a UI route guard, a shell-selection function, a permission check.
- **Inputs:** A `ResolvedIdentity` value: either `{ type: 'tenant_user'; tenantId; userId; role }` or `{ type: 'platform_admin'; adminId }`.
- **Processing:** The consuming code must inspect `type` first. Only after confirming `type === 'tenant_user'` may `role`, `tenantId`, or `userId` be read. No code path may read a `tenant_user`-only field from a value whose `type` has not been checked, whether by direct access, optional chaining, or defaulting to `undefined`/a fallback value.
- **Outputs:** A correctly-typed, correctly-scoped decision (route rendered, query authorized, permission granted/denied) that matches the caller's actual identity kind.
- **Error handling:** An identity value whose `type` is neither recognized variant must be treated as unauthenticated/denied, never coerced into the lower-privilege `tenant_user` case by omission.
- **Edge cases:** A `platform_admin` identity reaching code written only with `tenant_user` assumptions in mind (the exact shape of the healed bug) — the rule requires this to fail closed (denied/misrouted-to-admin-shell-only) rather than silently degrade to tenant-scoped behavior.

### 5.2 Feature / Capability: Exhaustive, Non-Fallthrough Branching

- **Description:** Requires that any code branching on identity kind handle both variants explicitly, with no silent default/else branch that treats an unrecognized or unnarrowed identity as the tenant case.
- **Triggers:** Writing or modifying any conditional, switch, or route-guard logic that behaves differently for `platform_admin` vs. `tenant_user`.
- **Inputs:** The identity's `type` discriminant.
- **Processing:** Each branch must have an explicit case for `'platform_admin'` and an explicit case for `'tenant_user'`. Where the implementation language supports it (TypeScript, in both repositories today), an exhaustiveness check (e.g., a `never`-typed default branch that fails to compile if a new variant is added and unhandled) is the recommended, though not mandated, mechanism.
- **Outputs:** Deterministic, variant-specific behavior for both identity kinds; a compile-time or review-time signal if a new identity variant is ever added without updating all consumers.
- **Error handling:** A branch reached via an untyped or defaulted value must not silently execute the `tenant_user` path; it must be treated as an error/deny condition.
- **Edge cases:** Future addition of a third identity kind (not currently planned) would require every existing exhaustive branch to be revisited — this is the intended behavior of the exhaustiveness discipline, not a defect.

### 5.3 Feature / Capability: Prohibition on Re-Flattened Identity Types

- **Description:** Forbids introducing or retaining any single-shape type that flattens both identity kinds into one role enum (e.g., `{ role: 'tenant_admin' | 'tenant_user' | 'platform_admin' }`), including in unused/dead code.
- **Triggers:** Any new type definition intended to represent "the caller's role" or "the caller's identity" across both kinds.
- **Inputs:** N/A (a static/type-design rule, not a runtime input).
- **Processing:** Code review and any future mechanical check must reject a flattened role type as a violation of this Decision, regardless of whether it is currently referenced elsewhere in the codebase.
- **Outputs:** No such flattened type exists in shipped, reachable code.
- **Error handling:** N/A — this is a preventive rule enforced through review, not a runtime error path.
- **Edge cases:** `social-listening-admin/src/lib/role-routing.ts`'s existing, unused `AdminRole` type is a named, live counter-example at the time of ADR-0041's acceptance — flagged for removal as a separate follow-up (Section 12/13), not fixed by this ADR/BRD/FDD.

### 5.4 Feature / Capability: Cross-ADR Relation Annotation

- **Description:** Records, on each of the four ADRs whose local decisions this rule generalizes, a dated note confirming what they already satisfy and that no change to their own Decision/Consequences text follows.
- **Triggers:** ADR-0041's acceptance by Menno.
- **Inputs:** ADR-0030, ADR-0032, ADR-0035, ADR-0036 (all Accepted).
- **Processing:** Each of the four ADRs receives a dated "Note on relation to ADR-0041" appended after its own existing content — never an edit to its Decision or Consequences sections, per `docs/adr/README.md`'s own governance convention for annotating rather than editing Accepted ADRs.
- **Outputs:** Four annotated ADR files, each now cross-referencing ADR-0041.
- **Error handling:** N/A — a documentation bookkeeping step, not a runtime behavior.
- **Edge cases:** None — this is a one-time governance action tied to ADR-0041's acceptance date.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| AI Delivery Agent / Engineer | Writes or modifies identity-consuming code in either repository |
| Reviewer (human or Ideal Manager persona) | Checks new identity-handling code against this rule before merge |
| Platform Admin (persona) | The identity kind whose distinctness this rule protects |
| Tenant-Admin / Tenant-User (persona) | The other identity kind whose boundary this rule protects from platform-level leakage |
| Documentation Steward | Verifies the four "Note on relation" annotations exist and remain consistent |

### 6.2 User Stories / Use Cases

No user story exists for ADR-0041 — it is a no-story, category-1 ADR per `docs/user-stories/README.md`'s own convention, already fully satisfied by shipped code (`ResolvedIdentity` in `social-listening-core`, Story 5.9; `isResolvedIdentity()`/`isShellAllowed()` in `social-listening-admin`, the 2026-08-06 healing pass under Story 6.2). Epic 7 (Platform Admin UI) restates this rule as a standing boundary note for every future story in that epic:

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| Epic 7 boundary note | Platform Admin UI story author | ...have every screen in Epic 7 inherit the platform/tenant boundary automatically | ...I don't have to re-argue it per story | No post content, post metadata, watchlist definitions, connector credentials, or per-tenant analytics ever appear on a Platform Admin screen, now or in any future Epic 7 story |

### 6.3 Workflow Diagrams / Steps

**Workflow: writing or reviewing new identity-consuming code**

1. A developer (human or AI agent) writes code that receives a `ResolvedIdentity` value — e.g., a new API handler, a new UI route guard, a new permission check.
2. Before reading any field, the code checks `identity.type`.
3. If `type === 'platform_admin'`: only `adminId` may be read; no tenant-scoped field access is permitted; the code must route to/authorize only platform-level behavior.
4. If `type === 'tenant_user'`: `role`, `tenantId`, `userId` may be read; the code proceeds with tenant-scoped behavior, further gated by `role` where relevant.
5. If `type` is neither recognized value (should not occur given the shipped type, but is a defensive requirement): the code denies access / fails closed, never falling through to the `tenant_user` path.
6. At review time, the reviewer checks the diff against this rule: is `type` checked before any type-specific field is touched; are both branches explicit; is no new flattened role type introduced.
7. If the review finds a violation, it is treated as a defect equivalent in class to the original healed bug — blocked before merge, not accepted as a known issue.

**Workflow: ADR annotation (one-time, at ADR-0041 acceptance)**

1. Menno accepts ADR-0041.
2. ADR-0030, ADR-0032, ADR-0035, ADR-0036 each receive a dated "Note on relation to ADR-0041," appended without editing existing Decision/Consequences text.
3. No story is opened; no code changes as a direct result of acceptance.

---

## 7. Data Requirements

### 7.1 Data Inputs

The `ResolvedIdentity` value produced by `resolveIdentity()` (`social-listening-core/src/identity/identityResolution.ts`), itself derived from an authenticated Entra External ID `Authorization: Bearer` token resolved against the `users` and `platform_admins` tables.

### 7.2 Data Outputs

No new stored data is produced by this rule. The output is a correctly-scoped runtime authorization/routing decision made by every consumer of `ResolvedIdentity`.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `ResolvedIdentity` (discriminated union, TypeScript type, not a table) | `type: 'tenant_user' \| 'platform_admin'`; `tenant_user` variant: `tenantId`, `userId`, `role`; `platform_admin` variant: `adminId` | Produced by `resolveIdentity()`; consumed by every route handler, middleware, and UI shell-selection function in both repositories |
| `users` table (ADR-0032) | `tenant_id`, `user_id`, `role` (`'tenant_admin'` \| `'tenant_user'`) | RLS-scoped to one tenant; source of the `tenant_user` variant of `ResolvedIdentity` |
| `platform_admins` table (ADR-0032 §3) | `admin_id`; explicitly no `tenant_id` column, no `tenant_isolation` policy | Source of the `platform_admin` variant of `ResolvedIdentity` |
| `platform_admin_role` (Postgres role, ADR-0030) | Granted `BYPASSRLS`; locked to `tenants` table and `platform_admins`/identity table only | The database-layer mechanism that structurally separates Platform Admin data access, mirrored at the application layer by this ADR's type-discrimination rule |
| `AdminRole` (unused type, `social-listening-admin/src/lib/role-routing.ts`) | `'tenant_admin' \| 'tenant_user' \| 'platform_admin'` (flat enum) | Named counter-example; not referenced anywhere else in the repository; flagged for removal, not part of the data model going forward |

### 7.4 Validation Rules

- A `ResolvedIdentity` value must always carry a `type` discriminant equal to exactly one of the two defined variants.
- A `tenant_user`-only field (`role`, `tenantId`, `userId`) must never be read, defaulted, or optionally-chained against a value whose `type` has not first been confirmed to be `'tenant_user'`.
- No new type definition anywhere in either repository may combine both identity kinds into a single flat shape.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | The `role` field exists only on a `tenant_user`-kind identity; it is a category error to ask what a Platform Admin's role is | Any code reading `ResolvedIdentity` |
| BR2 | Any code reading a `tenant_user`-only field must first narrow the identity on its `type` discriminant | All identity-consuming code, both repositories |
| BR3 | Identity branches must be exhaustive; no default/else branch may treat an unrecognized or unnarrowed identity as the lower-privilege tenant case | All identity-branching logic |
| BR4 | No flat role enumeration spanning both identity kinds is permitted, including in unused/dead code | All type definitions, both repositories |
| BR5 | Accepted ADRs (ADR-0030/0032/0035/0036) are annotated with a relation note, never edited in place, when a later ADR generalizes their local decisions | ADR governance process |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `social-listening-core` (`resolveIdentity()`) | Produces | Resolves an authenticated caller to a `ResolvedIdentity` discriminated union | In-process TypeScript function, consumed via middleware |
| `social-listening-admin` (route-routing shell, `role-routing.ts`) | Consumes | Selects the UI shell (tenant vs. platform) based on `ResolvedIdentity.type` | In-process TypeScript |
| Any future `social-listening-core` endpoint or `social-listening-admin` route | Consumes | Must apply this rule when authorizing or rendering based on identity | In-process TypeScript |
| `docs/adr/README.md` governance convention | Governs | Defines how a generalizing ADR annotates rather than edits prior Accepted ADRs | Documentation process |

---

## 10. Non-Functional Considerations

- **Performance:** No runtime cost beyond an existing discriminant check; no new I/O, query, or network call is introduced.
- **Security / access control:** This is fundamentally a security rule — it exists specifically to prevent a Platform Admin session from being treated as, or granted the access of, a tenant identity, and vice versa. It reinforces, at the application-code layer, the boundary ADR-0030's `BYPASSRLS`-scoped Postgres role and ADR-0032's separate-table schema already enforce at the database layer.
- **Scalability:** N/A — a code-shape rule, not a runtime-scaling concern.
- **Reliability / availability:** Reduces the risk of a repeat of the healed routing bug recurring in a different component.
- **Audit and logging:** Complements the existing `platform_admin_audit_log` (ADR-0030/0032) by ensuring the identity feeding into any audited action is correctly typed before the audit decision is made.
- **Accessibility:** N/A.
- **Localization / internationalization:** N/A.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A `platform_admin` identity reaches code written assuming only `tenant_user` shape | (Should never surface to the user; caught at development/review time) | Code must fail closed / deny, never silently fall through as a tenant identity |
| A resolved identity's `type` is unrecognized (defensive case, not expected given the shipped type) | Generic "not authorized" / sign-in required | Treated as unauthenticated/denied, never defaulted to the lower-privilege tenant case |
| A new identity-consuming code path omits an explicit `platform_admin` case | N/A (build/review-time issue) | Should fail a TypeScript exhaustiveness check where implemented, or be caught in review |
| A new flattened role type is introduced | N/A (review-time issue) | Rejected in code review per BR4; not a runtime error |

---

## 12. Assumptions and Dependencies

- The `ResolvedIdentity` discriminated union in `social-listening-core` already correctly models the two identity kinds and is not being changed by this ADR/BRD/FDD.
- ADR-0030, ADR-0032, ADR-0035, and ADR-0036 remain Accepted and are annotated, not edited, per governance convention.
- Code review remains the primary enforcement mechanism until a mechanical check (lint rule, type-level exhaustiveness check, or contract-test convention) is designed and built as a separate, future, explicitly-scoped follow-up.
- The unused `AdminRole` type in `social-listening-admin/src/lib/role-routing.ts` remains a known, tracked, but unresolved counter-example at the time of this FDD.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a mechanical enforcement mechanism (lint rule, type-level exhaustiveness check, or contract-test convention) be built to catch a future violation automatically? | AI Delivery Agent / Menno | Not scheduled; a candidate future follow-up story |
| Q2 | Should the unused `AdminRole` type in `social-listening-admin/src/lib/role-routing.ts` simply be removed? | Whoever next touches that file | Not scheduled; a small code-cleanup follow-up |
| Q3 | Should this rule be stated directly as a code comment on `ResolvedIdentity`'s own definition, mirroring `role-routing.ts`'s informal comment? | Whoever next touches `identityResolution.ts` | Not scheduled; low-cost, optional addition |

---

## 14. Appendix

### Glossary

See BRD-0041 Section 15 for the full glossary (Platform Admin, Tenant-Admin, Tenant User, ResolvedIdentity, Discriminated Union, RLS, BYPASSRLS, Role Enum).

### Reference Links

- **ADR-0041:** `docs/adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md`
- **BRD-0041:** `docs/project docs/Business-Requirements/BRD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md`
- **Feature Design 12:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- **Related ADRs:** ADR-0030 (Platform Admin Postgres role/grants), ADR-0032 §3 (separate `platform_admins` table), ADR-0035 (admin UI route-tree split), ADR-0036 §4 (UI role-gating as UX convenience, not the security boundary)
- **Epic 7 boundary note:** `docs/user-stories/epic-7-platform-admin-ui.md`
- **Implementation Log:** `docs/implementation-log.md`, 2026-08-06 healing-pass entry ("Story 6.2 AC2") describing the concrete bug and fix that motivated this ADR

### Missing / Not Applicable Sources

- No `docs/product-research/reports/<feature>-deep-research.md` deep-research brief was found for the identity/RBAC feature.
- No user story exists for ADR-0041 itself (no-story ADR, category 1).

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | AI Delivery Agent | Regenerated as a genuine functional-design synthesis from ADR-0041 and BRD-0041, replacing a prior defective draft that duplicated the BRD's flat requirements table. |
