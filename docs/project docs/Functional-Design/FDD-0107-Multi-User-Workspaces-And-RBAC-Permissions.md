# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0107 Multi-User Workspaces and RBAC Permissions — Functional Design Document |
| Version | 0.2 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Agent (derived from ADR-0107, BRD-0107, feature design 12) |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft — ADR-0107 is currently **Proposed**, not Accepted; this FDD is a draft for review and may change once the ADR is accepted |
| Related Documents | ADR-0107, BRD-0107, `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`, Story 12.13, Story 12.14, ADR-0032, ADR-0044, ADR-0028, ADR-0051 |

---

## 2. Purpose and Scope

### 2.1 Purpose

**Note (draft status):** ADR-0107 is Proposed, not Accepted. This FDD translates the proposed decision into a functional design so implementation can be scoped and estimated, but the permission matrix and endpoints below may still change before acceptance.

Today's RBAC is a coarse `tenant_admin` / `tenant_user` split. The only way for a `tenant_user` to give a colleague visibility into a watchlist, or for anyone but an admin to touch a connector, is to promote that person to `tenant_admin` — an over-privileged workaround. This document defines the functional behavior of a fine-grained, resource-scoped permission matrix; per-watchlist sharing between users; ownership-tier-aware connector permissions; per-tenant feature gating; and the `requirePermission(resource, action)` application-layer gate that sits alongside (never replaces) RLS.

### 2.2 Scope

**In scope:**
- The `tenant_admin` / `tenant_user` (and reserved future `analyst`) permission matrix across users, connectors, watchlists, alerts, posts, analytics, settings, exports, DSR.
- `watchlist_shares` table and per-watchlist `read`/`edit` sharing between tenant users.
- Per-connector permission rules distinguishing tenant-wide (admin-managed) vs. user-bound OAuth (self-managed) credentials.
- `tenant_settings.feature_gates` (JSONB) set by Platform-Admin, and by Tenant-Admin where policy allows.
- `requirePermission(resource, action)` application-layer permission helper used in route handlers, in addition to RLS.
- `max_seats` enforcement on user invite and accept.
- `WorkspaceSettingsView` (Users, Roles, Sharing, Features tabs).

**Out of scope:**
- Custom roles (`analyst`, `social_care_agent`) — reserved for v2.
- Full attribute-based access control (ABAC) or Entra-group-based permissions.
- Tenant-admin impersonation of tenant users.
- Multi-tenant/agency login (one user across multiple client tenants).
- Per-connector *visibility* restriction by individual user (all tenant users still see tenant connectors; only activation rights are tiered).

### 2.3 Target Audience

Backend engineers implementing the permission matrix, sharing table, and permission helper (Story 12.13); frontend engineers building `WorkspaceSettingsView` (Story 12.14); QA authoring RLS-plus-permission contract tests; Tenant Admins managing users/sharing/gates; Platform Admins setting cross-tenant feature gates.

---

## 3. Context and Background

RLS already enforces the tenant boundary on every tenant-scoped table (ADR-0015), and `resolveIdentity()` already maps an authenticated caller to a tenant and a single coarse role (`tenant_admin`, `tenant_user`, or `platform_admin`, ADR-0032). Watchlists are already individually owned and private by default (ADR-0044); connectors already distinguish tenant-wide vs. user-bound credential ownership (ADR-0028, ADR-0051). What's missing is anything *between* "full admin" and "read-only own stuff": a `tenant_user` cannot share a watchlist without being promoted, and there's no tenant-configurable way to stage feature rollouts.

This design layers an explicit, resource-scoped permission matrix and sharing mechanism on top of the existing tenant/role/ownership model, without weakening RLS as the primary isolation boundary — permission checks fail closed and are additive, never a substitute for RLS.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Reduce over-privileged sharing | A `tenant_user` can share a watchlist read-only without being promoted to `tenant_admin` |
| G2 | Enforce least privilege for connectors | No `tenant_user` can create/configure a tenant-wide credential; only user-bound OAuth activation is available to them |
| G3 | Enable staged feature rollouts | `tenant_settings.feature_gates` is settable and observable per tenant |
| G4 | Improve governance/audit readiness | Every role change, watchlist share, connector activation, and feature-gate change is recorded in an audit log |
| G5 | Prepare for future custom roles | The permission matrix structure supports adding new roles without re-architecting security |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: Permission matrix and `requirePermission()`

- **Description:** A static role × resource × action mapping, enforced by a reusable helper in every privileged route handler.
- **Triggers:** Any request touching a permission-gated resource (users, connectors, watchlists, alerts, posts, analytics, settings, exports, DSR).
- **Inputs:** The resolved caller's role, the target resource type, and the requested action.
- **Processing:**
  - `tenant_admin`: `manage`/`manage_all` on users, connectors, watchlists, alerts, settings, exports, DSR; `read_all` on posts and analytics.
  - `tenant_user`: `none` on users, `activate_own` on connectors, `own` on watchlists/alerts/exports, `read` on posts/analytics/settings, `create_own` on DSR.
  - `analyst` (reserved, v2): `none` on connectors, `read_shared` on watchlists, `read` on posts/analytics, `own` on exports — defined in the matrix now but not assignable in v1.
  - `requirePermission(resource, action)` is called before performing the privileged operation and denies (fails closed) any action not explicitly granted by the matrix.
  - RLS remains the primary tenant-scoping mechanism; `requirePermission` is an additional application-layer gate, never a replacement (BRU-009).
- **Outputs:** The request proceeds if permitted; otherwise a `403` response.
- **Error handling:** Any ambiguous or unmapped role/resource/action combination denies by default (fail closed), never fails open.
- **Edge cases:** A `tenant_admin` request against a resource scoped to *another* tenant is still blocked by RLS even though the permission matrix alone would allow `manage_all` — the two layers are independent and both must pass.

### 5.2 Feature / Capability: Per-watchlist sharing

- **Description:** Lets a watchlist owner share their (private-by-default) watchlist with another tenant user at a chosen permission level.
- **Triggers:** A `tenant_user` shares their own watchlist via the workspace/watchlist UI or API; a `tenant_admin` views or manages any watchlist's shares.
- **Inputs:** `watchlist_id`, `shared_with_user_id`, `permission ('read'|'edit')`.
- **Processing:**
  - A `tenant_user` may share only a watchlist they own, and only with another `tenant_user` in the same tenant (BRU-004).
  - `read` permission allows viewing and using the watchlist; `edit` additionally allows modifying its query (BRU-005).
  - A `watchlist_shares` row records `watchlist_id`, `shared_with_user_id`, `permission`, `shared_by_user_id`, `shared_at`.
  - `tenant_admin` can view and manage (including revoke) shares on any watchlist in the tenant, regardless of ownership.
- **Outputs:** The recipient gains the granted access level to the shared watchlist; the share is visible to both the owner and any `tenant_admin`.
- **Error handling:** Attempting to share with a user outside the tenant, or to grant `edit` on a watchlist the caller does not own, is rejected.
- **Edge cases:** Revoking a share immediately removes the recipient's access on their next request (no cached/stale grant).

### 5.3 Feature / Capability: Per-connector permissions

- **Description:** Governs who can create, configure, and deactivate connector credentials, respecting the existing ownership-tier model.
- **Triggers:** A user attempts to activate, configure, or deactivate a connector.
- **Inputs:** The caller's role, the connector's `authMode`, and (for deactivation) the credential's ownership (tenant-wide vs. user-bound).
- **Processing:**
  - `tenant_admin` can create tenant-wide credentials for any connector, configure connector settings (rate limits, API keys), and deactivate any connector.
  - `tenant_user` can create user-bound credentials only for connectors whose `authMode` is `'oauth'`; they cannot create or configure tenant-wide credentials.
  - `tenant_user` can deactivate only the user-bound connectors they themselves created (BRU-007); they cannot deactivate another user's or the tenant's connectors.
- **Outputs:** A created/configured/deactivated connector credential, scoped per the rules above.
- **Error handling:** A `tenant_user` attempting to create a tenant-wide credential, configure connector settings, or deactivate a connector they don't own is denied with `403`.
- **Edge cases:** A connector whose `authMode` is not `oauth` cannot be user-bound-activated at all — a `tenant_user` has no path to activate it, only `tenant_admin` does.

### 5.4 Feature / Capability: Per-tenant feature gating

- **Description:** Lets features be enabled/disabled per tenant for staged rollout or plan differentiation.
- **Triggers:** Platform-Admin or (where policy allows) Tenant-Admin toggles a feature gate.
- **Inputs:** `tenant_settings.feature_gates` (JSONB) key/value updates.
- **Processing:** `Platform-Admin` may set feature gates for any tenant. `Tenant-Admin` may set feature gates only for their own tenant, and only for gates the platform policy marks as tenant-editable; other gates remain read-only to the Tenant-Admin (BRU-008).
- **Outputs:** Updated `tenant_settings.feature_gates`, observable via `GET /v1/tenants/:id/settings` and the workspace Features tab.
- **Error handling:** A Tenant-Admin attempting to edit a platform-locked gate is denied (or the control is presented as read-only) rather than silently no-op'd.
- **Edge cases:** A feature gate toggled off mid-session should stop granting access to the gated feature on the next request, without requiring a logout.

### 5.5 Feature / Capability: Seat-limit enforcement

- **Description:** Caps the number of active users per tenant according to `max_seats`.
- **Triggers:** A user invite is sent; an invite is accepted.
- **Inputs:** The tenant's current active-user count and `max_seats`.
- **Processing:** The seat count is checked before an invitation is sent, and checked again before the invite is accepted (BRU-010) — a race between two concurrent invites/accepts must not allow the tenant to exceed `max_seats`.
- **Outputs:** The invite/accept proceeds if under the limit; usage (`current / max_seats`) is visible in workspace settings.
- **Error handling:** An invite or accept that would exceed `max_seats` is rejected with a clear seat-limit error, not a generic failure.
- **Edge cases:** A user who is deactivated (freeing a seat) allows the next invite/accept to succeed even if a prior attempt was rejected while the seat was still occupied.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Platform-Admin | Manages tenants, seats, and platform-level feature gates |
| Tenant-Admin | Manages the tenant workspace, users, connectors, and watchlists |
| Tenant-User | Creates watchlists, reviews posts, shares within permitted limits |
| Legal-Advisor | Reviews the audit trail for compliance |
| Backend Engineer | Implements permission logic and data model |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 12.13) | backend engineer | per-watchlist sharing, per-connector permissions, and a permission matrix | `Tenant-Admin` can control who can do what | `watchlist_shares` with `read`/`edit`; `tenant_settings.feature_gates` supports per-tenant toggles; `requirePermission(resource, action)` used in route handlers; `tenant_user` creates user-bound connectors, `tenant_admin` creates tenant-wide; `max_seats` enforced on invite and accept |
| US2 (Story 12.14) | Tenant-Admin | a workspace settings page for users, roles, watchlist sharing, and feature gates | I can manage seats and permissions | `WorkspaceSettingsView` with Users/Roles/Sharing/Features tabs; invite/deactivate/assign roles; watchlist sharing configurable per list; feature gates visible (read-only or editable per policy); seat usage/limit shown |

### 6.3 Workflow Diagrams / Steps

**Watchlist sharing workflow:**
1. A `tenant_user` opens their watchlist and chooses "Share."
2. They select a recipient (another `tenant_user` in the same tenant) and a permission level (`read` or `edit`).
3. The system verifies the caller owns the watchlist and the recipient is a valid tenant user, then inserts a `watchlist_shares` row.
4. The recipient's next watchlist list/detail request reflects the new access.

**Connector activation workflow:**
1. A `tenant_user` attempts to activate a connector.
2. `requirePermission('connectors', 'activate_own')` checks the connector's `authMode`.
3. If `authMode === 'oauth'`, a user-bound credential is created for that user; otherwise the action is denied and the user is directed to ask a `tenant_admin`.
4. A `tenant_admin` performing the same action can instead create a tenant-wide credential or configure connector settings.

**Feature gate workflow:**
1. Platform-Admin (or a policy-permitted Tenant-Admin) opens the Features tab.
2. They toggle a gate; the system checks whether the caller's role is permitted to edit that specific gate.
3. `tenant_settings.feature_gates` is updated and the change is recorded in the audit log.
4. Subsequent requests reflect the new gate state immediately.

**Seat-limit workflow:**
1. A Tenant-Admin invites a new user.
2. The system checks current seat usage against `max_seats` before sending the invite.
3. If under the limit, the invite is sent; the invitee later accepts, and the seat count is re-checked before finalizing.
4. Workspace settings display current usage vs. the limit at all times.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Role assignments on `users.role`.
- Watchlist sharing requests (`watchlist_id`, `shared_with_user_id`, `permission`).
- Connector activation/configuration/deactivation requests, with `authMode` and ownership context.
- Feature-gate toggle requests.
- User invite/accept requests against `tenants.max_seats`.

### 7.2 Data Outputs

- `403` responses for denied actions; successful state changes otherwise.
- `watchlist_shares` rows reflecting active sharing relationships.
- `tenant_settings.feature_gates` reflecting current per-tenant toggles.
- Audit log entries for every role change, share, connector activation/deactivation, and feature-gate change.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| Permission matrix (code/config, not persisted as rows) | Role → resource → action mapping (e.g., `tenant_user.connectors = 'activate_own'`) | Evaluated by `requirePermission()` against `users.role` |
| `watchlist_shares` | `watchlist_id`, `shared_with_user_id`, `permission ('read'\|'edit')`, `shared_by_user_id`, `shared_at` | References `watchlists` and `users`; tenant-scoped via the referenced watchlist's tenant |
| `tenant_settings.feature_gates` (JSONB field) | Key/value map of feature flag → enabled/disabled, with per-gate tenant-editability metadata | Embedded in existing `tenant_settings`; edited by Platform-Admin or policy-permitted Tenant-Admin |
| `users.role` (existing) | `tenant_admin` \| `tenant_user` (v1); `analyst` reserved for v2 | Drives the permission matrix lookup |
| `connectors` / credentials (existing, ADR-0028/0051) | `authMode`, ownership tier (tenant-wide vs. user-bound), owning user (if user-bound) | Referenced by connector permission checks |
| `tenants.max_seats` (existing) | Seat limit | Checked against active user count on invite/accept |
| `platform_admin_audit_log` (existing) | Immutable record of privileged actions including role/share/connector/gate changes | Referenced for compliance reporting |

### 7.4 Validation Rules

- `tenant_user` is the default role for all newly invited users (BRU-001).
- `tenant_admin` has `manage`/`manage_all` across users, connectors, watchlists, alerts, settings, exports, DSR (BRU-002).
- `tenant_user` permissions are exactly as specified in the matrix — `none` on users, `activate_own` on connectors, `own` on watchlists/alerts/exports, `read` on posts/analytics/settings, `create_own` on DSR (BRU-003).
- A watchlist can be shared only with another `tenant_user` in the same tenant (BRU-004).
- Shared `read` allows view/use; shared `edit` also allows query modification (BRU-005).
- `tenant_admin` may create/configure/deactivate any connector; `tenant_user` may create user-bound OAuth credentials and deactivate only their own (BRU-006, BRU-007).
- Feature gates are Platform-Admin-editable for any tenant, and Tenant-Admin-editable for their own tenant only where policy allows (BRU-008).
- `requirePermission` checks are additive to RLS, never a substitute (BRU-009).
- `max_seats` is checked at both invite time and accept time (BRU-010).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | Permission checks fail closed on any unmapped role/resource/action | `requirePermission()` |
| BR2 | RLS remains the primary tenant boundary; permission checks are additive | All privileged endpoints |
| BR3 | A watchlist owner may grant `read` or `edit` only to another same-tenant `tenant_user` | Watchlist sharing |
| BR4 | `tenant_admin` can view/manage shares on any watchlist in the tenant | Watchlist sharing |
| BR5 | `tenant_user` connector creation is limited to user-bound OAuth credentials | Connector permissions |
| BR6 | `tenant_user` may deactivate only connectors they personally activated | Connector permissions |
| BR7 | Feature-gate edit rights depend on both caller role and per-gate platform policy | Feature gating |
| BR8 | Seat limit is enforced at both invite and accept, closing the race window | Seat-limit enforcement |
| BR9 | Every role change, share, connector action, and gate change is audit-logged | Audit logging |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `requirePermission(resource, action)` (backend helper) | Internal | Application-layer permission gate used in route handlers | Internal function call |
| RLS (Postgres) | Internal | Primary tenant isolation, independent of and beneath the permission layer | SQL row-level security policies |
| `watchlist_shares` table | Read/Write | Persists sharing relationships | SQL, tenant-scoped |
| `tenant_settings.feature_gates` | Read/Write | Persists per-tenant feature toggles | JSONB field |
| `GET /v1/tenants/:id/settings` | Inbound API | Exposes feature-gate state | REST/JSON |
| Connector activation/configuration endpoints (existing, ADR-0028/0051) | Internal | Gated by the new per-connector permission rules | REST/JSON |
| `platform_admin_audit_log` | Write | Records privileged action history | SQL, immutable |
| `WorkspaceSettingsView` (admin UI) | Internal | Users, Roles, Sharing, Features tabs | React UI calling the above APIs |

---

## 10. Non-Functional Considerations

- **Performance:** Permission resolution adds no more than 10 ms latency per request (NFR-003).
- **Security / access control:** Permission checks fail closed and cannot bypass RLS (NFR-001); this is the primary security property of the whole design.
- **Compliance / audit:** Every role change, watchlist share, connector activation/deactivation, and feature-gate change is recorded in an immutable, Platform-Admin-queryable audit log (NFR-002).
- **Usability:** Workspace settings must be usable by a non-technical Tenant-Admin (NFR-004).
- **Extensibility:** The matrix structure is designed so future custom roles (`analyst`, `social_care_agent`) can be added without re-architecting the security model.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| A `tenant_user` attempts an action not granted by the matrix (e.g., manage users) | `403 Forbidden` | Request denied before any state change; RLS is never relied on alone to block it |
| A `tenant_user` shares a watchlist they do not own, or with a user outside the tenant | Validation/authorization error | Share rejected; no `watchlist_shares` row created |
| A `tenant_user` attempts to create a tenant-wide connector credential | `403 Forbidden` | Denied; only user-bound OAuth activation is available to them |
| A `tenant_user` attempts to deactivate a connector they did not activate | `403 Forbidden` | Denied |
| A Tenant-Admin attempts to edit a platform-locked feature gate | Read-only / denied | Gate value unchanged; UI presents it as non-editable |
| An invite or accept would exceed `max_seats` | Seat-limit error with current usage shown | Invite/accept rejected; no user/seat created |

---

## 12. Assumptions and Dependencies

**Assumptions:**
- Entra External ID, `resolveIdentity()`, and RLS on every tenant table are already operational (ADR-0032, ADR-0015).
- Watchlists are already individually owned and private by default (ADR-0044).
- Connectors already distinguish tenant-wide from user-bound credential ownership (ADR-0028, ADR-0051).

**Dependencies:**
- ADR-0032 (users and invites) — accepted, existing implementation.
- ADR-0044 (watchlist ownership) — accepted, existing implementation.
- ADR-0028 (connector credentials) — accepted, existing implementation.
- ADR-0051 (connector activation) — accepted, existing implementation.
- Story 12.13 (backend) and Story 12.14 (frontend), both currently Blocked pending ADR-0107 acceptance.

**Pending decisions:** ADR-0107 is Proposed; open questions below must be resolved before or during Story 12.13/12.14 implementation.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should `tenant_user` be able to invite other `tenant_user`s, or only `tenant_admin`? | Product Owner | Before Story 12.13 implementation |
| Q2 | How are default permissions for new `tenant_user`s configured — a tenant-wide default? | Product Owner | Before Story 12.13 implementation |
| Q3 | Should `watchlist_shares` support sharing to a group, or only individual users? | Product Owner | Post-v1 |
| Q4 | How does feature gating interact with Platform-Admin billing-tier changes? | Product Owner | Before Story 12.13 implementation |

---

## 14. Appendix

### Glossary

| Term | Definition |
|---|---|
| RBAC | Role-based access control: granting permissions based on assigned roles. |
| RLS | Row-level security: the database-level tenant isolation mechanism in Postgres. |
| Permission matrix | A mapping of roles to allowed actions on each resource type. |
| `watchlist_shares` | Table recording that a watchlist has been shared with another user and at what permission level. |
| Feature gate | A per-tenant flag that enables or disables a product capability. |
| User-bound connector | A connector credential activated by and belonging to an individual user. |
| Tenant-wide connector | A connector credential activated at the tenant level, usable by the whole tenant. |

### Reference links

- ADR-0107: `docs/adr/0107-multi-user-workspaces-and-rbac-permissions.md` (Proposed)
- BRD-0107: `docs/project docs/Business-Requirements/BRD-0107-Multi-User-Workspaces-And-RBAC-Permissions.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Related ADRs: ADR-0032 (users and invites), ADR-0044 (watchlist ownership), ADR-0028 (connector credentials), ADR-0051 (connector activation)
- Related user stories: Story 12.13 (backend), Story 12.14 (frontend) — `docs/user-stories/epic-12-adr-0101-to-0108.md`

### Missing sources

- No `docs/product-research/reports/12-multi-user-workspaces-and-rbac-deep-research.md` deep-research brief was found for this feature.

### Revision history

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.2 | 2026-08-23 | FDD Writer Agent | Regenerated with a real per-capability Section 5 breakdown, data model, and workflow detail, replacing the prior defective BRD-table copy |
