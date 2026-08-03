---
name: entra-authentication
description: Bearer-token validation against Microsoft Entra External ID's real JWKS/OIDC discovery document. Read this before touching src/http/auth/entraAuthMiddleware.ts, before wiring authentication into the real /v1 router stack (Story 5.10), or before resolving `sub` to a SocialEngage identity (Story 5.9).
---

# Entra External ID authentication middleware

## What this is

Standalone Express middleware (`createEntraAuthMiddleware`) that validates an `Authorization: Bearer` token's signature and issuer against Microsoft Entra External ID's real JWKS endpoint, using standard OIDC/JWT verification (`jose`) only — never an Entra-specific SDK or Graph API call. On success it attaches `req.auth = { sub, email }` (both opaque strings — `email` added by Story 5.10 for `resolveIdentity()`'s own invite-link lookup) and calls `next()`; on any failure it responds `401` and never calls `next()`. **Mounted as of Story 5.10** — not directly, but composed inside `createTenantAuthMiddleware()` (`.claude/skills/tenant-auth-middleware/SKILL.md`), which is what's actually wired onto the `/v1` router stack.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0029 | Authentication mechanism — Entra External ID as a thin, pluggable OIDC issuer; `sub` as opaque foreign key; Postgres owns tenant/role data | 5.6 |

## Contracts that constrain this component

- `contracts/epic-5/story-5.6.entra-authentication.contract.test.ts` — real-tenant signature/issuer verification, `sub` extraction, tampered-signature rejection, foreign-issuer rejection, expired-token rejection, missing/malformed `Authorization` header rejection, and a structural check that no Entra SDK/Graph import exists in this module.

## How to extend this safely

- **Wiring into the real request path — done, Story 5.10.** `createTenantAuthMiddleware()` composes this function unchanged with `resolveIdentity()` and is mounted once, at the top of the `/v1` router stack. Do not add a second, parallel auth check anywhere else, and do not call `createEntraAuthMiddleware` directly from a new route — go through `tenant-auth-middleware`.
- **Identity resolution (Story 5.9):** consume `req.auth.sub` as an opaque string only. Never parse it, never assume a shape, never use it directly as a `tenantId` — it is looked up against `users.external_subject` (candidate ADR #4 / ADR-0032), not trusted on its own.
- **Config values** (`issuer`, `jwksUri`, `audience`) are real, tenant-specific strings — see `.env.example`'s `ENTRA_*` vars. `jose`'s `createRemoteJWKSet` caches keys internally; do not add a second JWKS-fetching mechanism.

## Load-bearing constraints — do not change casually

- **No Entra-specific SDK or Graph API call may be added to this module** — ADR-0029 §2's Decision-level requirement, checked structurally by this story's own contract test (`AC2`). If a future change seems to need MSAL or Graph here, that's a signal the change belongs somewhere else (e.g., ADR-0030's break-glass action, which *is* allowed to call Graph, per its own §3).
- **`sub` must never be parsed for tenant/role/license meaning** — ADR-0029 §1/§2. It is a bare, opaque identifier.
- **This middleware does not, itself, decide whether a `sub` corresponds to a real SocialEngage user** — that's Story 5.9's identity-resolution step, deliberately kept separate (ADR-0030 §4's chicken-and-egg reasoning: you can't scope a tenant lookup by `tenant_id` before you know what it is).

## Known gaps / deferred work

- **Now mounted (Story 5.10)** — see `.claude/skills/tenant-auth-middleware/SKILL.md`. `X-Tenant-Id` no longer has any trust role anywhere in this codebase. This bullet is kept, corrected, rather than deleted, per this doc series' "don't rewrite history" convention.
- **The `oid`-vs-`sub` question (ADR-0029's own Open Question) is only partially informed by this story.** This story's real, live-tenant test proved `oid` **is** present for a **client-credentials (app-only)** token, equal to `sub` — but ADR-0029's actual question was about **interactive user sign-in ID tokens**, which follow different claim rules. Still unverified; whoever builds Story 5.9's actual sign-in flow should check a real interactive-flow token before relying on `oid` for anything.
- **Token revocation/refresh is out of scope** — this middleware only validates whatever token it's handed; session/refresh-token handling belongs to whichever app (the admin UI) performs the interactive sign-in.
