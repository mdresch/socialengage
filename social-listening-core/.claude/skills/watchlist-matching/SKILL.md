---
name: watchlist-matching
description: Connector-side native watchlist filtering with post-fetch fallback matching for social-listening-core. Read this before implementing a real connector's query translation, or before touching the fallback matcher.
---

# Watchlist matching: native filtering with fallback

## What this is

The decision layer between a `Watchlist`'s terms and what actually gets fetched/persisted: `src/watchlists/dispatch.ts`'s `resolveWatchlistDispatch()` checks whether a `SocialConnector` implements `translateWatchlistQuery()` (added to the framework's `types.ts` by this story); if so, the platform is presumed to filter server-side and every post handed back already matches. If not, `matchPostsForWatchlist()` falls back to `src/watchlists/matcher.ts`'s `matchesWatchlist()`, evaluating every fetched post against the same terms. It exists so watchlists work uniformly across every platform, spending rate-limit budget on native filtering wherever a platform supports it (ADR-0006).

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0006 | Prefer connector-side native filtering; fall back to post-fetch matching when a platform doesn't support it | 3.3 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.3.watchlist-matching.contract.test.ts` — a connector implementing `translateWatchlistQuery()` gets a `native` dispatch carrying the translated query params; a connector without it falls back, with every fetched post genuinely evaluated; the same `Watchlist` terms produce the same matched posts via native filtering (simulated: platform pre-filters) and via fallback (core filters the full set) — proven consistent for keyword/hashtag/account terms.

## How to extend this safely

- **Implementing a real connector's native filtering:** implement `translateWatchlistQuery(terms)` on that connector, returning `{ supported: true, queryParams }` with that platform's actual query syntax — replacing this story's illustrative OR-joined string. Return `{ supported: false }` (or omit the method) for platforms/term combinations that can't be expressed natively; `resolveWatchlistDispatch()` falls back automatically, no core changes needed.
- **A Watchlist with no matching terms at all** (`{}`): `matchesWatchlist()` returns `false` for every post (every `.some()` over an empty/undefined array is `false`) — this is correct, not a bug to special-case.
- **`WatchlistTerms` is intentionally minimal** (`keywords`/`hashtags`/`accounts`, OR semantics only) — full boolean query grammar (`AND`/`OR`/`NOT`, a unified AST both paths evaluate identically) is Story 3.6 (ADR-0021, Blocked pending acceptance). Don't extend this type with boolean-query fields ahead of that story landing; it would be exactly the kind of speculative generalization the methodology avoids.

## Load-bearing constraints — do not change casually

- **In native mode, `matchPostsForWatchlist()` returns every post it's given, unfiltered.** This is deliberate, not a missing filter: native mode's whole premise is that the platform already applied the translated query server-side. Adding a second core-side filter pass in native mode would silently double-apply (and potentially diverge from) the platform's own filtering logic.
- **The fallback matcher and native dispatch must stay behaviorally consistent for keyword/hashtag/account terms** (this story's own AC3) — a future connector's native translation that returns semantically different results than `matchesWatchlist()` would for the same terms is exactly the inconsistency ADR-0006's Negative consequences warns about, and exactly what Story 3.6 exists to close more rigorously. Don't let a new connector's translation drift without checking it against the fallback matcher's semantics first.

## Known gaps / deferred work

- No persisted `Watchlist` entity/table exists yet — this story only needed a `WatchlistTerms` value, not a stored, retrievable-by-ID entity. The real `watchlists` table and its CRUD REST endpoints are Phase 1's "also build, not storied" admin/API surface work, built alongside the real RSS connector.
- Boolean query grammar and cross-connector AST consistency: Story 3.6 (ADR-0021, Blocked).
- No real connector implements `translateWatchlistQuery()` yet — `exampleNativeFilterConnector` is a reference fixture proving the mechanism, not a real platform integration.
