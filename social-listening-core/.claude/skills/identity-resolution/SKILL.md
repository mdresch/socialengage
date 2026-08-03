---
name: identity-resolution
description: The `users`/`platform_admins` tables, `identity_resolver_role` (a fourth, SELECT-only BYPASSRLS role), and `resolveIdentity()` — the request-time bootstrap that turns a validated Entra `sub`/`email` into a tenant/user/role or Platform Admin, before any `withTenant()` call. Read this before touching `src/identity/`, before wiring real route middleware around `resolveIdentity()` (Story 5.10), or before adding a column to `users`/`platform_admins`.
---

# Identity Resolution

## What this is

`resolveIdentity()` is the first thing a real authenticated request does, before any tenant-scoped query — it turns a validated token's `sub`/`email` claims into `{ type: 'tenant_user', tenantId, userId, role }`, `{ type: 'platform_admin', adminId }`, or `null` (rejected). It reads through `identity_resolver_role`, a fourth Postgres role alongside `app_user`/`platform_admin_role`/the migration superuser — `BYPASSRLS`, column-scoped `SELECT`-only on `users`/`platform_admins`, no write grant at all (ADR-0032 §5). **Mounted as of Story 5.10** — composed inside `createTenantAuthMiddleware()` (`.claude/skills/tenant-auth-middleware/SKILL.md`), the actual middleware wired onto the `/v1` router stack, alongside retiring `X-Tenant-Id`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0032 | `users` table shape, RLS, request-time identity resolution, `access_ends_at` (§9, added at review) | 5.9 |
| ADR-0030 §4 | Named, without designing, the request-time identity-resolution bypass this story concretizes | 5.7 (mechanism precedent), 5.9 (this component) |
| ADR-0031 | `tenants` table `users.tenant_id` foreign-keys into | 5.8 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.9.users-table-identity-resolution.contract.test.ts` — `users` RLS scoped by `tenant_id`; `identity_resolver_role` is `BYPASSRLS`, column-scoped `SELECT`-only, no write grant, no access to an ungranted column; an unknown `sub` resolves to `null`; an invited user links at first sign-in and resolves active; Platform Admin is never a `users` row and `platform_admins` returns zero rows under any tenant session; `access_ends_at` past/future/cleared transitions resolve correctly.

## How to extend this safely

- **Story 5.10 (retire `X-Tenant-Id`) — done.** `resolveIdentity({ sub, email })` is called once per request, inside `createTenantAuthMiddleware()`, immediately after token validation and before any `withTenant()` call. A `null` result is a `403` (`tenant-auth-middleware/SKILL.md`).
- **A real write triggered by resolution (the first-sign-in link) always runs through the ordinary `withTenant(tenantId, ...)` `app_user` path** — never add a write capability to `identity_resolver_role` to "simplify" this. See "Load-bearing constraints" below for why.
- **Provisioning a real `platform_admins` row** is deliberately not designed by ADR-0032 or built here — this component's own contract inserts fixture rows directly via `platformAdminPool`, the same way Story 5.7's contract handles its own fixtures. A real provisioning flow is future work, not a gap in this story.
- **`access_ends_at`'s audit trail** is not built here (ADR-0032 §9's own deferral) — `setAccessEndsAt()` performs the write; wiring it through whatever audit mechanism eventually resolves ADR-0030 §5/ADR-0031's shared Open Question is a later story's job, not silently invented here.

## Load-bearing constraints — do not change casually

- **`identity_resolver_role` has no write grant at all, on either table.** ADR-0032 §5 states this explicitly ("never any write grant") and this is a real, DB-enforced boundary — `migrations/0018`'s column-scoped `GRANT SELECT` is the only privilege this role holds. The first-sign-in link write (`external_subject`/`status`/`activated_at`) is performed by `resolveIdentity()` through a **separate, subsequent** `withTenant(tenantId, ...)` call as `app_user`, once the resolver's own read has revealed which tenant the invited row belongs to — never by the resolver role itself. Don't "simplify" this into a single write through `identity_resolver_role`; that would silently violate ADR-0032 §5 for the sake of fewer round-trips.
- **`identity_resolver_role`'s `SELECT` grant on `users` is column-scoped** (`id, tenant_id, email, role, status, access_ends_at, external_subject`) — notably excludes `display_name` and timestamps beyond what's needed. Widening this casually would defeat the "narrower blast radius than `platform_admin_role`" design goal ADR-0032 §5 states directly.
- **`platform_admins` has RLS enabled and FORCEd with zero `CREATE POLICY` statements, on purpose.** This is what makes it fail closed to every role without `BYPASSRLS` — `app_user` is still granted `SELECT` so a query against it doesn't error, it just always returns zero rows (Story 5.9's own AC6). Adding a policy "to be consistent with other tables" would break this deliberate zero-visibility design.
- **`platform_admins` has no `tenant_id` column** (ADR-0032 §3's explicit rejection of a nullable-`tenant_id` row on `users` for this role) — don't add one to "unify" the schema; that reopens exactly the special-casing problem §3 rejected.
- **Resolution order is `users` by `sub`, then `platform_admins` by `sub`, then `users` by `email` (unlinked `invited` row) — in that order.** Checking `platform_admins` before an unlinked invite, or vice versa, doesn't change correctness today (the sets can't overlap) but changing the order without re-reading this note risks masking a future bug where they could.

## Known gaps / deferred work

- **Now mounted (Story 5.10)** — see `.claude/skills/tenant-auth-middleware/SKILL.md`. Kept, corrected, not deleted, per this doc series' "don't rewrite history" convention.
- **No real `platform_admins` provisioning flow** — not designed by ADR-0032, not built here.
- **`access_ends_at` writes are not audited** — ADR-0032 §9's own named Open Question, deferred to whichever future work resolves ADR-0030 §5/ADR-0031's shared audit-log question.
- **Tenant Reader / Tenant Business Analyst have no separate `role` value** — both map to `role = 'tenant_user'` in v1, per ADR-0032 §4's own deliberate deferral, not an oversight.
- **The seat-count race condition inherited from ADR-0031 §3** is not re-resolved here — `createInvitedUser()` does not itself call `tenantStore.ts`'s `incrementActiveSeatCount()`; wiring seat reservation into user creation for real is left for whoever builds the actual invite/onboarding flow, since this story's own ACs don't require it (they test `access_ends_at` and linking, not seat consumption).
