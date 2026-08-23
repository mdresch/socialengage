# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0066 Active Watchlist Sourcing via Bing Search API (Azure) — Polling Connector, Post Ingestion Grounding, and LLM Enrichment — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Architecture Documentation, translated from ADR-0066 / BRD-0066 |
| Reviewer(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0066; BRD-0066; ADR-0065 (Brave Search precedent); ADR-0063 (post-watchlist match persistence); ADR-0062 (Overview tab); ADR-0028 (credential ownership tiers); ADR-0027 (direct billing); ADR-0038 (Azure OpenAI enrichment); ADR-0055 (language enrichment); ADR-0004 (organization-as-Author precedent); Story 2.22; Story 6.32 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0066 and BRD-0066 into a functional design for a new active connector, `bing-search`, that provides an enterprise-aligned, Azure-native companion to the `brave-search` connector (ADR-0065) for turning tenant watchlists into active discovery queries — using Bing Web Search and Bing News Search (v7, Azure AI Services).

ADR-0066's Status is **Accepted** (2026-08-20), and BRD-0066 is **Approved**. Story 2.22 (backend) is Implemented; Story 6.32 (admin UI) is **Ready but not yet Built** as of this writing — this FDD documents the approved design for both, not a draft for review.

### 2.2 Scope

- **In scope:**
  - The `bing-search` connector: registration, active-watchlist-driven query generation, deterministic `auto` news→web endpoint fallback, deterministic lookback-to-freshness mapping, market/language localization, candidate evaluation cap (25–50), dual discovery/validation.
  - Multi-step URL canonicalization for high-accuracy deduplication.
  - Mapping of Bing results to the canonical `SocialPost`/`SocialPostSummary` schema, including base-domain-as-Author.
  - Automatic, best-effort linkage of ingested posts to their triggering watchlist in `post_watchlist_matches` (ADR-0063).
  - Grounding and AI enrichment integration for Bing-sourced posts.
  - Tier-2 tenant-owned credential storage, direct billing, per-tenant staggered pacing, and tenant-scoped cost/quota telemetry.
  - The tenant admin UI connector setup/activation/status screen (Story 6.32).
- **Out of scope:**
  - Full-text scraping of external web pages beyond the Bing-returned snippet.
  - Billing or reselling of Azure Search transactions (tenants provision their own Azure resource, ADR-0027).
  - Client-side search query execution.
  - Bing Trending Topics (`/v7.0/news/trendingtopics`) or other non-search Bing endpoints.
  - Tier-1 (user-level) credentials — `bing-search` is tenant-scoped only.

### 2.3 Target Audience

Backend engineers (`social-listening-core` connector framework), frontend engineers (`social-listening-admin` connector UI), QA, and the product owner reviewing traceability from BRD-0066 through implementation.

---

## 3. Context and Background

- **Problem:** As established in ADR-0065, watchlists benefit from active discovery rather than waiting passively for content to cross generic feeds. Many watchlist queries are highly specific or long-tail and rarely surface in general RSS/news feeds. The platform's only active search option prior to this ADR (Brave Search, ADR-0065) may not satisfy tenants with strict Azure-centric procurement, billing, or SLA requirements.
- **Business/user value:** A second, enterprise-grade active search provider gives tenants a choice of index and cost model, broadens discovery via Bing's large and mature index (including a dedicated news endpoint), and aligns naturally with the platform's existing Azure footprint (already used by `azureOpenAiConnector.ts`, ADR-0038).
- **Source requirements:** ADR-0066 (Accepted 2026-08-20); BRD-0066 (Approved 2026-08-20); follow-up to ADR-0065, ADR-0063, and ADR-0062.
- **Constraints:**
  - Bing Search API is billed per 1,000 transactions (web and news); cost must be actively managed via cadence, candidate caps, and tenant-level controls.
  - Requires an Azure Cognitive Services (Bing Search) resource provisioned by the tenant.
  - `Ocp-Apim-Subscription-Key` header authentication.
  - Default 1–4 hour polling cadence with per-tenant staggering to avoid cross-tenant thundering-herd throttling.
  - Snippet-only representation, like Brave — no full article body.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Expand active watchlist sourcing to a first-party Azure search provider | `bing-search` connector is available alongside `brave-search` and ingests validated posts for active watchlists |
| G2 | Maintain 100% watchlist-rule precision for actively sourced content | All ingested Bing-sourced candidates pass `matchesWatchlist()` or `matchesAst()` validation before persistence |
| G3 | Provide enterprise-aligned cost and quota visibility | Tenant-scoped telemetry reports API call counts, endpoint usage, candidate yield, and estimated Azure cost per watchlist |
| G4 | Preserve architectural and UI parity across search providers | Tenant admins connect, activate, and monitor `bing-search` using the same credential and status patterns as other connectors |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `bing-search` Connector Registration

- **Description:** Registers a new native ingestion connector functionally parallel to `brave-search` (ADR-0065), minimizing implementation variance.
- **Triggers:** Connector framework startup / registry load.
- **Inputs:** N/A (static registration).
- **Processing:** Registers `providerId: 'bing-search'`, `authMode: 'api_key'`, `deliveryMode: 'poll'`, exposing `poll(tenantId: string)` in `connectorRegistry.ts`.
- **Outputs:** A selectable connector in the admin UI's platform list and a poll target in the live scheduler.
- **Error handling:** N/A at registration.
- **Edge cases:** N/A.

### 5.2 Feature / Capability: Active-Watchlist Query Generation with Localization

- **Description:** For each of a tenant's active watchlists, constructs a Bing Search query tailored to the watchlist's match type, tenant locale, and a bounded candidate count.
- **Triggers:** A scheduled `poll(tenantId)` invocation from the live polling scheduler.
- **Inputs:** The tenant's active watchlists (`listActiveWatchlistsForTenant(tenantId)`); tenant locale settings.
- **Processing:**
  - For `keyword`/`hashtag`/`account` watchlists, formats `terms[]` into an OR-query (e.g. `"term1" OR "term2"`).
  - For `boolean_query` watchlists (ADR-0021), passes the `boolean_query` string verbatim to Bing Search.
  - Sets `mkt` and `setLang` from tenant locale settings (e.g. `nl-NL`, `en-US`), defaulting to `en-US`.
  - Requests `count = 25` (up to max 50) candidates per query to bound compute and network overhead.
  - Iterates over active watchlists sequentially with a per-tenant pacing delay to respect Azure Cognitive Services rate limits and avoid cross-tenant thundering herds.
- **Outputs:** A set of candidate search results per watchlist, per endpoint call.
- **Error handling:** Handled at the API-call level (5.7).
- **Edge cases:** A watchlist with no locale configured defaults cleanly to `en-US`/`mkt` default rather than erroring.

### 5.3 Feature / Capability: Deterministic `auto` Endpoint Selection (News-First, Web Fallback)

- **Description:** Prioritizes fresh journalistic news coverage while ensuring adequate candidate volume by deterministically falling back to broader web search when news results are sparse.
- **Triggers:** Every per-watchlist query execution when `endpoint: 'auto'` (the default) is configured.
- **Inputs:** The watchlist's constructed query; the validated result count from the news call.
- **Processing:**
  1. Calls `/v7.0/news/search` first with the constructed query, `count = 25`, and the mapped `freshness` parameter (5.4).
  2. If the **validated** result count (after 5.5's rule filtering) is fewer than **5**, automatically falls back to `/v7.0/search` (Web) in the same polling tick to broaden candidate discovery.
  3. Per-watchlist or connector configuration may explicitly override `auto` to `'news'`-only or `'web'`-only.
- **Outputs:** A combined or single-endpoint candidate set per watchlist, per tick.
- **Error handling:** A failure on the news call does not silently skip the web fallback if configured; endpoint-level errors are handled per 5.7.
- **Edge cases:** A watchlist yielding exactly 5 or more validated news results skips the web fallback entirely that tick, minimizing unnecessary transaction cost.

### 5.4 Feature / Capability: Deterministic Lookback-to-Freshness Mapping

- **Description:** Translates the platform's ingestion lookback window into Bing's `freshness` parameter deterministically, without per-watchlist configuration.
- **Triggers:** Every news-endpoint query.
- **Inputs:** The connector's configured ingestion lookback window.
- **Processing:** Maps lookback ≤ 48 hours → `freshness = 'Day'`; 3–7 days → `freshness = 'Week'`; > 7 days → `freshness = 'Month'`.
- **Outputs:** A `freshness` value attached to the news query.
- **Error handling:** N/A — a pure deterministic mapping function.
- **Edge cases:** A lookback window exactly at a boundary (e.g. 48 hours, 7 days) resolves to the lower/tighter freshness bucket per the stated inequality.

### 5.5 Feature / Capability: Candidate Evaluation Cap and Dual Validation

- **Description:** Bounds compute/cost by capping candidates evaluated per query, then re-validates every candidate against the triggering watchlist's exact rules before ingestion.
- **Triggers:** Immediately after each Bing Search API call returns candidates for a watchlist.
- **Inputs:** Up to 25–50 candidate items (title + `description`/snippet) per query; the triggering watchlist's exact rule definition.
- **Processing:** Evaluates each of the top 25–50 candidates via the existing `matchesWatchlist()` (keyword/hashtag/account) or `matchesAst()` (boolean_query) — the same in-process evaluators used by passive ingestion and by `brave-search` (ADR-0065). No new matching logic is introduced.
- **Outputs:** A filtered subset of candidates that strictly satisfy the watchlist's rule predicate; this count also feeds the `auto` endpoint fallback decision (5.3).
- **Error handling:** Candidates failing validation are silently discarded — not ingested, not logged as errors.
- **Edge cases:** A watchlist query returning exactly the cap (50) candidates is evaluated in full; results beyond the cap are never fetched or considered, bounding cost deterministically.

### 5.6 Feature / Capability: Multi-Step URL Canonicalization and Deduplication

- **Description:** Normalizes result URLs through multiple steps to maximize deduplication accuracy across polling cycles and across providers (`brave-search` and `bing-search` coexisting).
- **Triggers:** Every validated candidate proceeding to ingestion.
- **Inputs:** The raw candidate URL.
- **Processing, in order:**
  1. Resolves and unwraps redirects where safe/available to obtain the destination URL.
  2. Strips known marketing/tracking query parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`, `ref`, `source`).
  3. Normalizes scheme to lowercase (`https://`), lowercases hostnames, and strips standard `www.` prefixes.
  4. Strips trailing URL fragments (`#...`) unless semantically meaningful.
  5. Uses the resulting canonical URL as `externalId`; `INSERT` respects the existing unique key on `(tenant_id, 'bing-search', externalId)`.
- **Outputs:** A canonical URL used consistently as `externalId` and `url` in the mapped `SocialPost`.
- **Error handling:** A URL that cannot be safely unwrapped is used as-is past step 1, with the remaining normalization steps still applied.
- **Edge cases:** The same article discovered via both `brave-search` and `bing-search` produces two distinct posts (different `providerId`s in the composite unique key) rather than one — cross-provider deduplication is not attempted; only within-provider deduplication is guaranteed by the unique key.

### 5.7 Feature / Capability: Canonical Mapping (Author, Fields)

- **Description:** Maps each validated, canonicalized candidate into the platform's canonical `SocialPost`/`SocialPostSummary` schema, using the base domain as the canonical Author.
- **Triggers:** A candidate passes validation and canonicalization (5.5/5.6).
- **Inputs:** The Bing result's `name`, `url`, `description`, `datePublished`/`dateLastCrawled`, `provider[].name`/domain, and optional `language`.
- **Processing:**
  - `url` → canonicalized `externalId`/`url`.
  - `name` → `title` (normalized string).
  - `description` → `bodyMarkdown` (primary body text).
  - `datePublished` preferred for news results; falls back to `dateLastCrawled`, then `now()`, for `publishedAt`.
  - `providerId = 'bing-search'`; source domain stored in post metadata for display/filtering.
  - If Bing returns a language hint, it seeds `enrichment.detectedLanguage`, subject to override by the standard enrichment pass (ADR-0055).
  - **Base-domain-as-Author (ADR-0004 generalization):** `author.id = 'bing-search:' + baseDomain`; `author.username = baseDomain` (e.g. `bbc.co.uk`, `reuters.com`); `author.displayName = provider[0].name || baseDomain`; `author.platform = 'bing-search'`.
- **Outputs:** A new `SocialPost` row (or a no-op if already present via the unique key).
- **Error handling:** A malformed or unparseable result is skipped for that candidate; it does not fail the rest of the poll cycle. HTTP-level errors (401/403/429/5xx) are handled by 5.9.
- **Edge cases:** Web-endpoint results (via the `auto` fallback) use `dateLastCrawled` rather than `datePublished`, since web search results do not carry a reliable publication date.

### 5.8 Feature / Capability: Automatic Watchlist Linking on Ingestion

- **Description:** Explicitly associates every successfully ingested Bing-sourced post with the watchlist whose query produced it, consistent with ADR-0063 and ADR-0065.
- **Triggers:** Successful ingestion of a validated, canonicalized, deduplicated candidate.
- **Inputs:** The ingested post's ID and the triggering watchlist's ID, plus `tenantId`.
- **Processing:** Creates a `(post_id, watchlist_id, tenant_id)` pair and persists it via `insertPostWatchlistMatches()` (ADR-0063) using `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING` — best-effort, must not block ingestion.
- **Outputs:** A `post_watchlist_matches` row; the post is immediately available via `GET /v1/posts?watchlistId=<id>` and the Watchlist Coverage widget.
- **Error handling:** A failure to persist the link is logged but never fails or retries the ingestion of the post itself.
- **Edge cases:** A post independently discoverable by both `brave-search` and `bing-search` (as separate ingested rows, per 5.6) each produce their own `post_watchlist_matches` link to the same watchlist — expected given each is a distinct post row.

### 5.9 Feature / Capability: Post Grounding and LLM Enrichment Integration

- **Description:** Runs Bing-sourced posts through the existing enrichment pipeline unchanged, with an explicit grounding pass explaining relevance to the triggering watchlist.
- **Triggers:** A Bing-sourced post completes ingestion (5.7/5.8).
- **Inputs:** The post's title, URL, `bodyMarkdown` (Bing snippet), source domain, and the triggering watchlist context.
- **Processing:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) extracts and stores sentiment, key phrases, detected language (ADR-0055), and a grounding context/executive summary explaining relevance to the watchlist criteria — persisted in `post_enrichments`.
- **Outputs:** A fully enriched post, indistinguishable in the UI/API from posts from other providers — supporting all existing filters, analytics, human overrides (ADR-0071), and the AI Spike Storyteller.
- **Error handling:** Enrichment failures follow the pipeline's existing error/retry behavior (ADR-0038); not respecified here.
- **Edge cases:** N/A beyond standard enrichment-pipeline edge cases.

### 5.10 Feature / Capability: Credential, Pacing, and Tenant-Scoped Cost Telemetry

- **Description:** Manages the tenant-owned Azure credential, enforces staggered per-tenant pacing to avoid throttling, and emits tenant-scoped cost/quota telemetry.
- **Triggers:** Connector connect/activate (credential storage); every scheduled poll cycle (pacing/telemetry).
- **Inputs:** Tenant-submitted `Ocp-Apim-Subscription-Key` and optional custom Azure endpoint; the tenant's configured (or default) poll interval.
- **Processing:**
  - Stores the key as a Tier-2 tenant-owned credential (`platform_credentials`, `owner_type: 'tenant'`), configured by `tenant_admin` (ADR-0028); the Azure endpoint is stored in connector configuration.
  - All requests include the `Ocp-Apim-Subscription-Key` header.
  - Default polling cadence is 1–4 hours (configurable per tenant); polling is staggered per-tenant with a sequential pacing delay between watchlists to avoid burst 429 throttling and cross-tenant thundering herds.
  - Emits API call counts, query volume, endpoint used (`news` vs `web`), candidate yield, and **estimated cost** (calculated from Azure Cognitive Services pricing per 1,000 transactions) into connector telemetry (ADR-0009/ADR-0010/ADR-0070), strictly scoped by `tenantId`, `platformId='bing-search'`, and `watchlistId` to enable tenant-level quota monitoring, alerts, and billing reconciliation.
- **Outputs:** A connected, activatable connector with observable health and cost telemetry.
- **Error handling:** HTTP 401/403 marks the connector `failing`; HTTP 429/5xx triggers backoff/retry without unhandled errors, per NFR-004.
- **Edge cases:** A tenant without a provisioned Azure Cognitive Services resource cannot activate the connector — no default/shared credential exists (Tier-2, ADR-0028); `brave-search` remains available as an alternative (R-005).

### 5.11 Feature / Capability: Tenant Admin Connector Setup, Activation, and Status Screen

- **Description:** Provides the self-service admin UI surface for connecting, activating, deactivating, and monitoring the Bing Search connector.
- **Triggers:** A `tenant_admin` navigates to the Connectors screen.
- **Inputs:** The tenant admin's Azure Cognitive Services subscription key; optional custom endpoint URL; connector activation toggle actions.
- **Processing:**
  - Adds `bing-search` to the `PLATFORMS` array (`id: 'bing-search'`, `name: 'Bing Search (Azure)'`, `description: 'Azure AI Services active web & news search discovery for watchlists'`, `category: 'Ingestion'`, `authMode: 'api_key'`, `tenantScopeAllowed: true`, `personalScopeAllowed: false`).
  - The Connect modal captures the `Ocp-Apim-Subscription-Key`, an optional custom Azure endpoint URL (defaulting to the standard Bing Search v7 endpoint), and an explicit ADR-0027 billing disclaimer (tenant provisions their own Azure resource directly with Microsoft); submits via `POST /api/connectors/bing-search/connect` with `ownerType: 'tenant'`.
  - On success, the card shows a connected state with a masked credential indicator.
  - `ActivateDeactivateButton` (gated on `tenant_admin`) toggles the connector's active state via `/api/connectors/bing-search/activate` / `/deactivate`.
  - The connector status screen shows Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 1h–4h"), estimated Azure call volume, and a health badge (`Healthy`/`Degraded`/`Failing`/`Stalled`); a "Re-sync now" button is available to `tenant_admin`.
- **Outputs:** A connected, monitorable connector state visible in the admin UI, in the "Connectors" (Ingestion) section, distinct from "AI Providers."
- **Error handling:** Invalid credential submission surfaces the standard connect-modal error path; connector health state reflects 401/403/429/5xx outcomes from 5.10.
- **Edge cases:** N/A beyond standard connector UI patterns already established by Story 6.3/6.5/6.24.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Administrator | Connects, activates, deactivates, and monitors the Bing Search connector; owns Azure credentials/billing |
| Tenant User / Analyst | Consumes Bing-sourced posts matched to their watchlists |
| Platform Engineer | Maintains the connector and ingestion pipelines; monitors telemetry and rate limits |
| Product Owner | Sponsors the feature, owns cost observability and architectural parity with `brave-search` |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 2.22 | Tenant User / Tenant-Admin | Have the platform actively query the Bing Search API (Azure) for my active watchlists, validate matching news/web articles, and ingest them linked to their watchlists | My monitored topics benefit from Azure-aligned enterprise search discovery and index depth | `bingSearchConnector.ts` implements `SocialConnector`; active-watchlist querying with per-tenant pacing and `mkt`/`setLang` localization; deterministic `auto` news-first/web-fallback with `count=25` and mapped `freshness`; candidate cap 25–50 with dual AST/rule validation; multi-step URL canonicalization; base-domain-as-Author mapping; junction linking and tenant-scoped telemetry (calls, endpoint, yield, estimated cost). **Implemented.** |
| Story 6.32 | Tenant Administrator | Connect, activate, manage, and monitor the Bing Search API connector using my organization's Azure subscription key from the admin portal | Our tenant can actively discover web and news content for our watchlists via Azure-aligned search infrastructure | `bing-search` added to `PLATFORMS`; Connect modal with subscription key + optional endpoint + ADR-0027 billing disclaimer; activation/deactivation gated on `tenant_admin`; status screen with health badge, last attempt/success, poll cadence, estimated Azure call volume, "Re-sync now." **Ready — not yet Built.** |

### 6.3 Workflow Diagrams / Steps

**Connector setup flow (tenant admin):**
1. Tenant Administrator opens the Connectors screen and clicks "Connect" on the Bing Search (Azure) card.
2. Submits their `Ocp-Apim-Subscription-Key` and optional custom Azure endpoint via the Connect modal (with ADR-0027 billing disclaimer shown).
3. Credential is stored as a Tier-2 tenant-owned credential (`platform_credentials`, `owner_type: 'tenant'`).
4. Tenant Administrator toggles the connector active via `ActivateDeactivateButton`.
5. The connector becomes eligible for the live polling scheduler.

**Poll cycle flow (backend):**
1. Scheduler invokes `poll(tenantId)` for the tenant's active `bing-search` connector.
2. Connector loads the tenant's active watchlists.
3. For each watchlist (sequentially, staggered pacing): builds a match-type-appropriate query with `mkt`/`setLang` localization; calls `/v7.0/news/search` with `count=25` and the deterministically mapped `freshness`.
4. Validates the news results in-process; if fewer than 5 pass validation, calls `/v7.0/search` (Web) in the same tick to broaden the candidate pool.
5. Evaluates up to 25–50 total candidates against the triggering watchlist's exact rules.
6. Validated candidates are canonicalized via the multi-step URL normalization, deduplicated by `(tenant_id, 'bing-search', externalId)`, and inserted as `SocialPost` rows.
7. Each newly ingested post is linked to its triggering watchlist in `post_watchlist_matches` (best-effort).
8. The post flows into the AI enrichment pipeline for sentiment, key phrases, language, and grounding context.
9. Tenant-scoped telemetry (call counts, endpoint split, candidate yield, estimated cost) is recorded; on 429/5xx the connector backs off; on 401/403 the connector is marked `failing`.
10. The next poll cycle is scheduled 1–4 hours later, staggered relative to other tenants.

**Dashboard consumption flow (downstream, unchanged by this ADR):**
1. Tenant User views the Overview tab's `selectedTopic` filter or Watchlist Coverage widget (Story 8.9).
2. Both call the existing `GET /v1/posts?watchlistId=<id>` / `GET /v1/watchlists` endpoints (ADR-0063), which now also return Bing-sourced posts alongside posts from any other connector (including `brave-search`), indistinguishably.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Active watchlist definitions (`matchType`, `terms[]`, `boolean_query`) via `listActiveWatchlistsForTenant()`; tenant locale settings.
- Bing Search API responses: `name`, `url`, `description`, `datePublished`/`dateLastCrawled`, `provider[].name`, optional `language`.
- The tenant's `Ocp-Apim-Subscription-Key` credential and optional custom Azure endpoint.

### 7.2 Data Outputs

- New `SocialPost`/`social_posts` rows with `providerId: 'bing-search'`.
- New `post_watchlist_matches` rows linking Bing-sourced posts to their triggering watchlist.
- Enrichment output in `post_enrichments` (sentiment, key phrases, detected language, grounding context).
- Tenant-scoped connector telemetry (API call counts, query volume, endpoint used, candidate yield, estimated Azure cost).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialPost` / `social_posts` (existing, populated by this connector) | `externalId` (multi-step canonicalized URL), `url`, `title`, `bodyMarkdown` (Bing snippet), `publishedAt`, `providerId: 'bing-search'`, source domain metadata, `author.*` (base-domain-as-Author), `enrichment.*` | Unique on `(tenant_id, providerId, externalId)`; many-to-many to `watchlists` via `post_watchlist_matches` |
| `post_watchlist_matches` (existing, ADR-0063) | `post_id`, `watchlist_id`, `tenant_id`, `matched_at` | Links each Bing-sourced post to its triggering watchlist, best-effort insert |
| `platform_credentials` (existing) | `owner_type: 'tenant'`, encrypted `Ocp-Apim-Subscription-Key`, optional custom endpoint | Tier-2 tenant-owned credential (ADR-0028) for the `bing-search` connector |
| `post_enrichments` (existing) | `sentiment`, `keyPhrases`, `detectedLanguage`, `groundingContext`/`summary` | One-to-one with the ingested post; populated by the Azure OpenAI enrichment pass |
| Tenant-scoped connector telemetry (existing, widened) | call counts, query volume, endpoint used, candidate yield, estimated cost, health state | Scoped per `tenantId`, `platformId='bing-search'`, `watchlistId` |

### 7.4 Validation Rules

- Every candidate must pass `matchesWatchlist()` or `matchesAst()` re-evaluation against the triggering watchlist's exact rule before ingestion.
- `externalId` must equal the multi-step canonicalized URL (redirects unwrapped, tracking parameters stripped, scheme/host normalized, fragments stripped); the existing `(tenant_id, providerId, externalId)` uniqueness prevents duplicate rows within this provider.
- News search must attempt the fallback to web search when validated results are fewer than 5.
- `freshness` must map deterministically from the configured lookback window per the stated thresholds.
- Candidate evaluation must not exceed the 25–50 cap per watchlist per tick.
- The Azure subscription key must be stored only as an encrypted, tenant-owned (`owner_type: 'tenant'`) credential — never exposed to browser JS.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BRU-001 | A `bing-search` post is only ingested if the candidate title and snippet strictly satisfy the watchlist rules used to trigger the query. | Validation |
| BRU-002 | The `bing-search` connector defaults to `endpoint: 'auto'`, calling news first and falling back to web when validated news results are fewer than five. | Endpoint selection |
| BRU-003 | Lookback window is mapped to Bing's `freshness` parameter: ≤ 48 hours → `Day`, 3–7 days → `Week`, > 7 days → `Month`. | Query construction |
| BRU-004 | Market and language are set from the tenant locale (`mkt` and `setLang`), defaulting to `en-US`. | Query construction |
| BRU-005 | The candidate evaluation cap is set to 25–50 results per watchlist to bound compute and API cost. | Validation |
| BRU-006 | The Azure `Ocp-Apim-Subscription-Key` and endpoint are stored as tenant-owned credentials; the tenant provisions and pays for the Azure resource directly. | Credential management |
| BRU-007 | `post_watchlist_matches` linking is best-effort and must not block ingestion. | Junction linking |
| BRU-008 | Author attribution for `bing-search` posts is based on the canonical base domain of the source URL. | Author mapping |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Bing Search API v7 (`/v7.0/news/search`, `/v7.0/search`) | Outbound, external | Discovery queries against the tenant's active watchlists | REST / JSON over HTTPS (Azure), `Ocp-Apim-Subscription-Key` header |
| `listActiveWatchlistsForTenant()` (`social-listening-core`) | Internal, read | Supplies the set of active watchlists to query | In-process function call |
| `matchesWatchlist()` / `matchesAst()` (`social-listening-core`) | Internal, read | Validates candidates before ingestion | In-process function call |
| `insertPostWatchlistMatches()` (ADR-0063) | Internal, write | Links ingested posts to their triggering watchlist | In-process function call |
| `azureOpenAiConnector.ts` (ADR-0038) | Internal, write | Runs grounding/enrichment on Bing-sourced posts | In-process function call |
| `platform_credentials` store | Internal, storage | Persists the tenant-owned Azure subscription key and endpoint | Encrypted storage |
| Connector-health / cost telemetry (ADR-0009/ADR-0010/ADR-0070) | Internal, outbound | Records call counts, query volume, endpoint split, candidate yield, estimated cost, and health state, scoped by tenant/watchlist | Existing telemetry mechanism |
| `social-listening-admin` Connectors UI (Story 6.32) | Inbound/outbound | Tenant admin connect/activate/monitor flow | REST / JSON over HTTPS |
| Live polling scheduler (Story 1.13/1.14) | Internal, trigger | Invokes `poll(tenantId)` on the configured 1–4 hour cadence, staggered per tenant | In-process scheduler |

---

## 10. Non-Functional Considerations

- **Performance/reliability:** Per-tenant staggered pacing avoids cross-tenant thundering-herd throttling (NFR-002); backoff and retry logic handle 429/5xx transient failures without unhandled errors (NFR-004).
- **Security:** The Azure subscription key is stored encrypted as a Tier-2 tenant-owned credential and never exposed in browser JS (NFR-003).
- **Cost observability:** Explicit tenant-scoped cost telemetry (call counts, endpoint split, estimated cost) supports budgeting, quota alerts, and billing reconciliation — a differentiator versus the simpler quota telemetry in ADR-0065.
- **Maintainability:** Bing-sourced posts are indistinguishable from other providers' posts in the post feed, filters, and analytics; UI parity is preserved with no client-side changes required (NFR-001).
- **Deduplication accuracy:** Multi-step URL canonicalization is deliberately more thorough than the simpler canonicalization in ADR-0065, to prevent duplicate ingestion across cycles and reduce noise from tracking parameters (NFR-005).
- **Enterprise alignment:** Azure billing, SLAs, and credential management align with the platform's existing Azure footprint, offering predictability that a pure independent-index provider cannot.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Bing API returns HTTP 401/403 (invalid/revoked credential) | Connector status shows `Failing` | Connector marked `failing`; no further requests attempted until credential is fixed |
| Bing API returns HTTP 429 or 5xx (throttling / transient failure) | Connector status may show `Degraded`; no data loss | Backoff/retry applied; call recorded in telemetry |
| News endpoint returns fewer than 5 validated results | N/A (transparent to user) | Connector automatically falls back to `/v7.0/search` (Web) in the same tick |
| A candidate fails the in-process validation filter | N/A (silent) | Candidate discarded; not ingested; not treated as an error |
| Duplicate `(tenant_id, 'bing-search', externalId)` encountered | N/A (silent) | No new row created; existing deduplication constraint handles it |
| `post_watchlist_matches` insert fails for a successfully ingested post | N/A (silent to the end user) | Logged as connector-health telemetry; ingestion of the post itself is unaffected |
| Tenant has no provisioned Azure Cognitive Services resource | Clear UI messaging on the connect flow | Connector cannot be activated; `brave-search` remains available as an alternative provider |

---

## 12. Assumptions and Dependencies

- The tenant has an active Azure subscription and can provision a Bing Search / Azure Cognitive Services resource.
- Active watchlists and the live polling scheduler already exist (Stories 1.13/1.14).
- Post-watchlist match persistence (`post_watchlist_matches`, Story 3.11) is available.
- The boolean AST parser (Story 3.6) is available for `boolean_query` watchlists.
- The existing enrichment pipeline and telemetry infrastructure accept the new provider type without structural change.
- Depends on ADR-0028 (Tier-2 credential ownership), ADR-0027 (direct billing), ADR-0038 (Azure OpenAI enrichment pipeline), ADR-0055 (language enrichment schema), ADR-0065 (parallel Brave Search provider pattern), and ADR-0063 (junction table and server-side filter).
- Story 2.22 (backend connector) is Implemented; Story 6.32 (admin UI) is Ready but not yet Built as of this FDD's writing — the admin UI functional design in Section 5.11 reflects the approved, not-yet-shipped design.

---

## 13. Open Questions (Resolved in ADR-0066, retained here for traceability)

| ID | Question | Resolution |
|---|---|---|
| Q1 | What polling schedule frequency should apply? | Default 1–4 hours per tenant tier, with tenant-level overrides |
| Q2 | Should tenants be able to run both `brave-search` and `bing-search`? | Yes — URL-based canonical deduplication on `(tenant_id, provider_id, external_id)` prevents duplicate post storage per provider while broadening candidate discovery across providers |
| Q3 | What billing and credential tier applies? | Tier-2 tenant credential ownership (`ownerType: 'tenant'`, ADR-0028) with direct tenant billing (ADR-0027) |
| Q4 | What is the deterministic endpoint fallback rule? | `auto` default calls news first; falls back to web if validated results are fewer than 5 |

No open (unresolved) questions remain from ADR-0066 itself; the table above documents how each of ADR-0066's originally-open questions was resolved at acceptance time, per the ADR's own "Resolved Questions" section.

---

## 14. Appendix

### Glossary

- **Active watchlist sourcing:** Proactively querying external search indexes for content matching a tenant's watchlist criteria rather than waiting for known feeds.
- **Bing Search API v7:** Microsoft's REST search API provided through Azure AI Services, including Web Search and News Search endpoints.
- **Candidate cap:** The maximum number of search results evaluated per watchlist query, bounded to 25–50.
- **Canonical URL:** A normalized URL with redirects resolved, tracking parameters removed, and host/scheme standardized for consistent deduplication.
- **`endpoint: 'auto'`:** Default connector behavior that calls Bing News first and falls back to Bing Web when insufficient validated results are returned.
- **Freshness:** Bing News Search parameter controlling recency (`Day`, `Week`, `Month`), mapped deterministically from the ingestion lookback window.
- **`Ocp-Apim-Subscription-Key`:** The HTTP header used to authenticate Bing Search API requests.

### Reference Links

- ADR-0066 — `docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md`
- BRD-0066 — `docs/project docs/Business-Requirements/BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md`
- ADR-0065 — Active Watchlist Sourcing via Brave Search API (parallel provider pattern)
- ADR-0063 — Post-watchlist match persistence and server-side filters
- ADR-0062 — Analytics Dashboard Overview enhancements
- ADR-0028 — Connector credential ownership tiers
- ADR-0027 — Direct billing for third-party connectors
- ADR-0038 — Azure OpenAI enrichment connector
- ADR-0055 — Post language and key-phrase enrichment
- ADR-0004 — Organization-as-Author precedent (generalized here for base-domain authorship)
- Story 2.22 — `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`
- Story 6.32 — `docs/user-stories/epic-6-tenant-admin-ui.md`

### Related Product-Research Documents

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for the `bing-search` active watchlist feature (confirmed by BRD-0066 §16 "Notes on related product-research artifacts"). Supporting context is drawn from ADR-0066 and the related user stories.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | Architecture Documentation | Regenerated as a genuine Functional Design Document, replacing a defective prior version that duplicated the BRD's flat requirements table |
