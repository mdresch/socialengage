---
name: tenant-user-management
description: The Tenant-Admin user invitation/offboarding/access-history screen at /tenant/users — lists tenant users, offers an invite form, per-user access controls, and per-user access-history view to tenant_admin sessions only. Read this before touching src/app/tenant/users/**, src/app/api/tenant-users/**, or the listTenantUsers/inviteTenantUser/setUserAccessEndsAt/getUserAccessHistory quartet in src/lib/core-client.ts.
---

# Tenant user management screen

## What this is

The admin-UI screen that drives Story 1.9's REST surface (`GET/POST /v1/tenants/users`, `PATCH /v1/tenants/users/:id`) and Story 5.17's `GET /v1/tenants/users/:id/access-history` — listing every user in the caller's tenant, letting a Tenant-Admin invite a new one, setting/clearing a user's `access_ends_at` (immediate offboard, scheduled future expiry, or reactivation), and viewing that user's real change history. This is the first Epic 6 screen with genuinely interactive Client Components (not static fixture data like Stories 6.3/6.4) — invite/offboard both need to react to specific backend response codes (409 seat ceiling, 403 role gate) with specific copy, not a generic failure message.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0032 §2/§6/§9 | `users` table shape, invite flow, `access_ends_at`/audit mechanism this screen drives | 1.9 (backend), 6.8 (this screen), 6.14 (access-history view) |
| ADR-0036 §2 | `core-client.ts` is the sole Bearer-attachment choke point | 6.1, re-verified by this story's own contract |

## Contracts that constrain this component

- `contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts` — the screen lists users with `access_ends_at` shown as "active indefinitely" when null; the invite form renders only for a `tenant_admin`-resolved session; a 409 seat-ceiling response gets specific copy, not a generic failure; `AccessControl`'s confirm step is a real two-click gate (the first click only sets pending state, never calls the PATCH endpoint) whose own copy distinguishes an immediate offboard ("...immediately.") from a scheduled one ("...not immediately."); a 403 from either action surfaces the backend's own `error` text; `core-client.ts`'s three new functions (`listTenantUsers`/`inviteTenantUser`/`setUserAccessEndsAt`) attach the session bearer token correctly; the two new Route Handlers pass core-client's status/body through unmodified.
- `contracts/epic-6/story-6.14.access-history-view.contract.test.ts` — `AccessHistoryButton.tsx` renders each real entry's `operation`/`oldValue`/`newValue` (null → "active indefinitely", matching Story 6.8's own convention)/`occurredAt`/`actorUserId` (resolved to a real email via a lookup built from the already-fetched user list, falling back to the raw id — never a fabricated name — when that actor is no longer in the tenant); a real empty result renders an honest "no access changes recorded" state; visible only inside the same `isTenantAdmin`-gated block `AccessControl` already renders in; `getUserAccessHistory()`/the new proxy route call the real endpoint; Story 6.8's own contract is unaffected (purely additive).
- `social-listening-core/contracts/epic-1/story-1.9.user-invite-offboard.contract.test.ts` — owns the backend's own role gate, seat-ceiling math, and audit-log behavior. Not re-proven here.
- `social-listening-core/contracts/epic-5/story-5.17.access-history-read-endpoint.contract.test.ts` — owns `GET /v1/tenants/users/:id/access-history`'s own role gate and RLS cross-tenant isolation. Not re-proven here.

## How to extend this safely

- `InviteUserForm.tsx`, `AccessControl.tsx`, and `AccessHistoryButton.tsx` are all Client Components calling same-origin Route Handlers (`/api/tenant-users`, `/api/tenant-users/:id`, `/api/tenant-users/:id/access-history`), never `core-client.ts` directly — a Client Component cannot read the server-side session cookie, so the Route Handler is the only place that can call `authenticatedCoreFetch()`-backed functions. Keep this shape for any new interactive action this screen gains.
- Any new distinguishable backend response code (a new 4xx core might add) gets a real, specific branch in the relevant Client Component's own status check — never folded into the generic fallback message, per this story's own AC3/AC5.
- **`AccessHistoryButton` resolves `actorUserId` client-side from `page.tsx`'s own already-fetched `users` list** (`actorLookup`, an id→email `Record`) — no new endpoint, no per-row fetch just to get a name. Extend this same lookup if a future widget needs to resolve any other `userId` to a display name; don't build a second one.
- **`AccessHistoryButton` fetches lazily, only on first open** (`entries !== null` guards a re-fetch) — a tenant with many users would otherwise trigger one access-history request per row on page load for data almost never viewed. Keep new per-row detail views lazy the same way.

## Load-bearing constraints — do not change casually

- **`AccessControl`'s two-click confirm gate is structurally checked** (the contract greps for `onClick={...setPending...}` handlers and asserts none of them also call `apply(`) — don't collapse "select an action" and "confirm it" into a single click, even for a seemingly obvious case like reactivation.
- **The confirm copy's own wording is the thing that distinguishes immediate vs. scheduled offboarding** (Story 6.8's own AC4) — there is no other UI cue (color, icon) doing this job today; if the copy changes, keep the "immediately" vs. "not immediately" contrast intact or the contract's own regex check (and the actual UX requirement it encodes) breaks.
- **This screen's own role check (`identity.role === 'tenant_admin'`) is UX convenience only** — Story 1.9's own `403` remains the real boundary, the same framing Story 6.3 already established for connector actions. Don't treat a passing render of the invite form as proof of authorization.

## Known gaps / deferred work

- **No click-interaction test exists** — this repo's Jest config runs `testEnvironment: 'node'` with no jsdom/testing-library dependency, so `InviteUserForm`/`AccessControl`'s actual interactive behavior is proven structurally (source content) plus at the Route Handler/core-client unit level, not by rendering and clicking. `AccessHistoryButton`'s own real *rendered output* (once open, with real data) is proven via `renderToStaticMarkup()` and an `initialEntries` testability prop (also implies an initial open state) — a render-proof seam, not a click simulation; real usage never passes it.
- **No navigation link from the tenant shell (`/tenant`) to this screen** — consistent with the existing, pre-existing gap across Stories 6.3/6.4/6.5 (their own shell action labels are plain text, not links); not introduced or fixed by this story.
- **No way to withdraw a pending (still-`invited`) invite — flagged 2026-08-10, backlogged, not implemented.** Found live while manually testing the invite flow end to end: `AccessControl`'s "End access now"/"Schedule end date" actions only make sense for an already-`active` user (`access_ends_at` semantics), and using them on an `invited` row would be wrong twice over — semantically (it doesn't mean "cancel this invite") and mechanically (`PATCH .../:id`'s immediate-offboard branch unconditionally calls `decrementActiveSeatCount()`, but an invite never incremented the seat count in the first place — see `social-listening-core/.claude/skills/identity-resolution/SKILL.md`'s own matching Known-gaps note). There is no `DELETE /v1/tenants/users/:id` at all today. A real but small gap, not a new architectural decision — likely a Story 1.9 healing pass (a `DELETE` restricted to `invited`-status rows, tenant_admin only) plus a corresponding UI action here, not a new ADR. Menno's own direction: backlog, not now.
