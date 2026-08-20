# ADR-0066: Active Watchlist Sourcing via Bing Search API (Azure) — Polling Connector, Post Ingestion Grounding, and LLM Enrichment

**Status:** Accepted (2026-08-20)

**Accepted by Menno 2026-08-20.** Authorizes the `bing-search` connector as an enterprise-aligned companion to `brave-search` for active watchlist discovery, post grounding, and AI enrichment, incorporating all five review recommendations: (1) candidate evaluation cap (top 25–50 per watchlist tick), (2) deterministic auto endpoint selection (`news` with `< 5` count fallback to `web`), (3) multi-step URL canonicalisation, (4) tenant-scoped cost telemetry, and (5) deterministic lookback-to-freshness mapping.

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
- **Structured JSON:** Returns clean results with title (`name`), canonical URL, snippet (`description`), source provider attribution (`provider[].name`), publication date (`datePublished`), and language hints.
- **News-specific endpoint:** `/v7.0/news/search` supports `freshness` (e.g. `Day`, `Week`, `Month`) and is well-suited to discovering recent coverage for watchlist queries.
- **First-party Azure ecosystem:** Available via Azure with predictable enterprise billing (Enterprise Agreement / PAYG), service-level agreements, and integration with Azure Key Vault and Azure monitoring.
- **Authentication:** Uses an `Ocp-Apim-Subscription-Key` header tied to an Azure Cognitive Services/Bing Search resource.

---

## Decision

### 1. Bing Search Connector (`bing-search` provider)

A new native ingestion connector is introduced with provider ID `bing-search`. It is designed to be functionally parallel to the `brave-search` connector (ADR-0065) to minimise implementation variance.

- **Mechanism (Dual Discovery & Validation):** Rather than polling a static RSS feed, the connector iterates through the tenant's **active** watchlists:
  1. **Discovery phase:** Executes a Bing Search API call per watchlist.
     - For `keyword`/`hashtag`/`account` watchlists: formats `terms[]` into an OR-query (e.g. `"term1" OR "term2"`).
     - For `boolean_query` watchlists (ADR-0021): passes the `boolean_query` string verbatim to Bing Search.
     - **Market & Language Localization:** Sets `mkt` and `setLang` based on tenant locale settings (e.g. `nl-NL`, `en-US`), defaulting to `en-US`.
     - **Candidate Batch Cap:** Requests `count = 25` (up to max 50) candidates per query to bound compute and network overhead.
  2. **Validation filter & Candidate Cap:**
     - Evaluates the top **25–50** candidate snippets/titles returned by Bing in-process against the triggering watchlist's exact rules (`matchesAst()` or `matchesWatchlist()`) before insertion.
     - Only candidate items strictly meeting the rule criteria are ingested, guaranteeing 100% precision consistency with passive feeds.
- **Deterministic Endpoint Selection (`auto` default):**
  - **Default (`endpoint: 'auto'`):** Calls `/v7.0/news/search` first to prioritize fresh journalistic news coverage. If the news endpoint returns **fewer than 5 validated results**, the connector falls back to `/v7.0/search` (Web) in the same tick to scour broader web content.
  - **Explicit Overrides:** Supports per-watchlist or connector configuration overrides (`'news'` only or `'web'` only).
- **Deterministic Lookback-to-Freshness Mapping:**
  - Ingestion lookback window is deterministically mapped to Bing's `freshness` parameter:
    - Lookback $\le$ 48 hours $\rightarrow$ `freshness = 'Day'`
    - Lookback 3 to 7 days $\rightarrow$ `freshness = 'Week'`
    - Lookback $>$ 7 days $\rightarrow$ `freshness = 'Month'`
- **Multi-Step URL Canonicalisation:**
  - To maximize deduplication hit rate across polling cycles and cross-connector discovery:
    1. Resolves and unwraps redirects where safe/available to obtain the destination URL.
    2. Strips known marketing/tracking query parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`, `ref`, `source`).
    3. Normalizes scheme to lowercase (`https://`), lowercases hostnames, and strips standard `www.` prefixes.
    4. Strips trailing URL fragments (`#...`) unless semantically meaningful.
- **Publication / Base Domain as Author (ADR-0004 Generalization):**
  - Following the generalized organization-as-Author precedent (ADR-0024, ADR-0026, ADR-0050, ADR-0065):
    - `author.id = "bing-search:" + baseDomain`
    - `author.username = baseDomain` (e.g. `bbc.co.uk`, `reuters.com`)
    - `author.displayName = provider[0].name || baseDomain`
    - `author.platform = 'bing-search'`
- **Mapping to canonical schema:** Map Bing results to `SocialPostSummary`:

| Bing Search field | `SocialPostSummary` field | Notes |
|---|---|---|
| `url` | `externalId` and `url` | Canonicalised URL (tracking stripped, redirects resolved). |
| `name` | `title` | Normalized title string. |
| `description` | `bodyMarkdown` | Primary body text for the ingested post snippet. |
| `datePublished` (news) / `dateLastCrawled` (web) | `publishedAt` | Prefer `datePublished` for news results; fallback to `dateLastCrawled` or `now()`. Parsed to `Date`. |
| `provider` / `domain` | Source metadata | `providerId = 'bing-search'`. Store source domain (e.g. `bbc.com`) in post metadata for display/filtering. |
| `language` (if present) | `enrichment.detectedLanguage` (initial) | Treated as an initial hint; standard enrichment pass (ADR-0055) validates. |

- **Deduplication:** Uses URL-based deduplication via the existing `(tenant_id, providerId, externalId)` uniqueness constraint (ADR-0005).

### 2. Automatic watchlist linking on ingestion

Consistent with ADR-0063 and ADR-0065:

- **Explicit association:** For each post ingested as a result of a specific watchlist's query, create `(post_id, watchlist_id, tenant_id)` pairs.
- **Persistence:** Write to `post_watchlist_matches` (ADR-0063) using `insertPostWatchlistMatches()` with `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING`. This is best-effort and must not block ingestion.
- **Immediate availability:** Posts sourced via Bing become available in `GET /v1/posts?watchlistId=<id>` and can power the Watchlist Coverage widget without client-side approximation.

### 3. Post grounding and LLM enrichment integration

Bing-sourced posts flow through the existing enrichment pipeline unchanged:

- **Grounding pass:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) receives the post's title, URL, `bodyMarkdown` (Bing snippet), source domain, and the triggering watchlist context.
- **Enriched metadata:** Extract sentiment, key phrases, detected language (ADR-0055), and a grounding context/executive summary explaining relevance to the watchlist criteria. Persisted in `post_enrichments`.
- **UI parity:** Bing-sourced posts are indistinguishable from other providers and support all existing filters, analytics, human overrides (ADR-0071), and the AI Spike Storyteller (ADR-0062).

### 4. Credential, rate-limit, and tenant-scoped telemetry architecture

- **Credential storage (Tier-2, ADR-0028):** The Bing Search API subscription key (`Ocp-Apim-Subscription-Key`) is stored in `platform_credentials` (`owner_type: 'tenant'`), configured by `tenant_admin`. The Azure endpoint is stored in connector configuration.
- **Direct billing (ADR-0027):** In accordance with ADR-0027, the tenant provisions their own Bing Search / Azure Cognitive Services resource; SocialEngage acts strictly as the technical connector.
- **Authentication:** All requests include the `Ocp-Apim-Subscription-Key` header.
- **Quota-safe polling cadence:** Default active watchlist polling cadence is set to **1 to 4 hours** (configurable per tenant).
- **Per-Tenant Staggering & Pacing Loop:** Polling is staggered per-tenant with a sequential pacing delay between watchlists to avoid burst 429 throttling and cross-tenant thundering herds.
- **Tenant-Scoped Cost & Quota Telemetry:**
  - Emits API call counts, query volume, endpoint used (`news` vs `web`), candidate yield, and **estimated cost** (calculated from Azure Cognitive Services pricing per 1,000 transactions) into connector telemetry (ADR-0009/ADR-0010/ADR-0070).
  - All telemetry is strictly **scoped by `tenantId`** (and `platformId='bing-search'`, `watchlistId`) to enable tenant-level quota monitoring, alerts, and billing reconciliation.

---

## Consequences

### Positive

- **Enterprise-ready & predictable:** Azure billing, SLAs, and credential management are well-aligned with the platform's existing Azure footprint (used by `azureOpenAiConnector.ts`).
- **Large, stable index:** Bing provides strong global coverage and a dedicated news endpoint, reducing the risk of sparse results for many watchlist queries.
- **Drop-in replacement & coexistence:** The mapping and flow are identical to ADR-0065. Tenants can run `brave-search`, `bing-search`, or both without architectural conflicts.
- **Reuses existing infrastructure:** Leverages ingestion runner, ADR-0063 junction table, and enrichment pipeline with no parallel architecture required.
- **High deduplication accuracy:** Multi-step URL canonicalisation prevents duplicate ingestion across cycles and providers.
- **Cost observability:** Explicit tenant-scoped cost telemetry supports budgeting and quota monitoring.

### Negative

- **Cost model:** Bing Search API is billed per 1,000 transactions (web and news). At high polling frequency across many watchlists, cost can be material and must be actively managed via the 1–4h cadence.
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
4. **Deterministic endpoint fallback:** `auto` default calls news first; falls back to web if valid results are $< 5$.

---

*Drafted 2026-08-19, revised and Accepted 2026-08-20 with full Menno review recommendations incorporated (candidate evaluation cap, auto endpoint fallback, URL canonicalisation, tenant-scoped cost telemetry, and lookback freshness mapping).*