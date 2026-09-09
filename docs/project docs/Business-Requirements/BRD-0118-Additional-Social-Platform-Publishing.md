# Business Requirements Document (BRD) — Additional Social Platform Publishing

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Additional Social Platform Publishing |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft (ADR-0118 is Proposed) |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0118, feature design 07, and deep-research brief |

---

## 2. Executive Summary

**Problem we are solving:** SocialEngage is extending its listening-first platform into a full social media management suite by adding outbound publishing. ADR-0075 and the Polypost Composer already enable Facebook and LinkedIn as the first two publishing targets, but the composer preview rails also advertise Instagram, Bluesky, Mastodon, Threads, and X. Today those previews are client-side simulations with no real write path, which means users cannot actually publish to the networks they see in the composer.

**Who is affected:** Tenant users and social-care agents who author outbound content, tenant admins who manage publishing permissions and queues, and the brand-reputation managers who need crisis-ready multi-network dispatch.

**Proposed solution at a glance:** This BRD records the business need to wire the five additional composer preview platforms to the existing `SocialConnector.publish?()` contract, in a prioritized second wave. The order is Mastodon, Bluesky, Instagram, Threads, and X. Each will reuse the `outbound_activities` table, per-user Tier-3 credentials, `RequestGate` rate-limit gating, and per-asset targeting already established by ADR-0075. The initial release for each platform is text/link-card only; image/video media is explicitly out of v1 and depends on ADR-0115.

**Business value expected:** Users can publish to more networks from the same composer without switching to Hootsuite, Buffer, or Sprout Social. The project gains a clear, risk-aware roadmap that avoids premature investment in high-cost or unverified APIs while still satisfying the preview rails already in the UI.

**Important note:** ADR-0118 is currently **Proposed**. This BRD is a draft for review and may change as each platform-specific ADR is primary-source-verified and accepted.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Convert client-side composer previews for Instagram, Bluesky, Mastodon, Threads, and X into real publishing destinations | Each target platform accepted in a follow-up ADR and passes the `SocialConnector.publish?()` contract for text/link-card posts |
| 2 | Keep the outbound architecture generic and reusable across new networks | New connectors require only a per-platform ADR and a `SocialConnector` implementation; no new core pipeline tables |
| 3 | Defer high-risk or unviable platforms until their economics are proven | X/Twitter is explicitly re-evaluated before build; Instagram waits for media-upload capability (ADR-0115) |
| 4 | Maintain the same auth and ownership model as existing connectors | All publishing uses Tier-3 user-bound credentials and per-user assets; no shared or pooled platform accounts |

---

## 4. Scope

### 4.1 In Scope

- Enabling `SocialConnector.publish?()` for the five additional platforms in the order: Mastodon, Bluesky, Instagram, Threads, X.
- Text and link-card outbound posts for each platform's v1 implementation.
- Reuse of the existing `outbound_activities` table, `POST /v1/outbound/posts`, `target_asset_id`, `perPlatformOverrides`, and `RequestGate` rate-limit gating.
- Per-user asset enumeration (`GET /v1/connectors/:providerId/assets`) before publishing.
- Return of `{ externalId, externalUrl }` on a successful publish.
- A roadmap of per-platform ADRs (e.g., ADR-0119 Mastodon, ADR-0120 Bluesky, etc.) that primary-source-verify API terms, OAuth scopes, and pricing before build.

### 4.2 Out of Scope

- Image/video media upload in v1 (deferred to ADR-0115).
- `SocialConnector.reply?()` and `SocialConnector.poll?()` for any of these platforms until separately decided.
- Business-intermediary or pooled credential models; each tenant/user must hold and pay for their own platform account.
- X/Twitter implementation without a fresh economic viability review.
- Instagram text-only posting unless primary-source verification proves it is supported.

### 4.3 Assumptions

- ADR-0075's outbound architecture and ADR-0115's media-upload ADR will be accepted before the corresponding wave is built.
- Each platform's API terms and OAuth scopes can be verified before implementation.
- The Polypost Composer will keep the same preview rails and `perPlatformOverrides` model.
- Users have already connected a valid platform credential and selected an asset before attempting to publish.

### 4.4 Constraints

- This is a solo, self-funded project, so X/Twitter's paid API tiers may be cost-prohibitive.
- Instagram publishing requires a Facebook Business/Creator account with a linked Page and is media-first.
- Threads API availability is limited and may require business verification.
- No primary-source verification has been performed yet for any of these five platforms.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User (Author) | Primary author of outbound posts | High | Can compose once and publish to the selected additional platforms from the Polypost Composer |
| Tenant-Social-Care-Agent | Rapid public replies and queueing from the inbox | High | Can dispatch replies to supported platforms without leaving SocialEngage |
| Tenant-Admin | Enables connectors, reviews queues, cancels/reschedules | Medium | Clear per-platform enablement status and cost/permission warnings |
| Tenant-Brand-Reputation-Manager | Crisis-response content approval | Medium | Confidence that unviable or high-cost platforms are gated behind explicit review |
| Platform Account Holders (end users) | Own and pay for their own Instagram/Bluesky/etc. accounts | Medium | No unexpected pooled charges or Terms-of-Service violations |
| Product Owner / Technical Lead | Architecture and sequencing decision owner | High | A risk-ordered roadmap with reusable patterns and minimal pipeline churn |

---

## 6. Current State (As-Is)

**Current process:**

1. A tenant user opens the Polypost Composer.
2. The composer shows preview rails for Facebook, LinkedIn, Instagram, Bluesky, Mastodon, Threads, and X.
3. The user writes a message and sees simulated per-platform renderings.
4. For Facebook and LinkedIn (ADR-0075), the message can be published or scheduled.
5. For Instagram, Bluesky, Mastodon, Threads, and X, the preview is visual only; no real `publish?()` implementation exists.

**Pain points:**

- Users see publish targets in the UI that cannot actually be used, creating confusion and unfinished workflow expectations.
- Competitor products (Sprinklr, Sprout, Hootsuite, Buffer) support many of these networks, so SocialEngage is incomplete as a publishing suite without them.
- Some platforms have prohibitive cost or access barriers (X, Threads, Instagram media), and without a documented business decision the project could waste effort or violate platform terms.

---

## 7. Future State (To-Be)

**New or improved process:**

1. The user opens the Polypost Composer and selects one or more target assets.
2. Each target asset belongs to a platform that has an accepted, primary-source-verified per-platform ADR.
3. The composer shows a real, platform-specific preview and warns if a selected target does not support the current content type (e.g., text-only for Instagram).
4. The user publishes or schedules the post.
5. The backend validates the user's Tier-3 credential and the target asset, applies `RequestGate` rate limits with the key `(tenantId, providerId, 'outbound_post')`, and stores the activity in `outbound_activities`.
6. A scheduler or immediate worker calls the platform-specific `SocialConnector.publish?()` implementation.
7. On success, the activity status is updated to `sent` and the platform's `externalId` and `externalUrl` are recorded.

**Expected capabilities:**

- Mastodon, Bluesky, Instagram, Threads, and X become real publishing destinations as each per-platform ADR is accepted.
- Text/link-card posts are supported in the first pass for each viable platform.
- The same `outbound_activities` queue, audit columns, and status model are used for all networks.
- The build order explicitly prioritizes low-barrier networks first and defers or re-evaluates high-barrier ones.

---

## 8. Business Requirements

### 8.1 Functional Requirements

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

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Each new platform must have a primary-source-verified, accepted per-platform ADR before implementation | Compliance | Must | ADR is accepted and references official API documentation or terms |
| NFR-002 | Outbound posts must respect each platform's rate and permission limits | Reliability | Must | No `429` or permission-denied errors caused by missing `RequestGate` configuration |
| NFR-003 | The publishing path must remain multi-tenant isolated | Security | Must | Tenant A cannot publish to Tenant B's assets; `tenant_id` is enforced on `outbound_activities` |
| NFR-004 | Composer previews must remain accurate for each new platform | Usability | Should | A user can preview text/link-card rendering before publishing |
| NFR-005 | The second-wave architecture must not duplicate the `outbound_activities` pipeline | Maintainability | Must | New connectors reuse the same `publish?()` contract, table, and scheduler from ADR-0075 |

---

## 9. Business Rules

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

## 10. Data Requirements

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

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Posts sent per additional platform | Track adoption of the new publishing destinations | Product team | Weekly |
| Posts failed per platform | Surface API, permission, or rate-limit problems | Engineering / Support | Daily |
| Pending outbound queue depth | Monitor scheduler health and back-pressure | Engineering | Real-time / Hourly |
| Per-platform credential activation count | Understand which networks tenants connect | Product / Marketing | Monthly |
| Average time from schedule to sent | Measure publishing latency | Engineering | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | X/Twitter remains unsupported indefinitely due to paid API economics | High | Medium | Explicit re-evaluation gate in ADR-0118; do not start X/Twitter until a new ADR confirms viability | Product Owner |
| R-002 | Instagram cannot support text-only posts, blocking its v1 enablement | High | Medium | Defer Instagram behind ADR-0115 media upload; warn users in the composer | Product Owner |
| R-003 | Threads API access is restricted or unavailable for third parties | Medium | High | Place Threads after Instagram in build order; require verified access before implementation | Product Owner |
| R-004 | Per-platform API terms change after the BRD is approved | Medium | Medium | Each platform must have its own primary-source ADR that is accepted immediately before build; re-verify at implementation time | Product Owner |
| R-005 | Mastodon instance diversity complicates a single connector implementation | Medium | Low | Build the connector around the standard Mastodon API and make the instance URL a configurable credential property | Technical Lead |
| R-006 | Bluesky authentication (OAuth, App Passwords, DID) is not yet chosen | Medium | Medium | Verify the exact model in the per-platform ADR before coding | Technical Lead |

---

## 13. Dependencies

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

## 14. Acceptance Criteria

- A per-platform ADR is drafted, primary-source-verified, and accepted for each of the five target platforms before development begins.
- The existing `POST /v1/outbound/posts` endpoint can accept a target belonging to one of the new platforms and route it to the correct `SocialConnector.publish?()` implementation.
- A user with a valid Tier-3 credential for the platform can publish a text/link-card post and the `outbound_activities` row is updated to `sent` with `externalId` and `externalUrl`.
- A user without a valid Tier-3 credential or an eligible asset receives a clear `403`/`404` error, not a silent failure.
- `RequestGate` rate-limit gating with the key `(tenantId, providerId, 'outbound_post')` is verified for each new platform.
- Instagram and X/Twitter are explicitly blocked or hidden until their per-platform ADR conditions are met.
- The BRD is updated or superseded when ADR-0118 is accepted or amended.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialConnector.publish?()` | The contract an ingestion/publishing connector must implement to send an outbound post. |
| `outbound_activities` | Tenant-scoped table that records outbound post lifecycle: pending, sent, failed, cancelled. |
| `target_asset_id` | A specific Page, profile, account, or other publish destination owned by the authenticated user. |
| `perPlatformOverrides` | Content customizations (text, hashtags, mentions, etc.) tailored to one target platform. |
| `RequestGate` | The project's rate-limit gating mechanism keyed by tenant, provider, and operation. |
| Tier-3 credential | A user-bound credential; the user owns and authorizes the connection to a social platform. |
| Primary-source verification | Confirmation of API behavior, OAuth scopes, pricing, or terms directly from the platform's official documentation. |
| Polypost Composer | The cross-platform authoring and preview UI defined in ADR-0072. |

---

## 16. Appendices

### 16.1 Reference Documents

- [ADR-0118: Additional Social Platform Publishing](../../../../docs/adr/0118-additional-social-platform-publishing.md)
- [ADR-0075: Outbound Social Post Publishing](../../../../docs/adr/0075-outbound-social-post-publishing.md)
- [ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine](../../../../docs/adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md)
- [ADR-0115: Publishing Media Upload and Asset Targeting](../../../../docs/adr/0115-publishing-media-upload-and-asset-targeting.md)
- [ADR-0027: Connector Is Technical Intermediary, Not Contracting Party](../../../../docs/adr/0027-connector-is-technical-intermediary-not-contracting-party.md)
- [Feature Design: Publishing and Scheduling](../../../../docs/product-research/feature-designs/07-publishing-and-scheduling.md)
- [Deep Research Brief: Publishing and Scheduling](../../../../docs/product-research/reports/07-publishing-and-scheduling-deep-research.md)

### 16.2 Related User Stories

**Note:** No dedicated user stories for ADR-0118 were found in `docs/user-stories/`. The parent outbound-publishing flow is covered by the ADR-0075 story range referenced in the implementation plan and user-stories README (e.g., Story 2.28–2.30, Story 3.15, Story 6.39). These will need to be extended or supplemented with per-platform stories (e.g., Mastodon publish, Bluesky publish) once the per-platform ADRs are accepted.

### 16.3 Build Order Summary (from ADR-0118)

1. Facebook — ADR-0075, Story 2.29
2. LinkedIn — ADR-0075, Story 2.30
3. Mastodon
4. Bluesky
5. Instagram — requires ADR-0115
6. Threads — requires Meta access review
7. X/Twitter — last, pending economic re-evaluation

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
