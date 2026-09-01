---
name: tenant-settings
description: The tenant settings screen at /tenant/settings — shows the caller's own tenant's name/status/domain/seat counts/createdAt in styled cards, plus real export actions (workspace JSON, matched-posts CSV) and a tenant_admin-only offboarding link. Read this before touching src/app/tenant/settings/page.tsx, the export functions in src/lib/core-client.ts, or the proxy routes under src/app/api/tenants/export/ and src/app/api/posts/export.csv/.
---

# Tenant settings screen

## What this is

The `/tenant/settings` screen — a Server Component that reads `GET /v1/tenants/me` (Story 1.8, ADR-0031) via `getMyTenant()` and renders the caller's own tenant's administrative metadata (name, status, domain, seat counts, creation date) in styled cards. Story 6.9 built the read-only metadata display; Story 6.40 (ADR-0074) added two real export buttons ("Export Full Workspace (JSON)" and "Export Matched Posts (CSV)") wired through `core-client.ts` to Story 3.16's backend endpoints, plus a `tenant_admin`-only offboarding/decommission section linking to the existing `/tenant/settings/delete` page (Story 6.13).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0031 | `tenants` table shape (`status`, `domain`, `license_seat_count`, `active_seat_count`) this screen reads | 1.8 (backend), 6.9 (this screen's read-only metadata), 6.40 (export actions + offboarding link) |
| ADR-0036 §2 | `core-client.ts` is the sole Bearer-attachment choke point | 6.1, re-verified by 6.9 and 6.40's own contracts |
| ADR-0074 | Tenant-facing workspace JSON and matched-posts CSV export endpoints | 3.16 (backend), 6.40 (this screen's export buttons) |
| ADR-0043 | Self-service tenant deletion/offboarding — the `/tenant/settings/delete` page this screen links to | 3.8 (backend), 6.13 (offboarding UI) |
| ADR-0112 | Plan, feature gates, and seat limit UI surfaced in `/tenant/plan` | 13.6 |

## Contracts that constrain this component

- `contracts/epic-6/story-6.9.tenant-settings-screen.contract.test.ts` — the screen reads `GET /v1/tenants/me` and renders `name`/`status`/`domain`/`createdAt`; seat counts render as "N of M seats used," never raw numbers alone; no `<form>`/`<input>`/edit affordance anywhere on the screen; gated only on the ordinary `'tenant'` shell (Story 6.2), never on a specific role value — both `tenant_admin` and `tenant_user` see the same screen; no tenant-content vocabulary (posts, watchlists, credentials) appears anywhere on it; `getMyTenant()` attaches the session bearer token correctly and throws (never returns a partial tenant) on a non-2xx.
- `contracts/epic-6/story-6.40.tenant-settings-export-actions.contract.test.ts` — the screen renders workspace metadata in styled cards from `getMyTenant()` only (no mock/fallback); offboarding section rendered only when `identity.role === 'tenant_admin'`, linking to `/tenant/settings/delete`; two export buttons calling real Story 3.16 endpoints via `core-client.ts` proxy routes; workspace export button disabled (not hidden) for `tenant_user`; `createdAt` formatted with `toLocaleDateString()`; `domain` fallback to "—" when null; no `useApp()`/`exportTenantData()` client-side helper; no `<form>`/`<input>` edit affordance.
- `social-listening-core/contracts/epic-1/story-1.8.tenant-self-view.contract.test.ts` — owns the backend's own RLS scoping and 404-on-deleted-mid-request behavior. Not re-proven here.
- `social-listening-core/contracts/epic-3/story-3.16.tenant-workspace-and-posts-export.contract.test.ts` — owns the backend export endpoints' authorization, size caps, and field exclusions. Not re-proven here.

## Files that make this work

- `src/app/tenant/settings/page.tsx` — the Server Component. Reads session, gates on `'tenant'` shell, calls `getMyTenant()`, renders styled cards + export buttons + role-gated offboarding link.
- `src/app/tenant/plan/page.tsx` (Story 13.6, ADR-0112) — read-only tenant plan/seat/feature-gate view; reachable from the sidebar as "Plan & Seats".
- `src/lib/core-client.ts` — `getMyTenant()` (Story 6.9), `getMyPlan()` (Story 13.6), `exportWorkspace()` and `exportPostsCsv()` (Story 6.40) — the sole Bearer-attachment choke point for all three calls.
- `src/app/api/tenants/export/workspace/route.ts` — same-origin proxy for `GET /v1/tenants/me/export/workspace`.
- `src/app/api/posts/export.csv/route.ts` — same-origin proxy for `GET /v1/posts?format=csv`.

## How to extend this safely

- This screen is deliberately read-only — do not add an edit form here. Writes to `status`/`licenseSeatCount`/`domain` are Platform-Admin-only (Story 5.12's `updateAdminTenant()`); if a future story needs a Tenant-Admin-facing write path for tenant metadata, that is a new, separate story with its own ADR-level consideration of whether Platform-Admin-only should change — not an extension of this screen.
- `getMyTenant()` reuses `AdminTenant` (already defined for Story 6.6's Platform Admin console) rather than a second, near-identical type — `GET /v1/tenants/me`'s response shape and `GET /v1/admin/tenants`' per-row shape are the same `Tenant` object on the core side.
- Adding a new export action: add the `core-client.ts` function, the same-origin proxy route, and an AC in the Story 6.40 contract. Do not add client-side `useApp()`/`exportTenantData()` helpers — ADR-0074 §6 explicitly prohibits them.

## Load-bearing constraints — do not change casually

- **No role check beyond `isShellAllowed(identity, 'tenant')` for page access** — Story 6.9's own AC2 requires this screen visible to both `tenant_admin` and `tenant_user` identically. Story 6.40 adds role-gated *affordances* (offboarding link, workspace export button) inside the page, not a role gate on the page itself.
- **Seat counts are always rendered as "N of M active," never as two bare numbers** — the whole point (AC1/AC3) is a Tenant-Admin seeing at a glance whether they're near the license ceiling before attempting an invite (Story 6.8).
- **Workspace export is `tenant_admin` only** — BRU-001/ADR-0074 §2. The button is disabled (not hidden) for `tenant_user` with an explanatory state, per AC3.
- **CSV export is available to both roles** — BRU-002/ADR-0074 §2. The button is disabled only when the endpoint is unreachable.
- **No `useApp()` or `exportTenantData()` client-side helper** — ADR-0074 §6 and the Story 6.40 contract explicitly prohibit these. Export actions go through `core-client.ts` proxy routes only.
- **`createdAt` formatted with `toLocaleDateString()`** — AC5. Domain falls back to "—" (em dash) when null, not "n/a" or empty.

## Known gaps / deferred work

- **No client-side rendering test** — same `testEnvironment: 'node'`, no jsdom/testing-library constraint every other Epic 6 story has worked within; this screen is a plain Server Component anyway (no client interactivity to test). The contract tests are source-text assertions, not rendered-DOM assertions.
- **Async background export for large tenants** — deferred to ADR-0111. V1 exports are synchronous and capped (100 MB workspace JSON, 10,000-row CSV).
