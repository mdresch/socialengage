# Business Requirements Document (BRD) – Instagram Business Connector

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) – Instagram Business Connector |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0068-instagram-connector.md, ../Business-Requirements/BRD-0068-Instagram-Connector.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0068-instagram-connector.md and the business requirements in BRD-0068-Instagram-Connector.md into functional design for **Instagram Connector**.
Instagram is a high-impact visual channel for brand campaigns, product launches, and creator partnerships. To date, Social Listening / Insights has not had a compliant, native ingestion path for Instagram content, leaving a significant gap in owned-and-managed visual channel coverage. The Instagram Business Connector addresses this by adding a Meta Graph API-based ingestion source for connected Instagram Business and Creator accounts.

The proposed solution is a Tier-3 OAuth connector (`providerId: instagram`) that discovers accounts through a user's linked Facebook Pages, ingests published photos, videos, Reels, and carousels, and presents them in the post feed and detail drawer with clear hosting account attribution. The connector enforces strict privacy and platform-compliance boundaries: personal Instagram accounts and timeline scraping are excluded, and ephemeral 24-hour Stories are out of scope.

Business value includes richer owned-channel listening, a clean single-row carousel model that prevents analytics double-counting, bounded historical ingestion that protects API quotas, and deterministic error reclassification that keeps credential health transparent to users.

---

### 2.2 Scope
**In scope:**
- Native `instagram` ingestion connector in `social-listening-core` using the Meta Graph API `/media` endpoint.
- Ingestion of published Instagram Business and Creator account content: single photos, videos (including Reels), and carousel albums.
- Tier-3 user-delegated OAuth 2.0 credential storage (`owner_type = 'user'`), tenant-scoped.
- Automatic discovery of Instagram Business/Creator accounts linked to a user's administered Facebook Pages.
- Multi-account selection and registration in the admin UI.
- Single-row `SocialPostSummary` modeling for each media object, with ordered `rawPayload.children` for carousels (capped at 10).
- Canonical Markdown caption normalization with deterministic media-type fallback when captions are empty.
- Author mapping with `instagram:{igUserId}` identifiers and `username` display.
- Country-level geospatial extraction when `location.country` is present (per ADR-0064).
- Bounded initial and incremental polling: 30-day or 100-item lookback ceiling, newest-first pagination, and existing-ID short-circuit.
- Sequential multi-account polling with 1.2s inter-account jitter and `Retry-After` / exponential-backoff rate-limit handling.
- Deterministic reclassification of Graph API errors `190`, `10`, and `100` to `reconnect_required` health status and `ConnectorIngestionAlertEvent` alerts.
- Admin UI connector status, health badges, on-demand re-sync, post feed cards, and detail drawer presentation for Instagram Business posts.

**Out of scope:**
- Ingestion of personal Instagram accounts or personal timeline feeds.
- Instagram Stories (24-hour ephemeral content).
- Public hashtag or profile scraping without tokens.
- Direct publishing, replying, or outbound engagement from the admin UI.
- Periodic background engagement re-sync (deferred to a future v2 refresh story).
- Granular geolocation beyond country ISO alpha-2.

## 3. Context and Background
See ADR Context.
Instagram is a high-impact visual channel for brand campaigns, product launches, and creator partnerships. To date, Social Listening / Insights has not had a compliant, native ingestion path for Instagram content, leaving a significant gap in owned-and-managed visual channel coverage. The Instagram Business Connector addresses this by adding a Meta Graph API-based ingestion source for connected Instagram Business and Creator accounts.

The proposed solution is a Tier-3 OAuth connector (`providerId: instagram`) that discovers accounts through a user's linked Facebook Pages, ingests published photos, videos, Reels, and carousels, and presents them in the post feed and detail drawer with clear hosting account attribution. The connector enforces strict privacy and platform-compliance boundaries: personal Instagram accounts and timeline scraping are excluded, and ephemeral 24-hour Stories are out of scope.

Business value includes richer owned-channel listening, a clean single-row carousel model that prevents analytics double-counting, bounded historical ingestion that protects API quotas, and deterministic error reclassification that keeps credential health transparent to users.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Expand visual social channel coverage | Instagram Business and Creator posts appear in the post feed alongside Facebook, Wikipedia, and news sources |
| 2 | Maintain platform compliance and data privacy | Zero ingestion of personal Instagram accounts or unauthorized scraping; all access via Meta Graph API with user-delegated OAuth |
| 3 | Improve operational clarity for Instagram credentials | `reconnect_required` alerts are raised within one polling tick for invalid/expired tokens, permission revocation, or unlinked accounts |
| 4 | Protect API quotas and scheduler stability | Initial ingestion completes within bounded limits (30 days or 100 posts, whichever is reached first); rate-limit responses are honored |
| 5 | Deliver accurate attribution and engagement visibility | Every Instagram post displays the hosting `@username`, parent Facebook Page, like count, and comment count |

---

## 5. Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall provide an `instagram` ingestion connector registered as `Instagram Business` in the platform catalog. | Must | Platform ID `instagram`, display name `Instagram Business`, subtitle `Meta Graph API Ingestion Source`, description matches ADR-0068. | Product Owner |
| BR-002 | The system shall authenticate via Meta OAuth with `instagram_basic`, `pages_show_list`, and `pages_read_engagement` scopes. | Must | OAuth initiation and callback flow complete; credentials stored with `owner_type = 'user'`. | Product Owner |
| BR-003 | The system shall discover and display all Instagram Business/Creator accounts linked to the authenticating user's Facebook Pages. | Must | Modal lists account avatar, `@username`, parent Facebook Page name, and allows selection. | Product Owner |
| BR-004 | The system shall ingest published Instagram media (`IMAGE`, `VIDEO`, `CAROUSEL_ALBUM`) from selected accounts. | Must | `GET /{ig-user-id}/media` returns photos, videos/Reels, and carousels. | Product Owner |
| BR-005 | The system shall create exactly one `SocialPostSummary` row per media item. | Must | `externalId` format: `instagram_{igUserId}_{mediaId}`; no duplicate rows for the same media. | Technical Lead |
| BR-006 | The system shall store carousel child media in original display order, capped at 10 children. | Must | `rawPayload.children` preserved order; `rawPayload.childrenTruncated = true` if > 10. | Technical Lead |
| BR-007 | The system shall convert captions to canonical Markdown and fall back to a media-type summary when empty. | Must | `[Instagram Photo]`, `[Instagram Video]`, or `[Instagram Carousel]` used when `caption` is empty. | Product Owner |
| BR-008 | The system shall map the author to `instagram:{igUserId}` with `username` as display name. | Must | `author.id`, `author.username`, and `author.displayName` populated correctly. | Technical Lead |
| BR-009 | The system shall extract country-level geospatial data when a location is provided. | Must | `geoCountry` set to uppercase ISO 3166-1 alpha-2 when `location.country` exists; `geoSource: 'post'`; coordinates discarded. | Technical Lead |
| BR-010 | The system shall halt ingestion at the first already-seen `externalId` during incremental polling. | Must | Newest-first pagination short-circuits on existing ID. | Technical Lead |
| BR-011 | The system shall enforce a 30-day or 100-item lookback ceiling on initial ingestion. | Must | Pagination stops when the oldest item is > 30 days old or 100 items are fetched, whichever comes first. | Technical Lead |
| BR-012 | The system shall reclassify Graph API errors `190`, `10`, and `100` to `reconnect_required`. | Must | Health status, account row flag, and `ConnectorIngestionAlertEvent` emitted. | Technical Lead |
| BR-013 | The admin UI shall display the hosting Instagram account handle on post cards and in the detail drawer. | Must | Post card shows `Instagram Business` badge and `📍 @username`; detail drawer shows hosting account and parent Page. | Product Owner |
| BR-014 | The admin UI shall render carousel galleries and engagement counters. | Must | Carousel gallery uses `rawPayload.children`; `childrenTruncated` shows link to `url`; like and comment counts visible. | Product Owner |

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant Administrator | Configures Instagram connector for the tenant | High | Simple OAuth flow, multi-account picker, and clear health status |
| Social Listening Analyst | Reviews ingested Instagram posts and engagement | High | Accurate attribution, readable captions, and carousel/reel previews |
| Product Owner | Owns roadmap and scope decisions | Medium | Compliant, bounded, and measurable connector delivery |
| Technical Lead | Oversees backend implementation and health | Medium | Stable scheduler, deterministic errors, and quota protection |
| Meta / Platform Compliance | External policy constraint | High | No unauthorized scraping or personal-account access |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.24 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer / social listening analyst, I want a dedicated `instagram` ingestion connector in `social-listening-core` that queries the Instagram... | **Instagram Connector Client (`instagramConnector.ts`):**; **Lookback Bounds Precedence & Incremental Halting:**; **Single-Row Carousel Modeling & Gallery Pe... |
| Story 6.34 | epic-6-tenant-admin-ui.md | As Tenant Administrator or User, I want to connect our organization's Instagram Business and Creator accounts via Meta OAuth, select which accounts to ingest... | **Platform Definition & Branding (`ConnectorsClient.tsx` & `ConnectorStatusClient.tsx`):**; **OAuth Connect Flow & Multi-Account Picker Modal (`InstagramAcco... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials` row (Tier-3) | Encrypted long-lived Page Access Token for Instagram polling | Meta OAuth callback | Tenant User | High (token) |
| `instagram_connected_accounts` | Selected Instagram Business accounts with reconnect status | User selection in account picker | Tenant User | Medium |
| `social_posts` row | Ingested Instagram media as `SocialPostSummary` | Meta Graph API `/media` | System | Low–Medium |
| `externalId` | `instagram_{igUserId}_{mediaId}` | Derived from Meta `id` and `igUserId` | System | Low |
| `rawPayload.igUserId` | Hosting Instagram Business user ID | Meta `instagram_business_account.id` | System | Low |
| `rawPayload.username` | Instagram handle | Meta `username` | System | Low |
| `rawPayload.pageName` | Parent Facebook Page name | Meta `me/accounts` | System | Low |
| `rawPayload.mediaType` | `IMAGE`, `VIDEO`, or `CAROUSEL_ALBUM` | Meta `media_type` | System | Low |
| `rawPayload.mediaUrl` / `rawPayload.thumbnailUrl` | Best-effort preview URLs | Meta `media_url` / `thumbnail_url` | System | Low |
| `rawPayload.children` | Ordered child media for carousels | Meta `children.data` | System | Low |
| `rawPayload.childrenTruncated` | Flag when carousel exceeds 10 children | Derived | System | Low |
| `rawPayload.like_count` / `rawPayload.comments_count` | Aggregate engagement counts | Meta `like_count`, `comments_count` | System | Low |
| `geoCountry` | Country ISO alpha-2 | Meta `location.country` (if present) | System | Low |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Instagram Business and Creator accounts are the only ingestible Instagram account types; personal accounts are explicitly excluded. |
| BRU-002 | Each Instagram Business/Creator account is discovered through a linked Facebook Page administered by the authenticating user. |
| BRU-003 | Instagram credentials are Tier-3 (`owner_type = 'user'`) and tenant-scoped; a user can connect multiple accounts. |
| BRU-004 | Graph API errors `190`, `10`, and `100` immediately trigger `reconnect_required` status and alert emission. |
| BRU-005 | Carousel albums are represented as one post row with up to 10 ordered child media items in `rawPayload.children`. |
| BRU-006 | Media URLs (`media_url`, `thumbnail_url`) are best-effort preview URLs; the canonical `permalink` is the permanent content reference. |
| BRU-007 | Geospatial extraction is limited to country ISO alpha-2; raw coordinates are discarded. |
| BRU-008 | Initial ingestion is bounded by the first of: oldest item > 30 days old, or 100 total items fetched. |

---

## 9. Interfaces and Integrations
| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0059 (Facebook Page connector scope) | Source / Predecessor | Menno | Accepted (existing) |
| D-002 | ADR-0060 (Multiple assets per user) | Source / Predecessor | Menno | Accepted (existing) |
| D-003 | ADR-0061 (Tier-3 poll scheduler) | Source / Predecessor | Menno | Accepted (existing) |
| D-004 | ADR-0064 (Geospatial country normalization) | Source / Predecessor | Menno | Accepted (existing) |
| D-005 | ADR-0067 (Facebook connector reconfirmation) | Source / Predecessor | Menno | Accepted (existing) |
| D-006 | ADR-0070 (Watchdog reconciliation & stalled alerts) | Source / Predecessor | Menno | Accepted (existing) |
| D-007 | Meta Graph API v21.0+ availability | External | Meta | Available and in use |
| D-008 | Story 2.24 – Instagram Business Connector backend | Implementation | Development | Implemented |
| D-009 | Story 6.34 – Instagram Business Connector UI | Implementation | Development | Implemented |

---

- The authenticating user has one or more Facebook Pages with linked Instagram Business or Creator accounts.
- Meta Graph API v21.0 or a supported LTS version remains available.
- Standard Access permissions are sufficient for internal development/testing; Advanced Access is obtained before third-party tenant onboarding.
- Long-lived Page Access Tokens can be stored and reused for periodic polling.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Instagram polling shall run as a Tier-3 per-user scheduled task without overlapping ticks for `(tenantId, 'instagram', userId)`. | Reliability | Must | Watchdog reconciles or prevents concurrent ingestion runs. |
| NFR-002 | Multi-account polling shall use sequential execution with 1.2s inter-account jitter. | Performance | Must | No evidence of API rate-limit bursts from the connector. |
| NFR-003 | Rate-limit responses (`4`, `17`, HTTP 429) shall be honored via `Retry-After` or exponential backoff. | Reliability | Must | No credential invalidation due to transient rate limits. |
| NFR-004 | All stored access tokens and credentials shall be encrypted at rest. | Security | Must | Encryption matches existing `platform_credentials` practice. |
| NFR-005 | No personal Instagram account data shall be ingested or stored. | Compliance | Must | Personal account ingestion attempts are blocked or unavailable. |
| NFR-006 | Ingestion runs shall be reconciled if they exceed 15 minutes. | Reliability | Must | Watchdog emits `stalled` alert and releases the in-flight guard. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The authenticating user has one or more Facebook Pages with linked Instagram Business or Creator accounts.
- Meta Graph API v21.0 or a supported LTS version remains available.
- Standard Access permissions are sufficient for internal development/testing; Advanced Access is obtained before third-party tenant onboarding.
- Long-lived Page Access Tokens can be stored and reused for periodic polling.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | Personal Instagram account expectations cause user confusion or support requests | Medium | Medium | Display name clearly says `Instagram Business`; description and docs explain personal accounts are excluded | Product Owner |
| R-002 | Meta CDN media URLs expire and break previews | High | Medium | UI prefers `thumbnail_url` and gracefully falls back to canonical `permalink`; no background re-fetching | Technical Lead |
| R-003 | Sparse location tags lead to "Unknown" country breakdowns | High | Low | Document limitation; rely on other connectors for broad geo discovery; show location only when present | Product Owner |
| R-004 | Graph API permission or token revocation interrupts ingestion | Medium | High | Immediate `reconnect_required` alert and health badge; user-driven reconnection flow in admin UI | Technical Lead |
| R-005 | High-volume initial ingestion exceeds scheduler tick budget | Low | High | Enforce 30-day / 100-item ceiling and newest-first short-circuit; sequential multi-account polling with jitter | Technical Lead |
| R-006 | Meta rate limits disrupt polling for multiple accounts | Medium | Medium | Honor `Retry-After` and use exponential backoff; do not invalidate credentials for transient limits | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0068-instagram-connector.md`
- BRD: `../Business-Requirements/BRD-0068-Instagram-Connector.md`
- Feature design: `docs/product-research/feature-designs/``
- Deep research: `docs/product-research/reports/``
- User stories: see extracted stories above