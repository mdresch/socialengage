# Business Requirements Document — Active Watchlist Sourcing via Brave Search API

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Active Watchlist Sourcing via Brave Search API — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-20 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno (Business Sponsor / Product Owner / Technical Lead) |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-20 | BRD Writer Agent | Initial draft synthesized from ADR-0065 and related user stories |
| 1.0 | 2026-08-20 | BRD Writer Agent | Approved for implementation |

---

## 2. Executive Summary

The platform's watchlists have historically been passive filters: they evaluate posts that already arrive through generic connectors such as GNews, Newswire, and tenant-owned feeds. This leaves a coverage gap—users cannot actively discover new web or news content specifically targeted at the topics and boolean queries they have chosen to monitor.

This BRD authorizes the introduction of a native `brave-search` connector that turns active watchlists into discovery agents. On each polling cycle, the connector formulates a Brave Search API query from each active watchlist, fetches structured news or web results, validates each candidate against the originating watchlist's exact matching rules, and ingests the valid results as standard social posts. Each ingested post is automatically linked to the triggering watchlist through the existing `post_watchlist_matches` junction table, is deduplicated by canonical URL, and flows through the standard Azure OpenAI enrichment pipeline for sentiment, key phrases, language detection, and grounding context.

The expected business value is proactive topic coverage, more accurate analytics for the Watchlist Coverage widget and `selectedTopic` filters, and a reduction in missed conversations without resorting to brittle web scraping. Tenant administrators retain full control through a self-service connector setup screen and direct billing with Brave, consistent with the project's credential-ownership and direct-billing policies.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable proactive discovery of web and news content for active watchlists | Brave-sourced posts appear in `GET /v1/posts?watchlistId=<id>` for active watchlists within one polling cycle |
| 2 | Close the analytics feedback loop for watchlist coverage | Watchlist Coverage widget and `selectedTopic` filters are populated with real, actively sourced data |
| 3 | Maintain the same precision as passive watchlist matching | 100% of ingested Brave-sourced posts satisfy the originating watchlist's matching rules |
| 4 | Operate within Brave Search API quota and rate limits | No HTTP 429 violations and API calls paced to the 1 req/sec ceiling |
| 5 | Provide self-service tenant administration | Tenant admins can connect, activate, and monitor the connector without engineering support |

---

## 4. Scope

### 4.1 In Scope

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

### 4.2 Out of Scope

- Full-text scraping of external web pages (deferred to a future v2 evaluation).
- Client-side execution of Brave Search queries.
- Reselling or proxying Brave Search API billing/credits.
- Bing Search, Google Programmable Search, or other search providers (covered by separate ADRs).
- Push notifications, email alerts, or real-time messaging triggered by Brave-sourced posts.
- Sub-national or city-level geocoding of discovered articles.

### 4.3 Assumptions

- Tenants obtain and manage their own Brave Search API subscription token.
- Only publicly accessible web/news URLs and snippets are ingested; no private or authenticated content.
- Watchlists are already defined and can be marked active for a tenant.
- The existing `post_watchlist_matches` junction table and `GET /v1/posts?watchlistId=<id>` filter are available.

### 4.4 Constraints

- Brave Search API free tier imposes a 2,000 requests/month limit and a 1 req/sec request ceiling.
- Connector must be quota-safe: sequential execution with a 1.2-second pacing delay and a 1–4 hour poll interval.
- The API token is a Tier-2, tenant-owned credential stored in `platform_credentials` with `owner_type: 'tenant'`.
- Brave returns snippets and metadata only; long-form article bodies are not retrieved.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Configures and activates the Brave Search connector; manages API key and budget | High | Simple, self-service setup; clear quota and status visibility |
| Tenant User / Analyst | Consumes watchlist-driven posts, coverage charts, and analytics | High | Relevant, timely, accurate content with no false positives |
| Product Owner | Owns feature prioritisation and acceptance | Medium | Measurable coverage improvement and low operational overhead |
| Platform Operations | Monitors connector health and quota across tenants | Medium | Telemetry, alerts, and graceful degradation under quota pressure |
| Brave Search (Vendor) | Provides the upstream API service | Low | Contractual, direct-billing relationship with each tenant |

---

## 6. Current State (As-Is)

**Current process:**

1. A tenant defines watchlists with keyword, hashtag, account, or boolean-query rules.
2. Posts arrive through passive ingestion connectors (GNews, Newswire, tenant-owned feeds, Wikipedia, Facebook).
3. Each post is evaluated in-process against the tenant's active watchlists.
4. Matches are persisted to `post_watchlist_matches` and exposed through server-side filters.

**Pain points:**

- Watchlists cannot find content that never crosses one of the existing generic feeds.
- Users must wait for relevant conversations to appear by chance.
- The Watchlist Coverage widget and `selectedTopic` filters can only reflect content already flowing through the platform, leaving gaps for narrowly defined or emerging topics.
- There is no first-class active web/news search capability in the connector roster.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A Tenant Administrator connects the `brave-search` connector by providing the organization's `X-Subscription-Token` and activates it.
2. On each scheduled polling cycle, the connector retrieves all active watchlists for the tenant.
3. For each active watchlist, the connector constructs a Brave Search query from the watchlist's terms or boolean expression and calls `/res/v1/news/search` (or `/res/v1/web/search` when configured) with a freshness window and pagination.
4. Requests are executed sequentially with a 1.2-second pacing delay to respect the 1 req/sec rate limit.
5. Each returned candidate (title + snippet) is validated in-process against the originating watchlist's exact matching rules.
6. Valid candidates are mapped to `SocialPost`, canonicalised by URL, and inserted with `providerId: 'brave-search'`, using the existing deduplication constraint.
7. Each successfully ingested post is linked to the originating watchlist in `post_watchlist_matches` using an idempotent, best-effort insert.
8. The post flows through the AI enrichment pipeline, producing sentiment, key phrases, detected language, and a grounding summary that explains the relevance to the watchlist.
9. Brave-sourced posts appear in the post feed, watchlist filter views, and the Watchlist Coverage analytics widget alongside posts from any other connector.

**Expected capabilities:**

- Proactive web and news discovery driven by existing watchlists.
- Identical matching precision to passive ingestion through in-process AST validation.
- Seamless integration with existing posts, filtering, enrichment, and analytics.
- Self-service setup and monitoring for tenant administrators.
- Quota-aware, rate-limited, cost-controlled operation.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Brave Search API calls shall not exceed a 1 req/sec effective rate. | Performance | Must | Pacing delay of at least 1.2 seconds between sequential requests within a poll cycle. |
| NFR-002 | The connector shall handle HTTP 429, 401, and 403 responses without data loss. | Reliability | Must | 429 triggers backoff and telemetry; 401/403 marks the connector as `failing`. |
| NFR-003 | The Brave Search API token shall be stored as a tenant-owned, encrypted credential. | Security | Must | Stored in `platform_credentials` with `owner_type: 'tenant'` and never exposed in the browser. |
| NFR-004 | The connector shall only ingest publicly accessible URLs and snippets. | Compliance | Must | No IP, audience, or private data is collected from Brave results. |
| NFR-005 | Brave-sourced posts shall be indistinguishable from native feed posts in the posts API and analytics. | Maintainability | Should | All existing filters, sorting, and aggregation endpoints work without client-side changes. |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Brave-sourced posts per watchlist | Measure active discovery coverage by watchlist | Tenant User / Analyst | Per poll cycle and daily roll-up |
| Watchlist Coverage widget | Show proportional coverage across active watchlists | Tenant User / Analyst | Real-time on dashboard |
| Brave API quota utilisation | Track spend and prevent overruns | Tenant Admin / Platform Ops | Per poll cycle |
| Connector health status | Surface `Healthy`, `Degraded`, `Failing`, or `Stalled` states | Tenant Admin / Platform Ops | Real-time |
| Validation pass-through rate | Confirm dual-discovery precision (candidates found vs. ingested) | Engineering / Product | Per poll cycle |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Brave Search API quota or cost overruns due to many active watchlists. | Medium | High | Pacing, 1–4 hour cadence, quota telemetry, and tenant-managed direct billing. | Product Owner |
| R-002 | HTTP 429 rate-limit errors if pacing is not respected. | Low | Medium | Enforced 1.2-second inter-request pacing and backoff on 429. | Engineering |
| R-003 | Snippet-only representation limits deep analysis. | High | Medium | Document limitation; defer full-text extraction to v2 evaluation. | Product Owner |
| R-004 | Boolean-query interpretation drift between Brave and the in-process evaluator. | Medium | Medium | Validate every candidate with `matchesAst()`; monitor validation rate. | Engineering |
| R-005 | New connector operational surface and failure modes. | Low | Medium | Integrate into existing connector health dashboards and alert on `Failing`/`Stalled`. | Platform Operations |
| R-006 | Tenant credential exposure or misuse. | Low | High | Tier-2 tenant ownership, encrypted credential storage, and no client-side token exposure. | Engineering |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A `brave-search` provider is registered in the connector framework and can be selected in the admin UI.
- A Tenant Administrator can connect and activate the connector with a tenant-owned `X-Subscription-Token`.
- The connector retrieves the tenant's active watchlists and issues one Brave Search query per active watchlist.
- Requests are spaced at least 1.2 seconds apart and the default poll interval is 1–4 hours.
- Each returned result is validated in-process against the originating watchlist's exact rules; only valid results are ingested.
- Ingested posts use the canonical URL as `externalId`, are deduplicated, and are mapped to the standard `SocialPost` schema.
- Each ingested Brave post is linked to its originating watchlist in `post_watchlist_matches`.
- Brave-sourced posts are returned by `GET /v1/posts?watchlistId=<id>` and flow through the AI enrichment pipeline.
- The connector status screen displays health, last attempt, last success, and polling cadence.
- HTTP 401/403 marks the connector as `failing`; HTTP 429 is handled with backoff and telemetry.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Active watchlist | A tenant watchlist that is enabled and used by a connector to proactively discover content. |
| `boolean_query` watchlist | A watchlist whose match rule is stored as an abstract syntax tree (AST) and can be translated into a search-engine query. |
| Brave Search API | A first-party web and news search index from Brave Software, accessible via structured JSON REST endpoints. |
| Canonical URL | A normalised, redirect-followed URL used as the stable `externalId` for deduplication. |
| Dual discovery and validation | The two-stage process of querying Brave for candidates and then re-evaluating each candidate against the watchlist's exact rules before ingestion. |
| Grounding | An enrichment step that explains why a discovered article matches the originating watchlist criteria. |
| `post_watchlist_matches` | Junction table persisting `(post_id, watchlist_id, tenant_id)` relationships. |
| Snippet | The short description or summary of a web/news result returned by Brave, used as the post body. |
| `X-Subscription-Token` | The API key header required to authenticate Brave Search API requests. |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0065: Active Watchlist Sourcing via Brave Search API — Polling Connector, Post Ingestion Grounding, and LLM Enrichment](../../../docs/adr/0065-active-watchlist-sourcing-via-brave-search-api.md)
- [ADR-0063: Post-Watchlist Match Persistence and Server-Side Filters](../../../docs/adr/0063-post-watchlist-match-persistence-and-server-side-filters.md)
- [ADR-0062: Analytics Dashboard Overview Enhancements](../../../docs/adr/0062-analytics-dashboard-overview-enhancements.md)
- [ADR-0028: Connector Credential Ownership Tiers](../../../docs/adr/0028-connector-credential-ownership-tiers.md)
- [ADR-0027: Direct Billing for Third-Party Connectors](../../../docs/adr/0027-direct-billing-for-third-party-connectors.md)
- [ADR-0038: Azure OpenAI Enrichment Connector](../../../docs/adr/0038-azure-openai-enrichment-connector.md)
- [ADR-0055: Post Language and Key-Phrase Enrichment](../../../docs/adr/0055-post-language-and-key-phrase-enrichment.md)
- [ADR-0018: Ingestion Lookback and Retention Cadence](../../../docs/adr/0018-ingestion-lookback-and-retention-cadence.md)

### 16.2 Related User Stories

- **Story 2.21** — *Active Watchlist Sourcing via Brave Search API: Polling connector, query transformation, and junction linking* (`epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 6.30** — *Brave Search API Connector Setup, Activation, and Status Screen* (`epic-6-tenant-admin-ui.md`)
- **Story 8.9** — *Watchlist `selectedTopic` filter and Watchlist Coverage widget* (`epic-8-analytics-dashboard.md`)

### 16.3 Missing Source Notice

No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` file was found for the `brave-search` active watchlist feature. Relevant supporting context is drawn from ADR-0065 and the related user stories listed above. The product design and deep-research briefs may be added in a future documentation pass.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-20 |
| Product Owner | Menno | | 2026-08-20 |
| Technical Lead | Menno | | 2026-08-20 |
| Other Stakeholder | | | |
