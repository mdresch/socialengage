# ADR-0112: Feature gating and seat-limit enforcement

**Status:** Proposed (2026-08-23)

**Authorizes:** the `tenant_settings.feature_gates` schema, the per-plan feature allowlist, and the seat-limit enforcement that keeps `active_seat_count` within the tenant's plan.

**Source:** `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` and `docs/product-research/feature-adr-scoping.md`

---

## Context

### 1. Workspaces need plan and feature boundaries
`docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md` and the `Tenant-Admin` profile require a way to gate features by plan and to enforce how many users can be active in a tenant.

### 2. `tenants.active_seat_count` already exists
`SKILL.md` for `tenants` and `ADR-0032` established the `active_seat_count` column. This ADR specifies how it is enforced and how `feature_gates` interacts with seat limits.

### 3. The product is not yet multi-plan
A single plan is in use today, but the architecture must support gating so future plans can be added without rewrites.

---

## Decision

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

## Consequences

1. **Plan-based monetization:** the product can support multiple paid tiers without code changes.
2. **Predictable capacity:** seat limits prevent a single tenant from over-consuming.
3. **Feature safety:** risky or costly features can be gated per tenant.
4. **Admin UX:** `Tenant-Admin` sees which features are available and how many seats are in use.

---

## Alternatives considered

1. **Store feature gates in a separate `tenant_plans` table.**
   - *Rejected:* a `PLANS` const plus `tenants.plan` and `feature_gates` is simpler. A separate table is overkill for a single-tenant plan system.

2. **Enforce seat limits only on user creation, not on invite.**
   - *Rejected:* it can lead to a race where many invites exceed the limit. The check is on both invite and accept.

3. **Allow `Tenant-Admin` to set `max_seats` for their own tenant.**
   - *Rejected:* it would bypass billing. `Platform-Admin` owns plan changes and `max_seats`.

---

## Open questions

- Should `Tenant-Admin` see an upgrade path in the UI when they hit a gate or seat limit?
- How are historical users who exceed a new lower `max_seats` handled? Grandfathered or forced to deactivate?
- Should `Platform-Admin` be able to override a gate for a single tenant without changing the plan?
- How are feature gates exposed in the OpenAPI spec?

---

## Footnotes

- Related feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Related scoping: `docs/product-research/feature-adr-scoping.md`
- Related ADRs: `ADR-0032` (users and invites), `ADR-0107` (RBAC permissions), `ADR-0030` (Platform-Admin boundary)
