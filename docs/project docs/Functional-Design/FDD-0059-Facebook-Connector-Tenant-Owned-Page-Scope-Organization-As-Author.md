# Business Requirements Document – Facebook Page (Owned Feed) Connector

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document – Facebook Page (Owned Feed) Connector |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md, ../Business-Requirements/BRD-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md and the business requirements in BRD-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md into functional design for **Facebook Connector Tenant Owned Page Scope Organization As Author**.
**What problem are we solving?** Tenants want to see their own Facebook Page's published content and engagement metrics inside SocialEngage alongside news, RSS, Wikipedia, and other connectors. The original roster entry implied a general "Facebook connector" capable of discovering public content across the platform, but ADR-0059's direct verification against Meta's own developer documentation found that genuine public-content social listening is not buildable on Meta's current API for a project at this scale.

**Who is affected?** Tenant-Users and Tenant-Admins who personally administer a Facebook Page and want a consolidated view of their own Page's posts. The product team must also resolve a one-time, project-level Meta App Review and Business Verification gate before any real, unaffiliated tenant can connect.

**What is the proposed solution at a glance?** Build a narrowly scoped, Tier-3, OAuth-based connector labeled **"Facebook Page (Owned Feed)"** that ingests the connecting user's own administered Page's published posts and their engagement counts into the same `SocialPost` stream as every other connector. It does not discover public posts from Pages the tenant does not own, does not ingest comments or mentions, and does not support a tenant-wide credential.

**What business value do we expect?** Honest, low-friction coverage of an owned social channel; first exercise of OAuth in the connector roster; closure of the `docs/open-decisions.md` Meta connector question with a verified, buildable answer; and a durable precedent for naming and scoping connectors so that UI copy cannot misrepresent what a source actually delivers.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Genuine public-content social listening: discovery of posts from Pages or accounts the tenant does not own.
- Keyword, topic, or account search across public Facebook content.
- Comment or mention ingestion (deferred pending a `docs/legal/legal-compliance-register.md` review of third-party personal-data/author rights).
- `deliveryMode: 'push'` via Meta Page Webhooks (confirmed feasible v2 enhancement, not v1).
- Tenant-wide (Tier 2) credential path for this connector.
- Multi-Page-per-user support in v1 (covered by ADR-0060 / Story 6.27).
- Actual submission or outcome of SocialEngage's own Meta App Review and Business Verification — these are project-level administrative preconditions outside engineering scope.
- OAuth token proactive refresh/rotation UX beyond detecting invalidation and surfacing a reconnect state.

## 3. Context and Background
Every connector this project has shipped or drafted so far (Newswire, GNews, Wikipedia, tenant-owned-domain feed) shares one property: a tenant (or the connector itself, for Newswire/Wikipedia's keyless access) independently obtains a credential or needs none at all, with no gate operated by SocialEngage itself in between. ADR-0027 formalizes this as a durable rule — SocialEngage is a technical intermediary, never a contracting party. ADR-0028 names a Company Page / multi-admin Group as its own worked example of a Tier 2, tenant-wide credential, without having verified Meta's actual access model at the time it was drafted (2026-08-03) — that verification is this ADR's job, not something ADR-0028 itself performed.

`docs/open-decisions.md`'s 2026-08-06 connector-comparison entry researched Reddit, X, YouTube, Meta, and Wikipedia against this project's own evaluation discipline. Its Meta bullet, verbatim: *"confirmed easy, free, no-App-Review access exists for managing a tenant's own Page/account ('Standard Access'). Not yet confirmed either way: whether Meta's API supports the actual social-listening use case (searching/monitoring other people's public posts) at all... typically gated behind a separate Marketing Partner relationship, not ordinary app review."* Wikipedia was drafted first (ADR-0042) because it was better-grounded at the time; Meta was left as real, sourced groundwork, not yet a decision.

This ADR performs that verification directly against `developers.facebook.com` (Meta's own developer documentation — Graph API reference, Page Public Content Access / Page Public Metadata Access feature pages, Permissions Reference, Business Verification requirements, Webhooks for Pages, Access Token Guide, Rate Limiting overview) and `developers.facebook.com/terms` (Meta Platform Terms), fetched directly in this drafting pass, 2026-08-18 — the same primary-source bar ADR-0024/0026/0042 held themselves to after RTPR's, Currents API's, and (initially) Reddit's own claims failed to survive direct verification.
**What problem are we solving?** Tenants want to see their own Facebook Page's published content and engagement metrics inside SocialEngage alongside news, RSS, Wikipedia, and other connectors. The original roster entry implied a general "Facebook connector" capable of discovering public content across the platform, but ADR-0059's direct verification against Meta's own developer documentation found that genuine public-content social listening is not buildable on Meta's current API for a project at this scale.

**Who is affected?** Tenant-Users and Tenant-Admins who personally administer a Facebook Page and want a consolidated view of their own Page's posts. The product team must also resolve a one-time, project-level Meta App Review and Business Verification gate before any real, unaffiliated tenant can connect.

**What is the proposed solution at a glance?** Build a narrowly scoped, Tier-3, OAuth-based connector labeled **"Facebook Page (Owned Feed)"** that ingests the connecting user's own administered Page's published posts and their engagement counts into the same `SocialPost` stream as every other connector. It does not discover public posts from Pages the tenant does not own, does not ingest comments or mentions, and does not support a tenant-wide credential.

**What business value do we expect?** Honest, low-friction coverage of an owned social channel; first exercise of OAuth in the connector roster; closure of the `docs/open-decisions.md` Meta connector question with a verified, buildable answer; and a durable precedent for naming and scoping connectors so that UI copy cannot misrepresent what a source actually delivers.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Let a tenant see their own Facebook Page's published posts and engagement metrics in the unified post feed | Tenant can connect a Page and see posts within one poll cycle, with reactions, comments, and shares preserved |
| 2 | Preserve honest, scope-accurate product messaging | Connector is always labeled "Facebook Page (Owned Feed)" — never bare "Facebook" — in every UI surface |
| 3 | Close the Meta connector decision with a primary-source-verified scope | ADR-0059 accepted and its consequences reflected in design, stories, and user-facing copy |
| 4 | Extend the existing connector framework to OAuth without introducing special-case architecture | First use of `authMode: 'oauth'` follows the same `SocialConnector`, `RequestGate`, `Author`, and `SocialPost` patterns as prior connectors |
| 5 | Manage project-level Meta gates transparently | Business Verification and App Review preconditions are tracked as live risks, not hidden assumptions |

---

**Positive consequences (from ADR):**
**Positive**
- Closes `docs/open-decisions.md`'s Meta bullet with a real, primary-source-verified answer instead of leaving it as unconfirmed groundwork — the same rigor bar ADR-0024/0026/0042 already established for this project's connector ADRs.
- Gives ADR-0028's own worked example (Company Page / multi-admin Group) a real, verified, buildable connector instead of only a hypothetical illustration — and corrects, in the process, two claims ADR-0028's own drafting never checked: whether onboarding a real tenant's Page needs App Review at all (Decision §3), and whether the example actually grants at Tier 2 once Meta's real OAuth mechanics are checked (Decision §4 — it doesn't; see the revised "Note on relation to ADR-0028" below).
- If built, would be this project's first connector to actually exercise `authMode: 'oauth'`, and names a real, confirmed-feasible first `deliveryMode: 'push'` candidate (deferred to v2) — both close named gaps in ADR-0002's own "the abstraction generalizes across every mode" claim.
- Reuses ADR-0004's already-generalized organization-as-Author clause with zero new Pending-supersession note required — a real, low-friction confirmation that the 2026-08-11 generalization is working as intended for a fourth instance.
- Honestly narrows scope rather than forcing an unqualified "Facebook connector" through that cannot do what a listening product needs — the same discipline as ADR-0024's RTPR reversal and ADR-0042's Reddit de-prioritization, applied here for the first time to a case where the *narrower* alternative is still worth building, not abandoned outright.

**Negative**
- **Does not deliver genuine social listening — the headline trade-off, not a footnote.** Nothing about this connector lets a tenant discover what the broader public is saying about them on Facebook, the actual product need "Facebook connector" implies elsewhere in this project's roster and design spec. Any story or UI copy built from this ADR must say "your own connected Page," not "Facebook," or it misrepresents what ships.
- **A real, one-time, project-level App Review + Business Verification gate applies even to this narrowed scope** (Decision §3) — a materially higher up-front bar than any prior connector, and one whose feasibility for this specific project (documentation, business-entity status) is not confirmed by this ADR. **Beyond documentation, App Review approval itself is a discretionary human review, not a mechanical check** — a solo-developer project with no production track record carries real, unquantified rejection risk distinct from the Business Verification question, named in Decision §3 and Open Questions.
- **Every credential-invalidation trigger named in Decision §4 (password change, Page-admin removal, grant revocation) produces a silent failure by default** — the connector needs an explicit, distinctly-labeled "reconnect required" health state (Decision §4), not just the generic unhealthy signal every other connector already reports, or a tenant has no way to tell a revoked Facebook grant apart from an ordinary rate-limit blip.
- The public-content-monitoring-is-effectively-closed finding rests partly on secondary-sourced corroboration (CrowdTangle's shutdown, Meta's own vendor pointers), not a single first-party policy statement saying "closed to projects this size" — a narrow possibility remains that a direct approach to Meta's Marketing API Partner program could change this; not pursued further in this pass.
- Comment/mention ingestion — the part of "own-Page monitoring" that would actually resemble listening (what people say in reply) — is deliberately deferred, not designed, because of the real, unresolved third-party personal-data/author-rights question in Decision §5.
- The Page-engagement-relative rate-limit shape (4,800 × Engaged Users) needs its own `getRateLimitConfig()` design, not a drop-in reuse of any existing connector's pattern.
- OAuth token lifecycle/re-consent handling is new, first-of-its-kind build work for this project — every shipped connector to date uses `'none'` or `'apiKey'`.
- Meta's Platform Terms retention language creates the same category of tension with ADR-0018 that Reddit's 48-hour rule does, though softer-worded — named, not resolved.

## 5. Functional Requirements
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

### 5.1 Architecture Decision
**The durable decision — this is what would need superseding, not just amending:**

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-Admin | Configures connectors, reviews health, invites users | High | Clear scope labeling, honest health status, no accidental tenant-wide credential creation |
| Tenant-User (Page admin) | Personally administers the Facebook Page and connects it | High | Simple OAuth + Page picker, understand that only they can reconnect if access is lost |
| Social-Selling-Strategist | Uses post feed and author data for engagement context | Medium | Accurate source labeling and engagement counts for owned-Page content |
| Sole-Operator / Platform-Admin | Monitors platform-wide connector counts and error rates | Medium | Visibility that Facebook is an owned-feed source, not broad listening; rate-limit behavior is special-cased |
| Menno (Sponsor) | Product owner and decision authority | High | Verified, honest scope; no overclaim of public-content listening; manageable Meta gates |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.15 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant-Admin or Tenant User who personally administers a Facebook Page, I want to connect that Page as a `SocialConnector` source, using my own Facebook l... | A registered `SocialConnector` (`providerId` distinct from every existing connector, `authMode: 'oauth'`, `deliveryMode: 'poll'` for v1, per ADR-0059 Decisio... |
| Story 2.18 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer / downstream consumer of Facebook posts, I want post-level engagement counts (`reactions`, `comments`, `shares`) captured during Pag... | `fetchFacebookPagePosts()` requests `reactions.summary(total_count).limit(0).as(reactions)` and `comments.summary(total_count).limit(0).as(comments)` alongsi... |
| Story 6.23 | epic-6-tenant-admin-ui.md | As tenant user or Tenant-Admin who personally administers a Facebook Page, I want to connect it by signing in with my own Facebook account and choosing which... | `tenant/connectors/page.tsx`'s `PLATFORMS` array gains a `facebook` entry: `authMode: 'oauth'`, `personalScopeAllowed: true`, and a new `tenantScopeAllowed: ... |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `platform_credentials` (Tier-3, user-bound) | Encrypted long-lived Facebook Page access token plus user/tenant linkage | Facebook OAuth token exchange | Tenant-User (Page admin) | High — OAuth credential |
| `connector_activations` | Activation record binding the tenant/user to the Facebook Page connector | Created at connect time | Tenant-User | Medium — tenant config |
| `social_posts` rows | Normalized Facebook Page posts with `provider_id = 'facebook'`, `body_markdown`, `published_at`, `rawPayload` | Graph API Page feed response | Tenant | Medium — tenant-owned content |
| `authors` record | The connected Facebook Page as an organization-as-Author, with `externalAuthorId`, `handle`, `displayName`, `followerCount` | Graph API Page object | Tenant | Low — public Page metadata |
| `rawPayload.reactions` / `comments` / `shares` | Engagement summary counts for each Page post | Graph API post summary fields | Tenant | Low — public engagement counts |
| `ingestion_runs` | Per-poll audit record with status, post count, and failure metadata | Connector `poll()` loop | System | Low — operational audit |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | A Facebook Page connection may only be created and activated by the individual Facebook user who administers the Page; neither Tenant-Admin nor Platform-Admin may create it on another user's behalf. |
| BRU-002 | The connector must never be rendered with the bare label "Facebook" — it must be "Facebook Page (Owned Feed)" or an equivalent that names both the platform and the owned-content-only scope. |
| BRU-003 | Only the connected Page's own published posts may be ingested; no comments, mentions, or public third-party content may be fetched at v1. |
| BRU-004 | Each ingested Facebook post must be attributed to the Page (organization-as-Author), not to the individual admin who published it or the individual who holds the credential. |
| BRU-005 | OAuth token invalidation (password change, Page-admin removal, grant revocation, permission error) must surface as a "reconnect required" health state, not be silently retried or folded into a generic failing state. |
| BRU-006 | Rate-limit budget must be derived from the Page's own Engaged Users count; no flat, unverified ceiling may be presented as confirmed. |

---

## 9. Interfaces and Integrations
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

- SocialEngage will register and operate a single Meta Developer App through which all tenant OAuth flows are mediated.
- SocialEngage can complete Meta Business Verification and obtain permission-by-permission App Review for `pages_show_list` and `pages_read_engagement` before onboarding real, unaffiliated tenants.
- The connecting individual is an administrator of the Facebook Page they want to connect.
- Meta's Standard/Advanced Access model for a Page's own posts remains available with the documented permissions and rate limits.

**The durable decision — this is what would need superseding, not just amending:**

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | The connector must not hold or pool raw Facebook tokens outside the existing credential store | Security | Must | Long-lived Page token is stored via `platform_credentials` and never appears in logs, UI, or unencrypted storage |
| NFR-002 | Rate-limit handling must reflect the Pages API Engaged-Users-relative ceiling | Reliability | Must | `getRateLimitConfig()` documents 4,800 × Engaged Users per 24-hour window; if Engaged Users cannot be resolved, an explicitly labeled conservative placeholder is used |
| NFR-003 | Connector health must clearly distinguish OAuth invalidation from transient failures | Usability | Must | Health state label and UI action differ between "reconnect required" and generic failing/unhealthy states |
| NFR-004 | The connector must be tenant-scoped and respect RLS | Security | Must | All ingested `SocialPost` rows are isolated to the tenant; no cross-tenant data access |
| NFR-005 | The connector must be maintainable within the existing connector framework | Maintainability | Should | No new core ingestion orchestration concepts are introduced; implementation follows existing `SocialConnector`, `RequestGate`, and `Author` patterns |

Categories include: Performance, Security, Reliability, Scalability, Usability, Compliance, Maintainability, Accessibility.

---

## 11. Error Handling and Exceptions
**Positive**
- Closes `docs/open-decisions.md`'s Meta bullet with a real, primary-source-verified answer instead of leaving it as unconfirmed groundwork — the same rigor bar ADR-0024/0026/0042 already established for this project's connector ADRs.
- Gives ADR-0028's own worked example (Company Page / multi-admin Group) a real, verified, buildable connector instead of only a hypothetical illustration — and corrects, in the process, two claims ADR-0028's own drafting never checked: whether onboarding a real tenant's Page needs App Review at all (Decision §3), and whether the example actually grants at Tier 2 once Meta's real OAuth mechanics are checked (Decision §4 — it doesn't; see the revised "Note on relation to ADR-0028" below).
- If built, would be this project's first connector to actually exercise `authMode: 'oauth'`, and names a real, confirmed-feasible first `deliveryMode: 'push'` candidate (deferred to v2) — both close named gaps in ADR-0002's own "the abstraction generalizes across every mode" claim.
- Reuses ADR-0004's already-generalized organization-as-Author clause with zero new Pending-supersession note required — a real, low-friction confirmation that the 2026-08-11 generalization is working as intended for a fourth instance.
- Honestly narrows scope rather than forcing an unqualified "Facebook connector" through that cannot do what a listening product needs — the same discipline as ADR-0024's RTPR reversal and ADR-0042's Reddit de-prioritization, applied here for the first time to a case where the *narrower* alternative is still worth building, not abandoned outright.

**Negative**
- **Does not deliver genuine social listening — the headline trade-off, not a footnote.** Nothing about this connector lets a tenant discover what the broader public is saying about them on Facebook, the actual product need "Facebook connector" implies elsewhere in this project's roster and design spec. Any story or UI copy built from this ADR must say "your own connected Page," not "Facebook," or it misrepresents what ships.
- **A real, one-time, project-level App Review + Business Verification gate applies even to this narrowed scope** (Decision §3) — a materially higher up-front bar than any prior connector, and one whose feasibility for this specific project (documentation, business-entity status) is not confirmed by this ADR. **Beyond documentation, App Review approval itself is a discretionary human review, not a mechanical check** — a solo-developer project with no production track record carries real, unquantified rejection risk distinct from the Business Verification question, named in Decision §3 and Open Questions.
- **Every credential-invalidation trigger named in Decision §4 (password change, Page-admin removal, grant revocation) produces a silent failure by default** — the connector needs an explicit, distinctly-labeled "reconnect required" health state (Decision §4), not just the generic unhealthy signal every other connector already reports, or a tenant has no way to tell a revoked Facebook grant apart from an ordinary rate-limit blip.
- The public-content-monitoring-is-effectively-closed finding rests partly on secondary-sourced corroboration (CrowdTangle's shutdown, Meta's own vendor pointers), not a single first-party policy statement saying "closed to projects this size" — a narrow possibility remains that a direct approach to Meta's Marketing API Partner program could change this; not pursued further in this pass.
- Comment/mention ingestion — the part of "own-Page monitoring" that would actually resemble listening (what people say in reply) — is deliberately deferred, not designed, because of the real, unresolved third-party personal-data/author-rights question in Decision §5.
- The Page-engagement-relative rate-limit shape (4,800 × Engaged Users) needs its own `getRateLimitConfig()` design, not a drop-in reuse of any existing connector's pattern.
- OAuth token lifecycle/re-consent handling is new, first-of-its-kind build work for this project — every shipped connector to date uses `'none'` or `'apiKey'`.
- Meta's Platform Terms retention language creates the same category of tension with ADR-0018 that Reddit's 48-hour rule does, though softer-worded — named, not resolved.

## 12. Assumptions and Dependencies
- SocialEngage will register and operate a single Meta Developer App through which all tenant OAuth flows are mediated.
- SocialEngage can complete Meta Business Verification and obtain permission-by-permission App Review for `pages_show_list` and `pages_read_engagement` before onboarding real, unaffiliated tenants.
- The connecting individual is an administrator of the Facebook Page they want to connect.
- Meta's Standard/Advanced Access model for a Page's own posts remains available with the documented permissions and rate limits.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | SocialEngage cannot complete Meta Business Verification due to documentation/entity-status gaps | Medium | High | Confirm business-entity documentation before committing engineering resources; treat as a go/no-go gate | Menno / Sponsor |
| R-002 | Meta App Review rejects `pages_read_engagement`/`pages_show_list` for a solo-developer project with no production track record | Medium | High | Build against Menno-administered test Page under Standard Access; document the risk and avoid onboarding real tenants until App Review clears | Menno / Sponsor |
| R-003 | Token invalidation (password change, Page-admin removal, grant revocation) causes silent ingestion failure | Medium | High | Implement a distinct "reconnect required" health state and action; do not silently retry authorization errors | Engineering Lead |
| R-004 | Users or product copy overclaim the connector as a general "Facebook listening" source | Medium | High | Hard UI label "Facebook Page (Owned Feed)" and acceptance criteria that reject bare "Facebook" copy; update help text and onboarding | Product Owner |
| R-005 | Engaged-Users-relative rate limit is miscalculated or miscommunicated | Low | Medium | Implement an explicitly labeled placeholder if the value cannot be resolved; never ship a silently invented flat number | Engineering Lead |
| R-006 | Comment/mention ingestion is later requested without resolving the third-party author-rights question | Medium | High | Block v2 comment/mention design until `docs/legal/legal-compliance-register.md` reviews Meta Platform Terms §3.a.viii and third-party consent | Product Owner / Legal Review |

---

## 14. Appendix
- ADR: `../../adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md`
- BRD: `../Business-Requirements/BRD-0059-Facebook-Connector-Tenant-Owned-Page-Scope-Organization-As-Author.md`
- Feature design: _No dedicated feature-design file found._
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above