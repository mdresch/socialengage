# Business Requirements Document (BRD) — Outbound Social Post Publishing

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Outbound Social Post Publishing — Business Requirements Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Devin (AI assistant) on behalf of product research session |
| Approver(s) | Menno — Product Owner / Sole Developer |
| Status | Draft / Pending review |

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | Devin | Initial draft from ADR-0075, feature design 07, and research brief |

---

## 2. Executive Summary

The Polypost Composer (ADR-0072) is built but currently uses a simulated `handlePublish()` that only sets client-side state. Outbound posting is the natural bridge from passive listening to active social media management: a user writes once, customizes per platform, and dispatches to one or more connected assets from within SocialEngage.

This BRD authorizes the real outbound write path: `SocialConnector.publish?()`, an `outbound_activities` table extension for `activity_type='post'`, and `POST /v1/outbound/posts` to dispatch text/link-card posts immediately or schedule them for later. The feature makes SocialEngage a full social media management suite, directly comparable to Sprout Social, Hootsuite, and Sprinklr, while reusing the existing credential, rate-limit, and RLS infrastructure.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Turn the Polypost Composer into a real publishing tool | A `Tenant-User` can publish a text/link-card post to a connected Facebook Page from the composer and see the live post URL. |
| 2 | Support scheduled publishing for planned cadence | `outbound_activities` stores `scheduled_for` and a scheduler dispatches at the chosen time. |
| 3 | Maintain an auditable, tenant-isolated record of every outbound post | Every dispatch creates an `outbound_activities` row with status, external ID, and error code. |
| 4 | Keep the human in the loop for v1 | No automated posting unless a later story explicitly builds a scheduler. |

---

## 4. Scope

### 4.1 In Scope

- `SocialConnector.publish?()` optional method.
- `outbound_activities` table extension for `activity_type='post'`.
- `POST /v1/outbound/posts`, `GET /v1/outbound/posts`, and `DELETE /v1/outbound/posts/:id` (cancel pending).
- Immediate text and link-card publishing to the user's own connected platform assets.
- `scheduled_for` storage and a v1 `pg_cron`/polling scheduler.
- Per-asset targeting via `target_asset_id` (e.g. Facebook Page, LinkedIn profile/organization).
- Separate `RequestGate` for outbound posts.

### 4.2 Out of Scope

- Image/video media upload in v1 (deferred to ADR-0115).
- Automated/bulk publishing, recurring posts, or CSV bulk upload.
- Posting to third-party assets not owned by the caller.
- Editing or deleting a published post after dispatch.
- Optimal send-time prediction and AI-powered scheduling (AI enhancements, v2).
- Multi-stage approval workflows (configurable in v1.5+).

### 4.3 Assumptions

- The Polypost Composer (ADR-0072) already collects platform selection, per-platform text overrides, link cards, and scheduling intent.
- Facebook Pages and LinkedIn are the v1 platform targets because the project already has asset enumeration and OAuth credentials for both.
- The `outbound_activities` table from ADR-0073 exists and can be extended for `'post'`.

### 4.4 Constraints

- OAuth write scopes must be verified per platform before a connector can ship `publish()`.
- Platform write rate limits are stricter than read limits; users may hit quotas quickly.
- v1 is text/link-card only.
- No `Platform-Admin` access to tenant content.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-User` (primary) | Author and publisher of outbound content | High | Compose, preview, select target assets, and publish/schedule without leaving SocialEngage. |
| `Tenant-Social-Care-Agent` (primary) | Queues rapid replies and public messages | High | Move from inbox triage to public publishing in one flow. |
| `Tenant-Admin` (secondary) | Enables posting permissions and reviews queue | Medium | See outbound post status, cancel or reschedule, and configure approval. |
| `Tenant-Brand-Reputation-Manager` (secondary) | Crisis-response content owner | Medium | Ensure crisis-response posts can be reviewed before publishing. |
| `Platform-Admin` | Must have zero access to tenant content | High | Cannot call outbound post endpoints or read `outbound_activities`. |

---

## 6. Current State (As-Is)

**Current process:**
1. The Polypost Composer renders previews and a simulated `handlePublish()` that only updates client state.
2. The reply path (ADR-0073) can send replies to ingested posts, but there is no path for new, original posts.
3. `outbound_activities` exists for `'reply'`, not for `'post'`.
4. Users who want to publish must switch to Hootsuite, Buffer, or Sprout Social.

**Pain points:**
- The composer is a preview tool, not a real publishing tool.
- No auditable record of attempted outbound posts.
- No scheduled queue; content cannot be planned in advance.
- Tenants must manage a second tool for outbound content.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A `Tenant-User` opens the Polypost Composer and selects one or more target assets (Facebook Pages, LinkedIn profiles/organizations).
2. They write the message, optionally customize per platform, and add an OpenGraph link card.
3. They click **Publish now** or **Schedule for later**.
4. `POST /v1/outbound/posts` creates one `outbound_activities` row per target in `pending`.
5. For immediate posts, the backend calls `SocialConnector.publish?()` and updates `status` to `sent` or `failed`.
6. For scheduled posts, a `pg_cron`/polling worker picks up `pending` rows whose `scheduled_for` has passed and dispatches them.
7. The user views the `OutboundPostsView` with status, external URL, and cancel/reschedule actions.

**Expected capabilities:**
- Real publishing to Facebook Pages and LinkedIn from the same tool used for listening.
- Per-asset targeting and per-platform overrides.
- A scheduled queue with status tracking.
- A full audit trail of every outbound post attempt.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | `Tenant-User` can create a new outbound post with one or more target assets. | Must | `POST /v1/outbound/posts` accepts `targets[]`, `message`, and optional `perPlatformOverrides`. | Product Owner |
| BR-002 | The backend validates that the caller owns an active Tier-3 credential for each target provider. | Must | Returns `403` or `422` if the credential is missing, inactive, or not owned by the caller. | Technical Lead |
| BR-003 | The backend validates `target_asset_id` against the caller's enumerated asset list. | Must | `target_asset_id` must be in the list returned by the connector's asset enumeration. | Technical Lead |
| BR-004 | `SocialConnector.publish?()` dispatches a text/link-card post and returns the platform post ID and URL. | Must | For Facebook Pages and LinkedIn, `publish()` returns `externalId` and `externalUrl`. | Technical Lead |
| BR-005 | `outbound_activities` records every post attempt with status and audit timestamps. | Must | Table contains `activity_type='post'`, `status`, `scheduled_for`, `sent_at`, `failed_at`, `cancelled_at`. | Technical Lead |
| BR-006 | Immediate posts are dispatched synchronously and their status updated in the response. | Must | `POST /v1/outbound/posts` with no `scheduled_for` returns `201` with the updated rows. | Technical Lead |
| BR-007 | Scheduled posts are stored and dispatched by a scheduler. | Must | `scheduled_for` is stored; a worker polls and dispatches at the chosen time. | Technical Lead |
| BR-008 | Pending scheduled posts can be cancelled. | Must | `DELETE /v1/outbound/posts/:id` sets `status` to `cancelled` if not yet sent. | Product Owner |
| BR-009 | `Tenant-User` can list their outbound posts with status and filter by provider. | Should | `GET /v1/outbound/posts` supports `status` and `providerId` filters. | Product Owner |
| BR-010 | Platform-specific validation errors are surfaced to the UI. | Should | `POST /v1/outbound/posts` returns `422` with a platform-specific `error_code`. | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Outbound posts use a separate `RequestGate` from ingestion and replies. | Reliability | Must | Rate-limit key is `(tenantId, providerId, 'outbound_post')`. |
| NFR-002 | Quota-exceeded errors return `429` with no automatic retry. | Reliability | Must | Contract test asserts no retry on `429` from provider. |
| NFR-003 | `Platform-Admin` cannot create, list, or cancel tenant posts. | Security | Must | Returns `403` for all `platform_admin` calls. |
| NFR-004 | Cross-tenant access is prevented. | Security | Must | Caller can only see/modify their own tenant's `outbound_activities`. |
| NFR-005 | Scheduler is idempotent and uses row locking. | Reliability | Should | `pg_cron` worker uses `SELECT ... FOR UPDATE SKIP LOCKED` and does not double-dispatch. |
| NFR-006 | UI previews match the final dispatched message. | Usability | Should | Platform preview and `body` sent to provider are consistent. |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only users with an active Tier-3 credential for a provider can post to that provider's assets. |
| BRU-002 | `target_asset_id` must belong to the caller's enumerated, permitted asset list. |
| BRU-003 | `Platform-Admin` cannot create, list, or cancel outbound posts. |
| BRU-004 | A `pending` scheduled post can be cancelled; a `sent` or `failed` post cannot. |
| BRU-005 | `SocialConnector.publish?()` is optional; unsupported providers return `publish_not_supported`. |
| BRU-006 | v1 supports text and link-card posts only; image/video is explicitly deferred. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `outbound_activities` rows | Audit record of every post attempt | `outbound_activities` (new) | `Tenant-User` / `Tenant-Admin` | Medium |
| `target_asset_id` | Platform-specific destination (Page ID, LinkedIn URN) | Connector asset enumeration | `Tenant-User` | Low |
| `per_platform_overrides` | Per-asset text/customization | User input | `Tenant-User` | Low |
| `scheduled_for` | Desired publish timestamp | User input | `Tenant-User` | Low |
| `external_id` / `external_url` | Provider's post ID and deep link | Platform API response | `Tenant-User` | Low |
| `error_code` | Normalized failure reason | Platform API or core | `Tenant-User` | Low |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Outbound post status | Track sent/failed/cancelled posts | `Tenant-User` / `Tenant-Admin` | Real-time |
| Posts per provider | Understand which platforms are used most | `Tenant-Admin` | Monthly |
| Scheduled queue size | Detect backlog or scheduler health | `Tenant-Admin` | Ad-hoc |
| Rate-limit hits | Identify quota issues per provider | `Technical Lead` | Ad-hoc |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth write-scope verification is more complex than read scopes. | Medium | High | Verify primary-source Meta/LinkedIn docs before shipping `publish()`; start with Facebook Pages. | Technical Lead |
| R-002 | Platform write rate limits cause frequent `429` errors. | Medium | Medium | Use a dedicated `RequestGate`; surface `429` clearly; no automatic retry. | Technical Lead |
| R-003 | Scheduler double-dispatches a post. | Low | High | Use `pg_cron` with `SELECT ... FOR UPDATE SKIP LOCKED`; status transition is atomic. | Technical Lead |
| R-004 | Per-platform overrides drift from final dispatched text. | Low | Medium | Store final `body` per target in `outbound_activities`; contract test preview vs. payload. | Technical Lead |
| R-005 | Users expect image/video publishing in v1. | Medium | Low | Clearly scope v1 to text/link-card; document media upload as v1.5. | Product Owner |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0072 (Polypost Composer) | Internal | Product Owner | Already Accepted |
| D-002 | ADR-0073 (`outbound_activities` for replies) | Internal | Technical Lead | Already Accepted |
| D-003 | ADR-0028/0014 (Tier-3 credentials and envelope encryption) | Internal | Technical Lead | Already Accepted |
| D-004 | ADR-0060 (Facebook multiple Pages per user) | Internal | Technical Lead | Already Accepted |
| D-005 | ADR-0069 (LinkedIn connector) | Internal | Technical Lead | Already Accepted |
| D-006 | ADR-0003 (per-tenant per-provider rate limiting) | Internal | Technical Lead | Already Accepted |
| D-007 | Polypost Composer UI for real publish flow (`Story 6.39`) | Internal | Product Owner | Before go-live |

---

## 14. Acceptance Criteria

- [ ] `Tenant-User` can publish a text/link-card post to a connected Facebook Page and receive a live post URL.
- [ ] `Tenant-User` can schedule a post and it is dispatched at `scheduled_for`.
- [ ] `Tenant-User` can cancel a `pending` scheduled post.
- [ ] `outbound_activities` contains a `post` row for every dispatch attempt with `external_id` and `external_url` on success.
- [ ] `Platform-Admin` receives `403` on all outbound post endpoints.
- [ ] Contract tests cover Facebook and LinkedIn `publish()`, validation failures, scheduling, and cancellation.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialConnector.publish?()` | Optional connector method that creates a new post on a provider platform. |
| `outbound_activities` | Tenant-scoped audit table for replies and posts. |
| `target_asset_id` | Platform-specific destination for an outbound post (e.g. Facebook `pageId`, LinkedIn `authorUrn`). |
| `perPlatformOverrides` | Custom text or fields for a specific target platform/asset. |
| `Polypost Composer` | UI for composing, previewing, and dispatching outbound posts. |

---

## 16. Appendices

- [ADR-0075: Outbound Social Post Publishing via Platform APIs](../adr/0075-outbound-social-post-publishing.md)
- [Feature design: Publishing and scheduling](../product-research/feature-designs/07-publishing-and-scheduling.md)
- [Deep Research Brief: Publishing and Scheduling](../product-research/reports/07-publishing-and-scheduling-deep-research.md)
- Related stories:
  - Story 2.28 — Connector Publish Framework and Outbound Post Rate Gate
  - Story 2.29 — Facebook Page Post Publishing
  - Story 2.30 — LinkedIn Post Publishing
  - Story 3.15 — Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API
  - Story 6.39 — Polypost Composer Real Publish Flow
  - Story 11.7 — Publishing and scheduling (backend)
  - Story 11.8 — Publishing and scheduling UI (frontend)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | 2026-08-23 |
| Product Owner | Menno | | 2026-08-23 |
| Technical Lead | Menno | | 2026-08-23 |
| Other Stakeholder | | | |
