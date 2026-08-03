---
name: tenant-auth-middleware
description: The single, top-of-router-stack middleware (createTenantAuthMiddleware) that replaces req.header('X-Tenant-Id') everywhere — composes Story 5.6's real Entra token verification with Story 5.9's resolveIdentity(), plus the NODE_ENV==='test'-only bypass every contract test now uses instead. Read this before touching any /v1 router file, before adding a new tenant-scoped route, or before changing how tests establish identity.
---

# Tenant auth middleware

## What this is

`createTenantAuthMiddleware()` is ADR-0033's "one seam" — one middleware definition, threaded by `app.ts` into `createV1Router()` (`versions/v1/router.ts`), which mounts it ahead of every substantive `/v1` sub-router (`/posts`, `/topics`, `/connectors`, `/watchlists`) — never re-implemented per-route. It verifies a real Entra bearer token (reusing Story 5.6's `createEntraAuthMiddleware` unchanged) and resolves it to a tenant/user or Platform Admin (Story 5.9's `resolveIdentity()`), attaching the result to `req.identity`. Every route handler that used to read `req.header('X-Tenant-Id')` now reads `req.identity` via the shared `requireTenantUser()` helper instead — nothing else about those handlers, or any downstream store function, changed. In test mode (`NODE_ENV === 'test'`, Jest's own default), `app.ts` selects `testAuthBypassMiddleware` instead — reads a JSON-encoded identity straight from `X-Test-Identity`, no real Entra call. **`/v1/health` is the one deliberate exception** — mounted directly on the router with no auth middleware in front of it at all, since it predates any auth mechanism (Story 1.3, ADR-0017) and its own contract requires it reachable unauthenticated; see `.claude/skills/http-api-versioning/SKILL.md`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0033 | Retire `X-Tenant-Id`; one middleware seam; stray header must be inert; ADR-0017 exception reasoned through explicitly | 5.10 |
| ADR-0029 | Token verification this middleware reuses unchanged | 5.6 |
| ADR-0032 §5 | `resolveIdentity()` this middleware calls unchanged | 5.9 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.10.retire-x-tenant-id.contract.test.ts` — no route file references `X-Tenant-Id`; a stray `X-Tenant-Id` header has zero effect; `tenantId` still flows to the store layer correctly; missing/invalid auth is rejected 401 before any route handler runs; a Platform Admin identity is rejected 403 on tenant-content routes.
- The six pre-existing router contract tests this story reworked (`story-1.5`, `story-1.6`, `story-3.4`, `story-4.1`, `story-4.4`, `story-5.1`) now establish identity via `testIdentityHeaderValue()`/`X-Test-Identity` instead of `X-Tenant-Id` — their own business-logic assertions are otherwise unchanged, proving AC3 (function signatures untouched) by continuing to pass unmodified.

## How to extend this safely

- **A new `/v1` route needing tenant identity:** call `requireTenantUser(req, res)` at the top of the handler — it returns `tenantId` or has already sent a 403 and you should `return`. Never read `req.header('X-Tenant-Id')` or add a new per-route auth check; the middleware is already mounted for the whole `/v1` stack.
- **A new route needing Platform Admin identity instead** (a future Admin UI backend route): `req.identity` may be `{ type: 'platform_admin', adminId }` — write an equivalent `requirePlatformAdmin()` helper when that need actually exists; don't speculatively build it now.
- **A new contract test hitting a `/v1` route:** import `testIdentityHeaderValue()` from `src/testUtils/testIdentityHeader.ts` and `.set('X-Test-Identity', testIdentityHeaderValue(tenantId))` — never reintroduce `X-Tenant-Id` in a new test, even though the header is still accepted-but-ignored at the HTTP layer (see Load-bearing constraints).

## Load-bearing constraints — do not change casually

- **`testAuthBypassMiddleware` must only ever be mounted when `NODE_ENV === 'test'`.** `app.ts`'s branch on this is the entire safety boundary between "tests can inject any identity trivially" and "production accepts a spoofed identity trivially" — the same shape of gap ADR-0033 exists to close. Never add an env-var override, a query-param toggle, or any other way to reach the bypass path outside real Jest execution.
- **A stray `X-Tenant-Id` header is never read anywhere in this pipeline, not even for logging.** ADR-0033 §3 requires it be fully inert, not merely deprioritized — reading it at all (even to log a mismatch) reopens the exact spoofing surface this story closes if a future change ever mistakenly promotes a logged value into a decision.
- **`req.identity` is attached once, by the middleware, never re-derived or overridden inside a route handler.** If a handler needs to know the caller's role in addition to `tenantId` (not needed by any route yet), extend `requireTenantUser()`'s return shape centrally — don't read `req.identity` directly in a new route as a shortcut.
- **`resolveIdentity()`'s own "no write grant" boundary (Story 5.9) is unaffected by this middleware** — this component only calls it, never bypasses `identity_resolver_role`'s constraints.
- **`/v1/health` must never be wrapped in `authMiddleware`.** A regression here was caught and fixed once already, the same session this middleware was built: an earlier version mounted `authMiddleware` once at the top of the whole `/v1` router (`app.use('/v1', authMiddleware, v1Router)`), which broke Story 1.3's own contract requiring `/health` to be reachable with no credentials. Fixed by converting `v1Router` into `createV1Router(authMiddleware)`, which mounts the middleware per-protected-sub-router instead — see `docs/implementation-log.md`'s matching Healing entry and `.claude/skills/http-api-versioning/SKILL.md`.

## Known gaps / deferred work

- **Interactive user sign-in tokens with a real `email` claim are not exercised against a real Entra token anywhere** — `entraAuthMiddleware.ts`'s `email` extraction is wired for when Story 5.9's invite/link flow needs it, but this project has no interactive sign-in flow yet (same gap Story 5.6's own SKILL.md already named for `oid`).
- **`connectorsRouter.ts`'s connect/disconnect endpoints only changed *where* `tenantId` comes from** — real ownership-tier authorization (who may connect on behalf of a tenant vs. themselves) is Story 1.7/ADR-0034's job, not touched here.
- **No rate limiting or brute-force protection on the auth middleware itself** — out of scope for this story, not evaluated here.
