---
name: tenant-user-management
description: The Tenant-Admin user invitation/offboarding screen at /tenant/users — lists tenant users, offers an invite form and per-user access controls to tenant_admin sessions only. Read this before touching src/app/tenant/users/**, src/app/api/tenant-users/**, or the listTenantUsers/inviteTenantUser/setUserAccessEndsAt trio in src/lib/core-client.ts.
---

# Tenant user management screen

## What this is

The admin-UI screen that drives Story 1.9's REST surface (`GET/POST /v1/tenants/users`, `PATCH /v1/tenants/users/:id`) — listing every user in the caller's tenant, letting a Tenant-Admin invite a new one, and setting/clearing a user's `access_ends_at` (immediate offboard, scheduled future expiry, or reactivation). This is the first Epic 6 screen with genuinely interactive Client Components (not static fixture data like Stories 6.3/6.4) — invite/offboard both need to react to specific backend response codes (409 seat ceiling, 403 role gate) with specific copy, not a generic failure message.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0032 §2/§6/§9 | `users` table shape, invite flow, `access_ends_at`/audit mechanism this screen drives | 1.9 (backend), 6.8 (this screen) |
| ADR-0036 §2 | `core-client.ts` is the sole Bearer-attachment choke point | 6.1, re-verified by this story's own contract |

## Contracts that constrain this component

- `contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts` — the screen lists users with `access_ends_at` shown as "active indefinitely" when null; the invite form renders only for a `tenant_admin`-resolved session; a 409 seat-ceiling response gets specific copy, not a generic failure; `AccessControl`'s confirm step is a real two-click gate (the first click only sets pending state, never calls the PATCH endpoint) whose own copy distinguishes an immediate offboard ("...immediately.") from a scheduled one ("...not immediately."); a 403 from either action surfaces the backend's own `error` text; `core-client.ts`'s three new functions (`listTenantUsers`/`inviteTenantUser`/`setUserAccessEndsAt`) attach the session bearer token correctly; the two new Route Handlers pass core-client's status/body through unmodified.
- `social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts` — owns the backend's own role gate, seat-ceiling math, and audit-log behavior. Not re-proven here.

## How to extend this safely

- `InviteUserForm.tsx` and `AccessControl.tsx` are Client Components calling same-origin Route Handlers (`/api/tenant-users`, `/api/tenant-users/:id`), never `core-client.ts` directly — a Client Component cannot read the server-side session cookie, so the Route Handler is the only place that can call `authenticatedCoreFetch()`-backed functions. Keep this shape for any new interactive action this screen gains.
- Any new distinguishable backend response code (a new 4xx core might add) gets a real, specific branch in the relevant Client Component's own status check — never folded into the generic fallback message, per this story's own AC3/AC5.
- The access-history view reading `user_access_audit_log` is a named, natural companion (Story 6.8's own Acceptance Criteria) but not built here — don't assume it exists.

## Load-bearing constraints — do not change casually

- **`AccessControl`'s two-click confirm gate is structurally checked** (the contract greps for `onClick={...setPending...}` handlers and asserts none of them also call `apply(`) — don't collapse "select an action" and "confirm it" into a single click, even for a seemingly obvious case like reactivation.
- **The confirm copy's own wording is the thing that distinguishes immediate vs. scheduled offboarding** (Story 6.8's own AC4) — there is no other UI cue (color, icon) doing this job today; if the copy changes, keep the "immediately" vs. "not immediately" contrast intact or the contract's own regex check (and the actual UX requirement it encodes) breaks.
- **This screen's own role check (`identity.role === 'tenant_admin'`) is UX convenience only** — Story 1.9's own `403` remains the real boundary, the same framing Story 6.3 already established for connector actions. Don't treat a passing render of the invite form as proof of authorization.

## Known gaps / deferred work

- **No client-side rendering test exists** — this repo's Jest config runs `testEnvironment: 'node'` with no jsdom/testing-library dependency, so `InviteUserForm`/`AccessControl`'s actual interactive behavior is proven structurally (source content) plus at the Route Handler/core-client unit level, not by rendering and clicking. Same constraint every other Epic 6 client-component story has worked within (see `admin-auth-session/SKILL.md`'s own AC7 pattern, reused here).
- **The access-history view (`user_access_audit_log`) is not built** — named as a natural companion by Story 6.8's own Acceptance Criteria, not required in this pass.
- **No navigation link from the tenant shell (`/tenant`) to this screen** — consistent with the existing, pre-existing gap across Stories 6.3/6.4/6.5 (their own shell action labels are plain text, not links); not introduced or fixed by this story.
