---
name: feature-gating
description: Per-tenant plan tiers, feature gates, max_seats ceiling, and `requireFeatureGate(feature)` middleware. Read this before changing `tenants.plan`, `tenants.feature_gates`, seat-limit enforcement, or adding a gated feature to a route.
---

# Feature Gating and Seat-Limit Enforcement

## What this is

Story 13.5 (ADR-0112) adds a `plan` column and `feature_gates` JSONB to `tenants`, a platform-level `PLANS` definition, an explicit `max_seats` ceiling, and a `requireFeatureGate(feature)` helper that returns `403 FEATURE_NOT_AVAILABLE` when a feature is disabled for the caller's tenant. Seat limits continue to be enforced atomically through `tenantStore.ts`, now preferring `feature_gates.max_seats` over the legacy `license_seat_count` when it is explicitly set, so existing contracts that seed tenants without a `max_seats` override keep using `license_seat_count`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0112 | `tenants.plan`, `tenants.feature_gates`, `max_seats`, `requireFeatureGate(feature)`, seat-limit enforcement on invite/accept | 13.5 |
| ADR-0031 | `tenants` RLS, `license_seat_count`/`active_seat_count`, atomic `incrementActiveSeatCount` | 5.8 |
| ADR-0032 | User invite/activation flow and `active_seat_count` semantics | 1.9, 5.9 |
| ADR-0107 | Existing `feature_gates` column and `GET/PATCH /v1/tenants/me/features` | 12.13 |

## Contracts that constrain this component

- `contracts/epic-13/story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts` — plan column, `GET /v1/tenants/plan`, plan seeding on `POST /v1/admin/tenants`, `PATCH /v1/admin/tenants/:id` plan/featureGates, feature gates on invite/connect/watchlist/export, `max_seats` enforcement on invite and `resolveIdentity`, grandfathered active users on seat reduction.

## How to extend this safely

- To add a new gated feature, pick a camelCase feature key, add it to `PLANS` defaults with `true` for any plan that should have it, and call `requireFeatureGate('<key>')` or `requireFeatureGateForTenant(tenantId, '<key>')` at the real call site. Missing feature keys are treated as `true` (available) to avoid breaking tenants with an empty `feature_gates` object, typically created by test fixtures or pre-13.5 migrations.
- To change a tenant's plan, use `PATCH /v1/admin/tenants/:id` with `{ plan }`. The store merges the new plan's default `feature_gates` with any explicit overrides already stored on the tenant.
- To change `max_seats`, use `PATCH /v1/admin/tenants/:id` with `{ licenseSeatCount }` and/or `featureGates: { max_seats: N }`. Lowering `max_seats` below `active_seat_count` does **not** deactivate existing users; new activations and invites are blocked until `active_seat_count <= max_seats`.

## Load-bearing constraints — do not change casually

- `max_seats` lives in `feature_gates` and is the primary ceiling when explicitly set. `license_seat_count` is a fallback only when `feature_gates.max_seats` is missing (`COALESCE((feature_gates->>'max_seats')::int, license_seat_count)`). This preserves Story 1.9's `409` behavior for existing tenants seeded with direct SQL and no `feature_gates.max_seats`.
- The seat increment is a single atomic `UPDATE ... WHERE active_seat_count < effective_max_seats RETURNING *`. It is never a `SELECT` followed by a separate `UPDATE`.
- `resolveIdentity()` activation (case 3) increments `active_seat_count` inside the same `withTenant()` transaction as the `users` status update. If the increment fails, it throws `SeatLimitExceededError`.
- `platform_admin_role` is column-denied from writing `active_seat_count` (migrations/0017); the new `plan` and `feature_gates` columns are writable by `platform_admin_role` and `app_user` only where the grants explicitly allow.

## Known gaps / deferred work

- Real billing integration and plan change hooks are out of scope; `PLANS` is a platform-level constant and the admin patch is the only plan-change mechanism.
- Story 13.6 will add the Platform-Admin UI for plan and feature management.
- Distributed enforcement of `max_seats` across multiple concurrent instances relies on Postgres row-level atomicity, the same as `license_seat_count` in Story 5.8.

## Relations to other components

- `identityResolution.ts` calls `incrementActiveSeatCount()` (via the same `withTenant` transaction) during invite activation.
- `tenantUsersRouter.ts` calls `getTenantSeatAndGateStatus()` before `POST` and `PATCH null`, and returns `403 FEATURE_NOT_AVAILABLE` / `403 SEAT_LIMIT_EXCEEDED`.
- `connectorsRouter.ts`, `watchlistsRouter.ts`, and `postsExportRouter.ts` call `requireFeatureGate(feature)` to gate activation, creation, and async export respectively.
