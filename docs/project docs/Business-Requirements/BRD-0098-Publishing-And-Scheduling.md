# Business Requirements Document — Publishing and Scheduling

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | SocialEngage – Publishing and Scheduling Business Requirements Document |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | BRD Writer Agent |
| Approver(s) | Menno, Product Owner / Technical Lead |
| Status | Draft |

> **Note:** This BRD is based on **ADR-0098, which is currently Proposed (2026-08-23)**. It is a draft for review and may change if the ADR is amended or rejected.

### Revision History

| Version | Date | Author | Description of Changes |
|---|---|---|---|
| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0098, feature design, deep research, and related user stories |

---

## 2. Executive Summary

**What problem are we solving?**
The Polypost Composer currently lets users draft outbound content, but there is no complete path to publish or schedule posts to connected social assets. Without this, SocialEngage remains a passive listening and intelligence tool rather than an active social-media management suite. Users must switch to other products (Hootsuite, Buffer, Sprout Social) to publish.

**Who is affected?**
Tenant Users who author content, Tenant-Social-Care-Agents who queue rapid public replies, Tenant-Admins who manage outgoing queues, and Tenant-Brand-Reputation-Managers who need approval and crisis controls.

**What is the proposed solution at a glance?**
Add an optional `SocialConnector.publish?()` contract, extend `outbound_activities` with `activity_type='post'`, `scheduled_for`, and `published_at`, expose `POST /v1/outbound/posts` to publish immediately or schedule for later, and run a lightweight scheduler worker that dispatches queued posts. Users select target pages/accounts in the composer, preview per platform, and track status in an Outbound Activity Log.

**What business value do we expect?**
One workflow for listening and publishing, multi-asset dispatch from a single message, planned content cadence, and an auditable record of every outbound post. This moves SocialEngage into direct competition with mid-market social-media management suites.

---

## 3. Business Objectives

| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable real outbound publishing from the Polypost Composer | A Tenant-User can publish a new post to at least one connected platform asset and receive a platform URL |
| 2 | Support deferred scheduling for optimal timing | Tenant-Users can schedule a post for a future UTC time and the system dispatches it within one minute of `scheduled_for` |
| 3 | Maintain an auditable, tenant-scoped record of every outbound post attempt | Every publish or schedule attempt creates a row in `outbound_activities` with correct `status`, `scheduled_for`, and `published_at` |
| 4 | Allow multi-asset targeting without engineering help | A Tenant-User can select one or more target pages/accounts per platform in the composer |
| 5 | Surface failures and allow cancel/reschedule before dispatch | Tenant-Users see failed posts with platform-specific error detail and can cancel or reschedule posts that have not yet been published |

---

## 4. Scope

### 4.1 In Scope

- An optional `SocialConnector.publish?()` method that returns a platform post ID and URL.
- `outbound_activities` `activity_type='post'` with `scheduled_for` and `published_at` columns.
- `POST /v1/outbound/posts` that creates one `outbound_activities` row per target platform.
- Immediate publish path (synchronous connector call) and scheduled publish path (worker dispatches at `scheduled_for`).
- `GET /v1/connectors/:platformId/targets` so the UI can list available pages, accounts, or boards.
- `assetTargets` support for selecting which page/account receives each platform's copy of the post.
- A one-minute polling scheduler worker that picks up due scheduled posts.
- `PATCH .../cancel` and `PATCH .../reschedule` for scheduled posts that have not yet been published.
- Status lifecycle for posts: `scheduled`, `publishing`, `published`, `failed`, `cancelled`.
- Failure surfacing via `GET /v1/outbound/posts?status=failed`, an Outbound Activity Log screen, and optional in-app notifications.
- Polypost Composer updates to support `Publish now` and `Schedule for later`.
- Text and link-card outbound content in v1; assets are uploaded by the connector where required.

### 4.2 Out of Scope

- Image and video uploads in v1 (text + link cards only; image/video upload deferred per connector).
- Bulk scheduling via CSV or import.
- Recurring posts.
- AI-recommended optimal send times.
- Multi-stage approval workflow in v1 (configurable approval state machine is a v1.5/v2 consideration).
- Editing or deleting already-published posts on the platform.
- Publishing to platforms whose connector does not yet implement `publish?()`.
- Using third-party social-media management APIs (Buffer, Hootsuite) for publishing.
- Arbitrary scheduling in user timezones without UTC storage.

### 4.3 Assumptions

- Facebook Pages is the primary v1 `publish?()` target; LinkedIn is the next v1.5 target.
- The Polypost Composer (ADR-0072) and `outbound_activities` (ADR-0073) already exist.
- Connectors already enforce OAuth scope verification and tenant-scoped credentials.
- The UI converts the user's local scheduled time to UTC before sending to the API.

### 4.4 Constraints

- All data is tenant-scoped and must respect Postgres Row Level Security (RLS).
- OAuth write scopes must be primary-source verified before a connector's `publish?()` is activated.
- Outbound posts must be rate-gated independently of ingestion so publishing does not starve polls.
- Scheduling is stored and executed in UTC to avoid daylight-saving edge cases.

---

## 5. Stakeholders

| Stakeholder | Role / Interest | Impact | Key Needs |
|---|---|---|---|
| Tenant-User | Primary author of outbound posts | High | Compose, preview, publish or schedule in one place |
| Tenant-Social-Care-Agent | Queues rapid public replies and DMs | High | Quick handoff from inbox to publishing workflow |
| Tenant-Admin | Enables features and manages queue | Medium | See pending/scheduled posts, cancel or reschedule them |
| Tenant-Brand-Reputation-Manager | Reviews crisis-response content | Medium | Ensure sensitive content can be reviewed before it is published |
| Product Owner | Scope and priority owner | High | Clear v1 boundaries and v2 roadmap |
| Backend Engineering | Builds and maintains the scheduler, connectors, and API | High | Re-usable `outbound_activities` pattern and optional connector contract |
| Frontend Engineering | Builds the composer and queue screens | High | Clear endpoints and status model |

---

## 6. Current State (As-Is)

**Current process:**
1. A Tenant-User drafts a post in the Polypost Composer.
2. The composer validates content length and platform selection.
3. There is no real outbound dispatch path; publishing is simulated or not possible.
4. Replies (ADR-0073) already create `outbound_activities` rows, but `activity_type='post'` is not yet supported.
5. Users who need scheduling or multi-asset publishing must export content or use another tool.

**Pain points:**
- The composer is a drafting tool, not a publishing tool.
- No ability to queue content for a planned cadence.
- No auditable status of outbound post attempts.
- No per-platform asset targeting for pages/accounts.
- Work is fragmented across SocialEngage and external social-media management products.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A Tenant-User opens the Polypost Composer and writes the outbound message.
2. The user selects one or more target platforms and, where applicable, the specific page/account (`assetTargets`).
3. The user previews per-platform rendering and chooses `Publish now` or `Schedule for later`.
4. `POST /v1/outbound/posts` creates one `outbound_activities` row per target platform.
5. For immediate posts, the row moves to `publishing` and the connector is called synchronously.
6. For scheduled posts, the row is `scheduled` and the scheduler dispatches it when `scheduled_for <= now()`.
7. The user views scheduled, published, and failed posts in the Outbound Activity Log and can cancel or reschedule pending posts.

**Expected capabilities:**
- Publish new posts to connected Facebook Pages from within SocialEngage.
- Schedule posts for a future UTC time and have them dispatch automatically.
- Select target assets per platform in the composer.
- Track every post attempt with status, platform URL, and error detail.
- Cancel or reschedule a post before it is published.

---

## 8. Business Requirements

### 8.1 Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Owner |
|---|---|---|---|---|
| BR-001 | The system shall allow a Tenant-User to create an outbound post with text and optional link-card assets | Must | `POST /v1/outbound/posts` accepts `text` and an optional `assets` array; non-empty text is validated | Product Owner |
| BR-002 | The system shall support one or more target platforms per outbound post | Must | The request accepts `targetPlatforms` and creates one `outbound_activities` row per target | Product Owner |
| BR-003 | The system shall allow the user to select specific target assets where the platform requires them | Must | `GET /v1/connectors/:platformId/targets` returns pages/accounts; `assetTargets` is accepted and validated | Product Owner |
| BR-004 | The system shall publish a post immediately when no `scheduledFor` is provided | Must | The connector is called synchronously, the row is updated to `published` with `platformPostId` and `url`, or `failed` with an error | Product Owner |
| BR-005 | The system shall schedule a post for a future UTC time when `scheduledFor` is provided | Must | The row is inserted as `scheduled`; a worker dispatches it at `scheduled_for` | Product Owner |
| BR-006 | The system shall allow a user to cancel a scheduled post before it is published | Must | `PATCH .../cancel` sets `status='cancelled'` for rows that are not yet `publishing` or `published` | Product Owner |
| BR-007 | The system shall allow a user to reschedule a pending post | Must | `PATCH .../reschedule` updates `scheduled_for` for `scheduled` rows | Product Owner |
| BR-008 | The system shall surface failed scheduled posts in the Outbound Activity Log | Should | `GET /v1/outbound/posts?status=failed` returns rows with `error_code`, `failed_at`, and the originating `scheduled_for` | Product Owner |
| BR-009 | The system shall show the real-time status of all outbound posts | Should | The UI lists posts with status, platform, target asset, and timestamp | Product Owner |
| BR-010 | The system shall return `MISSING_ASSET_TARGET` when a required asset target is absent | Must | If a platform requires a target and none is selected, the API returns `400 MISSING_ASSET_TARGET` | Product Owner |

### 8.2 Non-Functional Requirements

| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All outbound post records are tenant-scoped and protected by RLS | Security | Must | Contract tests verify a tenant cannot read or cancel another tenant's posts |
| NFR-002 | Outbound posts do not exceed platform-specific rate limits | Performance / Reliability | Must | A dedicated `outbound_post` gate tracks calls per `(tenantId, providerId)` and returns `429` when exhausted |
| NFR-003 | Scheduled posts are dispatched within one minute of `scheduled_for` | Performance | Should | Scheduler polls every minute and processes due rows |
| NFR-004 | All scheduling is stored and executed in UTC | Reliability | Must | API rejects or converts non-UTC timestamps; worker uses `timestamptz` |
| NFR-005 | The scheduler is idempotent and safe to retry | Reliability | Should | `SELECT ... FOR UPDATE SKIP LOCKED` or equivalent is used to claim due rows |
| NFR-006 | The UI provides per-platform preview and explicit error messages | Usability | Should | Platform tabs and error states are covered by component tests |

---

## 9. Business Rules

| ID | Rule |
|---|---|
| BRU-001 | Only connectors that implement `SocialConnector.publish?()` may be used for outbound posts. |
| BRU-002 | If a platform requires a target asset (page, account, board) and none is selected, the request is rejected with `MISSING_ASSET_TARGET`. |
| BRU-003 | A scheduled post may be cancelled or rescheduled only while its status is `scheduled` (not `publishing`, `published`, or `failed`). |
| BRU-004 | Outbound post status values are `scheduled`, `publishing`, `published`, `failed`, and `cancelled`. |
| BRU-005 | `scheduled_for` is `null` for immediate posts and a UTC `timestamptz` for scheduled posts. |
| BRU-006 | The scheduler stores `published_at` when a post is successfully dispatched. |
| BRU-007 | Every target platform in a single request results in a separate `outbound_activities` row. |
| BRU-008 | The caller must own or have permission to use the selected `target_asset_id`. |
| BRU-009 | v1 outbound content is limited to text and link cards; image and video uploads are deferred. |

---

## 10. Data Requirements

| Data Element | Description | Source | Owner | Sensitivity |
|---|---|---|---|---|
| `outbound_activities` row | Per-target record of a post attempt, including `status`, `scheduled_for`, and `published_at` | `POST /v1/outbound/posts` or scheduler | Backend | Tenant-scoped |
| `activity_type='post'` | Distinguishes publish activities from replies and CRM handoffs | ADR-0098 decision | Backend | Operational |
| `scheduled_for` | UTC timestamp when a scheduled post should dispatch | User input (UTC) or UI conversion | Backend | Operational |
| `published_at` | UTC timestamp set when the platform confirms the post | Connector / scheduler | Backend | Operational |
| `target_asset_id` / `target_asset_type` | The page, account, or board receiving the post | User selection in composer | Backend | Tenant-scoped |
| `assetTargets` | Mapping of `platformId` to selected target asset | User input | Backend | Tenant-scoped |
| `OutboundPost` payload | `text`, optional `assets`, `scheduledFor`, `inReplyTo` | Composer | Backend | Tenant-scoped |
| `platformPostId` / `url` | The platform's returned post ID and public URL | Connector `publish?()` | Backend | Operational |

---

## 11. Reporting and Analytics

| Report / Metric | Purpose | Audience | Frequency |
|---|---|---|---|
| Outbound Activity Log | List all post attempts by status, platform, and target asset | Tenant-User / Tenant-Admin | On demand |
| Failed Posts view | Surface scheduled or immediate posts that failed with error codes | Tenant-User / Tenant-Admin | On demand |
| Scheduled Queue count | Show how many posts are queued for future dispatch | Tenant-Admin | Real time |
| Posts by Platform | Count of published, scheduled, and failed posts per platform | Product / Operations | Weekly |
| Average time from schedule to publish | Measure scheduler latency | Engineering | Weekly |
| Error distribution | Track top `error_code` values to identify connector or scope issues | Engineering / Product | Weekly |

---

## 12. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth scope creep on Facebook/LinkedIn write permissions | High | High | Primary-source verify each permission before building; scope-degradation UI prompts reconnection | Backend Lead |
| R-002 | Scheduler misses or double-sends a scheduled post | Medium | High | Use UTC `timestamptz` and `SELECT ... FOR UPDATE SKIP LOCKED`; one-minute poll with idempotent connector calls | Backend Lead |
| R-003 | Users accidentally publish to the wrong page/account | Medium | High | Require explicit `assetTargets`; show per-platform preview and confirmation step | UX / Product |
| R-004 | Connector unavailability causes a backlog of scheduled posts | Medium | Medium | Apply the same retry policy as ADR-0073/0075; surface failures clearly | Backend Lead |
| R-005 | Image/video upload scope is underestimated | Medium | High | Defer to v1.5 and design the `assets` schema to support future media types | Product Owner |
| R-006 | Timezone conversion errors in the UI | Low | Medium | Store and execute only in UTC; UI converts to/from local time and shows the UTC value | Frontend Lead |

---

## 13. Dependencies

| ID | Dependency | Type | Owner | Expected Resolution |
|---|---|---|---|---|
| D-001 | ADR-0072 Polypost Composer | Internal / Design | Product Owner | Accepted; composer UI is already drafted |
| D-002 | ADR-0073 `outbound_activities` for replies | Internal / Backend | Backend Lead | Accepted; base table provided by Story 3.14 |
| D-003 | ADR-0075 Basic outbound publishing contract | Internal / Backend | Backend Lead | Accepted; defines `SocialConnector.publish?()` and `POST /v1/outbound/posts` |
| D-004 | ADR-0051 Connector activation | Internal / Backend | Backend Lead | Accepted; determines active credential and tier gating |
| D-005 | Story 2.28 — Connector Publish Framework | Internal / Backend | Backend Lead | Ready; not yet built |
| D-006 | Story 2.29 — Facebook Page Post Publishing | Internal / Backend | Backend Lead | Ready; not yet built |
| D-007 | Story 2.30 — LinkedIn Post Publishing | Internal / Backend | Backend Lead | Ready; not yet built |
| D-008 | Story 3.15 — Outbound Post Publishing API | Internal / Backend | Backend Lead | Ready; not yet built |
| D-009 | Story 6.39 — Polypost Composer Real Publish Flow | Internal / Frontend | Frontend Lead | Ready; not yet built |
| D-010 | Story 11.7 — Publishing and scheduling (backend) | Internal / Backend | Backend Lead | Ready; not yet built |
| D-011 | Story 11.8 — Publishing and scheduling UI (frontend) | Internal / Frontend | Frontend Lead | Ready; not yet built |

---

## 14. Acceptance Criteria

- A Tenant-User can open the Polypost Composer, select `Publish now`, pick one or more Facebook Pages, and see a real post URL returned.
- A Tenant-User can select `Schedule for later`, pick a UTC future time, and see the post listed as `scheduled` in the Outbound Activity Log.
- The scheduler dispatches a `scheduled` post when `scheduled_for` is reached and updates the row to `published` with `platformPostId` and `url`.
- A user can cancel a `scheduled` post before it is dispatched; the row becomes `cancelled`.
- A user can reschedule a `scheduled` post; `scheduled_for` is updated and the scheduler dispatches at the new time.
- A post missing a required `assetTargets` returns `400 MISSING_ASSET_TARGET`.
- Failed posts appear in the `status=failed` list with `error_code`, `failed_at`, and the original `scheduled_for`.
- The Outbound Activity Log supports filtering by `status` and `providerId`.
- `GET /v1/outbound/posts` is tenant-scoped; cross-tenant access is rejected.

---

## 15. Glossary

| Term | Definition |
|---|---|
| `SocialConnector.publish?()` | Optional connector method that sends a new post to a platform and returns a platform post ID and URL |
| `OutboundPost` | Payload for a new outbound post: `text`, optional `assets`, `scheduledFor`, and `inReplyTo` |
| `outbound_activities` | Tenant-scoped audit table for all outbound engagement: replies, posts, and CRM handoffs |
| `activity_type='post'` | Row type in `outbound_activities` that represents an outbound post attempt |
| `scheduled_for` | UTC timestamp when a scheduled post should be dispatched |
| `published_at` | UTC timestamp set when the platform successfully receives the post |
| `assetTargets` | Mapping of platform ID to selected page/account/board ID |
| `targetPlatforms` | List of platform identifiers to which the post should be sent |
| `target_asset_id` | The specific page, account, or board receiving the post |
| `platformPostId` / `url` | The platform-assigned identifier and public URL of a successfully published post |
| `ConnectorCapabilityError` | Error returned when a connector does not support an attempted operation |

---

## 16. Appendices

### Reference documents

- ADR-0098: `docs/adr/0098-publishing-and-scheduling.md` — source architecture decision (Proposed, 2026-08-23).
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md` — what the feature is, user benefits, and implementation notes.
- Deep research brief: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md` — competitive context and recommendations.

### Related user stories

- **Story 2.28 — Connector Publish Framework and Outbound Post Rate Gate** (`epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 2.29 — Facebook Page Post Publishing** (`epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 2.30 — LinkedIn Post Publishing** (`epic-2-ingestion-connectors-and-rate-limits.md`)
- **Story 3.14 — Outbound Reply Audit Table and API** (`epic-3-data-model-storage-and-archival.md`) — base `outbound_activities` table
- **Story 3.15 — Outbound Post Publishing Audit Table and API** (`epic-3-data-model-storage-and-archival.md`)
- **Story 6.39 — Polypost Composer Real Publish Flow** (`epic-6-tenant-admin-ui.md`)
- **Story 11.7 — Publishing and scheduling (backend)** (`epic-11-adr-0095-to-0100.md`)
- **Story 11.8 — Publishing and scheduling UI (frontend)** (`epic-11-adr-0095-to-0100.md`)

---

## 17. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Business Sponsor | Menno | | |
| Product Owner | Menno | | |
| Technical Lead | Menno | | |
| Other Stakeholder | | | |
