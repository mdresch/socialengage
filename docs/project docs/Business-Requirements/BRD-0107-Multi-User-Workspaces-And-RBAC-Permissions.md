# Business Requirements Document — Multi-User Workspaces and RBAC Permissions

> **Note:** This BRD is drafted against **ADR-0107**, which is currently **Proposed**. It is therefore a draft for review and may change if the ADR is revised or rejected.

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Multi-User Workspaces and RBAC Permissions |
| BRD Number | BRD-0107 |
| Related ADR | ADR-0107: Multi-user workspaces and RBAC permissions |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0107, feature design, and Epic 12 stories |

---

## 2. Executive Summary

SocialEngage currently protects tenant data with row-level security (RLS) and a coarse role split between `tenant_admin` and `tenant_user`. This protects the tenant boundary, but it does not let a tenant delegate responsibilities safely: the only way to share a watchlist or allow someone to manage a connector is to grant full admin access. This over-privileging increases the risk of accidental data exposure, limits team collaboration, and makes the product less attractive to enterprise buyers who expect least-privilege access.

This initiative, anchored by **ADR-0107**, introduces a fine-grained permission matrix for tenant roles. It adds **per-watchlist sharing** between tenant users, **per-connector permissions** that respect ownership tiers, and **per-tenant feature gating** controlled by platform and tenant administrators. The application-layer permission checks complement — but do not replace — the existing RLS tenant boundary.

The expected business value is threefold: safer collaboration within teams (users can share watchlists without sharing admin rights), safer connector governance (not every user can create tenant-wide credentials), and a foundation for custom enterprise roles and staged feature rollouts in future releases.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce over-privileged sharing inside a tenant | Tenant users can share watchlists read-only without being promoted to `tenant_admin` |
| 2 | Enforce least privilege for connector administration | No `tenant_user` can create or configure tenant-wide connector credentials; only user-bound OAuth credentials are permitted |
| 3 | Enable staged feature rollouts per tenant | `tenant_settings.feature_gates` is settable and observable in the workspace settings UI |
| 4 | Improve governance and audit readiness | Every role change, watchlist share, connector activation, and feature-gate change is recorded in an audit log |
| 5 | Prepare the product for enterprise RBAC | Permission matrix is structured so that future custom roles can be added without re-architecting security |

---

## 4. Scope

### 4.1 In Scope

- A permission matrix for `tenant_admin`, `tenant_user`, and the deferred `analyst` role across resources such as users, connectors, watchlists, alerts, posts, analytics, settings, exports, and DSR.
- Per-watchlist sharing between tenant users with `read` and `edit` permission levels.
- A `watchlist_shares` table to record the sharing relationship, permission, and audit trail.
- Per-connector permission rules distinguishing tenant-wide credentials (managed by `tenant_admin`) from user-bound OAuth credentials (managed by the creating `tenant_user`).
- Per-tenant feature gating through `tenant_settings.feature_gates` (JSONB), set by `Platform-Admin` and optionally by `Tenant-Admin` where platform policy allows.
- Application-layer `requirePermission(resource, action)` checks in route handlers, used in addition to RLS.
- Enforcement of seat limits (`max_seats`) on user invite and accept.
- A workspace settings UI for user/role management, watchlist sharing configuration, and feature-gate visibility.

### 4.2 Out of Scope

- Custom roles such as `analyst` and `social_care_agent` in v1; these are v2 features.
- Full attribute-based access control (ABAC) or Entra group-based permissions.
- Tenant admin impersonation of tenant users.
- Multi-tenant / agency login where one user belongs to multiple client tenants.
- Per-connector *visibility* restrictions by individual user in v1; all tenant users still see tenant connectors, but activation rights are tiered.

### 4.3 Assumptions

- Entra External ID, `resolveIdentity()`, RLS on every tenant table, and the existing `tenant_admin` / `tenant_user` / `platform_admin` role split are already operational.
- Watchlists are already owned by an individual user and private by default (ADR-0044).
- Connectors already distinguish tenant-wide credentials from user-bound credentials (ADR-0028, ADR-0051).

### 4.4 Constraints

- `tenant_user` remains the default role for new users.
- Permission checks are an additional application-layer gate and cannot replace RLS as the primary tenant isolation mechanism.
- All changes must be testable through existing contract-test targets and must not weaken the existing RLS boundary.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform-Admin | Manages tenants, seats, and platform-level feature gates | High | Create/suspend tenants, adjust seat counts, query audit logs without accessing tenant data |
| Tenant-Admin | Manages the tenant workspace and users | High | Invite/revoke users, assign roles, manage connectors and watchlists, and avoid administrative mistakes |
| Tenant-User | Daily user creating watchlists and reviewing posts | Medium | Access only the connectors, watchlists, and features they need; share when appropriate |
| Legal-Advisor | Compliance and audit reviewer | Medium | Produce a defensible trail of every role change, approval, and export action |
| Backend Engineer | Implements permission logic and data model | High | Clear matrix, testable rules, and stable contracts |
| Product Owner | Prioritizes scope and acceptance | High | Enterprise-ready RBAC without overbuilding v1 |

---

## 6. Current State (As-Is)

**Current process:**

1. A user authenticates through Entra External ID.
2. `resolveIdentity()` maps the caller to a tenant and a single role (`tenant_admin`, `tenant_user`, or `platform_admin`).
3. RLS on tenant-scoped tables enforces the tenant boundary.
4. Route handlers make role-based decisions, but the model is coarse: a user is either an admin or a user.

**Pain points:**

- There is no safe way for a `tenant_user` to let a colleague view a watchlist without promoting that colleague to `tenant_admin`.
- Connector credential authority is already ownership-tier-aware, but the UI and API checks are limited to the two coarse roles.
- Feature enablement is not tenant-configurable, which prevents staged rollouts or plan-specific capabilities.
- The audit log records privileged actions, but permission changes are not yet expressed as a structured matrix.

---

## 7. Future State (To-Be)

**New or improved process:**

1. Authentication and RLS continue exactly as today.
2. Each request is additionally evaluated against a permission matrix that maps role and resource to an allowed action.
3. `requirePermission(resource, action)` is called in route handlers before performing privileged operations.
4. A `tenant_user` can share a watchlist with another `tenant_user` as `read` or `edit`.
5. A `tenant_user` can create user-bound credentials for OAuth connectors but cannot create or configure tenant-wide credentials.
6. A `tenant_admin` can create tenant-wide credentials and configure any connector in the tenant.
7. `Platform-Admin` and, where allowed, `Tenant-Admin` can toggle `tenant_settings.feature_gates` to enable or disable tenant-level features.
8. The workspace settings UI exposes Users, Roles, Sharing, and Features tabs with seat usage and limits.

**Expected capabilities:**

- Fine-grained, auditable sharing of watchlists.
- Tiered connector administration that preserves the existing ownership model.
- Tenant-scoped feature gating for trials and plan differentiation.
- An extendable permission matrix that supports future custom roles.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall enforce a permission matrix for `tenant_admin` and `tenant_user` across users, connectors, watchlists, alerts, posts, analytics, settings, exports, and DSR. | Must | Matrix matches ADR-0107 §1; contract tests verify allowed and denied actions. | Backend Engineer |
| BR-002 | `tenant_admin` shall be able to manage all tenant users, connectors, watchlists, and settings. | Must | Admin can invite, revoke, create tenant-wide credentials, and view all watchlists. | Product Owner |
| BR-003 | `tenant_user` shall be able to create user-bound credentials only for connectors whose `authMode` is `oauth`. | Must | Contract tests confirm user-bound OAuth activation succeeds and tenant-wide activation is denied. | Backend Engineer |
| BR-004 | `tenant_user` shall be able to share their own watchlists with another `tenant_user` with `read` or `edit` permission. | Must | `watchlist_shares` table records share, permission, and timestamp; shared watchlist is usable by recipient. | Backend Engineer |
| BR-005 | `tenant_admin` shall be able to view and manage all watchlists in the tenant. | Must | Admin can list, open, and revoke shares on any watchlist. | Product Owner |
| BR-006 | The system shall support `tenant_settings.feature_gates` as a JSONB field enabling or disabling features per tenant. | Must | Gate changes are persisted and observable in `GET /v1/tenants/:id/settings` and workspace UI. | Backend Engineer |
| BR-007 | `Platform-Admin` shall be able to set feature gates for any tenant. | Must | Platform admin gate changes are recorded in the platform admin audit log. | Product Owner |
| BR-008 | `Tenant-Admin` shall be able to set feature gates for their own tenant when platform policy allows. | Must | Allowed gates are editable; disallowed gates are read-only. | Product Owner |
| BR-009 | The system shall provide a `requirePermission(resource, action)` helper for use in route handlers. | Must | All privileged endpoints use the helper; denied actions return 403. | Backend Engineer |
| BR-010 | The system shall enforce `max_seats` on user invite and accept. | Must | Invites beyond the seat limit are rejected; usage is visible in workspace settings. | Backend Engineer |
| BR-011 | The admin UI shall provide a `WorkspaceSettingsView` with Users, Roles, Sharing, and Features tabs. | Should | Tabs allow invite/deactivate, watchlist sharing, and feature-gate visibility. | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Permission checks must fail closed and cannot bypass RLS. | Security | Must | Denied actions return 403; RLS still enforces tenant isolation. |
| NFR-002 | Every role change, watchlist share, connector activation/deactivation, and feature-gate change must be recorded in an audit log. | Compliance | Must | Audit log entries are immutable and queryable by `Platform-Admin`. |
| NFR-003 | Permission resolution must add no more than 10 ms latency per request. | Performance | Should | Measured in production-like load tests. |
| NFR-004 | Workspace settings must be usable by a non-technical tenant administrator. | Usability | Should | Usability walkthrough with a tenant admin persona passes. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | `tenant_user` is the default role for all newly invited tenant users. |
| BRU-002 | `tenant_admin` has `manage` or `manage_all` permission on users, connectors, watchlists, alerts, settings, exports, and DSR. |
| BRU-003 | `tenant_user` has `none` permission on users, `activate_own` on connectors, `own` on watchlists and alerts, `read` on posts, analytics, and settings, `own` on exports, and `create_own` on DSR. |
| BRU-004 | A `tenant_user` can share a watchlist only with another `tenant_user` in the same tenant. |
| BRU-005 | `read` permission on a shared watchlist allows viewing and using it; `edit` permission also allows modifying the query. |
| BRU-006 | `tenant_admin` can create, configure, and deactivate any connector; `tenant_user` can create user-bound credentials for OAuth connectors and can deactivate only their own user-bound connectors. |
| BRU-007 | `tenant_admin` can deactivate any connector; `tenant_user` can deactivate only user-bound connectors they created. |
| BRU-008 | Feature gates in `tenant_settings.feature_gates` are set by `Platform-Admin` for all tenants and may be set by `Tenant-Admin` for their own tenant only where the platform policy allows. |
| BRU-009 | `requirePermission(resource, action)` must be evaluated in addition to, not instead of, RLS. |
| BRU-010 | `max_seats` must be checked before an invitation is sent and again before the invite is accepted. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Permission matrix | Role × resource × action mapping, e.g. `tenant_user.connectors = 'activate_own'` | ADR-0107 | Product / Security | High |
| `watchlist_shares` | Records `watchlist_id`, `shared_with_user_id`, `permission` (`read`/`edit`), `shared_by_user_id`, `shared_at` | ADR-0107 | Backend Engineering | High |
| `tenant_settings.feature_gates` | JSONB field storing per-tenant enabled/disabled feature flags | ADR-0107 | Backend Engineering | Medium |
| `users.role` | Tenant-scoped role value (`tenant_admin` or `tenant_user`) | Existing users table | Backend Engineering | High |
| `connectors.authMode` and ownership tier | Distinguishes `oauth` user-bound activation from tenant-wide credential ownership | ADR-0028 / ADR-0051 | Backend Engineering | High |
| `tenants.max_seats` | Seat limit enforced on user invites and accepts | Existing tenant settings | Product / Backend Engineering | Medium |
| `platform_admin_audit_log` | Immutable record of privileged actions, including role and feature-gate changes | Existing platform admin audit table | Platform Engineering | High |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Permission-denied events | Detect misconfigured roles or attempted privilege escalation | Security / Platform-Admin | Real-time alert, daily summary |
| Active shared watchlists | Measure collaboration adoption | Product team | Weekly |
| Connector activations by ownership tier | Track user-bound vs. tenant-wide credential growth | Product team | Weekly |
| Feature-gate changes | Audit trial rollouts and plan changes | Product / Legal | Real-time log, monthly report |
| Seat usage vs. `max_seats` | Support billing and capacity planning | Platform-Admin / Sales | Daily |
| Role assignment changes | Support compliance and customer support | Legal-Advisor / Platform-Admin | Real-time log, monthly report |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The v1 permission matrix may be too coarse for some enterprise buyers. | Medium | Medium | Position as v1; custom roles and per-connector visibility are explicitly deferred to v2. | Product Owner |
| R-002 | A bug in the application-layer permission check could allow cross-tenant or cross-user access. | Low | High | Keep RLS as the primary tenant boundary; fail closed; contract-test every privileged endpoint. | Backend Engineer |
| R-003 | Users may share watchlists with unintended recipients or permissions. | Medium | Medium | UI requires explicit `read` or `edit` selection; `tenant_admin` can revoke shares; audit log is queryable. | Product Owner |
| R-004 | Feature-gate misconfiguration could disable revenue-critical capabilities. | Low | High | Restrict `Tenant-Admin` edits to gates the platform policy allows; log all changes; provide platform admin override. | Platform-Admin |
| R-005 | Seat-limit enforcement may block legitimate invites during growth. | Medium | Low | Show real-time seat usage and allow in-app upgrade flow to raise `max_seats`. | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0032 (users and invites) | Predecessor | Product / Backend | Accepted; existing implementation |
| D-002 | ADR-0044 (watchlist ownership) | Predecessor | Backend | Accepted; existing implementation |
| D-003 | ADR-0028 (connector credentials) | Predecessor | Backend | Accepted; existing implementation |
| D-004 | ADR-0051 (connector activation) | Predecessor | Backend | Accepted; existing implementation |
| D-005 | Story 12.13 — Multi-user workspaces and RBAC permissions (backend) | Implementation | Backend | Ready |
| D-006 | Story 12.14 — RBAC and workspace settings UI (frontend) | Implementation | Frontend | Ready (depends on Story 12.13) |
| D-007 | `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` | Reference | Product | Available |
| D-008 | `docs/product-research/feature-adr-scoping.md` | Reference | Product | Available |

---

## 14. Acceptance Criteria

- The `watchlist_shares` table exists with `read` and `edit` permission support.
- `requirePermission(resource, action)` is used in all relevant route handlers and returns 403 for disallowed actions.
- `tenant_user` can create user-bound connectors for OAuth connectors and cannot create tenant-wide connectors.
- `tenant_admin` can create, configure, and deactivate tenant-wide connectors.
- `tenant_settings.feature_gates` (JSONB) supports per-tenant feature toggles and is observable in the workspace settings UI.
- `Platform-Admin` can set feature gates for any tenant; `Tenant-Admin` can edit only the gates the platform allows for their own tenant.
- Seat limit (`max_seats`) is enforced on user invite and accept, with usage shown in the workspace settings UI.
- The `WorkspaceSettingsView` provides Users, Roles, Sharing, and Features tabs.
- `Tenant-Admin` can invite, deactivate, and assign roles; `Tenant-Admin` can configure watchlist sharing per list.
- All contract-test targets for RBAC, sharing, and feature gating pass.

---

## 15. Glossary

| Term | Definition |
|---|---|
| RBAC | Role-based access control: granting permissions based on assigned roles. |
| RLS | Row-level security: the database-level tenant isolation mechanism in Postgres. |
| Permission matrix | A table mapping roles to allowed actions on each resource type. |
| `tenant_admin` | The administrative role for a single tenant. |
| `tenant_user` | The default, non-administrative user role within a tenant. |
| `platform_admin` | A platform-level identity with cross-tenant operational privileges. |
| `watchlist_shares` | Table recording that a watchlist has been shared with another user and at what permission level. |
| Feature gate | A per-tenant flag that enables or disables a product capability. |
| User-bound connector | A connector credential activated by and belonging to an individual user. |
| Tenant-wide connector | A connector credential activated at the tenant level and usable by the whole tenant. |
| DSR | Data subject request, e.g. access or erasure requests. |
| BYPASSRLS | A Postgres role attribute that bypasses row-level security, used only by platform admin paths. |

---

## 16. Appendices

### 16.1 Reference documents

- [ADR-0107: Multi-user workspaces and RBAC permissions](../../../adr/0107-multi-user-workspaces-and-rbac-permissions.md)
- [Feature design: Multi-user workspaces and RBAC](../../../product-research/feature-designs/12-multi-user-workspaces-and-rbac.md)
- [Feature-to-ADR Scoping Plan](../../../product-research/feature-adr-scoping.md)
- [Epic 12: Foundation depth and AI refinements (ADRs 0101–0108)](../../../user-stories/epic-12-adr-0101-to-0108.md)

### 16.2 Related user stories

- **Story 12.13** — Multi-user workspaces and RBAC permissions (backend)
- **Story 12.14** — RBAC and workspace settings UI (frontend)

### 16.3 Missing sources

- No `docs/product-research/reports/<feature>-deep-research.md` file was found for this feature. This BRD was produced from the ADR, feature design, feature-adr-scoping plan, and related user stories only.

### 16.4 Related ADRs

- ADR-0032: Users and invites
- ADR-0044: Watchlist ownership
- ADR-0028: Connector credentials
- ADR-0051: Connector activation

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
