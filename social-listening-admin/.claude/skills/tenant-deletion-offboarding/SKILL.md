---
name: tenant-deletion-offboarding
description: Self-service, tenant_admin-initiated tenant deletion/offboarding screen — request, export, cancel, confirm (Story 6.13, ADR-0043) — read before touching /tenant/settings/delete or its four proxy routes.
---

# Tenant deletion / offboarding UI

## What this is

The only frontend surface for the fully self-service tenant-deletion flow `social-listening-core` already built (Story 3.8, ADR-0043): request deletion, export data (JSON or CSV) any number of times, cancel any time before confirmation, and confirm once a 30-day grace period has genuinely elapsed — the one irreversible action in this entire admin UI. A dedicated `/tenant/settings/delete` screen, gated on `tenant_admin` specifically — a `tenant_user` session is redirected away, not merely shown a hidden control, matching this story's own AC1.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0043 | Self-service, tenant_admin-initiated deletion — request/export/30-day grace/cancel/confirm, no Platform Admin approval step anywhere in the path | 3.8 (backend), 6.13 (this UI) |
| ADR-0032 | `role` column on the resolved identity — this screen's own `tenant_admin`-specific gate reads `identity.role`, the same pattern Story 6.8's invite/access-control affordances already use | (identity model) |

## Contracts that constrain this component

- `contracts/epic-6/story-6.13.tenant-deletion-offboarding.contract.test.ts` — page-level gating (redirect for `tenant_user`/`platform_admin`), real fetch-mocked assertions for all four `core-client.ts` functions and their proxy routes, and source-level checks for each control's own reaction to its real response shapes.

## How to extend this safely

- All four backend endpoints are `tenant_admin`-only, own-tenant-only, no `:id` param anywhere — never add a tenant-selector to this screen; it structurally cannot target another tenant.
- If a future story adds a way to read current deletion-request state without first calling `POST /request` (no such `GET` endpoint exists today — see Load-bearing constraints below), prefer fetching it server-side in `page.tsx` and passing it down as a prop, the same way `TenantOwnedFeedPage` passes `initialActivationId` down to its own client component.

## Load-bearing constraints — do not change casually

- **There is no `GET` endpoint for current deletion-request state.** The only way this screen learns a request is already active is a `409` from `POST /request` itself — and that `409`'s body carries no `graceEndsAt`. `TenantDeletionPanel` deliberately treats this as a distinct, real state (`graceEndsAt` unknown) rather than pretending it knows the value — the confirm control's own client-side grace-period gate is skipped (not falsely enabled or disabled) when `graceEndsAt` is unknown, relying on the backend's own real `409 grace_period_not_elapsed` enforcement instead. This mirrors Story 6.12's own named "TXT instructions aren't re-fetchable after a reload" gap — a real, accepted limitation, not an oversight.
- **`executeTenantDeletion()` is never awaited by the backend's own confirm handler** (see `social-listening-core/.claude/skills/self-service-tenant-deletion/SKILL.md`) — this screen must never poll for completion after a successful confirm; no status-check endpoint exists. The post-confirm state is deliberately static ("deletion in progress"), not a spinner waiting on anything.
- **Cancel and confirm each get their own separate two-click pending-confirm sub-state** (`cancelPending` / `confirmPending`), never a shared one — this story's own AC4 requires cancel's confirm step to be "distinct from the request/confirm steps below." Reuses `ActivateDeactivateButton`/`DisconnectButton`'s own established two-click convention (never a native `window.confirm()`), but confirm's own copy is deliberately higher-friction (states the action is final and unrecoverable) since this is the one truly irreversible action in the app.
- **Export downloads via a client-side `Blob`/anchor click, not a `<a download>` static link** — the export body must come from a real, freshly authenticated `POST`, so it cannot be a plain static href.

## Known gaps / deferred work

- **No link to this screen from `/tenant/settings` — a real, deliberate gap, not an oversight.** Story 6.9's own sealed contract (`contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts`) asserts that shared screen adds no role gate of any kind ("visible to both tenant_admin and tenant_user — no additional role gate"); adding a tenant_admin-only link there would reintroduce exactly that and was reverted during this story's own build after it broke that contract (see `docs/implementation-log.md`'s Story 6.13 entry). This screen's own redirect gate (`page.tsx`) still fully enforces AC1's "tenant_user sessions never see an entry point," but a tenant_admin today has no in-app link to `/tenant/settings/delete` — only direct navigation. A future story could add discoverability via a dedicated nav element (this app has no shared nav shell today) without touching Story 6.9's own screen.
- No user-facing warning/reminder as the grace period nears its end (ADR-0043's own named Open Question, left to a future story) — this screen only ever shows the same `graceEndsAt` value it already has, no proactive notification.
- No rate-limiting/abuse-prevention UI for repeated request/cancel cycles — matches ADR-0043's own "no evidence of a real problem yet" deferral.
- Any Platform Admin-facing view of a tenant's deletion request beyond the existing audit log (Story 6.6) is explicitly out of scope, per ADR-0043's own decision.
