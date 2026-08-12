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

- `contracts/epic-6/story-6.11.post-feed.contract.test.ts` — real Server Component renders (real encrypted session, mocked `next/headers`/`next/navigation`/`fetch`, the same pattern `story-6.5.connector-status-view`'s own corrected contract established) proving per-shape title/text extraction, opaque-cursor "next page" navigation, enrichment shown-when-present/absent-when-null, detail-page authorId/acquisitionId rendering, and a real 404 → "not found" state. Also covers `listPosts()`/`getPost()` in `core-client.ts` directly (bearer-token attachment, throw-on-non-2xx, `getPost()`'s 404-returns-null exception to that rule).

## How to extend this safely

- **Adding a new connector's `rawPayload` shape:** `extractDisplayText()` in `postDisplay.ts` only ever looks for a `title` field (optionally `description`) — it does not branch on `providerId`. A new connector whose posts have a `title` field (with or without `description`) needs no change here at all; one that doesn't falls back to raw JSON automatically. Only touch this function if a genuinely new *shape* (no `title` field at all, but real display-worthy content) needs its own branch — and add a contract case for it, per this file's own contract list.
- **Adding a query filter to the list screen** (`watchlistId`, `platformId`, date range): blocked on the backend first — `GET /v1/posts` has no such filters yet (`social-listening-core/.claude/skills/posts-api/SKILL.md`'s own "Known gaps"). Don't invent a client-side filter over an unfiltered fetch; that silently misrepresents what's actually been paged in.
- **Adding a friendlier author name or ingestion-run summary to the detail screen:** requires a new `social-listening-core` REST endpoint first (no `/v1/authors/:id` or per-post ingestion-run route exists today — confirmed directly, not assumed). This screen's own `authorId`/`acquisitionId` display is the honest v1 ceiling until one exists; don't fabricate a client-side "friendly" mapping.

## Load-bearing constraints — do not change casually

- **The cursor is opaque — this component never constructs or parses one.** `listPosts(cursor)` forwards whatever string it's given straight through as the `cursor` query param, untouched; the list screen's "next page" link embeds `page.nextCursor` verbatim. Building a page-number control, or any client-side cursor math, reopens the exact bug ADR-0011 exists to prevent.
- **`getPost()` returns `null` specifically on a 404 — every other non-2xx still throws.** A 404 is a real, expected outcome (unknown id, or another tenant's id — RLS makes the two indistinguishable, per `posts-api/SKILL.md`) the detail page must render as "not found," not crash on; any other failure (5xx, network) is a genuine backend problem the caller should not silently swallow into the same "not found" state.
- **`postDisplay.ts` is pure — no JSX, no `next/*` imports.** Both the list and detail pages import the same extraction functions; keeping them JSX-free is what lets both screens share them without either page depending on the other's rendering.

## Known gaps / deferred work

- No filters (`watchlistId`, `platformId`, date range) — named as a real backend dependency in this story's own text, not built here. See `posts-api/SKILL.md`'s "Known gaps."
- No friendlier author-name or ingestion-run-summary resolution — no REST endpoint exists for either yet; the raw `authorId`/`acquisitionId` values are the honest v1 ceiling, not an oversight.
- No full-text or date-range search — same reason, named explicitly in the story's own "Explicitly out of scope."
