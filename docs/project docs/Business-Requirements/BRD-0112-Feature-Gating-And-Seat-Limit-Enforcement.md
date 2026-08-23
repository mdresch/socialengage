# Business Requirements Document — Feature Gating and Seat-Limit Enforcement

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Business Requirements Document: Feature Gating and Seat-Limit Enforcement |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Draft (source ADR-0112 is Proposed; this BRD is for review and may change) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0112, feature design 12, and Epic 13 stories |

---

## 2. Executive Summary

SocialEngage must support multiple paid tiers and workspace capacity without exposing every feature to every tenant. Today the product has one plan, so feature gating and seat enforcement are not yet business-critical; however, the architecture needs to support paid plans before multi-plan sales begin.

The proposed initiative adds a `feature_gates` configuration and `max_seats` enforcement to each tenant, driven by the tenant's selected plan. Platform-Administrators will assign plans and control which features are available, while Tenant-Administrators will see which features are enabled and how many active seats are in use. Backend route handlers will use a gating helper to block unavailable features, and seat limits will be checked on every user invite and acceptance.

Because the source ADR-0112 is still **Proposed**, this BRD is a draft for review and is expected to change before implementation begins.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable plan-based monetization so future tiers can be sold without re-architecture | New paid plans can be added by updating platform-level configuration only |
| 2 | Protect shared platform capacity by enforcing per-tenant seat limits | No tenant can exceed its `max_seats` through invite or user acceptance flows |
| 3 | Reduce exposure of risky or costly features until a tenant is entitled to them | Gated features are hidden or disabled in the UI and rejected at the API boundary |
| 4 | Improve transparency for Tenant-Administrators | Tenant-Admin can view current plan, enabled features, and used/max seats |

---

## 4. Scope

### 4.1 In Scope

- Adding `feature_gates` and `plan` fields to the tenant record.
- Defining platform-level plan configurations (e.g., starter, pro, enterprise) that map to `max_seats` and a feature allowlist.
- Enforcing `active_seat_count < max_seats` on user invite and acceptance.
- Providing a backend gating check for REST endpoints and an endpoint that exposes the tenant's current settings to the UI.
- Allowing Platform-Administrators to assign and change a tenant's plan.
- Allowing Tenant-Administrators to view plan, feature availability, and seat usage.
- Hiding or disabling gated features in the admin UI and showing upgrade messaging when a limit is reached.
- Grandfathering existing active users when a plan is downgraded to a lower `max_seats`.

### 4.2 Out of Scope

- Per-connector, per-watchlist, or per-user fine-grained permissions.
- Payment, invoicing, or billing-system integration.
- Automatic deactivation of users when `max_seats` is reduced.
- User impersonation or break-glass flows beyond the existing ADR-0030 mechanism.
- Public API documentation or OpenAPI generation of gate definitions.

### 4.3 Assumptions

- The product currently uses a single plan, so gating is forward-looking.
- `active_seat_count` already exists and is maintained by the user lifecycle defined in ADR-0032.
- Role resolution and RLS are already in place (ADR-0107, ADR-0030).
- `Platform-Admin` is responsible for plan and seat-limit changes, not `Tenant-Admin`.

### 4.4 Constraints

- No separate `tenant_plans` table; plans are stored as platform-level configuration.
- Seat enforcement must be race-safe for concurrent invites.
- All changes must respect existing RLS and identity-resolution rules.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Platform-Admin | Primary | High | Assign plans, adjust feature gates, view seat usage, maintain audit trail |
| Tenant-Admin | Primary | High | Invite users within seat limit, see enabled features, understand upgrade path |
| Legal / Compliance Advisor | Primary | Medium | Defensible log of plan changes and access decisions |
| Tenant-User | Secondary | Medium | Use only features available to the tenant; not see administrative screens |
| Product / Pricing Lead | Secondary | High | Ability to launch new paid tiers without code changes |
| Support Team | Secondary | Medium | Clear seat-usage and feature-availability diagnostics |

---

## 6. Current State (As-Is)

Multi-user workspaces and RBAC are already built: tenants, users, `resolveIdentity()`, RLS on every tenant-scoped table, and the `platform_admin_audit_log` exist. `tenants.active_seat_count` is populated as users move through the invite and activation lifecycle.

However, there is no per-tenant feature gating, no plan field, and no enforcement of a maximum seat count at invite or acceptance time. All tenants currently receive the same feature set, and the product cannot offer differentiated paid tiers or protect platform capacity.

**Pain points:**
- No way to sell or enforce tiered plans.
- No protection against a tenant inviting more users than its tier allows.
- Costly or beta features cannot be selectively enabled.
- Tenant administrators cannot see why a feature is unavailable or how many seats are in use.

---

## 7. Future State (To-Be)

Each tenant carries a `plan` identifier and a `feature_gates` configuration. Platform-Administrators assign plans and trigger feature-gate updates. When a `Tenant-Admin` or `Platform-Admin` invites a user, the system verifies that `active_seat_count < max_seats`; if the tenant is at capacity, the request is rejected with a clear business error. When an invited user accepts and becomes active, `active_seat_count` is incremented; it is decremented on deactivation or removal.

Gated endpoints are protected by a `requireFeatureGate` check. The UI fetches the tenant's settings and hides or disables unavailable features while showing upgrade messaging at capacity or gate boundaries. Reducing `max_seats` below the current number of active users does not deactivate anyone; new invitations are simply blocked until the count falls back within the limit.

**Expected capabilities:**
- Plan assignment with automatic feature-gate initialization.
- Seat-limit enforcement on invite and acceptance.
- API- and UI-level feature gating.
- Tenant-level visibility into plan, seats, and enabled features.
- Upgrade prompts when a seat or feature limit is reached.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support a per-tenant `feature_gates` configuration that includes an `max_seats` value and an on/off flag for each billed or gated capability. | Must | `tenants.feature_gates` exists as non-nullable structured configuration; `max_seats` is a positive integer; all named features are present. | Product Owner |
| BR-002 | The system shall enforce that `active_seat_count` must remain below `max_seats` on user invite and acceptance. | Must | Invite or accept is rejected when the tenant is at capacity; `active_seat_count` increments on activation and decrements on deactivation/removal. | Backend Lead |
| BR-003 | The system shall provide a gating check for REST endpoints that rejects calls to disabled features. | Must | A disabled feature returns a consistent 403-style business error; an enabled feature is allowed through. | Backend Lead |
| BR-004 | The system shall allow a Platform-Administrator to assign or change a tenant's plan, which updates the tenant's `plan` and `feature_gates`. | Must | Plan change persists and immediately reflects in the tenant's feature allowlist and seat limit. | Product Owner |
| BR-005 | The system shall expose the tenant's current plan, feature-gate values, and seat usage to authorized callers. | Should | A tenant-scoped settings endpoint returns the current `plan`, `feature_gates`, and used/max seat count. | Frontend/Backend Lead |
| BR-006 | The admin UI shall hide or disable features that are gated off for the current tenant. | Should | Gated navigation items, buttons, and screens are not reachable or are visually disabled. | Frontend Lead |
| BR-007 | The UI shall display upgrade or contact-admin messaging when a user encounters a seat or feature limit. | Could | A clear, business-friendly message is shown when an invite or feature access is blocked by a gate or seat limit. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Seat enforcement must be race-safe under concurrent invite attempts. | Reliability | Must | Contract tests demonstrate that concurrent invites cannot push `active_seat_count` above `max_seats`. |
| NFR-002 | Feature gating must not bypass tenant identity resolution or RLS. | Security | Must | Gate checks rely on the resolved tenant and role; no anonymous or cross-tenant access is permitted. |
| NFR-003 | Plan changes must be auditable and must not directly modify `active_seat_count`. | Compliance | Should | Every plan change is recorded in the `platform_admin_audit_log`; `active_seat_count` is only changed through the user lifecycle. |
| NFR-004 | Gated UI states must remain accessible (e.g., screen-reader announcements for disabled controls). | Usability | Should | Hidden and disabled features are communicated to assistive technologies and remain keyboard-navigable. |
| NFR-005 | New plans must be addable without code changes. | Maintainability | Must | Adding a new tier requires only an update to the platform-level plan configuration. |

---

## 9. Business Rules

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

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `tenants.feature_gates` | JSONB storing per-tenant enabled flags and `max_seats` | ADR-0112 | Backend | Commercial / Tenant configuration |
| `tenants.plan` | Text identifier mapping to a platform plan definition | ADR-0112 | Backend | Commercial / Tenant configuration |
| `tenants.active_seat_count` | Count of active tenant users (already in use) | ADR-0032 | Backend | Internal |
| `users.status` | User lifecycle status (e.g., active, invited, deactivated) | Existing users table | Backend | Internal |
| `platform_admin_audit_log` | Immutable record of plan and gate changes | ADR-0030 | Platform / Compliance | Audit / Legal |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Seats used vs. maximum per tenant | Capacity planning, billing verification, and support triage | Platform-Admin, Finance | Real-time / On demand |
| Feature availability by plan | Pricing-tier validation and product analytics | Product, Finance | Monthly |
| Seat-limit rejection count | Abuse detection and upgrade-conversion tracking | Support, Product | Daily / Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Source ADR-0112 is Proposed; requirements may change before acceptance. | High | Medium | Treat this BRD as a draft; revalidate sections after the ADR is accepted or revised. | Product Owner |
| R-002 | Concurrent invites could race past `max_seats`. | Medium | High | Implement an atomic check-and-increment or equivalent transactional enforcement; cover in contract tests. | Backend Lead |
| R-003 | Downgrading `max_seats` below current active users may confuse tenants. | Medium | Medium | Provide clear UI messaging explaining grandfathering and the upgrade path. | Product / UX Lead |
| R-004 | The plan/gate model may not cover all future pricing needs. | Low | High | Keep the configuration structure simple and extensible; review with Product before adding plans. | Architect |
| R-005 | Feature gating could conflict with existing role-based access controls. | Medium | Medium | Align gate checks with `resolveIdentity` and RLS; test cross-tenant and cross-role boundaries. | Security Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0032 (users and invites) — `active_seat_count` semantics and user lifecycle | Internal | Accepted | N/A — required for seat enforcement. |
| D-002 | ADR-0107 (RBAC permissions) — identity resolution and role gating | Internal | Accepted | N/A — required for gate authorization. |
| D-003 | ADR-0030 (Platform-Admin boundary) — privileged admin actions and audit log | Internal | Accepted | N/A — required for plan changes. |
| D-004 | Feature design `12-multi-user-workspaces-and-rbac.md` | Internal | Accepted | N/A — context for this initiative. |
| D-005 | Feature-ADR scoping plan `feature-adr-scoping.md` | Internal | Accepted | N/A — establishes this ADR as chunk B of feature 12. |
| D-006 | Story 13.5 (backend feature gating and seat enforcement) | Internal | TBD | Must be built before Story 13.6 (UI). |

---

## 14. Acceptance Criteria

1. The `tenants` record includes `feature_gates` and `plan` columns that match the ADR's schema.
2. A gating helper exists and blocks calls to endpoints whose feature is disabled for the caller's tenant.
3. User invite and acceptance flows check `active_seat_count < max_seats` before succeeding.
4. `max_seats` is enforced at invite time; existing active users are never automatically deactivated by a plan downgrade.
5. Plan definitions are configurable at the platform level and can be extended without code changes.
6. A `Platform-Admin` can assign and change a tenant's plan, and the change is reflected in the tenant's `feature_gates`.
7. A `Tenant-Admin` can view the current plan, seat usage, and the list of available features.
8. Gated features are hidden or disabled in the admin UI.
9. Upgrade or contact-admin messaging is shown when a seat or feature limit is hit.
10. All changes are covered by contract tests that exercise seat-limit, gating, and plan-change scenarios.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `feature_gates` | Per-tenant configuration that controls which features are enabled and the tenant's `max_seats`. |
| `max_seats` | The maximum number of active tenant users allowed for a tenant. |
| `active_seat_count` | The number of users currently active within a tenant. |
| `plan` | A platform-level tier identifier (e.g., starter, pro, enterprise) that maps to a feature allowlist and a seat limit. |
| Platform-Admin | A privileged role that manages tenants, plans, and platform-level configuration. |
| Tenant-Admin | A role within a tenant that manages users, connectors, and watchlists. |
| `requireFeatureGate` | The backend gating check that rejects access to a disabled feature. |
| Gated feature | A capability that can be enabled or disabled per tenant through `feature_gates`. |
| Seat limit | The business rule that restricts the number of active users in a tenant. |

---

## 16. Appendices

- **Appendix A — Source ADR:** `docs/adr/0112-feature-gating-and-seat-limit-enforcement.md`
- **Appendix B — Related feature design:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- **Appendix C — Related scoping plan:** `docs/product-research/feature-adr-scoping.md`
- **Appendix D — Related user stories:** `docs/user-stories/epic-13-adr-0109-to-0117.md`
  - Story 13.5 — Feature gating and seat-limit enforcement (backend)
  - Story 13.6 — Plan and seat management UI (frontend)
- **Appendix E — Missing material:** No matching `docs/product-research/reports/<feature>-deep-research.md` file was found; this BRD was synthesized from the ADR, feature design, scoping plan, and user stories.
- **Appendix F — Related ADRs:** ADR-0032, ADR-0107, ADR-0030

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
