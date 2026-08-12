---
name: connector-status-view
description: Tenant-facing connector status screen for showing per-platform health in the admin UI, real backend data.
---

# Connector status view

## What this is

This component renders the tenant-facing connector status screen (`/tenant/connectors/status`) in the admin UI. It shows each connected platform's real, derived health state (`status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`), read-only, no tenant content.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0009 | Connector health is derived, not stored as a mutable record. | 6.5 |
| ADR-0022 | `ConnectorHealth`'s own shape (`status`/`lastSuccessfulFetchAt`/`lastAttemptAt`/`consecutiveFailures`), built by Story 4.3. | 6.5 |
| ADR-0023 | Failing connectors must be visually distinguished from degraded/healthy ones. | 6.5 |
| ADR-0021 | Boolean-query AST, `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` — see "Known gaps" below. | not yet built |
| ADR-0051 | Connector activation, decoupled from credential presence — the Active/Inactive indicator is now driven by real `isActive` (Story 1.12), never `authMode`/`credentialStatus`; real activate/deactivate controls added | 6.15 |

## Correction, 2026-08-12 — this story was never actually built despite being marked "Built"
Confirmed directly: `src/app/tenant/connectors/status/page.tsx` rendered a hardcoded `gnews`/`newswire`/`reddit` fixture array — never imported `core-client.ts`, never called `GET /v1/connectors/:platformId`. The original contract only did `fs.readFileSync` + string-literal checks, which could not detect this. Rebuilt for real — see `docs/user-stories/epic-6-tenant-admin-ui.md`'s own Story 6.5 entry and `docs/implementation-log.md` for the rebuild commit.

## Architecture
- `page.tsx` (Server Component) — role-gates on the `'tenant'` shell (Story 6.2), derives the platform list the same way `tenant/connectors/page.tsx` (Story 6.3) does — a local `PLATFORMS` array, each checked via a real `getConnectorStatus()` call — then renders each platform's real `ConnectorHealth` plus its real `isActive` (Story 1.12/6.15). **The Active/Inactive label is driven by `isActive`, never `credentialStatus !== null`/`authMode === 'none'`** (that old derivation is exactly the bug ADR-0051 was drafted to fix — Newswire used to render "Active" unconditionally). This screen is no longer purely read-only: `ActivateDeactivateButton` (Story 6.15, `../ActivateDeactivateButton.tsx`, shared with `tenant/connectors/page.tsx`) is rendered per platform, tenant-wide for `tenant_admin` sessions and personal for every `authMode !== 'none'` platform.
- `PLATFORMS` is deliberately duplicated from `tenant/connectors/page.tsx`'s own array, not imported (a page component exports nothing to import) — the same small, intentional duplication `tenant/watchlists/page.tsx` (Story 6.4) already made and documented for its own narrower purpose. A shared `connectedPlatforms.ts` helper would be a reasonable future refactor once a third or fourth screen needs this same derivation, but building it is out of this story's own Acceptance Criteria.

## Contracts that constrain this component

- `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts` — real behavioral assertions (a real-session-plus-fetch-mocking page render, plus structural source checks), no jsdom in this repo (testEnvironment is `'node'`). **Revised 2026-08-12 (Story 6.15, ADR-0051):** the assertion that Newswire "always renders Active, regardless of credentialStatus" was real, deliberate behavior under the old (pre-ADR-0051) model and is now wrong under the current one — rewritten with a dated note, not silently changed, to assert Newswire renders Inactive by default and Active only once `isActive` is true.
- `contracts/epic-6/story-6.15.connector-activation-controls.contract.test.ts` — the Active/Inactive label is driven by real `isActive`, on both this screen and `tenant/connectors/page.tsx`; `ActivateDeactivateButton` is rendered for every platform; the personal control is hidden for `authMode: 'none'`; the tenant-wide control is gated on `tenant_admin`.

## How to extend this safely

- Keep the screen focused on health/status data only — never render `rawPayload`, post text, or watchlist query content (ADR-0030 §2's Platform Admin analogue, applied here as a general "status views show status, not content" principle, per Story 6.9's own restatement).
- Adding a fifth platform: add one entry to `PLATFORMS` here — no other change needed, same as `tenant/connectors/page.tsx`'s own equivalent note.

## Load-bearing constraints — do not change casually

- Health values are rendered as `healthy`/`degraded`/`failing`/`disconnected`, sourced from the real `GET /v1/connectors/:platformId` response — never a fixture. `failing` gets a materially distinct render (not just the same text in a different color no test can see), per ADR-0023.
- A platform whose `getConnectorStatus()` call throws (transient core-side issue) degrades to `isActive: false` for that one platform, the same pattern `tenant/connectors/page.tsx` already established — a single platform's failure must not block the whole screen's render.
- **The Active/Inactive indicator is `isActive`, full stop — never re-derive it from `credentialStatus`/`authMode` again.** This was the exact conflation ADR-0051 exists to fix; reintroducing it anywhere (even as a "fallback" for a failed activation read) would reopen the Newswire always-active bug.
- **The personal `ActivateDeactivateButton`'s `isActive` prop is always `false` on this screen too** (see `connector-connect-disconnect/SKILL.md`'s matching note) — `GET /v1/connectors/:platformId` only exposes tenant-wide activation.

## Known gaps / deferred work

- **A real tenant-wide "list this tenant's connectors" endpoint still does not exist** (`docs/open-items-and-deferred-work.md` §B) — this screen derives the connected-platform list from a locally duplicated, hardcoded `PLATFORMS` array checked one at a time, the same v1 workaround Story 6.3's own screen already uses. Unchanged by the 2026-08-12 rework — this was never the reason the screen didn't work; the fixture-data problem was orthogonal.
- **`resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` (ADR-0021, Story 3.6 AC2) is not surfaced anywhere on this screen — a real, confirmed gap, not silently dropped.** `social-listening-core/src/watchlists/dispatch.ts`'s own doc comment already names this as future UI work with "no such view exists yet" — it is a core-internal function with no REST endpoint exposing its result over HTTP at all. Building one is real, non-trivial `social-listening-core` scope (a new endpoint design, not "just call an existing one") and is outside this story's own Source line (Story 4.3's `ConnectorHealth` only). The screen's own copy names this gap explicitly rather than rendering a fake/static warning.
- **Found 2026-08-12, Menno's own explicit direction to leave as-is for now:** for `azure-ai-language`/`azure-openai` (AI enrichment providers, not pollable connectors), this screen's "no ingestion runs yet / Last successful fetch: never" is structurally permanent, not a transient "hasn't run yet" state — confirmed directly, `ingestion_runs` rows are only ever created by `runIngestionAttempt()`, which only GNews/Newswire/tenant-owned-feed call. AI providers are invoked synchronously inline by `enrichPost()` and never get their own run row, even after real, successful enrichment (verified live: real posts enriched by `azure-ai-language`, this screen still showed "never"). `ConnectorHealth`'s entire model was built around "did this connector poll a source," which doesn't describe what an AI provider does — a real UX mismatch, deliberately left unaddressed for now rather than silently patched. Options considered, not decided: reword the copy for AI providers specifically, or give them real success/failure tracking based on actual `enrichPost()` outcomes instead of reusing `ConnectorHealth`.
