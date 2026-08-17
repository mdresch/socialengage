---
name: post-feed
description: The /tenant/posts and /tenant/posts/:id screens — the only place in social-listening-admin a tenant can actually see ingested posts. Read this before touching src/app/tenant/posts/**, the postDisplay.ts extraction helpers, or the listPosts()/getPost() functions in src/lib/core-client.ts.
---

# Post feed

## What this is

`/tenant/posts` (list, real cursor-paginated `GET /v1/posts`) and `/tenant/posts/:id` (detail, real `GET /v1/posts/:id`) — the first and, as of this story, only frontend surface anywhere in this project for the actual posts every connector has been ingesting since Phase 1. `postDisplay.ts` holds the pure, non-JSX extraction helpers (`extractDisplayText`, `extractProviderBadge`, `extractEnrichmentSummary`) both screens share, since `rawPayload`'s shape is heterogeneous per connector and both screens need to derive the same title/snippet/provider/enrichment display data from it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0011 | `GET /posts` paginated by opaque cursor, not offset/limit | 3.4 (backend), 6.11 (this screen) |
| ADR-0012 | Full post data fetched via REST on demand (`GET /posts/:id`), not carried in events | 5.1 (backend), 6.11 (this screen) |

## Contracts that constrain this component

- `contracts/epic-6/story-6.11.post-feed.contract.test.ts` — real Server Component renders (real encrypted session, mocked `next/headers`/`next/navigation`/`fetch`, the same pattern `story-6.5.connector-status-view`'s own corrected contract established) proving per-shape title/text extraction, enrichment shown-when-present/absent-when-null, detail-page authorId/acquisitionId rendering, and a real 404 → "not found" state. **Its original AC2 pagination tests (opaque-cursor "next page" link, `?cursor=` searchParams forwarding) were retired 2026-08-17 by Story 6.18 below, which deliberately supersedes that whole mechanism — see that file's own dated note.** Also covers `listPosts()`/`getPost()` in `core-client.ts` directly (bearer-token attachment, throw-on-non-2xx, `getPost()`'s 404-returns-null exception to that rule). **Enhancement, 2026-08-12** (Menno's own direct request): the detail screen also shows `enrichment.modelUsed` — which of the (possibly multiple) active AI providers actually produced this specific post's enrichment, since `social-listening-core`'s `enrichPost.ts` decides that per-post via a fixed provider order, not a tenant-visible setting.
- `contracts/epic-6/story-6.16.manual-enrichment-button.contract.test.ts` — `RunEnrichmentButton` (new, `RunEnrichmentButton.tsx`) is rendered by the detail page only when `post.enrichment` is currently `null`, never for an already-enriched post; a real result reloads the page, a real `enrichment: null` response shows a specific "no AI provider connected" message, not a generic error. Also covers `runPostEnrichment()`/the same-origin proxy route directly (raw `{status, body}` outcome pattern, same as every other action in this app).
- `contracts/epic-6/story-6.18.post-feed-search-all-posts.contract.test.ts` — `page.tsx`'s real paginated fetch loop (`fetchAllPosts()`, the same shape `fetchAnalyticsSummary.ts`/Story 8.1 established) pages through every real `GET /v1/posts` page until exhausted; `PostsFeedClient.tsx`'s search/filter now proven to operate across the full fetched set, not one page; a real "Show more" control (`visibleCount`) reveals more of the already-filtered results in batches, present only when more exist; the old server-round-trip `?cursor=` link and `nextCursor` prop are structurally proven gone.

## How to extend this safely

- **Adding a new connector's `rawPayload` shape:** `extractDisplayText()` in `postDisplay.ts` only ever looks for a `title` field (optionally `description`) — it does not branch on `providerId`. A new connector whose posts have a `title` field (with or without `description`) needs no change here at all; one that doesn't falls back to raw JSON automatically. Only touch this function if a genuinely new *shape* (no `title` field at all, but real display-worthy content) needs its own branch — and add a contract case for it, per this file's own contract list.
- **Search/filter (search box, Provider/Sentiment/Watchlist) is real, client-side, and — as of Story 6.18 — operates over the tenant's entire fetched post set**, not one page. `page.tsx`'s own `fetchAllPosts()` pages through every real `GET /v1/posts` result before `PostsFeedClient` ever filters anything, so this is no longer "a client-side filter over an unfiltered fetch" (this doc's own prior, now-corrected warning) — the fetch itself is now the full set. A genuinely new query dimension `GET /v1/posts` itself doesn't support (e.g. server-side full-text ranking) would still need real `social-listening-core` scope first; a new filter over fields already present in `SocialPostSummary`/`enrichment` does not.
- **`fetchAllPosts()`'s `MAX_PAGES` circuit breaker is defensive, not an approximation ceiling** — same precedent as `fetchAnalyticsSummary.ts`. A real tenant approaching it is ADR-0054 Open Question 2's own named client-side-aggregation scale ceiling becoming real here too, not a bug to silently raise the constant past.
- **Adding a friendlier author name or ingestion-run summary to the detail screen:** requires a new `social-listening-core` REST endpoint first (no `/v1/authors/:id` or per-post ingestion-run route exists today — confirmed directly, not assumed). This screen's own `authorId`/`acquisitionId` display is the honest v1 ceiling until one exists; don't fabricate a client-side "friendly" mapping.

## Load-bearing constraints — do not change casually

- **The cursor is opaque — this component never constructs or parses one.** `listPosts(cursor, limit)` forwards whatever string it's given straight through as the `cursor` query param, untouched. Story 6.18 moved cursor-following entirely inside `page.tsx`'s own `fetchAllPosts()` loop (never user-visible, never a URL param) — building a page-number control, or any client-side cursor math anywhere in this component, reopens the exact bug ADR-0011 exists to prevent.
- **`getPost()` returns `null` specifically on a 404 — every other non-2xx still throws.** A 404 is a real, expected outcome (unknown id, or another tenant's id — RLS makes the two indistinguishable, per `posts-api/SKILL.md`) the detail page must render as "not found," not crash on; any other failure (5xx, network) is a genuine backend problem the caller should not silently swallow into the same "not found" state.
- **`postDisplay.ts` is pure — no JSX, no `next/*` imports.** Both the list and detail pages import the same extraction functions; keeping them JSX-free is what lets both screens share them without either page depending on the other's rendering.
- **`PostsFeedClient.tsx` no longer takes a `nextCursor` prop at all (Story 6.18)** — `posts` is now the complete, already-fetched set; reintroducing server-side "next page" pagination here would silently narrow search/filter back to a partial set, the exact defect this story closed.

## Healing note, 2026-08-17

`app/tenant/posts/page.tsx` is now a thin Server Component (data-fetching, gating) — the actual list rendering (search/filter bar, post cards, pagination link) lives in **`PostsFeedClient.tsx`** now, a Client Component. Post selection no longer navigates to a separate route at all: **`PostsFeedClient.tsx` opens the selected post in its own in-page `Slideover` (`activePost` state), not a link to `/tenant/posts/:id`.** The standalone `/tenant/posts/[id]/page.tsx` detail route (this file's own "What this is" section above) still exists and is still real, contract-verified, reachable by direct URL — it is simply no longer linked to from the feed. Treated as an intentional design choice (Menno's explicit call, healing-pass session), not a regression to reverse.

## Known gaps / deferred work

- No `watchlistId`/`platformId` server-side query filter or date-range search — `GET /v1/posts` has no such params yet. As of Story 6.18, Provider/Sentiment/Watchlist/free-text filtering all exist client-side, now over the *complete* fetched set (not a real gap anymore in effect) — a genuinely server-side version of the same filters remains unbuilt, not because it's blocked, but because nothing currently needs it beyond what the client-side version already provides.
- No friendlier author-name or ingestion-run-summary resolution — no REST endpoint exists for either yet; the raw `authorId`/`acquisitionId` values are the honest v1 ceiling, not an oversight.
- Client-side aggregation over paginated `GET /v1/posts` does not scale indefinitely (same named-not-resolved ceiling as `analytics-dashboard/SKILL.md`'s own matching note) — no specific tenant post-volume threshold is decided as "too slow, needs server-side search instead," left to real usage to surface.
