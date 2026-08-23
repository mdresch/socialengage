# Bing Search API Active Watchlist Connector

## Story
Story 2.22 — Active Watchlist Sourcing via Bing Search API (Azure): Polling connector, candidate evaluation cap, and URL canonicalisation.

## Intent
Actively query the Bing Search API (Azure AI Services / Azure AI Foundry Grounding with Bing Search) for active watchlists, strictly validate candidate results in-process against watchlist AST rules, and ingest them as canonical social posts linked to their respective watchlists with tenant-scoped cost telemetry.

## Governing decisions
- **ADR-0066:** Bing Search API (Azure AI Services) active watchlist polling connector, dual discovery & validation, top 25–50 candidate evaluation cap, deterministic auto endpoint selection (`/v7.0/news/search` with fallback to `/v7.0/search` when $< 5$ validated items), multi-step URL canonicalisation, publication/base domain as Author, and tenant-scoped Azure cost telemetry ($14.00 per 1,000 transactions = $0.014/call).
- **ADR-0004:** Author normalized separately from post (`bing-search:<domain>`).
- **ADR-0027:** Connector is a technical intermediary; tenant provisions their own Azure Cognitive Services / Bing resource.
- **ADR-0028:** Tier-2 tenant credential (`ownerType: 'tenant'`) storing `Ocp-Apim-Subscription-Key`.
- **ADR-0048:** Connector registration transparency — registration touches only connector-internal code and `bootstrapConnectors.ts`.
- **ADR-0063:** Multi-watchlist junction linking in `post_watchlist_matches`.
- **ADR-0076:** Composer Deep Research one-off search helpers reuse Bing Search credentials and query machinery, but do not persist posts (Story 2.31).

## Architecture
- `bingSearchConnector.ts` — `SocialConnector` definition (`providerId: 'bing-search'`, `authMode: 'api_key'`, `deliveryMode: 'poll'`), URL canonicalisation, domain extraction, freshness mapping, publication date parsing, Azure API HTTP fetch with error classification, and `searchForResearch(tenantId, query, limit)` for one-off composer research.
- `bingSearchQueryBuilder.ts` — Watchlist query string formatting (quoted terms OR-expression or boolean expression) and in-process AST candidate matching.
- `pollBingSearch.ts` — Scheduled polling loop across tenant active watchlists, 1.2s sequential pacing delay, deterministic auto endpoint fallback, candidate evaluation cap, post deduplication, event emission, `post_watchlist_matches` junction insertion, and Azure cost telemetry.

## Registration transparency (ADR-0048)
- **Registration location:** `src/connectors/bootstrapConnectors.ts` (via `bootstrapConnectors()`)
- **Extension points used:** `registerSocialConnector()` with `poll: (tenantId) => pollBingSearch(tenantId)` and `pollCadenceMs: ONE_HOUR_MS`
- **No-core-change verification:** Verified by `contracts/epic-2/story-2.10.connector-registration-transparency.contract.test.ts`

## Contracts
- `contracts/epic-2/story-2.22.bing-search-active-watchlist-connector.contract.test.ts`
- `contracts/epic-2/story-2.31.brave-and-bing-one-off-research-search-helpers.contract.test.ts` — one-off `searchForResearch()` helper, research RequestGate key, no persistence, and error classification.
