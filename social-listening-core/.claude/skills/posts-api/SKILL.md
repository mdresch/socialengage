---
name: posts-api
description: GET /v1/posts, GET /v1/posts/:id, and cursor-based (keyset) pagination for social-listening-core. Read this before adding a new /posts filter, before touching how social_posts is queried for a page of results, or before touching the single-post-fetch path.
---

# Posts API and cursor pagination

## What this is

`GET /v1/posts` (`src/http/versions/v1/postsRouter.ts`), the first real business endpoint in `social-listening-core`'s REST API (following `/v1/health`'s versioning-mechanism placeholder from Story 1.3). `listSocialPosts()` (`src/posts/socialPostStore.ts`) implements ADR-0011's cursor-based pagination: results are ordered by `social_posts.seq`, a monotonic identity column added specifically for this purpose (`migrations/0006_add_social_posts_pagination_index.sql`), and the cursor (`src/posts/cursor.ts`) is an opaque token encoding that `seq` value. `GET /v1/posts/:id`, backed by `getSocialPostById()`, is Story 5.1/ADR-0012's REST-fetch-on-demand endpoint — the paired half of keeping Service Bus events thin (see `.claude/skills/ingestion-events/SKILL.md`): a subscriber that only got an event's `postId` fetches full post data here. `POST /v1/posts/:id/enrich` (Story 6.16) manually (re-)runs the same real `enrichPost()` (Story 2.8/2.9) a connector's own ingest function calls inline — the only way to enrich a post that was ingested before any AI provider was connected, since nothing else ever re-processes an already-stored post.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0011 | `GET /posts` paginated by opaque cursor, not offset/limit | 3.4 |
| ADR-0017 | Every route lives under `/v1/` | 1.3 (cross-cutting — this endpoint follows that pattern) |
| ADR-0012 | Full post data is fetched via REST on demand (`GET /posts/:id`), not carried in Service Bus events | 5.1 |
| ADR-0053 (Story 3.10) | `body_markdown`'s own canonical Markdown decision — this component only exposes it, doesn't decide its content | 6.19 |
| ADR-0071 | Human-in-the-Loop Post Enrichment Overrides API (`PATCH /v1/posts/:id/enrichment`) and re-enrichment precedence guard on `POST /v1/posts/:id/enrich` | 3.13 |
| ADR-0073 | Outbound reply audit table and `POST /v1/posts/:id/replies` / `GET /v1/posts/:id/replies` | 3.14 |

## Contracts that constrain this component

- `contracts/epic-3/story-3.4.cursor-pagination.contract.test.ts` — `GET /v1/posts` accepts `cursor`, returns a `nextCursor`; `page`/`offset` query params have no effect; paging while new posts are ingested concurrently produces no duplicates; the implementation never issues a SQL `OFFSET` clause; a page near the "end" costs about the same as one near the "start" at a practical test scale (500 rows — a proxy for ADR-0011's literal multi-million-row claim, not a literal benchmark at that scale).
- `contracts/epic-4/story-4.2.topic-time-series-deferred.contract.test.ts` — `listSocialPosts()`'s read path (and therefore `GET /v1/posts`'s response) round-trips `publishedAt`/`enrichment` for a post that has them set (see `.claude/skills/social-post-enrichment/SKILL.md` for what owns those fields' schema/semantics — this contract only constrains that the existing read path doesn't drop them).
- `contracts/epic-5/story-5.1.thin-events.contract.test.ts` — `GET /v1/posts/:id` returns full post data for a known id, 404s for an unknown one, and never returns another tenant's post even by the right id (RLS).
- `contracts/epic-3/story-6.16.post-manual-enrich-endpoint.contract.test.ts` — `POST /v1/posts/:id/enrich` derives the same enrichment text a real connector's own ingest function would (title, plus description when present), calls the real, unmodified `enrichPost()`, persists a real result, 404s the same way `GET /v1/posts/:id` does, and returns a real `200` with `enrichment: null` (not an error) when no AI provider is currently connected and active.
- `contracts/epic-3/story-6.19.post-body-markdown-exposure.contract.test.ts` — both `GET /v1/posts` and `GET /v1/posts/:id` return a real, non-null `bodyMarkdown` for a post that has one stored; a post that never had one returns `bodyMarkdown: null` honestly (present, never omitted, never defaulted to empty string).
- `contracts/epic-3/story-3.13.post-enrichment-overrides.contract.test.ts` — `PATCH /v1/posts/:id/enrichment` applies validation and sanitization, persists `enrichment.override` audit metadata, and ensures `POST /v1/posts/:id/enrich` rejects re-enrichment of manually overridden posts with `409 Conflict` unless `force: true` is passed.
- `contracts/epic-3/story-3.14.outbound-reply-audit.contract.test.ts` — `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies` are RLS-scoped, validate the post and caller's active Tier-3 credential, persist `outbound_activities` rows, and map connector failures to provider-appropriate HTTP statuses.

## How to extend this safely

- **Adding a query filter** (`watchlistId`, `platformId`, `from`/`to`, `sentiment` — all named in ADR-0011's Context but none built yet, since none of those fields exist on `social_posts` yet): add a `WHERE` clause to `queryFirstPage`/`queryAfterCursor` in `socialPostStore.ts`, keyed off the new column once its owning story adds it. Keep it additive to the existing `seq`-ordered keyset query — never replace `seq` ordering with something else without re-deriving the whole cursor scheme.
- **The cursor is opaque by contract** (ADR-0011's own Negative consequence) — never document or rely on its internal shape (`{ seq: string }`) as a public API contract; treat `encodeCursor`/`decodeCursor` as the only code allowed to construct or parse one.
- **Adding a field to `GET /v1/posts/:id`'s response:** extend `getSocialPostById()`'s `SELECT` and its `SocialPostFull` interface together — keep it a superset of `SocialPostSummary`'s fields (the list endpoint), not a divergent shape.

## Load-bearing constraints — do not change casually

- **Pagination orders by `seq`, never by `created_at` (or any `TIMESTAMPTZ` column).** This was a real bug, not a hypothetical: `pg` returns `TIMESTAMPTZ` as a JS `Date`, which only has millisecond precision, while the column itself has microsecond precision. Rows inserted within the same millisecond (routine under a tight insertion loop, e.g. a real connector poll batch) would round-trip through a timestamp-based cursor with their true relative order lost, producing genuine duplicate rows across pages — caught by this story's own AC1/AC2 contract tests before ever shipping. `seq` (a `BIGINT GENERATED BY DEFAULT AS IDENTITY` column) has no such precision-loss class of bug.
- **Never add a SQL `OFFSET` clause to `listSocialPosts()` or its helpers.** That's the literal regression ADR-0011 exists to prevent — checked directly by this story's contract (source-text inspection for a real `OFFSET <number>` clause, not just the word appearing anywhere).
- **Corrected 2026-08-12 (Story 6.11) — stale since Story 5.10/ADR-0033, never fixed here:** tenant identity does **not** come from an `X-Tenant-Id` header. `postsRouter.ts` calls `requireTenantUser(req, res)` — the real, resolved-identity-based tenant scoping every substantive `/v1` route uses (`createTenantAuthMiddleware()`, ADR-0033 §1/§2's "one seam"). `X-Tenant-Id` was retired project-wide as a trust mechanism and is not read anywhere in this router.

## Known gaps / deferred work

- No filters beyond pagination (`watchlistId`, `platformId`, `from`/`to`, `sentiment`) — all deferred until their backing columns exist (later Epic 3/4 stories).
- `GET /v1/posts/:id/replies` uses a simple `created_at DESC` limit, not a full cursor scheme; cursor pagination is only needed if a single post is expected to exceed 50 reply attempts.
- The AC3 "no linear degradation with depth" latency check runs at 500 rows, not literally millions — a deliberate, practical-scale proxy (see this story's contract-file Intent comment for the full reasoning), not a claim that multi-million-row performance has been empirically measured.
