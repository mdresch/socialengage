---
name: platform-admin-access
description: platform_admin_role's BYPASSRLS scope, the platform_admin_audit_log table, and the two-phase (request/execute), two-identity break-glass mechanism (password reset + Temporary Access Pass). Read this before granting platform_admin_role access to any new table, before touching src/admin/breakGlassCredentialReset.ts, or before wiring real request-time authorization for Platform Admin actions (Story 1.7/5.10).
---

# Platform Admin access — RLS bypass, audit log, break-glass

## What this is

A dedicated, narrowly-scoped Postgres role (`platform_admin_role`, `BYPASSRLS`) for Platform Admin's own database access, kept structurally separate from the migration/bootstrap superuser and from `app_user`'s RLS-scoped path. Every write it performs is logged to `platform_admin_audit_log`. A separate, two-phase, two-identity mechanism (`breakGlassCredentialReset.ts`) recovers a locked-out Tenant-Admin — a request is recorded first (no Entra action), then a Platform Admin explicitly picks it up for execution, which forces both a password reset and issues a Temporary Access Pass (covering a lost-MFA-device lockout too) in one JIT elevation window — the one deliberate exception to Platform Admin's otherwise zero-tenant-data-access boundary.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 | Admin-tier design — Platform Admin's audited BYPASSRLS role; break-glass credential reset (revised at review) | 5.7 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.7.platform-admin-rls-bypass.contract.test.ts` — `platform_admin_role` has BYPASSRLS and zero grants on every existing tenant-content table; a write through the role is audit-logged; an ordinary `withTenant()` write runs as `app_user`, never this role; a break-glass request performs no Entra action; executing a request against the live `getsocialengage` tenant performs a real password reset AND issues a real Temporary Access Pass, confirms de-elevation of both JIT roles actually completes, confirms the TAP code never reaches the audit log, and rejects re-executing an already-executed request.

## How to extend this safely

- **Story 5.8 (tenants table):** when creating `tenants`, add `GRANT SELECT, INSERT, UPDATE ON tenants TO platform_admin_role` to *that* migration — don't come back and edit `migrations/0015_create_platform_admin_role_and_audit_log.sql`, which predates the table and correctly couldn't grant anything on it.
- **Story 5.9 (users/platform_admins tables):** Platform Admin's own identity table (ADR-0030 §6) also needs a grant to `platform_admin_role`, added by whichever migration creates it — same pattern as above.
- **Real request-time authorization** (which caller may actually invoke these Platform Admin actions) is Story 1.7/5.10's job — this component only proves the database/Entra mechanics work; it does not itself check who's calling.
- **`logPlatformAdminAction()` is the only sanctioned way to write to the audit log** — every new Platform Admin action (tenant creation/suspension, whatever Story 5.8 adds) must call it, never write to `platform_admin_audit_log` directly.

## Load-bearing constraints — do not change casually

- **`platform_admin_role` must never be granted anything beyond `tenants` and its own Platform Admin identity table** (ADR-0030 §2) — a grant on any tenant-content table (`users`, `watchlists`, `social_posts`, `platform_credentials`, `authors`, `ingestion_runs`, `author_topic_signals`) silently defeats this ADR's entire boundary, since `BYPASSRLS` makes any grant on those tables an unconditional bypass, not just a policy exception.
- **The break-glass mechanism's two identities must never be merged, and neither may hold both permissions.** The "elevator" (`RoleManagement.ReadWrite.Directory` only) grants/revokes **both** "User Administrator" and "Authentication Administrator" on the "resetter" (`User-PasswordProfile.ReadWrite.All` + `UserAuthMethod-TAP.ReadWrite.All` only), together, in one JIT window. **Confirmed directly against the real tenant, not assumed:** Microsoft Graph rejects a principal removing its own directory role assignment — a single self-elevating identity cannot de-elevate itself, which is exactly why two identities exist. Per Menno's own direct instruction, the resetter must also never be granted `RoleManagement.ReadWrite.Directory` at all, so it cannot even request its own elevation.
- **"Authentication Administrator" is scoped to non-admin users only.** Fine for SocialEngage's Tenant-Admins today (ordinary External ID tenant users, no Entra directory role) — do not assume this holds for any other target without checking; "Privileged Authentication Administrator" would be needed for an Entra-directory-admin target.
- **Directory role assignment/removal has real, observed replication lag** (~15s in testing) — a read immediately after a successful `DELETE` (HTTP 204) can still show the assignment present, and a grant immediately following a very recent delete of the same (principal, role, scope) can itself 404 or conflict. Code and tests must poll/retry rather than trust a single immediate read or a single delete attempt; don't mistake either for a real failure.
- **Platform Admin never learns or sets the Tenant-Admin's actual new credential, and the TAP code is never logged or persisted anywhere by this module.** The generated temp password is thrown away immediately (only `forceChangePasswordNextSignIn: true` matters); the TAP code is returned once to the caller — it must reach the real Tenant-Admin somehow, but that delivery channel is not designed here (ADR-0030's own Open Question).
- **The break-glass execution is two-phase — request, then a separate, explicit pick-up-for-execution.** Never collapse these into one automated call; that was Menno's own direct instruction, not an implementation convenience to optimize away.

## Known gaps / deferred work

- **The `tenants`-table grant does not exist yet** — Story 5.8's own job, per this ADR's own explicit sequencing (see this story's own "Acceptance Criteria note" in `docs/user-stories/epic-5-security-isolation-and-messaging.md`).
- **The Tenant-Admin lookup ("which Entra user is this tenant's Tenant-Admin") is not implemented here** — this component proves the break-glass mechanism against a directly-specified target user; resolving a tenant name to the right Entra user is Story 5.9's job (it owns `users`).
- **No notification is sent to the affected Tenant-Admin or any secondary contact** — ADR-0030's own Open Question, still open.
- **How the TAP code actually reaches the real Tenant-Admin (a verified, out-of-band channel) is not designed here** — ADR-0030's own second Clarification names this as a real, undesigned gap, not solved by returning the code to the caller.
- **A tenant with zero remaining reachable Tenant-Admins has no recovery path under this mechanism** — ADR-0030's own named, unresolved gap.
- **The exact audit-log schema is a first cut, not a final design** — both ADR-0030 and ADR-0031 explicitly deferred this; `platform_admin_audit_log`'s current shape (`actor_identity`, `operation`, `target_tenant_id`, `detail` jsonb, `created_at`) is a reasonable default, not a locked decision — revisit if Story 5.8 or a future audit/compliance need wants something richer.
