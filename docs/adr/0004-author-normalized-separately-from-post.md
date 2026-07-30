# ADR-0004: Normalize `Author` once per platform account, not embedded per post

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §4.1 "Author"

## Context

Every ingested `SocialPost` has an author, and the same author will post repeatedly within a watchlist's matching window. The system also needs to support an "expert finder" query (`GET /topics/:topic/authors`, §6) that reasons about an author's behavior over time (activity months, follower count, mention history) rather than about any single post.

## Decision

Model `Author` as its own entity, keyed by `(tenantId, platformId, externalAuthorId)`, upserted as new posts arrive, tracking `firstSeenAt`/`lastSeenAt` and the raw profile payload. `SocialPost.authorId` is a foreign key into `Author` rather than embedding author fields on every post.

## Consequences

**Positive**
- Author-level facts (follower count, display name, profile location) are stored once and updated in place, instead of being duplicated and potentially going stale across thousands of posts from the same account.
- `firstSeenAt`/`lastSeenAt` and the upsert-on-arrival pattern give a natural way to track account activity over time, which the expert-finder query and `AuthorTopicSignal` (ADR-0007) build on directly.
- Keeps `SocialPost` focused on per-event data (engagement metrics, per-post geo, enrichment), matching the spec's explicit note that `postGeoLocation` is "per-event, not per-author" while `profileLocation` lives on `Author`.

**Negative**
- Every post write now involves an author upsert (or a lookup against an already-upserted author within the same ingestion run), adding a write path that a fully denormalized post table wouldn't need.
- Author facts like `followerCount` reflect whatever was true at last-seen time, not at each individual post's `publishedAt` — historical accuracy of "follower count at time of post" is not preserved.

## Alternatives Considered

- **Embed author fields directly on each `SocialPost`** — avoids the join and upsert logic, but duplicates author data across every post from the same account, makes profile updates require a backfill across historical posts, and doesn't give a clean anchor for author-level aggregates like `AuthorTopicSignal`.

## Pending supersession note (2026-07-30)

**ADR-0024** (Proposed, not yet accepted) would introduce a scoped exception to the Decision above for one connector: for a Newswire connector targeting direct wire-service RSS feeds, `Author` would represent the *issuing organization*, not an individual platform account — `followerCount` left unpopulated, `externalAuthorId` mapped to the wire service's issuer identifier rather than a personal account handle. If ADR-0024 is accepted, this exception applies only to that connector; the Decision above — `Author` normalized once per `(tenantId, platformId, externalAuthorId)`, tracking `firstSeenAt`/`lastSeenAt` and a raw profile payload — remains the general rule for every other connector, unaffected. This note is a forward-pointer only; per this series' convention, the original Decision text above is not edited. See `docs/adr/README.md`'s governance table and ADR-0024's own "Open questions for decision" for whether this scope should eventually be stated here permanently rather than per-connector.
