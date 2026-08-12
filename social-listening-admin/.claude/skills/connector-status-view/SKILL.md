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

## Correction, 2026-08-12 — this story was never actually built despite being marked "Built"
Confirmed directly: `src/app/tenant/connectors/status/page.tsx` rendered a hardcoded `gnews`/`newswire`/`reddit` fixture array — never imported `core-client.ts`, never called `GET /v1/connectors/:platformId`. The original contract only did `fs.readFileSync` + string-literal checks, which could not detect this. Rebuilt for real — see `docs/user-stories/epic-6-tenant-admin-ui.md`'s own Story 6.5 entry and `docs/implementation-log.md` for the rebuild commit.

## Architecture
- `page.tsx` (Server Component) — role-gates on the `'tenant'` shell (Story 6.2), derives the connected-platform list the same way `tenant/connectors/page.tsx` (Story 6.3) does — a local `PLATFORMS` array checked per-platform via a real `getConnectorStatus()` call, `credentialStatus !== null` (or `authMode: 'none'`) meaning connected — then renders each connected platform's real `ConnectorHealth`. No mutations/forms on this screen at all (read-only).
- `PLATFORMS` is deliberately duplicated from `tenant/connectors/page.tsx`'s own array, not imported (a page component exports nothing to import) — the same small, intentional duplication `tenant/watchlists/page.tsx` (Story 6.4) already made and documented for its own narrower purpose. A shared `connectedPlatforms.ts` helper would be a reasonable future refactor once a third or fourth screen needs this same derivation, but building it is out of this story's own Acceptance Criteria.

## Contracts that constrain this component

- `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts` — real behavioral assertions (a real-session-plus-fetch-mocking page render, plus structural source checks), no jsdom in this repo (testEnvironment is `'node'`).

## How to extend this safely

- Keep the screen focused on health/status data only — never render `rawPayload`, post text, or watchlist query content (ADR-0030 §2's Platform Admin analogue, applied here as a general "status views show status, not content" principle, per Story 6.9's own restatement).
- Adding a fifth platform: add one entry to `PLATFORMS` here — no other change needed, same as `tenant/connectors/page.tsx`'s own equivalent note.

## Load-bearing constraints — do not change casually

- Health values are rendered as `healthy`/`degraded`/`failing`/`disconnected`, sourced from the real `GET /v1/connectors/:platformId` response — never a fixture. `failing` gets a materially distinct render (not just the same text in a different color no test can see), per ADR-0023.
- A platform whose `getConnectorStatus()` call throws (transient core-side issue) degrades to "not connected" for that one platform, the same pattern `tenant/connectors/page.tsx` already established — a single platform's failure must not block the whole screen's render.

## Known gaps / deferred work

- **A real tenant-wide "list this tenant's connectors" endpoint still does not exist** (`docs/open-items-and-deferred-work.md` §B) — this screen derives the connected-platform list from a locally duplicated, hardcoded `PLATFORMS` array checked one at a time, the same v1 workaround Story 6.3's own screen already uses. Unchanged by the 2026-08-12 rework — this was never the reason the screen didn't work; the fixture-data problem was orthogonal.
- **`resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` (ADR-0021, Story 3.6 AC2) is not surfaced anywhere on this screen — a real, confirmed gap, not silently dropped.** `social-listening-core/src/watchlists/dispatch.ts`'s own doc comment already names this as future UI work with "no such view exists yet" — it is a core-internal function with no REST endpoint exposing its result over HTTP at all. Building one is real, non-trivial `social-listening-core` scope (a new endpoint design, not "just call an existing one") and is outside this story's own Source line (Story 4.3's `ConnectorHealth` only). The screen's own copy names this gap explicitly rather than rendering a fake/static warning.
