---
name: platform-admin-break-glass-rest
description: POST /v1/admin/tenants/:tenantId/break-glass/request and .../requests/:requestId/execute — the HTTP surface over breakGlassCredentialReset.ts's already-real two-phase mechanism. Read this before touching adminBreakGlassRouter.ts, before adding a Tenant-Admin-lookup-by-tenant-name feature, or before this becomes reachable from anywhere other than a platform_admin identity.
---

# Platform Admin break-glass REST surface

## What this is

`adminBreakGlassRouter.ts` exposes Story 5.7's already-shipped, real-Entra `requestBreakGlassCredentialReset()`/`executeBreakGlassRequest()` mechanism (`src/admin/breakGlassCredentialReset.ts`) over HTTP, as two genuinely separate routes — request records a pending request with no Entra action; execute is a Platform Admin's own separate, explicit pick-up that performs the real two-identity JIT grant → password reset + TAP issuance → revoke sequence. This router adds no new mechanism — it gates the existing one to a `platform_admin` resolved identity and wires request bodies to the existing function signatures, nothing more.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 §3 | The two-phase break-glass mechanism itself, and its two Clarifications (never auto-chained; password reset + TAP together in one JIT window) | 5.7 (mechanism), 5.13 (this HTTP surface) |

## Contracts that constrain this component

- `contracts/epic-5/story-5.13.platform-admin-break-glass-rest-surface.contract.test.ts` — request/execute are genuinely separate HTTP calls (a request never auto-executes); execute performs the real Entra sequence against the real tenant, exactly once in this file (reused for the retry-rejection check, never a second real Entra round trip); a second execute against an already-executed request is `409`; the TAP/password appear only in that one execute response, never elsewhere; both operations are audit-logged without the TAP/password in the log detail; `tenant_admin`/`tenant_user`/unauthenticated callers are rejected on both routes.

## How to extend this safely

- **The Tenant-Admin-lookup-by-tenant-name gap** (`platform-admin-access/SKILL.md`'s own named "Known gap": given a `tenantId`, find its Tenant-Admin's `external_subject`/Entra object ID) is still not built here — `POST .../break-glass/request` requires the caller to supply `targetUserId` directly. Whoever closes that gap should look up the ID and pass it into the existing `requestBreakGlassCredentialReset()` the same way this route already does — not reinvent the request-recording step.
- **A new field on the request/execute response:** add it to `BreakGlassRequest`/`BreakGlassResult` in `breakGlassCredentialReset.ts` first (the mechanism module owns those shapes); this router only forwards them.

## Load-bearing constraints — do not change casually

- **`breakGlassConfigFromEnv()` (`breakGlassCredentialReset.ts`) reads real Entra credentials from environment variables at request time, never cached at module load** — mirrors `app.ts`'s own `entraConfigFromEnv()` pattern. Real secrets (`ENTRA_ELEVATOR_CLIENT_SECRET`, `ENTRA_RESETTER_CLIENT_SECRET`) never appear in a response body or log line.
- **The execute route never accepts a request body field that could override `targetUserId` or which request gets executed** — the request is looked up by `:requestId` from the URL only; the mechanism itself re-derives the real target from the stored row, not from anything the execute call's own body could supply.
- **A `409` on retry is a fast, DB-only check** (`executeBreakGlassRequest()`'s own `status !== 'requested'` guard runs before any Graph call) — never remove this early-exit or a retried execute would attempt a second real Entra sequence against an already-reset user.
- **The TAP and generated password never appear in `platform_admin_audit_log`'s `detail` column** — re-proven at the HTTP layer (`AC7`), inherited unchanged from Story 5.7's own constraint. Don't add a "for debugging" field that includes either value.

## Known gaps / deferred work

- **Tenant-Admin lookup by tenant name — still not built**, see "How to extend this safely" above. This is the same gap `platform-admin-access/SKILL.md` has named since Story 5.7; still open.
- **No notification to the affected Tenant-Admin, and no verified out-of-band TAP delivery channel** — both ADR-0030's own still-open Open Questions, unaffected by this HTTP surface existing.
