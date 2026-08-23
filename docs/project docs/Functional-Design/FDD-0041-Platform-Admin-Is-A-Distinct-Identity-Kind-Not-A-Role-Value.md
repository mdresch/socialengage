# BRD-0041: Platform Admin is a Distinct Identity Kind, Not a Role Value

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | BRD-0041: Platform Admin is a Distinct Identity Kind, Not a Role Value |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md, ../Business-Requirements/BRD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md and the business requirements in BRD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md into functional design for **Platform Admin Is A Distinct Identity Kind Not A Role Value**.
**What problem are we solving?** Platform Admin and Tenant-Admin have been treated as two values of the same role field in mental models and in code, even though the project's data model already makes them structurally different kinds of identity. This confusion directly caused a routing bug in which a Platform Admin session was silently handled as a tenant identity because the consuming code assumed every resolved identity had a `.role` field.

**Who is affected?** Any current or future contributor who writes or reviews code that consumes resolved identities in `social-listening-core` or `social-listening-admin`, plus the project's Platform-Admin, Tenant-Admin, and Tenant-User personas whose access boundaries depend on the distinction being preserved.

**What is the proposed solution at a glance?** Elevate the existing practice of structural distinctness to a formal, project-wide, cross-layer business rule: Platform Admin is a distinct *kind* of identity, never a value inside the tenant-user role enumeration; every consumer of a resolved identity must first narrow on the identity's `type` discriminant and handle both variants exhaustively.

**What business value do we expect?** A citable rule that prevents the same category error from recurring, protects the platform/tenant data boundary, and eliminates the need for future authors to reconstruct the distinction from four separately-scoped ADRs each time they touch identity-handling code.

---

### 2.2 Scope
**In scope:**
- Formalizing Platform Admin as a distinct identity *kind*, separate from the tenant-user role field.
- Requiring type-narrowed, exhaustive handling of resolved identities in all code, present and future, in either repository.
- Annotating ADR-0030, ADR-0032, ADR-0035, and ADR-0036 with a dated "Note on relation to ADR-0041" confirming they already satisfy this rule.
- Naming and tracking two small follow-up actions: removal of the unused `AdminRole` flat-enum type and a decision on mechanical enforcement.

**Out of scope:**
- Changing the database schema, Postgres role grants, or `ResolvedIdentity` shape (already implemented).
- Removing the unused `AdminRole` type within this BRD or ADR.
- Implementing a lint rule, type-level exhaustiveness check, or other mechanical enforcement.
- Creating a user story; ADR-0041 is a no-story, category-1 ADR.

## 3. Context and Background
**The concrete failure this ADR responds to, already found and fixed:** `docs/implementation-log.md`'s 2026-08-06 entry (`social-listening-admin@1f8960e`) records that `getRoleShell()` in `social-listening-admin/src/lib/role-routing.ts` switched on a resolved identity's `.role` field, but `social-listening-core/src/identity/identityResolution.ts`'s real `ResolvedIdentity` type is a discriminated union:

```ts
export type ResolvedIdentity =
  | { type: 'tenant_user'; tenantId: string; userId: string; role: string }
  | { type: 'platform_admin'; adminId: string };
```

A real `platform_admin` identity carries **no `role` field at all**. The original UI code blind-cast the session's untyped identity value to `{role?: string|null}` and branched on it directly — a real Platform Admin's `role` was therefore always `undefined`, and the code silently routed them into the tenant-facing shell rather than the Platform-Admin-facing one. This was not a cosmetic bug: it is exactly the class of confusion Menno's own request names — a Platform Admin session rendering as, and being treated as, an ordinary tenant identity. The fix is already built, logged, and verified (`social-listening-admin/.claude/skills/role-routing-shell/SKILL.md`'s "Load-bearing constraints"; `social-listening-admin/src/lib/role-routing.ts`'s `isResolvedIdentity()`/`isShellAllowed()`), and is not redone here — this ADR is about closing the *design-level* gap that let it happen at all, per Menno's own request, not about re-fixing already-fixed code.

**What this project has already decided, and where it already gets this right:**

- **ADR-0030** (Accepted) decided Platform Admin needs a structurally separate database mechanism from Tenant-Admin — a dedicated `platform_admin_role` Postgres role, granted `BYPASSRLS`, locked to the `tenants` table and its own identity table only, "never granted, and must never be used to query... any... tenant-content table" (§2). Tenant-Admin, by contrast, "requires no database-level RLS exception at all" — an ordinary tenant-scoped session with an application-layer role check (§1). Two tiers, two different mechanisms, stated explicitly.
- **ADR-0032 §3** (Accepted) decided Platform Admin "is not a row in this table" (`users`) — modeled in its own, separate `platform_admins` table, with "no `tenant_id` column and no `tenant_isolation` policy," specifically because "forcing Platform Admin into a nullable-`tenant_id` row on `users` would force every RLS predicate... to special-case `tenant_id IS NULL` — for a role that conceptually does not belong to any tenant at all."
- **ADR-0035** (Accepted) decided the admin UI is one role-gated app, gating on the fact that "a Platform Admin session structurally has no `tenant_id` context at all (it is not a `users` row, per ADR-0032 §3), which naturally separates what it can render from what a Tenant-Admin/Tenant User session can."
- **ADR-0036 §4** (Accepted) decided UI role-gating is a layered UX convenience, never the real security boundary — the real boundary stays in `social-listening-core`'s own RLS and application-layer checks.
- **Story 5.9's shipped code** (`resolveIdentity()`, `social-listening-core/src/identity/identityResolution.ts`) already implements exactly this distinctness as a TypeScript discriminated union, not a flat role field — this predates the bug and was never itself wrong.

**The real gap, stated precisely:** every one of the four ADRs above already treats Platform Admin as structurally distinct — but each states that distinctness *locally*, scoped to its own layer (ADR-0030/0032: the Postgres schema and role grants; ADR-0035/0036: the route-tree split). **None of them states, as a general, project-wide, cross-layer principle, that this distinctness is a property of the identity's own *type* that every consumer — in either repository, at any layer — must preserve by construction.** Nothing previously written down told a future implementer (human or AI) that a resolved identity is a discriminated union that must be narrowed on its `type` discriminant before any type-specific field is read, or that assuming a bare `.role` field exists on "whatever the caller's identity turns out to be" is exactly the kind of assumption this project's own data model forbids. The bug is direct proof this gap was real, not hypothetical: it happened in the one repository (`social-listening-admin`) whose story (6.2) cites ADR-0035 and ADR-0036 §4 as its governing ADRs — neither of which said anything about how identity-consuming *code* must be shaped, only about which routes render for which identity.

**A second, live, present-tense piece of evidence for the same gap, found while drafting this ADR, not fixed here:** `social-listening-admin/src/lib/role-routing.ts` line 1 still defines and exports `export type AdminRole = 'tenant_admin' | 'tenant_user' | 'platform_admin';` — a flat, three-value role enum that models Platform Admin as if it were a value alongside the two tenant roles, the exact shape this ADR argues against. Checked directly (`grep -r AdminRole social-listening-admin`): this type is referenced nowhere else in the repository, in source or contracts — it is dead code, but it is dead code that re-encodes the healed bug's own wrong mental model, sitting in the very file whose `SKILL.md` now warns against that model. It is named here as a concrete illustration that the gap this ADR closes is not abstract, and as a named follow-up for whoever next touches this file (the AI Delivery Agent or Menno) to remove — **not fixed by this ADR**, which is documentation-only per its own drafting persona's scope boundary.
**What problem are we solving?** Platform Admin and Tenant-Admin have been treated as two values of the same role field in mental models and in code, even though the project's data model already makes them structurally different kinds of identity. This confusion directly caused a routing bug in which a Platform Admin session was silently handled as a tenant identity because the consuming code assumed every resolved identity had a `.role` field.

**Who is affected?** Any current or future contributor who writes or reviews code that consumes resolved identities in `social-listening-core` or `social-listening-admin`, plus the project's Platform-Admin, Tenant-Admin, and Tenant-User personas whose access boundaries depend on the distinction being preserved.

**What is the proposed solution at a glance?** Elevate the existing practice of structural distinctness to a formal, project-wide, cross-layer business rule: Platform Admin is a distinct *kind* of identity, never a value inside the tenant-user role enumeration; every consumer of a resolved identity must first narrow on the identity's `type` discriminant and handle both variants exhaustively.

**What business value do we expect?** A citable rule that prevents the same category error from recurring, protects the platform/tenant data boundary, and eliminates the need for future authors to reconstruct the distinction from four separately-scoped ADRs each time they touch identity-handling code.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Close the design-level gap that allowed a Platform Admin to be treated as a tenant identity | No new identity-consuming code defaults or optionally-chains a `tenant_user`-only field without first narrowing on `type` |
| 2 | Make the Platform Admin / Tenant-Admin distinction a citable, project-wide business rule | All future identity-handling changes can be reviewed against ADR-0041 and this BRD |
| 3 | Preserve the platform/tenant access boundary at every layer | Platform Admin sessions never render or authorize as tenant sessions, and vice versa |
| 4 | Keep governance cost low by documenting the rule without changing accepted prior ADRs | ADR-0030, ADR-0032, ADR-0035, and ADR-0036 each receive a "Note on relation to ADR-0041" and remain otherwise unchanged |

---

**Positive consequences (from ADR):**
**Positive**
- States, for the first time as a general rule rather than four separately-scoped local facts, the exact principle whose absence let the healed bug happen — closes the gap at the design level Menno asked for, not just at the one call site the healing pass already fixed.
- Gives whoever next writes identity-consuming code in either repository (the AI Delivery Agent, Menno, or a future contributor) a citable, explicit rule to check new code against, rather than requiring each author to re-derive "Platform Admin isn't a role value" independently from four separately-scoped ADRs each time.
- Costs nothing to accept — restates and generalizes decisions already Accepted (ADR-0030, ADR-0032, ADR-0035, ADR-0036) and a shipped type (`ResolvedIdentity`), rather than introducing new mechanism, schema, or endpoint.

**Negative**
- **Names, but does not itself close, a real residual risk:** this Decision is a documentation-level rule, not an enforced one. Nothing currently in either repository's CI, lint configuration, or `enforce-contract-first.cjs` hook would catch a future violation mechanically — the healed bug itself passed whatever review existed until the Ideal Manager's own Decision Evaluator caught it (`docs/implementation-log.md`'s own healing-pass entry). Until a mechanical check exists (Open Questions, below), this ADR's Decision §2 depends on the same human/AI-review discipline that already once let the violation through once.
- `social-listening-admin/src/lib/role-routing.ts`'s own unused `AdminRole` type (Context, above) is a live, present-tense counter-example to this Decision that this ADR names but does not fix — a real, if minor, gap between this ADR's Decision and the current state of the codebase at the moment of acceptance.
- Adds a fourth and fifth "Note on relation" annotation to two already-Accepted ADRs each carrying several prior amendments (ADR-0030, ADR-0032) plus two more (ADR-0035, ADR-0036) — a small, cumulative documentation-maintenance cost this project's own governance convention already accepts as the price of not editing Accepted Decision text in place.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | Platform Admin must be modeled and treated as a distinct identity *kind*, never as a value within the tenant-user role field | Must | Prose and type definitions state Platform Admin and Tenant-Admin as two different kinds; no new code treats `platform_admin` as a role value | Product Owner |
| BR-002 | All code that consumes a resolved identity must narrow on the identity's `type` discriminant before reading any type-specific field | Must | Review of new identity-consuming code shows `type` is checked before `role`, `tenantId`, or `userId` is accessed | Technical Lead |
| BR-003 | Identity branches must be exhaustive, with explicit cases for `platform_admin` and `tenant_user` and no silent, privilege-assuming fallthrough | Must | No default/else branch treats an un-narrowed or unrecognized identity as a tenant user; where the language supports it, an exhaustiveness check is recommended | Technical Lead |
| BR-004 | Identity types must not be re-flattened into a single shape for convenience (e.g., one flat role enum containing `platform_admin`) | Must | No new flat role enum is introduced; existing unused `AdminRole` type is flagged for removal | Technical Lead |
| BR-005 | The four related ADRs must carry a dated note confirming their relationship to and satisfaction of ADR-0041 | Must | ADR-0030, ADR-0032, ADR-0035, and ADR-0036 each contain a "Note on relation to ADR-0041" | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno | Sponsor, Product Owner, Technical Lead | High | A single, durable rule that prevents the Platform Admin / Tenant-Admin confusion from recurring |
| Platform-Admin (persona) | Operates the platform without accessing tenant data | High | Clear assurance that platform sessions cannot be mistaken for tenant sessions |
| Tenant-Admin (persona) | Manages a single tenant's users, connectors, and settings | Medium | Confidence that the platform operator cannot be accidentally treated as a tenant user or admin |
| Tenant-User (persona) | Works within one tenant's scope | Low | Uninterrupted access, with no leaked platform-level privileges |
| AI Delivery Agent / future contributors | Writes and reviews identity-handling code | High | A citable, explicit standard to check new code against |

---

### 6.2 User Stories
No related user stories found.

## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `ResolvedIdentity` (discriminated union) | The runtime representation of the caller's identity; `tenant_user` carries `role`, `tenantId`, `userId`; `platform_admin` carries `adminId` only | `social-listening-core/src/identity/identityResolution.ts` | Technical Lead | High — controls all access decisions |
| `platform_admin_role` (Postgres role) | Dedicated database role with `BYPASSRLS`, locked to `tenants` and its own identity table only | ADR-0030 | Technical Lead | High — platform-level privilege |
| `platform_admins` table | Separate table for Platform Admin identities, with no `tenant_id` column and no `tenant_isolation` policy | ADR-0032 | Technical Lead | High — platform identity data |
| `users` table | Tenant-scoped user records carrying `role` (`tenant_admin` / `tenant_user`) | ADR-0032 | Technical Lead | High — tenant identity data |
| `platform_admin_audit_log` | Audit trail for privileged Platform Admin actions | Feature Design 12 | Technical Lead | High — compliance and accountability |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | The `role` field (`'tenant_admin'` or `'tenant_user'`) is a property that exists only on a `tenant_user`-kind identity. |
| BRU-002 | It is a category error to ask "what is a Platform Admin's role?" or to default a missing `role` to any tenant value. |
| BRU-003 | Any code that reads a `tenant_user`-only field must first narrow the identity on its `type` discriminant. |
| BRU-004 | Flat role enumerations that include `platform_admin` alongside tenant roles are not permitted, including in unused or dead code. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0030 (Platform Admin database role and grants) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-002 | ADR-0032 (separate `platform_admins` table) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-003 | ADR-0035 (admin UI as one role-gated app) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-004 | ADR-0036 (UI role-gating is a layered convenience, not the security boundary) | Internal / already Accepted | Product Owner | Already satisfied; receives relation note |
| D-005 | Shipped `ResolvedIdentity` discriminated-union implementation in `social-listening-core` | Internal / already built | Technical Lead | Already in place |
| D-006 | `social-listening-admin/src/lib/role-routing.ts` and its `SKILL.md` | Internal / already built | Technical Lead | Already in place; named for cleanup of unused `AdminRole` |

---

- The `ResolvedIdentity` discriminated union in `social-listening-core` already correctly models the two identity kinds.
- The four related ADRs (ADR-0030, ADR-0032, ADR-0035, ADR-0036) are Accepted and will not be edited in place.
- Code review is the primary enforcement mechanism until a mechanical check is added.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The identity-distinctness rule must be documented as a durable, citable project standard | Maintainability | Must | ADR-0041 and this BRD are the authoritative references; no contributor must re-derive the rule |
| NFR-002 | The platform/tenant access boundary must be preserved at every layer | Security | Must | No resolved-identity consumer can access tenant-content tables or UI routes when it represents a Platform Admin, and vice versa |

---

## 11. Error Handling and Exceptions
**Positive**
- States, for the first time as a general rule rather than four separately-scoped local facts, the exact principle whose absence let the healed bug happen — closes the gap at the design level Menno asked for, not just at the one call site the healing pass already fixed.
- Gives whoever next writes identity-consuming code in either repository (the AI Delivery Agent, Menno, or a future contributor) a citable, explicit rule to check new code against, rather than requiring each author to re-derive "Platform Admin isn't a role value" independently from four separately-scoped ADRs each time.
- Costs nothing to accept — restates and generalizes decisions already Accepted (ADR-0030, ADR-0032, ADR-0035, ADR-0036) and a shipped type (`ResolvedIdentity`), rather than introducing new mechanism, schema, or endpoint.

**Negative**
- **Names, but does not itself close, a real residual risk:** this Decision is a documentation-level rule, not an enforced one. Nothing currently in either repository's CI, lint configuration, or `enforce-contract-first.cjs` hook would catch a future violation mechanically — the healed bug itself passed whatever review existed until the Ideal Manager's own Decision Evaluator caught it (`docs/implementation-log.md`'s own healing-pass entry). Until a mechanical check exists (Open Questions, below), this ADR's Decision §2 depends on the same human/AI-review discipline that already once let the violation through once.
- `social-listening-admin/src/lib/role-routing.ts`'s own unused `AdminRole` type (Context, above) is a live, present-tense counter-example to this Decision that this ADR names but does not fix — a real, if minor, gap between this ADR's Decision and the current state of the codebase at the moment of acceptance.
- Adds a fourth and fifth "Note on relation" annotation to two already-Accepted ADRs each carrying several prior amendments (ADR-0030, ADR-0032) plus two more (ADR-0035, ADR-0036) — a small, cumulative documentation-maintenance cost this project's own governance convention already accepts as the price of not editing Accepted Decision text in place.

## 12. Assumptions and Dependencies
- The `ResolvedIdentity` discriminated union in `social-listening-core` already correctly models the two identity kinds.
- The four related ADRs (ADR-0030, ADR-0032, ADR-0035, ADR-0036) are Accepted and will not be edited in place.
- Code review is the primary enforcement mechanism until a mechanical check is added.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The rule is documented but not mechanically enforced, so a future violation could pass review undetected | Medium | High | Plan a follow-up to evaluate and add a lint rule, type-level exhaustiveness check, or contract-test convention; until then, enforce through code review | Technical Lead |
| R-002 | The unused `AdminRole` flat-enum type in `social-listening-admin/src/lib/role-routing.ts` remains as a live counter-example | Low | Medium | Create a separate code-cleanup item to remove the dead type; do not treat it as part of this ADR/BRD | AI Delivery Agent |
| R-003 | A future contributor re-introduces the "Platform Admin is a role value" mental model in a new component | Medium | High | Reference ADR-0041 in component skill files, code comments, and PR templates; require identity review for any new route or API surface | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0041-platform-admin-is-a-distinct-identity-kind-not-a-role-value.md`
- BRD: `../Business-Requirements/BRD-0041-Platform-Admin-Is-A-Distinct-Identity-Kind-Not-A-Role-Value.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: _No related user stories found._