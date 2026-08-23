# Active Watchlist Sourcing via Bing Search API — Business Requirements Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Active Watchlist Sourcing via Bing Search API — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0066-active-watchlist-sourcing-via-bing-search-api.md, ../Business-Requirements/BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0066-active-watchlist-sourcing-via-bing-search-api.md and the business requirements in BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md into functional design for **Active Watchlist Sourcing Via Bing Search API**.
Watchlists in SocialEngage have historically acted as passive matching filters over ingested feeds such as GNews, Newswire, tenant-owned RSS, Wikipedia, and Facebook. While this reactive model works well when content already flows through the platform, it does not proactively discover web and news articles that match a tenant's bespoke watchlist queries unless those topics happen to cross public RSS or social feeds. ADR-0065 established Brave Search API as the first independent active-sourcing provider; ADR-0066 now adds the Bing Search API (Azure AI Services) as a parallel, enterprise-grade companion.

The proposed capability introduces a new `bing-search` connector that periodically queries the Bing Web Search and Bing News Search v7 endpoints for each active watchlist, validates returned candidates against the original watchlist rules, and ingests matching articles as social posts linked to the originating watchlist. The connector is designed to be functionally parallel to the existing `brave-search` connector, reusing the live polling scheduler, post-watchlist match persistence, enrichment pipeline, and tiered credential model already in place.

For tenants, this means broader, more predictable discovery of public web and news content that matches their monitored topics, with the billing and operational familiarity of Azure. For the platform, it means a second real search provider option without duplicating architecture, strengthened by deterministic endpoint fallback, URL canonicalisation, and tenant-scoped cost telemetry.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Full-text scraping of external web pages beyond the snippet returned by Bing Search API.
- Billing or reselling of Azure Search transactions (tenants provision their own Azure resource under ADR-0027).
- Client-side search query execution (search runs in the backend scheduler only).
- Trending topics (`/v7.0/news/trendingtopics`) or other non-search Bing endpoints.
- Support for user-level (Tier-1) credentials; `bing-search` is tenant-scoped only.

## 3. Context and Background
See ADR Context.
Watchlists in SocialEngage have historically acted as passive matching filters over ingested feeds such as GNews, Newswire, tenant-owned RSS, Wikipedia, and Facebook. While this reactive model works well when content already flows through the platform, it does not proactively discover web and news articles that match a tenant's bespoke watchlist queries unless those topics happen to cross public RSS or social feeds. ADR-0065 established Brave Search API as the first independent active-sourcing provider; ADR-0066 now adds the Bing Search API (Azure AI Services) as a parallel, enterprise-grade companion.

The proposed capability introduces a new `bing-search` connector that periodically queries the Bing Web Search and Bing News Search v7 endpoints for each active watchlist, validates returned candidates against the original watchlist rules, and ingests matching articles as social posts linked to the originating watchlist. The connector is designed to be functionally parallel to the existing `brave-search` connector, reusing the live polling scheduler, post-watchlist match persistence, enrichment pipeline, and tiered credential model already in place.

For tenants, this means broader, more predictable discovery of public web and news content that matches their monitored topics, with the billing and operational familiarity of Azure. For the platform, it means a second real search provider option without duplicating architecture, strengthened by deterministic endpoint fallback, URL canonicalisation, and tenant-scoped cost telemetry.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Expand active watchlist sourcing to a first-party Azure search provider | `bing-search` connector is available alongside `brave-search` and ingests validated posts for active watchlists |
| 2 | Maintain 100% watchlist-rule precision for actively sourced content | All ingested Bing-sourced candidates pass `matchesWatchlist()` or `matchesAst()` validation before persistence |
| 3 | Provide enterprise-aligned cost and quota visibility | Tenant-scoped telemetry reports API call counts, endpoint usage, candidate yield, and estimated Azure cost per watchlist |
| 4 | Preserve architectural and UI parity across search providers | Tenant-admins can connect, activate, and monitor `bing-search` using the same credential and status patterns as other connectors |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Owns connector credentials and Azure billing | High | Simple, self-service setup; clear cost telemetry; activation/deactivation controls |
| Tenant User / Analyst | Consumes posts matched to their watchlists | High | Accurate, fresh, and relevant watchlist coverage from web and news sources |
| Platform Engineer | Maintains connector and ingestion pipelines | Medium | Drop-in provider parity, clear telemetry, bounded rate limits |
| Product Owner / Menno | Sponsors the feature and owns priority | High | Enterprise-aligned provider, cost observability, minimal architectural divergence |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.22 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant User or Tenant-Admin, I want the platform to actively query the Bing Search API (Azure) for my active watchlists, validate matching news and web ar... | **Connector Implementation (`bingSearchConnector.ts`):**; **Active Watchlist Querying & Pacing Loop:**; **Deterministic Auto Endpoint Fallback (`endpoint: 'a... |
| Story 6.32 | epic-6-tenant-admin-ui.md | As Tenant Administrator, I want to connect, activate, manage, and monitor the Bing Search API connector using my organization's Azure subscription key from t... | **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**; **Connect Modal & Credential Submission (`ConnectModal`):**; **Ac... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The tenant has an active Azure subscription and can provision a Bing Search / Azure Cognitive Services resource.
- Active watchlists and the live polling scheduler already exist (Stories 1.13 and 1.14).
- Post-watchlist match persistence (`post_watchlist_matches`) is available (Story 3.11).
- The boolean AST parser is available for `boolean_query` watchlists (Story 3.6).
- The existing enrichment pipeline and telemetry infrastructure accept new provider types without structural change.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Bing-sourced posts shall be indistinguishable from other providers in post feed, filters, and analytics. | Usability | Must | UI parity is validated for `bing-search` posts, including enrichment and manual override support. |
| NFR-002 | Polling cadence shall default to 1–4 hours and be staggered per tenant to avoid throttling. | Reliability | Must | No cross-tenant 429 burst patterns observed in telemetry during connector polling. |
| NFR-003 | Tenant credentials shall be stored as Tier-2 tenant-owned credentials in `platform_credentials`. | Security | Must | Credential retrieval uses `ownerType: 'tenant'` and `tenant_admin` gating. |
| NFR-004 | The connector shall handle Azure rate limits and transient failures gracefully. | Reliability | Should | Backoff and retry logic yields no unhandled errors for 429/5xx responses. |
| NFR-005 | URL canonicalisation shall prevent duplicate ingestion across cycles and providers. | Maintainability | Must | `(tenant_id, 'bing-search', externalId)` uniqueness is not violated by repeated polls. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The tenant has an active Azure subscription and can provision a Bing Search / Azure Cognitive Services resource.
- Active watchlists and the live polling scheduler already exist (Stories 1.13 and 1.14).
- Post-watchlist match persistence (`post_watchlist_matches`) is available (Story 3.11).
- The boolean AST parser is available for `boolean_query` watchlists (Story 3.6).
- The existing enrichment pipeline and telemetry infrastructure accept new provider types without structural change.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Bing Search API costs escalate due to high polling frequency across many watchlists | Medium | High | Cap candidate count, default 1–4h cadence, tenant-scoped telemetry, and configurable activation | Product Owner |
| R-002 | Azure throttling or transient unavailability degrades ingestion | Medium | Medium | Stagger per-tenant polling and implement pacing/backoff | Platform Engineer |
| R-003 | Duplicate posts from `bing-search` and other providers | Medium | Medium | Multi-step URL canonicalisation and `(tenant_id, provider_id, external_id)` uniqueness | Platform Engineer |
| R-004 | Snippet-only results reduce enrichment quality | Medium | Medium | Pass to existing enrichment pipeline; deep text extraction remains out of scope | Product Owner |
| R-005 | Tenants without Azure resources cannot use the connector | High | Low | Clear UI messaging and ADR-0027 billing disclaimer; Brave Search remains an alternative | Product Owner |
| R-006 | Bing's index independence concerns for privacy-conscious tenants | Low | Medium | Position `bing-search` as optional companion to `brave-search`; document choice in UI | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0066-active-watchlist-sourcing-via-bing-search-api.md`
- BRD: `../Business-Requirements/BRD-0066-Active-Watchlist-Sourcing-Via-Bing-Search-API.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above