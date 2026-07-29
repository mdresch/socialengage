# ADR-0011: Cursor-based pagination for `GET /posts`

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §6 "REST API Surface (v1)"

## Context

`SocialPost` is described as "high-volume and unbounded" — it accumulates continuously as tenants' watchlists match new content across platforms, with no natural upper bound. `GET /posts` supports filtering by `watchlistId`, `platformId`, `from`/`to`, and `sentiment`.

## Decision

Paginate `GET /posts` using a cursor (`cursor=` query parameter), not offset/limit.

## Consequences

**Positive**
- Cursor pagination has stable, predictable performance regardless of how deep into the result set a client pages — offset pagination on a large, growing table gets progressively slower as the offset grows (the database must scan and discard all preceding rows).
- Avoids the classic offset-pagination correctness bug where new rows inserted ahead of a client's current page shift subsequent pages, causing skipped or duplicated results — a real concern here since posts are ingested continuously into the same table a client may be paging through.
- Fits naturally with `publishedAt`/`ingestedAt`-ordered access patterns, which is how most consumers (including future event-driven subsystems doing catch-up reads) will want to page through results.

**Negative**
- Cursor pagination doesn't support jumping to an arbitrary page number or showing a total result count cheaply — both of which offset pagination gives for free. Any admin UI needing "page 5 of 40" style navigation will need a different affordance (e.g., date-range filters instead of page numbers).
- Requires the API and any client SDKs to treat the cursor as an opaque token rather than something to construct or reason about directly, which is a slightly less familiar pattern for API consumers than `?page=2`.

## Alternatives Considered

- **Offset/limit pagination** — simpler and more familiar to API consumers, but degrades in performance on a large table and is prone to skip/duplicate bugs under concurrent inserts, which is the normal operating condition for this table.
