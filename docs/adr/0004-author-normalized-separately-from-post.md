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

## Pending supersession note (2026-08-06)

**ADR-0042** (Proposed, not yet accepted) proposes a Wikipedia connector in which `Author` represents **the specific Wikipedia article being tracked** — keyed by the article's stable `pageid`, reused across every `SocialPost` produced by re-polling that article's own revision history over time (ADR-0042 Decision §2/§3). **This is argued there as a real third instance of the departure this file's own 2026-07-31 note above already anticipated — but a structurally narrower one, not a mechanical repeat.** Newswire's and GNews's `Author` represents a real-world organization that exists independently of the platform and produces genuinely distinct works (many press releases, many articles); ADR-0042's `Author` represents the persistent identity of a single platform-native document, with no existence outside Wikipedia, whose many "posts" are revisions of the *same* work, not distinct ones. The reused-entity property this file's Decision cares about (many posts, one `Author`, no per-post duplication) holds in both cases; the "is an independently-identified issuing organization" property does not. ADR-0042 itself recommends that if this is accepted as a genuine third instance, the resulting generalized clause be written broadly enough to cover both shapes — "a persistent, non-individual, reusable content-producing or content-identity entity," not narrowly restated as "organization" — rather than assuming the two are identical. If ADR-0042 is accepted, this note recommends Menno decide the exact generalized wording at that acceptance, consistent with this file's own 2026-07-31 note's pre-committed trigger ("generalizing... becomes the default expectation, not just an option to consider again") — but decide it deliberately, against the narrower framing above, not by assuming three data points are three of the same thing. Per this series' convention, the original Decision text above is still not edited by this note.

## Pending supersession note — 2026-08-10 (ADR-0049)

**Pending supersession by ADR-0049 (Proposed)**, affecting one named negative consequence only.

ADR-0049 (`docs/adr/0049-point-in-time-author-follower-count-on-social-post.md`, Status: Proposed) proposes adding one optional field — `author_follower_count_at_publish` — to `SocialPost`, capturing the author's follower count as reported by the platform connector at the moment that specific post is fetched and normalized. This is a scoped exception to this ADR's decision, explicitly limited to one field:

- **What would change if ADR-0049 is accepted:** `SocialPost` gains one nullable integer column. `Author.followerCount` continues exactly as designed — upserted in place, always the most-recently-seen value. No other author field is added to `SocialPost`.
- **What does not change:** ADR-0004's normalized Author model is otherwise unaffected. This ADR's decision that author profile fields (handle, displayName, profileLocation, verifiedStatus) are stored once on `Author` and never embedded per post is not changed by ADR-0049.
- **This supersession note covers:** the specific negative consequence that reads *"Author facts like `followerCount` reflect whatever was true at last-seen time, not at each individual post's `publishedAt` — historical accuracy of 'follower count at time of post' is not preserved."* ADR-0049, if accepted, addresses that consequence narrowly, for connectors that supply this value at ingest time. It does not change the consequence generally.

This note is appended per this series' convention; it does not edit the original text above. The Decision and Consequences text above reflects the historical record as of ADR-0004's acceptance on 2026-07-28. If and when ADR-0049 is accepted by Menno (Sponsor), a dated "Supersession update" note will be added below this one, per the convention established when ADR-0009/0010's supersession by ADR-0023 was handled.

## Supersession update — [DATE TO BE ADDED AT ADR-0049 ACCEPTANCE] (ADR-0049)

*(To be filled in by Menno or the AI persona at the time of ADR-0049 acceptance.)*

## Pending supersession note — 2026-08-10 (ADR-0050, organization-as-Author generalization)

**Pending generalization note by ADR-0050 (Proposed)**, affecting the scope of the organization-as-Author departure established by ADR-0024 and ADR-0026.

ADR-0050 (`docs/adr/0050-tenant-owned-domain-rss-content-feed-connector.md`, Status: Proposed) is the **third** connector in this series to need the organization-as-Author departure from this ADR's individual-account model (ADR-0024 was the first; ADR-0026 was the second). ADR-0026 explicitly flagged that a third instance would trigger the "rule of three" — the threshold at which a per-connector exception should be generalized into a standing clause on this ADR rather than accumulating further one-off notes.

**What ADR-0050 proposes to add to this ADR (if accepted):** a permanent, generalized "organization-as-Author" forward-pointer clause, establishing that when a connector's own data model represents "author" as an organization, publication, or verified domain rather than an individual social-platform account, the organization-as-Author departure is the expected pattern — not an exception requiring its own justification — and future connectors with the same shape may cite this clause directly. The exact wording of that clause is not drafted by ADR-0050 itself; it is left for acceptance time, consistent with this series' practice of appending, not prescribing, standing-clause text in advance.

**What would not change:** ADR-0004's Decision text above. The original normalized Author model (individual-account, per-`(tenantId, platformId, externalAuthorId)` keying, `firstSeenAt`/`lastSeenAt`, `followerCount` upserted in place) remains the default. The generalized clause is a forward-pointer for connectors that deviate from it, not a rewrite of the default.

This note is appended per this series' convention. If and when ADR-0050 is accepted, a dated "Supersession update" note confirming the generalized clause's exact wording will be added.

## Supersession update — [DATE TO BE ADDED AT ADR-0050 ACCEPTANCE] (ADR-0050, organization-as-Author generalization)

*(To be filled in by Menno or the AI persona at the time of ADR-0050 acceptance. Should include the exact text of the generalized "organization-as-Author" clause added to this ADR.)*
