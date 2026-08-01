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

## Supersession update (2026-07-31, backfilled)

**ADR-0024 was accepted 2026-07-30** — the note above became real that same day, but the confirming update was never actually appended until this entry, a real drift caught during ADR-0026's drafting rather than a deliberate delay. The issuer-as-Author exception for the Newswire connector is in effect as described above. This backfill does not change anything about ADR-0024's own acceptance date or scope; it only brings this file's own record current with it, per this series' own governance convention for a "Pending supersession note" whose trigger has occurred.

## Pending supersession note (2026-07-31)

**ADR-0026** (Proposed, not yet accepted) would introduce a second, structurally identical scoped exception, this time for the RSS/News connector (GNews API): `Author` would represent the article's **source publication**, not an individual — `followerCount` left unpopulated, `externalAuthorId` mapped to GNews's `source.id` (or `source.name`) rather than a personal account handle. This is not a new pattern; it reuses ADR-0024's issuer-as-Author exception rather than inventing a second one, and confirms — with a second real instance — the question ADR-0024's own Consequences section raised but declined to answer: whether the organization-as-Author pattern generalizes beyond Newswire. If ADR-0026 is accepted, both exceptions apply only to their own named connectors; the Decision above remains the general rule for every other connector, unaffected. Per this series' convention, the original Decision text above is still not edited. **Now that two connectors need the identical exception, ADR-0026's own "Open questions for decision" section recommends deciding — at ADR-0026's acceptance, not a third time later — whether this file should eventually carry a permanent, generalized clause instead of a growing list of per-connector notes.**

**Supersession update (2026-07-31):** ADR-0026 was accepted by Menno the same day it was drafted — the note above is now real, not hypothetical. The GNews/RSS/News connector's `Author` represents the source publication, per ADR-0026's Decision. **On the generalization question itself, decided at acceptance rather than deferred a third time: not yet — apply this project's own established "rule of three" instead** (the same threshold `docs/open-items-and-deferred-work.md` §C already uses for capability-based connector composition: "premature... revisit if one materializes"). Two connectors (Newswire, GNews) needing the identical exception is a real pattern, but not yet strong enough evidence to edit this ADR's original Decision text or draft a superseding ADR — that would mean committing to a permanent clause's exact shape (which field(s), which purpose, how it interacts with `followerCount`/`handle`) off two data points. **Trigger for revisiting:** the third connector that needs this same organization-as-Author departure gets a Pending-supersession note here exactly like this one and ADR-0026's, same as always — but at that point, generalizing into this Decision's original text (or a proper superseding ADR) becomes the default expectation, not just an option to consider again.
