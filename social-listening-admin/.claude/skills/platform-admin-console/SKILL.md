---
name: platform-admin-console
description: Platform Admin console surface for tenant provisioning/update, break-glass support flow, database health, and audit-log visibility in social-listening-admin, real backend data throughout.
---

# Platform Admin console

## What this is

This component provides the platform-admin route (`/platform-admin`) in `social-listening-admin` for platform operations only. It renders tenant administrative metadata (registry, provision, update), a real two-phase break-glass credential-reset flow, a database health indicator, and audit-log visibility — never tenant content.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 | Platform Admin uses a narrowly-scoped, audited bypass path for administrative actions only; §3 decides the two-phase break-glass mechanism. | 6.6 |
| ADR-0031 | Tenant registry shape and seat/status/domain metadata surfaced for administration. | 6.6 |
| ADR-0035 | One admin app with role-gated routes; platform-admin views remain inside this app. | 6.6 |

## Correction, 2026-08-12 — this story was never actually built despite being marked "Built"
Confirmed directly: `Provision tenant`, `Update tenant`, and `Break-glass` were each a single descriptive `<p>` — no form, no input, no button, no `onClick`/`onSubmit` anywhere — despite `createAdminTenant()`/`updateAdminTenant()`/`requestBreakGlassReset()`/`executeBreakGlassRequest()` already existing as real, working functions in `core-client.ts` that nothing called. The Tenant registry and Audit log sections were already real and needed no rework. See `docs/user-stories/epic-7-platform-admin-ui.md`'s own Story 6.6 entry and `docs/implementation-log.md` for the rebuild commit.

## Architecture
- `page.tsx` (Server Component) — role-gates on the `'platform-admin'` shell (Story 6.2), calls `listAdminTenants()`, `queryAdminAuditLog()`, and `getCoreHealthStatus()` directly, then mounts `ProvisionTenantForm`, one `TenantAdminControls` per tenant row, and `BreakGlassPanel`.
- `ProvisionTenantForm.tsx` (Client Component) — `name`/`licenseSeatCount` → `POST /api/admin/tenants` → `createAdminTenant()`.
- `TenantAdminControls.tsx` (Client Component) — per-row `name`/`status`/`licenseSeatCount` (`name` added 2026-08-12) → `PATCH /api/admin/tenants/:id` → `updateAdminTenant()`. Never sends `domain` or `activeSeatCount`.
- `BreakGlassPanel.tsx` (Client Component) — the real two-phase flow (ADR-0030 §3): a **request** control (`tenantId` selected from the already-rendered tenant registry — administrative metadata, not tenant content; `targetUserId` typed in directly, since no user-lookup UI exists — see "Load-bearing constraints" below) calling `requestBreakGlassReset()`, then a separate **execute** control only rendered once the request's own `id` is held in this component's local state. On execute success, the real `temporaryAccessPass` is rendered from that same local state, exactly once — this component never calls `window.location.reload()` after a successful execute, since that would erase the value before the operator could read/copy it.
- `src/app/api/admin/tenants/route.ts` (`POST`), `src/app/api/admin/tenants/[tenantId]/route.ts` (`PATCH`), `src/app/api/admin/tenants/[tenantId]/break-glass/request/route.ts` (`POST`), `src/app/api/admin/tenants/[tenantId]/break-glass/requests/[requestId]/execute/route.ts` (`POST`) — thin same-origin proxies to `core-client.ts`. The update route strips any `domain`/`activeSeatCount` the client might send before forwarding, matching `TenantAdminControls.tsx`'s own scoping. **Named `[tenantId]`, not `[id]`** — every dynamic segment at this directory level (the break-glass routes are its siblings) must share one parameter name; a real Next.js App Router routing conflict was found and fixed here via `heal-contract-failure`, see "Known gaps" below.
- `core-client.ts` — `createAdminTenant()`/`updateAdminTenant()`/`requestBreakGlassReset()`/`executeBreakGlassRequest()` were converted from throw-on-non-2xx to the raw `{status, body}` outcome pattern used elsewhere for mutations, as part of this rework (nothing called them before, so this was a safe signature completion, not a breaking change to a real caller). `getCoreHealthStatus()` (new) wraps the already-real `checkCoreHealth()`, reading `GET /v1/health` directly — never through `authenticatedCoreFetch()`, since this one call is deliberately unauthenticated (Story 1.3/1.10's own boundary).

## Contracts that constrain this component

- `contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts` — real behavioral assertions (mocked-fetch core-client unit tests, Route Handler proxy tests, structural source checks for the break-glass shown-once constraint), no jsdom in this repo. **This contract file's own path (`contracts/epic-6/...`) predates the Epic 6/7 split and is not renamed by it** — a future story touching this contract may rename the directory, but that's a separate, real code-adjacent change. Enhancement, 2026-08-12: also proves `TenantAdminControls.tsx` sends `name` and the `[tenantId]/route.ts` proxy forwards it (still never `domain`).

## How to extend this safely

- Keep calls to `social-listening-core` inside `src/lib/core-client.ts`; do not issue ad hoc `fetch` calls from any component here.
- Preserve the two-phase break-glass flow exactly (request, then a genuinely separate execute) — never collapse it into one automated action.

## Load-bearing constraints — do not change casually

- **No tenant-content data is allowed on this console**: no users list, watchlist content, post content, or credential material. The tenant registry (name/domain/status/seats) is administrative metadata, not tenant content, per ADR-0031 — allowed.
- **`targetUserId` on the break-glass request form is always typed in directly by the operator, never selected from a rendered list** — the Tenant-Admin-lookup-by-tenant-name gap (`social-listening-core/.claude/skills/platform-admin-break-glass-rest/SKILL.md`'s own named "Known gap") is real and unbuilt; this screen must not work around it by rendering a tenant's user list, which would itself violate the zero-tenant-content boundary.
- **The generated `temporaryAccessPass` is single-disclosure material** — rendered from `BreakGlassPanel.tsx`'s own local React state only, never `console.log`'d, never written to `localStorage`/`sessionStorage`, and this component never reloads the page immediately after a successful execute (that would erase the value before it could be read). This mirrors `breakGlassCredentialReset.ts`'s own already-shipped constraint that the value never appears in `platform_admin_audit_log`.
- This screen does not replace core authorization boundaries; Stories 5.12/5.13/5.14/1.10 enforce those server-side.

## Known gaps / deferred work

- **Infrastructure/operational metrics** (server health, storage, connectivity beyond the one database-health boolean added 2026-08-12) remain explicitly out of this story's scope, per `docs/design/README.md`'s own dated deferral — see `docs/user-stories/epic-7-platform-admin-ui.md`'s own top-of-file note on this epic's planned relationship to Epic 4 for where that eventually lands.
- **The Tenant-Admin-lookup-by-tenant-name gap** (see "Load-bearing constraints" above) is still not built anywhere in `social-listening-core` — unaffected by this rework.
