---
name: watchlist-builder
description: Use before changing the watchlist create/edit form, the BooleanQueryBuilder, or per-connector query-capability warnings. Covers the tenant-facing watchlist builder flow in social-listening-admin.
---

# Watchlist builder (frontend)

## What this is

The watchlist builder is the tenant-facing flow for creating and editing personal watchlists. It combines `WatchlistForm` (name, match type, platform scope, save handling) and `BooleanQueryBuilder` (the visual AST editor used when `matchType === 'boolean'`). The builder fetches per-connector query capabilities from `social-listening-core` and warns the user when a clause cannot be translated natively, while still allowing fallback matching.

## Governing ADRs and Stories

| ADR/Story | Decision | Story |
|---|---|---|
| ADR-0102 | Canonical `WatchlistAST` and visual builder | Story 12.4 |
| ADR-0110 | Per-connector query translation and validation; `GET /v1/connectors/:platformId/query-capabilities` | Story 13.2 (backend), Story 13.3 (frontend warnings) |
| ADR-0044 | Watchlist ownership, versioned PATCH, RFC 7396 merge-patch | Story 6.4 |

## Contracts that constrain this component

- `contracts/epic-13/story-13.3.query-capability-warnings-in-watchlist-builder.contract.test.ts` — per-clause warning chips, platform-specific tooltips, save disabled only for query-limit errors, platform selector re-fetches capabilities.
- `contracts/epic-12/story-12.4.boolean-query-visual-builder.contract.test.ts` — BooleanQueryBuilder modes, clause types, AST round-trip, BFF query-capabilities proxy.
- `contracts/epic-6/story-6.4.watchlist-management-screen.contract.test.ts` — WatchlistForm create/edit, PATCH/version handling, platform scoping.

## How to extend this safely

- Add new AST clause types in `src/lib/watchlist-ast.ts` first, then in `BooleanQueryBuilder`'s `CLAUSE_TYPE_LABELS` and `ClauseRowItem` value editors.
- Add new connector support by registering the translator in `social-listening-core`; the admin UI discovers it through `GET /v1/connectors/:platformId/query-capabilities` with no admin-side code change.
- Change warning/error categorization in `src/lib/watchlist-ast.ts` (`getWarningsByClausePath`, `validateAstQueryLimits`) and in `BooleanQueryBuilder`'s `onValidationChange` callback.
- Re-read ADR-0110/BRU-001–009 before changing whether the save button is disabled for a given class of validation result.

## Load-bearing constraints — do not change casually

- **Errors vs. warnings:** `BooleanQueryBuilder` must report `hasErrors` and `hasWarnings` separately through `onValidationChange`. `WatchlistForm` disables the save button only for `hasErrors` (currently `TOO_MANY_CLAUSES` / `QUERY_TOO_LONG` limit violations), never because of unsupported-clause warnings. Unsupported clauses are surfaced as warning chips and saved through the normal flow; the backend may still reject them with `422 UNSUPPORTED_QUERY_CLAUSE`, but the UI does not pre-emptively block save for warnings.
- **Per-clause warning paths:** Warning chips are keyed by clause path (`root.operator`, `root.clauses.N`, `root.clauses.N.clauses.M`, etc.). Reordering or re-keying these paths requires updating both `getWarningsByClausePath` and `ClauseRowItem`'s `path` prop.
- **BFF-only API calls:** `BooleanQueryBuilder` calls `/api/connectors/:platformId/query-capabilities` from the browser; it never calls `social-listening-core` directly. The same-origin BFF route is `src/app/api/connectors/[platformId]/query-capabilities/route.ts`.
- **No database access from admin:** All watchlist persistence goes through `/api/watchlists` (create) or `/api/watchlists/:id` (PATCH/DELETE), not the Postgres driver.

## Known gaps / deferred work

- The warning UI currently uses native `title` tooltips. A richer hover card is deferred to a future UX pass.
- `NOT` group translation for platforms that do not support `NOT` is an open question in ADR-0110; the UI warns and relies on fallback matching.

## Relations to other components

- `BooleanQueryBuilder` calls the BFF proxy `/api/connectors/:platformId/query-capabilities` (real call site asserted by `story-13.3` and `story-12.4` contracts).
- `WatchlistForm` embeds `BooleanQueryBuilder` and posts to `/api/watchlists` or `/api/watchlists/:id`.
- `core-client.ts` provides `getConnectorQueryCapabilities` and `createWatchlist`/`updateWatchlist`/`deleteWatchlist`.
