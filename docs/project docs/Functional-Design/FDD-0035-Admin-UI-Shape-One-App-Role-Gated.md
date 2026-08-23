# SocialEngage — Admin UI Shape: One Role-Gated Application

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | SocialEngage — Admin UI Shape: One Role-Gated Application |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0035-admin-ui-shape-one-app-role-gated.md, ../Business-Requirements/BRD-0035-Admin-UI-Shape-One-App-Role-Gated.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0035-admin-ui-shape-one-app-role-gated.md and the business requirements in BRD-0035-Admin-UI-Shape-One-App-Role-Gated.md into functional design for **Admin UI Shape One App Role Gated**.
Once the Admin-tier design in ADR-0030 landed, the SocialEngage admin UI was required to serve two structurally different audiences from a single codebase: the **Platform Admin** (provisioning-only, no tenant-data access, today Menno as the sole operator) and **Tenant-Admin/Tenant User** roles (day-to-day tenant usage). ADR-0035 decided to keep this within one deployable Next.js application, `social-listening-admin`, using role-gated routing rather than splitting out a second deployable.

The proposed solution lets both audiences sign into the same application while ensuring that each role can only reach the screens and data it is authorized to see. A Platform-Admin session structurally has no `tenant_id` context, which naturally separates it from the tenant-facing route tree. This avoids the cost and operational overhead of a second build pipeline, deployment target, and hosting concern for a project that currently has one person in both roles. A separate "Platform Console" is explicitly deferred until a real second Platform Admin operator or a concrete security reason makes the split worthwhile.

---

### 2.2 Scope
**In scope:**
- The `social-listening-admin` application remains a single Next.js deployable.
- Platform-Admin screens (tenant provisioning, suspension, license-seat management, break-glass, audit log) are implemented as additional routes within the same application.
- Role-gated routing based on the resolved identity returned by `GET /v1/me`.
- Two structurally separate route trees: one for `tenant_admin`/`tenant_user` identities and one for `platform_admin` identities.
- Server-side enforcement so that direct navigation to an unauthorized route is rejected, not merely hidden from menus.
- Explicit documentation of the trigger for revisiting the split: a real second Platform Admin operator or a concrete, demonstrated security issue with the shared bundle.

**Out of scope:**
- A second, separately deployable "Platform Console" application.
- Separate authentication stacks for tenant and platform users.
- Operational/cost/health metrics dashboards for the platform; these remain deferred to Epic 4 / the Platform Operations Dashboard feature design.
- Tenant content (posts, watchlists, connector credentials, user tables) on any Platform-Admin screen.
- Fine-grained permissions beyond the three existing roles (`platform_admin`, `tenant_admin`, `tenant_user`).

## 3. Context and Background
ADR-0001 already decided `social-listening-admin` is one repository, independently deployable from `social-listening-core`, talking to it only through the REST API. That decision stands and is not reopened here. What ADR-0001 did not anticipate — because no Admin-tier or Tenant-Admin/Tenant User model existed yet — is that this one repository now has to serve **two structurally different audiences** once ADR-0030's Admin-tier design lands: Platform Admin (provisioning-only, zero tenant-data access, realistically operated by Menno alone for the foreseeable future — `Stakeholder-Register.md`'s Sole Operator persona) and Tenant-Admin/Tenant User (day-to-day tenant usage, the audience every real future tenant will actually be). This ADR decides whether that split needs its own second deployable app, or fits inside the one that already exists.
Once the Admin-tier design in ADR-0030 landed, the SocialEngage admin UI was required to serve two structurally different audiences from a single codebase: the **Platform Admin** (provisioning-only, no tenant-data access, today Menno as the sole operator) and **Tenant-Admin/Tenant User** roles (day-to-day tenant usage). ADR-0035 decided to keep this within one deployable Next.js application, `social-listening-admin`, using role-gated routing rather than splitting out a second deployable.

The proposed solution lets both audiences sign into the same application while ensuring that each role can only reach the screens and data it is authorized to see. A Platform-Admin session structurally has no `tenant_id` context, which naturally separates it from the tenant-facing route tree. This avoids the cost and operational overhead of a second build pipeline, deployment target, and hosting concern for a project that currently has one person in both roles. A separate "Platform Console" is explicitly deferred until a real second Platform Admin operator or a concrete security reason makes the split worthwhile.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Avoid unnecessary infrastructure for a single-operator platform | No second deployable, build pipeline, or hosting target introduced before a demonstrated need |
| 2 | Deliver a single, secure admin sign-in experience for all roles | One application serves tenant and platform users; unauthenticated users are redirected to a single sign-in flow |
| 3 | Prevent cross-role access by design | No Platform-Admin session can render tenant content, and no tenant user can reach Platform-Admin actions |
| 4 | Preserve the option to split later without re-architecting the security model | The revisit trigger for a separate "Platform Console" is documented and technically feasible |
| 5 | Keep the project aligned with its "don't build ahead of need" discipline | The decision is consistent with prior deferrals such as ADR-0020's rate-limit gate |

---

**Positive consequences (from ADR):**
**Positive**
- No new deployable, build pipeline, or hosting concern for a solo project whose only current Platform Admin operator is also its only current Tenant-Admin/Tenant User.
- Role-gating falls out naturally from ADR-0029/ADR-0032's identity model (a Platform Admin session has no tenant context to render tenant screens against) rather than requiring new architecture.

**Negative**
- Platform Admin's UI bundle ships alongside tenant-facing code it will never use, a real (if currently low-stakes) larger attack surface than a fully separate deployable would have — named plainly, not hidden, as the accepted cost of deferring the split.
- If a second deployable is ever warranted later, the split is real, non-trivial rework (build/deploy pipeline duplication, routing reorganization) — deferring it now does not make that future cost disappear, only postpones it until (if ever) the revisit trigger fires.

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The admin UI shall remain a single Next.js application, not a second deployable | Must | `social-listening-admin` is the only admin UI deployable; no new build pipeline or host is created for Platform-Admin screens | Product Owner |
| BR-002 | The application shall provide role-gated route trees for tenant and platform roles | Must | Distinct route trees exist for `tenant_admin`/`tenant_user` and `platform_admin` identities; cross-tree requests are rejected | Product Owner |
| BR-003 | A Platform-Admin session shall not access tenant screens or data | Must | Any `platform_admin` request to a tenant route is redirected or rejected by server-side enforcement; no tenant `tenant_id` is available for such sessions | Product Owner |
| BR-004 | A Tenant-Admin or Tenant-User session shall not access Platform-Admin screens | Must | Any `tenant_admin` or `tenant_user` request to a `platform_admin` route is rejected | Product Owner |
| BR-005 | The implementation shall cite ADR-0035 as the governing structural constraint | Should | Relevant component documentation or comments explicitly reference the single-app, role-gated decision | Product Owner |
| BR-006 | The application shall support the future split trigger | Should | The decision and revisit trigger are documented so a future "Platform Console" split can be revisited without reverse-engineering the original rationale | Product Owner |

### 5.1 Architecture Decision
**One application (`social-listening-admin`), with role-gated routing — no second deployable app is introduced.** Platform Admin's screens (tenant provisioning, suspension, license-seat management) are additional routes within the same Next.js app, gated by the same resolved `role`/tenant-membership shape ADR-0029/ADR-0032 already establish: a Platform Admin session structurally has no `tenant_id` context at all (it is not a `users` row, per ADR-0032 §3), which naturally separates what it can render from what a Tenant-Admin/Tenant User session can, rather than requiring a second codebase to enforce the same separation.

**A genuinely separate deployable ("Platform Console" vs. "Tenant App") is named and explicitly deferred, not rejected outright:** it is a legitimate design for a product with a real, separate population of platform operators, and it would reduce Platform Admin's own UI bundle's attack surface (it would ship zero tenant-data-fetching code at all). It is deferred under this project's own established discipline of not building ahead of a demonstrated need (ADR-0020's distributed rate-limit gate is the direct precedent for this kind of call): today there is exactly one operator (Menno) in both roles, no second deployable pipeline, build, or hosting concern is justified by that population size. **Revisit trigger, named explicitly:** a real second Platform Admin operator distinct from Menno, or a concretely demonstrated security reason the shared bundle is a problem (not a hypothetical one) — either is sufficient grounds to revisit; neither currently exists.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno / Sole Operator | Only current Platform Admin and primary developer | High | Operate the platform without maintaining two apps or deployment pipelines |
| Platform Admin (future) | Provisioning, audit, platform health | High | Reach platform screens without seeing tenant content; operate from one console if the split is not yet triggered |
| Tenant Admin | Day-to-day tenant configuration and user management | Medium | See only tenant-scoped screens and actions; no accidental exposure to platform data |
| Tenant User | Watchlist, connector, and post activity | Medium | See only role-appropriate UI; cannot reach tenant-admin or platform actions |
| Legal / Compliance reviewer | Audit and data boundary assurance | Medium | Evidence that Platform-Admin access is structurally tenant-content-free |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 6.2 | epic-6-tenant-admin-ui.md |  | Two structurally separate route trees exist: a tenant-facing tree (for `tenant_admin`/`tenant_user` resolved identities) and a Platform-Admin-facing tree (fo... |
| Story 6.6 | epic-7-platform-admin-ui.md |  | Tenant list screen: name, domain, status, seat ceiling/active count, created date (ADR-0031's schema) — reading from a new `GET /v1/admin/tenants`-shaped cor... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Resolved identity (`role`, `tenantId?`, `userId?`, `adminId?`) | The caller's resolved role and tenant context from the core API | `GET /v1/me` | Backend identity resolution | High — determines authorization boundary |
| Session cookie (`sid`) | Server-side BFF session reference, no token values exposed | `social-listening-admin` session store | Admin UI | High — controls authenticated access |
| Tenant registry metadata | Name, domain, status, license seat counts for Platform-Admin operations | `GET /v1/admin/tenants` | Platform Admin store | Medium — platform-level metadata only |
| Audit log rows | Record of Platform-Admin privileged actions | `platform_admin_audit_log` | Platform Admin audit log | High — compliance evidence |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A `platform_admin` resolved identity structurally has no `tenant_id` and therefore cannot render any tenant-content screen. |
| BRU-002 | Route separation is determined by the resolved identity's `role`, not by client-side link visibility. |
| BRU-003 | A separate "Platform Console" deployable shall only be built when a real second Platform-Admin operator exists, or a concrete security incident demonstrates that the shared bundle is unacceptable. |
| BRU-004 | Every route's page component must enforce the role boundary server-side, per ADR-0041, not rely solely on which navigation links are rendered. |
| BRU-005 | No Platform-Admin screen may display tenant-content tables such as `users`, `watchlists`, `social_posts`, or `platform_credentials`. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0001 — `social-listening-admin` is a separate, REST-only repository | Internal / Source | Product Owner | Accepted |
| D-002 | ADR-0029 — identity resolution model (`GET /v1/me`) | Internal / Source | Backend team | Accepted; endpoint built under Story 5.11 |
| D-003 | ADR-0030 — Admin-tier design and zero-tenant-content boundary | Internal / Source | Product Owner | Accepted |
| D-004 | ADR-0031 — `tenants` table shape | Internal / Source | Backend team | Accepted |
| D-005 | ADR-0032 — `users`/`platform_admins` distinction and `access_ends_at` | Internal / Source | Backend team | Accepted |
| D-006 | ADR-0036 — admin UI authentication/session mechanism | Internal / Source | Frontend team | Accepted |
| D-007 | ADR-0041 — server-side page-level role enforcement | Internal / Source | Frontend team | Accepted |
| D-008 | Story 6.1 — Next.js scaffold and Entra sign-in | Implementation | Frontend team | Built |
| D-009 | Story 6.2 — role-gated routing shell | Implementation | Frontend team | Built |
| D-010 | Story 6.6 — Platform Admin console | Implementation | Frontend team | Built |

---

- The sole Platform-Admin operator for the foreseeable future is Menno, who is also the project's developer and operator.
- The resolved-identity shape (`role`, optional `tenantId`, `userId`, `adminId`) is available from `GET /v1/me` as decided in ADR-0029 and ADR-0032.
- The Next.js App Router and a server-side BFF session pattern are the technical basis for the admin UI.
- ADR-0041's cross-layer rule — that every route's page component enforces role separation server-side — is applied by the implementation stories.

**One application (`social-listening-admin`), with role-gated routing — no second deployable app is introduced.** Platform Admin's screens (tenant provisioning, suspension, license-seat management) are additional routes within the same Next.js app, gated by the same resolved `role`/tenant-membership shape ADR-0029/ADR-0032 already establish: a Platform Admin session structurally has no `tenant_id` context at all (it is not a `users` row, per ADR-0032 §3), which naturally separates what it can render from what a Tenant-Admin/Tenant User session can, rather than requiring a second codebase to enforce the same separation.

**A genuinely separate deployable ("Platform Console" vs. "Tenant App") is named and explicitly deferred, not rejected outright:** it is a legitimate design for a product with a real, separate population of platform operators, and it would reduce Platform Admin's own UI bundle's attack surface (it would ship zero tenant-data-fetching code at all). It is deferred under this project's own established discipline of not building ahead of a demonstrated need (ADR-0020's distributed rate-limit gate is the direct precedent for this kind of call): today there is exactly one operator (Menno) in both roles, no second deployable pipeline, build, or hosting concern is justified by that population size. **Revisit trigger, named explicitly:** a real second Platform Admin operator distinct from Menno, or a concretely demonstrated security reason the shared bundle is a problem (not a hypothetical one) — either is sufficient grounds to revisit; neither currently exists.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Role-gating shall be enforced server-side, not only by hidden links | Security | Must | Direct navigation or URL access to an unauthorized route is rejected by the server |
| NFR-002 | The session shall not expose bearer tokens to browser JavaScript | Security | Must | Tokens are kept in the server-side BFF session; no token values appear in client-readable cookies or HTML |
| NFR-003 | The shared bundle's larger attack surface is accepted and flagged as a deferred risk | Security | Should | ADR-0035's negative consequence is noted in project risk tracking and linked to the named revisit trigger |
| NFR-004 | The admin UI shall degrade safely when the resolved-identity endpoint is unavailable | Reliability | Should | An invalid or missing identity redirects the caller to sign-in rather than rendering an unauthorized or broken screen |
| NFR-005 | The single-app design shall not block a future two-deployable split | Maintainability | Should | The route-tree split and role logic are organized so that future extraction of a Platform Console does not require redefining the identity model |

---

## 11. Error Handling and Exceptions
**Positive**
- No new deployable, build pipeline, or hosting concern for a solo project whose only current Platform Admin operator is also its only current Tenant-Admin/Tenant User.
- Role-gating falls out naturally from ADR-0029/ADR-0032's identity model (a Platform Admin session has no tenant context to render tenant screens against) rather than requiring new architecture.

**Negative**
- Platform Admin's UI bundle ships alongside tenant-facing code it will never use, a real (if currently low-stakes) larger attack surface than a fully separate deployable would have — named plainly, not hidden, as the accepted cost of deferring the split.
- If a second deployable is ever warranted later, the split is real, non-trivial rework (build/deploy pipeline duplication, routing reorganization) — deferring it now does not make that future cost disappear, only postpones it until (if ever) the revisit trigger fires.

## 12. Assumptions and Dependencies
- The sole Platform-Admin operator for the foreseeable future is Menno, who is also the project's developer and operator.
- The resolved-identity shape (`role`, optional `tenantId`, `userId`, `adminId`) is available from `GET /v1/me` as decided in ADR-0029 and ADR-0032.
- The Next.js App Router and a server-side BFF session pattern are the technical basis for the admin UI.
- ADR-0041's cross-layer rule — that every route's page component enforces role separation server-side — is applied by the implementation stories.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The shared bundle ships tenant-facing code alongside Platform-Admin code, increasing the attack surface | High (by design) | Low (single operator, no untrusted Platform Admin) | Accept for now; document the named revisit trigger and split condition | Product Owner |
| R-002 | Future split to a separate "Platform Console" requires non-trivial rework | Medium | Medium | Keep route trees and role logic cleanly separated; document the decision and triggers | Technical Lead |
| R-003 | UI mockups or future screens may not be reconciled with the role-gating model before implementation | Medium | High | Require every Platform-Admin and tenant screen to be reviewed against ADR-0030/0035/0041 before acceptance | Product Owner |
| R-004 | Over-optimization for a sole operator could make multi-operator transition harder | Medium | Medium | Design role gates using the existing resolved-identity model so the split can be made without redefining identity | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0035-admin-ui-shape-one-app-role-gated.md`
- BRD: `../Business-Requirements/BRD-0035-Admin-UI-Shape-One-App-Role-Gated.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md``
- Feature design: `docs/product-research/feature-designs/17-platform-operations-dashboard.md``
- Deep research: `docs/product-research/reports/*-deep-research.md``
- User stories: see extracted stories above