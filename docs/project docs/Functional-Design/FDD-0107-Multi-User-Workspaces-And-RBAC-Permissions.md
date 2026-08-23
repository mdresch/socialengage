# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage — Multi-User Workspaces and RBAC Permissions |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0107, BRD-0107, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

SocialEngage currently protects tenant data with row-level security (RLS) and a coarse role split between `tenant_admin` and `tenant_user`. This protects the tenant boundary, but it does not let a tenant delegate responsibilities safely: the only way to share a watchlist or allow someone to manage a connector is to grant full admin access. This over-privileging increases the risk of accidental data exposure, limits team collaboration, and makes the product less attractive to enterprise buyers who expect least-privilege access.

This FDD translates the accepted architecture and business requirements from ADR-0107 and BRD-0107 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A permission matrix for `tenant_admin`, `tenant_user`, and the deferred `analyst` role across resources such as users, connectors, watchlists, alerts, posts, analytics, settings, exports, and DSR.
- Per-watchlist sharing between tenant users with `read` and `edit` permission levels.
- A `watchlist_shares` table to record the sharing relationship, permission, and audit trail.
- Per-connector permission rules distinguishing tenant-wide credentials (managed by `tenant_admin`) from user-bound OAuth credentials (managed by the creating `tenant_user`).
- Per-tenant feature gating through `tenant_settings.feature_gates` (JSONB), set by `Platform-Admin` and optionally by `Tenant-Admin` where platform policy allows.
- Application-layer `requirePermission(resource, action)` checks in route handlers, used in addition to RLS.
- Enforcement of seat limits (`max_seats`) on user invite and accept.
- A workspace settings UI for user/role management, watchlist sharing configuration, and feature-gate visibility.
- **Out of scope:** - Custom roles such as `analyst` and `social_care_agent` in v1; these are v2 features.
- Full attribute-based access control (ABAC) or Entra group-based permissions.
- Tenant admin impersonation of tenant users.
- Multi-tenant / agency login where one user belongs to multiple client tenants.
- Per-connector *visibility* restrictions by individual user in v1; all tenant users still see tenant connectors, but activation rights are tiered.
- **Assumptions and constraints:** - Entra External ID, `resolveIdentity()`, RLS on every tenant table, and the existing `tenant_admin` / `tenant_user` / `platform_admin` role split are already operational.
- Watchlists are already owned by an individual user and private by default (ADR-0044).
- Connectors already distinguish tenant-wide credentials from user-bound credentials (ADR-0028, ADR-0051).

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. The current RBAC is coarse
`docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` describes richer workspaces. Today the product has `tenant_admin` and `tenant_user` (ADR-0032). The product needs finer-grained permissions for connectors, watchlists, and features.

### 2. Watchlists are already personal (ADR-0044)
Watchlists are owned by a user and private by default. This ADR adds explicit sharing and read-only access for `tenant_user`s.

### 3. Connectors and credentials are ownership-tier aware
`ADR-0028` and `ADR-0051` established tenant-wide vs. user-bound activation. This ADR adds permission roles for who can activate, configure, and deactivate connectors.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Reduce over-privileged sharing inside a tenant | Tenant users can share watchlists read-only without being promoted to `tenant_admin` |
| 2 | Enforce least privilege for connector administration | No `tenant_user` can create or configure tenant-wide connector credentials; only user-bound OAuth credentials are permitted |
| 3 | Enable staged feature rollouts per tenant | `tenant_settings.feature_gates` is settable and observable in the workspace settings UI |
| 4 | Improve governance and audit readiness | Every role change, watchlist share, connector activation, and feature-gate change is recorded in an audit log |
| 5 | Prepare the product for enterprise RBAC | Permission matrix is structured so that future custom roles can be added without re-architecting security |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform-Admin | Manages tenants, seats, and platform-level feature gates | High | Create/suspend tenants, adjust seat counts, query audit logs without accessing tenant data |
| Tenant-Admin | Manages the tenant workspace and users | High | Invite/revoke users, assign roles, manage connectors and watchlists, and avoid administrative mistakes |
| Tenant-User | Daily user creating watchlists and reviewing posts | Medium | Access only the connectors, watchlists, and features they need; share when appropriate |
| Legal-Advisor | Compliance and audit reviewer | Medium | Produce a defensible trail of every role change, approval, and export action |
| Backend Engineer | Implements permission logic and data model | High | Clear matrix, testable rules, and stable contracts |
| Product Owner | Prioritizes scope and acceptance | High | Enterprise-ready RBAC without overbuilding v1 |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 12.13 | backend engineer | per-watchlist sharing, per-connector permissions, and a permission matrix, | `Tenant-Admin` can control who can do what. | `watchlist_shares` table with `read` and `edit` permission.; `tenant_settings.feature_gates` supports per-tenant feature toggles.; Permission helpers (`requirePermission(resource, action)`) are used in route handlers. |
| 12.14 | `Tenant-Admin` | a workspace settings page for users, roles, watchlist sharing, and feature gates, | I can manage seats and permissions. | `WorkspaceSettingsView` with `Users`, `Roles`, `Sharing`, and `Features` tabs.; `Tenant-Admin` can invite, deactivate, and assign roles.; Watchlist sharing is configurable per list. |

### 6.3 Workflow Diagrams / Steps

### 1. Permission matrix
```ts
const PERMISSIONS = {
  'tenant_admin': {
    users: 'manage',
    connectors: 'manage',
    watchlists: 'manage_all',
    alerts: 'manage_all',
    posts: 'read_all',
    analytics: 'read_all',
    settings: 'manage',
    exports: 'manage',
    dsr: 'manage',
  },
  'tenant_user': {
    users: 'none',
    connectors: 'activate_own',       // user-bound credentials
    watchlists: 'own',
    alerts: 'own',
    posts: 'read',
    analytics: 'read',
    settings: 'read',
    exports: 'own',
    dsr: 'create_own',
  },
  // future custom role
  'analyst': {
    connectors: 'none',
    watchlists: 'read_shared',
    posts: 'read',
    analytics: 'read',
    exports: 'own',
  }
};
```

### 2. `tenant_user` role remains the v1 default
- `tenant_user` is the default role.
- Custom roles (`analyst`, `social_care_agent`) are v2 features.

### 3. Per-watchlist sharing
```sql
watchlist_shares (
  watchlist_id uuid,
  shared_with_user_id uuid,
  permission text,            -- 'read' | 'edit'
  shared_by_user_id uuid,
  shared_at timestamptz
);
```

- A `tenant_user` can share their watchlist with another `tenant_user`.
- `tenant_admin` can view and manage all watchlists.
- `read` permission allows viewing and using the watchlist; `edit` allows modifying the query.

### 4. Per-connector permissions
- `tenant_admin` can create tenant-wide credentials for any connector.
- `tenant_user` can create user-bound credentials for connectors with `authMode: 'oauth'`.
- `tenant_admin` can deactivate any connector; `tenant_user` can deactivate only their own user-bound connectors.
- `tenant_admin` can configure connector settings (rate limits, API keys); `tenant_user` cannot.

### 5. Feature gating
- `tenant_settings.feature_gates` is a JSONB field that enables/disables features per tenant.
- `Platform-Admin` can set feature gates for a tenant.
- `Tenant-Admin` can set feature gates for their own tenant where the platform allows it.

### 6. Permission checks
- `requirePermission(resource, action)` helper for use in route handlers.
- RLS remains the primary tenant-scoping mechanism.
- Permission checks are an additional application-layer gate, not a replacement for RLS.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. Permission matrix
```ts
const PERMISSIONS = {
  'tenant_admin': {
    users: 'manage',
    connectors: 'manage',
    watchlists: 'manage_all',
    alerts: 'manage_all',
    posts: 'read_all',
    analytics: 'read_all',
    settings: 'manage',
    exports: 'manage',
    dsr: 'manage',
  },
  'tenant_user': {
    users: 'none',
    connectors: 'activate_own',       // user-bound credentials
    watchlists: 'own',
    alerts: 'own',
    posts: 'read',
    analytics: 'read',
    settings: 'read',
    exports: 'own',
    dsr: 'create_own',
  },
  // future custom role
  'analyst': {
    connectors: 'none',
    watchlists: 'read_shared',
    posts: 'read',
    analytics: 'read',
    exports: 'own',
  }
};
```

### 2. `tenant_user` role remains the v1 default
- `tenant_user` is the default role.
- Custom roles (`analyst`, `social_care_agent`) are v2 features.

### 3. Per-watchlist sharing
```sql
watchlist_shares (
  watchlist_id uuid,
  shared_with_user_id uuid,
  permission text,            -- 'read' | 'edit'
  shared_by_user_id uuid,
  shared_at timestamptz
);
```

- A `tenant_user` can share their watchlist with another `tenant_user`.
- `tenant_admin` can view and manage all watchlists.
- `read` permission allows viewing and using the watchlist; `edit` allows modifying the query.

### 4. Per-connector permissions
- `tenant_admin` can create tenant-wide credentials for any connector.
- `tenant_user` can create user-bound credentials for connectors with `authMode: 'oauth'`.
- `tenant_admin` can deactivate any connector; `tenant_user` can deactivate only their own user-bound connectors.
- `tenant_admin` can configure connector settings (rate limits, API keys); `tenant_user` cannot.

### 5. Feature gating
- `tenant_settings.feature_gates` is a JSONB field that enables/disables features per tenant.
- `Platform-Admin` can set feature gates for a tenant.
- `Tenant-Admin` can set feature gates for their own tenant where the platform allows it.

### 6. Permission checks
- `requirePermission(resource, action)` helper for use in route handlers.
- RLS remains the primary tenant-scoping mechanism.
- Permission checks are an additional application-layer gate, not a replacement for RLS.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Permission checks must fail closed and cannot bypass RLS. | Security | Must | Denied actions return 403; RLS still enforces tenant isolation. |
| NFR-002 | Every role change, watchlist share, connector activation/deactivation, and feature-gate change must be recorded in an audit log. | Compliance | Must | Audit log entries are immutable and queryable by `Platform-Admin`. |
| NFR-003 | Permission resolution must add no more than 10 ms latency per request. | Performance | Should | Measured in production-like load tests. |
| NFR-004 | Workspace settings must be usable by a non-technical tenant administrator. | Usability | Should | Usability walkthrough with a tenant admin persona passes. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | The v1 permission matrix may be too coarse for some enterprise buyers. | Medium | Medium | Position as v1; custom roles and per-connector visibility are explicitly deferred to v2. | Product Owner |
| R-002 | A bug in the application-layer permission check could allow cross-tenant or cross-user access. | Low | High | Keep RLS as the primary tenant boundary; fail closed; contract-test every privileged endpoint. | Backend Engineer |
| R-003 | Users may share watchlists with unintended recipients or permissions. | Medium | Medium | UI requires explicit `read` or `edit` selection; `tenant_admin` can revoke shares; audit log is queryable. | Product Owner |
| R-004 | Feature-gate misconfiguration could disable revenue-critical capabilities. | Low | High | Restrict `Tenant-Admin` edits to gates the platform policy allows; log all changes; provide platform admin override. | Platform-Admin |
| R-005 | Seat-limit enforcement may block legitimate invites during growth. | Medium | Low | Show real-time seat usage and allow in-app upgrade flow to raise `max_seats`. | Product Owner |

---

---

## 12. Assumptions and Dependencies

- Entra External ID, `resolveIdentity()`, RLS on every tenant table, and the existing `tenant_admin` / `tenant_user` / `platform_admin` role split are already operational.
- Watchlists are already owned by an individual user and private by default (ADR-0044).
- Connectors already distinguish tenant-wide credentials from user-bound credentials (ADR-0028, ADR-0051).

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

---

## 13. Open Questions

- Should `tenant_user` be able to invite other `tenant_user`s, or only `tenant_admin`?
- How are default permissions for new `tenant_user`s configured? Tenant-wide default?
- Should `watchlist_shares` support sharing to a group or only individual users?
- How does feature gating interact with `Platform-Admin` billing tier changes?

---

---

## 14. Appendix

### Reference Documents

- ADR-0107: `docs/adr/0107-multi-user-workspaces-and-rbac-permissions.md`
- BRD-0107: `docs/project docs/Business-Requirements/BRD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- User stories: `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0107 and BRD-0107. |