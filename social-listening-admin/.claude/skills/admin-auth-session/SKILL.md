---
name: admin-auth-session
description: social-listening-admin's own authentication/session mechanism — Entra External ID sign-in (Authorization Code + PKCE) and the server-side session that backs it. Read this before touching src/lib/entra.ts, src/lib/session.ts, src/proxy.ts, or anything under src/app/api/auth/ or src/app/sign-in|signed-out.
---

# Admin auth/session

## What this is

`social-listening-admin`'s own sign-in flow, terminated entirely server-side (Route Handlers, never a Client Component), and the session mechanism every later admin-UI story builds on. A signed-in caller's tokens are never placed anywhere browser-side JavaScript can read them — the standard Backend-for-Frontend (BFF) pattern. This is the direct UI-side analogue of `entraAuthMiddleware.ts`/`tenantAuthMiddleware.ts` on the core side, and the first real screen/session mechanism this project has shipped.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0036 | Admin UI's own auth/session mechanism: server-side (BFF) session, no bearer token in browser JS, role-gating sourced from a new core identity endpoint | 6.1 |
| ADR-0029 §2 | Role/tenant/license status is Postgres-owned, never inferred from an Entra token claim | 5.6 (core), applied here at §5's `fetchResolvedIdentity()` |

## Contracts that constrain this component

- `contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts` — real Next.js scaffold + Story 1.1 boundary undisturbed; unauthenticated redirect to `/sign-in`; a real, live Authorization Code + PKCE sign-in against the real Entra tenant (not a mock); exact-match `redirect_uri` rejected by Entra itself when mismatched; `SESSION_SECRET` entropy/never-committed; the session cookie's own shape/flags and unreadability from page JS; `core-client.ts` as the sole Bearer-attachment choke point; `fetchResolvedIdentity()` degrading gracefully on a bad/unreachable call; the 8-hour absolute session ceiling; sign-out clearing the session; `ENTRA_SCOPES` requesting a resource-scoped token for core's own API (AC13, healed 2026-08-10 — see Known gaps).

## How to extend this safely

- Every future admin screen needing the signed-in caller's identity/role reads it from the session (`decryptSession()`'s returned `identity` field), never by decoding the Entra ID token's own claims directly (ADR-0029 §2).
- Every future authenticated call to core goes through `core-client.ts`'s `authenticatedCoreFetch()` — never a second ad hoc `fetch` with a hand-built `Authorization` header. Story 6.1's own contract enforces this structurally; keep it true.
- New public (unauthenticated) routes must be added to `src/proxy.ts`'s `PUBLIC_PATHS` list explicitly — everything else is gated by default.
- Session lifetime/rotation questions (idle timeout, refresh-token use) are still an open question per ADR-0036's own Amendment Log — don't invent a rotation mechanism without re-reading that ADR's Open Questions first.

## Load-bearing constraints — do not change casually

- **`src/proxy.ts`, not `src/middleware.ts`.** Next.js 16 compiles `proxy.ts` in the Node.js runtime and the deprecated `middleware.ts` convention in the Edge runtime. This is load-bearing here, not cosmetic: `session.ts`'s server-side session store (below) only works because `proxy.ts` and the auth Route Handlers both run in the same Node.js process.
- **`session.ts`'s session store is a `globalThis`-anchored `Map`, not a plain module-level variable — confirmed necessary, not a style preference.** Verified directly: Next.js/Turbopack compiles `proxy.ts` and Route Handlers as separate module bundles even though both execute in the same OS process, so a plain `const sessionStore = new Map()` gives each bundle its own empty Map — `proxy.ts` would never see a session a Route Handler just created (this was a real, reproduced bug during Story 6.1's own implementation, not a hypothetical). `globalThis` is the one thing both bundles actually share.
- **The session cookie holds only a small encrypted `{ sid }` reference, never the tokens themselves.** Confirmed directly (not assumed): Entra CIAM's real `id_token` + `access_token` + `refresh_token` together comfortably exceed the ~4KB per-cookie limit browsers enforce, and a browser silently drops an oversized `Set-Cookie` header rather than erroring — an earlier all-tokens-in-the-cookie design round-tripped correctly at the HTTP-header level but the cookie never actually reached the browser's jar. Don't add more token/claim data directly into the cookie payload; extend the server-side `StoredSession` shape instead.
- **`SESSION_COOKIE_OPTIONS.secure` is `process.env.NODE_ENV === 'production'`, not hardcoded `true`.** Confirmed directly: a real browser silently drops a `Secure`-flagged cookie set over plain `http://localhost` regardless of `next dev` vs `next start`. Real deployments run over https, where this correctly evaluates `true`.
- **`fetchResolvedIdentity()` takes an explicit access token, not the session cookie.** Its only caller is the sign-in callback itself, bootstrapping the session before the cookie is a readable request cookie — reading `cookies()` there would be a read-your-own-write bug, not a simplification.
- Never bypass PKCE or drop the exact-match `redirect_uri` check (ADR-0036 §3) — both are real, verified security controls, not defense-in-depth theater (confirmed via a real `AADSTS50011` rejection from Entra itself during this story's own contract).
- **This contract's own spawned `next dev` server sets `NEXT_DIST_DIR: '.next/test-story-6-1'` in its child env — do not remove.** Healed 2026-08-10: Next's dev-server lock file lives at `path.join(distDir, 'lock')`, keyed by project directory, not port. Story 6.7's own contract also spawns a real `next dev` from this same directory (a different port); without a distinct `distDir` each, the two intermittently collided under Jest's default parallel workers ("Another next dev server is already running"), confirmed gone under `--runInBand`. `next.config.js`'s own `NEXT_DIST_DIR` opt-in makes this safe under normal parallel execution instead of requiring every future contributor to remember `--runInBand`.

## Known gaps / deferred work

- ~~`GET /v1/me` does not exist in `social-listening-core` yet~~ — built since (Story 5.11). `fetchResolvedIdentity()` now resolves a real identity on a successful, correctly-scoped sign-in.
- ~~The access token stored today is scoped to Microsoft Graph's default resource, not `social-listening-core`'s own API~~ — **healed 2026-08-10** (Menno's explicit direction, found via live manual sign-in testing): this was a real, live defect, not a hypothetical. `ENTRA_SCOPES` (`src/lib/entra.ts`) requested only `openid profile email offline_access`, so Entra never minted a token audienced for social-listening-core's API app — every authenticated call through `core-client.ts` failed core's own `jwtVerify()` at the signature step (confirmed via diagnostic logging added to both `entraAuthMiddleware.ts` and `core-client.ts` during a real sign-in: zero requests reaching core before, `signature verification failed` after — see `contracts/epic-6/story-6.1.nextjs-scaffold-and-entra-signin.contract.test.ts`'s own header healing note for the full chain). Fixed by exposing a delegated `access_as_user` scope on social-listening-core's app registration (Expose an API — distinct from its pre-existing `Application`-type `Api.Access` app role, which remains for `client_credentials`/M2M use and is unrelated to this flow), granting + admin-consenting it on social-listening-admin's own registration, and adding `api://social-listening-core/access_as_user` to `ENTRA_SCOPES`. Guarded by AC13.
- **The in-memory session store does not survive a server restart and would not be shared across multiple concurrent instances.** Accepted at this project's current single-instance, solo-developer scale — the same stance ADR-0020's own distributed rate-limit gate already takes (not built speculatively until a second concurrent instance is ever actually run).
- **Sign-out only clears this browser's session.** There is no server-side revocation list beyond the session store itself — deleting the store entry on sign-out (which this story does) is what actually invalidates a copied cookie value too, but a *stolen* cookie used before sign-out remains valid until the 8-hour ceiling, same as any bearer-token-style session without active revocation.
- Idle-timeout/refresh-token rotation within the 8-hour absolute ceiling — ADR-0036's own still-open question, not decided by this story.
- Auth.js/NextAuth.js's Entra External ID support was checked (not just assumed) at implementation time and found not solid enough to adopt — see the contract file's own header comment for what was checked.
