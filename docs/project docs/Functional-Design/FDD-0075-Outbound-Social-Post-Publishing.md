# Business Requirements Document (BRD) — Outbound Social Post Publishing

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) — Outbound Social Post Publishing |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0075-outbound-social-post-publishing.md, ../Business-Requirements/BRD-0075-Outbound-Social-Post-Publishing.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0075-outbound-social-post-publishing.md and the business requirements in BRD-0075-Outbound-Social-Post-Publishing.md into functional design for **Outbound Social Post Publishing**.
The Polypost Composer (ADR-0072) is built but currently uses a simulated `handlePublish()` that only sets client-side state. Outbound posting is the natural bridge from passive listening to active social media management: a user writes once, customizes per platform, and dispatches to one or more connected assets from within SocialEngage.

This BRD authorizes the real outbound write path: `SocialConnector.publish?()`, an `outbound_activities` table extension for `activity_type='post'`, and `POST /v1/outbound/posts` to dispatch text/link-card posts immediately or schedule them for later. The feature makes SocialEngage a full social media management suite, directly comparable to Sprout Social, Hootsuite, and Sprinklr, while reusing the existing credential, rate-limit, and RLS infrastructure.

---

### 2.2 Scope
**In scope:**
- `SocialConnector.publish?()` optional method.
- `outbound_activities` table extension for `activity_type='post'`.
- `POST /v1/outbound/posts`, `GET /v1/outbound/posts`, and `DELETE /v1/outbound/posts/:id` (cancel pending).
- Immediate text and link-card publishing to the user's own connected platform assets.
- `scheduled_for` storage and a v1 `pg_cron`/polling scheduler.
- Per-asset targeting via `target_asset_id` (e.g. Facebook Page, LinkedIn profile/organization).
- Separate `RequestGate` for outbound posts.

**Out of scope:**
- Image/video media upload in v1 (deferred to ADR-0115).
- Automated/bulk publishing, recurring posts, or CSV bulk upload.
- Posting to third-party assets not owned by the caller.
- Editing or deleting a published post after dispatch.
- Optimal send-time prediction and AI-powered scheduling (AI enhancements, v2).
- Multi-stage approval workflows (configurable in v1.5+).

## 3. Context and Background
See ADR Context.
The Polypost Composer (ADR-0072) is built but currently uses a simulated `handlePublish()` that only sets client-side state. Outbound posting is the natural bridge from passive listening to active social media management: a user writes once, customizes per platform, and dispatches to one or more connected assets from within SocialEngage.

This BRD authorizes the real outbound write path: `SocialConnector.publish?()`, an `outbound_activities` table extension for `activity_type='post'`, and `POST /v1/outbound/posts` to dispatch text/link-card posts immediately or schedule them for later. The feature makes SocialEngage a full social media management suite, directly comparable to Sprout Social, Hootsuite, and Sprinklr, while reusing the existing credential, rate-limit, and RLS infrastructure.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Turn the Polypost Composer into a real publishing tool | A `Tenant-User` can publish a text/link-card post to a connected Facebook Page from the composer and see the live post URL. |
| 2 | Support scheduled publishing for planned cadence | `outbound_activities` stores `scheduled_for` and a scheduler dispatches at the chosen time. |
| 3 | Maintain an auditable, tenant-isolated record of every outbound post | Every dispatch creates an `outbound_activities` row with status, external ID, and error code. |
| 4 | Keep the human in the loop for v1 | No automated posting unless a later story explicitly builds a scheduler. |

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| `Tenant-User` (primary) | Author and publisher of outbound content | High | Compose, preview, select target assets, and publish/schedule without leaving SocialEngage. |
| `Tenant-Social-Care-Agent` (primary) | Queues rapid replies and public messages | High | Move from inbox triage to public publishing in one flow. |
| `Tenant-Admin` (secondary) | Enables posting permissions and reviews queue | Medium | See outbound post status, cancel or reschedule, and configure approval. |
| `Tenant-Brand-Reputation-Manager` (secondary) | Crisis-response content owner | Medium | Ensure crisis-response posts can be reviewed before publishing. |
| `Platform-Admin` | Must have zero access to tenant content | High | Cannot call outbound post endpoints or read `outbound_activities`. |

---

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 2.28 | epic-2-ingestion-connectors-and-rate-limits.md | As core backend engineer, I want an optional `publish?()` method on `SocialConnector` and a dedicated outbound post execution path, so that connectors can im... | See epic file. |
| Story 2.29 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant User managing a connected Facebook Page, I want the `facebook` connector to implement `publish()`, so that I can publish a new post to one of my co... | See epic file. |
| Story 2.30 | epic-2-ingestion-connectors-and-rate-limits.md | As Tenant User with a connected LinkedIn profile or organization, I want the `linkedin` connector to implement `publish()`, so that I can publish a new post ... | See epic file. |
| Story 3.15 | epic-3-data-model-storage-and-archival.md | As Tenant User or Tenant-Admin, I want a tenant-scoped record of every outbound post attempt and a REST endpoint to dispatch new posts to my connected platfo... | See epic file. |
| Story 6.39 | epic-6-tenant-admin-ui.md | As Tenant User or Tenant-Admin, I want the Polypost Composer's Publish button to create real outbound posts on my selected Facebook Pages instead of simulati... | See epic file. |


## 7. Data Requirements
| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `outbound_activities` rows | Audit record of every post attempt | `outbound_activities` (new) | `Tenant-User` / `Tenant-Admin` | Medium |
| `target_asset_id` | Platform-specific destination (Page ID, LinkedIn URN) | Connector asset enumeration | `Tenant-User` | Low |
| `per_platform_overrides` | Per-asset text/customization | User input | `Tenant-User` | Low |
| `scheduled_for` | Desired publish timestamp | User input | `Tenant-User` | Low |
| `external_id` / `external_url` | Provider's post ID and deep link | Platform API response | `Tenant-User` | Low |
| `error_code` | Normalized failure reason | Platform API or core | `Tenant-User` | Low |

---

## 8. Business Rules and Logic
| ID | Rule |
|---|---|
| BRU-001 | Only users with an active Tier-3 credential for a provider can post to that provider's assets. |
| BRU-002 | `target_asset_id` must belong to the caller's enumerated, permitted asset list. |
| BRU-003 | `Platform-Admin` cannot create, list, or cancel outbound posts. |
| BRU-004 | A `pending` scheduled post can be cancelled; a `sent` or `failed` post cannot. |
| BRU-005 | `SocialConnector.publish?()` is optional; unsupported providers return `publish_not_supported`. |
| BRU-006 | v1 supports text and link-card posts only; image/video is explicitly deferred. |

---

## 9. Interfaces and Integrations
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

- The Polypost Composer (ADR-0072) already collects platform selection, per-platform text overrides, link cards, and scheduling intent.
- Facebook Pages and LinkedIn are the v1 platform targets because the project already has asset enumeration and OAuth credentials for both.
- The `outbound_activities` table from ADR-0073 exists and can be extended for `'post'`.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | Outbound posts use a separate `RequestGate` from ingestion and replies. | Reliability | Must | Rate-limit key is `(tenantId, providerId, 'outbound_post')`. |
| NFR-002 | Quota-exceeded errors return `429` with no automatic retry. | Reliability | Must | Contract test asserts no retry on `429` from provider. |
| NFR-003 | `Platform-Admin` cannot create, list, or cancel tenant posts. | Security | Must | Returns `403` for all `platform_admin` calls. |
| NFR-004 | Cross-tenant access is prevented. | Security | Must | Caller can only see/modify their own tenant's `outbound_activities`. |
| NFR-005 | Scheduler is idempotent and uses row locking. | Reliability | Should | `pg_cron` worker uses `SELECT ... FOR UPDATE SKIP LOCKED` and does not double-dispatch. |
| NFR-006 | UI previews match the final dispatched message. | Usability | Should | Platform preview and `body` sent to provider are consistent. |

---

## 11. Error Handling and Exceptions
See ADR consequences and BRD business rules for failure modes.

## 12. Assumptions and Dependencies
- The Polypost Composer (ADR-0072) already collects platform selection, per-platform text overrides, link cards, and scheduling intent.
- Facebook Pages and LinkedIn are the v1 platform targets because the project already has asset enumeration and OAuth credentials for both.
- The `outbound_activities` table from ADR-0073 exists and can be extended for `'post'`.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth write-scope verification is more complex than read scopes. | Medium | High | Verify primary-source Meta/LinkedIn docs before shipping `publish()`; start with Facebook Pages. | Technical Lead |
| R-002 | Platform write rate limits cause frequent `429` errors. | Medium | Medium | Use a dedicated `RequestGate`; surface `429` clearly; no automatic retry. | Technical Lead |
| R-003 | Scheduler double-dispatches a post. | Low | High | Use `pg_cron` with `SELECT ... FOR UPDATE SKIP LOCKED`; status transition is atomic. | Technical Lead |
| R-004 | Per-platform overrides drift from final dispatched text. | Low | Medium | Store final `body` per target in `outbound_activities`; contract test preview vs. payload. | Technical Lead |
| R-005 | Users expect image/video publishing in v1. | Medium | Low | Clearly scope v1 to text/link-card; document media upload as v1.5. | Product Owner |

---

## 14. Appendix
- ADR: `../../adr/0075-outbound-social-post-publishing.md`
- BRD: `../Business-Requirements/BRD-0075-Outbound-Social-Post-Publishing.md`
- Feature design: `docs/product-research/feature-designs/06-unified-social-inbox.md`
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Feature design: `docs/product-research/feature-designs/12-multi-user-workspaces-and-rbac.md`
- Deep research: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md`
- User stories: see extracted stories above