# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0067 Facebook Page Connector Reconfirmation — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0067-reconfirm-facebook-connector.md, ../Business-Requirements/BRD-0067-Reconfirm-Facebook-Connector.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0067-reconfirm-facebook-connector.md and the business requirements in BRD-0067-Reconfirm-Facebook-Connector.md into functional design for **Reconfirm Facebook Connector**.
This document captures the business requirements for reconfirming and hardening the Facebook Page connector in SocialEngage. The connector is the system's first user-delegated, OAuth-based social ingestion source. Its purpose is to pull published posts, reactions, comments, and shares from the managed Facebook Business, Brand, and Creator Pages that a tenant user administers, while leaving personal user profiles and timelines strictly outside of automated ingestion.

The reconfirmation addresses a recurring product and compliance risk: confusion between public social listening and owned Page ingestion. By making the hosting Page an explicit, first-class attribute of every ingested post and by resolving authorship through a clear two-tier hierarchy, the product gives analysts confidence about the source of each post. The work also aligns the connector with the broader platform policy of country-only geospatial normalization and with the operational health model shared by all Tier-3 OAuth connectors.

---

### 2.2 Scope
**In scope:**
- Reconfirmation of the `facebook` ingestion connector target as managed Facebook Pages only.
- Updated catalog and UI presentation: `Facebook Page` display name, subtitle, and description.
- Explicit recording of `pageId` and `pageName` on every ingested post (`rawPayload`).
- Two-tier author resolution: true `from.name` author when present and distinct from the Page; otherwise the hosting Page name.
- Tier-3, user-delegated OAuth credential model with support for multiple Page credentials per user.
- Per-user Tier-3 poll scheduling, concurrency guard, and watchdog timeout reconciliation.
- Country-level geospatial normalization aligned with ADR-0064.
- Post feed and post detail UI attribution for the hosting Page and the matched watchlist.
- Active ingestion state clarification and operational health/alerting integration.

**Out of scope:**
- Ingestion of personal Facebook user profiles, personal timelines, or friends' feeds.
- Automated public keyword search across arbitrary Facebook content.
- Facebook Groups ingestion.
- Outbound publishing from the Facebook Page connector (covered separately by ADR-0075).
- Street-level geolocation, lat/lon, or full address storage.
- Dedicated Facebook Page filtering dropdown in the post feed.

## 3. Context and Background
See ADR Context.
This document captures the business requirements for reconfirming and hardening the Facebook Page connector in SocialEngage. The connector is the system's first user-delegated, OAuth-based social ingestion source. Its purpose is to pull published posts, reactions, comments, and shares from the managed Facebook Business, Brand, and Creator Pages that a tenant user administers, while leaving personal user profiles and timelines strictly outside of automated ingestion.

The reconfirmation addresses a recurring product and compliance risk: confusion between public social listening and owned Page ingestion. By making the hosting Page an explicit, first-class attribute of every ingested post and by resolving authorship through a clear two-tier hierarchy, the product gives analysts confidence about the source of each post. The work also aligns the connector with the broader platform policy of country-only geospatial normalization and with the operational health model shared by all Tier-3 OAuth connectors.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Make the Facebook Page connector's purpose and boundaries transparent to tenants | Catalog description, connector name, and UI labels consistently use "Facebook Page" and no tenant expects public keyword search |
| 2 | Provide unambiguous source attribution for every Facebook post | Every post displayed in the feed or detail drawer shows the hosting Page and, when available, the distinct author |
| 3 | Maintain accurate authorship for organizational posts | Author identity resolves to the true creator when Graph API provides it, otherwise to the Page name |
| 4 | Preserve compliance and platform-policy alignment | No personal user timeline data is ingested; country geospatial extraction is limited to ISO 3166-1 alpha-2 codes |
| 5 | Support multi-Page administration per user | A single OAuth user can connect and manage multiple brand or regional Pages under the same tenant |
| 6 | Make ingestion state visible and actionable | Connector status, health, and stalled-run alerts are surfaced in the admin UI within 15 minutes of a hung or failed run |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant User / Analyst | Reviews posts, tracks brand mentions | High | Trust the source of each post and distinguish Page vs. author |
| Tenant Admin | Connects and manages Facebook Pages | High | Connect multiple Pages, see health, and reconnect when tokens expire |
| Content Analyst | Investigates matched watchlists and campaigns | Medium | Trace a post to its source Page and the watchlist that surfaced it |
| Compliance / Legal Advisor | Audits data handling | Medium | Confirm no personal timelines are ingested and geospatial data is country-only |
| Platform Admin | Operates the backend infrastructure | Medium | Receive stalled-run and reconnection alerts and keep ingestion healthy |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.23 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer / social listening analyst, I want `pollFacebookPage()` and `fetchFacebookPagePosts()` to extract the `from` object from Meta Graph ... | **Graph API Field Widening (`facebookConnector.ts`):**; **Hosting Page Post Dependency (`pollFacebook.ts`):**; **Two-Tier Author Resolution Hierarchy (`pollF... |
| Story 6.33 | epic-6-tenant-admin-ui.md | As Tenant User or Tenant-Admin reviewing ingested social posts, I want Facebook posts in the feed and details drawer to clearly indicate which Facebook Page ... | **Display Derivation Helpers (`postDisplay.ts`):**; **Post Card Presentation (`PostsFeedClient.tsx`):**; **Post Detail Panel & Slideover (`PostDetailPanel.ts... |
| Story 6.37 | epic-6-tenant-admin-ui.md | As Tenant Administrator or Content Analyst, I want the post feed and detail drawer to show the hosting Facebook Page for a post and the watchlist that matche... | `page.tsx` loads the caller's own connected Facebook Pages via `listFacebookPages()` and passes the list as a `facebookPages` prop to `PostsFeedClient` and `... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- The tenant user has a Facebook account with administrator access to at least one Business, Brand, or Creator Page.
- Meta grants the application `pages_show_list` and `pages_read_engagement` permissions.
- Advanced Access and Meta Business Verification are obtained for third-party tenant usage.
- The existing connector framework, Tier-3 credential storage, and per-user scheduler are already in place.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Personal Facebook timelines and friend data must never be requested, accessed, or stored | Security / Compliance | Must | No contract or log references `/{user-id}/posts`, `/me/feed`, or friends endpoints |
| NFR-002 | OAuth tokens and credentials must be encrypted at rest and never written to logs | Security | Must | Verified by credential-store audit and static log scanning |
| NFR-003 | Page ingestion must remain within Meta Graph API rate limits and honor retry/back-off headers | Performance / Reliability | Must | 429 responses trigger `Retry-After` back-off; no sustained quota violations |
| NFR-004 | Facebook posts must be normalized to the canonical `SocialPost` schema and deduplicated by `(tenant, provider, externalId)` | Maintainability | Must | Contract tests assert canonical shape and idempotent re-ingestion |
| NFR-005 | The UI connector name, description, and status must be consistent across catalog, status screen, and post feed | Usability | Must | All product-facing text uses "Facebook Page" and managed-Page language |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The tenant user has a Facebook account with administrator access to at least one Business, Brand, or Creator Page.
- Meta grants the application `pages_show_list` and `pages_read_engagement` permissions.
- Advanced Access and Meta Business Verification are obtained for third-party tenant usage.
- The existing connector framework, Tier-3 credential storage, and per-user scheduler are already in place.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Tenants expect public keyword search across all Facebook posts | Medium | High | Rename connector to "Facebook Page", update catalog description, and document scope | Product Owner |
| R-002 | Meta permission or token revocation breaks ingestion | Medium | High | Detect 190/10/100 Graph API errors, transition to `reconnect_required`, and alert the user | Engineering Lead |
| R-003 | Sparse `place` data leads to incomplete location analytics | Medium | Medium | Document country-only policy and do not rely on Facebook for robust location coverage | Product Owner |
| R-004 | Personal timeline scraping attempted in a future story or integration | Low | High | Enforce ADR-0067 invariant in connector SKILL.md and code review; no `/me/posts` references | Compliance / Engineering |
| R-005 | Multiple Pages per user create credential management complexity | Medium | Medium | Use distinct `platform_credentials` rows per Page; surface Page list in UI and status screen | Engineering Lead |

---

## 14. Appendix
- ADR: `../../adr/0067-reconfirm-facebook-connector.md`
- BRD: `../Business-Requirements/BRD-0067-Reconfirm-Facebook-Connector.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/01-multi-source-ingestion.md``
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above