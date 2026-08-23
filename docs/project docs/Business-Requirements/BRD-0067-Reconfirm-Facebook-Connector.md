# Business Requirements Document — Facebook Page Connector Reconfirmation

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Facebook Page Connector Reconfirmation – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | BRD Writer Agent | Initial draft from ADR-0067 and related user stories |
| 1.0 | 2026-08-22 | Menno | Approved following ADR-0067 acceptance |

---

## 2. Executive Summary

This document captures the business requirements for reconfirming and hardening the Facebook Page connector in SocialEngage. The connector is the system's first user-delegated, OAuth-based social ingestion source. Its purpose is to pull published posts, reactions, comments, and shares from the managed Facebook Business, Brand, and Creator Pages that a tenant user administers, while leaving personal user profiles and timelines strictly outside of automated ingestion.

The reconfirmation addresses a recurring product and compliance risk: confusion between public social listening and owned Page ingestion. By making the hosting Page an explicit, first-class attribute of every ingested post and by resolving authorship through a clear two-tier hierarchy, the product gives analysts confidence about the source of each post. The work also aligns the connector with the broader platform policy of country-only geospatial normalization and with the operational health model shared by all Tier-3 OAuth connectors.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Make the Facebook Page connector's purpose and boundaries transparent to tenants | Catalog description, connector name, and UI labels consistently use "Facebook Page" and no tenant expects public keyword search |
| 2 | Provide unambiguous source attribution for every Facebook post | Every post displayed in the feed or detail drawer shows the hosting Page and, when available, the distinct author |
| 3 | Maintain accurate authorship for organizational posts | Author identity resolves to the true creator when Graph API provides it, otherwise to the Page name |
| 4 | Preserve compliance and platform-policy alignment | No personal user timeline data is ingested; country geospatial extraction is limited to ISO 3166-1 alpha-2 codes |
| 5 | Support multi-Page administration per user | A single OAuth user can connect and manage multiple brand or regional Pages under the same tenant |
| 6 | Make ingestion state visible and actionable | Connector status, health, and stalled-run alerts are surfaced in the admin UI within 15 minutes of a hung or failed run |

---

## 4. Scope

### 4.1 In Scope

- Reconfirmation of the `facebook` ingestion connector target as managed Facebook Pages only.
- Updated catalog and UI presentation: `Facebook Page` display name, subtitle, and description.
- Explicit recording of `pageId` and `pageName` on every ingested post (`rawPayload`).
- Two-tier author resolution: true `from.name` author when present and distinct from the Page; otherwise the hosting Page name.
- Tier-3, user-delegated OAuth credential model with support for multiple Page credentials per user.
- Per-user Tier-3 poll scheduling, concurrency guard, and watchdog timeout reconciliation.
- Country-level geospatial normalization aligned with ADR-0064.
- Post feed and post detail UI attribution for the hosting Page and the matched watchlist.
- Active ingestion state clarification and operational health/alerting integration.

### 4.2 Out of Scope

- Ingestion of personal Facebook user profiles, personal timelines, or friends' feeds.
- Automated public keyword search across arbitrary Facebook content.
- Facebook Groups ingestion.
- Outbound publishing from the Facebook Page connector (covered separately by ADR-0075).
- Street-level geolocation, lat/lon, or full address storage.
- Dedicated Facebook Page filtering dropdown in the post feed.

### 4.3 Assumptions

- The tenant user has a Facebook account with administrator access to at least one Business, Brand, or Creator Page.
- Meta grants the application `pages_show_list` and `pages_read_engagement` permissions.
- Advanced Access and Meta Business Verification are obtained for third-party tenant usage.
- The existing connector framework, Tier-3 credential storage, and per-user scheduler are already in place.

### 4.4 Constraints

- Meta Graph API does not expose a public keyword-search endpoint for arbitrary posts.
- Meta Platform Terms prohibit ingesting personal user timelines for commercial monitoring.
- Page `place` data is sparse and manually tagged; most posts will not carry geospatial information.
- Long-lived Page Access Tokens must be exchanged from 60-day user tokens and stored encrypted.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Analyst | Reviews posts, tracks brand mentions | High | Trust the source of each post and distinguish Page vs. author |
| Tenant Admin | Connects and manages Facebook Pages | High | Connect multiple Pages, see health, and reconnect when tokens expire |
| Content Analyst | Investigates matched watchlists and campaigns | Medium | Trace a post to its source Page and the watchlist that surfaced it |
| Compliance / Legal Advisor | Audits data handling | Medium | Confirm no personal timelines are ingested and geospatial data is country-only |
| Platform Admin | Operates the backend infrastructure | Medium | Receive stalled-run and reconnection alerts and keep ingestion healthy |

---

## 6. Current State (As-Is)

Facebook was already integrated as SocialEngage's first OAuth `SocialConnector` and the first Tier-3, user-delegated credential in the platform. However, the original connector left several product and operational ambiguities:

**Current process:**
- A tenant user completes the OAuth flow and selects a connected Facebook Page.
- The background scheduler polls the Page and stores posts in `social_posts`.
- Posts appear in the unified feed alongside other providers.

**Pain points:**
- The connector was sometimes understood as a generic "Facebook" listening tool, creating false expectations for public search.
- The hosting Page was not a guaranteed, explicit field on every post, making it hard to trace which brand or regional Page published a post.
- Author attribution could be unclear: a post might appear to come from an individual when it was published by the Page, or vice versa.
- Personal profile versus managed Page boundaries were not spelled out in product-facing text.
- `place` data could carry coordinates or full addresses, raising privacy and compliance questions.

---

## 7. Future State (To-Be)

After this initiative, the Facebook connector is a clearly bounded, managed-Page-only ingestion source. Every post carries an explicit hosting Page and a deterministic author. The UI tells the truth: the connector is named `Facebook Page`, the catalog explains that it ingests from connected Business, Brand, and Creator Pages, and the post feed and detail drawer show the Page and the author separately.

**New or improved process:**
1. User opens the connector catalog and sees `Facebook Page` with a description of managed Page ingestion.
2. User connects via OAuth and selects one or more managed Pages.
3. The connector enters active, continuous ingestion for each selected Page.
4. Each poll run stores `rawPayload.pageId`, `rawPayload.pageName`, and resolved author based on `from.name` or Page fallback.
5. Posts flow into the feed with the platform badge, a hosting Page label, and the author attribution.
6. If a token expires or is revoked, the connector health moves to `reconnect_required` and the user is alerted.

**Expected capabilities:**
- Clear product truth around owned Page ingestion versus public listening.
- Reliable Page and author attribution across feed, detail drawer, and analytics.
- Multi-Page credential management under a single user identity.
- Privacy-safe geospatial handling (country-only).
- Operational visibility via status, health, and watchdog alerts.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall ingest posts, reactions, comments, and shares only from connected managed Facebook Pages. | Must | Connector target is `/{page-id}/posts`; no personal timeline or public search endpoints are called | Product Owner |
| BR-002 | The system shall record the hosting Facebook Page (`pageId` and `pageName`) on every ingested post. | Must | `rawPayload.pageId` and `rawPayload.pageName` are present on every Facebook post | Product Owner |
| BR-003 | The system shall resolve post authorship using a two-tier hierarchy. | Must | Author is `from.name` when provided and distinct from the Page; otherwise it is the Page name | Product Owner |
| BR-004 | The system shall support multiple managed Facebook Pages per connected user. | Should | A user can connect more than one Page, each stored as its own Tier-3 credential | Product Owner |
| BR-005 | The system shall store long-lived Page Access Tokens encrypted and detect expiry or revocation. | Must | Token revocation or expiry transitions the connector to `reconnect_required` | Product Owner |
| BR-006 | The system shall normalize any `place.country` value to an uppercase ISO 3166-1 alpha-2 code and discard coordinates or street addresses. | Must | `geoCountry` is set when `place.country` exists; no lat/lon or address is retained | Product Owner |
| BR-007 | The post feed and detail drawer shall display the hosting Page and, when present, a distinct author. | Must | UI shows Page name with a link to the Page and a separate author line if different | Product Owner |
| BR-008 | The post feed and detail drawer shall show the watchlist that surfaced a Facebook post. | Should | Matched watchlist chip or label is visible and links to the watchlist list | Product Owner |
| BR-009 | The system shall prevent overlapping ingestion runs for the same tenant, user, and Facebook connector. | Should | Concurrency guard blocks a second tick while one is already in flight | Product Owner |
| BR-010 | The system shall reconcile ingestion runs that exceed a 15-minute timeout and surface a stalled alert. | Must | Runs over 15 minutes are reconciled and a stalled alert is emitted (ADR-0070) | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Personal Facebook timelines and friend data must never be requested, accessed, or stored | Security / Compliance | Must | No contract or log references `/{user-id}/posts`, `/me/feed`, or friends endpoints |
| NFR-002 | OAuth tokens and credentials must be encrypted at rest and never written to logs | Security | Must | Verified by credential-store audit and static log scanning |
| NFR-003 | Page ingestion must remain within Meta Graph API rate limits and honor retry/back-off headers | Performance / Reliability | Must | 429 responses trigger `Retry-After` back-off; no sustained quota violations |
| NFR-004 | Facebook posts must be normalized to the canonical `SocialPost` schema and deduplicated by `(tenant, provider, externalId)` | Maintainability | Must | Contract tests assert canonical shape and idempotent re-ingestion |
| NFR-005 | The UI connector name, description, and status must be consistent across catalog, status screen, and post feed | Usability | Must | All product-facing text uses "Facebook Page" and managed-Page language |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | The `facebook` connector may only ingest from managed Business, Brand, or Creator Pages connected by the authenticated user. |
| BRU-002 | Personal user profile timelines, friend feeds, and private account data are strictly excluded from background ingestion. |
| BRU-003 | If Meta Graph API returns a `from` object with a name and an `id` different from the Page ID, the post author is the `from.name` value. |
| BRU-004 | If `from` is absent, restricted, or `from.id` equals the Page ID, the post author is the hosting Page name. |
| BRU-005 | Every ingested Facebook post must store `rawPayload.pageId` and `rawPayload.pageName` as an explicit dependency on the hosting Page. |
| BRU-006 | Geospatial data extracted from `place` may only include the ISO 3166-1 alpha-2 country code; coordinates and street addresses must be discarded. |
| BRU-007 | A Facebook Page credential is a Tier-3 user-delegated credential with `owner_type = 'user'`. |
| BRU-008 | The connector is considered actively ingesting when at least one valid Page credential is authenticated; paused only when no credentials are active or the user explicitly deactivates it. |
| BRU-009 | Expired or revoked Page Access Tokens must transition the connector health to `reconnect_required` and prompt the user to reauthorize. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `rawPayload.pageId` | Meta ID of the hosting Facebook Page | Graph API `pageMeta.id` | Tenant User / Platform | Public / Business |
| `rawPayload.pageName` | Display name of the hosting Page | Graph API `pageMeta.name` or `from` fallback | Tenant User / Platform | Public / Business |
| `rawPayload.author` | Resolved author display name (true author or Page name) | Graph API `from.name` or `pageMeta.name` | Tenant User / Platform | Public / Business |
| `rawPayload.from` | Optional `from` object returned by Graph API | Graph API post fields | Tenant User / Platform | Public / Business |
| `externalId` | Graph API post ID (`{pageId}_{postId}`) | Graph API `id` | Platform | Public / Business |
| `geoCountry` | ISO 3166-1 alpha-2 country code if `place.country` is present | Graph API `place.country` | Platform | Public |
| `geoCountryName` | Country name from normalized ADR-0064 mapping | Derived from `geoCountry` | Platform | Public |
| `reactions.total_count` | Reaction count summary | Graph API `reactions.summary.total_count` | Platform | Public / Business |
| `comments.summary.total_count` | Comment count summary | Graph API `comments.summary.total_count` | Platform | Public / Business |
| `shares.count` | Share count | Graph API `shares` | Platform | Public / Business |
| Page Access Token | Long-lived token for a selected Page | OAuth token exchange | Tenant User | High – encrypted at rest |
| `platform_credentials` row | Credential record with `owner_type = 'user'`, `provider_id = 'facebook'`, `scope = 'user'` | Connector setup flow | Tenant User / Platform | High |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Facebook Page connector health | Show active, paused, reconnect_required, or stalled states | Tenant Admin / Platform Admin | Real-time / on dashboard load |
| Posts by Facebook Page | Volume per connected Page for source coverage analysis | Tenant User / Analyst | Per ingestion run / on demand |
| Matched watchlist attribution | Trace which watchlist surfaced a Facebook post | Content Analyst | On demand (post detail) |
| Engagement summary (reactions, comments, shares) | Surface audience engagement per Page post | Tenant User / Analyst | Per post / dashboard aggregation |
| Ingestion run duration and outcome | Operational health and troubleshooting | Platform Admin / Tenant Admin | Per run / dashboard |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Tenants expect public keyword search across all Facebook posts | Medium | High | Rename connector to "Facebook Page", update catalog description, and document scope | Product Owner |
| R-002 | Meta permission or token revocation breaks ingestion | Medium | High | Detect 190/10/100 Graph API errors, transition to `reconnect_required`, and alert the user | Engineering Lead |
| R-003 | Sparse `place` data leads to incomplete location analytics | Medium | Medium | Document country-only policy and do not rely on Facebook for robust location coverage | Product Owner |
| R-004 | Personal timeline scraping attempted in a future story or integration | Low | High | Enforce ADR-0067 invariant in connector SKILL.md and code review; no `/me/posts` references | Compliance / Engineering |
| R-005 | Multiple Pages per user create credential management complexity | Medium | Medium | Use distinct `platform_credentials` rows per Page; surface Page list in UI and status screen | Engineering Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0059 – Facebook Page connector scope | Architecture | Menno | Accepted |
| D-002 | ADR-0060 – Multiple Pages per user | Architecture | Menno | Accepted |
| D-003 | ADR-0061 – Tier-3 per-user poll scheduler | Architecture | Menno | Accepted |
| D-004 | ADR-0064 – Country-level geospatial normalization | Architecture | Menno | Accepted |
| D-005 | ADR-0070 – Watchdog reconciliation and stalled alerts | Architecture | Menno | Accepted |
| D-006 | Story 2.15 – Facebook connector backend implementation | Delivery | Engineering | Implemented |
| D-007 | Story 2.23 – Graph API `from` extraction and Page dependency | Delivery | Engineering | Implemented |
| D-008 | Story 6.33 – Facebook Page attribution in post feed | Delivery | Engineering | Implemented |
| D-009 | Story 6.37 – Post feed and detail Page & watchlist attribution | Delivery | Engineering | Built 2026-08-22 |
| D-010 | Meta Graph API v21.0 (or current LTS) availability | External | Meta | Already available |

---

## 14. Acceptance Criteria

1. The `facebook` connector is presented in the UI as `Facebook Page` with the agreed catalog description and subtitle.
2. Every ingested Facebook post persists `rawPayload.pageId` and `rawPayload.pageName`.
3. Author resolution follows the two-tier hierarchy: `from.name` when present and distinct from the Page; otherwise the Page name.
4. The post feed and detail drawer display the hosting Page name with a link to the Page and, when present, the distinct author.
5. The matched watchlist for a Facebook post is rendered in the feed and detail drawer.
6. `place` data, when present, is limited to an ISO 3166-1 alpha-2 country code; coordinates and addresses are discarded.
7. Expired or revoked Page Access Tokens transition the connector to `reconnect_required` and raise the appropriate alert.
8. Ingestion runs for the same tenant/user/connector do not overlap, and runs exceeding 15 minutes are reconciled and alerted.

---

## 15. Glossary

| Term | Definition |
|---|---|
| Facebook Page | A managed Business, Brand, Creator, or public Page on Facebook, distinct from a personal user profile. |
| Personal User Profile | An individual Facebook account and its timeline, friends, and private content. |
| Page Access Token | A long-lived OAuth token used to call Graph API on behalf of a specific Facebook Page. |
| Tier-3 credential | A user-delegated credential in `platform_credentials` with `owner_type = 'user'`. |
| Two-tier author resolution | The deterministic hierarchy that chooses the true `from.name` author first and falls back to the Page name. |
| Hosting Page | The Facebook Page on which a post was published, recorded by `pageId` and `pageName`. |
| Graph API `from` object | The optional object returned by Meta Graph API containing the name and id of the individual or Page that authored a post. |
| Managed Page Ingestion | The ingestion model that only collects content from Pages the authenticated user administers. |
| Web Intent | A browser-based sharing flow used for personal profile sharing, not for background ingestion. |

---

## 16. Appendices

### 16.1 Reference Documents

- `docs/adr/0067-reconfirm-facebook-connector.md` (source ADR)
- `docs/adr/0059-facebook-connector-scope.md` (original Facebook Page scope)
- `docs/adr/0060-facebook-multiple-pages.md` (multiple Pages per user)
- `docs/adr/0061-tier-3-poll-scheduler.md` (per-user scheduling)
- `docs/adr/0064-country-geospatial-normalization.md` (geospatial policy)
- `docs/adr/0070-watchdog-reconciliation.md` (watchdog and stalled alerts)
- `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` – Story 2.23
- `docs/user-stories/epic-6-tenant-admin-ui.md` – Story 6.33 and Story 6.37

### 16.2 Missing Source Materials

- No dedicated `docs/product-research/feature-designs/<feature>.md` file specifically for ADR-0067 was referenced or found. The business context above is derived from the ADR, the epic-2 and epic-6 user stories, and the multi-source ingestion feature design (`docs/product-research/feature-designs/01-multi-source-ingestion.md`).
- No `docs/product-research/reports/<feature>-deep-research.md` file was located for the Facebook Page reconfirmation scope.

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-22 |
| Product Owner | Menno | | 2026-08-22 |
| Technical Lead | Menno | | 2026-08-22 |
| Other Stakeholder | | | |
