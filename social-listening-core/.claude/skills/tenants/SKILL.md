---
name: tenants
description: The `tenants` table — the first table in this project whose own primary key IS the tenant identity, its RLS policy scoped by `id`, its seat-count enforcement, and platform_admin_role's column-scoped write boundary. Read this before adding a column to `tenants`, before writing code that touches `active_seat_count`, or before wiring a real user-invitation flow (Story 5.9) that needs to reserve/release a seat.
---

# Tenants

## What this is

`tenants` (migration `0017`) gives every other tenant-scoped table's `tenant_id` a real referent for the first time — until this story, `tenant_id` was a bare UUID convention with no defining row anywhere. Unlike every other tenant-scoped table, `tenants` has no separate `tenant_id` foreign key column: its own primary key, `id`, *is* the tenant identity, and its RLS policy is scoped by `id` directly (ADR-0031 §2). `tenantStore.ts` is the sanctioned read/write surface — never query or write `tenants` directly outside it.

Story 13.5 (ADR-0112) adds `plan` and `feature_gates` to `tenants`, including a `max_seats` ceiling, while keeping `license_seat_count` as a fallback for tenants without an explicit `max_seats` override. See `.claude/skills/feature-gating/SKILL.md` for the feature-gate middleware and plan definitions.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0031 | `tenants` table shape and its own RLS policy, including sign-up `domain` capture (§5, added at review) | 5.8 |
| ADR-0015 | The RLS pattern this table's policy follows exactly (fail-closed, `NULLIF`-normalized) | 5.4 (precedent), 5.8 (this table) |
| ADR-0030 | `platform_admin_role`'s `BYPASSRLS` mechanism — this table is the first one it is actually granted anything on | 5.7 (mechanism), 5.8 (first real grant) |
| ADR-0112 | `plan` column, `feature_gates` JSONB with `max_seats`, and `requireFeatureGate(feature)` enforcement | 13.5 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.8.tenants-table-rls.contract.test.ts` — RLS enabled/forced with a policy scoped by `id`; a tenant-scoped session sees exactly its own row; `platform_admin_role` can create a tenant and update `status`/`license_seat_count` but is column-level denied from writing `active_seat_count`; the seat-count increment/decrement path runs as `app_user`, is rejected once at capacity, and is DB-atomic (no race window); `domain` is nullable and unique only when non-null.
- `contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts` — `GET /v1/tenants/me` is mounted behind `authMiddleware`, returns `200` with `{ id, name, status, licenseSeatCount, activeSeatCount, domain, createdAt }` for a tenant-user or tenant-admin identity, returns `403` for a platform_admin identity, is rejected `401` with no/invalid token, and returns only the caller's own tenant (two-tenant isolation). No write methods (POST/PATCH/DELETE) exist at this path.
- `contracts/epic-13/story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts` — `plan`/`feature_gates` columns, `GET /v1/tenants/plan`, plan seeding on create, `max_seats` enforcement, and `requireFeatureGate` on user invite, connector activation, watchlist creation, and export.

## How to extend this safely

- **Story 5.9 (`users` table):** when wiring a real user-invitation flow, call `incrementActiveSeatCount(tenantId)` inside the same transaction that inserts/activates the `users` row — it already returns `null` if the tenant is at capacity, which is the rejection signal ADR-0031 §3/Story 5.8's AC5 requires. Call `decrementActiveSeatCount(tenantId)` when a user is removed/offboarded. Do not reimplement the seat-count check inline in the users code — this function is the single sanctioned enforcement point.
- **Any new column:** add it to a follow-up migration (never edit `0017` after it ships), and decide explicitly whether `app_user` or `platform_admin_role` (or neither) should be able to write it — the column-level GRANTs below are deliberate, not an oversight to "fix" by widening.
- **Feature gating (Story 13.5):** use `requireFeatureGate(feature)` for route-level gates, and `getEffectiveMaxSeats(tenantId)` / `getEffectiveFeatureGates(tenantId)` for any code that needs the merged plan + override values. Add new feature keys to `PLANS` and default missing keys to `true` to avoid breaking existing test fixtures and pre-13.5 tenants.

## Load-bearing constraints — do not change casually

- **`platform_admin_role`'s `UPDATE` grant on `tenants` is column-scoped to `(status, license_seat_count)` from migration 0017, `(domain)` added by migration 0020 (ADR-0037 §9), `(name)` added by migration 0029 (2026-08-12 enhancement), and `(plan, feature_gates)` added by migration 0066 (ADR-0112) — never a blanket `UPDATE`.** A blanket grant would silently defeat AC3's "Platform Admin cannot write `active_seat_count`" boundary, which today is a real, DB-enforced permission-denied error, not an application-code convention that trusts the caller not to. Each new writable column needs its own explicit `GRANT UPDATE (column)` migration.
- **`app_user`'s `UPDATE` grant on `tenants` is column-scoped to `active_seat_count` only** — a Tenant-Admin's own tenant-scoped session can read its own `name`/`status`/seat counts (RLS, not a column grant, is what confines *reads* to the caller's own row) but cannot rename or unsuspend its own tenant via a raw update; only Platform Admin can. Symmetric with the constraint above, same underlying design principle (ADR-0031 §2/§3: Platform Admin sets administrative metadata, never membership detail; the tenant itself sets membership detail, never its own administrative metadata).
- **The seat-count increment is a single atomic `UPDATE ... WHERE active_seat_count < effective_max_seats RETURNING *` statement, not a `SELECT` followed by a separate `UPDATE`.** `effective_max_seats` is `COALESCE((feature_gates->>'max_seats')::int, license_seat_count)` — the `max_seats` override is used when explicitly set; otherwise the legacy `license_seat_count` ceiling applies. This preserves Story 1.9's `409` for existing tenants without a `max_seats` override while giving Story 13.5's `403 SEAT_LIMIT_EXCEEDED` when `max_seats` is explicit.
- **`tenants` has no `tenant_id` column and its RLS policy is scoped by `id`, not `tenant_id`** — this is the one table in the project shaped this way (ADR-0031 §2's own explicit rejection of a self-referencing `tenant_id = id` column as needless indirection). Don't "fix" this to match every other table's pattern; it is intentional.

## Known gaps / deferred work

- **Tenant deletion/offboarding is out of scope** — ADR-0031's own named Open Question, cross-referenced to `docs/open-items-and-deferred-work.md` §C.
- **The audit-log schema for Platform-Admin writes to `tenants` is `platform_admin_audit_log`'s existing first-cut shape (Story 5.7)** — not redesigned here; `createTenant`/`updateTenantAdmin` both call `logPlatformAdminAction()`, the same as every other Platform Admin action.
- **Tenant self-view HTTP surface now exists** — `GET /v1/tenants/me` (Story 1.8) is mounted in `createV1Router()` via `tenantSelfViewRouter.ts`, calling `getOwnTenant()` under `app_user`. `GET /v1/tenants/plan` (Story 13.5) is mounted in `router.ts` via `tenantPlanRouter.ts`, also under `app_user`. Platform-Admin write routes (`POST/PATCH /v1/admin/tenants`) exist separately via `adminTenantsRouter.ts` (Story 5.12; `PATCH` now covers `status`/`license_seat_count`/`domain`/`name`/`plan`/`featureGates` — see `contracts/epic-13/story-13.5.feature-gating-and-seat-limit-enforcement.contract.test.ts`).
