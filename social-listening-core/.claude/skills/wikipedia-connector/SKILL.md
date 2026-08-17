---
name: wikipedia-connector
description: The real Wikipedia SocialConnector (MediaWiki Action API direct, article-as-Author, revision re-poll via recentchanges). Read this before touching src/connectors/wikipedia/**, before changing the discovery/re-poll two-phase pattern, or before adding another poll-mode real connector.
---

# Wikipedia connector

## What this is

A real, no-account, no-key `SocialConnector` (ADR-0042) that ingests a tracked Wikipedia article's own edit history, not a one-shot snapshot: `pollWikipedia()` discovers new articles via the `search` API and re-polls already-tracked ones via `recentchanges`, producing one `SocialPost` per qualifying revision. `Author` is the article itself, keyed by the page's stable `pageid` (not its title, which can change on a page move) — a structurally narrower third instance of ADR-0024's/ADR-0026's issuer-as-Author departure: the reused entity is a persistent platform-native document identity, not an independently-existing real-world organization (ADR-0042 Decision §3). `SocialPost.url` is the ingested revision's own permalink (`?oldid=`), Wikimedia's own stated attribution mechanism (ADR-0042 Decision §4) — deliberately kept separate from the `Author` question.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0042 | MediaWiki Action API directly, `authMode: 'none'`, revision re-poll cadence via `recentchanges` (not a snapshot), article-as-Author keyed by `pageid`, attribution via `SocialPost.url` (revision permalink), conservative unconfirmed rate-limit placeholder, `supportedQueryFeatures` declared conservatively empty | 2.13 |
| ADR-0058 Decision §5 | This connector adopts Story 5.19's already-built `SocialPostIngestedEvent` wiring as part of its own original build, not a separate follow-up | 2.13 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.13.wikipedia-connector.contract.test.ts` — registered connector shape (`authMode: 'none'`, `deliveryMode: 'poll'`, distinct `providerId`); a compliant, non-generic `User-Agent` on every request; two distinct revisions of the same tracked article across two `ingestWikipediaRevisions()` calls yield two distinct `SocialPost` rows, same `Author`; `Author` keyed by `pageid`, `displayName` the current title, `followerCount` unpopulated; `SocialPost.url` (`raw_payload.url`) contains the specific revision's `oldid`, never the bare article URL; first discovery ingests only the current revision; `supportedQueryFeatures` empty and watchlist matching genuinely falls back; `getRateLimitConfig()` returns a real, explicitly conservative placeholder; a repeated poll against an unchanged article is a correct no-op (dedup-enforced, no duplicate rows); this connector's own `ingestWikipediaRevisions()` publishes one `SocialPostIngestedEvent` per matching real tenant watchlist, best-effort (a rejecting `publishEvent()` never fails ingestion). This is a real, live-API contract (`en.wikipedia.org/w/api.php`, no key/account needed) — content assertions tolerate live results changing between runs, the same tolerance Story 2.6's/2.7's own contracts already establish.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves `WIKIPEDIA_PROVIDER_ID` (`'wikipedia'`) appears nowhere in any core ingestion/orchestration file (ADR-0048 §1).

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/wikipedia/wikipediaConnector.ts` (the connector object, `providerId: WIKIPEDIA_PROVIDER_ID`) and `src/connectors/wikipedia/pollWikipedia.ts` (its own poll-mode ingest function) — wired into the real running server only via `bootstrapConnectors.ts`, never looked up via `registry.ts` in production ingestion.
- **Extension points used:** the `SocialConnector` interface (`src/connectors/types.ts`) and `runIngestionAttempt()`'s generic `attempt()` callback shape — no core file was touched to add this connector.
- **No-core-change verification:** `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` mechanically greps every designated core file for the literal string `wikipedia` and fails if found.

## How to extend this safely

- **Discovery query:** `pollWikipedia(tenantId, query = DEFAULT_QUERY)` searches one representative query per poll cycle, the same "no real per-watchlist native query translation yet" limitation GNews's own `pollGNewsSearch()` already has (`translateWatchlistQuery()` is declared on `SocialConnector` but wired into no real connector's actual poll call today) — not resolved here, not this story's scope.
- **Adding a real per-watchlist search** (once that capability exists project-wide): would replace the single `query` parameter with one search per active, platform-matching watchlist's own translated terms — a cross-connector change, not a Wikipedia-specific one; check `gnews-connector`'s and `ingestion-events`'s own SKILL.mds first, since GNews/Newswire hit the identical gap.
- **Any other real poll-mode connector adding event publishing:** follow this connector's own `ingestWikipediaRevisions()` exactly — load `listActiveWatchlistsForTenant()` once per poll batch (filtered to this connector's own `providerId`), call `publishSocialPostIngestedEvents()` once per successfully-inserted post, after `insertSocialPost()` has resolved. See `.claude/skills/ingestion-events/SKILL.md`.

## Load-bearing constraints — do not change casually

- **Two-phase poll cycle, not one.** `pollWikipedia()`'s `attempt()` closure runs discovery (search for new articles, via `listAuthorsByPlatform(tenantId, WIKIPEDIA_PROVIDER_ID)` to know which `pageid`s are already tracked) before re-poll (fetch `recentchanges` per already-tracked article's own current title). Collapsing these into one phase would either re-ingest an already-discovered article's current revision as if new, or never discover a genuinely new one.
- **`listAuthorsByPlatform()` (`authorStore.ts`) is this connector's only "already discovered" membership check** — there is no separate tracking table. An article is "tracked" precisely when an `authors` row exists for `(tenantId, 'wikipedia', pageid)`, which only ever happens after its first successful ingest.
- **No `rcstart` narrowing on `recentchanges`** — `fetchWikipediaRecentChanges()` fetches the most recent `rclimit` changes for a title on every re-poll call, not only those since the last check. Correctness (no duplicate rows) is guaranteed entirely by `findSocialPostByExternalId()`'s own dedup check inside `ingestWikipediaRevisions()`, not by narrowing the API call itself — a real, named inefficiency (re-fetching an unchanged revision's own recent-changes list every poll cycle for a quiet article), not a correctness gap. Revisit only if this becomes a measured rate-limit or cost concern.
- **`Author.followerCount` is deliberately left unpopulated** — this connector's own instance of the organization-as-Author exception (ADR-0004's generalized clause). Don't backfill it with a placeholder value.
- **`getRateLimitConfig()`'s numbers are an explicit, unconfirmed placeholder** (Wikimedia's own rate-limits policy was referenced but not fetched to an exact numeric ceiling at ADR-0042 drafting time) — the same honest treatment ADR-0024 gave Newswire's own unpublished limit. Revisit if a confirmed Wikimedia number is ever found.
- **`supportedQueryFeatures` is declared empty** — CirrusSearch's exact native-query-parameter surface through the standard `action=query&list=search` endpoint was never confirmed to this project's own primary-source bar (ADR-0042's own named Open Question). Watchlist matching for this connector always falls back to whole-article post-fetch matching; don't declare a node type as supported without independently verifying it against the real API first.
- **`ingestWikipediaRevisions()` calls `enrichPost()` before each `insertSocialPost()`** — best-effort, never blocks ingestion, same precedent as every other real connector. See `.claude/skills/azure-ai-language-connector/SKILL.md`.
- **`ingestWikipediaRevisions()` publishes `SocialPostIngestedEvent`s via `publishSocialPostIngestedEvents()` — best-effort, catch-and-log, never re-thrown.** A Service Bus outage must never fail real ingestion. See `.claude/skills/ingestion-events/SKILL.md`'s own Load-bearing constraints for the shared design this connector adopts unmodified.

## Known gaps / deferred work

- **No revision-history backfill** — a newly discovered article's own edit history predating discovery is never ingested, only its current content (ADR-0042's own accepted trade-off, matching every other connector's "no historical backfill" precedent).
- **No materiality threshold** — every qualifying `recentchanges` entry produces a `SocialPost`, unfiltered by edit size or the `minor` flag (ADR-0042's own named, deliberately unresolved Open Question).
- **No real per-watchlist discovery query** — see "How to extend this safely" above; shared gap with GNews.
- **The CC BY-SA "Adapted Material" question for AI-enrichment output derived from Wikipedia text is named, not analyzed** (ADR-0042's own Open Question) — enrichment applies completely unmodified, no Wikipedia-specific handling exists.
- **No RAG/embedding-oriented chunked ingestion** — `SocialPost.text` stores the whole article's current revision, matching every other connector's own whole-item storage.

## Relations to other components

- Calls `runIngestionAttempt()` (`ingestion/runIngestionAttempt.ts`) via `pollWikipedia()`, `upsertAuthor()`/`insertSocialPost()`/`findSocialPostByExternalId()` (`social-post-lineage`), `enrichPost()` (`azure-ai-language-connector`), `htmlToMarkdown()` (`canonical-markdown-conversion`), `acquireForProvider()` (`provider-connector-framework`), `listActiveWatchlistsForTenant()`/`publishSocialPostIngestedEvents()` (`ingestion-events`) — the identical call shape every other real connector's own `ingestXItems()` already uses, verified directly at this connector's own real production call site by this story's own contract, not only in isolation.
- Registered into the shared registry (`connectors/registry.ts`) only via `bootstrapConnectors.ts` (`connector-registration`/`ingestion-polling-scheduler` — see `provider-connector-framework`'s SKILL.md), never a hardcoded per-`providerId` branch anywhere (ADR-0048).
