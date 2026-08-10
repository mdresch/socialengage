---
name: same-domain-invite-assist
description: The Tenant-Admin-only dashboard at /tenant/invite-assist surfacing ADR-0037 §8b's Same-Domain Invite Assist data, plus the small pre-fill hook it adds to Story 6.8's invite form. Read this before touching src/app/tenant/invite-assist/**, the listDomainSignupAttempts() function in src/lib/core-client.ts, or the inviteEmail search-param handling in src/app/tenant/users/page.tsx / InviteUserForm.tsx.
---

# Same-Domain Invite Assist view

## What this is

The Tenant-Admin-facing half of ADR-0037 §8b — closing the gap that ADR named at acceptance and left explicitly unowned by any of Epic 6's original stories (6.1–6.6 predate the decision). Surfaces same-domain self-service-signup rejections against the caller's own tenant (Story 5.16's backend), aggregated one item per domain, with an escalation-threshold-crossing domain given real visual prominence rather than a bigger number, and a one-click "invite this person" action that pre-fills — never auto-submits — Story 6.8's own invite form.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0037 §8b | The Same-Domain Invite Assist mechanism itself: per-domain aggregation, escalation threshold, one-click pre-filled invite, no auto-join/no approval queue | 5.16 (backend), 6.10 (this screen) |
| ADR-0036 §2 | `core-client.ts` is the sole Bearer-attachment choke point | 6.1, re-verified by this story's own contract |

## Contracts that constrain this component

- `contracts/epic-6/story-6.10.same-domain-invite-assist-view.contract.test.ts` — one item per domain (never per individual attempt); an escalated domain gets a distinct UI element/label, not just a bigger `distinctEmailCount`; expand-on-demand via a native `<details>` element (no second network call — Story 5.16 already returns the full email list inline); each email links to `/tenant/users?inviteEmail=<email>`, never auto-invites; the whole screen redirects away, before any data fetch, for a non-`tenant_admin` session (deliberately *not* Story 6.8's own in-page-only gating pattern); no `tenantId` is ever threaded into `listDomainSignupAttempts()` — cross-tenant scoping is entirely the backend's own RLS.
- `social-listening-core/contracts/epic-5/story-5.16.same-domain-invite-assist-backend-surface.contract.test.ts` — owns the backend's own RLS scoping, per-domain aggregation, and escalation-threshold computation. Not re-proven here.
- `contracts/epic-6/story-6.8.user-invitation-management-screen.contract.test.ts` — covers `InviteUserForm`'s own base behavior; this story only adds an `initialEmail` prop and the `?inviteEmail=` search-param plumbing on top, asserted in this story's own contract file rather than duplicated into 6.8's.

## How to extend this safely

- `listDomainSignupAttempts()` takes no `tenantId` argument and must never gain one — every other tenant-scoped `core-client.ts` function (`listTenantUsers()`, `getMyTenant()`) follows this same "the session bearer token is the only scoping input" pattern; adding an explicit tenant parameter here would be a real regression risk (a client-suppliable value competing with the backend's own RLS), not a convenience.
- The escalation indicator's exact visual treatment (today: a `⚠ Escalated:` label ahead of the domain) can change, but it must remain a distinct element/label — never collapse it back down to "the same summary line with a bigger number," which is the specific anti-pattern ADR-0037 §8b and this story's own AC2 both call out by name.
- The pre-fill hook (`?inviteEmail=` → `InviteUserForm`'s `initialEmail` prop) is a one-way, read-only handoff — it seeds form state, nothing more. Don't wire it to auto-submit; ADR-0037 §8b is explicit that the Tenant-Admin's own act of confirming the invite is the only thing that grants access.

## Load-bearing constraints — do not change casually

- **This screen's own role gate is a whole-page `redirect()`, before any data fetch — deliberately not Story 6.8's own in-page-only pattern.** Story 6.10's AC4 says "visible only to `tenant_admin` — `403`/not rendered for `tenant_user`," a stricter requirement than Story 6.8's own users list (which a `tenant_user` *can* see, just without the invite form). Don't "harmonize" these two screens' gating logic — they're intentionally different per their own stories' own Acceptance Criteria.
- **`item.domain` is rendered exactly as the backend returns it, with no client- or server-side re-filtering.** The anti-enumeration guarantee (AC5 — no cross-tenant data ever shown here) is entirely Story 5.16's own RLS scoping; this screen has no filtering logic of its own to get wrong, and must not grow one (e.g. "just to be safe") that could itself introduce a bug.
- **Expand-on-demand uses a native `<details>`/`<summary>` element, not a Client Component with fetch-on-expand.** Story 5.16's own response already includes the full `emails` array inline — a second network call to "load" data already in hand would be pure overhead, and this keeps the whole screen a plain Server Component (no `'use client'` anywhere in this story).

## Known gaps / deferred work

- **No client-side rendering test** — same `testEnvironment: 'node'` constraint every other Epic 6 story has worked within; not relevant here anyway since this screen has no client-side interactivity to test (the `<details>` toggle is native browser behavior).
- **Real-time/automatic escalation alerting is not built anywhere in this project** — ADR-0037 §8c's own named scope limit; this screen surfaces the same durably-logged data a Platform Admin would otherwise have to go find in `platform_admin_audit_log`, but nothing pages anyone.
