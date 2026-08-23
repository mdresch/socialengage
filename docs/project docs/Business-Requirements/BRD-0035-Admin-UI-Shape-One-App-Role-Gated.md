# SocialEngage — Admin UI Shape: One Role-Gated Application

## Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage Admin UI Shape — One Role-Gated Application |
| Version | 1.0 |
| Date | 2026-08-03 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno, Sole Operator / Product Owner |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-03 | AI Business & Requirements Analyst | Initial draft from ADR-0035 |
| 1.0 | 2026-08-03 | Menno | Approved as accepted |

---

## 2. Executive Summary

Once the Admin-tier design in ADR-0030 landed, the SocialEngage admin UI was required to serve two structurally different audiences from a single codebase: the **Platform Admin** (provisioning-only, no tenant-data access, today Menno as the sole operator) and **Tenant-Admin/Tenant User** roles (day-to-day tenant usage). ADR-0035 decided to keep this within one deployable Next.js application, `social-listening-admin`, using role-gated routing rather than splitting out a second deployable.

The proposed solution lets both audiences sign into the same application while ensuring that each role can only reach the screens and data it is authorized to see. A Platform-Admin session structurally has no `tenant_id` context, which naturally separates it from the tenant-facing route tree. This avoids the cost and operational overhead of a second build pipeline, deployment target, and hosting concern for a project that currently has one person in both roles. A separate "Platform Console" is explicitly deferred until a real second Platform Admin operator or a concrete security reason makes the split worthwhile.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Avoid unnecessary infrastructure for a single-operator platform | No second deployable, build pipeline, or hosting target introduced before a demonstrated need |
| 2 | Deliver a single, secure admin sign-in experience for all roles | One application serves tenant and platform users; unauthenticated users are redirected to a single sign-in flow |
| 3 | Prevent cross-role access by design | No Platform-Admin session can render tenant content, and no tenant user can reach Platform-Admin actions |
| 4 | Preserve the option to split later without re-architecting the security model | The revisit trigger for a separate "Platform Console" is documented and technically feasible |
| 5 | Keep the project aligned with its "don't build ahead of need" discipline | The decision is consistent with prior deferrals such as ADR-0020's rate-limit gate |

---

## 4. Scope

### 4.1 In Scope

- The `social-listening-admin` application remains a single Next.js deployable.
- Platform-Admin screens (tenant provisioning, suspension, license-seat management, break-glass, audit log) are implemented as additional routes within the same application.
- Role-gated routing based on the resolved identity returned by `GET /v1/me`.
- Two structurally separate route trees: one for `tenant_admin`/`tenant_user` identities and one for `platform_admin` identities.
- Server-side enforcement so that direct navigation to an unauthorized route is rejected, not merely hidden from menus.
- Explicit documentation of the trigger for revisiting the split: a real second Platform Admin operator or a concrete, demonstrated security issue with the shared bundle.

### 4.2 Out of Scope

- A second, separately deployable "Platform Console" application.
- Separate authentication stacks for tenant and platform users.
- Operational/cost/health metrics dashboards for the platform; these remain deferred to Epic 4 / the Platform Operations Dashboard feature design.
- Tenant content (posts, watchlists, connector credentials, user tables) on any Platform-Admin screen.
- Fine-grained permissions beyond the three existing roles (`platform_admin`, `tenant_admin`, `tenant_user`).

### 4.3 Assumptions

- The sole Platform-Admin operator for the foreseeable future is Menno, who is also the project's developer and operator.
- The resolved-identity shape (`role`, optional `tenantId`, `userId`, `adminId`) is available from `GET /v1/me` as decided in ADR-0029 and ADR-0032.
- The Next.js App Router and a server-side BFF session pattern are the technical basis for the admin UI.
- ADR-0041's cross-layer rule — that every route's page component enforces role separation server-side — is applied by the implementation stories.

### 4.4 Constraints

- No infrastructure may be built ahead of demonstrated need.
- The shared bundle means some tenant-facing code ships alongside Platform-Admin code, which is accepted as a low-stakes risk for now.
- Any future split is expected to require real, non-trivial rework (build pipeline duplication, routing reorganization) and must be triggered explicitly.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Menno / Sole Operator | Only current Platform Admin and primary developer | High | Operate the platform without maintaining two apps or deployment pipelines |
| Platform Admin (future) | Provisioning, audit, platform health | High | Reach platform screens without seeing tenant content; operate from one console if the split is not yet triggered |
| Tenant Admin | Day-to-day tenant configuration and user management | Medium | See only tenant-scoped screens and actions; no accidental exposure to platform data |
| Tenant User | Watchlist, connector, and post activity | Medium | See only role-appropriate UI; cannot reach tenant-admin or platform actions |
| Legal / Compliance reviewer | Audit and data boundary assurance | Medium | Evidence that Platform-Admin access is structurally tenant-content-free |

---

## 6. Current State (As-Is)

**Current process:**

- ADR-0001 already established `social-listening-admin` as a single, independently deployable repository that talks to `social-listening-core` only through the REST API.
- With the acceptance of ADR-0030, ADR-0031, and ADR-0032, the platform now has an Admin tier, a `tenants` table, and an identity model that distinguishes Platform Admin from Tenant-Admin and Tenant-User.
- At the time of this decision, the admin UI was an empty Next.js shell with no Next.js scaffold and only the Story 1.1 contract around the REST boundary.

**Pain points:**

- The admin UI must now serve two audiences with very different authorization boundaries.
- Building and maintaining two separate deployables would be disproportionate for a solo project with one operator in both roles.
- A split would also introduce a second build pipeline, environment, and hosting concern before any real contract (such as a Platform-Admin screen) exists to test it against.

---

## 7. Future State (To-Be)

**New or improved process:**

- A single `social-listening-admin` Next.js application is the only deployable for all admin users.
- After sign-in, the caller's resolved identity determines which route tree is accessible.
- The `tenant_admin`/`tenant_user` route tree renders tenant dashboards, connectors, watchlists, settings, and user management.
- The `platform_admin` route tree renders the Platform Admin console: tenant provisioning, tenant status/seats, break-glass reset, and audit log.
- Requests across the two trees are rejected server-side; the absence of a `tenant_id` for a Platform Admin is the structural guard that prevents tenant screen rendering.

**Expected capabilities:**

- One sign-in, one session, one deployment.
- Role-based navigation that updates automatically based on the resolved identity.
- Platform-Admin actions that cannot leak into tenant data because the role itself carries no tenant context.
- A documented, named trigger for when a separate Platform Console becomes justified.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The admin UI shall remain a single Next.js application, not a second deployable | Must | `social-listening-admin` is the only admin UI deployable; no new build pipeline or host is created for Platform-Admin screens | Product Owner |
| BR-002 | The application shall provide role-gated route trees for tenant and platform roles | Must | Distinct route trees exist for `tenant_admin`/`tenant_user` and `platform_admin` identities; cross-tree requests are rejected | Product Owner |
| BR-003 | A Platform-Admin session shall not access tenant screens or data | Must | Any `platform_admin` request to a tenant route is redirected or rejected by server-side enforcement; no tenant `tenant_id` is available for such sessions | Product Owner |
| BR-004 | A Tenant-Admin or Tenant-User session shall not access Platform-Admin screens | Must | Any `tenant_admin` or `tenant_user` request to a `platform_admin` route is rejected | Product Owner |
| BR-005 | The implementation shall cite ADR-0035 as the governing structural constraint | Should | Relevant component documentation or comments explicitly reference the single-app, role-gated decision | Product Owner |
| BR-006 | The application shall support the future split trigger | Should | The decision and revisit trigger are documented so a future "Platform Console" split can be revisited without reverse-engineering the original rationale | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Role-gating shall be enforced server-side, not only by hidden links | Security | Must | Direct navigation or URL access to an unauthorized route is rejected by the server |
| NFR-002 | The session shall not expose bearer tokens to browser JavaScript | Security | Must | Tokens are kept in the server-side BFF session; no token values appear in client-readable cookies or HTML |
| NFR-003 | The shared bundle's larger attack surface is accepted and flagged as a deferred risk | Security | Should | ADR-0035's negative consequence is noted in project risk tracking and linked to the named revisit trigger |
| NFR-004 | The admin UI shall degrade safely when the resolved-identity endpoint is unavailable | Reliability | Should | An invalid or missing identity redirects the caller to sign-in rather than rendering an unauthorized or broken screen |
| NFR-005 | The single-app design shall not block a future two-deployable split | Maintainability | Should | The route-tree split and role logic are organized so that future extraction of a Platform Console does not require redefining the identity model |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `platform_admin` resolved identity structurally has no `tenant_id` and therefore cannot render any tenant-content screen. |
| BRU-002 | Route separation is determined by the resolved identity's `role`, not by client-side link visibility. |
| BRU-003 | A separate "Platform Console" deployable shall only be built when a real second Platform-Admin operator exists, or a concrete security incident demonstrates that the shared bundle is unacceptable. |
| BRU-004 | Every route's page component must enforce the role boundary server-side, per ADR-0041, not rely solely on which navigation links are rendered. |
| BRU-005 | No Platform-Admin screen may display tenant-content tables such as `users`, `watchlists`, `social_posts`, or `platform_credentials`. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Resolved identity (`role`, `tenantId?`, `userId?`, `adminId?`) | The caller's resolved role and tenant context from the core API | `GET /v1/me` | Backend identity resolution | High — determines authorization boundary |
| Session cookie (`sid`) | Server-side BFF session reference, no token values exposed | `social-listening-admin` session store | Admin UI | High — controls authenticated access |
| Tenant registry metadata | Name, domain, status, license seat counts for Platform-Admin operations | `GET /v1/admin/tenants` | Platform Admin store | Medium — platform-level metadata only |
| Audit log rows | Record of Platform-Admin privileged actions | `platform_admin_audit_log` | Platform Admin audit log | High — compliance evidence |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Unauthorized route access attempts | Detect attempts to cross role-gated route trees | Security / Operations | Real-time (as logs) |
| Active sessions by resolved role | Understand admin UI usage across roles | Product Owner | Weekly |
| Platform Admin console usage | Track tenant provisioning, suspension, and break-glass activity | Compliance / Operations | On demand / Audit |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The shared bundle ships tenant-facing code alongside Platform-Admin code, increasing the attack surface | High (by design) | Low (single operator, no untrusted Platform Admin) | Accept for now; document the named revisit trigger and split condition | Product Owner |
| R-002 | Future split to a separate "Platform Console" requires non-trivial rework | Medium | Medium | Keep route trees and role logic cleanly separated; document the decision and triggers | Technical Lead |
| R-003 | UI mockups or future screens may not be reconciled with the role-gating model before implementation | Medium | High | Require every Platform-Admin and tenant screen to be reviewed against ADR-0030/0035/0041 before acceptance | Product Owner |
| R-004 | Over-optimization for a sole operator could make multi-operator transition harder | Medium | Medium | Design role gates using the existing resolved-identity model so the split can be made without redefining identity | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- `social-listening-admin` is a single Next.js application that serves both tenant and platform admin users.
- Two structurally separate route trees exist for tenant-facing and Platform-Admin screens.
- A `platform_admin` session requesting any tenant-facing route is rejected or redirected, and vice versa.
- A `tenant_user` session does not see Tenant-Admin-only or Platform-Admin-only actions, although the final authorization remains the backend's responsibility.
- The implementation cites ADR-0035 in the relevant component documentation.
- The revisit trigger for a separate "Platform Console" is documented: a real second Platform-Admin operator, or a concrete demonstrated security issue with the shared bundle.
- The role boundary is enforced server-side on every route's page component, consistent with ADR-0041.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Platform Admin** | A platform operator role with no `tenant_id`, able to provision and manage tenants and platform audit logs, but not access tenant content. |
| **Tenant Admin** | A user within a tenant who can manage connectors, watchlists, settings, and invite other users. |
| **Tenant User** | A user within a tenant who can work with their own watchlists and posts but cannot perform tenant-wide management. |
| **Resolved identity** | The output of `GET /v1/me`, containing the caller's role and, for tenant users, their `tenant_id` and `user_id`. |
| **Role-gated routing** | The pattern of showing or rejecting routes based on the resolved identity's role. |
| **BFF session** | Back-end-for-front-end session used by the admin UI to keep tokens server-side. |
| **Next.js App Router** | The file-system-based routing mechanism used by `social-listening-admin`. |
| **Platform Console** | A hypothetical future, separately deployable application for Platform-Admin operations, currently deferred. |

---

## 16. Appendices

### A. Source documents

- `docs/adr/0035-admin-ui-shape-one-app-role-gated.md` — source ADR.
- `docs/user-stories/README.md` — confirms ADR-0035 is a no-story ADR and describes the "No-story ADR convention" formalized at its acceptance.
- `docs/user-stories/epic-6-tenant-admin-ui.md` — Story 6.2, the first testable contract that applies ADR-0035.
- `docs/user-stories/epic-7-platform-admin-ui.md` — Story 6.6, the Platform Admin console built under the same structural constraint.

### B. Related feature-design context

No single feature-design file was explicitly named by ADR-0035. The following related designs were inferred and reviewed for cross-cutting context:

- `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` — RBAC, `GET /v1/me`, and role-based routing context.
- `docs/product-research/feature-designs/17-platform-operations-dashboard.md` — the future operational-metrics console (out of scope for this BRD).

### C. Design reference

- `docs/design/admin-ui-mockup-2026-08-03.html` — referenced by ADR-0035 as an unvalidated UI design mockup (not yet reconciled screen-by-screen with the ADR's role-gating model).

### D. Deep-research report

No `docs/product-research/reports/*-deep-research.md` file specific to ADR-0035 was found. This BRD relies on the ADR itself and the related feature designs listed above.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-03 |
| Product Owner | Menno | | 2026-08-03 |
| Technical Lead | Menno | | 2026-08-03 |
| Other Stakeholder | — | | |
