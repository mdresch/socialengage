---
name: post-watchlist-match-persistence
description: The post_watchlist_matches junction table and GET /v1/posts?watchlistId server-side filter for social-listening-core. Read this before touching src/watchlists/postWatchlistMatchStore.ts, before adding a query filter to postsRouter.ts, or before touching the matched-watchlist loop in publishSocialPostIngestedEvents.ts.
---

# Post-watchlist match persistence

## What this is

A real, queryable junction table (`post_watchlist_matches`) persisting the `(post, watchlist)` match pairs that ADR-0058's event publishing already computes at ingestion time — previously discarded the moment `SocialPostIngestedEvent` was published. `insertPostWatchlistMatches()` (`src/watchlists/postWatchlistMatchStore.ts`) writes them, best-effort, from inside `publishSocialPostIngestedEvents()` (`src/events/publishSocialPostIngestedEvents.ts`) — the one real place every connector's own per-post loop already computes which watchlists a post matched, via `matchesAst()`. `GET /v1/posts?watchlistId=<id>` (`postsRouter.ts`/`socialPostStore.ts`) is the read side: a real, RLS-enforced, server-side filter, replacing the need for a client-side `bodyMarkdown` approximation.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0063 | `post_watchlist_matches` junction table; match pairs written at ingestion, best-effort; `GET /v1/posts?watchlistId` filter, 400/404 mapping; historical/staleness gaps named, not solved | 3.11 |
| ADR-0058 | The match-pairs computation this story persists — `publishSocialPostIngestedEvents()`'s own `matchesAst()` loop, unchanged | 5.19 |
| ADR-0044 §5c | The 404-vs-403, ownership-scoped split this story's `watchlistId` existence check reuses via `getWatchlistById(tenantId, userId, id)` | 1.5 |
| ADR-0011 | Cursor (keyset, `seq`-ordered) pagination — unchanged by the `watchlistId` JOIN | 3.4 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.11.post-watchlist-match-persistence.contract.test.ts` — `post_watchlist_matches`' own schema/indexes/UNIQUE constraint/RLS policy; `insertPostWatchlistMatches()` is idempotent (`ON CONFLICT DO NOTHING`); a real matching watchlist produces a real row via `publishSocialPostIngestedEvents()`; a store-layer failure there is logged, never thrown, never fails the surrounding `runIngestionAttempt()`; `GET /v1/posts?watchlistId=<id>` returns only matched posts for a valid id, 404s `WATCHLIST_NOT_FOUND` for a cross-tenant or another-user's-in-the-same-tenant id, 400s `INVALID_WATCHLIST_ID` for a malformed string, and preserves `seq`-based cursor pagination; a post with no match row returns an honest empty result, not an error.

## How to extend this safely

- **A new connector that should also write match records:** nothing to do here — every connector that already calls `publishSocialPostIngestedEvents()` (GNews, Newswire, Facebook, tenant-owned-feed, Wikipedia) gets match persistence automatically, the moment it publishes events at all. Don't add a second, parallel call to `insertPostWatchlistMatches()` anywhere else.
- **A retroactive backfill for historical posts** (ADR-0063 Open Question 1): feasible using the existing `matchesWatchlist()`/`matchesAst()` fallback matchers against `body_markdown` — not built. Check that Open Question before adding one speculatively; a `POST /v1/watchlists/:id/reindex` endpoint is the named (not designed) direction.
- **A `postCount` field on `GET /v1/watchlists`** (ADR-0063 Open Question 4, Story 8.9's own judgment call): a cheap `COUNT(*) ... GROUP BY watchlist_id` join on this table — not this story's own scope, don't add it here without Story 8.9 actually calling for it.
- **A new `GET /v1/posts` filter** (`platformId`, `from`/`to`, `sentiment` — still named, still not built per `posts-api/SKILL.md`): follow this story's own shape — thread an optional field through `ListSocialPostsOptions`, add the `WHERE`/`JOIN` clause to both `queryFirstPage`/`queryAfterCursor` together, never touch `seq` ordering.

## Load-bearing constraints — do not change casually

- **`insertPostWatchlistMatches()` is called from `publishSocialPostIngestedEvents()`, not `runIngestionAttempt()`.** ADR-0063 Decision §2's own text says the call happens "inside `runIngestionAttempt()`" — verified directly (not assumed) to be imprecise: `runIngestionAttempt()` is a generic, connector-agnostic attempt/retry state machine with no knowledge of posts or watchlists; the real, single place match pairs are already computed is `publishSocialPostIngestedEvents()`'s own per-watchlist `matchesAst()` loop, called from each connector's own per-post loop. See this story's own contract file header for the full reasoning. Moving this call into `runIngestionAttempt()` itself would require restructuring every connector to bubble match pairs upward — don't do it without a fresh ADR-level decision.
- **Best-effort, wrapped in its own `try`/`catch`, never re-thrown** — the same "a Service Bus outage must never fail or roll back real ingestion" precedent `enrichPost()` (ADR-0038) and `publishSocialPostIngestedEvents()`'s own event-publish loop already establish. A post missing from `post_watchlist_matches` is a soft inconsistency (worse UX), not data loss; a failed ingestion is.
- **`GET /v1/posts?watchlistId=<id>`'s 404 check is per-user-ownership-scoped, not just tenant-scoped** — reuses `getWatchlistById(tenantId, userId, id)` unmodified, the exact same RLS predicate `watchlist-crud`'s own ADR-0044 §5c already enforces ("missing, cross-tenant, or another user's — all three identical, undistinguishable by design," no Tenant-Admin oversight override). A caller filtering by a watchlist they don't own gets 404, even within their own tenant, even as `tenant_admin`.
- **Pagination still orders strictly by `social_posts.seq`, never `matched_at` or any other `TIMESTAMPTZ` column** — `posts-api/SKILL.md`'s own load-bearing constraint is unchanged by this story's `JOIN`. `idx_pwm_watchlist_id`'s `matched_at DESC` ordering exists for the junction table's own filter-scan efficiency, not for page ordering.
- **`post_watchlist_matches.tenant_id` is denormalized, not resolved via a JOIN to `social_posts`/`watchlists`** — same RLS-without-a-join pattern `watchlists` itself already established (`migrations/0014`). `ON DELETE CASCADE` on both `post_id`/`watchlist_id` FKs means deleting a post or a watchlist silently removes its match rows — no separate cleanup path exists or is needed.

## Known gaps / deferred work

- **No retroactive backfill** (ADR-0063 Open Question 1) — posts ingested before this table existed have no match records; `GET /v1/posts?watchlistId=<id>` returns an honest empty result for them, not an error.
- **No re-matching on watchlist update** (ADR-0063 Open Question 2) — a watchlist's `terms[]`/`booleanQuery` change does not retroactively re-evaluate existing match rows; new posts use the new definition, historical posts keep the old one.
- **No storage ceiling / TTL / partitioning** for `post_watchlist_matches` (ADR-0063 Open Question 3) — grows proportionally to `posts × active_watchlists_per_tenant`; left to a future ADR if a real capacity signal emerges.
- **`GET /v1/watchlists`'s own `postCount` field is not added** (ADR-0063 Open Question 4) — left to Story 8.9's own implementation-time judgment, not fixed here.
- **`social-listening-admin`'s `activeWatchlistFilter` (ADR-0062 Decision §3) is not upgraded to use this filter** — that's Story 8.9's own, separate, `social-listening-admin`-only scope; this story only builds the backend prerequisite.

## Relations to other components

- Called from every connector's own per-post loop via `publishSocialPostIngestedEvents()` (`ingestion-events`) — `pollFacebook.ts`, `pollGNewsSearch.ts`, `pollNewswireFeeds.ts`, `pollTenantOwnedFeed.ts`, `pollWikipedia.ts` — proven at the real call site by this story's own AC3 contract (calls `publishSocialPostIngestedEvents()` directly, not a connector-specific wrapper).
- `GET /v1/posts?watchlistId=<id>` calls `getWatchlistById()` (`watchlist-crud`) for the existence/ownership check, and extends `listSocialPosts()` (`posts-api`) for the filtered query — both existing functions, no new shared surface.
- Reuses `matchesWatchlist()`/`matchesAst()` (`watchlist-matching`) indirectly, only through `publishSocialPostIngestedEvents()`'s own already-established call — this component adds no new matching logic of its own.
