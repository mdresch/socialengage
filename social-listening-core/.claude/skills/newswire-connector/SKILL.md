---
name: newswire-connector
description: The real Newswire SocialConnector (GlobeNewswire + PR Newswire direct public RSS, issuer-as-Author). Read this before touching src/connectors/newswire/**, before changing runIngestionAttempt()'s attempt() signature, or before adding another poll-mode real connector.
---

# Newswire connector

## What this is

The first real, non-example `SocialConnector` in this repo (ADR-0024): it polls GlobeNewswire's and PR Newswire's own free, public RSS feeds directly (no aggregator, no API key) and normalizes each item into a `SocialPost` whose `Author` is the *issuing organization*, not an individual account — a scoped exception to ADR-0004's per-account modeling. It is also the first connector wired end to end through the real ingestion pipeline (`runIngestionAttempt()` → `RequestGate` → `upsertAuthor()`/`insertSocialPost()`), closing the "connective tissue" gap every earlier connector-facing story left open (see `provider-connector-framework`'s and `social-post-lineage`'s SKILL.mds' "Known gaps").

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0024 | GlobeNewswire + PR Newswire direct public RSS as the connector's data source; `Author` represents the issuing organization for this connector only; `authMode: 'none'`, `deliveryMode: 'poll'`, no historical backfill, cross-wire de-duplication left to implementation time | 2.6 |
| ADR-0004 (Pending supersession note, 2026-07-30) | This connector's issuer-as-Author modeling is the documented exception to Author's normal per-account assumption | 2.6 (not 3.1 — that story's own contract is unchanged) |

## Contracts that constrain this component

- `contracts/epic-2/story-2.6.newswire-connector.contract.test.ts` — registered connector shape (authMode/deliveryMode/providerId); real live-feed ingestion from both wires via `runIngestionAttempt()`; Author resolves to the issuing organization with `followerCount` unpopulated; `supportedQueryFeatures` declared empty and watchlist fallback genuinely filters; no-API-key + idempotent re-poll (no duplicate rows across two consecutive cycles); cross-wire duplicates are accepted, not silently dropped, proven via a controlled fixture. This is the first contract in the repo that makes real outbound HTTP calls (to the live GlobeNewswire/PR Newswire feeds) rather than using a synthetic fixture — that's ADR-0024's own explicit bar, not an oversight; running it requires real internet access.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves this connector's own `NEWSWIRE_PROVIDER_ID` literal (`'newswire'`) appears nowhere in any core ingestion/orchestration file (ADR-0048 §1).

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/newswire/newswireConnector.ts` (the connector object, `providerId: NEWSWIRE_PROVIDER_ID`) and `src/connectors/newswire/pollNewswireFeeds.ts` (its own poll-mode ingest function, invoked by direct import — never looked up via `registry.ts`'s `getSocialConnector()` in production).
- **Extension points used:** the `SocialConnector` interface (`src/connectors/types.ts`) and `runIngestionAttempt()`'s generic `attempt()` callback shape — no other core file was touched to add this connector.
- **No-core-change verification:** `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` mechanically greps every designated core file for the literal string `newswire` and fails if found.

## How to extend this safely

- **Adding another feed (more GlobeNewswire industries, more PR Newswire categories):** pass a longer `feedUrls` array to `pollNewswireFeeds()` — no code change needed. `DEFAULT_NEWSWIRE_FEED_URLS` (`newswireConnector.ts`) is one representative feed per wire; ADR-0024 leaves the actual feed subset an implementation-time/tenant-demand choice, not fixed here.
- **Adding Business Wire/AccessWire:** only once their public RSS terms are independently confirmed open (ADR-0024's Decision) — don't assume they match GlobeNewswire/PR Newswire's shape. If confirmed, add a fetch+parse path the same way `fetchNewswireFeed()`/`rssFeedParser.ts` already do; keep `providerId: 'newswire'` shared only if the new wire's items should share this connector's issuer-as-Author identity, otherwise it's a new connector.
- **Any other real poll-mode connector needing `runIngestionAttempt()`:** its `attempt` callback now receives the just-opened run's id (`attempt: (runId) => ...`) — use it for `insertSocialPost()`'s required `acquisitionId`, the same way `pollNewswireFeeds()`/`ingestNewswireItems()` do. This was a necessary, additive change to shared `runIngestionAttempt.ts` made by this story (Story 2.6), not a Newswire-specific branch — see its Load-bearing constraints note below.
- **Parsing another feed's RSS quirks:** `rssFeedParser.ts`'s `extractTag()` already tolerates multi-line tag attributes and optional CDATA wrapping; extend it rather than writing a second parser if the new feed is still RSS 2.0.

## Load-bearing constraints — do not change casually

- **`runIngestionAttempt()`'s `attempt` callback now takes a `runId: string` parameter.** This was changed by this story specifically so a real connector can pass the run's own id into `insertSocialPost()`'s required `acquisitionId` from inside its own attempt closure — there was previously no way to do this at all (see `social-post-lineage`'s SKILL.md, "no real connector calls any of this yet"). The change is additive only: every existing zero-arg `attempt: async () => {...}` callback (Stories 2.3–2.5's contracts) remains valid under structural typing and was re-verified passing by this story's full-suite run. Don't add a second, competing way to obtain a run id — this is the sanctioned one.
- **No `social_posts.external_id`/`platform_id` column exists.** Dedup (`findSocialPostByExternalId()` in `socialPostStore.ts`) queries `raw_payload->>'providerId'`/`raw_payload->>'externalId'` directly — which means **every insert this connector makes must embed both keys in `rawPayload`** (see `ingestNewswireItems()`). Dropping either key from a future refactor silently breaks re-poll idempotency (AC4) without failing any type check.
- **Cross-wire de-duplication is deliberately not implemented** (ADR-0024 leaves this open; this story's decision is "accept duplicates for v1" — see AC5's contract). Don't assume a GlobeNewswire item and a PR Newswire item are the same release just because their `issuer`/title look similar; no matching logic exists for this and shouldn't be added without a follow-up ADR/story decision.
- **`Author.followerCount` is deliberately left unpopulated** for this connector (`upsertAuthor()`'s profile omits it) — this is ADR-0024's issuer-as-Author exception, not a bug. Don't backfill it with a placeholder value.
- **No JSONB index on `social_posts.raw_payload`** — the dedup lookup is a sequential scan filtered by two `->>'...'` extractions. Fine at this project's current scale (proven mechanism, not scale); revisit with a proper index (or a real `external_id` column) if/when a second real poll-mode connector makes this a shared, higher-volume concern.
- **The contract test hits real GlobeNewswire/PR Newswire URLs.** Its content assertions (AC2, AC3) are written to tolerate live feed content changing between runs (deriving expectations from whatever was actually fetched, not a hardcoded headline) — don't "fix" a rare failure by hardcoding a specific release's title/issuer; that would silently reintroduce the exact synthetic-fixture dependency ADR-0024 asked this story to avoid.
- **PR Newswire's feed sits behind Cloudflare and intermittently returns a non-200 for a single request** (confirmed directly via repeated `curl` requests: consistently 200, with an occasional transient non-200) — `fetchNewswireFeed()` already classifies this correctly as `'network'` (retryable, ADR-0010), and `pollNewswireFeeds()` already gets that tolerance for free via `runIngestionAttempt()`'s own retry-with-backoff. **AC3 alone calls `fetchNewswireFeed()` directly** (it needs the raw parsed items, not a DB-inserting pipeline run) and previously had none of that tolerance — healed 2026-08-06 by adding `fetchNewswireFeedWithRetry()` (the contract's own file), reusing `isRetryable()` and the same exponential-backoff shape `runIngestionAttempt()` uses. Don't revert AC3 to a raw `fetchNewswireFeed()` call — that reintroduces exactly this gap.
- **`ingestNewswireItems()` now calls `enrichPost()` before each `insertSocialPost()` (Story 2.8, 2026-08-10)** — best-effort, never blocks ingestion. See `.claude/skills/azure-ai-language-connector/SKILL.md` for the full mechanism.

## Known gaps / deferred work

- **Business Wire and AccessWire are not covered** — deferred per ADR-0024 pending independent confirmation of open public RSS access.
- **No historical backfill** — RSS only carries recent/live items; a watchlist created today can't see releases from before the connector started polling (ADR-0024's own accepted trade-off).
- **No persisted `Watchlist`/feed-subset configuration** — `feedUrls` is a plain parameter today; wiring it to a real per-tenant watchlist/feed selection is Phase 1's "also build, not storied" work (no `Watchlist` table/CRUD exists yet anywhere in this repo).
- **No connector/watchlist status view surfaces `unsupportedNodeTypes`** — proven at the data level only (AC3), same gap Story 3.6 already named as unbuilt.
- **`getRateLimitConfig()`'s numbers are an unconfirmed placeholder** (neither wire publishes a real limit) — revisit if either service's terms ever specify an actual ceiling, per ADR-0024's own Implementation defaults note.
