# Business Requirements Document (BRD) — Outbound Reply to Ingested Posts via Platform APIs

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | BRD-0073 — Outbound Reply to Ingested Posts via Platform APIs |
| Version | 1.0 |
| Date | 2026-08-22 |
| Author(s) | Devin (AI assistant) on behalf of product research session |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Approved |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-22 | Devin | Initial draft from ADR-0073 and related user stories |

---

## 2. Executive Summary

Ingested posts are now first-class objects in SocialEngage (ADR-0071 `PostDetailPanel`, ADR-0072 `PolypostComposer`), but users cannot yet reply or comment on an already ingested post through the original social platform's API. Replying is a distinct outbound engagement action with its own authorization, audit, rate-limit, and error-handling needs, which is why it deserves its own business requirements document.

This BRD authorizes an outbound reply path for ingested posts through the originating platform. v1 is deliberately limited to posts the tenant or user owns or administers: human-initiated replies, an `outbound_activities` audit table, an optional `SocialConnector.reply?()` method, `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies`, and a Reply action plus Replies tab in the Post Detail panel. The goal is to close the engagement loop so users can act on their own content without leaving SocialEngage.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable direct replies to ingested posts that the tenant/user owns or administers | A `Tenant-User` can click Reply on an owned Facebook Page post, submit the reply, and see the live reply URL in the Replies tab. |
| 2 | Maintain an auditable, tenant-isolated record of every outbound reply attempt | Every `POST /v1/posts/:id/replies` call creates an `outbound_activities` row with status, credential, user, and provider. |
| 3 | Keep the human in the loop for v1 | No automated, scheduled, or bulk outbound replies unless a later ADR explicitly allows them. |
| 4 | Build on already-accepted architecture | Reuse Tier-3 credentials, the `RequestGate`, the `SocialConnector` pattern, and the Post Detail UI. |

---

## 4. Scope

### 4.1 In Scope

- A tenant-scoped, RLS-protected `outbound_activities` audit table for replies.
- An optional `SocialConnector.reply?()` connector method with a clear unsupported error.
- `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies` REST endpoints.
- Reuse of existing Tier-3 `platform_credentials` for the post's provider.
- A separate `RequestGate` key for outbound replies per `(tenantId, providerId, 'outbound')`.
- A **Reply** action and cascading composer drawer in `PostDetailPanel` (ADR-0071).
- A **Replies** tab inside the post drawer showing sent/failed replies.
- v1 support for posts the tenant/user already owns or administers (own Facebook Page, Instagram Business, and LinkedIn posts).
- Primary-source verification of each platform's required write/comment permissions.

### 4.2 Out of Scope

- Replying to third-party public content.
- Automated, scheduled, or bulk replies.
- Editing or deleting sent replies after dispatch.
- Ingesting reply engagement counts or third-party comments as separate posts.
- Media/image replies in v1 unless the platform explicitly supports them.
- Connector-specific implementations beyond the v1 framework and Facebook Page reply.

### 4.3 Assumptions

- ADR-0071 (`PostDetailPanel` / `EnrichmentEditDrawer`) and ADR-0072 (`PolypostComposer`) are accepted and available.
- Existing Tier-3 `platform_credentials` and OAuth flows from ADR-0014, ADR-0028, and the Facebook/LinkedIn/Instagram connectors can be reused.
- The caller has a platform-granted write/comment permission on the original asset (Page, Business account, LinkedIn profile/organization).
- The `SocialConnector` contract already supports `poll()` and `normalize()` without breaking changes.

### 4.4 Constraints

- OAuth write/comment scopes must be verified against each provider's primary-source documentation before any connector-specific reply implementation ships.
- Platform write rate limits are stricter than read limits; users may hit quotas quickly.
- v1 is text-only for replies; media/attachment support is platform-dependent and v1.5.
- No new credential kind or table is created for v1.
- A `docs/legal/legal-compliance-register.md` pass is a prerequisite before any connector-specific story is built.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-User` (primary) | Author of replies to owned ingested posts | High | Reply to own posts without leaving SocialEngage and see the live reply link. |
| `Tenant-Social-Care-Agent` (primary) | Rapid responder to inbound mentions/posts | High | Quickly compose a reply from the post detail view and see delivery status. |
| `Tenant-Admin` (secondary) | Enables credentials and reviews reply activity | Medium | Ensure reply activity is auditable and limited to owned content. |
| `Platform-Admin` | Infrastructure / platform owner | High | Must have zero access to tenant replies or `outbound_activities` content. |

---

## 6. Current State (As-Is)

**Current process:**
1. Ingested posts are displayed in `PostDetailPanel` (ADR-0071).
2. New original posts can be authored in the `PolypostComposer` (ADR-0072), but the reply surface is not exposed.
3. Existing connectors are ingest-only; `SocialConnector` defines `poll()` and `normalize()` only.
4. Users who want to reply to their own posts must switch to the native platform UI, with no auditable record in SocialEngage.

**Pain points:**
- No action to comment on or reply to an already ingested post through the original platform.
- No auditable record of outbound engagement attempts.
- No in-product visibility into which replies were sent, failed, or where they live on the platform.
- Higher risk of users acting outside the tool where permissions, quotas, and errors are not tracked.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A `Tenant-User` opens a post in `PostDetailPanel`.
2. The **Reply** action is shown only when the post's provider is supported and the user has an active Tier-3 credential; otherwise it is disabled with an explanatory tooltip.
3. Clicking **Reply** opens a cascading `ReplyComposerDrawer` reusing the `PolypostComposer` text area and character counter.
4. The user composes the reply text and submits.
5. `POST /v1/posts/:id/replies` validates the post belongs to the tenant, the caller owns an active credential with write/comment scope, and the body is within provider limits.
6. The backend records a `pending` row in `outbound_activities`, calls the connector's `reply()`, and updates the row to `sent` with `external_id` and `external_url`, or to `failed` with an `error_code`.
7. The `Replies` tab in the post drawer lists all replies, ordered newest first, with status badges and deep links to live replies.

**Expected capabilities:**
- Human-initiated replies to owned ingested posts sent through the originating platform's API.
- A complete audit trail of every outbound reply attempt per tenant.
- Platform-aware validation and rate-limit isolation for outbound writes.
- In-product delivery status for replies.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | A `Tenant-User` can click **Reply** on an ingested post they own or administer. | Must | `PostDetailPanel` shows the Reply action for supported providers with an active Tier-3 credential. | Product Owner |
| BR-002 | The reply composer reuses the `PolypostComposer` text area and character counter, with media/AI assist disabled for v1. | Must | `ReplyComposerDrawer` opens and accepts non-empty text, surfacing platform character limits. | Product Owner |
| BR-003 | `POST /v1/posts/:id/replies` creates an auditable `outbound_activities` row for the reply. | Must | Row contains `tenant_id`, `post_id`, `provider_id`, `user_id`, `credential_id`, `activity_type='reply'`, `body`, `status`, `external_id`, `external_url`, `error_code`, and audit timestamps. | Technical Lead |
| BR-004 | The endpoint validates the post belongs to the caller's tenant and the body is within provider limits. | Must | Returns `404` for cross-tenant posts and `422` for invalid/missing body. | Technical Lead |
| BR-005 | The endpoint validates the caller has an active, user-bound Tier-3 credential with write/comment scope for the provider. | Must | Returns `422` with code `REPLY_NOT_AVAILABLE` when the credential is missing, inactive, or not owned by the caller. | Technical Lead |
| BR-006 | `SocialConnector.reply?()` is optional; unsupported providers return `reply_not_supported`. | Must | Connectors without `reply()` fail with `422`/`501` and code `reply_not_supported` without changing `poll()` or `normalize()`. | Technical Lead |
| BR-007 | `GET /v1/posts/:id/replies` lists tenant-scoped replies for the post, newest first. | Must | Ordered by `created_at DESC`, with cursor pagination if the list may exceed 50 rows. | Technical Lead |
| BR-008 | The **Replies** tab displays the body, `sent`/`failed` badge, timestamp, and live link for each reply. | Should | On `status === 'sent'`, the `external_url` is rendered; failed replies show the normalized `error_code`. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Outbound replies consume a separate `RequestGate` per `(tenantId, providerId, 'outbound')`. | Reliability | Must | Rate-limit key is distinct from ingestion and from the ADR-0075 `outbound_post` gate. |
| NFR-002 | Quota-exceeded (`429`) and provider write-limit errors are not auto-retried. | Reliability | Must | The system surfaces the error to the user; no background retry is attempted. |
| NFR-003 | Cross-tenant and `Platform-Admin` access to replies is prevented. | Security | Must | RLS on `outbound_activities` and auth checks reject cross-tenant and platform-admin calls. |
| NFR-004 | The audit table is append-only; v1 does not edit or delete sent replies. | Compliance | Must | No API or UI supports editing/deleting `outbound_activities` rows. |
| NFR-005 | `outbound_activities` is `tenant_id`-scoped and protected by RLS. | Security | Must | Contract tests verify tenant isolation at the database level. |
| NFR-006 | No new credential table or credential kind is introduced. | Maintainability | Should | Reuses existing `platform_credentials` and Tier-3 OAuth model. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | A reply can only be attempted on an ingested post the caller's tenant/user owns or administers. |
| BRU-002 | The caller must have an active, user-bound Tier-3 `platform_credentials` row for the post's `provider_id` with the platform's required write/comment permission. |
| BRU-003 | The reply body must be non-empty and within the provider's character/length limits. |
| BRU-004 | `SocialConnector.reply?()` is optional; connectors that do not implement it return `reply_not_supported`. |
| BRU-005 | Outbound replies are human-initiated only; v1 does not allow scheduled, automated, or bulk replies. |
| BRU-006 | `outbound_activities` is append-only; sent replies cannot be edited or deleted in v1. |
| BRU-007 | `Platform-Admin` cannot create or read tenant replies. |
| BRU-008 | `429` and quota-exceeded failures are retryable by the user, not auto-retried by the system. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `outbound_activities` row | Audit record of every reply attempt, including status and provider response | `POST /v1/posts/:id/replies` | `Tenant-User` / `Tenant-Admin` | Medium |
| `post_id` | `social_posts` row being replied to (app-enforced, no DB FK due to partitioning) | `social_posts` | `Tenant-User` | Low |
| `provider_id` | Social platform (e.g. `facebook`, `instagram`, `linkedin`) | `social_posts` / connector | `Tenant-User` | Low |
| `user_id` | SocialEngage user who initiated the reply | Auth session | `Tenant-User` | Low |
| `credential_id` | `platform_credentials` row used (app-enforced, no DB FK due to RLS pattern) | `platform_credentials` | `Tenant-User` | Medium |
| `activity_type` | `'reply'` in v1; extensible to `'repost'`, `'like'`, etc. | Core domain | `Tenant-User` | Low |
| `body` | User-composed reply text, Markdown normalized | User input | `Tenant-User` | Low |
| `status` | `pending` / `sent` / `failed` / `delivered` | Connector/platform result | `Tenant-User` | Low |
| `external_id` / `external_url` | Platform's returned comment/reply ID and deep link | Platform API | `Tenant-User` | Low |
| `error_code` | Normalized failure reason on failure | Error classification | `Tenant-User` | Low |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Replies sent/failed per provider | Track delivery success of outbound replies | `Tenant-Admin` / `Tenant-User` | Real-time |
| Reply rate-limit hits per provider | Identify quota issues | `Technical Lead` | Ad-hoc |
| Outbound reply queue size | Detect pending/failed backlog | `Tenant-Admin` | Ad-hoc |
| Time-to-send for replies | Measure dispatch latency | `Technical Lead` | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth write/comment scope verification is more complex than read scopes. | Medium | High | Verify primary-source Meta/LinkedIn/Instagram documentation before shipping each connector's `reply()`; start with Facebook Pages. | Technical Lead |
| R-002 | Platform write rate limits cause frequent `429` errors. | Medium | Medium | Use a dedicated `RequestGate`; surface `429` clearly; do not auto-retry. | Technical Lead |
| R-003 | v1 does not edit/delete replies, creating support friction. | Medium | Medium | Document the v1 limitation; route support to the native platform UI for edits/deletes. | Product Owner |
| R-004 | Users may expect to reply to any public post, not just owned posts. | Medium | Low | UI and error messages clearly explain that v1 only supports owned/administered posts. | Product Owner |
| R-005 | `outbound_activities` table adds new surface area to the core. | Low | Medium | Keep the table tenant-scoped, RLS-protected, and app-enforced; contract-test every column. | Technical Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0071 (`PostDetailPanel` / `EnrichmentEditDrawer`) | Internal | Product Owner | Already Accepted |
| D-002 | ADR-0072 (`PolypostComposer`) | Internal | Product Owner | Already Accepted |
| D-003 | ADR-0002 (`SocialConnector` contract) | Internal | Technical Lead | Already Accepted |
| D-004 | ADR-0028/0014 (Tier-3 credentials and envelope encryption) | Internal | Technical Lead | Already Accepted |
| D-005 | ADR-0003 (per-tenant per-provider rate limiting) | Internal | Technical Lead | Already Accepted |
| D-006 | ADR-0067/0068/0069 (Facebook/Instagram/LinkedIn connectors) | Internal | Technical Lead | Already Accepted |
| D-007 | `docs/legal/legal-compliance-register.md` review | Internal | Product Owner | Before connector-specific go-live |
| D-008 | Story 2.26 — Connector Reply Framework and Outbound Rate Gate | Internal | Technical Lead | Before go-live |
| D-009 | Story 2.27 — Facebook Page Reply Implementation | Internal | Technical Lead | Before go-live |
| D-010 | Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API | Internal | Technical Lead | Before go-live |
| D-011 | Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab | Internal | Product Owner | Before go-live |

---

## 14. Acceptance Criteria

- [ ] A `Tenant-User` with an active Facebook Page credential can reply to an owned ingested Facebook post and see the live reply URL.
- [ ] `POST /v1/posts/:id/replies` returns `404` for a post that belongs to another tenant.
- [ ] `POST /v1/posts/:id/replies` returns `422` with `REPLY_NOT_AVAILABLE` when the credential is missing, inactive, or the connector does not support `reply()`.
- [ ] `429` and quota-exceeded errors are surfaced to the user without auto-retry.
- [ ] `GET /v1/posts/:id/replies` lists all tenant-scoped replies for the post in descending `created_at` order.
- [ ] The `PostDetailPanel` shows the **Reply** button and a **Replies** tab; the button is disabled with a tooltip when no valid credential exists.
- [ ] `outbound_activities` contains a `reply` row for every attempt, with `external_id` and `external_url` on success and `error_code` on failure.
- [ ] `Platform-Admin` calls to reply endpoints are rejected.
- [ ] Contract tests cover the reply framework, Facebook Page `reply()`, the audit table, and the UI reply flow.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialConnector.reply?()` | Optional connector method that sends a reply to an existing post on a provider platform. |
| `outbound_activities` | Tenant-scoped, RLS-protected audit table for outbound engagement such as replies and posts. |
| `Tier-3 credential` | A user-bound `platform_credentials` row owned and activated by the individual user. |
| `RequestGate` | Per-tenant, per-provider rate-limit tracker used to isolate outbound writes from ingestion. |
| `PostDetailPanel` | UI panel that displays an ingested post and its actions. |
| `ReplyComposerDrawer` | Cascading drawer in `PostDetailPanel` for composing a reply to the displayed post. |
| `Replies` tab | UI tab that lists all `outbound_activities` rows for `activity_type='reply'` on a given post. |
| `write/comment permission` | The platform-granted OAuth scope or account right that allows the user to reply on the original asset. |

---

## 16. Appendices

- [ADR-0073: Outbound Reply to Ingested Posts via Platform APIs](../adr/0073-outbound-reply-to-ingested-posts.md)
- No dedicated `docs/product-research/feature-designs/<feature>.md` or `docs/product-research/reports/<feature>-deep-research.md` was found for ADR-0073; the ADR itself defines the feature surface. Related product-research documents that mention the outbound reply foundation:
  - [Feature design: Unified Social Inbox](../product-research/feature-designs/06-unified-social-inbox.md)
  - [Feature design: Publishing and Scheduling](../product-research/feature-designs/07-publishing-and-scheduling.md)
- Related user stories:
  - [Story 2.26 — Connector Reply Framework and Outbound Rate Gate](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
  - [Story 2.27 — Facebook Page Reply Implementation](../../user-stories/epic-2-ingestion-connectors-and-rate-limits.md)
  - [Story 3.14 — Outbound Reply Audit Table and `POST /v1/posts/:id/replies` API](../../user-stories/epic-3-data-model-storage-and-archival.md)
  - [Story 6.38 — Post Detail Reply Action, Composer Drawer, and Replies Tab](../../user-stories/epic-6-tenant-admin-ui.md)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-22 |
| Product Owner | Menno | | 2026-08-22 |
| Technical Lead | Menno | | 2026-08-22 |
| Other Stakeholder | | | |
