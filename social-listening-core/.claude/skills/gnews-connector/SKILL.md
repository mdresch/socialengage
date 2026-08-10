---
name: gnews-connector
description: The real GNews SocialConnector (general-news search API, publication-as-Author). Read this before touching src/connectors/gnews/**, before changing credentialStore.ts's getLatestCredentialId(), or before adding another authMode:'api_key' real connector.
---

# GNews connector

## What this is

The second real, non-example `SocialConnector` in this repo (ADR-0026), and the first to actually exercise `authMode: 'api_key'` in a running build: it polls GNews's real Search endpoint (`gnews.io/api/v4/search`) using a per-tenant-stored API key and normalizes each returned article into a `SocialPost` whose `Author` is the *source publication*, not an individual journalist — the same scoped exception to ADR-0004's per-account modeling that Newswire (ADR-0024) established, confirmed here as a real, recurring pattern rather than a one-off (see ADR-0004's own Supersession update, 2026-07-31). It also closes Phase 1's own longest-standing gap — the "actual RSS/News connector implementation" line that stayed unbuilt even after Story 2.6 (Newswire, a later Phase-4 connector) shipped ahead of it.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0026 | GNews API as RSS/News's concrete provider; `Author` represents the source publication for this connector only; `authMode: 'api_key'`, `deliveryMode: 'poll'`, 100 requests/day (real, published, confirmed ceiling), free-tier non-commercial-use constraint accepted, cross-publication de-duplication left to implementation time | 2.7 |
| ADR-0004 (Pending supersession note, 2026-07-31; Supersession update, 2026-07-31) | This connector's publication-as-Author modeling is the second documented exception to Author's normal per-account assumption — confirmed as a real pattern, "rule of three" applied rather than generalizing into ADR-0004's own text yet | 2.7 (not 3.1) |
| ADR-0027 | This connector never holds a SocialEngage-issued credential — each tenant registers and pays for its own GNews key directly; SocialEngage never intermediates billing/pricing | 2.7 (confirms, doesn't change scope) |

## Contracts that constrain this component

- `contracts/epic-2/story-2.7.gnews-connector.contract.test.ts` — registered connector shape (authMode `api_key`/deliveryMode `poll`/providerId distinct from Newswire's); real live-GNews ingestion via `runIngestionAttempt()` using a per-tenant stored credential; Author resolves to the source publication with `followerCount` unpopulated; `supportedQueryFeatures` declared as `['AND', 'OR', 'NOT', 'TERM']` and watchlist matching genuinely falls back for node types GNews can't express (HASHTAG/ACCOUNT); rate limit config matches GNews's published 100/day ceiling; idempotent re-poll (no duplicate rows across two consecutive cycles). Like Story 2.6, this makes real outbound HTTP calls to GNews's own live Search endpoint — requires a real `GNEWS_API_KEY` (see `.env.example`) and a real Azure Key Vault reachable via `az login`.

## How to extend this safely

- **Changing the default query:** `DEFAULT_QUERY` (`pollGNewsSearch.ts`) is one representative term (`'technology'`), chosen for consistently non-empty live results — ADR-0026 leaves the actual query/feed selection an implementation-time/tenant-demand choice, not fixed here, same as Newswire's feed subset. Pass a different `query` argument to `pollGNewsSearch()`; no code change needed for a one-off different term.
- **Pushing a watchlist's query down as GNews's own `q` param natively (`translateWatchlistQuery()`):** not implemented by this story, matching Newswire's own precedent — `resolveWatchlistAstDispatch()`/`matchPostsForWatchlistAst()` are proven correct against GNews's real declared capability (AC3), but nothing yet calls `translateWatchlistQuery()` from inside this connector's own `attempt()`. GNews's real native AND/OR/NOT/phrase support (richer than Newswire's) makes this connector the best current candidate to build that wiring first, whenever it's picked up.
- **Any other real `authMode: 'api_key'` connector:** `getGNewsApiKey()`'s pattern (`getLatestCredentialId()` → `readCredential()`, a missing credential thrown as a `ClassifiableError('http_401', ...)` so `runIngestionAttempt()` classifies it exactly like a real 401) is the sanctioned shape — reuse it rather than inventing a second credential-resolution pattern.

## Load-bearing constraints — do not change casually

- **`getLatestCredentialId(tenantId, platformId)` (`credentialStore.ts`) is this story's new addition** — the first reader resolving a *tenant-supplied* credential by platform rather than by a caller-known credential id. It returns the *most recently stored* credential for that `(tenantId, platformId)` pair (`ORDER BY created_at DESC LIMIT 1`) — if a tenant ever re-registers a new GNews key, the newest one wins; there is no revocation/rotation of the older row, and no connector-connect/disconnect endpoint exists yet to manage this (Phase 1's "also build, not storied" scope).
- **No `social_posts.external_id`/`platform_id` column exists** (same as Newswire) — dedup (`findSocialPostByExternalId()`) queries `raw_payload->>'providerId'`/`raw_payload->>'externalId'` directly, so **every insert this connector makes must embed both keys in `rawPayload`**. Dropping either silently breaks re-poll idempotency (AC4) without failing any type check.
- **`Author.followerCount` is deliberately left unpopulated** — ADR-0026's publication-as-Author exception, not a bug. Don't backfill it with a placeholder.
- **A missing tenant credential is a `ClassifiableError('http_401', ...)`, not a thrown plain `Error`** — this is what lets `runIngestionAttempt()` correctly *not* blind-retry a tenant who simply hasn't connected GNews yet, the same way it wouldn't retry a real 401 from GNews itself.
- **GNews's 429 (rate-limit-exceeded) response is mapped to `ClassifiableError('rate_limit', ...)`** — a real addition beyond Newswire's error handling, since GNews (unlike Newswire) has a real, documented ceiling that can actually be hit. `RETRYABLE_KINDS` already includes `rate_limit`, so this retries with backoff rather than failing immediately.
- **The contract test hits GNews's real live Search endpoint and a real per-tenant-stored, envelope-encrypted credential.** Its content assertions (AC1–AC3) are written to tolerate live results changing between runs — don't "fix" a rare failure by hardcoding a specific article's title/source; that would reintroduce the synthetic-fixture dependency ADR-0026 asked this story to avoid.

## Known gaps / deferred work

- **No admin-UI credential-connect flow** — a tenant's GNews key is stored via `storeCredential()` directly in this story's contract test; the real `POST /connectors/:platformId/connect` endpoint and admin UI form (ADR-0027's own named requirement: make it unambiguous the tenant is signing up with GNews directly, not through SocialEngage) don't exist yet anywhere (Phase 1's "also build, not storied" scope).
- **`translateWatchlistQuery()` not implemented** — see "How to extend this safely" above.
- **No persisted `Watchlist`/query-selection configuration** — `query` is a plain parameter today, same gap as Newswire's `feedUrls`.
- **Cross-publication de-duplication is deliberately not implemented** (ADR-0026 leaves this open) — the same wire story picked up by multiple outlets GNews indexes yields distinct `SocialPost` rows, same v1 choice as Newswire's cross-wire duplicates.
- **No connector/watchlist status view surfaces `unsupportedNodeTypes`** — proven at the data level only (AC3), same gap Story 3.6/Newswire already named as unbuilt.
- **GNews's free-tier non-commercial-use constraint (ADR-0026) is a recorded operating constraint, not runtime-enforced** — nothing in this connector's code checks or blocks commercial use; it's a documentation-level accepted constraint tied to this project's own current non-commercial status, to be revisited if that status ever changes.
- **`ingestGNewsArticles()` now calls `enrichPost()` before each `insertSocialPost()` (Story 2.8, 2026-08-10)** — best-effort, never blocks ingestion. See `.claude/skills/azure-ai-language-connector/SKILL.md` for the full mechanism; this note is kept here (not deleted, per this doc series' own convention) since it was a real addition to this connector's own ingest function, not just a new file elsewhere.
