# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Business Requirements Document: Feature Gating and Seat-Limit Enforcement |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (source ADR-0112 is Proposed; this BRD is for review and may change)) |
| Related Documents | ADR-0112, BRD-0112, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

SocialEngage must support multiple paid tiers and workspace capacity without exposing every feature to every tenant. Today the product has one plan, so feature gating and seat enforcement are not yet business-critical; however, the architecture needs to support paid plans before multi-plan sales begin.

This FDD translates the accepted architecture and business requirements from ADR-0112 and BRD-0112 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Adding `feature_gates` and `plan` fields to the tenant record.
- Defining platform-level plan configurations (e.g., starter, pro, enterprise) that map to `max_seats` and a feature allowlist.
- Enforcing `active_seat_count < max_seats` on user invite and acceptance.
- Providing a backend gating check for REST endpoints and an endpoint that exposes the tenant's current settings to the UI.
- Allowing Platform-Administrators to assign and change a tenant's plan.
- Allowing Tenant-Administrators to view plan, feature availability, and seat usage.
- Hiding or disabling gated features in the admin UI and showing upgrade messaging when a limit is reached.
- Grandfathering existing active users when a plan is downgraded to a lower `max_seats`.
- **Out of scope:** - Per-connector, per-watchlist, or per-user fine-grained permissions.
- Payment, invoicing, or billing-system integration.
- Automatic deactivation of users when `max_seats` is reduced.
- User impersonation or break-glass flows beyond the existing ADR-0030 mechanism.
- Public API documentation or OpenAPI generation of gate definitions.
- **Assumptions and constraints:** - The product currently uses a single plan, so gating is forward-looking.
- `active_seat_count` already exists and is maintained by the user lifecycle defined in ADR-0032.
- Role resolution and RLS are already in place (ADR-0107, ADR-0030).
- `Platform-Admin` is responsible for plan and seat-limit changes, not `Tenant-Admin`.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. Workspaces need plan and feature boundaries
`docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` and the `Tenant-Admin` profile require a way to gate features by plan and to enforce how many users can be active in a tenant.

### 2. `tenants.active_seat_count` already exists
`SKILL.md` for `tenants` and `ADR-0032` established the `active_seat_count` column. This ADR specifies how it is enforced and how `feature_gates` interacts with seat limits.

### 3. The product is not yet multi-plan
A single plan is in use today, but the architecture must support gating so future plans can be added without rewrites.

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable plan-based monetization so future tiers can be sold without re-architecture | New paid plans can be added by updating platform-level configuration only |
| 2 | Protect shared platform capacity by enforcing per-tenant seat limits | No tenant can exceed its `max_seats` through invite or user acceptance flows |
| 3 | Reduce exposure of risky or costly features until a tenant is entitled to them | Gated features are hidden or disabled in the UI and rejected at the API boundary |
| 4 | Improve transparency for Tenant-Administrators | Tenant-Admin can view current plan, enabled features, and used/max seats |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support a per-tenant `feature_gates` configuration that includes an `max_seats` value and an on/off flag for each billed or gated capability. | Must | `tenants.feature_gates` exists as non-nullable structured configuration; `max_seats` is a positive integer; all named features are present. | Product Owner |
| BR-002 | The system shall enforce that `active_seat_count` must remain below `max_seats` on user invite and acceptance. | Must | Invite or accept is rejected when the tenant is at capacity; `active_seat_count` increments on activation and decrements on deactivation/removal. | Backend Lead |
| BR-003 | The system shall provide a gating check for REST endpoints that rejects calls to disabled features. | Must | A disabled feature returns a consistent 403-style business error; an enabled feature is allowed through. | Backend Lead |
| BR-004 | The system shall allow a Platform-Administrator to assign or change a tenant's plan, which updates the tenant's `plan` and `feature_gates`. | Must | Plan change persists and immediately reflects in the tenant's feature allowlist and seat limit. | Product Owner |
| BR-005 | The system shall expose the tenant's current plan, feature-gate values, and seat usage to authorized callers. | Should | A tenant-scoped settings endpoint returns the current `plan`, `feature_gates`, and used/max seat count. | Frontend/Backend Lead |
| BR-006 | The admin UI shall hide or disable features that are gated off for the current tenant. | Should | Gated navigation items, buttons, and screens are not reachable or are visually disabled. | Frontend Lead |
| BR-007 | The UI shall display upgrade or contact-admin messaging when a user encounters a seat or feature limit. | Could | A clear, business-friendly message is shown when an invite or feature access is blocked by a gate or seat limit. | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform-Admin | Primary | High | Assign plans, adjust feature gates, view seat usage, maintain audit trail |
| Tenant-Admin | Primary | High | Invite users within seat limit, see enabled features, understand upgrade path |
| Legal / Compliance Advisor | Primary | Medium | Defensible log of plan changes and access decisions |
| Tenant-User | Secondary | Medium | Use only features available to the tenant; not see administrative screens |
| Product / Pricing Lead | Secondary | High | Ability to launch new paid tiers without code changes |
| Support Team | Secondary | Medium | Clear seat-usage and feature-availability diagnostics |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| 13.5 | backend engineer | `tenant_settings.feature_gates` and `max_seats` enforcement, | the product can support paid plans and workspace limits. | `tenants` has `feature_gates` JSONB and `plan` columns.; `requireFeatureGate(feature)` helper blocks gated endpoints.; User invite and accept check `active_seat_count < max_seats`. |
| 13.6 | `Platform-Admin` | a plan and feature-gate management page for each tenant, | I can set limits and enable features. | `TenantPlanView` lets `Platform-Admin` set `plan` and `feature_gates`.; `Tenant-Admin` sees current plan, seat usage, and available features.; Gated features are hidden or disabled in the UI. |

### 6.3 Workflow Diagrams / Steps

### 1. `tenant_settings` table and `feature_gates` JSONB
```sql
ALTER TABLE tenants ADD COLUMN feature_gates jsonb NOT NULL DEFAULT '{
  "ai_assist": true,
  "analytics_dashboard": true,
  "multi_user": true,
  "api_access": true,
  "webhooks": false,
  "crisis_templates": false,
  "compliance_packs": false,
  "dsr_portal": false,
  "rag_search": false,
  "max_seats": 5
}';
```

- `feature_gates` is set by `Platform-Admin` on tenant creation or plan change.
- `Tenant-Admin` can view but not override gates unless `allow_tenant_admin_feature_gates` is true.
- `max_seats` is a number and is part of `feature_gates`.

### 2. Seat limit enforcement
- On invite (`POST /v1/tenants/:id/invite`), the system checks `active_seat_count < max_seats`.
- If at capacity, the request returns `403 SEAT_LIMIT_EXCEEDED`.
- `active_seat_count` is incremented when an invited user accepts and `status='active'`.
- It is decremented when a user is deactivated or removed.
- `Tenant-Admin` and `Platform-Admin` do not count toward `active_seat_count`? No, all `tenant_user` roles count. `Platform-Admin` is not a tenant user.

### 3. Feature gating checks
- A `requireFeatureGate(feature)` helper is added to route handlers.
- If the feature is `false`, the endpoint returns `403 FEATURE_NOT_AVAILABLE`.
- The UI fetches `GET /v1/tenants/me/settings` to hide or disable gated features.

### 4. Plan definitions
```ts
const PLANS = {
  starter: {
    max_seats: 3,
    feature_gates: { ai_assist: true, analytics_dashboard: true, multi_user: false, ... }
  },
  pro: {
    max_seats: 25,
    feature_gates: { multi_user: true, api_access: true, webhooks: true, ... }
  },
  enterprise: {
    max_seats: 100,
    feature_gates: { crisis_templates: true, compliance_packs: true, ... }
  }
};
```

- Plans are platform-level configuration.
- A `plan` column on `tenants` maps to `PLANS` and initializes `feature_gates`.

### 5. Billing and seat changes
- `Platform-Admin` can change a tenant's plan, which updates `plan` and `feature_gates`.
- If `max_seats` is reduced below `active_seat_count`, existing active users are not deactivated. New invites are blocked until `active_seat_count <= max_seats`.

---

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.feature_gates` | JSONB storing per-tenant enabled flags and `max_seats` | ADR-0112 | Backend | Commercial / Tenant configuration |
| `tenants.plan` | Text identifier mapping to a platform plan definition | ADR-0112 | Backend | Commercial / Tenant configuration |
| `tenants.active_seat_count` | Count of active tenant users (already in use) | ADR-0032 | Backend | Internal |
| `users.status` | User lifecycle status (e.g., active, invited, deactivated) | Existing users table | Backend | Internal |
| `platform_admin_audit_log` | Immutable record of plan and gate changes | ADR-0030 | Platform / Compliance | Audit / Legal |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | All `tenant_user` roles count toward `active_seat_count`; `Platform-Admin` is not a tenant user and does not count. |
| BRU-002 | `feature_gates` is set by a `Platform-Admin` on tenant creation or plan change; `Tenant-Admin` may view but not override gates unless explicitly authorized. |
| BRU-003 | `max_seats` is treated as part of `feature_gates` and is always a positive integer. |
| BRU-004 | If `max_seats` is reduced below the current `active_seat_count`, existing active users remain active; new invitations are blocked until `active_seat_count <= max_seats`. |
| BRU-005 | A disabled feature gate causes the corresponding API endpoint to return a 403-style `FEATURE_NOT_AVAILABLE` error and the UI to hide or disable the feature. |
| BRU-006 | Plan definitions are platform-level configuration; a tenant's `plan` value maps to a defined plan. |
| BRU-007 | `active_seat_count` increments when an invited user becomes active and decrements when a user is deactivated or removed. |

---

---

## 9. Interfaces and Integrations

### 1. `tenant_settings` table and `feature_gates` JSONB
```sql
ALTER TABLE tenants ADD COLUMN feature_gates jsonb NOT NULL DEFAULT '{
  "ai_assist": true,
  "analytics_dashboard": true,
  "multi_user": true,
  "api_access": true,
  "webhooks": false,
  "crisis_templates": false,
  "compliance_packs": false,
  "dsr_portal": false,
  "rag_search": false,
  "max_seats": 5
}';
```

- `feature_gates` is set by `Platform-Admin` on tenant creation or plan change.
- `Tenant-Admin` can view but not override gates unless `allow_tenant_admin_feature_gates` is true.
- `max_seats` is a number and is part of `feature_gates`.

### 2. Seat limit enforcement
- On invite (`POST /v1/tenants/:id/invite`), the system checks `active_seat_count < max_seats`.
- If at capacity, the request returns `403 SEAT_LIMIT_EXCEEDED`.
- `active_seat_count` is incremented when an invited user accepts and `status='active'`.
- It is decremented when a user is deactivated or removed.
- `Tenant-Admin` and `Platform-Admin` do not count toward `active_seat_count`? No, all `tenant_user` roles count. `Platform-Admin` is not a tenant user.

### 3. Feature gating checks
- A `requireFeatureGate(feature)` helper is added to route handlers.
- If the feature is `false`, the endpoint returns `403 FEATURE_NOT_AVAILABLE`.
- The UI fetches `GET /v1/tenants/me/settings` to hide or disable gated features.

### 4. Plan definitions
```ts
const PLANS = {
  starter: {
    max_seats: 3,
    feature_gates: { ai_assist: true, analytics_dashboard: true, multi_user: false, ... }
  },
  pro: {
    max_seats: 25,
    feature_gates: { multi_user: true, api_access: true, webhooks: true, ... }
  },
  enterprise: {
    max_seats: 100,
    feature_gates: { crisis_templates: true, compliance_packs: true, ... }
  }
};
```

- Plans are platform-level configuration.
- A `plan` column on `tenants` maps to `PLANS` and initializes `feature_gates`.

### 5. Billing and seat changes
- `Platform-Admin` can change a tenant's plan, which updates `plan` and `feature_gates`.
- If `max_seats` is reduced below `active_seat_count`, existing active users are not deactivated. New invites are blocked until `active_seat_count <= max_seats`.

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Seat enforcement must be race-safe under concurrent invite attempts. | Reliability | Must | Contract tests demonstrate that concurrent invites cannot push `active_seat_count` above `max_seats`. |
| NFR-002 | Feature gating must not bypass tenant identity resolution or RLS. | Security | Must | Gate checks rely on the resolved tenant and role; no anonymous or cross-tenant access is permitted. |
| NFR-003 | Plan changes must be auditable and must not directly modify `active_seat_count`. | Compliance | Should | Every plan change is recorded in the `platform_admin_audit_log`; `active_seat_count` is only changed through the user lifecycle. |
| NFR-004 | Gated UI states must remain accessible (e.g., screen-reader announcements for disabled controls). | Usability | Should | Hidden and disabled features are communicated to assistive technologies and remain keyboard-navigable. |
| NFR-005 | New plans must be addable without code changes. | Maintainability | Must | Adding a new tier requires only an update to the platform-level plan configuration. |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Source ADR-0112 is Proposed; requirements may change before acceptance. | High | Medium | Treat this BRD as a draft; revalidate sections after the ADR is accepted or revised. | Product Owner |
| R-002 | Concurrent invites could race past `max_seats`. | Medium | High | Implement an atomic check-and-increment or equivalent transactional enforcement; cover in contract tests. | Backend Lead |
| R-003 | Downgrading `max_seats` below current active users may confuse tenants. | Medium | Medium | Provide clear UI messaging explaining grandfathering and the upgrade path. | Product / UX Lead |
| R-004 | The plan/gate model may not cover all future pricing needs. | Low | High | Keep the configuration structure simple and extensible; review with Product before adding plans. | Architect |
| R-005 | Feature gating could conflict with existing role-based access controls. | Medium | Medium | Align gate checks with `resolveIdentity` and RLS; test cross-tenant and cross-role boundaries. | Security Lead |

---

---

## 12. Assumptions and Dependencies

- The product currently uses a single plan, so gating is forward-looking.
- `active_seat_count` already exists and is maintained by the user lifecycle defined in ADR-0032.
- Role resolution and RLS are already in place (ADR-0107, ADR-0030).
- `Platform-Admin` is responsible for plan and seat-limit changes, not `Tenant-Admin`.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0032 (users and invites) — `active_seat_count` semantics and user lifecycle | Internal | Accepted | N/A — required for seat enforcement. |
| D-002 | ADR-0107 (RBAC permissions) — identity resolution and role gating | Internal | Accepted | N/A — required for gate authorization. |
| D-003 | ADR-0030 (Platform-Admin boundary) — privileged admin actions and audit log | Internal | Accepted | N/A — required for plan changes. |
| D-004 | Feature design `12-multi-user-workspaces-and-rbac.md` | Internal | Accepted | N/A — context for this initiative. |
| D-005 | Feature-ADR scoping plan `feature-adr-scoping.md` | Internal | Accepted | N/A — establishes this ADR as chunk B of feature 12. |
| D-006 | Story 13.5 (backend feature gating and seat enforcement) | Internal | TBD | Must be built before Story 13.6 (UI). |

---

---

## 13. Open Questions

- Should `Tenant-Admin` see an upgrade path in the UI when they hit a gate or seat limit?
- How are historical users who exceed a new lower `max_seats` handled? Grandfathered or forced to deactivate?
- Should `Platform-Admin` be able to override a gate for a single tenant without changing the plan?
- How are feature gates exposed in the OpenAPI spec?

---

---

## 14. Appendix

### Reference Documents

- ADR-0112: `docs/adr/0112-feature-gating-and-seat-limit-enforcement.md`
- BRD-0112: `docs/project docs/Business-Requirements/BRD-0112-Feature-Gating-And-Seat-Limit-Enforcement.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- User stories: `docs/user-stories/epic-13-adr-0109-to-0117.md`

### Missing Sources Noted

- No matching deep-research report found in `docs/product-research/reports/`.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0112 and BRD-0112. |