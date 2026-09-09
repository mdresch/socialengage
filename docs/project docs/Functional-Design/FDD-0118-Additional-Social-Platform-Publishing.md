# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0118 Additional Social Platform Publishing — Functional Design Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft (ADR-0118 is Proposed)) |
| Related Documents | ADR-0118, BRD-0118, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

**Problem we are solving:** SocialEngage is extending its listening-first platform into a full social media management suite by adding outbound publishing. ADR-0075 and the Polypost Composer already enable Facebook and LinkedIn as the first two publishing targets, but the composer preview rails also advertise Instagram, Bluesky, Mastodon, Threads, and X. Today those previews are client-side simulations with no real write path, which means users cannot actually publish to the networks they see in the composer.

This FDD translates the accepted architecture and business requirements from ADR-0118 and BRD-0118 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - Enabling `SocialConnector.publish?()` for the five additional platforms in the order: Mastodon, Bluesky, Instagram, Threads, X.
- Text and link-card outbound posts for each platform's v1 implementation.
- Reuse of the existing `outbound_activities` table, `POST /v1/outbound/posts`, `target_asset_id`, `perPlatformOverrides`, and `RequestGate` rate-limit gating.
- Per-user asset enumeration (`GET /v1/connectors/:providerId/assets`) before publishing.
- Return of `{ externalId, externalUrl }` on a successful publish.
- A roadmap of per-platform ADRs (e.g., ADR-0119 Mastodon, ADR-0120 Bluesky, etc.) that primary-source-verify API terms, OAuth scopes, and pricing before build.
- **Out of scope:** - Image/video media upload in v1 (deferred to ADR-0115).
- `SocialConnector.reply?()` and `SocialConnector.poll?()` for any of these platforms until separately decided.
- Business-intermediary or pooled credential models; each tenant/user must hold and pay for their own platform account.
- X/Twitter implementation without a fresh economic viability review.
- Instagram text-only posting unless primary-source verification proves it is supported.
- **Assumptions and constraints:** - ADR-0075's outbound architecture and ADR-0115's media-upload ADR will be accepted before the corresponding wave is built.
- Each platform's API terms and OAuth scopes can be verified before implementation.
- The Polypost Composer will keep the same preview rails and `perPlatformOverrides` model.
- Users have already connected a valid platform credential and selected an asset before attempting to publish.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. ADR-0075 authorizes Facebook and LinkedIn first
ADR-0075 (Proposed 2026-08-22) authorizes `SocialConnector.publish?()` for immediate outbound posting and an `outbound_activities` audit table. It explicitly scopes v1 to text/link-card posts and leaves image/video upload and additional platforms for later ADRs.

### 2. The composer already previews these five platforms
ADR-0072's Polypost Composer has preview rails for Instagram, Bluesky, Mastodon, Threads, and X, but no real write path. The previews are client-side simulations only.

### 3. Each platform has distinct API, cost, and permission models
- **Instagram:** Content Publishing API, requires a Facebook Business/Creator account with a linked Page, and primarily supports media (image/video/carousel) posts rather than text-only. v1 text-only posting is not viable.
- **Bluesky:** AT Protocol, relatively open, OAuth-like authentication, supports text, links, images, and threads.
- **Mastodon:** ActivityPub-compatible REST API, simple application/user token model, supports text, links, images, and content warnings.
- **Threads:** Meta's Threads API, limited third-party access and business verification requirements.
- **X/Twitter:** Paid API tiers, strict review, and elevated cost; may not be economical for a small self-funded project.

### 4. No primary-source verification has been done
This ADR does not purport to verify terms, pricing, or API shapes. It records a build order and common architecture only. Concrete implementation for any platform requires a per-platform, primary-source-verified ADR (per ADR-0048 and ADR-0027).

---

---

## 4. Goals and Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Convert client-side composer previews for Instagram, Bluesky, Mastodon, Threads, and X into real publishing destinations | Each target platform accepted in a follow-up ADR and passes the `SocialConnector.publish?()` contract for text/link-card posts |
| 2 | Keep the outbound architecture generic and reusable across new networks | New connectors require only a per-platform ADR and a `SocialConnector` implementation; no new core pipeline tables |
| 3 | Defer high-risk or unviable platforms until their economics are proven | X/Twitter is explicitly re-evaluated before build; Instagram waits for media-upload capability (ADR-0115) |
| 4 | Maintain the same auth and ownership model as existing connectors | All publishing uses Tier-3 user-bound credentials and per-user assets; no shared or pooled platform accounts |

---

---

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall support `SocialConnector.publish?()` for Mastodon as the first additional platform | Must | A user with a valid Mastodon credential can publish a text/link-card post and receive `externalId` and `externalUrl` | Product Owner |
| BR-002 | The system shall support `SocialConnector.publish?()` for Bluesky as the second additional platform | Must | A user with a valid Bluesky credential can publish a text/link-card post and receive `externalId` and `externalUrl` | Product Owner |
| BR-003 | The system shall support `SocialConnector.publish?()` for Instagram only after media upload is viable | Should | A user can publish an Instagram post only when ADR-0115 media-upload capability is available; text-only posting is not offered | Product Owner |
| BR-004 | The system shall support `SocialConnector.publish?()` for Threads after access and verification requirements are confirmed | Should | A user with a verified Threads business connection can publish a text/link-card post | Product Owner |
| BR-005 | The system shall support `SocialConnector.publish?()` for X/Twitter only after an economic re-evaluation | Could | X/Twitter publishing is enabled only if a primary-source ADR confirms affordable API terms for the project | Product Owner |
| BR-006 | The system shall require a Tier-3 (user-bound) credential for every additional publishing platform | Must | Publishing is rejected if the caller has no active user-bound credential for the target platform | Product Owner |
| BR-007 | The system shall enumerate per-user assets before publishing | Must | `GET /v1/connectors/:providerId/assets` returns the list of assets the user may post to | Product Owner |
| BR-008 | The system shall apply per-platform rate limiting through `RequestGate` | Must | Each outbound post is gated by the key `(tenantId, providerId, 'outbound_post')` | Product Owner |
| BR-009 | The system shall support `perPlatformOverrides` for the five new platforms | Should | The composer can store platform-specific customizations and the backend applies them at publish time | Product Owner |
| BR-010 | The system shall store each published activity in `outbound_activities` with status `pending`/`sent`/`failed` | Must | The row includes `activity_type='post'`, `target_asset_id`, `result_id`, `error_message`, and audit columns | Product Owner |

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User (Author) | Primary author of outbound posts | High | Can compose once and publish to the selected additional platforms from the Polypost Composer |
| Tenant-Social-Care-Agent | Rapid public replies and queueing from the inbox | High | Can dispatch replies to supported platforms without leaving SocialEngage |
| Tenant-Admin | Enables connectors, reviews queues, cancels/reschedules | Medium | Clear per-platform enablement status and cost/permission warnings |
| Tenant-Brand-Reputation-Manager | Crisis-response content approval | Medium | Confidence that unviable or high-cost platforms are gated behind explicit review |
| Platform Account Holders (end users) | Own and pay for their own Instagram/Bluesky/etc. accounts | Medium | No unexpected pooled charges or Terms-of-Service violations |
| Product Owner / Technical Lead | Architecture and sequencing decision owner | High | A risk-ordered roadmap with reusable patterns and minimal pipeline churn |

---

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 | | | | |

### 6.3 Workflow Diagrams / Steps

### 1. These platforms are a second wave, after Facebook and LinkedIn
The order for implementing `SocialConnector.publish?()` is:

1. Facebook (Story 2.29, ADR-0075)
2. LinkedIn (Story 2.30, ADR-0075)
3. Mastodon — simplest token model and no business verification
4. Bluesky — open protocol, but requires AT Protocol implementation
5. Instagram — depends on Facebook Business/Creator account and media upload (ADR-0115)
6. Threads — depends on Meta access and review
7. X/Twitter — last, due to cost and review barriers; explicit re-evaluation before building

### 2. Reuse existing architecture
Each platform's `publish?()` implementation will:

- Reuse the `outbound_activities` table and `SocialConnector.publish?()` contract from ADR-0075.
- Use `RequestGate` with key `(tenantId, providerId, 'outbound_post')`.
- Require a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.
- Target a per-user asset enumerated by the connector (e.g. `GET /v1/connectors/:providerId/assets`).
- Return `{ externalId, externalUrl }` on success.

### 3. Text/link-card first, media later
Following ADR-0075's v1 scope, the initial `publish()` for each platform supports text and link-card only. Image/video media upload is explicitly out of v1 and depends on ADR-0115.

### 4. No business-intermediary role
Per ADR-0027, SocialEngage remains a technical connection mechanism only. The tenant/user holds their own platform account and pays the platform directly. No pooled or shared credentials.

### 5. Each platform needs a separate acceptance review
This ADR is a roadmap, not a per-platform specification. Before building any of these connectors, a new per-platform ADR must be drafted, primary-source-verified, and accepted (e.g., ADR-0119 Mastodon publishing, ADR-0120 Bluesky publishing, etc.).

---

---

## 7. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `outbound_activities` row | Stores the post, targets, status, and result for each publish attempt | `outbound_activities` table (tenant-scoped, RLS) | Backend | Tenant-confidential |
| `target_asset_id` | Identifies the specific Page/Profile/Account the post is sent to | Connector asset enumeration | Backend | Tenant-confidential |
| `per_platform_overrides` | Platform-specific customizations applied at publish time | Polypost Composer user input | Backend | Tenant-confidential |
| `externalId` | Platform-assigned post ID returned on success | Platform API response | Backend | Public (platform-side) |
| `externalUrl` | Platform-assigned permalink returned on success | Platform API response | Backend | Public (platform-side) |
| `result_id` | Local reference to the platform result stored in `outbound_activities` | Platform result payload | Backend | Tenant-confidential |
| `error_message` | Failure detail for `failed` activities | Platform API or connector | Backend | Tenant-confidential |
| `scheduled_for` | Optional future timestamp for deferred publishing | Polypost Composer | Backend | Tenant-confidential |

---

---

## 8. Business Rules and Logic

| ID | Rule |
|---|---|
| BRU-001 | A user may not publish to a platform for which they do not hold an active Tier-3 (user-bound) credential. |
| BRU-002 | A user may only publish to an asset returned by `GET /v1/connectors/:providerId/assets` for that user. |
| BRU-003 | Text and link-card are the only supported content types for the v1 pass of each new platform. |
| BRU-004 | Instagram may not be enabled for text-only posting; media upload is required before any Instagram publish is offered. |
| BRU-005 | X/Twitter may not be implemented until a primary-source ADR confirms its cost model is viable for the project. |
| BRU-006 | Each new platform must have its own accepted ADR before development begins. |
| BRU-007 | The tenant/user is the contracting party with each social platform; SocialEngage is only a technical intermediary. |

---

---

## 9. Interfaces and Integrations

### 1. These platforms are a second wave, after Facebook and LinkedIn
The order for implementing `SocialConnector.publish?()` is:

1. Facebook (Story 2.29, ADR-0075)
2. LinkedIn (Story 2.30, ADR-0075)
3. Mastodon — simplest token model and no business verification
4. Bluesky — open protocol, but requires AT Protocol implementation
5. Instagram — depends on Facebook Business/Creator account and media upload (ADR-0115)
6. Threads — depends on Meta access and review
7. X/Twitter — last, due to cost and review barriers; explicit re-evaluation before building

### 2. Reuse existing architecture
Each platform's `publish?()` implementation will:

- Reuse the `outbound_activities` table and `SocialConnector.publish?()` contract from ADR-0075.
- Use `RequestGate` with key `(tenantId, providerId, 'outbound_post')`.
- Require a Tier-3 (user-bound) credential under ADR-0028/ADR-0014.
- Target a per-user asset enumerated by the connector (e.g. `GET /v1/connectors/:providerId/assets`).
- Return `{ externalId, externalUrl }` on success.

### 3. Text/link-card first, media later
Following ADR-0075's v1 scope, the initial `publish()` for each platform supports text and link-card only. Image/video media upload is explicitly out of v1 and depends on ADR-0115.

### 4. No business-intermediary role
Per ADR-0027, SocialEngage remains a technical connection mechanism only. The tenant/user holds their own platform account and pays the platform directly. No pooled or shared credentials.

### 5. Each platform needs a separate acceptance review
This ADR is a roadmap, not a per-platform specification. Before building any of these connectors, a new per-platform ADR must be drafted, primary-source-verified, and accepted (e.g., ADR-0119 Mastodon publishing, ADR-0120 Bluesky publishing, etc.).

---

---

## 10. Non-Functional Considerations

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Each new platform must have a primary-source-verified, accepted per-platform ADR before implementation | Compliance | Must | ADR is accepted and references official API documentation or terms |
| NFR-002 | Outbound posts must respect each platform's rate and permission limits | Reliability | Must | No `429` or permission-denied errors caused by missing `RequestGate` configuration |
| NFR-003 | The publishing path must remain multi-tenant isolated | Security | Must | Tenant A cannot publish to Tenant B's assets; `tenant_id` is enforced on `outbound_activities` |
| NFR-004 | Composer previews must remain accurate for each new platform | Usability | Should | A user can preview text/link-card rendering before publishing |
| NFR-005 | The second-wave architecture must not duplicate the `outbound_activities` pipeline | Maintainability | Must | New connectors reuse the same `publish?()` contract, table, and scheduler from ADR-0075 |

---

---

## 11. Error Handling and Exceptions

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | X/Twitter remains unsupported indefinitely due to paid API economics | High | Medium | Explicit re-evaluation gate in ADR-0118; do not start X/Twitter until a new ADR confirms viability | Product Owner |
| R-002 | Instagram cannot support text-only posts, blocking its v1 enablement | High | Medium | Defer Instagram behind ADR-0115 media upload; warn users in the composer | Product Owner |
| R-003 | Threads API access is restricted or unavailable for third parties | Medium | High | Place Threads after Instagram in build order; require verified access before implementation | Product Owner |
| R-004 | Per-platform API terms change after the BRD is approved | Medium | Medium | Each platform must have its own primary-source ADR that is accepted immediately before build; re-verify at implementation time | Product Owner |
| R-005 | Mastodon instance diversity complicates a single connector implementation | Medium | Low | Build the connector around the standard Mastodon API and make the instance URL a configurable credential property | Technical Lead |
| R-006 | Bluesky authentication (OAuth, App Passwords, DID) is not yet chosen | Medium | Medium | Verify the exact model in the per-platform ADR before coding | Technical Lead |

---

---

## 12. Assumptions and Dependencies

- ADR-0075's outbound architecture and ADR-0115's media-upload ADR will be accepted before the corresponding wave is built.
- Each platform's API terms and OAuth scopes can be verified before implementation.
- The Polypost Composer will keep the same preview rails and `perPlatformOverrides` model.
- Users have already connected a valid platform credential and selected an asset before attempting to publish.

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0075 acceptance and `SocialConnector.publish?()` contract | Internal | Technical Lead | Before any additional platform build |
| D-002 | ADR-0115 (media upload and asset targeting) for Instagram | Internal | Product Owner | Before Instagram v1 build |
| D-003 | Per-platform ADR for Mastodon (ADR-0119) | Internal | Product Owner | Before Mastodon build |
| D-004 | Per-platform ADR for Bluesky (ADR-0120) | Internal | Product Owner | Before Bluesky build |
| D-005 | Primary-source API documentation for Threads | External | Product Owner | Before Threads build |
| D-006 | Re-evaluation of X/Twitter paid API pricing | External | Product Owner | Before any X/Twitter build |
| D-007 | Polypost Composer (ADR-0072) preview-rail updates per platform | Internal | Product Owner | Concurrent with each connector build |

---

---

## 13. Open Questions

1. Which of these platforms, if any, should also support `SocialConnector.reply?()` or `SocialConnector.poll()?` (i.e., should the same per-platform ADR cover ingestion and engagement as well as publishing?)
2. Should Mastodon support per-toot threading natively or map the Polypost Composer's thread model to multiple Mastodon posts?
3. What is the exact Bluesky authentication model (OAuth, App Passwords, or DID-based) and its rate/cost model?
4. Does Instagram support any text/link-only post type through the Content Publishing API, or is media always required?
5. Is X/Twitter's paid API still economically viable for a self-funded project at the time of implementation?

---

---

## 14. Appendix

### Reference Documents

- ADR-0118: `docs/adr/0118-additional-social-platform-publishing.md`
- BRD-0118: `docs/project docs/Business-Requirements/BRD-0118-Additional-Social-Platform-Publishing.md`
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Deep-research report: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md`

### Missing Sources Noted

- No matching user stories found in `docs/user-stories/epic-*.md` for ADR-0118.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0118 and BRD-0118. |