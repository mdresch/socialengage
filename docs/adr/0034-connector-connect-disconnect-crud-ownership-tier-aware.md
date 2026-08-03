# ADR-0034: Connector connect/disconnect CRUD — ownership-tier-aware credential creation, reworking Story 1.6's placeholder-auth shape

**Status:** Accepted (2026-08-03) — drafted by the AI Business & Requirements Analyst persona, accepted by Menno with its own flagged interpretive question directly confirmed (Acceptance note below). Sixth of a seven-ADR batch; assumes ADR-0029 (authentication), ADR-0030 (Admin-tier), ADR-0031/ADR-0032 (`tenants`/`users`), and ADR-0033 (retiring `X-Tenant-Id`) — and must satisfy ADR-0028's already-Accepted credential-ownership-tier rules, which this ADR is the first to actually build against.
**Acceptance note (2026-08-03):** Accepted by Menno, verbatim: "approved ADR 0034." §3's own flagged interpretive question — whether Tenant-Admin's revocation authority over a user-bound credential is the right reading of ADR-0028's silence on the point — was put to Menno directly rather than waved through, and **confirmed as drafted**: Tenant-Admin may delete (not create or activate) a departed/unresponsive user's own personal credential, an offboarding safety valve; creation/activation remains solely the owning user's own act, per ADR-0028, unaffected by this confirmation. The remaining Open Questions (exact route/parameter shape for disconnect's dual-actor case; the two inherited brainstorm questions; the missing `implementation-log.md` entry for Story 1.6) stay open.
**Source:** `docs/adr/README.md`'s 2026-07-30 governance note (candidate ADR #6); ADR-0028 (credential-creation authority scoped by ownership tier — the rule this ADR's schema and authorization checks must enforce); `Business-Case-v6.0.md` §6's Dependency Matrix ("Candidate ADR #6... Could theoretically be built against the placeholder, but would need rework once real auth lands — not recommended" — that rework is this ADR's own subject); the already-shipped `connectorsRouter.ts`/`credentialStore.ts` code this ADR reworks.

## Context

`Business-Case-v6.0.md`'s own dependency matrix flagged, before any code existed, that connector connect/disconnect endpoints "could theoretically be built against the placeholder, but would need rework once real auth lands — not recommended." They were built anyway (Phase 1's "also build, not storied" scope), verified directly against the current codebase this session:

- `social-listening-core/src/http/versions/v1/connectorsRouter.ts` implements `POST /v1/connectors/:platformId/connect` and `DELETE /v1/connectors/:platformId/disconnect`, both trusting `req.header('X-Tenant-Id')` as the entire tenant boundary, with **no role or ownership check of any kind** — any caller presenting any `X-Tenant-Id` value can connect or disconnect that tenant's credential for any platform.
- `social-listening-core/src/credentials/credentialStore.ts`'s `storeCredential(tenantId, platformId, plaintext, keyVaultKeyId)` and `deleteCredential(tenantId, platformId)` both key exclusively on `(tenant_id, platform_id)` — `platform_credentials` has no concept of *who within the tenant* owns a given credential, because no `users` table or ownership-tier model existed when it was built.
- A real contract test exists and passes (`social-listening-core/contracts/epic-1/story-1.6.connector-connect-disconnect.contract.test.ts`, 8 assertions, AC0–AC7), confirmed directly this session — the code is real and working against its own, pre-ADR-0028 contract.
- **A genuine documentation gap, found and flagged rather than fixed here:** `docs/implementation-plan.md` and `docs/open-items-and-deferred-work.md` both describe "Story 1.6" as complete, citing specific files and an 8-contract pass — but `docs/implementation-log.md`, the append-only, git-hash-verified record `docs/templates/check-implementation-log.cjs` checks, has **no corresponding entry at all**. The code and its contract test genuinely exist on disk (verified directly, this session, not merely trusted from prose) — this is a real traceability gap in exactly the sense this persona's own mandate treats as evidence, not process pedantry. Flagged for Menno or the AI Delivery Agent to close (append the missing entry, or state why one was never required) — appending a log entry is that skill's own job, not this ADR's, and is not done here.

ADR-0028 already requires: no system-wide credential ever; a tenant-wide credential created only by Tenant-Admin; a user-bound credential created only by the user's own act of activation, never by Tenant-Admin or Platform Admin on their behalf. Story 1.6's shipped code satisfies none of these distinctions, because it predates the `users`/Tenant-Admin model entirely — it is not wrong for what it was asked to prove (Phase 1's end-to-end pipeline), but it is now the concrete gap this ADR closes.

## Decision

### 1. `platform_credentials` schema — additive migration, no destructive change

```
platform_credentials
  ...(existing columns unchanged)...
  owner_type   text not null default 'tenant'  -- 'tenant' | 'user'
  user_id      uuid references users(id)       -- NULL for owner_type = 'tenant'
  constraint platform_credentials_owner_shape check (
    (owner_type = 'tenant' and user_id is null) or
    (owner_type = 'user'   and user_id is not null)
  )
```

Every credential shipped so far (Story 2.7's GNews keys) is a genuine, correctly-typed `owner_type = 'tenant'`, `user_id = NULL` row under this shape — ADR-0026's own "per-tenant credential, not a shared pool" model already was tenant-wide (ADR-0028 Tier 2); this migration is additive and backfills cleanly, not a reinterpretation of what already shipped.

### 2. RLS is unchanged — ownership tier is an authorization concern, not a visibility one

`platform_credentials`' existing `tenant_isolation` policy (scoped by `tenant_id` only) is **not** modified. A user-bound credential is still a row inside its owning tenant's boundary — ADR-0028's own Clarification already established that credential *ownership* and harvested-data *visibility* are separate concerns, and this ADR extends that same separation to the credential row's own RLS: **who may create or delete a credential is an application-layer authorization check** (§3 below), not a second RLS predicate on `user_id`. A second predicate was considered and rejected — see Alternatives Considered.

### 3. Authorization — new application-layer checks, where none currently exist

Enforced in `connectorsRouter.ts`'s handlers, using the caller identity ADR-0033's middleware resolves (`req.tenantId`, `req.userId`, `req.role`):

- **`POST /v1/connectors/:platformId/connect`**, body includes `ownerType: 'tenant' | 'user'` (default `'tenant'` if omitted, for the common case):
  - `ownerType: 'tenant'` — requires `req.role === 'tenant_admin'`; rejected (403) otherwise. Satisfies ADR-0028 Tier 2 directly.
  - `ownerType: 'user'` — `user_id` is **always** set to `req.userId`, the caller's own resolved identity; any client-supplied `user_id` in the request body is ignored, never trusted. Satisfies ADR-0028 Tier 3's "created only by the user's own act of activation... never by Tenant-Admin or Platform Admin on their behalf" directly — there is no code path by which anyone other than the acting caller can end up as `user_id`.
- **`DELETE /v1/connectors/:platformId/disconnect`** (tenant-wide credential) — requires `req.role === 'tenant_admin'`.
- **`DELETE .../disconnect-personal` (or an equivalent `ownerType`-discriminated shape)** (user-bound credential) — permitted for **either** the owning user themself, **or** a Tenant-Admin of the same tenant (an offboarding case: a departing employee's personal connection needs to be revocable by someone other than the departed user). **This is named here as this ADR's own new decision, not something ADR-0028 already settled** — ADR-0028's Decision text addresses *creation/activation* authority only ("Neither Tenant-Admin nor Platform Admin may create or activate a user-bound credential on a user's behalf"); it is silent on administrative *revocation*, and this ADR does not read that silence as also barring Tenant-Admin from deleting (not creating) a departed or unresponsive user's stale credential. Flagged honestly as this ADR's own interpretation, not a restatement of an already-decided rule — Menno's acceptance pass should confirm or reject this reading specifically.

### 4. Story 1.6's shipped code — concrete rework required, itemized

1. **Auth source:** `req.header('X-Tenant-Id')` → ADR-0033's middleware-resolved identity. Breaking change, riding the same authentication cutover ADR-0033 already justifies (not a second, separate breaking-change event).
2. **Schema:** the additive migration in §1 — existing rows remain valid, no data loss.
3. **Authorization:** §3's checks are entirely new code — today's shipped endpoints have **zero** role or ownership check; this is a real, currently-shipped gap this rework closes, not a refinement of an already-partial check.
4. **`deleteCredential(tenantId, platformId)` must be reworked to accept `(tenantId, platformId, ownerType, userId?)`.** Its current signature deletes **all** credentials for a `(tenant, platform)` pair indiscriminately. Once a tenant-wide and one or more user-bound credentials can legitimately coexist for the same `platformId` (ADR-0028's own Reddit worked example: a tenant-wide app-only credential *and* an individual's personal OAuth grant, both for `platformId: 'reddit'`), the current blanket-delete semantics would let a Tenant-Admin's ordinary tenant-wide disconnect **silently also delete an unrelated user's personal credential** — a real, latent correctness bug once Tier 3 credentials exist, not a cosmetic gap. **This is the single most load-bearing item in this rework list.**
5. **`getLatestCredentialId(tenantId, platformId)` has the same latent problem** — once more than one credential can exist per `(tenant, platform)` pair, "most recently created" is no longer a safe proxy for "the correct one to use for this poll" (a connector's own ingestion run needs the tenant-wide credential specifically, or a specific user's, not whichever was created last). Needs the same `(ownerType, userId?)` parameterization.
6. **Pending supersession note, per this project's own convention:** because no formal `docs/user-stories/` entry for "Story 1.6" currently exists (it was Phase 1 "also build, not storied" work, documented only in `docs/implementation-plan.md` and `docs/open-items-and-deferred-work.md`), this ADR's own story (see `docs/user-stories/README.md`/Epic 1 updates accompanying this batch) is recorded as **Story 1.6** (retroactively formalizing the existing informal label for what already shipped) **and Story 1.7** (this ADR's own ownership-tier rework, which supersedes Story 1.6's authorization/schema shape) — not a renumbering of already-shipped work, an explicit, dated addition alongside it.

### 5. Endpoint shape — one route, body-discriminated, not two parallel route trees

A single `POST /v1/connectors/:platformId/connect` route, discriminated by the `ownerType` body field (§3), rather than separate `/connect` and `/connect-personal` routes for creation — fewer routes for a solo project to maintain, and the authorization branch is already necessarily in the handler regardless of route shape. **Disconnect is the one asymmetric case** (§3): revocation's dual-actor rule (owner or Tenant-Admin) is different enough from creation's single-actor rule that a discriminated sub-path (or an equivalent query parameter) is named as the likely shape, without fixing its exact syntax — an implementation-time decision, not fixed permanently by this ADR.

## Consequences

**Positive**
- Directly builds ADR-0028's Tier 2/Tier 3 rules into real, enforced code for the first time — ADR-0028 itself has no story because nothing was buildable against it yet (its own "A note on this ADR's own place in the series' conventions"); this ADR is exactly the "candidate ADR #6" it named as the eventual home for that build.
- Item 4 (§4.4) closes a real correctness bug before it can ever manifest against real user data — caught during this ADR's own drafting, not after a real Tenant-Admin accidentally wipes a colleague's personal credential.
- The single-route, body-discriminated design (§5) keeps this project's route surface from growing faster than its actual authorization complexity requires.

**Negative**
- This ADR's own reading of ADR-0028 on revocation authority (§3, Tenant-Admin may delete but not create/activate a user-bound credential) is a genuine interpretive extension, not something ADR-0028 explicitly decided — named honestly rather than presented as settled; Menno's acceptance pass should confirm or reject it specifically, not wave it through as already-decided.
- §4's rework (schema migration, new authorization checks, `deleteCredential`/`getLatestCredentialId` signature changes) touches already-shipped, already-tested code — a real, non-trivial rework cost this project's own `Business-Case-v6.0.md` flagged as foreseeable before Story 1.6 was ever built, and is now due.
- The missing `docs/implementation-log.md` entry for Story 1.6 (Context, above) is a real, standing traceability gap this ADR surfaces but does not close — named plainly as unresolved, per this persona's own evidentiary standard, rather than assumed fixed by drafting this ADR.

## Alternatives Considered

- **A second RLS predicate on `user_id`** (in addition to the existing `tenant_id` predicate), enforcing ownership at the database layer rather than the application layer — considered, rejected (§2): ADR-0015's own RLS purpose is tenant-boundary enforcement; layering business-rule authorization (who may act on whose row within a tenant) into RLS as well would blur that boundary and duplicate logic the application layer already must have anyway (e.g., to decide which `ownerType` a request is even attempting). Revisit only if a demonstrated need for database-enforced per-user isolation (not just per-tenant) arises.
- **Two separate routes for tenant-wide vs. user-bound connect** (`/connect` and `/connect-personal`) instead of one body-discriminated route — considered, rejected as unneeded route proliferation for a solo project (§5); revisit if the two paths' request/response shapes diverge enough to make a shared handler awkward.
- **Reworking Story 1.6 in place, without a new story number** — rejected: this project's own convention (ADR-0009/0010's "Supersession update" notes) is to document a change to already-shipped behavior via a dated note plus a new story where new interface surface is introduced, not to silently rewrite what a prior story claimed; §4.6 follows that convention.

## Open Questions for decision

- ~~**Whether Tenant-Admin's revocation authority over a user-bound credential (§3) is the right reading of ADR-0028's silence on the point** — flagged explicitly for Menno's confirmation, not treated as settled by this ADR alone.~~ — **Resolved at acceptance, 2026-08-03:** confirmed as drafted. See Acceptance note.
- **Exact route/parameter shape for disconnect's dual-actor case** (§5) — left to implementation.
- **The two brainstormed, still-open questions this ADR inherits directly** (`docs/adr/README.md`'s 2026-07-30 note): whether connector *activation* needs its own table separate from `platform_credentials` (this ADR's answer, implicitly: no, `owner_type`/`user_id` columns on the existing table suffice for what's currently named); and whether a tenant needs multiple activations of one platform (e.g. several Facebook Pages) — **not resolved by this ADR**, since nothing currently named in this project's connector roster (GNews, Newswire) needs it; the schema in §1 does not structurally prevent multiple tenant-wide rows for the same `platformId` (no uniqueness constraint on `(tenant_id, platform_id)` is added here), but resolving *whether that should be allowed and how it's surfaced in the UI* is left open, not decided.
- **The missing `implementation-log.md` entry for Story 1.6** (Context) — flagged for correction, not performed by this ADR.

## Amendment Log

- 2026-08-03 — Initial proposal, drafted by the AI Business & Requirements Analyst persona.
