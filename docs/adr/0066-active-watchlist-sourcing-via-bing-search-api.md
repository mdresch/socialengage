# ADR-0066: Active Watchlist Sourcing via Bing Search API (Azure) — Polling Connector, Post Ingestion Grounding, and LLM Enrichment

**Status:** Proposed (2026-08-19, revised 2026-08-20)

**Source:** Follow-up to ADR-0065 (Brave Search API), ADR-0063 (Post-watchlist match persistence and server-side filters), and ADR-0062 (Analytics Dashboard Overview enhancements). This ADR evaluates Bing Search API (via Azure AI Services) as a first-party alternative and companion for actively sourcing watchlist-relevant content.

---

## Context

### The need for active watchlist sourcing

As established in ADR-0065, watchlists have evolved from passive matching filters (ADR-0006/ADR-0021) to benefit from active discovery. While the platform has existing reactive feeds (`gnews`, `newswire`, `tenant-owned-feed`), they do not proactively discover content that matches bespoke watchlist queries unless those topics cross public RSS feeds.

ADR-0065 established the pattern using the Brave Search API. This ADR establishes **Bing Web Search and Bing News Search (Azure AI Services)** as a functionally parallel, enterprise-grade alternative and companion, offering a large, stable index and direct alignment with the platform's existing Azure AI infrastructure (ADR-0038).

### Capabilities of Bing Search API (Azure)

Bing Search API v7 is available via Azure AI Services and provides structured JSON search results via REST endpoints:

- **`/v7.0/search`** – Web search across the Bing index
- **`/v7.0/news/search`** – Dedicated news search with recency and category filters
- **`/v7.0/news/trendingtopics`** – (optional) Trending topics, not required for watchlist sourcing

Key characteristics relevant to this use case:

- **Large, mature index:** Bing's index provides broad global coverage, strong long-tail results, and robust news coverage across regions and languages.
- **Structured JSON:** Returns clean results with title (`name`), canonical URL, snippet (`description`), source provider attribution, publication date (`datePublished`), and language hints.
- **News-specific endpoint:** `/v7.0/news/search` supports `freshness` (e.g. `Day`, `Week`, `Month`) and is well-suited to discovering recent coverage for watchlist queries.
- **First-party Azure ecosystem:** Available via Azure with predictable enterprise billing (Enterprise Agreement / PAYG), service-level agreements, and integration with Azure Key Vault and Azure monitoring.
- **Authentication:** Uses an `Ocp-Apim-Subscription-Key` header tied to an Azure Cognitive Services/Bing Search resource.

---

## Decision

### 1. Bing Search Connector (`bing-search` provider)

A new native ingestion connector is introduced with provider ID `bing-search`. It is designed to be functionally parallel to the `brave-search` connector (ADR-0065) to minimise implementation variance.

- **Mechanism (Dual Discovery & Validation):** Rather than polling a static RSS feed, the connector iterates through the tenant's **active** watchlists:
  1. **Discovery phase:** Executes a Bing Search API call per watchlist. For watchlists with `matchType = keyword`/`hashtag`/`account`, the connector formats the watchlist's `terms[]` into an OR-query (e.g. `"term1" OR "term2"`). For watchlists with `matchType = boolean_query` (ADR-0021), the connector passes the `boolean_query` string verbatim to Bing Search.
  2. **Validation filter:** Because search engines use broad matching, stemming, and proximity heuristics, each candidate snippet returned by Bing is evaluated in-process against the triggering watchlist's exact rules (`matchesAst()` or `matchesWatchlist()`) before insertion. Only candidate items strictly meeting the rule criteria are ingested, guaranteeing identical precision to passive feeds.
- **Preferred endpoint:** Default to `/v7.0/news/search` to prioritise recent news coverage aligned to watchlist topics. Fall back to `/v7.0/search` for watchlists where broader web results are more appropriate (configurable per connector run).
- **Freshness & pagination:** Use Bing's `freshness` parameter (`Day`, `Week`, `Month`) to constrain results to the ingestion lookback window. Paginate using `offset` and `count` (up to Bing's per-request limits).
- **Publication / Domain as Author (ADR-0004 Generalization):** Following the generalized organization-as-Author precedent (ADR-0024, ADR-0026, ADR-0050, ADR-0065), web and news search results lack individual user accounts. The source domain and publication name serve as the canonical Author:
  - `author.id = "bing-search:" + domain`
  - `author.username = domain` (e.g. `reuters.com`, `bbc.co.uk`)
  - `author.displayName = provider[0].name || domain`
  - `author.platform = 'bing-search'`
- **Mapping to canonical schema:** Map Bing results to `SocialPostSummary`:

| Bing Search field | `SocialPostSummary` field | Notes |
|---|---|---|
| `url` | `externalId` and `url` | Canonicalise the URL to improve deduplication effectiveness. |
| `name` | `title` | Bing uses `name` in web/news results; normalised to `title`. |
| `description` | `bodyMarkdown` | Primary body text for the ingested post snippet. |
| `datePublished` (news) / `dateLastCrawled` (web) | `publishedAt` | Prefer `datePublished` for news results. If unavailable, fall back to `dateLastCrawled` or `now()`. Parsed to `Date`. |
| `provider` / `domain` | Source metadata | `providerId = 'bing-search'`. Store source domain (e.g. `bbc.com`) in post metadata for display/filtering. |
| `language` / `detectedLanguage` (if present) | `enrichment.detectedLanguage` (initial) | Treated as a hint; the standard enrichment pass (ADR-0055) may override. |

- **Deduplication:** Uses URL-based deduplication via the existing `(tenant_id, providerId, externalId)` uniqueness constraint (ADR-0005). Canonicalised URLs prevent duplicate ingestion across polling cycles and overlapping watchlists.

### 2. Automatic watchlist linking on ingestion

Consistent with ADR-0063 and ADR-0065:

- **Explicit association:** For each post ingested as a result of a specific watchlist's query, create `(post_id, watchlist_id, tenant_id)` pairs.
- **Persistence:** Write to `post_watchlist_matches` (ADR-0063) using `insertPostWatchlistMatches()` with `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING`. This is best-effort and must not block ingestion.
- **Immediate availability:** Posts sourced via Bing become available in `GET /v1/posts?watchlistId=<id>` and can power the Watchlist Coverage widget without client-side approximation.

### 3. Post grounding and LLM enrichment integration

Bing-sourced posts flow through the existing enrichment pipeline unchanged:

- **Grounding pass:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) receives the post's title, URL, `bodyMarkdown` (Bing snippet), source domain, and the triggering watchlist context.
- **Enriched metadata:** Extract sentiment, key phrases, detected language (ADR-0055), and a grounding context/executive summary explaining relevance to the watchlist criteria. Persisted in `post_enrichments`.
- **UI parity:** Bing-sourced posts are indistinguishable from other providers and support all existing filters, analytics, and the AI Spike Storyteller (ADR-0062).

### 4. Credential, rate-limit, and cadence architecture

- **Credential storage (Tier-2, ADR-0028):** The Bing Search API subscription key (`Ocp-Apim-Subscription-Key`) is stored in `platform_credentials` (`owner_type: 'tenant'`), configured by `tenant_admin`. The Azure endpoint is stored in the connector configuration.
- **Direct billing (ADR-0027):** In accordance with ADR-0027, the tenant provisions their own Bing Search / Azure Cognitive Services resource; SocialEngage acts strictly as the technical connector.
- **Authentication:** All requests include the `Ocp-Apim-Subscription-Key` header.
- **Quota-safe polling cadence:** To avoid excessive API spend and respect Azure Cognitive Services rate limits, default active watchlist polling cadence is set to **1 to 4 hours** (configurable per tenant).
- **Pacing loop & jitter:** Sequential execution across watchlists within a tenant tick with polite delay intervals prevents burst 429 throttling.
- **Budget guardrails:** Emit API call counts, request volume, and error rates to the connector telemetry path (ADR-0009/ADR-0010/ADR-0070). If approaching quota, degrade gracefully and emit a warning.

---

## Consequences

### Positive

- **Enterprise-ready & predictable:** Azure billing, SLAs, and credential management are well-aligned with the platform's existing Azure footprint (used by `azureOpenAiConnector.ts`).
- **Large, stable index:** Bing provides strong global coverage and a dedicated news endpoint, reducing the risk of sparse results for many watchlist queries.
- **Drop-in replacement & coexistence:** The mapping and flow are identical to ADR-0065. Tenants can run `brave-search`, `bing-search`, or both without architectural conflicts.
- **Reuses existing infrastructure:** Leverages ingestion runner, ADR-0063 junction table, and enrichment pipeline with no parallel architecture required.
- **Good geographic & language coverage:** Bing News/Search supports a wide range of markets and languages, complementing ADR-0055's language enrichment.

### Negative

- **Cost model:** Bing Search API is billed per 1,000 transactions (web and news). At high polling frequency across many watchlists, cost can be material and must be actively managed.
- **Not index-independent relative to Big Tech:** Bing is a Microsoft index (unlike Brave or Mojeek). For tenants with strict independence requirements, `brave-search` (ADR-0065) remains the preferred option.
- **Snippet-only representation:** Like Brave, Bing returns snippets/descriptions rather than full article body. Deep analysis requiring full text requires a separate fetch step.
- **Azure resource prerequisite:** Requires an Azure Cognitive Services resource (Bing Search) to be provisioned and configured by the tenant administrator.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Brave Search API (ADR-0065)** | Accepted as the primary independent search provider. Bing is established as a parallel enterprise alternative. |
| **Kagi Search API** | High quality and index-independent, but paid-only with different pricing model and no large free tier. Less aligned to Azure-native operations. |
| **Tavily / Exa** | Better suited to grounding/enrichment than high-frequency polling to populate raw posts. More expensive per query for bulk discovery. |
| **SerpAPI (wrapper)** | Easier integration but introduces a third-party wrapper premium and indirect dependency. Not preferred for a first-party connector strategy. |
| **Mojeek API** | Strong independence but lacks a dedicated news endpoint and has smaller index coverage. |

---

## Resolved Questions

1. **Polling schedule frequency:** Default to 1 to 4 hours per tenant tier with tenant-level overrides.
2. **Parallel connector strategy:** Tenants may activate `brave-search`, `bing-search`, or both. URL-based canonical deduplication on `(tenant_id, provider_id, external_id)` prevents duplicate post storage while broadening candidate discovery.
3. **Billing and credential tier:** Tier-2 tenant credential ownership (`ownerType: 'tenant'`) per ADR-0028 and direct tenant billing per ADR-0027.

---

*Drafted 2026-08-19, revised 2026-08-20 to incorporate review recommendations (Author normalization, dual discovery + AST validation filter, quota pacing, and direct Azure billing). Left **Proposed** for Menno's review and final acceptance.*