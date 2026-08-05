---
name: platform-admin-tenant-management
description: GET/POST/PATCH /v1/admin/tenants — the Platform Admin-only REST surface over tenantStore.ts, including the domain field's admin-recovery grant (ADR-0037 §9). Read this before touching adminTenantsRouter.ts, before adding a new admin-facing tenant field, or before wiring another platform_admin-only route.
---

# Platform Admin tenant management REST surface

## What this is

`adminTenantsRouter.ts` mounts `GET /v1/admin/tenants` (list), `POST /v1/admin/tenants` (create), and `PATCH /v1/admin/tenants/:id` (update `status`/`licenseSeatCount`/`domain`) — the first HTTP surface over `tenantStore.ts`, which until this story was store/mechanism-level only (`.claude/skills/tenants/SKILL.md`'s own former "Known gaps" entry). Every route requires a `platform_admin` resolved identity (`requirePlatformAdmin()`, `src/http/auth/requireTenantUser.ts`) — a `tenant_admin`/`tenant_user` identity gets `403`. Every write reuses `createTenant()`/`updateTenantAdmin()`'s own existing `logPlatformAdminAction()` call — no new audit path.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 | Platform Admin's audited `BYPASSRLS` role and its authorization boundary — this surface exposes it over HTTP, doesn't redesign it | 5.7 (mechanism), 5.12 (this HTTP surface) |
| ADR-0031 | `tenants` table shape, the `status`/`license_seat_count` column-scoped grant | 5.8 (mechanism), 5.12 (this HTTP surface) |
| ADR-0037 §9 | `platform_admin_role` gains `UPDATE(domain)` on `tenants` — decided 2026-08-04, the actual grant migration was never built until this story | 5.12 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.12.platform-admin-tenant-management.contract.test.ts` — full CRUD-surface list/create/update proven against a real `platform_admin` identity; `tenant_admin`/`tenant_user` and unauthenticated callers rejected (403/401); `active_seat_count` cannot be set via `PATCH` (DB-enforced, re-proven at the HTTP layer); `domain` can be set and cleared (`null`); every write appears in `platform_admin_audit_log`.

## How to extend this safely

- **A new admin-facing tenant field:** add it to `tenantStore.ts`'s `Tenant`/`TenantRow`/`UpdateTenantAdminInput` first, decide its column-level grant in a new migration (never edit `0017`/`0020` after they ship) the same way `0020` added `domain`, then surface it here — don't invent a second admin router for one more field.
- **A new platform_admin-only route anywhere else in this project:** call `requirePlatformAdmin()` (`requireTenantUser.ts`) — don't read `req.identity` directly; it's the sanctioned accessor for exactly this identity type, mirroring `requireTenantUser()`/`requireTenantUserIdentity()`'s own pattern for tenant callers.

## Load-bearing constraints — do not change casually

- **`PATCH` never accepts `activeSeatCount`.** Not just application-level filtering — `platform_admin_role` is DB-level denied from writing that column (migration `0017`'s column-scoped `GRANT`), so even a bug in this router's own body-parsing couldn't actually widen it; the route returns `400` for an attempt as a caller-facing signal, not as the real enforcement boundary.
- **`domain: null` in a `PATCH` body means "clear it," `domain` omitted means "don't touch it."** These are read from `req.body` directly (JS already distinguishes an absent key from an explicit `null`) — don't collapse this to a single "falsy means clear" check, which would also clear on an empty string.
- **This router never touches any tenant-content table** (`users`, `watchlists`, `social_posts`, `platform_credentials`) — `platform_admin_role`'s grant is `tenants` and its own Platform Admin identity table only (ADR-0030 §2). Adding a query against any of those here would silently defeat that boundary.

## Known gaps / deferred work

- **List endpoint has no pagination or filtering** — fine at this project's current tenant count; revisit if the platform ever has enough tenants for this to matter.
- **Domain-collision (unique-constraint violation) on create/update has no dedicated `409`** — no Acceptance Criterion requires it yet; an attempt propagates as an ordinary `500`, the same as any other unhandled DB error elsewhere in this codebase.
