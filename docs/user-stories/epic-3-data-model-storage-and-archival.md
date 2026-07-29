# Epic 3: Data Model, Storage & Archival

## Story 3.1 — Normalized author entity

**Source:** ADR-0004 · **Status:** Ready

**As a** data engineer,
**I want** authors normalized into their own `Author` entity, upserted by `(tenantId, platformId, externalAuthorId)`, with `SocialPost` referencing it via `authorId`,
**so that** author-level facts (handle, display name, follower count, profile location) are stored once and updated in place instead of duplicated across every post from the same account.

**Acceptance Criteria**
- Ingesting two posts from the same external author within a tenant results in exactly one `Author` row, with `lastSeenAt` updated on the second ingest.
- `SocialPost` has no embedded author display fields — only `authorId`.
- `postGeoLocation` lives on `SocialPost` (per-event); `profileLocation` lives on `Author` (per-account) — verified by schema inspection.

---

## Story 3.2 — IngestionRun as the audit anchor for every post

**Source:** ADR-0005 · **Status:** Ready

**As an** operations engineer investigating a data issue,
**I want** every `SocialPost` linked via `acquisitionId` to the `IngestionRun` that produced it, with that run recording trigger type, connector version, and outcome,
**so that** I can trace exactly which process, at what time, with what connector version, brought any given post in.

**Acceptance Criteria**
- Every `SocialPost` insert has a non-null `acquisitionId` referencing an existing `IngestionRun`.
- `IngestionRun` records `triggerType` (`poll`/`webhook`), `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`, `postsSkipped`, and `errorSummary` when applicable.
- Given a `SocialPost` ID, a support engineer can retrieve its originating run's connector version and trigger type in a single query.

---

## Story 3.3 — Connector-side watchlist filtering with post-fetch fallback

**Source:** ADR-0006 · **Status:** Ready

**As a** tenant configuring a watchlist,
**I want** matching to happen on the platform's own server when it supports query filtering, falling back to post-fetch matching in the core when it doesn't,
**so that** rate-limit budget isn't spent fetching posts that don't match, wherever that's avoidable.

**Acceptance Criteria**
- For a platform whose connector translates watchlist terms into native query parameters, requests sent to that platform include the translated filter.
- For a platform without native filtering support, the core evaluates the watchlist against every fetched post before persisting matches.
- A given `Watchlist` produces the same matched posts regardless of which platform sourced them (subject to Story 3.6 / ADR-0021 closing the AST-consistency gap).

---

## Story 3.4 — Cursor-based pagination for the posts API

**Source:** ADR-0011 · **Status:** Ready

**As an** API consumer paging through a tenant's posts,
**I want** `GET /posts` paginated by opaque cursor rather than offset,
**so that** performance stays stable on a high-volume, continuously-growing table, and concurrent inserts don't cause skipped or duplicated results across pages.

**Acceptance Criteria**
- `GET /posts` accepts a `cursor` query parameter and returns a cursor for the next page; it does not accept `page`/`offset` parameters.
- Paging through results while new posts are being ingested concurrently produces no duplicate or skipped posts across pages (verified by a test that inserts rows mid-pagination).
- Query latency for a page near the "end" of a multi-million-row table is comparable to a page near the "start" (no linear degradation with depth).

---

## Story 3.5 — Tiered data retention and archival

**Source:** ADR-0018 · **Status:** Blocked — pending ADR-0018 acceptance

**As a** platform operator managing storage cost on an unbounded, high-volume table,
**I want** `rawPayload` and `IngestionRun` moved to cheaper archival storage after a bounded hot-storage window, while analytically-relevant fields stay indefinitely in primary storage,
**so that** primary storage growth is bounded by the actually-expensive part of the data, without losing the fields needed for future multi-year topic aggregation.

**Acceptance Criteria**
- A `SocialPost` older than 90 days (implementation default — see ADR-0018's Amendment Log) has its `rawPayload` replaced by a pointer to archival blob storage, while `tenantId`, `platformId`, `publishedAt`, `authorId`, `engagementMetrics`, and `enrichment.*` remain live and queryable.
- An `IngestionRun` older than 90 days is archived, not hard-deleted — every `SocialPost.acquisitionId` referencing it continues to resolve.
- `SocialPost` and `IngestionRun` are partitioned monthly, and archival operates by detaching/exporting the oldest partition rather than a row-by-row delete sweep.
- Fetching an archived `rawPayload` (e.g., for a support investigation) succeeds via the archival pointer, confirming the "never discarded" guarantee (§4.2) still holds post-archival.

---

## Story 3.6 — Unified boolean-query AST for watchlist matching

**Source:** ADR-0021 · **Status:** Blocked — pending ADR-0021 acceptance

**As a** tenant with a watchlist using a boolean query,
**I want** that query parsed once into a canonical AST that every connector's native translation and the shared post-fetch fallback both evaluate identically, with unsupported query features surfaced to me rather than silently degrading,
**so that** I get consistent matching behavior across platforms and know when a platform can't fully honor my query.

**Acceptance Criteria**
- A `Watchlist.booleanQuery` is parsed into an AST with `AND`/`OR`/`NOT`/`TERM`/`HASHTAG`/`ACCOUNT` node types before any connector or fallback matcher evaluates it.
- Each connector declares `supportedQueryFeatures: AstNodeType[]`; a query containing a node type the connector doesn't support falls back to post-fetch matching for that platform, and this fallback is visible on the connector/watchlist status view.
- A test asserting the same `Watchlist` against a mock platform with full native support and a mock platform with none produces identical matched posts for identical input data.
