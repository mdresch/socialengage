# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0065 Active Watchlist Sourcing via Brave Search API — Polling Connector, Post Ingestion Grounding, and LLM Enrichment — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Architecture Documentation, translated from ADR-0065 / BRD-0065 |
| Reviewer(s) | Menno (Sponsor / Product Owner / Technical Lead) |
| Status | Approved |
| Related Documents | ADR-0065; BRD-0065; ADR-0063 (post-watchlist match persistence); ADR-0062 (Overview tab); ADR-0028 (credential ownership tiers); ADR-0027 (direct billing); ADR-0038 (Azure OpenAI enrichment); ADR-0055 (language enrichment); ADR-0018 (ingestion lookback/retention); ADR-0021 (Boolean AST matching); ADR-0004 (organization-as-Author precedent); Story 2.21; Story 6.30; Story 8.9 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0065 and BRD-0065 into a functional design for a new active connector, `brave-search`, that turns tenant watchlists from passive filters into active discovery queries against the Brave Search API — ingesting validated results as standard posts, linking them to their triggering watchlist, and enriching them through the existing AI pipeline.

ADR-0065's Status is **Accepted** (2026-08-20), and BRD-0065 is **Approved**; this FDD reflects an already-approved design (Story 2.21 Implemented, Story 6.30 Built), not a draft for review.

### 2.2 Scope

- **In scope:**
  - The `brave-search` connector: registration, active-watchlist-driven query generation, dual discovery/validation, pacing/quota-safe polling.
  - Mapping of Brave Search results to the canonical `SocialPost`/`SocialPostSummary` schema, including Publication/Domain-as-Author.
  - URL canonicalization and deduplication via the existing `(tenant_id, providerId, externalId)` unique key.
  - Automatic, best-effort linkage of ingested posts to their triggering watchlist in `post_watchlist_matches` (ADR-0063).
  - Grounding and AI enrichment integration for Brave-sourced posts.
  - Tier-2 tenant-owned credential storage, direct billing, quota-safe pacing/cadence, and connector telemetry.
  - The tenant admin UI connector setup/activation/status screen (Story 6.30).
- **Out of scope:**
  - Full-text scraping of external web pages (deferred to a future v2 evaluation).
  - Client-side execution of Brave Search queries.
  - Reselling or proxying Brave Search API billing/credits.
  - Other search providers (Bing is covered separately by ADR-0066).
  - Push notifications, email alerts, or real-time messaging triggered by Brave-sourced posts.
  - Sub-national/city-level geocoding of discovered articles.

### 2.3 Target Audience

Backend engineers (`social-listening-core` connector framework), frontend engineers (`social-listening-admin` connector UI), QA, and the product owner reviewing traceability from BRD-0065 through implementation.

---

## 3. Context and Background

- **Problem:** Watchlists have historically been purely reactive (ADR-0006/Story 3.3/ADR-0021) — they evaluate posts that already arrive through passive connectors (GNews, Newswire, tenant-owned feeds). The platform cannot actively discover new content specifically targeted at a tenant's defined watchlists unless it happens to appear in generic feeds by chance.
- **Business/user value:** Proactive topic coverage; more accurate, real data for the Watchlist Coverage widget and `selectedTopic` filters (ADR-0062/ADR-0063) instead of gaps for narrowly defined or emerging topics; reduced missed conversations without resorting to brittle scraping.
- **Source requirements:** ADR-0065 (Accepted 2026-08-20); BRD-0065 (Approved 2026-08-20); follow-up to ADR-0063 and ADR-0062; direct request from Menno to align Topics/watchlists and evaluate Brave Search for active discovery and grounding/enrichment.
- **Constraints:**
  - Brave Search API free tier: 2,000 requests/month, 1 req/sec ceiling.
  - Must respect the 1 req/sec limit via a 1.2-second minimum pacing delay between sequential requests within a poll cycle.
  - Default polling cadence 1–4 hours (configurable per tenant), not 15 minutes, to remain quota-safe.
  - The API token is a Tier-2, tenant-owned credential (ADR-0028) with direct tenant-to-Brave billing (ADR-0027); SocialEngage never resells or proxies Brave credits.
  - Only publicly accessible web/news URLs and snippets are ingested — no private/authenticated content, no author IPs or private audience data.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Enable proactive discovery of web and news content for active watchlists | Brave-sourced posts appear in `GET /v1/posts?watchlistId=<id>` for active watchlists within one polling cycle |
| G2 | Close the analytics feedback loop for watchlist coverage | Watchlist Coverage widget and `selectedTopic` filters are populated with real, actively sourced data |
| G3 | Maintain the same precision as passive watchlist matching | 100% of ingested Brave-sourced posts satisfy the originating watchlist's matching rules |
| G4 | Operate within Brave Search API quota and rate limits | No HTTP 429 violations; API calls paced to the 1 req/sec ceiling |
| G5 | Provide self-service tenant administration | Tenant admins can connect, activate, and monitor the connector without engineering support |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `brave-search` Connector Registration

- **Description:** Registers a new native ingestion connector implementing the existing `SocialConnector` provider framework.
- **Triggers:** Connector framework startup / registry load.
- **Inputs:** N/A (static registration).
- **Processing:** Registers `providerId: 'brave-search'`, `authMode: 'api_key'`, `deliveryMode: 'poll'`, exposing `poll(tenantId: string)`, in `connectorRegistry.ts` — the same pattern every other native connector follows.
- **Outputs:** A selectable connector in the admin UI's platform list and a poll target in the live scheduler.
- **Error handling:** N/A at registration.
- **Edge cases:** N/A.

### 5.2 Feature / Capability: Active-Watchlist Query Generation (Dual Discovery)

- **Description:** For each of a tenant's active watchlists, constructs and issues a Brave Search API query tailored to that watchlist's match type.
- **Triggers:** A scheduled `poll(tenantId)` invocation from the live polling scheduler (Story 1.13/1.14).
- **Inputs:** The tenant's active watchlists (`listActiveWatchlistsForTenant(tenantId)`), each with its `matchType` (`keyword`/`hashtag`/`account`/`boolean_query`) and rule definition.
- **Processing:**
  - For `keyword`/`hashtag`/`account` watchlists, formats `terms[]` into an OR-expression search query (e.g. `"term1" OR "term2"`).
  - For `boolean_query` watchlists (ADR-0021), formats the stored AST/boolean expression into Brave-compatible search syntax.
  - Calls `/res/v1/news/search` by default (configurable to `/res/v1/web/search`), including the tenant's `X-Subscription-Token`, a `freshness` parameter aligned to ADR-0018's ingestion lookback window, and `offset`/`count` pagination to avoid over-fetching in a single call.
- **Outputs:** A set of candidate search results (title, URL, snippet/description, publication date, source domain) per watchlist.
- **Error handling:** Handled at the API-call level (5.5).
- **Edge cases:** A watchlist with no active matches in Brave's index yields zero candidates for that cycle — not an error.

### 5.3 Feature / Capability: Candidate Validation Filter

- **Description:** Re-evaluates every Brave-returned candidate against the triggering watchlist's exact matching rules before ingestion, guaranteeing identical precision to passive feeds.
- **Triggers:** Immediately after each Brave Search API call returns candidates for a watchlist.
- **Inputs:** Candidate title + snippet/description; the triggering watchlist's exact rule definition.
- **Processing:** Evaluates each candidate via the existing `matchesWatchlist()` (keyword/hashtag/account) or `matchesAst()` (boolean_query) — the same in-process evaluators used by passive ingestion. No new matching logic is introduced.
- **Outputs:** A filtered subset of candidates that strictly satisfy the watchlist's rule predicate.
- **Error handling:** Candidates failing validation are silently discarded — not ingested, not logged as errors.
- **Edge cases:** Because search engines use broad matching/stemming, a candidate may be returned by Brave but fail strict validation (e.g. stemmed match, not exact); this is expected and by design — it guarantees zero false-positive drift between active search and passive ingestion (ADR-0065 Consequences, Query fidelity risk named as an open monitoring item).

### 5.4 Feature / Capability: Canonical Mapping and Deduplication

- **Description:** Maps each validated candidate into the platform's canonical `SocialPost`/`SocialPostSummary` schema, using Publication/Domain as the canonical Author and the canonicalized URL for deduplication.
- **Triggers:** A candidate passes validation (5.3).
- **Inputs:** The Brave result's `url`, `title`, `description`/`snippet`, `age`/`published`/`page_age`, `source`/`domain`, and optional `language`.
- **Processing:**
  - `externalId` and `url` are set from the canonicalized result URL (following redirects where available) to maximize deduplication effectiveness.
  - `title` is mapped to `title` (trimmed to a sensible length).
  - `description`/`snippet` is mapped to `bodyMarkdown` as the primary body text.
  - `age`/`published`/`page_age` is parsed into `publishedAt`; if no publication date is returned, `publishedAt = now()` at ingestion time.
  - `providerId = 'brave-search'`; the source domain is stored in the post's source metadata for display/filtering.
  - If Brave returns a language hint, it seeds `enrichment.detectedLanguage` as an initial value, subject to override by the standard enrichment pass (ADR-0055).
  - **Publication/Domain-as-Author (ADR-0004 generalization):** `author.id = 'brave-search:' + domain`; `author.username = domain` (e.g. `bbc.com`); `author.displayName = sourceName || domain`; `author.platform = 'brave-search'`.
  - Deduplication reuses the standard URL-based path (ADR-0005): `INSERT` respects the existing unique key on `(tenant_id, providerId, externalId)`, so the same article discovered across multiple polling cycles or overlapping watchlist queries is never ingested twice.
- **Outputs:** A new `SocialPost` row (or a no-op if already present via the unique key).
- **Error handling:** A malformed or unparseable result is skipped for that candidate; it does not fail the rest of the poll cycle.
- **Edge cases:** Very long-form articles are represented only by Brave's summary excerpt, not the full article body (named limitation, Open Question 2).

### 5.5 Feature / Capability: Automatic Watchlist Linking on Ingestion

- **Description:** Explicitly associates every successfully ingested Brave-sourced post with the watchlist whose query produced it.
- **Triggers:** Successful ingestion of a validated, deduplicated candidate (5.4).
- **Inputs:** The ingested post's ID and the triggering watchlist's ID, plus `tenantId`.
- **Processing:** Creates a `(post_id, watchlist_id, tenant_id)` pair and persists it via `insertPostWatchlistMatches()` (ADR-0063) using `INSERT ... ON CONFLICT (post_id, watchlist_id) DO NOTHING` — best-effort, must not block ingestion.
- **Outputs:** A `post_watchlist_matches` row linking the post to its discovering watchlist; the post becomes immediately queryable via `GET /v1/posts?watchlistId=<id>` and available to the Watchlist Coverage widget.
- **Error handling:** A failure to persist the link is logged (same telemetry path as ADR-0063's own best-effort semantics) but never fails or retries the ingestion of the post itself.
- **Edge cases:** A post independently discoverable by two different active watchlists' queries in the same or different cycles produces two distinct junction rows (one per watchlist), consistent with the many-to-many junction design.

### 5.6 Feature / Capability: Grounding and LLM Enrichment Integration

- **Description:** Runs Brave-sourced posts through the existing AI enrichment pipeline with an explicit grounding pass that explains relevance to the triggering watchlist.
- **Triggers:** A Brave-sourced post completes ingestion (5.4/5.5).
- **Inputs:** The post's `bodyMarkdown` (Brave snippet), title, URL, source domain, and the triggering `watchlistId`/watchlist query context.
- **Processing:** The enrichment runner (`azureOpenAiConnector.ts`, ADR-0038) extracts and stores: sentiment (`enrichment.sentiment`, positive/neutral/negative with score); key phrases (`enrichment.keyPhrases`); detected language (`enrichment.detectedLanguage`, ISO 639-1, overriding any Brave-provided hint per ADR-0055); and a grounding context/executive summary explaining why the article matches the watchlist criteria, persisted in the `post_enrichments` store (e.g. `enrichment.groundingContext` or `enrichment.summary`).
- **Outputs:** A fully enriched post, indistinguishable in the UI/API from posts sourced by native feeds — supporting sentiment filters, language filters, the AI Spike Storyteller, and all existing analytics aggregations.
- **Error handling:** Enrichment failures follow the pipeline's existing error/retry behavior (ADR-0038); not respecified here.
- **Edge cases:** N/A beyond standard enrichment-pipeline edge cases.

### 5.7 Feature / Capability: Credential, Rate-Limit, and Cadence Management

- **Description:** Manages the tenant-owned Brave API credential and enforces quota-safe request pacing and polling cadence.
- **Triggers:** Connector connect/activate (credential storage); every scheduled poll cycle (pacing/cadence).
- **Inputs:** Tenant-submitted `X-Subscription-Token`; the tenant's configured (or default) poll interval.
- **Processing:**
  - Stores the token as a Tier-2 tenant-owned credential (`platform_credentials`, `owner_type: 'tenant'`), configured by `tenant_admin` (ADR-0028).
  - All Brave API calls include the `X-Subscription-Token` header.
  - Default polling cadence is 1–4 hours (configurable per tenant), not 15 minutes, to stay quota-safe against the free tier's 2,000 req/mo limit.
  - Within a poll cycle, queries across multiple active watchlists execute sequentially with a minimum 1.2-second pacing delay between requests, respecting Brave's 1 req/sec ceiling and avoiding HTTP 429.
  - Records API call counts and quota usage in connector telemetry (ADR-0009/ADR-0010/ADR-0070); if a tenant approaches their quota limit, logs a warning and gracefully defers further queries until the next period.
- **Outputs:** A connected, activatable connector with observable health/quota telemetry.
- **Error handling:** HTTP 401/403 marks the connector `failing` (invalid credential); HTTP 429 triggers backoff and is recorded in telemetry, without data loss.
- **Edge cases:** A tenant that never obtains a Brave subscription simply cannot activate the connector — no default/shared credential exists (Tier-2 has no system-wide fallback, per ADR-0028).

### 5.8 Feature / Capability: Tenant Admin Connector Setup, Activation, and Status Screen

- **Description:** Provides the self-service admin UI surface for connecting, activating, deactivating, and monitoring the Brave Search connector.
- **Triggers:** A `tenant_admin` navigates to the Connectors screen.
- **Inputs:** The tenant admin's Brave `X-Subscription-Token`; connector activation toggle actions.
- **Processing:**
  - Adds `brave-search` to the `PLATFORMS` array (`id: 'brave-search'`, `name: 'Brave Search'`, `category: 'Ingestion'`, `authMode: 'api_key'`, `tenantScopeAllowed: true`, `personalScopeAllowed: false`).
  - The Connect modal captures the API key with an explicit ADR-0027 billing disclaimer (tenant contracts directly with Brave) and submits via `POST /api/connectors/brave-search/connect` with `ownerType: 'tenant'`.
  - On success, the card shows a connected state with a masked credential indicator.
  - `ActivateDeactivateButton` (gated on `tenant_admin`) toggles the connector's active state via `/api/connectors/brave-search/activate` / `/deactivate`.
  - The connector status screen shows Last Ingestion Attempt, Last Successful Ingestion, polling cadence (e.g. "Poll interval: 1h–4h"), and a health badge (`Healthy`/`Degraded`/`Failing`/`Stalled`); a "Re-sync now" button is available to `tenant_admin`.
- **Outputs:** A connected, monitorable connector state visible in the admin UI.
- **Error handling:** Invalid credential submission surfaces the standard connect-modal error path; connector health state reflects 401/403/429 outcomes from 5.7.
- **Edge cases:** N/A beyond standard connector UI patterns already established by Story 6.3/6.5.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Administrator | Connects, activates, deactivates, and monitors the Brave Search connector; owns the API credential |
| Tenant User / Analyst | Consumes Brave-sourced posts, coverage charts, and analytics |
| Backend Engineer | Owns the connector implementation, query generation, validation, and enrichment integration |
| Platform Operations | Monitors connector health and quota across tenants |
| Brave Search (Vendor) | Provides the upstream API; tenant contracts directly for billing |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria (summary) |
|---|---|---|---|---|
| Story 2.21 | Tenant User / Tenant-Admin | Have the platform actively query Brave Search for my active watchlists, validate matching articles, and ingest them linked to their watchlists | My monitored topics are proactively discovered across the web/news index rather than waiting for them to randomly cross generic feeds | `braveSearchConnector.ts` implements `SocialConnector`; active-watchlist querying with 1.2s pacing; dual discovery/validation via `matchesWatchlist()`/`matchesAst()`; Publication/Domain-as-Author mapping; canonical ingestion + `post_watchlist_matches` linking; 401/403/429 handling; 1–4h cadence. **Implemented.** |
| Story 6.30 | Tenant Administrator | Connect, activate, manage, and monitor the Brave Search API connector using my organization's API key from the admin portal | Our tenant can actively discover web/news content for our watchlists without backend developer assistance | `brave-search` added to `PLATFORMS`; Connect modal with API key field and ADR-0027 billing disclaimer; activation/deactivation gated on `tenant_admin`; status screen with health badge, last attempt/success, poll cadence, "Re-sync now." **Built 2026-08-21.** |
| Story 8.9 (consumer) | Tenant User / Tenant-Admin | See Brave-sourced posts reflected in the `selectedTopic` filter and Watchlist Coverage widget | Coverage/filter data is real and actively sourced, not just passively arrived | Consumes `GET /v1/posts?watchlistId` and `post_watchlist_matches`, unaffected by which connector produced the match (ADR-0063). |

### 6.3 Workflow Diagrams / Steps

**Connector setup flow (tenant admin):**
1. Tenant Administrator opens the Connectors screen and clicks "Connect" on the Brave Search card.
2. Submits their Brave `X-Subscription-Token` via the Connect modal (with ADR-0027 billing disclaimer shown).
3. Credential is stored as a Tier-2 tenant-owned credential (`platform_credentials`, `owner_type: 'tenant'`).
4. Tenant Administrator toggles the connector active via `ActivateDeactivateButton`.
5. The connector becomes eligible for the live polling scheduler.

**Poll cycle flow (backend):**
1. Scheduler invokes `poll(tenantId)` for the tenant's active `brave-search` connector.
2. Connector loads the tenant's active watchlists.
3. For each watchlist (sequentially, 1.2s apart): builds a match-type-appropriate query; calls `/res/v1/news/search` (or `/res/v1/web/search`) with `X-Subscription-Token`, `freshness`, and pagination.
4. Each returned candidate is validated in-process against the triggering watchlist's exact rules.
5. Validated candidates are canonicalized, deduplicated by URL, and inserted as `SocialPost` rows with `providerId: 'brave-search'`.
6. Each newly ingested post is linked to its triggering watchlist in `post_watchlist_matches` (best-effort).
7. The post flows into the AI enrichment pipeline for sentiment, key phrases, language, and grounding context.
8. Quota/call-count telemetry is recorded; on 429 the connector backs off; on 401/403 the connector is marked `failing`.
9. The next poll cycle is scheduled 1–4 hours later.

**Dashboard consumption flow (downstream, unchanged by this ADR):**
1. Tenant User views the Overview tab's `selectedTopic` filter or Watchlist Coverage widget (Story 8.9).
2. Both call the existing `GET /v1/posts?watchlistId=<id>` / `GET /v1/watchlists` endpoints (ADR-0063), which now also return Brave-sourced posts alongside posts from any other connector, indistinguishably.

---

## 7. Data Requirements

### 7.1 Data Inputs

- Active watchlist definitions (`matchType`, `terms[]`, `boolean_query`) via `listActiveWatchlistsForTenant()`.
- Brave Search API responses: `url`, `title`, `description`/`snippet`, `age`/`published`/`page_age`, `source`/`domain`, optional `language`.
- The tenant's `X-Subscription-Token` credential.

### 7.2 Data Outputs

- New `SocialPost`/`social_posts` rows with `providerId: 'brave-search'`.
- New `post_watchlist_matches` rows linking Brave-sourced posts to their triggering watchlist.
- Enrichment output in `post_enrichments` (sentiment, key phrases, detected language, grounding context).
- Connector telemetry (call counts, quota usage, health, last success/failure timestamps).

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `SocialPost` / `social_posts` (existing, populated by this connector) | `externalId` (canonical URL), `url`, `title`, `bodyMarkdown` (Brave snippet), `publishedAt`, `providerId: 'brave-search'`, source domain metadata, `author.*` (domain-as-Author), `enrichment.*` | Unique on `(tenant_id, providerId, externalId)`; many-to-many to `watchlists` via `post_watchlist_matches` |
| `post_watchlist_matches` (existing, ADR-0063) | `post_id`, `watchlist_id`, `tenant_id`, `matched_at` | Links each Brave-sourced post to its triggering watchlist, best-effort insert |
| `platform_credentials` (existing) | `owner_type: 'tenant'`, encrypted `X-Subscription-Token` | Tier-2 tenant-owned credential (ADR-0028) for the `brave-search` connector |
| `post_enrichments` (existing) | `sentiment`, `keyPhrases`, `detectedLanguage`, `groundingContext`/`summary` | One-to-one with the ingested post; populated by the Azure OpenAI enrichment pass |
| Connector telemetry (existing) | call counts, quota usage, health state, last attempt/success timestamps | Scoped per tenant per connector (`brave-search`) |

### 7.4 Validation Rules

- Every candidate must pass `matchesWatchlist()` or `matchesAst()` re-evaluation against the triggering watchlist's exact rule before ingestion — no candidate is ingested on Brave's relevance ranking alone.
- `externalId` must equal the normalized canonical URL; the existing `(tenant_id, providerId, externalId)` uniqueness prevents duplicate rows.
- Requests must be spaced at least 1.2 seconds apart within a poll cycle.
- The default poll interval must fall within 1–4 hours unless explicitly overridden per tenant.
- The Brave API token must be stored only as an encrypted, tenant-owned (`owner_type: 'tenant'`) credential — never exposed to browser JS.

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BRU-001 | Only watchlists marked `active` for the tenant are used for Brave Search discovery. | Query generation |
| BRU-002 | `keyword`/`hashtag`/`account` watchlists are translated into an OR expression of quoted terms for Brave Search. | Query generation |
| BRU-003 | `boolean_query` watchlists may be passed directly to Brave using a syntax-compatible formatting of the stored AST. | Query generation |
| BRU-004 | Every Brave result candidate must pass the originating watchlist's exact rule evaluation before it is ingested. | Validation |
| BRU-005 | The source domain is treated as the canonical `Author` for the ingested post. | Author mapping |
| BRU-006 | The Brave Search API token is a Tier-2, tenant-owned credential; the tenant contracts directly with Brave. | Credential management |
| BRU-007 | Default active watchlist polling cadence is 1–4 hours, with a 1.2-second pacing delay between requests. | Scheduling |
| BRU-008 | `post_watchlist_matches` insertion is best-effort and must never block post ingestion. | Junction linking |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| Brave Search API (`/res/v1/news/search`, `/res/v1/web/search`) | Outbound, external | Discovery queries against the tenant's active watchlists | REST / JSON over HTTPS, `X-Subscription-Token` header |
| `listActiveWatchlistsForTenant()` (`social-listening-core`) | Internal, read | Supplies the set of active watchlists to query | In-process function call |
| `matchesWatchlist()` / `matchesAst()` (`social-listening-core`) | Internal, read | Validates candidates before ingestion | In-process function call |
| `insertPostWatchlistMatches()` (ADR-0063) | Internal, write | Links ingested posts to their triggering watchlist | In-process function call |
| `azureOpenAiConnector.ts` (ADR-0038) | Internal, write | Runs grounding/enrichment on Brave-sourced posts | In-process function call |
| `platform_credentials` store | Internal, storage | Persists the tenant-owned Brave API token | Encrypted storage |
| Connector-health telemetry (ADR-0009/ADR-0010/ADR-0070) | Internal, outbound | Records call counts, quota usage, and health state | Existing telemetry mechanism |
| `social-listening-admin` Connectors UI (Story 6.30) | Inbound/outbound | Tenant admin connect/activate/monitor flow | REST / JSON over HTTPS |
| Live polling scheduler (Story 1.13/1.14) | Internal, trigger | Invokes `poll(tenantId)` on the configured 1–4 hour cadence | In-process scheduler |

---

## 10. Non-Functional Considerations

- **Performance:** Sequential per-watchlist queries with a mandatory 1.2-second pacing delay ensure the connector never exceeds Brave's 1 req/sec ceiling (NFR-001).
- **Reliability:** HTTP 429 triggers backoff and telemetry rather than data loss; HTTP 401/403 marks the connector `failing` so it is visibly actionable rather than silently degraded (NFR-002).
- **Security:** The API token is stored encrypted as a Tier-2 tenant-owned credential and never exposed in browser JS (NFR-003).
- **Compliance/privacy:** Only publicly accessible URLs and snippets are ingested; no IP, audience, or private data is collected from Brave results, consistent with the privacy posture established in ADR-0064 (NFR-004).
- **Maintainability:** Brave-sourced posts are indistinguishable from native-feed posts in the posts API and analytics — all existing filters, sorting, and aggregation endpoints work without client-side changes (NFR-005).
- **Cost/quota management:** API cost is metered; polling many active watchlists at high frequency can incur meaningful cost, requiring careful tenant-tier configuration, quota telemetry, and graceful deferral near quota limits.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| Brave API returns HTTP 401/403 (invalid/revoked credential) | Connector status shows `Failing` | Connector marked `failing`; no further requests attempted until credential is fixed |
| Brave API returns HTTP 429 (rate limit exceeded) | Connector status may show `Degraded`; no data loss | Backoff applied; call recorded in quota telemetry; retried on the next safe interval |
| A candidate fails the in-process validation filter | N/A (silent) | Candidate discarded; not ingested; not treated as an error |
| Duplicate `(tenant_id, 'brave-search', externalId)` encountered | N/A (silent) | No new row created; existing deduplication constraint handles it |
| `post_watchlist_matches` insert fails for a successfully ingested post | N/A (silent to the end user) | Logged as connector-health telemetry; ingestion of the post itself is unaffected |
| Tenant approaches their Brave quota limit | Quota warning visible in connector telemetry/status | Further queries for that tenant are gracefully deferred until the next period |

---

## 12. Assumptions and Dependencies

- Tenants obtain and manage their own Brave Search API subscription token; SocialEngage never resells or proxies it.
- Only publicly accessible web/news URLs and snippets are ingested; no private or authenticated content.
- Watchlists are already defined and can be marked active for a tenant (existing capability).
- The existing `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId=<id>` filter (ADR-0063) are available and unchanged by this design.
- Depends on ADR-0028 (Tier-2 credential ownership), ADR-0027 (direct billing), ADR-0038 (Azure OpenAI enrichment pipeline, already built), ADR-0055 (language enrichment schema), and ADR-0018 (ingestion lookback/retention cadence).
- Story 2.21 (backend connector) is a prerequisite for Story 6.30 (admin UI); both already implemented/built as of 2026-08-21.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | What polling schedule frequency (within the 1–4 hour band) should apply by tenant subscription tier, watchlist criticality, and API budget? | Product Owner | Per-tier defaults with tenant-level overrides; not further fixed here |
| Q2 | Should posts discovered via Brave trigger an optional background full-text fetch when the snippet is too brief, and via what mechanism? | Product Owner / Engineering | Deferred to a v2 evaluation |
| Q3 | For `boolean_query` watchlists, should the raw boolean string be passed to Brave verbatim, or simplified to keyword terms to improve recall? | Engineering | Open — validate with real tenant queries |
| Q4 | Should deduplication consider results seen across a wider N-day window beyond the existing `(tenant_id, providerId, externalId)` uniqueness? | Engineering | Current approach sufficient for v1; revisit if cross-cycle duplication is observed |
| Q5 | Under quota constraint, which watchlists should be polled first? | Engineering | Implementation-time judgment; sensible default is to prioritize active watchlists with recent dashboard usage |

---

## 14. Appendix

### Glossary

- **Active watchlist:** A tenant watchlist that is enabled and used by a connector to proactively discover content.
- **Dual discovery and validation:** The two-stage process of querying Brave for candidates and then re-evaluating each candidate against the watchlist's exact rules before ingestion.
- **Grounding:** An enrichment step that explains why a discovered article matches the originating watchlist criteria.
- **Canonical URL:** A normalized, redirect-followed URL used as the stable `externalId` for deduplication.
- **`X-Subscription-Token`:** The API key header required to authenticate Brave Search API requests.

### Reference Links

- ADR-0065 — `docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md`
- BRD-0065 — `docs/project docs/Business-Requirements/BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md`
- ADR-0063 — Post-watchlist match persistence and server-side filters
- ADR-0062 — Analytics Dashboard Overview enhancements
- ADR-0028 — Connector credential ownership tiers
- ADR-0027 — Direct billing for third-party connectors
- ADR-0038 — Azure OpenAI enrichment connector
- ADR-0055 — Post language and key-phrase enrichment
- ADR-0018 — Ingestion lookback and retention cadence
- ADR-0004 — Organization-as-Author precedent (generalized here for domain/publication authorship)
- Story 2.21 — `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md`
- Story 6.30 — `docs/user-stories/epic-6-tenant-admin-ui.md`
- Story 8.9 — `docs/user-stories/epic-8-analytics-dashboard.md`

### Related Product-Research Documents

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for the `brave-search` active watchlist feature (confirmed by BRD-0065 §16.3 "Missing Source Notice"). Supporting context is drawn from ADR-0065 and the related user stories.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 1.0 | 2026-08-23 | Architecture Documentation | Regenerated as a genuine Functional Design Document, replacing a defective prior version that duplicated the BRD's flat requirements table |
