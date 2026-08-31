# Watchlist management screen

## Story
Story 6.4 — Watchlist management screen, real rework against ADR-0044's ownership/PATCH/locking contract.

## Intent
Provide a tenant-facing screen for listing, creating, editing, and deleting the caller's own watchlists — never another user's, even for a Tenant-Admin — without requiring direct API calls, respecting the real version-checked, ownership-private contract `social-listening-core` now enforces.

## Governing decisions
- Story 1.5 / ADR-0044 watchlist CRUD surface in `social-listening-core`: RFC 7396 JSON Merge Patch on `PATCH`, `If-Match`-checked optimistic locking (`428` missing, `409 version_conflict` stale), the `matchType` ↔ `terms`/`booleanQuery` invariant (`422 validation_failed`), and per-user ownership with no Tenant-Admin oversight override (§5c) — a request for another user's watchlist is `404`, never `403`.
- The UI supports all four match types (`keyword`, `hashtag`, `account`, `boolean`).
- Platform scoping (`platformIds`) is restricted to platforms the tenant has actually connected (Story 6.3) — deliberately only real `SocialConnector` platforms (`gnews`, `newswire`, `wikipedia` [Story 6.22], and `brave-search` [Story 6.30, ADR-0065]), not Story 6.3's broader connect/disconnect list, which also includes AI enrichment providers (`azure-ai-language`, `azure-openai`) a watchlist cannot legitimately be scoped to.
- **`SOCIAL_PLATFORMS` (`page.tsx`) is independently maintained from `tenant/connectors/page.tsx`'s own `PLATFORMS` array — a new real `SocialConnector` must be added by hand to both, separately (Story 6.22 for Wikipedia, Story 6.30 for Brave Search).** `authMode: 'none'` platforms (`newswire`, `wikipedia`) are always treated as "connected" by `loadConnectedPlatforms()`; `authMode: 'api_key'` platforms (`gnews`, `brave-search`) are only offered once `getConnectorStatus()` confirms a stored credential.

## Correction, 2026-08-12 — this story was never actually built despite being marked "Built"
Confirmed directly: `src/app/tenant/watchlists/page.tsx` rendered a hardcoded local fixture array — no `fetch`, no import from `core-client.ts`, no `/api/watchlists` Route Handler existed anywhere. The create/edit form had no `onSubmit`; the delete-confirm button had no `onClick`. The original contract only did `fs.readFileSync` + string-literal checks, which could not detect this. Rebuilt for real against ADR-0044's contract — see `docs/user-stories/epic-6-tenant-admin-ui.md`'s own Story 6.4 entry and `docs/implementation-log.md` for the rebuild commit.

## Architecture
- `page.tsx` (Server Component) — role-gates on the `'tenant'` shell (Story 6.2), calls `listWatchlists()` directly (no fixture, no API route needed for the read path), derives connected platforms via a small local `SOCIAL_PLATFORMS` list + `getConnectorStatus()` (deliberately not shared with `tenant/connectors/page.tsx`'s own broader `PLATFORMS` array — see "Governing decisions" above), and renders `WatchlistForm` (create) plus one `WatchlistRow` per watchlist.
- `WatchlistForm.tsx` (Client Component) — handles both `mode="create"` (full `POST /api/watchlists`) and `mode="edit"` (RFC 7396 merge-patch `PATCH /api/watchlists/:id`, via `buildEditPatch()` — only fields that actually differ from the initial watchlist, plus the two companion fields `terms`/`booleanQuery` whenever `matchType` itself changes, since ADR-0044 §5a's invariant is checked against the *resulting* merged row, not just the touched keys). `isActive` is deliberately never part of this form or its patch.
- `WatchlistRow.tsx` (Client Component) — per-row actions: an "Edit" toggle revealing `WatchlistForm` inline in edit mode; a dedicated Active/Inactive toggle sending only `{isActive: ...}` (never routed through `WatchlistForm`'s diffing, per the "toggling `isActive` alone still sends only that field" AC); a two-click delete confirm (never `window.confirm()`), matching `DisconnectButton.tsx`/`AccessControl.tsx`'s established pattern.
- `src/app/api/watchlists/route.ts` (`POST`) and `src/app/api/watchlists/[id]/route.ts` (`PATCH`/`DELETE`) — thin same-origin proxies to `core-client.ts`. The `PATCH` route forwards the client-supplied `version` straight through to `updateWatchlist()`'s `expectedVersion` argument, which is what actually sets the `If-Match` header — the Route Handler itself never touches that header.
- `core-client.ts` — `listWatchlists()` takes **zero parameters**, deliberately: there is nothing a caller could legitimately supply to see another user's watchlists, since ownership is derived entirely from the bearer token server-side (ADR-0044 §5c). `createWatchlist()`/`updateWatchlist()`/`deleteWatchlist()` all return the raw `{status, body}` outcome rather than throwing on a non-2xx — `422`/`409`/`428`/`404` are real, expected outcomes the UI must react to specifically, not failures collapsed into a generic error.

## Load-bearing constraints
- **Every response body from `watchlistsRouter.ts` is a `{code, ...}` shape, never `{error: "..."}`** — unlike several other Epic 6 backends (`tenant-users`, `connectors`), this router has no human-readable `error` string field anywhere. UI copy for every non-2xx status is therefore built from `code`/`details`/`current_version`, never a `body.error ?? '...'` fallback pattern — that field simply does not exist on this wire shape.
- `updateWatchlist(id, patch, expectedVersion)` sends `patch` **verbatim** — building the only-the-changed-fields object is always the caller's job (`WatchlistForm.tsx`'s `buildEditPatch()`, or `WatchlistRow.tsx`'s own inline `{isActive: ...}` literal), never this function's.
- A `204 No Content` (successful delete) has no JSON body — `deleteWatchlist()` must not call `response.json()` on it.

## Cross-component behavior
- Story 13.3 adds connector-aware warnings to `WatchlistForm` via `BooleanQueryBuilder` (see `.claude/skills/watchlist-builder/SKILL.md` and `.claude/skills/boolean-query-visual-builder/SKILL.md`). `WatchlistForm` disables the save button when the builder reports `hasErrors` (query-limit violations), not for unsupported-clause warnings.

## Contracts
- `contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts` (rewritten 2026-08-12 — real behavioral assertions: mocked-fetch core-client unit tests, Route Handler proxy tests, and structural source checks, per the same node-testEnvironment split Stories 6.3/6.8 already established; no jsdom in this repo).
- `contracts/epic-13/story-13.3.query-capability-warnings-in-watchlist-builder.contract.test.ts` — query-capability warnings and save gating in `WatchlistForm`.
