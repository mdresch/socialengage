---
name: brave-search-connector
description: The Brave Search active watchlist sourcing connector (web & news search API, domain-as-Author, AST in-process validation, 1.2s pacing loop). Read this before touching src/connectors/braveSearch/**.
---

# Brave Search connector

## What this is

An active discovery `SocialConnector` (ADR-0065, Story 2.21) that iterates a tenant's active watchlists to actively query the Brave Search API (`/res/v1/news/search` or `/res/v1/web/search`), performs in-process dual discovery and AST validation, maps source publication/domain to `Author`, normalizes snippets to Markdown, ingests posts into `social_posts`, and persists junction links into `post_watchlist_matches`.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0065 | Active watchlist sourcing via Brave Search API: polling connector iterating tenant active watchlists, dual discovery query + in-process AST validation filter, Domain/Publication as Author (ADR-0004 generalization), quota-safe cadence with 1.2s pacing loop, post grounding and LLM enrichment | 2.21 |
| ADR-0004 | Generalization of organization/domain-as-Author modeling: `author.id = "brave-search:" + domain`, `author.username = domain`, `author.displayName = domain` | 2.21 |
| ADR-0027 | Tenant contracts directly with Brave Search for subscription token; SocialEngage is technical intermediary only | 2.21 |
| ADR-0028 / ADR-0034 | Tier-2 tenant-owned credential (`owner_type: 'tenant'`) in `platform_credentials` | 2.21 |
| ADR-0063 | Ingested posts explicitly link to the discovering watchlist via `post_watchlist_matches` junction persistence | 2.21 |
| ADR-0076 | Composer Deep Research one-off search helpers reuse Brave Search credentials and query machinery, but do not persist posts | 2.31 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.21.brave-search-active-watchlist-connector.contract.test.ts` — connector definition, query construction from watchlists, dual discovery & in-process AST validation, domain-as-Author mapping, canonical URL deduplication, and junction table persistence.
- `contracts/epic-2/story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts` — one-off `searchForResearch()` helper, research RequestGate key, no persistence, and error classification.
- `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts` — proves `brave-search` literal appears in designated registration surfaces only and no core pipeline logic is hardcoded.

## Registration transparency (ADR-0048)

- **Registration location:** `src/connectors/braveSearch/braveSearchConnector.ts` (`BRAVE_SEARCH_PROVIDER_ID = 'brave-search'`) and `src/connectors/bootstrapConnectors.ts`.
- **Extension points used:** `SocialConnector` interface (`src/connectors/types.ts`), `runIngestionAttempt()`, `publishSocialPostIngestedEvents()`, and `insertPostWatchlistMatches()`.
- **No-core-change verification:** Verified by `story-2.10.connector-registration-transparency.contract.test.ts`.

## How to extend this safely

- **Query formatting (`braveSearchQueryBuilder.ts`):** `buildBraveSearchQuery()` builds search expressions from `Watchlist`. Keyword/hashtag/account terms are joined with `OR`, while boolean queries pass their formatted boolean expressions.
- **Dual Validation (`validateCandidateMatch`):** Evaluates candidate title + snippet against watchlist AST via `matchesAst()` / `watchlistToAst()`. Only candidates satisfying the exact filter rules are ingested.
- **Pacing Loop:** A 1.2-second sleep is enforced between sequential watchlist searches during polling to strictly adhere to Brave Search's 1 req/sec rate limit.
- **One-off Research (`searchForResearch`):** `braveSearchConnector.ts` exposes `searchForResearch(tenantId, query, limit)` for the composer Deep Research endpoint. It reuses the tenant credential and `fetchBraveSearch()` with the `/res/v1/web/search` endpoint, acquires a separate `RequestGate` key `(tenantId, 'brave-search', 'research')`, and returns `{ title, url, snippet, provider }` without persisting posts or touching `post_watchlist_matches`.

## Load-bearing constraints

- **1.2s Pacing delay:** Must never be removed in production to prevent HTTP 429 rate limit cascades across watchlists.
- **Deduplication:** Dedup is URL-based on `(tenant_id, 'brave-search', externalId)`. URLs must be canonicalized (stripping `utm_*`, tracking fragments) before storage.
- **Post-Watchlist Junction:** Every post ingested as part of a watchlist query must persist `(post_id, watchlist_id, tenant_id)` in `post_watchlist_matches`.
- **Credential Model:** `owner_type: 'tenant'` stored in `platform_credentials`, read via `getLatestCredentialId(tenantId, 'brave-search', 'tenant')`. Missing credential throws non-retryable `ClassifiableError('http_401', ...)`.
- **Error classification:** HTTP 401/403 mapped to `http_401`/`http_403`; HTTP 429 mapped to `rate_limit` (retryable); HTTP 5xx mapped to `http_5xx` (retryable).
- **One-off research is non-persistent:** `searchForResearch()` never inserts `social_posts`, `post_watchlist_matches`, or `ingestion_runs`, and never emits `SocialPostIngestedEvent`.
