---
name: plan-management
description: Plan and seat management UI for Platform-Admin editing and Tenant-Admin viewing of tenant plan, max_seats, and feature gates. Read this before touching /tenant/plan, /platform-admin/tenants/[tenantId]/plan, or the plan components under src/components/plan/.
---

# Plan and seat management

## What this is

Story 13.6 (ADR-0112) adds the UI for viewing and editing a tenant's `plan`,
`feature_gates`, and seat ceiling:

- `/tenant/plan` is a Server Component for any resolved `tenant_user` identity.
  It reads `GET /v1/tenants/plan` and shows the current plan, used/max/active
  seats, effective feature gates, and upgrade messaging when a seat or feature
  limit is hit.
- `/platform-admin/tenants/:tenantId/plan` is a Server Component for
  `platform_admin` identities. It reads `GET /v1/admin/tenants/:tenantId/plan`
  and mounts `TenantPlanForm`, a Client Component that lets the Platform-Admin
  change the plan, max seats, and individual feature gates.
- Reusable components live under `src/components/plan/`: `PlanSelector`,
  `FeatureToggleList`, and `SeatUsageCard`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0112 | `tenants.plan`, `tenants.feature_gates`, `max_seats`, and `requireFeatureGate(feature)` | 13.5 (backend) |
| ADR-0112 | Platform-Admin assigns/changes plan and feature_gates; Tenant-Admin views them | 13.6 (this UI) |
| ADR-0036 | `core-client.ts` is the sole bearer-token attachment choke point | 6.1 |
| ADR-0030 | Platform-Admin boundary; no tenant-content on the platform admin console | 6.6 |

## Contracts that constrain this component

- `contracts/epic-13/story-13.6.plan-and-seat-management-ui.contract.test.ts` —
  encodes the tenant view, the platform-admin view/edit form, the reusable
  components, the BFF proxy routes, and the `core-client.ts` additions.

## Files that make this work

- `src/app/tenant/plan/page.tsx`
- `src/app/platform-admin/tenants/[tenantId]/plan/page.tsx`
- `src/app/platform-admin/tenants/[tenantId]/plan/TenantPlanForm.tsx`
- `src/components/plan/PlanSelector.tsx`
- `src/components/plan/FeatureToggleList.tsx`
- `src/components/plan/SeatUsageCard.tsx`
- `src/lib/core-client.ts` — `TenantPlanView`, `getMyPlan()`, `getAdminTenantPlan()`,
  and the extended `updateAdminTenant()` input
- `src/app/api/admin/tenants/[tenantId]/route.ts` — PATCH proxy
- `src/app/api/admin/tenants/[tenantId]/plan/route.ts` — GET proxy
- `src/app/platform-admin/page.tsx` — per-tenant "Manage plan" link
- `src/components/shell/AppSidebar.tsx` — `/tenant/plan` nav item

## How to extend this safely

- Keep all backend calls inside `src/lib/core-client.ts`. Do not issue ad hoc
  `fetch` calls from any component.
- Plan changes and feature-gate changes go through `PATCH /v1/admin/tenants/:id`.
  The backend merges plan defaults, stored overrides, and the explicit update.
- To add a new gated feature key, add it to `PLAN_DEFAULTS` in
  `TenantPlanForm.tsx`, to `FEATURE_KEYS` in `FeatureToggleList.tsx`, and to the
  backend `PLANS` definition in `social-listening-core/src/tenants/featureGates.ts`.

## Load-bearing constraints — do not change casually

- `activeSeatCount` is never forwarded by the admin PATCH proxy. The backend
  rejects it anyway, but the proxy also blocks it before calling
  `updateAdminTenant()`.
- The tenant view is gated on the `'tenant'` shell, not a specific role, so both
  `tenant_admin` and `tenant_user` can see it. The platform-admin view is gated
  on the `'platform-admin'` shell.
- `max_seats` is always a positive integer. The form validates `maxSeats >= 1`
  before submitting.
- `core-client.ts` remains the only file that attaches the bearer token. No
  client-side `fetch` includes `Authorization`.

## Relations to other components

- `TenantPlanForm` calls the same-origin proxy `PATCH /api/admin/tenants/:tenantId`,
  which calls `updateAdminTenant()` in `core-client.ts`, which calls
  `PATCH /v1/admin/tenants/:id` in the backend.
- The platform-admin page calls `getAdminTenantPlan()` -> `GET /v1/admin/tenants/:id/plan`.
- The tenant page calls `getMyPlan()` -> `GET /v1/tenants/plan`.
