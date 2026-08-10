---
name: tenant-settings
description: The read-only tenant settings screen at /tenant/settings — shows the caller's own tenant's name/status/domain/seat counts/createdAt. Read this before touching src/app/tenant/settings/page.tsx or the getMyTenant() function in src/lib/core-client.ts.
---

# Tenant settings screen

## What this is

A read-only companion screen to Story 1.8's `GET /v1/tenants/me` — lets a Tenant-Admin or tenant user see their own tenant's administrative metadata (name, status, domain, seat counts, creation date) from the admin UI instead of calling the REST API directly. The simplest Epic 6 screen so far: no forms, no write path, no role gate beyond ordinary tenant-shell membership.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0031 | `tenants` table shape (`status`, `domain`, `license_seat_count`, `active_seat_count`) this screen reads | 1.8 (backend), 6.9 (this screen) |
| ADR-0036 §2 | `core-client.ts` is the sole Bearer-attachment choke point | 6.1, re-verified by this story's own contract |

## Contracts that constrain this component

- `contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts` — the screen reads `GET /v1/tenants/me` and renders `name`/`status`/`domain`/`createdAt`; seat counts render as "N of M seats used," never raw numbers alone; no `<form>`/`<input>`/edit affordance anywhere on the screen; gated only on the ordinary `'tenant'` shell (Story 6.2), never on a specific role value — both `tenant_admin` and `tenant_user` see the same screen; no tenant-content vocabulary (posts, watchlists, credentials) appears anywhere on it; `getMyTenant()` attaches the session bearer token correctly and throws (never returns a partial tenant) on a non-2xx.
- `social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts` — owns the backend's own RLS scoping and 404-on-deleted-mid-request behavior. Not re-proven here.

## How to extend this safely

- This screen is deliberately read-only — do not add an edit form here. Writes to `status`/`licenseSeatCount`/`domain` are Platform-Admin-only (Story 5.12's `updateAdminTenant()`); if a future story needs a Tenant-Admin-facing write path for tenant metadata, that is a new, separate story with its own ADR-level consideration of whether Platform-Admin-only should change — not an extension of this screen.
- `getMyTenant()` reuses `AdminTenant` (already defined for Story 6.6's Platform Admin console) rather than a second, near-identical type — `GET /v1/tenants/me`'s response shape and `GET /v1/admin/tenants`' per-row shape are the same `Tenant` object on the core side.

## Load-bearing constraints — do not change casually

- **No role check beyond `isShellAllowed(identity, 'tenant')`** — Story 6.9's own AC2 requires this screen visible to both `tenant_admin` and `tenant_user` identically; don't add a `role === 'tenant_admin'` gate the way `tenant-user-management/SKILL.md`'s own screen does — that would violate this story's own Acceptance Criteria, not just be an unnecessary restriction.
- **Seat counts are always rendered as "N of M seats used," never as two bare numbers** — the whole point (AC3) is a Tenant-Admin seeing at a glance whether they're near the license ceiling before attempting an invite (Story 6.8).

## Known gaps / deferred work

- **No client-side rendering test** — same `testEnvironment: 'node'`, no jsdom/testing-library constraint every other Epic 6 story has worked within; this screen is a plain Server Component anyway (no client interactivity to test).
