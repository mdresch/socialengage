# ADR-0066: Active Watchlist Sourcing via Bing Search API (Azure) — Polling Connector, Post Ingestion Grounding, and LLM Enrichment

**Status:** Proposed (2026-08-19)

**Source:** Follow-up to ADR-0065 (Brave Search API), ADR-0063 (Post-watchlist match persistence and server-side filters), and ADR-0062 (Analytics Dashboard Overview enhancements). This ADR evaluates Bing Search API (via Azure AI Services) as a first-party alternative for actively sourcing watchlist-relevant content.

## Context

### The need for active watchlist sourcing

As established in ADR-0065, watchlists have evolved from passive matching filters (ADR-0006/ADR-0021) to benefit from active discovery. While the platform has existing reactive feeds (`gnews`, `newswire`, `tenant-owned-feed`), they do not proactively discover content that matches bespoke watchlist queries.

ADR-0065 selected Brave Search API as the initial implementation path. The comparative analysis identified **Bing Web Search and Bing News Search (Azure AI Services)** as the most credible drop-in alternative, offering a large, stable index and a first-party, enterprise-ready API.

### Capabilities of Bing Search API (Azure)

Bing Search API v7 is available via Azure AI Services and provides structured JSON search results via REST endpoints:

- **`/v7.0/search`** – Web search across the Bing index
- **`/v7.0/news/search`** – Dedicated news search with recency and category filters
- **`/v7.0/news/trendingtopics`** – (optional) Trending topics, not required for watchlist sourcing

Key characteristics relevant to this use case:

- **Large, mature index:** Bing's index provides broad global coverage, strong long-tail results, and robust news coverage across regions.
- **Structured JSON:** Returns clean results with title, URL, snippet, source domain, publication date, and language hints.
- **News-specific endpoint:** `/v7.0/news/search` supports `freshness` (e.g. `Day`, `Week`, `Month`) and is well-suited to discovering recent coverage for watchlist queries.
- **First-party (Microsoft):** Available via Azure with predictable enterprise billing, service-level agreements, and integration with Azure Key Vault and Azure monitoring.
- **Authentication:** Uses an `Ocp-Apim-Subscription-Key` header tied to an Azure Cognitive Services/Bing Search resource.

---

## Decision

### 1. Bing Search Connector (`bing-search` provider)

A new native ingestion connector is introduced with provider ID `bing-search`. It is designed to be functionally parallel to the `brave-search` connector (ADR-0065) to minimise implementation variance.

- **Query generation:** Iterate through the tenant's active watchlists. For `keyword`/`hashtag`/`account` watchlists, construct a search query from `terms[]`. For `boolean_query` watchlists (ADR-0021), pass the `boolean_query` string verbatim to Bing Search.
- **Preferred endpoint:** Default to `/v7.0/news/search` to prioritise recent news coverage aligned to watchlist topics. Fall back to `/v7.0/search` for watchlists where broader web results are more appropriate (configurable per connector run).
- **Freshness & pagination:** Use Bing's `freshness` parameter (`Day`, `Week`, `Month`) to constrain results to the ingestion lookback window. Paginate using `offset` and `count` (up to Bing's per-request limits).
- **Mapping to canonical schema:** Map Bing results to `SocialPostSummary`:

| Bing Search field | `SocialPostSummary` field | Notes |
|---|---|---|
| `url` | `externalId` and `url` | Canonicalise the URL to improve deduplication effectiveness. |
| `name` / `title` | `title` | Bing uses `name` in web results and `name`/title in news; normalised to `title`. |
| `snippet` / `description` | `bodyMarkdown` | Becomes the primary body text for the ingested post. |
| `datePublished` (news) / `dateLastCrawled` (web) | `publishedAt` | Prefer `datePublished` for news results. If unavailable, fall back to `dateLastCrawled` or `now()`. Parsed to `Date`. |
| `provider` / `domain` | Source metadata | `providerId = 'bing-search'`. Store source domain (e.g. `bbc.com`) in post metadata for display/filtering. |
| `language` / `detectedLanguage` (if present) | `enrichment.detectedLanguage` (initial) | Treated as a hint; the standard enrichment pass (ADR-0055) may override. |

- **Deduplication:** Uses URL-based deduplication via the existing `(tenant_id, providerId, externalId)` uniqueness constraint (ADR-0005). Canonicalised URLs prevent duplicate ingestion across polling cycles and overlapping watchlists.

### 2. Automatic watchlist linking on ingestion

Consistent with ADR-0065:

- **Explicit association:** For each post ingested as a result of a specific watchlist's query, create `(post_id, watchlist_id, tenant_id)` pairs.
- **Persistence:** Write to `post_watchlist_matches` (ADR-0063) using `insertPostWatchlistMatches()` with `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING`. This is best-effort and must not block ingestion.
- **Immediate availability:** Posts sourced via Bing become available in `GET /v1/posts?watchlistId=<id>` and can power the Watchlist Coverage widget without client-side approximation.

### 3. Post grounding and LLM enrichment integration

Bing-sourced posts flow through the existing enrichment pipeline unchanged:

- **Grounding pass:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) receives the post's title, URL, `bodyMarkdown` (Bing snippet), source domain, and the triggering watchlist context.
- **Enriched metadata:** Extract sentiment, key phrases, detected language (ADR-0055), and a grounding context/executive summary explaining relevance to the watchlist criteria. Persisted in `post_enrichments`.
- **UI parity:** Bing-sourced posts are indistinguishable from other providers and support all existing filters, analytics, and the AI Spike Storyteller (ADR-0062).

### 4. Credential and rate-limit architecture

- **Credential storage:** The Bing Search API subscription key (`Ocp-Apim-Subscription-Key`) is stored in the platform credential vault (Tier-2 platform credentials, ADR-0028). The Azure endpoint (e.g. `https://api.bing.microsoft.com/v7.0/...`) is stored as part of the connector configuration.
- **Authentication:** All requests include the `Ocp-Apim-Subscription-Key` header.
- **Throttling & backoff:** Implement exponential backoff with jitter on `429` (rate limit) and `5xx` responses. Respect Azure's per-subscription rate limits and quota.
- **Per-watchlist cadence:** Configurable polling intervals per watchlist (Open Question 1), staggered execution to avoid burst traffic.
- **Budget guardrails:** Emit API call counts, request volume, and error rates to the connector telemetry path (ADR-0009/ADR-0010). If approaching quota, degrade gracefully (defer lower-priority watchlists) and emit a warning.

---

## Consequences

**Positive**

- **Enterprise-ready & predictable:** Azure billing, SLAs, and credential management are well-aligned with the platform's existing Azure footprint (used by `azureOpenAiConnector.ts`).
- **Large, stable index:** Bing provides strong global coverage and a dedicated news endpoint, reducing the risk of sparse results for many watchlist queries.
- **Drop-in replacement potential:** The mapping and flow are nearly identical to ADR-0065, minimising implementation and testing effort.
- **Reuses existing infrastructure:** Leverages ingestion runner, ADR-0063 junction table, and enrichment pipeline with no parallel architecture required.
- **Good geographic & language coverage:** Bing News/Search supports a wide range of markets and languages, complementing ADR-0055's language enrichment.

**Negative**

- **Cost model:** Bing Search API is billed per 1,000 transactions (web and news). At high polling frequency across many watchlists, cost can be material and must be actively managed.
- **Not index-independent relative to Big Tech:** Bing is a Microsoft index (unlike Brave or Mojeek). For tenants with strict independence requirements, this may be a consideration.
- **Snippet-only representation:** Like Brave, Bing returns snippets/descriptions rather than full article body. Deep analysis requiring full text requires a separate fetch step (Open Question 2).
- **Query semantics differences:** Bing's query interpretation may differ from Brave and from the in-process `matchesAst()` evaluator. The discovery query and validation semantics remain distinct but require monitoring.
- **Azure-specific configuration:** Requires an Azure Cognitive Services resource (Bing Search) to be provisioned and linked to the tenant/platform configuration.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Brave Search API (ADR-0065)** | Retained as the primary option. Bing is proposed as a parallel implementation or fallback with comparable capabilities. |
| **Kagi Search API** | High quality and index-independent, but paid-only with different pricing model and no large free tier. Less aligned to Azure-native operations. |
| **Tavily / Exa** | Better suited to grounding/enrichment than high-frequency polling to populate raw posts. More expensive per query for bulk discovery. |
| **SerpAPI (wrapper)** | Easier integration but introduces a third-party wrapper premium and indirect dependency. Not preferred for a first-party connector strategy. |
| **Mojeek API** | Strong independence but lacks a dedicated news endpoint and has smaller index coverage. |

---

## Open Questions

1. **Polling schedule frequency:** Same as ADR-0065. Determine per-tenant-tier defaults (e.g. 30 min / hourly / 6h / daily) based on API budget and watchlist criticality.
2. **Full-text scraping extension:** Should Bing-sourced posts optionally fetch the target URL to extract full body text when the snippet is too brief? Deferred to v2. Requires evaluation of cost, parsing complexity, and reliability.
3. **News vs. web endpoint selection:** Should the connector prefer `news/search` for all watchlists, or use heuristics (e.g. watchlist contains breaking/news-oriented terms) to choose endpoint? Default to news with web fallback, but heuristic tuning may improve recall.
4. **Market & location parameters:** Bing Search supports `mkt` (market) and `setLang`. Should these be derived from tenant locale or watchlist context? For v1, default to a neutral market; revisit if regional precision is required.
5. **Parallel connector strategy:** Should both `brave-search` and `bing-search` run in parallel for the same watchlist, or should they be selectable per tenant/watchlist? Running in parallel increases coverage but also increases cost and duplicate risk (mitigated by URL deduplication).
6. **Azure resource provisioning model:** Should Bing Search be provisioned per tenant (isolated key/quota) or as a shared platform resource? Impacts credential scope and billing attribution.

---

*Drafted 2026-08-19. This ADR provides an Azure-aligned alternative to ADR-0065 while preserving the same ingestion, watchlist-linking, and enrichment architecture. It reuses ADR-0063's junction table, ADR-0038's enrichment pipeline, and ADR-0028's credential vault. Left **Proposed** per the project's ADR-acceptance authority convention.*