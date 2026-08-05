---
name: me-endpoint
description: GET /v1/me — returns a signed-in caller's own resolved identity (tenant_user or platform_admin) over HTTP. Read this before touching meRouter.ts, before adding a field to ResolvedIdentity that should also appear here, or before another route needs the caller's raw identity regardless of shape.
---

# `GET /v1/me`

## What this is

`meRouter.ts` mounts one route, `GET /v1/me`, returning `resolveIdentity()`'s already-computed `ResolvedIdentity` for the calling request, unmodified — `{ type: 'tenant_user', tenantId, userId, role }` or `{ type: 'platform_admin', adminId }`. It exists so an authenticated caller (the admin UI, or any future REST caller) can learn its own resolved tenant/role/Platform-Admin identity without ever decoding an Entra token claim itself — ADR-0029 §2 forbids trusting any Entra-side claim for that purpose, so the server-resolved value is the only legitimate source. `social-listening-admin`'s Story 6.1 already built the client half of this (`fetchResolvedIdentity()` in `core-client.ts`), calling this exact path and degrading to `null` while it didn't exist.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0036 §5 | A new core-side identity-exposure endpoint is required, additive, read-only, deriving identity exclusively from `req.identity` — path/response shape left open, resolved by this story | 5.11 |
| ADR-0032 §5 | `resolveIdentity()`'s `ResolvedIdentity` shape, returned here unmodified | 5.9 |
| ADR-0033 | `createTenantAuthMiddleware()`, mounted ahead of this route the same as every other `/v1` sub-router | 5.10 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.11.get-v1-me.contract.test.ts` — mounted behind the shared auth middleware (inherits its 401/403 behavior, not reimplemented here); returns the exact `ResolvedIdentity` shape for all three real resolved identities (`tenant_admin`, `tenant_user`, `platform_admin`); a spoofed `tenantId`/`userId`/`adminId`/`role` via query parameter, request body, or header has zero effect; `GET` only; mounting it doesn't change `/v1/health` or any other route.

## How to extend this safely

- **A new field needs to appear in the response:** add it to `ResolvedIdentity` (`src/identity/identityResolution.ts`) first — this route returns that type verbatim, nothing to change here unless the route itself needs new logic.
- **Another route needs the caller's raw identity regardless of shape** (not just `tenant_user`, the way `requireTenantUser()`/`requireTenantUserIdentity()` already require): reuse `getResolvedIdentity()` (`src/http/auth/requireTenantUser.ts`) — don't read `req.identity` directly inline, and don't add a second accessor that does the same thing.

## Load-bearing constraints — do not change casually

- **Never reads any request input.** No query parameter, request body field, or header is inspected anywhere in this route — the entire point (ADR-0036 §5's Clarification, added after a Security & Architecture Reviewer finding) is that identity comes exclusively from `req.identity`. Adding a "debug override" parameter here, even temporarily, reopens the exact spoofing/disclosure risk that Clarification exists to close.
- **`getResolvedIdentity()` must only ever be called after `createTenantAuthMiddleware()`/`testAuthBypassMiddleware` has already run** (i.e. only from a handler mounted behind `authMiddleware` in `router.ts`) — it does not itself check whether `req.identity` is set, because the middleware already guarantees it is. Calling it from an unprotected route would return `undefined` cast as a `ResolvedIdentity`, not fail loudly.
- **Additive only.** This route must never be nested inside `/posts`, `/topics`, `/connectors`, or `/watchlists`, and must never change their behavior — it's mounted as its own sibling in `createV1Router()`.

## Known gaps / deferred work

- **`social-listening-admin`'s Story 6.1 contract has its own now-stale AC8 assertion** ("`fetchResolvedIdentity()` resolves to null rather than throwing while the endpoint does not exist") — needs a dated update now that the endpoint is real. Named as required follow-up by Story 5.11 itself; not built or edited here, `social-listening-admin`-only scope.
- **No caching** — every call re-reads `req.identity`, which is already in-memory for the request; no additional caching layer exists or is needed at this scale.
