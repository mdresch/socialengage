# Business Requirements Document — Active Watchlist Sourcing via Brave Search API

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Active Watchlist Sourcing via Brave Search API |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0065-active-watchlist-sourcing-via-brave-search-api.md, ../Business-Requirements/BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0065-active-watchlist-sourcing-via-brave-search-api.md and the business requirements in BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md into functional design for **Active Watchlist Sourcing Via Brave Search API**.
The platform's watchlists have historically been passive filters: they evaluate posts that already arrive through generic connectors such as GNews, Newswire, and tenant-owned feeds. This leaves a coverage gap—users cannot actively discover new web or news content specifically targeted at the topics and boolean queries they have chosen to monitor.

This BRD authorizes the introduction of a native `brave-search` connector that turns active watchlists into discovery agents. On each polling cycle, the connector formulates a Brave Search API query from each active watchlist, fetches structured news or web results, validates each candidate against the originating watchlist's exact matching rules, and ingests the valid results as standard social posts. Each ingested post is automatically linked to the triggering watchlist through the existing `post_watchlist_matches` junction table, is deduplicated by canonical URL, and flows through the standard Azure OpenAI enrichment pipeline for sentiment, key phrases, language detection, and grounding context.

The expected business value is proactive topic coverage, more accurate analytics for the Watchlist Coverage widget and `selectedTopic` filters, and a reduction in missed conversations without resorting to brittle web scraping. Tenant administrators retain full control through a self-service connector setup screen and direct billing with Brave, consistent with the project's credential-ownership and direct-billing policies.

---

### 2.2 Scope
**In scope:**
- A new `brave-search` provider connector registered in the connector framework.
- Active watchlist query generation for `keyword`, `hashtag`, `account`, and `boolean_query` match types.
- Dual discovery and validation: Brave result candidates are evaluated against the originating watchlist's exact rules before ingestion.
- Mapping of Brave Search result fields to the canonical `SocialPost` / `SocialPostSummary` schema.
- URL canonicalisation and tenant-scoped deduplication using `(tenant_id, providerId, externalId)`.
- Automatic, best-effort insertion of `post_watchlist_matches` rows for the triggering watchlist.
- Grounding and AI enrichment of Brave-sourced posts through the existing enrichment pipeline.
- Polling cadence of 1–4 hours configurable per tenant, with a 1.2-second pacing delay between requests.
- Tenant administrator connector setup, activation, and status screen in the admin UI.
- Quota and error telemetry exposed in connector health dashboards.

**Out of scope:**
- Full-text scraping of external web pages (deferred to a future v2 evaluation).
- Client-side execution of Brave Search queries.
- Reselling or proxying Brave Search API billing/credits.
- Bing Search, Google Programmable Search, or other search providers (covered by separate ADRs).
- Push notifications, email alerts, or real-time messaging triggered by Brave-sourced posts.
- Sub-national or city-level geocoding of discovered articles.

## 3. Context and Background
See ADR Context.
The platform's watchlists have historically been passive filters: they evaluate posts that already arrive through generic connectors such as GNews, Newswire, and tenant-owned feeds. This leaves a coverage gap—users cannot actively discover new web or news content specifically targeted at the topics and boolean queries they have chosen to monitor.

This BRD authorizes the introduction of a native `brave-search` connector that turns active watchlists into discovery agents. On each polling cycle, the connector formulates a Brave Search API query from each active watchlist, fetches structured news or web results, validates each candidate against the originating watchlist's exact matching rules, and ingests the valid results as standard social posts. Each ingested post is automatically linked to the triggering watchlist through the existing `post_watchlist_matches` junction table, is deduplicated by canonical URL, and flows through the standard Azure OpenAI enrichment pipeline for sentiment, key phrases, language detection, and grounding context.

The expected business value is proactive topic coverage, more accurate analytics for the Watchlist Coverage widget and `selectedTopic` filters, and a reduction in missed conversations without resorting to brittle web scraping. Tenant administrators retain full control through a self-service connector setup screen and direct billing with Brave, consistent with the project's credential-ownership and direct-billing policies.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable proactive discovery of web and news content for active watchlists | Brave-sourced posts appear in `GET /v1/posts?watchlistId=<id>` for active watchlists within one polling cycle |
| 2 | Close the analytics feedback loop for watchlist coverage | Watchlist Coverage widget and `selectedTopic` filters are populated with real, actively sourced data |
| 3 | Maintain the same precision as passive watchlist matching | 100% of ingested Brave-sourced posts satisfy the originating watchlist's matching rules |
| 4 | Operate within Brave Search API quota and rate limits | No HTTP 429 violations and API calls paced to the 1 req/sec ceiling |
| 5 | Provide self-service tenant administration | Tenant admins can connect, activate, and monitor the connector without engineering support |

---

**Positive consequences (from ADR):**
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

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide a `brave-search` connector that implements the existing `SocialConnector` provider framework. | Must | Registered in `connectorRegistry.ts` with `providerId: 'brave-search'`, `authMode: 'api_key'`, and `deliveryMode: 'poll'`. | Engineering |
| BR-002 | The system shall generate Brave Search queries from each active tenant watchlist based on its `matchType`. | Must | `keyword`/`hashtag`/`account` terms are formatted as an OR expression; `boolean_query` watchlists pass a Brave-compatible formatted string. | Engineering |
| BR-003 | The system shall validate every Brave result candidate against the originating watchlist's rules before ingestion. | Must | Only candidates satisfying `matchesWatchlist()` or `matchesAst()` are ingested; no false positives are persisted. | Engineering |
| BR-004 | The system shall map each accepted Brave result to the canonical `SocialPost` schema and canonicalise the URL for `externalId`. | Must | `externalId` equals the normalised canonical URL; duplicate `(tenant_id, 'brave-search', externalId)` rows are not created. | Engineering |
| BR-005 | The system shall link each ingested Brave-sourced post to the originating watchlist in `post_watchlist_matches`. | Must | `insertPostWatchlistMatches()` is called idempotently and does not block ingestion on failure. | Engineering |
| BR-006 | The system shall pass Brave-sourced posts through the existing AI enrichment pipeline with an explicit grounding pass. | Must | Enrichment outputs sentiment, key phrases, detected language, and a grounding context for the watchlist. | Engineering |
| BR-007 | The system shall allow a Tenant Administrator to connect, activate, and monitor the Brave Search connector from the admin UI. | Must | Setup screen captures `X-Subscription-Token`, submits with `ownerType: 'tenant'`, and shows health/polling status. | Engineering |
| BR-008 | The system shall support a configurable 1–4 hour polling cadence and 1.2-second intra-poll pacing. | Should | Default interval and pacing are enforced; no HTTP 429 is triggered under normal load. | Engineering |
| BR-009 | The system shall expose quota and health telemetry for the `brave-search` connector. | Should | Connector status view displays last attempt, last success, poll interval, and a health badge. | Engineering |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Configures and activates the Brave Search connector; manages API key and budget | High | Simple, self-service setup; clear quota and status visibility |
| Tenant User / Analyst | Consumes watchlist-driven posts, coverage charts, and analytics | High | Relevant, timely, accurate content with no false positives |
| Product Owner | Owns feature prioritisation and acceptance | Medium | Measurable coverage improvement and low operational overhead |
| Platform Operations | Monitors connector health and quota across tenants | Medium | Telemetry, alerts, and graceful degradation under quota pressure |
| Brave Search (Vendor) | Provides the upstream API service | Low | Contractual, direct-billing relationship with each tenant |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.21 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant User or Tenant-Admin, I want the platform to actively query the Brave Search API for my active watchlists, validate matching articles, and ingest t... | **Connector Implementation (`braveSearchConnector.ts`):**; **Active Watchlist Querying & Pacing Loop:**; **Dual Discovery & Validation Filter:**; **Publicati... |
| Story 6.30 | epic-6-tenant-admin-ui.md | As Tenant Administrator, I want to connect, activate, manage, and monitor the Brave Search API connector using my organization's Brave API key from the admin... | **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**; **Connect Modal & Credential Submission (`ConnectModal`):**; **Ac... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| Active watchlists (`watchlists`) | Match rules (`matchType`, `terms`, `boolean_query`) and active flag for the tenant. | `social-listening-core` database | Tenant Admin | Tenant-confidential |
| Brave API token (`platform_credentials`) | `X-Subscription-Token` stored as a Tier-2 tenant credential. | Tenant Admin entry in UI | Tenant Admin | High (secret) |
| Brave Search result | Structured JSON with `url`, `title`, `description`/`snippet`, `age`/`published`, `source`/`domain`, and optional `language`. | Brave Search API | Brave (vendor) | Public web content |
| `SocialPost` row (`social_posts`) | Canonical post record with `externalId` = canonical URL, `providerId: 'brave-search'`, title, body, publishedAt, source, and enrichment. | `brave-search` connector | System | Tenant-scoped |
| `post_watchlist_matches` | Junction rows linking each ingested Brave post to its originating watchlist. | `brave-search` connector | System | Tenant-scoped |
| `post_enrichments` | Grounding context, sentiment, key phrases, and detected language. | Azure OpenAI enrichment | System | Tenant-scoped |
| Connector telemetry | Call counts, quota usage, health, and last success/failure timestamps. | `brave-search` connector / scheduler | Platform Operations | Operational |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Only watchlists marked `active` for the tenant are used for Brave Search discovery. |
| BRU-002 | `keyword`/`hashtag`/`account` watchlists are translated into an OR expression of quoted terms for Brave Search. |
| BRU-003 | `boolean_query` watchlists may be passed directly to Brave using a syntax-compatible formatting of the stored AST. |
| BRU-004 | Every Brave result candidate must pass the originating watchlist's exact rule evaluation before it is ingested. |
| BRU-005 | The source domain is treated as the canonical `Author` for the ingested post. |
| BRU-006 | The Brave Search API token is a Tier-2, tenant-owned credential; the tenant contracts directly with Brave. |
| BRU-007 | Default active watchlist polling cadence is 1–4 hours, with a 1.2-second pacing delay between requests. |
| BRU-008 | `post_watchlist_matches` insertion is best-effort and must never block post ingestion. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0063 — `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId=<id>` filter | Internal | Engineering | Already Accepted (2026-08-19) |
| D-002 | ADR-0062 — Analytics Dashboard Overview enhancements and Watchlist Coverage widget | Internal | Engineering | Already Accepted (2026-08-19) |
| D-003 | ADR-0028 — Tier-2 credential ownership (`owner_type: 'tenant'`) | Internal | Engineering | Already Accepted |
| D-004 | ADR-0027 — Direct billing: tenants contract directly with Brave | Internal / Commercial | Product Owner | Already Accepted |
| D-005 | ADR-0038 — Azure OpenAI enrichment pipeline | Internal | Engineering | Already Built |
| D-006 | ADR-0055 — Language detection and enrichment schema | Internal | Engineering | Already Accepted |
| D-007 | ADR-0018 — Ingestion lookback and retention cadence | Internal | Engineering | Already Accepted |
| D-008 | Story 2.21 — `brave-search` backend connector | Internal | Engineering | Implemented |
| D-009 | Story 6.30 — Brave Search admin UI connector setup and status | Internal | Engineering | Implemented |
| D-010 | Brave Search API subscription and terms of service | External | Tenant / Product Owner | Tenant obtains token before use |

---

- Tenants obtain and manage their own Brave Search API subscription token.
- Only publicly accessible web/news URLs and snippets are ingested; no private or authenticated content.
- Watchlists are already defined and can be marked active for a tenant.
- The existing `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId=<id>` filter are available.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Brave Search API calls shall not exceed a 1 req/sec effective rate. | Performance | Must | Pacing delay of at least 1.2 seconds between sequential requests within a poll cycle. |
| NFR-002 | The connector shall handle HTTP 429, 401, and 403 responses without data loss. | Reliability | Must | 429 triggers backoff and telemetry; 401/403 marks the connector as `failing`. |
| NFR-003 | The Brave Search API token shall be stored as a tenant-owned, encrypted credential. | Security | Must | Stored in `platform_credentials` with `owner_type: 'tenant'` and never exposed in the browser. |
| NFR-004 | The connector shall only ingest publicly accessible URLs and snippets. | Compliance | Must | No IP, audience, or private data is collected from Brave results. |
| NFR-005 | Brave-sourced posts shall be indistinguishable from native feed posts in the posts API and analytics. | Maintainability | Should | All existing filters, sorting, and aggregation endpoints work without client-side changes. |

---

## 11. Error Handling and Exceptions
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

## 12. Assumptions and Dependencies
- Tenants obtain and manage their own Brave Search API subscription token.
- Only publicly accessible web/news URLs and snippets are ingested; no private or authenticated content.
- Watchlists are already defined and can be marked active for a tenant.
- The existing `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId=<id>` filter are available.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Brave Search API quota or cost overruns due to many active watchlists. | Medium | High | Pacing, 1–4 hour cadence, quota telemetry, and tenant-managed direct billing. | Product Owner |
| R-002 | HTTP 429 rate-limit errors if pacing is not respected. | Low | Medium | Enforced 1.2-second inter-request pacing and backoff on 429. | Engineering |
| R-003 | Snippet-only representation limits deep analysis. | High | Medium | Document limitation; defer full-text extraction to v2 evaluation. | Product Owner |
| R-004 | Boolean-query interpretation drift between Brave and the in-process evaluator. | Medium | Medium | Validate every candidate with `matchesAst()`; monitor validation rate. | Engineering |
| R-005 | New connector operational surface and failure modes. | Low | Medium | Integrate into existing connector health dashboards and alert on `Failing`/`Stalled`. | Platform Operations |
| R-006 | Tenant credential exposure or misuse. | Low | High | Tier-2 tenant ownership, encrypted credential storage, and no client-side token exposure. | Engineering |

---

## 14. Appendix
- ADR: `../../adr/0065-active-watchlist-sourcing-via-brave-search-api.md`
- BRD: `../Business-Requirements/BRD-0065-Active-Watchlist-Sourcing-Via-Brave-Search-API.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above