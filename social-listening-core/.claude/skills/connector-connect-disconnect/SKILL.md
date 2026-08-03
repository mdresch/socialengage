---
name: connector-connect-disconnect
description: POST/DELETE /v1/connectors/:platformId/connect|disconnect — ownership-tier-aware credential creation/revocation (tenant-wide vs. user-bound), the requireTenantUserIdentity() authorization helper, and deleteCredential()/getLatestCredentialId()'s (tenantId, platformId, ownerType, userId?) scoping. Read this before touching connectorsRouter.ts's connect/disconnect handlers, before adding a new ownership tier, or before calling deleteCredential()/getLatestCredentialId() from anywhere new.
---

# Connector connect/disconnect (ownership-tier-aware)

## What this is

`POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect` — the HTTP surface for creating and removing a tenant's platform credentials, now enforcing ADR-0028's ownership tiers for real: a tenant-wide credential (Tier 2) may only be created by a `tenant_admin`; a user-bound credential (Tier 3) is always created for the caller's own resolved identity, never a client-supplied one. Supersedes Story 1.6's shape, which trusted `X-Tenant-Id` with no role or ownership check at all — see that story's own retroactive Implementation Log entry for what it was and why it was replaced, not deleted from the record.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0034 | Ownership-tier-aware connect/disconnect; `platform_credentials.owner_type`/`user_id`; `deleteCredential()`/`getLatestCredentialId()` re-scoping; disconnect's dual-actor rule for user-bound credentials | 1.7 (supersedes 1.6) |
| ADR-0028 | The Tier 2/Tier 3 ownership rules this story is the first to actually build against | 1.7 (first real build) |

## Contracts that constrain this component

- `contracts/epic-1/story-1.7.ownership-tier-connect-disconnect.contract.test.ts` — `platform_credentials`' additive `owner_type`/`user_id` schema; `ownerType: 'tenant'` connect requires `tenant_admin` (403 otherwise); `ownerType: 'user'` connect always sets `user_id` to the caller's own identity, ignoring a spoofed body value; tenant-wide disconnect requires `tenant_admin`; user-bound disconnect succeeds for the owning user or a `tenant_admin`, no one else; disconnecting one owner-type's credential never removes a coexisting other-owner-type credential for the same platform; no route references `X-Tenant-Id`, and a stray one has no effect.
- `contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts` — Story 1.6's own contract, still passing: basic connect/disconnect mechanics and tenant isolation, now exercised against the reworked handlers via the same `X-Test-Identity` mechanism every other router test uses (Story 5.10).

## How to extend this safely

- **A new ownership tier** (if one is ever needed beyond `'tenant'`/`'user'`): widen `owner_type`'s check constraint and `ResolvedIdentity`'s own type (`src/identity/identityResolution.ts`) together — don't add a tier here without a matching identity-resolution shape to back it.
- **Any new authorization check needing the caller's role or userId, not just tenantId:** use `requireTenantUserIdentity()` (`src/http/auth/requireTenantUser.ts`), not `requireTenantUser()` — the latter only returns `tenantId` and is what every other, non-ownership-aware `/v1` route still uses.
- **Any new caller of `deleteCredential()`/`getLatestCredentialId()`:** both now require `ownerType` explicitly (no default) — "most recently created" or "delete everything for this platform" are no longer safe once a tenant-wide and one or more user-bound credentials can coexist for the same `platformId`. `pollGNewsSearch.ts`'s own call passes `'tenant'` explicitly, since GNews credentials are always tenant-wide (ADR-0026).
- **`storeCredential()`'s `ownerType`/`userId` params are optional, defaulting to `'tenant'`/`undefined`** — deliberately backward-compatible so Story 5.3/2.7/4.3's existing fixture calls (which predate ownership tiers) keep working unchanged.

## Load-bearing constraints — do not change casually

- **A client-supplied `user_id` in the connect request body is never trusted, for any `ownerType`.** `user_id` is always the caller's own resolved identity from `req.identity` — ADR-0028 Tier 3's "created only by the user's own act of activation... never by Tenant-Admin or Platform Admin on their behalf" has no exception. Proven directly (AC3): a spoofed `userId` in the body has zero effect on the stored row.
- **Ownership authorization is application-layer, not a second RLS predicate** (ADR-0034 §2, explicitly considered and rejected as Alternatives Considered). `platform_credentials`' RLS stays scoped by `tenant_id` only — don't add a `user_id` policy predicate; that would blur the tenant-isolation boundary RLS exists for with a business-rule check that belongs in the router.
- **Disconnect's dual-actor rule for user-bound credentials (owning user OR `tenant_admin`, no one else) is ADR-0034's own confirmed interpretation of ADR-0028's silence on revocation** — not something ADR-0028 itself decided. Don't extend this to "any tenant member may revoke" or narrow it to "only the owner" without re-reading ADR-0034 §3's own reasoning first.
- **`deleteCredential()` must never fall back to deleting every credential for a `(tenantId, platformId)` pair** — that was Story 1.6's own latent bug once Tier 3 credentials could coexist with a Tier 2 one for the same platform (ADR-0034 §4 item 4, its own "single most load-bearing item"). Always pass `ownerType` (and `userId` when `'user'`) explicitly.

## Known gaps / deferred work

- **Whether a tenant needs multiple activations of one platform** (e.g. several Facebook Pages) is still open — ADR-0034's own inherited brainstorm question, not resolved here. No uniqueness constraint on `(tenant_id, platform_id)` was added, so the schema doesn't prevent it, but nothing decides *whether it should be allowed* or *how it's surfaced*.
- **Whether connector activation needs its own table separate from `platform_credentials`** — ADR-0034's own answer is implicitly no (`owner_type`/`user_id` on the existing table suffice for what's currently named), but this remains an inherited, not freshly-resolved, question.
- **No admin UI exists for either tier** — connect/disconnect are API-only; the admin UI's connect flow is still "also build, not storied" work (`docs/implementation-plan.md` Phase 1).
- **No real OAuth flow exists for any platform** — this story only changes who may create/delete a credential row, not how a credential's value is obtained (see `.claude/skills/credential-envelope-encryption/SKILL.md`'s own gaps).
