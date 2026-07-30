---
name: watchlist-matching
description: Connector-side native watchlist filtering with post-fetch fallback matching for social-listening-core, including the boolean-query AST both paths evaluate identically. Read this before implementing a real connector's query translation, before touching the fallback matcher, or before touching ast.ts.
---

# Watchlist matching: native filtering with fallback, and the boolean-query AST

## What this is

The decision layer between a `Watchlist`'s query and what actually gets fetched/persisted, in two forms: the original `WatchlistTerms` (keyword/hashtag/account, OR semantics only — `resolveWatchlistDispatch()`/`matchPostsForWatchlist()`/`matchesWatchlist()`) from Story 3.3, and Story 3.6's unified boolean-query AST (`AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` — `resolveWatchlistAstDispatch()`/`matchPostsForWatchlistAst()`/`matchesAst()`, `src/watchlists/ast.ts`'s `parseBooleanQuery()`). Both check whether a `SocialConnector` declares native capability — `translateWatchlistQuery()` for terms, `supportedQueryFeatures` for AST node types — and dispatch to native (platform presumed to have already filtered server-side) or fallback (core evaluates every fetched post itself) accordingly. It exists so watchlists work uniformly across every platform, spending rate-limit budget on native filtering wherever a platform supports it (ADR-0006), and so native and fallback paths can never silently diverge on what a query means (ADR-0021).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0006 | Prefer connector-side native filtering; fall back to post-fetch matching when a platform doesn't support it | 3.3 |
| ADR-0021 | A `booleanQuery` is parsed once into a canonical AST; every connector translates or evaluates *that same AST* — never independent reimplementations; whole-query (not per-clause) degradation for v1 | 3.6 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts` — a connector implementing `translateWatchlistQuery()` gets a `native` dispatch carrying the translated query params; a connector without it falls back, with every fetched post genuinely evaluated; the same `Watchlist` terms produce the same matched posts via native filtering (simulated: platform pre-filters) and via fallback (core filters the full set) — proven consistent for keyword/hashtag/account terms.
- `contracts/epic-3/story-3.6.watchlist-boolean-ast.contract.test.ts` — `parseBooleanQuery()` builds the correct AST (NOT binds tighter than AND/OR; parentheses group); a connector missing even one node type the query uses degrades the *whole* query to fallback, naming exactly which node types are unsupported; native (pre-filtered mock) and fallback (`matchesAst()` over the full set) produce identical matched posts for the same `booleanQuery` and underlying data — closing the exact gap Story 3.3's own AC3 flagged as pending this story.

## How to extend this safely

- **Implementing a real connector's native filtering (terms-based):** implement `translateWatchlistQuery(terms)`, returning `{ supported: true, queryParams }` with that platform's actual query syntax. Return `{ supported: false }` (or omit) to fall back automatically.
- **Implementing a real connector's native filtering (AST-based):** declare `supportedQueryFeatures: AstNodeType[]` listing exactly which node types this platform's search API can express. Missing/omitting it means "supports none" — a connector must opt in explicitly, never assumed capable by default. `resolveWatchlistAstDispatch()` handles the rest.
- **A Watchlist with no matching terms at all** (`{}`): `matchesWatchlist()` returns `false` for every post (every `.some()` over an empty/undefined array is `false`) — this is correct, not a bug to special-case.
- **Extending the AST grammar** (e.g., quoted multi-word phrases — not built, not named in ADR-0021's v1 node types): extend `tokenize()`/`tokenToLeaf()` in `ast.ts` and the `AstNodeType` union together; re-check `collectNodeTypes()` and every connector's `supportedQueryFeatures` declarations still make sense against the enlarged type set.
- **`WatchlistTerms` and the AST are two independent, non-unified representations right now** — Story 3.6 didn't fold `WatchlistTerms` into the AST or vice versa (that would have broken Story 3.3's passing contract without an ADR calling for it). Don't assume a `Watchlist` has both; a real `Watchlist` entity's actual shape (`terms` vs. `booleanQuery`, or both) is Phase 1's "also build, not storied" CRUD work to decide, not this component.

## Load-bearing constraints — do not change casually

- **In native mode, both `matchPostsForWatchlist()` and `matchPostsForWatchlistAst()` return every post they're given, unfiltered.** Deliberate, not a missing filter: native mode's whole premise is that the platform already applied the translated query server-side. A second core-side filter pass in native mode would silently double-apply (and potentially diverge from) the platform's own filtering logic.
- **AST degradation is whole-query, never per-clause** (ADR-0021's accepted default) — `resolveWatchlistAstDispatch()` returns `fallback` for the entire query the moment even one required node type is unsupported, never a mixed native-for-part/fallback-for-part result. Changing this is a decision-level change (ADR-0021's own "Open questions," resolved at acceptance), not an implementation tweak.
- **`unsupportedNodeTypes` is emitted in a fixed canonical order** (`AND, OR, NOT, TERM, HASHTAG, ACCOUNT`), not `Set` insertion order — insertion order would vary with the AST's tree shape for the exact same set of required-but-missing types, which would make this signal unstable for anything consuming it (a future status view, a test, a log line) for no real reason.
- **The fallback matcher and native dispatch must stay behaviorally consistent** (Story 3.3's own AC3, closed more rigorously by Story 3.6's AC3) — a future connector's native translation that would return semantically different results than `matchesWatchlist()`/`matchesAst()` for the same query is exactly the inconsistency ADR-0006's Negative consequences warns about and ADR-0021 exists to prevent structurally. Don't let a new connector's translation drift without checking it against the fallback matcher's semantics first.

## Known gaps / deferred work

- No persisted `Watchlist` entity/table exists yet — neither story needed a stored, retrievable-by-ID entity, only a `WatchlistTerms`/AST value. The real `watchlists` table and its CRUD REST endpoints are Phase 1's "also build, not storied" admin/API surface work.
- **No connector/watchlist status view exists** — Story 3.6's AC2 requires unsupported-node-type fallback to be "visible" there; `resolveWatchlistAstDispatch()`'s `unsupportedNodeTypes` field is that signal, proven correct at the data level, but nothing surfaces it in an actual REST response or admin UI yet (no connector-status or watchlist endpoints exist in this repo at all).
- No real connector implements `translateWatchlistQuery()` or declares `supportedQueryFeatures` yet — `exampleNativeFilterConnector` is a reference fixture proving the mechanism, not a real platform integration.
- No quoted multi-word phrase support in the AST grammar — not named in ADR-0021's v1 node types.
