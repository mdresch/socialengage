# ADR-0065: Active Watchlist Sourcing via Brave Search API — Polling Connector, Post Ingestion Grounding, and LLM Enrichment

**Status:** Accepted (2026-08-20)

**Accepted by Menno 2026-08-20.** Authorizes the `brave-search` connector for proactive watchlist topic discovery, post grounding, and AI enrichment, with the four review recommendations in effect: (1) Domain/Publication as Author mapping (ADR-0004 generalization), (2) Dual discovery query + in-process AST validation filter, (3) 1–4 hour quota-safe pacing loop to stay strictly within rate limits, and (4) Tier-2 tenant credential ownership per ADR-0028 and direct billing per ADR-0027.

**Source:** Follow-up to ADR-0063 (Post-watchlist match persistence and server-side filters) and ADR-0062 (Analytics Dashboard Overview enhancements). Menno's request (2026-08-19): *"could you please review the decline of the Topics Filter and align the Topics to the Watchlist already available in the systems? ... [and write an ADR] for the Brave Search API to search on topics/watchlist items and return results as posts to the social listening. Future review the enhancements to the grounding of posts and enhancing enrich posts with search results."*

## Context

### The evolution of watchlists in the platform

- **ADR-0006 / Story 3.3 / ADR-0021:** Established watchlists as passive matching filters evaluated in-process against incoming posts (`runIngestionAttempt()`). Watchlists were purely reactive criteria applied to pre-existing feeds (`gnews`, `newswire`, `tenant-owned-feed`).
- **ADR-0063:** Established persistence for watchlist matches via the `post_watchlist_matches` junction table and introduced server-side filtering (`GET /v1/posts?watchlistId=<id>`).
- **The gap:** The platform has historically depended on upstream providers pushing or polling generic news sources. As a result, the system cannot actively discover new conversational threads or web content specifically targeted at a user's defined watchlists unless those topics appear randomly in the standard connector feeds.

### The capabilities of the Brave Search API

The Brave Search API provides an independent, first-party web and news index accessible via structured JSON REST endpoints (`/res/v1/web/search`, `/res/v1/news/search`, and the LLM Context endpoint). It returns clean page metadata (title, URL, description/snippet, publication date, source domain) and supports freshness parameters (e.g. `freshness=pw`, `pm`, `pd`) without requiring site scraping.

By integrating the Brave Search API as an active connector, the platform can transform passive watchlists into active queries: programmatically discovering relevant content, ingesting those results as standard social posts, grounding them, and running the existing AI enrichment pipeline.

---

## Decision

### 1. Brave Search Connector (`brave-search` provider)

A new native ingestion connector is introduced with provider ID `brave-search`.

- **Mechanism (Dual Discovery & Validation):** Rather than polling a static RSS feed, the connector iterates through the tenant's **active** watchlists:
  1. **Discovery phase:** Executes a Brave Search API call per watchlist. For watchlists with `matchType = keyword`/`hashtag`/`account`, the connector formats the watchlist's `terms[]` into a search query. For watchlists with `matchType = boolean_query` (ADR-0021), the connector passes the `boolean_query` string (as supported by Brave's search syntax).
  2. **Validation filter:** Because search engines use broad matching and stemming, each candidate snippet returned by Brave is evaluated in-process against the triggering watchlist's exact rules (`matchesAst()` or `matchesWatchlist()`) before insertion. Only candidate items strictly meeting the rule criteria are ingested, guaranteeing identical precision to passive feeds.
- **Preferred endpoint:** The connector uses `/res/v1/news/search` when the watchlist is intended to surface recent news coverage; otherwise it falls back to `/res/v1/web/search`. The choice is configurable per connector run configuration (default: `news`).
- **Freshness & pagination:** The connector uses Brave's `freshness` parameter to respect the ingestion lookback window (aligned with ADR-0018's retention/ingestion cadence) and paginates through results using `offset`/`count` to avoid over-fetching in a single call.
- **Publication / Domain as Author (ADR-0004 Generalization):** Following the generalized organization-as-Author precedent (ADR-0024, ADR-0026, ADR-0050), web search results lack individual journalist profiles. The source domain and publication name serve as the canonical Author:
  - `author.id = "brave-search:" + domain`
  - `author.username = domain` (e.g. `bbc.com`, `techcrunch.com`)
  - `author.displayName = sourceName || domain`
  - `author.platform = 'brave-search'`
- **Mapping to canonical schema:** Each Brave Search result is mapped to `SocialPostSummary` as follows:

| Brave Search field | `SocialPostSummary` field | Notes |
|---|---|---|
| `url` | `externalId` (primary) and `url` | `externalId` is normalised to the canonical URL (after following redirects where available) to maximise deduplication effectiveness. |
| `title` | `title` | Trimmed to a sensible length. |
| `description` / `snippet` | `bodyMarkdown` | Brave returns a concise snippet. This becomes the primary body text for the ingested post. |
| `age` / `published` / `page_age` | `publishedAt` | Parsed into `Date`. If no publication date is returned, the connector sets `publishedAt = now()` at ingestion time. |
| `source` / `domain` | `providerId` context + `source` metadata | `providerId = 'brave-search'`. The source domain (e.g. `bbc.co.uk`) is stored in the post's source metadata for display and filtering. |
| `language` (if present) | `enrichment.detectedLanguage` (initial) | If Brave returns a language hint, it is used as an initial value but the standard enrichment pass may override it (ADR-0055). |

- **Deduplication:** The connector uses the standard URL-based deduplication path (ADR-0005). The `externalId` is set to the canonicalised result URL. `INSERT` into `social_posts` respects the existing unique key on `(tenant_id, providerId, externalId)` so articles discovered across multiple polling cycles or overlapping watchlist queries are not ingested twice.

### 2. Automatic watchlist linking on ingestion

Because each Brave Search query is generated from a specific watchlist:

- **Explicit association:** For every post successfully ingested as a result of a particular watchlist's query execution, the ingestion path creates `(post_id, watchlist_id, tenant_id)` pairs for that watchlist.
- **Persistence:** These pairs are written to `post_watchlist_matches` (ADR-0063) via `insertPostWatchlistMatches()` using `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING`. This is best-effort and **must not** block ingestion (consistent with ADR-0063 Decision §2).
- **Server-side availability:** As a direct consequence, Brave-sourced posts immediately appear in `GET /v1/posts?watchlistId=<id>` responses and can power the Watchlist Coverage widget (ADR-0062/0063) without any client-side approximation.

### 3. Post grounding and LLM enrichment integration

Brave-sourced posts are treated as first-class posts and flow through the existing enrichment pipeline with an explicit grounding pass.

- **Grounding pass:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) receives the post's `bodyMarkdown` (Brave snippet), title, URL, source domain, and the triggering `watchlistId`/watchlist query context. This allows the LLM to explain the relevance to the specific watchlist criteria.
- **Enriched metadata:** The enrichment pass extracts and stores:
  - **Sentiment** (`enrichment.sentiment`) — positive/neutral/negative with score
  - **Key phrases** (`enrichment.keyPhrases`) — array of relevant phrases
  - **Detected language** (`enrichment.detectedLanguage`) — ISO 639-1 (ADR-0055). If Brave provided a language hint, it is treated as an initial suggestion only.
  - **Grounding context / executive summary** — stored as part of the enrichment payload (e.g. `enrichment.groundingContext` or `enrichment.summary`) explaining why the article matches the watchlist criteria. This is persisted in the `post_enrichments` store table.
- **UI parity:** Once enriched, Brave-sourced posts are indistinguishable from posts from native feeds. They support sentiment filters, language filters, the AI Spike Storyteller (ADR-0062 Decision §6), and all existing analytics aggregations.

### 4. Credential, rate-limit, and cadence architecture

- **Credential storage (Tier-2, ADR-0028):** The Brave Search API key (`X-Subscription-Token`) is a tenant-owned credential stored in `platform_credentials` (`owner_type: 'tenant'`), configured by `tenant_admin`.
- **Direct billing (ADR-0027):** In accordance with ADR-0027, the tenant contracts directly with Brave for their API subscription token; SocialEngage acts strictly as the technical connector.
- **Authentication:** All Brave API calls include the `X-Subscription-Token` header.
- **Quota-safe polling cadence:** To avoid rapid exhaustion of Brave Search rate limits (e.g. 2,000 req/mo on free tier, 1 req/sec limit), the default active watchlist polling cadence is set to **1 to 4 hours** (configurable per tenant) rather than 15 minutes.
- **Pacing loop & jitter:** Within a scheduler tick, queries across multiple active watchlists are executed sequentially with a **1.2-second pacing delay** between requests, guaranteeing adherence to Brave's 1 req/sec ceiling and preventing HTTP 429 rate-limit errors.
- **Budget guardrails:** The connector records API call counts and quota usage in connector telemetry (ADR-0009/ADR-0010/ADR-0070). If a tenant approaches their quota limit, the connector logs a warning and gracefully defers further queries until the next period.

---

## Consequences

**Positive**

- **Active discovery:** Watchlists become active web-scouring agents. The platform proactively finds relevant content rather than waiting for it to appear in generic feeds.
- **Closes the Overview Tab loop:** The Watchlist Coverage widget and `selectedTopic` filters (ADR-0062/ADR-0063) now receive targeted, real data generated directly from active watchlist queries.
- **Reuses existing infrastructure:** Leverages the ingestion runner framework, ADR-0063 junction table, and Azure OpenAI enrichment connector with minimal new surface area. Brave-sourced posts flow through the same stores, APIs, and UI paths.
- **Deterministic mapping:** Using Brave's structured JSON avoids the brittleness of scraping and produces consistent, deduplicable results via URL-based deduplication.
- **Privacy & compliance alignment:** The connector only ingests publicly accessible web/news URLs and their snippets; no author IPs or private audience data are collected (consistent with the analysis in ADR-0064).

**Negative**

- **API cost & quota management:** Brave Search API is metered. Polling many active watchlists at high frequency can incur meaningful cost. Requires careful tenant-tier configuration and observability.
- **Snippet-only representation:** Brave returns structured snippets/descriptions rather than full raw HTML. Very long-form articles are represented by their summary excerpt. Deep analysis that requires full article body is limited without an additional fetch step (Open Question 2).
- **Query fidelity:** For complex boolean watchlists, Brave's interpretation of boolean syntax may differ slightly from the in-process `matchesAst()` evaluator (ADR-0021). The discovery query (Brave) and the matching semantics (ingestion-time evaluator) serve different purposes (find vs. validate), but this difference is worth monitoring.
- **New connector operational surface:** Introduces a new provider (`brave-search`) with its own polling scheduler, quota tracking, and failure modes. Must be integrated into existing connector health dashboards.

---

## Alternatives Considered

| Alternative | Disposition |
|---|---|
| **Rely solely on `gnews` for topic discovery** | Rejected. `gnews` has a pre-packaged news index and cannot execute bespoke boolean queries or deep web searches tailored to arbitrary custom watchlists. |
| **Client-side web scraping of search result pages** | Rejected. Scraping is brittle, difficult to maintain across sites, and risks violating terms of service. The official Brave Search API provides a stable, structured JSON contract. |
| **Use Google Programmable Search / Bing Search API instead** | Considered. Brave was selected for its clean JSON response, news-specific endpoint, and alignment with the project's preference for independent index access. Other providers remain viable alternatives but are not adopted in this ADR. |
| **Fetch full article text on ingestion** | Deferred. Fetching and parsing full HTML for every result adds latency, cost (bandwidth), and parsing complexity (paywalls, boilerplate removal). Snippet-based ingestion is sufficient for v1; full-text extraction can be evaluated in v2 (Open Question 2). |

---

## Open Questions

1. **Polling schedule frequency:** How often should active watchlists trigger Brave Search queries (e.g. every 30 minutes, hourly, every 6 hours, daily)? This should be determined by tenant subscription tier, watchlist criticality, and API budget. The connector must support per-tier defaults with tenant-level overrides.
2. **Full-text scraping extension:** Should posts discovered via Brave Search trigger an optional background fetch of the target URL to extract full body text when the snippet is too brief? Potential approaches: selective fetch (only for results where `description` length is below a threshold), use a read-later extraction service, or defer entirely to v2. Requires evaluation of cost, reliability, and terms of service.
3. **Query transformation strategy:** For `boolean_query` watchlists, should the connector pass the raw boolean string to Brave verbatim, or simplify it to keyword terms to improve recall? The optimal strategy may vary by watchlist complexity and should be validated with real tenant queries.
4. **Result deduplication window:** Should deduplication consider results seen in the last N polling cycles (e.g. 7–30 days) or rely solely on the existing `(tenant_id, providerId, externalId)` uniqueness? The current approach (relying on the existing unique constraint) is sufficient for v1, but cross-cycle dedup across very old results may need tuning.
5. **Backpressure & watchlist prioritisation:** When API quota is constrained, which watchlists should be polled first (e.g. most recently created, most frequently used in dashboards, or explicitly marked as high-priority)? Left to implementation-time judgment with a sensible default (prioritise active watchlists with recent dashboard usage).

*Drafted 2026-08-19, updated and accepted 2026-08-20 with review recommendations in effect. This ADR builds directly on ADR-0063's junction table and server-side filtering, and enables the Watchlist Coverage widget and `selectedTopic` filter to receive real, actively-sourced data. It reuses the existing ingestion framework, enrichment pipeline (ADR-0038), and credential architecture (ADR-0028) while introducing a new active connector (`brave-search`).*