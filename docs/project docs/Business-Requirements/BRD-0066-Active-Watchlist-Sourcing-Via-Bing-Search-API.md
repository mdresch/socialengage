# Active Watchlist Sourcing via Bing Search API — Business Requirements Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Active Watchlist Sourcing via Bing Search API (Azure) – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-20 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-20 | BRD Writer Agent | Initial draft from ADR-0066, Story 2.22, and Story 6.32 |
| 1.0 | 2026-08-20 | BRD Writer Agent | Approved alongside ADR-0066 |

---

## 2. Executive Summary

Watchlists in SocialEngage have historically acted as passive matching filters over ingested feeds such as GNews, Newswire, tenant-owned RSS, Wikipedia, and Facebook. While this reactive model works well when content already flows through the platform, it does not proactively discover web and news articles that match a tenant's bespoke watchlist queries unless those topics happen to cross public RSS or social feeds. ADR-0065 established Brave Search API as the first independent active-sourcing provider; ADR-0066 now adds the Bing Search API (Azure AI Services) as a parallel, enterprise-grade companion.

The proposed capability introduces a new `bing-search` connector that periodically queries the Bing Web Search and Bing News Search v7 endpoints for each active watchlist, validates returned candidates against the original watchlist rules, and ingests matching articles as social posts linked to the originating watchlist. The connector is designed to be functionally parallel to the existing `brave-search` connector, reusing the live polling scheduler, post-watchlist match persistence, enrichment pipeline, and tiered credential model already in place.

For tenants, this means broader, more predictable discovery of public web and news content that matches their monitored topics, with the billing and operational familiarity of Azure. For the platform, it means a second real search provider option without duplicating architecture, strengthened by deterministic endpoint fallback, URL canonicalisation, and tenant-scoped cost telemetry.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Expand active watchlist sourcing to a first-party Azure search provider | `bing-search` connector is available alongside `brave-search` and ingests validated posts for active watchlists |
| 2 | Maintain 100% watchlist-rule precision for actively sourced content | All ingested Bing-sourced candidates pass `matchesWatchlist()` or `matchesAst()` validation before persistence |
| 3 | Provide enterprise-aligned cost and quota visibility | Tenant-scoped telemetry reports API call counts, endpoint usage, candidate yield, and estimated Azure cost per watchlist |
| 4 | Preserve architectural and UI parity across search providers | Tenant-admins can connect, activate, and monitor `bing-search` using the same credential and status patterns as other connectors |

---

## 4. Scope

### 4.1 In Scope

- A new native ingestion connector with provider ID `bing-search` registered in the connector framework.
- Polling-based active watchlist discovery using Bing Web Search and Bing News Search v7 (Azure AI Services).
- Per-watchlist query construction for `keyword`, `hashtag`, `account`, and `boolean_query` watchlist types.
- Deterministic endpoint selection: default `auto` calls Bing News first, then falls back to Bing Web when fewer than five validated news results are found.
- Multi-step URL canonicalisation: redirect unwrapping, tracking-parameter stripping, scheme/host normalisation, and fragment removal.
- Candidate validation against the triggering watchlist's rules, with a configurable candidate cap of 25–50 results per query.
- Mapping of Bing result fields to the canonical `SocialPostSummary` schema, including author derivation by base domain.
- Deduplication via the existing `(tenant_id, provider_id, external_id)` uniqueness constraint using canonical URL as `externalId`.
- Automatic `post_watchlist_matches` junction linking for each post ingested from a specific watchlist.
- Pass-through into the existing enrichment pipeline (sentiment, key phrases, language detection, grounding context).
- Tier-2 tenant-owned credential storage for the Azure `Ocp-Apim-Subscription-Key` and endpoint configuration.
- Quota-safe polling cadence of 1–4 hours with per-tenant staggering and pacing delay between watchlists.
- Admin UI connector card, connect modal, activation/deactivation controls, and status screen for `bing-search`.
- Tenant-scoped telemetry for API call counts, query volume, endpoint used, candidate yield, and estimated cost.

### 4.2 Out of Scope

- Full-text scraping of external web pages beyond the snippet returned by Bing Search API.
- Billing or reselling of Azure Search transactions (tenants provision their own Azure resource under ADR-0027).
- Client-side search query execution (search runs in the backend scheduler only).
- Trending topics (`/v7.0/news/trendingtopics`) or other non-search Bing endpoints.
- Support for user-level (Tier-1) credentials; `bing-search` is tenant-scoped only.

### 4.3 Assumptions

- The tenant has an active Azure subscription and can provision a Bing Search / Azure Cognitive Services resource.
- Active watchlists and the live polling scheduler already exist (Stories 1.13 and 1.14).
- Post-watchlist match persistence (`post_watchlist_matches`) is available (Story 3.11).
- The boolean AST parser is available for `boolean_query` watchlists (Story 3.6).
- The existing enrichment pipeline and telemetry infrastructure accept new provider types without structural change.

### 4.4 Constraints

- Bing Search API is billed per 1,000 transactions; cost must be managed through cadence, candidate caps, and tenant-level controls.
- Azure Cognitive Services resources require the `Ocp-Apim-Subscription-Key` header and a valid Azure endpoint.
- The connector must avoid cross-tenant thundering-herd behaviour through pacing and staggering.
- News results are snippet-only and may not include the full article body.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Owns connector credentials and Azure billing | High | Simple, self-service setup; clear cost telemetry; activation/deactivation controls |
| Tenant User / Analyst | Consumes posts matched to their watchlists | High | Accurate, fresh, and relevant watchlist coverage from web and news sources |
| Platform Engineer | Maintains connector and ingestion pipelines | Medium | Drop-in provider parity, clear telemetry, bounded rate limits |
| Product Owner / Menno | Sponsors the feature and owns priority | High | Enterprise-aligned provider, cost observability, minimal architectural divergence |

---

## 6. Current State (As-Is)

**Current process:**

1. Tenants define watchlists (`keyword`, `hashtag`, `account`, or `boolean_query`) that match incoming posts.
2. The platform ingests content from RSS/news feeds (GNews, Newswire, tenant-owned-feed), Wikipedia, and Facebook.
3. Ingested posts are matched to watchlists using `matchesWatchlist()` or `matchesAst()`.
4. Matched posts appear in `GET /v1/posts?watchlistId=<id>` and power analytics widgets.

**Pain points:**

- Many watchlist queries are highly specific or long-tail and rarely surface in general RSS feeds.
- The platform cannot proactively discover public web or news articles that match a watchlist before they are syndicated through known feeds.
- The only active search option (Brave Search, ADR-0065) may not satisfy tenants with strict Azure-centric procurement, billing, or SLA requirements.
- Without a second search provider, tenants have no choice of index or cost model for active discovery.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A tenant administrator connects the `bing-search` connector by entering their Azure Cognitive Services subscription key and optional endpoint in the admin UI.
2. The tenant activates the `bing-search` connector at tenant scope.
3. The live polling scheduler invokes `bing-search` `poll(tenantId)` at a 1–4 hour cadence.
4. The connector fetches all active watchlists for the tenant, constructs a Bing query for each, and calls Bing News Search (`/v7.0/news/search`) first.
5. If fewer than five validated results are returned, the connector automatically falls back to Bing Web Search (`/v7.0/search`).
6. Each candidate is validated in-process against the originating watchlist's rules; only matching candidates are ingested.
7. Valid posts are deduplicated by canonical URL, stored in `social_posts`, and linked to the watchlist in `post_watchlist_matches`.
8. Posts flow through the standard enrichment pipeline and become indistinguishable from other providers in the post feed, analytics, and AI Spike Storyteller.
9. Tenant-scoped telemetry surfaces API usage, endpoint split, candidate yield, and estimated Azure cost.

**Expected capabilities:**

- Active discovery of web and news content for every active watchlist via Azure.
- Deterministic, transparent news-to-web fallback logic.
- High deduplication accuracy and clean URL normalisation.
- Cost-aware, self-service management of Azure search consumption.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support a `bing-search` connector registered as a native `SocialConnector` with `authMode: 'api_key'` and `deliveryMode: 'poll'`. | Must | Connector registry includes `bing-search` and scheduler can invoke `poll(tenantId)`. | Product Owner |
| BR-002 | The connector shall retrieve all active watchlists for the tenant and construct one Bing query per watchlist. | Must | `poll(tenantId)` calls `listActiveWatchlistsForTenant(tenantId)` and maps watchlist types to Bing query syntax. | Product Owner |
| BR-003 | The system shall default to Bing News Search and fall back to Bing Web Search when fewer than five validated news results are found. | Must | `endpoint: 'auto'` calls `/v7.0/news/search` first; if validated count < 5, it calls `/v7.0/search` in the same tick. | Product Owner |
| BR-004 | The connector shall request and evaluate a capped set of candidates (25–50) per watchlist. | Must | `count` is set to 25 (up to 50) and returned candidates are filtered by `matchesWatchlist()` or `matchesAst()`. | Product Owner |
| BR-005 | The system shall map `keyword`/`hashtag`/`account` watchlist terms into an OR-query and pass `boolean_query` strings verbatim to Bing. | Must | Query builder outputs correct OR syntax for term lists and preserves boolean expressions. | Product Owner |
| BR-006 | The system shall canonicalise result URLs before deduplication and persistence. | Must | URLs are unwrapped, tracking parameters stripped, scheme/host lowercased, `www.` standardised, and trailing fragments removed. | Product Owner |
| BR-007 | The system shall persist each ingested post with `providerId: 'bing-search'` and link it to the originating watchlist in `post_watchlist_matches`. | Must | Posts appear in `GET /v1/posts?watchlistId=<id>` and junction table contains `(post_id, watchlist_id, tenant_id)`. | Product Owner |
| BR-008 | The system shall derive author identity from the source base domain following the organisation-as-Author pattern. | Must | `author.id = 'bing-search:' + baseDomain`, `author.platform = 'bing-search'`, `author.displayName = provider[0].name \|\| baseDomain`. | Product Owner |
| BR-009 | The connector shall emit tenant-scoped telemetry covering API calls, query volume, endpoint used, candidate yield, and estimated Azure cost. | Must | Telemetry is scoped by `tenantId`, `platformId='bing-search'`, and `watchlistId`. | Product Owner |
| BR-010 | Tenant administrators shall be able to connect, activate, and deactivate `bing-search` through the admin portal. | Must | Admin UI exposes `bing-search` card, connect modal for subscription key and optional endpoint, and activation toggle. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Bing-sourced posts shall be indistinguishable from other providers in post feed, filters, and analytics. | Usability | Must | UI parity is validated for `bing-search` posts, including enrichment and manual override support. |
| NFR-002 | Polling cadence shall default to 1–4 hours and be staggered per tenant to avoid throttling. | Reliability | Must | No cross-tenant 429 burst patterns observed in telemetry during connector polling. |
| NFR-003 | Tenant credentials shall be stored as Tier-2 tenant-owned credentials in `platform_credentials`. | Security | Must | Credential retrieval uses `ownerType: 'tenant'` and `tenant_admin` gating. |
| NFR-004 | The connector shall handle Azure rate limits and transient failures gracefully. | Reliability | Should | Backoff and retry logic yields no unhandled errors for 429/5xx responses. |
| NFR-005 | URL canonicalisation shall prevent duplicate ingestion across cycles and providers. | Maintainability | Must | `(tenant_id, 'bing-search', externalId)` uniqueness is not violated by repeated polls. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A `bing-search` post is only ingested if the candidate title and snippet strictly satisfy the watchlist rules used to trigger the query. |
| BRU-002 | The `bing-search` connector defaults to `endpoint: 'auto'`, calling news first and falling back to web when validated news results are fewer than five. |
| BRU-003 | Lookback window is mapped to Bing's `freshness` parameter: ≤ 48 hours → `Day`, 3–7 days → `Week`, > 7 days → `Month`. |
| BRU-004 | Market and language are set from the tenant locale (`mkt` and `setLang`), defaulting to `en-US`. |
| BRU-005 | The candidate evaluation cap is set to 25–50 results per watchlist to bound compute and API cost. |
| BRU-006 | The Azure `Ocp-Apim-Subscription-Key` and endpoint are stored as tenant-owned credentials; the tenant provisions and pays for the Azure resource directly. |
| BRU-007 | `post_watchlist_matches` linking is best-effort and must not block ingestion. |
| BRU-008 | Author attribution for `bing-search` posts is based on the canonical base domain of the source URL. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Azure subscription key (`Ocp-Apim-Subscription-Key`) | Tenant's Bing Search / Azure Cognitive Services API key | Tenant admin | Tenant admin | High — encrypted in `platform_credentials` |
| Bing endpoint URL | Optional custom Azure Cognitive Services endpoint | Tenant admin / default | Tenant admin | Low |
| Bing result `name` | Article title | Bing Search API | Microsoft | Public / external |
| Bing result `url` | Canonical result URL | Bing Search API | Microsoft | Public / external |
| Bing result `description` | Article snippet / summary | Bing Search API | Microsoft | Public / external |
| `datePublished` (news) or `dateLastCrawled` (web) | Publication or crawl timestamp | Bing Search API | Microsoft | Public / external |
| `provider[].name` / `domain` | Source provider and base domain attribution | Bing Search API | Microsoft | Public / external |
| Canonical `externalId` | Canonicalised URL used as deduplication key | Derived by `bing-search` connector | SocialEngage | Public / external |
| `social_posts` row | Ingested post with `providerId='bing-search'` | Derived from Bing result | SocialEngage | Public / external |
| `post_watchlist_matches` row | Junction linking ingested post to watchlist and tenant | Derived by connector | SocialEngage | Tenant-scoped |
| Telemetry metrics | API calls, query volume, endpoint, candidate yield, estimated cost | Connector runtime | SocialEngage | Tenant-scoped telemetry |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Bing Search API call count | Track Azure transaction consumption | Tenant admin / Platform engineer | Per poll / real-time |
| Endpoint split (news vs web) | Understand discovery source mix | Product / Operations | Per poll / aggregated |
| Validated candidate yield | Measure precision and throughput | Product / Tenant admin | Per poll / aggregated |
| Estimated Azure cost per watchlist | Enable cost budgeting and quota alerts | Tenant admin / Finance | Per poll / aggregated |
| Watchlist coverage for `bing-search` posts | Confirm active discovery is surfacing posts | Tenant user / Analyst | Real-time via post feed |
| Connector health badge | Surface `Healthy`, `Degraded`, `Failing`, or `Stalled` states | Tenant admin | Real-time |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Bing Search API costs escalate due to high polling frequency across many watchlists | Medium | High | Cap candidate count, default 1–4h cadence, tenant-scoped telemetry, and configurable activation | Product Owner |
| R-002 | Azure throttling or transient unavailability degrades ingestion | Medium | Medium | Stagger per-tenant polling and implement pacing/backoff | Platform Engineer |
| R-003 | Duplicate posts from `bing-search` and other providers | Medium | Medium | Multi-step URL canonicalisation and `(tenant_id, provider_id, external_id)` uniqueness | Platform Engineer |
| R-004 | Snippet-only results reduce enrichment quality | Medium | Medium | Pass to existing enrichment pipeline; deep text extraction remains out of scope | Product Owner |
| R-005 | Tenants without Azure resources cannot use the connector | High | Low | Clear UI messaging and ADR-0027 billing disclaimer; Brave Search remains an alternative | Product Owner |
| R-006 | Bing's index independence concerns for privacy-conscious tenants | Low | Medium | Position `bing-search` as optional companion to `brave-search`; document choice in UI | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Provider connector framework and registry (ADR-0002/0003, Story 2.1) | Internal | Platform | Implemented |
| D-002 | Live polling scheduler (Stories 1.13 / 1.14) | Internal | Platform | Implemented |
| D-003 | Post-watchlist match persistence (`post_watchlist_matches`, Story 3.11) | Internal | Platform | Implemented |
| D-004 | Boolean AST parser (Story 3.6) | Internal | Platform | Implemented |
| D-005 | Enrichment pipeline (ADR-0055) | Internal | Platform | Implemented |
| D-006 | Telemetry and connector health infrastructure (ADR-0009/0010/0070) | Internal | Platform | Implemented |
| D-007 | Connector connect/disconnect and status UI (Stories 6.3, 6.5, 6.24) | Internal | Admin UI | Implemented |
| D-008 | Azure Cognitive Services / Bing Search resource provisioned by tenant | External | Tenant admin | Ongoing per tenant |
| D-009 | Brave Search API connector pattern (ADR-0065, Story 2.21) | Internal | Platform | Implemented |

---

## 14. Acceptance Criteria

- The `bing-search` connector is registered and the scheduler can invoke `poll(tenantId)` successfully.
- Active watchlists are queried with correct OR or boolean syntax, market/language defaults, and `count = 25`.
- `endpoint: 'auto'` calls Bing News first and falls back to Bing Web when validated news results are fewer than five.
- Lookback windows map deterministically to Bing `freshness` (`Day`, `Week`, `Month`).
- Up to 25–50 candidates are evaluated against the originating watchlist rules; only matching candidates are ingested.
- Canonical URL deduplication and multi-step normalisation produce no duplicate `(tenant_id, 'bing-search', externalId)` violations.
- Ingested posts contain correct `SocialPostSummary` mapping and author attribution by base domain.
- `post_watchlist_matches` junction entries are written for each post and watchlist pair.
- Tenant-scoped telemetry emits API calls, query volume, endpoint, candidate yield, and estimated cost.
- Admin UI supports `bing-search` platform card, connect modal for API key and endpoint, activation toggle, and status metrics.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Active watchlist sourcing | Proactively querying external search indexes for content matching a tenant's watchlist criteria rather than waiting for known feeds. |
| Bing Search API v7 | Microsoft's REST search API provided through Azure AI Services, including Web Search and News Search endpoints. |
| Candidate cap | The maximum number of search results evaluated per watchlist query, bounded to 25–50. |
| Canonical URL | A normalised URL with redirects resolved, tracking parameters removed, and host/scheme standardised for consistent deduplication. |
| `endpoint: 'auto'` | Default connector behaviour that calls Bing News first and falls back to Bing Web when insufficient validated results are returned. |
| Freshness | Bing News Search parameter controlling recency (`Day`, `Week`, `Month`) mapped from the ingestion lookback window. |
| Ocp-Apim-Subscription-Key | The HTTP header used to authenticate Bing Search API requests. |
| Post-watchlist match persistence | Junction table `post_watchlist_matches` that records which watchlist caused a post to be ingested. |
| Tier-2 credential | A credential owned at the tenant level, managed by a tenant administrator, per ADR-0028. |

---

## 16. Appendices

### Reference documents

- **ADR-0066:** `docs/adr/0066-active-watchlist-sourcing-via-bing-search-api.md` — authoritative architecture decision.
- **Story 2.22:** `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` — backend connector implementation.
- **Story 6.32:** `docs/user-stories/epic-6-tenant-admin-ui.md` — admin UI connector setup, activation, and status screen.
- **Precedent ADR-0065:** `docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md` — parallel Brave Search provider pattern.
- **Precedent ADR-0063:** `docs/adr/0063-post-watchlist-match-persistence-and-server-side-filters.md` — post-watchlist match persistence.

### Notes on related product-research artifacts

- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for the `bing-search` feature at the time of writing. The BRD is therefore derived directly from ADR-0066 and the associated user stories.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | — | 2026-08-20 |
| Product Owner | Menno | — | 2026-08-20 |
| Technical Lead | Menno | — | 2026-08-20 |
| Other Stakeholder | — | — | — |
