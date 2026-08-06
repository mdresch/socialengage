---
name: self-service-tenant-signup
description: POST /v1/tenants/self-service-signup — the one route in this project accepting a validly-signed Entra bearer token that resolveIdentity() cannot match, provisioning a new tenant and its first Tenant-Admin. Read this before touching selfServiceSignupRouter.ts, selfServiceSignup.ts, tenant_signup_role, domain_signup_attempts, or the claims-level auth middleware.
---

# Self-service tenant sign-up

## What this is

`POST /v1/tenants/self-service-signup` (ADR-0037) is a narrow, explicitly-scoped exception to ADR-0029 §4's general rule ("an authenticated Entra sign-in with no matching invitation is rejected"). It's the only place a caller whose `resolveIdentity()` result is `null` is accepted rather than rejected — specifically so a brand-new user can provision their own first tenant and become its `tenant_admin`. A fifth Postgres role, `tenant_signup_role`, does the one thing that structurally cannot be scoped by a `tenant_id` that doesn't exist yet (the `tenants` INSERT); everything downstream (the first `users` row) runs through the ordinary `app_user`/`withTenant()` path, same as any other tenant-scoped write in this codebase.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0037 §1/§2 | `tenant_signup_role` — `BYPASSRLS`, `INSERT`-only on `tenants`, `INSERT`-only on `platform_admin_audit_log`; every write audited | 5.15 |
| ADR-0037 §3 | Domain-match sign-ups are rejected outright, vague/non-org-naming message, no auto-join | 5.15 |
| ADR-0037 §4 | Static public-email-provider denylist — a matched domain leaves `tenants.domain` `null` | 5.15 |
| ADR-0037 §5 | The one narrow exception to ADR-0029 §4's "reject unmatched caller" rule | 5.15 |
| ADR-0037 §6 | An existing unlinked `invited` row for the caller's email takes precedence over tenant creation | 5.15 |
| ADR-0037 §8b | `domain_signup_attempts` — per-attempt record against the matched tenant | 5.15 (sole writer), 5.16 (reader, not yet built) |

## Contracts that constrain this component

- `contracts/epic-5/story-5.15.self-service-tenant-signup.contract.test.ts` — an unmatched caller provisions a tenant + first `tenant_admin` user (verified directly against the database, not just the HTTP response); mounting this route doesn't change any other route's unauthenticated-rejection behavior; an existing unlinked `invited` row is linked via `resolveIdentity()`'s own mechanism rather than creating a second tenant; a caller who already resolves (directly, via a fresh link, or as a `platform_admin`) is rejected `409`; a denylisted domain leaves `tenants.domain` `null`; a real domain-match is rejected with a vague message (no matched org name/id in the response) and records a `domain_signup_attempts` row; every successful signup is audited via `platform_admin_audit_log`, `actorIdentity: self-service-signup:<sub>`; a genuine partial failure (tenant created, first-user insert fails — reproduced via a real `external_subject` `UNIQUE`-constraint collision, not a mock) surfaces a real error rather than a silent success.

## How to extend this safely

- **This route's auth is deliberately not the shared `authMiddleware`.** It uses a second, claims-level middleware (`claimsAuthMiddleware` in `router.ts`/`app.ts`) that verifies the Entra token's signature (real `createEntraAuthMiddleware`, unchanged) but does **not** call `resolveIdentity()` and reject on `null` the way `createTenantAuthMiddleware` does — the route handler itself calls `resolveIdentity()` and branches. Never mount this route behind the ordinary `authMiddleware`; that would reject exactly the one caller this endpoint exists to accept.
- **The must-check-first invited-row lookup (§6) is not separate code** — it's `resolveIdentity()`'s own existing case-3 behavior (an unlinked `invited` row by email, linked on first sign-in). The router simply treats any non-`null` `resolveIdentity()` result — direct match, platform admin, or a freshly-linked invite — as "already belongs to a tenant" and rejects before ever calling `provisionTenantViaSignup()`. Don't reimplement a second invited-row lookup here.
- **Adding a public-email-provider domain to the denylist:** edit `PUBLIC_EMAIL_PROVIDER_DENYLIST` in `selfServiceSignup.ts` — a static, maintained list per ADR-0037 §4, not a database table or third-party service.
- **A new field on the response body:** add it to `provisionTenantViaSignup()`'s return shape; the router only forwards it.

## Load-bearing constraints — do not change casually

- **`tenant_signup_role` has an unrestricted `SELECT` on `tenants`, not the narrower column-scoped grant ADR-0037 §1 originally sketched.** This was a genuine implementation-time correction (migrations/0021), found necessary for two real reasons: the domain-match lookup needs the matched tenant's `id` (a unique-violation error doesn't carry it), and — confirmed directly against a real Postgres instance — `INSERT ... RETURNING *` requires `SELECT` privilege on every returned column, not `INSERT` privilege alone; a first-draft `SELECT(id)`-only grant made every successful signup's own `RETURNING *` fail with "permission denied," since the app needs the full row back to build its response. **This is not a widening of §3's anti-enumeration boundary** — it only ever lets this role read back the one row its own `INSERT` just created (the caller already supplied `name`/`domain`), and it matches `platform_admin_role`'s own already-established unrestricted `SELECT` on this same table (migrations/0017). The domain-match lookup query itself still only selects `id` in application code (`selfServiceSignup.ts`), a defense-in-depth discipline independent of the grant's own width — don't widen that query to select other columns.
- **Domain-collision detection is the existing `uq_tenants_domain` partial unique index (migration 0017), never a SELECT-then-INSERT check.** A separate existence check would reopen the TOCTOU race ADR-0037 §1 explicitly designed this scheme to avoid.
- **The first `users` row is never inserted by `tenant_signup_role`.** Once the `tenants` INSERT succeeds, the new tenant's `id` exists, so the first user is inserted via the ordinary `app_user`/`withTenant(newTenantId, ...)` path — `tenant_signup_role` has no grant on `users` at all, by design.
- **`logPlatformAdminAction()`'s new optional `pool` parameter must be passed explicitly as `getTenantSignupPool()` from this component.** Omitting it defaults to `getPlatformAdminPool()` — silently mis-attributing the write to the wrong role's connection and defeating ADR-0037 §2's own requirement that this specific write run under `tenant_signup_role`.
- **The domain-match rejection message must never name the matched tenant** (ADR-0037 §3, a Security & Architecture Reviewer finding) — don't add debugging/logging output that includes it anywhere the caller's own response could surface it.
- **A partial failure is not rolled back or retried** — ADR-0037's own explicit deferral. The tenant row is left in place; don't add compensating-transaction logic without a new story/ADR decision.

## Known gaps / deferred work

- **§7's rate-limiting/abuse-prevention mechanism is not built here** (Story 5.18) — a real precondition before this endpoint is exposed to real, untrusted traffic, per ADR-0037 §7's own Consequences note. Don't treat this endpoint as safe for public traffic until Story 5.18 ships.
- **§8c's repeated-domain escalation-threshold detection is not built here** — only the raw per-attempt `domain_signup_attempts` row exists; deciding when a domain has crossed the escalation threshold and writing that signal to `platform_admin_audit_log` is separate, not-yet-scoped application code.
- **Story 5.16's own Tenant-Admin-facing read of `domain_signup_attempts` is not built here** — this story is the table's sole writer.
- **The admin UI's own sign-up screen (Story 6.7) is not built here.**
- **§8a's email-OTP-verification precondition is a configuration fact about `social-listening-admin`'s own Entra user flow, not code this component controls** — this endpoint trusts the token's `email` claim; confirming that trust is warranted is Story 6.7's own job, per ADR-0037 §8a.
