# Business Requirements Document – Facebook Page (Owned Feed) Connector

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Facebook Page (Owned Feed) Connector – Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-18 |
| Author(s) | AI Business & Requirements Analyst |
| Approver(s) | Menno, Sponsor |
| Status | Approved |
| Source ADR | ADR-0059: Facebook connector — narrowed to a tenant's own connected Page (Standard/Advanced Access), organization-as-Author modeling; genuine public-content social listening found not viable |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-18 | AI Business & Requirements Analyst | Initial draft from ADR-0059 and related stories |
| 1.0 | 2026-08-18 | Menno, Sponsor | Approved as Accepted |

---

## 2. Executive Summary

**What problem are we solving?** Tenants want to see their own Facebook Page's published content and engagement metrics inside SocialEngage alongside news, RSS, Wikipedia, and other connectors. The original roster entry implied a general "Facebook connector" capable of discovering public content across the platform, but ADR-0059's direct verification against Meta's own developer documentation found that genuine public-content social listening is not buildable on Meta's current API for a project at this scale.

**Who is affected?** Tenant-Users and Tenant-Admins who personally administer a Facebook Page and want a consolidated view of their own Page's posts. The product team must also resolve a one-time, project-level Meta App Review and Business Verification gate before any real, unaffiliated tenant can connect.

**What is the proposed solution at a glance?** Build a narrowly scoped, Tier-3, OAuth-based connector labeled **"Facebook Page (Owned Feed)"** that ingests the connecting user's own administered Page's published posts and their engagement counts into the same `SocialPost` stream as every other connector. It does not discover public posts from Pages the tenant does not own, does not ingest comments or mentions, and does not support a tenant-wide credential.

**What business value do we expect?** Honest, low-friction coverage of an owned social channel; first exercise of OAuth in the connector roster; closure of the `docs/open-decisions.md` Meta connector question with a verified, buildable answer; and a durable precedent for naming and scoping connectors so that UI copy cannot misrepresent what a source actually delivers.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Let a tenant see their own Facebook Page's published posts and engagement metrics in the unified post feed | Tenant can connect a Page and see posts within one poll cycle, with reactions, comments, and shares preserved |
| 2 | Preserve honest, scope-accurate product messaging | Connector is always labeled "Facebook Page (Owned Feed)" — never bare "Facebook" — in every UI surface |
| 3 | Close the Meta connector decision with a primary-source-verified scope | ADR-0059 accepted and its consequences reflected in design, stories, and user-facing copy |
| 4 | Extend the existing connector framework to OAuth without introducing special-case architecture | First use of `authMode: 'oauth'` follows the same `SocialConnector`, `RequestGate`, `Author`, and `SocialPost` patterns as prior connectors |
| 5 | Manage project-level Meta gates transparently | Business Verification and App Review preconditions are tracked as live risks, not hidden assumptions |

---

## 4. Scope

### 4.1 In Scope

- A `SocialConnector` implementation for `facebook` using `authMode: 'oauth'` and `deliveryMode: 'poll'` for v1.
- Ingestion of the connected Facebook Page's own published posts (`GET /{page-id}/feed` or `/posts`).
- Post-level engagement counts: reactions, comments, and shares.
- Normalization of each post's `Author` to the Facebook Page (organization-as-Author), including the Page's fan/follower count in `Author.followerCount`.
- User-bound (Tier 3) credential ownership: only the individual Facebook user who administers the Page can connect it; Tenant-Admin cannot create or activate it on another user's behalf.
- OAuth redirect flow with Page selection from `/me/accounts`.
- A distinctly labeled connector health state for "reconnect required" when the OAuth grant or Page admin relationship is invalidated.
- A display label of **"Facebook Page (Owned Feed)"** (or an equivalent that names both the platform and the owned-only scope) on every UI surface that references the connector.
- Watchlist matching via post-fetch fallback only, because no native query/search feature exists.
- Rate-limit handling that reflects the Pages API's Engaged-Users-relative ceiling (4,800 × Engaged Users per rolling 24-hour window).

### 4.2 Out of Scope

- Genuine public-content social listening: discovery of posts from Pages or accounts the tenant does not own.
- Keyword, topic, or account search across public Facebook content.
- Comment or mention ingestion (deferred pending a `docs/legal/legal-compliance-register.md` review of third-party personal-data/author rights).
- `deliveryMode: 'push'` via Meta Page Webhooks (confirmed feasible v2 enhancement, not v1).
- Tenant-wide (Tier 2) credential path for this connector.
- Multi-Page-per-user support in v1 (covered by ADR-0060 / Story 6.27).
- Actual submission or outcome of SocialEngage's own Meta App Review and Business Verification — these are project-level administrative preconditions outside engineering scope.
- OAuth token proactive refresh/rotation UX beyond detecting invalidation and surfacing a reconnect state.

### 4.3 Assumptions

- SocialEngage will register and operate a single Meta Developer App through which all tenant OAuth flows are mediated.
- SocialEngage can complete Meta Business Verification and obtain permission-by-permission App Review for `pages_show_list` and `pages_read_engagement` before onboarding real, unaffiliated tenants.
- The connecting individual is an administrator of the Facebook Page they want to connect.
- Meta's Standard/Advanced Access model for a Page's own posts remains available with the documented permissions and rate limits.

### 4.4 Constraints

- Meta Platform Terms prohibit reselling or licensing Platform Data; data may only be retained as permitted and must be deletable when required.
- Meta's App Review is a discretionary human review, not a mechanical documentation check, with unquantified rejection risk for a solo-developer project.
- Every Page access token is derived from an individual's long-lived User access token; no organizational/app-only grant exists for an ordinary Page-connect flow.
- The Pages API rate limit is relative to the Page's own Engaged Users, not a flat per-project ceiling.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures connectors, reviews health, invites users | High | Clear scope labeling, honest health status, no accidental tenant-wide credential creation |
| Tenant-User (Page admin) | Personally administers the Facebook Page and connects it | High | Simple OAuth + Page picker, understand that only they can reconnect if access is lost |
| Social-Selling-Strategist | Uses post feed and author data for engagement context | Medium | Accurate source labeling and engagement counts for owned-Page content |
| Sole-Operator / Platform-Admin | Monitors platform-wide connector counts and error rates | Medium | Visibility that Facebook is an owned-feed source, not broad listening; rate-limit behavior is special-cased |
| Menno (Sponsor) | Product owner and decision authority | High | Verified, honest scope; no overclaim of public-content listening; manageable Meta gates |

---

## 6. Current State (As-Is)

**Current process:**

- SocialEngage already ingests news, RSS, Wikipedia, and tenant-owned-domain feeds into a single `SocialPost` stream.
- All existing connectors use either no authentication (`none`) or a tenant/user-provided API key (`apiKey`); no connector exercises `authMode: 'oauth'`.
- Tenant-Admins can create tenant-wide (Tier 2) credentials for some platforms; Tenant-Users can create user-bound (Tier 3) credentials.
- `docs/open-decisions.md` left the Meta/Facebook connector as partially verified groundwork, specifically flagging that Standard Access for a tenant's own Page looked easy but that public-content listening was unconfirmed.

**Pain points:**

- Tenants cannot see their own Facebook Page content alongside other sources in SocialEngage.
- The product's original "Facebook connector" label implied broad listening that is not buildable, risking misrepresentation.
- The connector framework has not yet proven it can support an OAuth flow or a provider that returns a list of connectable assets (Pages) to choose from.

---

## 7. Future State (To-Be)

**New or improved process:**

1. A Tenant-User or Tenant-Admin who personally administers a Facebook Page opens the Connectors screen.
2. They select **"Facebook Page (Owned Feed)"** and are redirected to Facebook Login for Business.
3. After authorizing, they see a picker listing the Facebook Pages their account administers and choose one.
4. The connector stores a long-lived Page access token as a Tier-3, user-bound credential.
5. The scheduler polls the Page's own feed, normalizes each post to a `SocialPost` with the Page as `Author`, and preserves engagement counts in `rawPayload`.
6. Watchlists match against the post's text via the existing post-fetch fallback.
7. If the token or Page-admin relationship is invalidated, the connector health surface displays a distinct "reconnect required" state.

**Expected capabilities:**

- View own-Page posts and engagement metrics in the unified feed.
- Connect only via the Page-administering individual's Facebook account; no team-wide credential path.
- Always see an honest, scope-disclosing label instead of a generic platform name.
- Receive a clear reconnect prompt when the Facebook grant expires or is revoked.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The connector must be exposed as a `SocialConnector` with `authMode: 'oauth'` and `deliveryMode: 'poll'` for v1 | Must | Provider registration requires no core ingestion orchestration changes; contract test proves poll produces valid `SocialPost` rows | Product Owner |
| BR-002 | The connector must ingest only the connected Page's own published posts | Must | `GET /{page-id}/feed` or `/posts` is the only content endpoint called; no comments/mentions endpoints are reached | Product Owner |
| BR-003 | The connector must store credentials as Tier-3, user-bound only | Must | `platform_credentials.owner_type = 'user'`; a Tenant-Admin cannot create or activate the credential on another user's behalf | Product Owner |
| BR-004 | The connector must resolve `Author` to the Facebook Page, not the connecting individual or publishing admin | Must | `Author.externalAuthorId` is the Page id, `handle`/`displayName` is the Page name, `followerCount` is populated from the Page's fan count | Product Owner |
| BR-005 | The connector must capture post-level engagement counts | Must | `reactions`, `comments`, and `shares` summary counts are stored in `rawPayload` | Product Owner |
| BR-006 | The connector must support watchlist matching via post-fetch fallback only | Must | `supportedQueryFeatures` is declared empty; a test confirms matching occurs over fetched post text, not a native query | Product Owner |
| BR-007 | The connector must display the label "Facebook Page (Owned Feed)" on every UI surface | Must | Connector list, status screen, and watchlist source lists never render bare "Facebook" | Product Owner |
| BR-008 | The connector must surface a distinct "reconnect required" health state for OAuth/permission invalidation | Must | A test simulating an authorization error confirms the derived health state is distinguishable from a retryable failure state | Product Owner |
| BR-009 | The OAuth flow must present a Page picker using `/me/accounts` | Should | Picker renders one row per administered Page and persists the chosen Page id; empty result shows a clear explanatory message | Product Owner |
| BR-010 | The connector must avoid duplicate posts when a poll finds no new content | Must | Two consecutive polls with zero new posts do not create duplicate `SocialPost` rows | Product Owner |

Priority levels: Must / Should / Could / Won't (MoSCoW)

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The connector must not hold or pool raw Facebook tokens outside the existing credential store | Security | Must | Long-lived Page token is stored via `platform_credentials` and never appears in logs, UI, or unencrypted storage |
| NFR-002 | Rate-limit handling must reflect the Pages API Engaged-Users-relative ceiling | Reliability | Must | `getRateLimitConfig()` documents 4,800 × Engaged Users per 24-hour window; if Engaged Users cannot be resolved, an explicitly labeled conservative placeholder is used |
| NFR-003 | Connector health must clearly distinguish OAuth invalidation from transient failures | Usability | Must | Health state label and UI action differ between "reconnect required" and generic failing/unhealthy states |
| NFR-004 | The connector must be tenant-scoped and respect RLS | Security | Must | All ingested `SocialPost` rows are isolated to the tenant; no cross-tenant data access |
| NFR-005 | The connector must be maintainable within the existing connector framework | Maintainability | Should | No new core ingestion orchestration concepts are introduced; implementation follows existing `SocialConnector`, `RequestGate`, and `Author` patterns |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A Facebook Page connection may only be created and activated by the individual Facebook user who administers the Page; neither Tenant-Admin nor Platform-Admin may create it on another user's behalf. |
| BRU-002 | The connector must never be rendered with the bare label "Facebook" — it must be "Facebook Page (Owned Feed)" or an equivalent that names both the platform and the owned-content-only scope. |
| BRU-003 | Only the connected Page's own published posts may be ingested; no comments, mentions, or public third-party content may be fetched at v1. |
| BRU-004 | Each ingested Facebook post must be attributed to the Page (organization-as-Author), not to the individual admin who published it or the individual who holds the credential. |
| BRU-005 | OAuth token invalidation (password change, Page-admin removal, grant revocation, permission error) must surface as a "reconnect required" health state, not be silently retried or folded into a generic failing state. |
| BRU-006 | Rate-limit budget must be derived from the Page's own Engaged Users count; no flat, unverified ceiling may be presented as confirmed. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials` (Tier-3, user-bound) | Encrypted long-lived Facebook Page access token plus user/tenant linkage | Facebook OAuth token exchange | Tenant-User (Page admin) | High — OAuth credential |
| `connector_activations` | Activation record binding the tenant/user to the Facebook Page connector | Created at connect time | Tenant-User | Medium — tenant config |
| `social_posts` rows | Normalized Facebook Page posts with `provider_id = 'facebook'`, `body_markdown`, `published_at`, `rawPayload` | Graph API Page feed response | Tenant | Medium — tenant-owned content |
| `authors` record | The connected Facebook Page as an organization-as-Author, with `externalAuthorId`, `handle`, `displayName`, `followerCount` | Graph API Page object | Tenant | Low — public Page metadata |
| `rawPayload.reactions` / `comments` / `shares` | Engagement summary counts for each Page post | Graph API post summary fields | Tenant | Low — public engagement counts |
| `ingestion_runs` | Per-poll audit record with status, post count, and failure metadata | Connector `poll()` loop | System | Low — operational audit |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Facebook Page posts ingested | Track owned-Page coverage | Tenant-Admin / Tenant-User | Per poll / on demand |
| Facebook engagement counts (reactions, comments, shares) | Measure Page post performance | Tenant-Admin / Social-Selling-Strategist | Per post / on demand |
| Connector health status (including "reconnect required") | Surface credential or access problems | Tenant-Admin / Tenant-User | Real time |
| Rate-limit saturation vs. Engaged Users | Warn if the Page is near its 24-hour budget | Platform-Admin / Sole-Operator | Per poll |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | SocialEngage cannot complete Meta Business Verification due to documentation/entity-status gaps | Medium | High | Confirm business-entity documentation before committing engineering resources; treat as a go/no-go gate | Menno / Sponsor |
| R-002 | Meta App Review rejects `pages_read_engagement`/`pages_show_list` for a solo-developer project with no production track record | Medium | High | Build against Menno-administered test Page under Standard Access; document the risk and avoid onboarding real tenants until App Review clears | Menno / Sponsor |
| R-003 | Token invalidation (password change, Page-admin removal, grant revocation) causes silent ingestion failure | Medium | High | Implement a distinct "reconnect required" health state and action; do not silently retry authorization errors | Engineering Lead |
| R-004 | Users or product copy overclaim the connector as a general "Facebook listening" source | Medium | High | Hard UI label "Facebook Page (Owned Feed)" and acceptance criteria that reject bare "Facebook" copy; update help text and onboarding | Product Owner |
| R-005 | Engaged-Users-relative rate limit is miscalculated or miscommunicated | Low | Medium | Implement an explicitly labeled placeholder if the value cannot be resolved; never ship a silently invented flat number | Engineering Lead |
| R-006 | Comment/mention ingestion is later requested without resolving the third-party author-rights question | Medium | High | Block v2 comment/mention design until `docs/legal/legal-compliance-register.md` reviews Meta Platform Terms §3.a.viii and third-party consent | Product Owner / Legal Review |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | Meta Developer App registration and Business Verification | External | Menno / Sponsor | Before real, unaffiliated tenant onboarding |
| D-002 | Meta App Review for `pages_show_list` and `pages_read_engagement` | External | Menno / Sponsor | Before real, unaffiliated tenant onboarding |
| D-003 | Connector framework (`SocialConnector`, `RequestGate`, `Author`, `SocialPost`) | Internal | Engineering Lead | Already built; must support first OAuth source |
| D-004 | Tier-3 credential ownership rules (ADR-0028) | Internal | Engineering Lead | Already built |
| D-005 | OAuth BFF/session design (ADR-0036) | Internal | Engineering Lead | Already built; used for redirect/callback routes |
| D-006 | `deriveConnectorHealth()` health derivation (ADR-0009) | Internal | Engineering Lead | Already built; extended for "reconnect required" state |
| D-007 | Watchlist post-fetch fallback matching (ADR-0006) | Internal | Engineering Lead | Already built |

---

## 14. Acceptance Criteria

- The connector is registered as a `SocialConnector` with `authMode: 'oauth'` and `deliveryMode: 'poll'` without changes to core ingestion orchestration.
- A Tenant-User/Admin who administers a Facebook Page can complete OAuth, pick a Page from `/me/accounts`, and store the connection as a Tier-3, user-bound credential.
- Tenant-Admin cannot create or activate a Facebook Page credential on another user's behalf.
- The connector ingests the selected Page's own published posts and no comments/mentions/public-third-party content.
- Each post's `Author` resolves to the Page with `externalAuthorId` = Page id, `handle`/`displayName` = Page name, and `followerCount` populated.
- Engagement counts (reactions, comments, shares) are captured in `rawPayload`.
- Watchlist matching uses post-fetch fallback only; `supportedQueryFeatures` is empty.
- The connector UI label is "Facebook Page (Owned Feed)" everywhere it appears.
- A distinct "reconnect required" health state is surfaced when the Facebook grant or Page-admin relationship is invalidated.
- A poll with zero new posts is a no-op and does not create duplicates.

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Business Verification** | Meta's process requiring a registered business to verify its identity before an app can request Advanced Access for certain permissions. |
| **Engaged Users** | A Facebook Page metric used by Meta to calculate the Pages API rate-limit ceiling (4,800 × Engaged Users per 24-hour window). |
| **Facebook Page (Owned Feed)** | The required UI label for this connector, disclosing that it only ingests the connected tenant's own Page's posts. |
| **Meta App Review** | A discretionary, permission-by-permission review Meta requires before an app can access live data for certain Graph API permissions. |
| **Organization-as-Author** | The modeling rule that attributes content to the organization, publication, or verified domain responsible for it, not the individual who clicked "publish." |
| **Page access token** | A long-lived access token derived from an individual Facebook User access token and scoped to a specific Facebook Page. |
| **Page Public Content Access (PPCA)** | A Meta Graph API feature for reading public content from Pages a requester does not administer; requires App Review and Business Verification and is not available for general self-service listening. |
| **Reconnect required** | A distinct connector health state indicating that the Facebook OAuth grant or Page-admin relationship has been invalidated and the user must reauthorize. |
| **Standard/Advanced Access** | Meta's access tiers; Advanced Access is required for real, unaffiliated users and is gated by Business Verification and App Review. |
| **Tier 3 credential** | A user-activated, user-bound credential; in ADR-0028, neither Tenant-Admin nor Platform-Admin may create or activate it on a user's behalf. |

---

## 16. Appendices

### A. Source documents

- [ADR-0059: Facebook connector — narrowed to a tenant's own connected Page (Standard/Advanced Access), organization-as-Author modeling; genuine public-content social listening found not viable](../../../adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md)
- [docs/open-decisions.md](../../../open-decisions.md) — 2026-08-06 connector-comparison Meta bullet
- [Feature design: Multi-source ingestion](../../product-research/feature-designs/01-multi-source-ingestion.md)
- [Feature design notes overview](../../product-research/feature-designs.md)

### B. Deep-research brief

No `docs/product-research/reports/<feature>-deep-research.md` file exists for the Facebook Page (Owned Feed) connector. ADR-0059 performed direct primary-source verification against `developers.facebook.com` and `developers.facebook.com/terms`; this BRD relies on that ADR's cited evidence. The missing deep-research brief should be noted if a formal research brief is later required.

### C. Related user stories

- [Epic 2 — Ingestion, Connectors & Rate Limits: Story 2.15](../../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) — Facebook connector: tenant's own connected Page, posts only, Tier 3 credential
- [Epic 2 — Story 2.18](../../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md) — Facebook connector captures post-level engagement counts
- [Epic 6 — Tenant Admin UI: Story 6.23](../../../user-stories/epic-6-tenant-admin-ui.md) — Facebook connector: OAuth connect flow with Page selection

### D. Related ADRs

- ADR-0002 — Connector abstraction and `SocialConnector`/`ProviderConnector` shapes
- ADR-0004 — Author modeling (organization-as-Author clause)
- ADR-0006 — Watchlist matching fallback
- ADR-0009 — `ConnectorHealth` derivation
- ADR-0021 — Connector query-feature declaration
- ADR-0027 — SocialEngage as technical intermediary, not contracting party
- ADR-0028 — Credential tiers (Tier-3, user-bound)
- ADR-0036 — BFF session, no bearer token in browser JS
- ADR-0050 — Tenant-owned-domain feed (owned-content precedent)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-18 |
| Product Owner | Menno | | 2026-08-18 |
| Technical Lead | Menno | | 2026-08-18 |
| Other Stakeholder | | | |
