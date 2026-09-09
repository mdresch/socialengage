---
name: connector-query-translation
description: The per-connector `WatchlistAST` → `NativeQuery` translation and save-time validation layer. Read this before touching `src/connectors/queryCapabilities.ts`, `src/connectors/queryTranslation.ts`, or any per-connector query syntax for watchlists.
---

# Connector query translation and validation

## What this is

The bridge between the canonical clause-based `WatchlistAST` (`src/watchlists/ast.ts`) and each platform's native query syntax. Every connector registers a `ConnectorQueryTranslator` that exposes which clause types and boolean operators it can express, the maximum number of clauses and query length it will accept, and a `translate()` method that turns a valid AST into a `NativeQuery` (query string + optional platform-specific params). `validate()` is called at watchlist save time via `validateAstForConnector()` and by `POST /v1/watchlists`, returning `UNSUPPORTED_QUERY_CLAUSE`, `TOO_MANY_CLAUSES`, or `QUERY_TOO_LONG` before a bad query ever reaches a connector. It sits between the visual/text boolean query builder (ADR-0102) and the fallback matcher (`src/watchlists/matcher.ts`, ADR-0006) — translation is an optimization; the fallback matcher is the safety net that always evaluates the same AST when native translation is impossible or only partial.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0102 | Canonical `WatchlistAST` schema (clauses: keyword, phrase, hashtag, mention, author, source, sentiment, date, nested; operators AND/OR/NOT) | 12.3 |
| ADR-0110 | Per-connector `ConnectorQueryTranslator` and `NativeQuery`; capability allowlist; save-time `UNSUPPORTED_QUERY_CLAUSE`/`TOO_MANY_CLAUSES`/`QUERY_TOO_LONG` validation; fallback remains the safety net | 13.2 |
| ADR-0006 | Connector-side native filtering preferred; post-fetch fallback `matchesWatchlist()`/`evaluateWatchlistAst()` evaluated for the same AST | 3.3, 3.6 |
| ADR-0077 | Legacy `count?()`/`sample?()` signatures keep the old binary `AstNode` `WatchlistAST` alias; the new translator works with the canonical clause-based `WatchlistAST` | 9.1 |
| BRD-0021 / FDD-0021 | Native and fallback paths must produce equivalent matched post sets for the same AST and input data | 3.6 |

## Contracts that constrain this component

- `contracts/epic-13/story-13.2.per-connector-query-translation-and-validation.contract.test.ts` — every registered connector exposes a translator with `supportedClauses`, `supportedOperators`, `maxClauseCount`, `maxQueryLength`, `translate()`, and `validate()`; `GET /v1/connectors/:platformId/query-capabilities` returns capabilities; `POST /v1/watchlists` returns `422 UNSUPPORTED_QUERY_CLAUSE`; reference ASTs translate to predictable `NativeQuery` shapes; fallback `evaluateWatchlistAst()` still matches when native translation is not possible; `TOO_MANY_CLAUSES` and `QUERY_TOO_LONG` codes are enforced.

## How to extend this safely

- **Adding a new connector translator:** add a new entry to the translator map in `src/connectors/queryCapabilities.ts` (or `src/connectors/queryTranslation.ts` if the helpers are split). Use `createConnectorQueryTranslator()` with the platform's supported clauses, operators, and limits. Provide `renderClause()` overrides only when the platform's query syntax genuinely differs (e.g. YouTube `channelId`/`publishedAfter` params, GNews `from`/`to` date params).
- **Changing a translator's output format:** this is a contract change. Update the reference assertions in `story-13.2.per-connector-query-translation-and-validation.contract.test.ts` first, or the new output shape is not guaranteed.
- **Adding a new clause type:** extend `WatchlistClauseType` in `src/watchlists/ast.ts` and the relevant translators' `supportedClauses`. Update `evaluateWatchlistAst()` in `src/watchlists/matcher.ts` first so the fallback matcher understands the new clause, then add native translation.
- **Tuning limits:** `maxClauseCount` and `maxQueryLength` are platform-specific and must match the real API's documented ceilings. Changing a limit is a behavior change that the contract's limit tests will catch.

## Load-bearing constraints — do not change casually

- **The translator works on the canonical clause-based `WatchlistAST` from `src/watchlists/ast.ts`, not the legacy binary `AstNode` alias in `src/connectors/types.ts`.** `count?()`/`sample?()` keep the old binary tree contract to avoid breaking Story 9.1; do not merge the two AST shapes or rename either `WatchlistAST`.
- **`translate()` returns `null` when an AST cannot be fully translated.** Callers must fall back to `evaluateWatchlistAst()` for the same AST rather than returning zero results.
- **`validate()` runs before translation and enforces clause/operator support, clause count, and query length.** A returned `valid: false` with `code: 'UNSUPPORTED_QUERY_CLAUSE'` is the source of the `422` returned by `POST /v1/watchlists`.
- **`maxQueryLength` is measured against the generated native query string, not the raw AST.** If `translate()` builds both a `query` and `params`, only `query.length` is checked; `params` carry platform-specific filters that do not count toward the public query length.
- **Fallback matching is the safety net, not a second-class path.** Any AST that passes `validateWatchlistAst()` and `evaluateWatchlistAst()` should still match correctly even when `translate()` returns `null`; the contract proves this for a reference corpus.
- **Do not weaken the legacy `validateAstForConnector()` interface.** It is called by `POST /v1/watchlists` and `PATCH /v1/watchlists/:id`. Keep returning `{ valid, code?, offendingClause?, reason?, warnings? }`.

## Known gaps / deferred work

- **No live call site uses the new `ConnectorQueryTranslator` in the ingestion pipeline yet.** `resolveWatchlistAstDispatch()` still uses the legacy `supportedQueryFeatures` binary AST path (Story 3.6). Wiring the new translator into `pollGNewsSearch`, `pollBraveSearch`, `pollBingSearch`, etc., is a future story.
- **Date/source/author translations are best-effort platform approximations.** The real query parameters differ per API (GNews `from`/`to`, YouTube `publishedAfter`/`publishedBefore` + `channelId`, Brave/Bing `freshness`, etc.). The contract locks down the shapes for the reference ASTs; extending them to real API calls requires per-connector verification.
- **Sentiment clauses are never translated** (ADR-0110 §3) — they are post-fetch fallback only and should fail validation for every connector.

## Relations to other components

- **`src/watchlists/ast.ts`**: source of the canonical `WatchlistAST` and `astToBooleanQuery()` helper.
- **`src/watchlists/matcher.ts`**: fallback evaluator `evaluateWatchlistAst()` that must remain semantically consistent with any native translation.
- **`src/watchlists/dispatch.ts`**: legacy `resolveWatchlistAstDispatch()` still uses binary `AstNode` and `supportedQueryFeatures`; the new translator is not yet wired here.
- **`src/http/versions/v1/watchlistsRouter.ts`**: calls `validateAstForConnector()` at save time and returns 422 for unsupported/too-long/too-many-clauses ASTs.
- **`src/http/versions/v1/connectorsRouter.ts`**: serves `GET /v1/connectors/:platformId/query-capabilities` from `getConnectorQueryCapabilities()`.
