# Business Requirements Document (BRD) — Outbound Reply to Ingested Posts via Platform APIs

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Outbound Reply to Ingested Posts via Platform APIs |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0073-outbound-reply-to-ingested-posts.md, ../Business-Requirements/BRD-0073-Outbound-Reply-To-Ingested-Posts.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0073-outbound-reply-to-ingested-posts.md and the business requirements in BRD-0073-Outbound-Reply-To-Ingested-Posts.md into functional design for **Outbound Reply To Ingested Posts**.
Ingested posts are now first-class objects in SocialEngage (ADR-0071 `PostDetailPanel`, ADR-0072 `PolypostComposer`), but users cannot yet reply or comment on an already ingested post through the original social platform's API. Replying is a distinct outbound engagement action with its own authorization, audit, rate-limit, and error-handling needs, which is why it deserves its own business requirements document.

This BRD authorizes an outbound reply path for ingested posts through the originating platform. v1 is deliberately limited to posts the tenant or user owns or administers: human-initiated replies, an `outbound_activities` audit table, an optional `SocialConnector.reply?()` method, `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies`, and a Reply action plus Replies tab in the Post Detail panel. The goal is to close the engagement loop so users can act on their own content without leaving SocialEngage.

---

### 2.2 Scope
**In scope:**
- A tenant-scoped, RLS-protected `outbound_activities` audit table for replies.
- An optional `SocialConnector.reply?()` connector method with a clear unsupported error.
- `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies` REST endpoints.
- Reuse of existing Tier-3 `platform_credentials` for the post's provider.
- A separate `RequestGate` key for outbound replies per `(tenantId, providerId, 'outbound')`.
- A **Reply** action and cascading composer drawer in `PostDetailPanel` (ADR-0071).
- A **Replies** tab inside the post drawer showing sent/failed replies.
- v1 support for posts the tenant/user already owns or administers (own Facebook Page, Instagram Business, and LinkedIn posts).
- Primary-source verification of each platform's required write/comment permissions.

**Out of scope:**
- Replying to third-party public content.
- Automated, scheduled, or bulk replies.
- Editing or deleting sent replies after dispatch.
- Ingesting reply engagement counts or third-party comments as separate posts.
- Media/image replies in v1 unless the platform explicitly supports them.
- Connector-specific implementations beyond the v1 framework and Facebook Page reply.

## 3. Context and Background
See ADR Context.
Ingested posts are now first-class objects in SocialEngage (ADR-0071 `PostDetailPanel`, ADR-0072 `PolypostComposer`), but users cannot yet reply or comment on an already ingested post through the original social platform's API. Replying is a distinct outbound engagement action with its own authorization, audit, rate-limit, and error-handling needs, which is why it deserves its own business requirements document.

This BRD authorizes an outbound reply path for ingested posts through the originating platform. v1 is deliberately limited to posts the tenant or user owns or administers: human-initiated replies, an `outbound_activities` audit table, an optional `SocialConnector.reply?()` method, `POST /v1/posts/:id/replies` and `GET /v1/posts/:id/replies`, and a Reply action plus Replies tab in the Post Detail panel. The goal is to close the engagement loop so users can act on their own content without leaving SocialEngage.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable direct replies to ingested posts that the tenant/user owns or administers | A `Tenant-User` can click Reply on an owned Facebook Page post, submit the reply, and see the live reply URL in the Replies tab. |
| 2 | Maintain an auditable, tenant-isolated record of every outbound reply attempt | Every `POST /v1/posts/:id/replies` call creates an `outbound_activities` row with status, credential, user, and provider. |
| 3 | Keep the human in the loop for v1 | No automated, scheduled, or bulk outbound replies unless a later ADR explicitly allows them. |
| 4 | Build on already-accepted architecture | Reuse Tier-3 credentials, the `RequestGate`, the `SocialConnector` pattern, and the Post Detail UI. |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-User` (primary) | Author of replies to owned ingested posts | High | Reply to own posts without leaving SocialEngage and see the live reply link. |
| `Tenant-Social-Care-Agent` (primary) | Rapid responder to inbound mentions/posts | High | Quickly compose a reply from the post detail view and see delivery status. |
| `Tenant-Admin` (secondary) | Enables credentials and reviews reply activity | Medium | Ensure reply activity is auditable and limited to owned content. |
| `Platform-Admin` | Infrastructure / platform owner | High | Must have zero access to tenant replies or `outbound_activities` content. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.26 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer, I want an optional `reply?()` method on `SocialConnector` and an outbound execution path, so that connectors can implement reply be... | See epic file. |
| Story 2.27 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant User managing a connected Facebook Page, I want the `facebook` connector to implement `reply()`, so that I can post a comment on an ingested Facebo... | See epic file. |
| Story 3.14 | epic-3-data-model-storage-and-archival.md | As Tenant User or Tenant-Admin, I want a tenant-scoped record of every reply attempt and a REST endpoint to create one against an ingested post, so that outb... | See epic file. |
| Story 6.38 | epic-6-tenant-admin-ui.md | As Tenant User or Tenant-Admin, I want to click "Reply" on a post, compose the reply in a drawer, and see it listed, so that I can engage with my own posts w... | See epic file. |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- ADR-0071 (`PostDetailPanel` / `EnrichmentEditDrawer`) and ADR-0072 (`PolypostComposer`) are accepted and available.
- Existing Tier-3 `platform_credentials` and OAuth flows from ADR-0014, ADR-0028, and the Facebook/LinkedIn/Instagram connectors can be reused.
- The caller has a platform-granted write/comment permission on the original asset (Page, Business account, LinkedIn profile/organization).
- The `SocialConnector` contract already supports `poll()` and `normalize()` without breaking changes.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Outbound replies consume a separate `RequestGate` per `(tenantId, providerId, 'outbound')`. | Reliability | Must | Rate-limit key is distinct from ingestion and from the ADR-0075 `outbound_post` gate. |
| NFR-002 | Quota-exceeded (`429`) and provider write-limit errors are not auto-retried. | Reliability | Must | The system surfaces the error to the user; no background retry is attempted. |
| NFR-003 | Cross-tenant and `Platform-Admin` access to replies is prevented. | Security | Must | RLS on `outbound_activities` and auth checks reject cross-tenant and platform-admin calls. |
| NFR-004 | The audit table is append-only; v1 does not edit or delete sent replies. | Compliance | Must | No API or UI supports editing/deleting `outbound_activities` rows. |
| NFR-005 | `outbound_activities` is `tenant_id`-scoped and protected by RLS. | Security | Must | Contract tests verify tenant isolation at the database level. |
| NFR-006 | No new credential table or credential kind is introduced. | Maintainability | Should | Reuses existing `platform_credentials` and Tier-3 OAuth model. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- ADR-0071 (`PostDetailPanel` / `EnrichmentEditDrawer`) and ADR-0072 (`PolypostComposer`) are accepted and available.
- Existing Tier-3 `platform_credentials` and OAuth flows from ADR-0014, ADR-0028, and the Facebook/LinkedIn/Instagram connectors can be reused.
- The caller has a platform-granted write/comment permission on the original asset (Page, Business account, LinkedIn profile/organization).
- The `SocialConnector` contract already supports `poll()` and `normalize()` without breaking changes.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth write/comment scope verification is more complex than read scopes. | Medium | High | Verify primary-source Meta/LinkedIn/Instagram documentation before shipping each connector's `reply()`; start with Facebook Pages. | Technical Lead |
| R-002 | Platform write rate limits cause frequent `429` errors. | Medium | Medium | Use a dedicated `RequestGate`; surface `429` clearly; do not auto-retry. | Technical Lead |
| R-003 | v1 does not edit/delete replies, creating support friction. | Medium | Medium | Document the v1 limitation; route support to the native platform UI for edits/deletes. | Product Owner |
| R-004 | Users may expect to reply to any public post, not just owned posts. | Medium | Low | UI and error messages clearly explain that v1 only supports owned/administered posts. | Product Owner |
| R-005 | `outbound_activities` table adds new surface area to the core. | Low | Medium | Keep the table tenant-scoped, RLS-protected, and app-enforced; contract-test every column. | Technical Lead |

---

## 14. Appendix
- ADR: `../../adr/0073-outbound-reply-to-ingested-posts.md`
- BRD: `../Business-Requirements/BRD-0073-Outbound-Reply-To-Ingested-Posts.md`
- Feature design: `docs/product-research/feature-designs/<feature>.md``
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Feature design: `docs/product-research/feature-designs/28-semantic-search-rag.md`
- Deep research: `docs/product-research/reports/<feature>-deep-research.md``
- User stories: see extracted stories above