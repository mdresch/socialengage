# Functional Design Document

## 1. Document Control
| Field | Value |
|---|---|
| Document Title | FDD-0098 Publishing and Scheduling — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer Batch Agent |
| Status | Draft |
| Related Documents | ../../adr/0098-publishing-and-scheduling.md, ../Business-Requirements/BRD-0098-Publishing-And-Scheduling.md |

## 2. Purpose and Scope
### 2.1 Purpose
This document translates the accepted architecture decision in 0098-publishing-and-scheduling.md and the business requirements in BRD-0098-Publishing-And-Scheduling.md into functional design for **Publishing And Scheduling**.
**What problem are we solving?**
The Polypost Composer currently lets users draft outbound content, but there is no complete path to publish or schedule posts to connected social assets. Without this, SocialEngage remains a passive listening and intelligence tool rather than an active social-media management suite. Users must switch to other products (Hootsuite, Buffer, Sprout Social) to publish.

**Who is affected?**
Tenant Users who author content, Tenant-Social-Care-Agents who queue rapid public replies, Tenant-Admins who manage outgoing queues, and Tenant-Brand-Reputation-Managers who need approval and crisis controls.

**What is the proposed solution at a glance?**
Add an optional `SocialConnector.publish?()` contract, extend `outbound_activities` with `activity_type='post'`, `scheduled_for`, and `published_at`, expose `POST /v1/outbound/posts` to publish immediately or schedule for later, and run a lightweight scheduler worker that dispatches queued posts. Users select target pages/accounts in the composer, preview per platform, and track status in an Outbound Activity Log.

**What business value do we expect?**
One workflow for listening and publishing, multi-asset dispatch from a single message, planned content cadence, and an auditable record of every outbound post. This moves SocialEngage into direct competition with mid-market social-media management suites.

---

### 2.2 Scope
**In scope:**
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

**Out of scope:**
- Image and video uploads in v1 (text + link cards only; image/video upload deferred per connector).
- Bulk scheduling via CSV or import.
- Recurring posts.
- AI-recommended optimal send times.
- Multi-stage approval workflow in v1 (configurable approval state machine is a v1.5/v2 consideration).
- Editing or deleting already-published posts on the platform.
- Publishing to platforms whose connector does not yet implement `publish?()`.
- Using third-party social-media management APIs (Buffer, Hootsuite) for publishing.
- Arbitrary scheduling in user timezones without UTC storage.

## 3. Context and Background
See ADR Context.
**What problem are we solving?**
The Polypost Composer currently lets users draft outbound content, but there is no complete path to publish or schedule posts to connected social assets. Without this, SocialEngage remains a passive listening and intelligence tool rather than an active social-media management suite. Users must switch to other products (Hootsuite, Buffer, Sprout Social) to publish.

**Who is affected?**
Tenant Users who author content, Tenant-Social-Care-Agents who queue rapid public replies, Tenant-Admins who manage outgoing queues, and Tenant-Brand-Reputation-Managers who need approval and crisis controls.

**What is the proposed solution at a glance?**
Add an optional `SocialConnector.publish?()` contract, extend `outbound_activities` with `activity_type='post'`, `scheduled_for`, and `published_at`, expose `POST /v1/outbound/posts` to publish immediately or schedule for later, and run a lightweight scheduler worker that dispatches queued posts. Users select target pages/accounts in the composer, preview per platform, and track status in an Outbound Activity Log.

**What business value do we expect?**
One workflow for listening and publishing, multi-asset dispatch from a single message, planned content cadence, and an auditable record of every outbound post. This moves SocialEngage into direct competition with mid-market social-media management suites.

---

## 4. Goals and Objectives
| # | Objective | Success Measure |
|---|---|---|
| 1 | Enable real outbound publishing from the Polypost Composer | A Tenant-User can publish a new post to at least one connected platform asset and receive a platform URL |
| 2 | Support deferred scheduling for optimal timing | Tenant-Users can schedule a post for a future UTC time and the system dispatches it within one minute of `scheduled_for` |
| 3 | Maintain an auditable, tenant-scoped record of every outbound post attempt | Every publish or schedule attempt creates a row in `outbound_activities` with correct `status`, `scheduled_for`, and `published_at` |
| 4 | Allow multi-asset targeting without engineering help | A Tenant-User can select one or more target pages/accounts per platform in the composer |
| 5 | Surface failures and allow cancel/reschedule before dispatch | Tenant-Users see failed posts with platform-specific error detail and can cancel or reschedule posts that have not yet been published |

---

**Positive consequences (from ADR):**
1. **Real outbound engagement:** the composer becomes a full publishing tool, not just a drafting tool.
2. **Scheduling capability:** users can queue posts for the optimal time.
3. **Reuses outbound audit:** publishing, replies, and CRM handoffs all share `outbound_activities`.
4. **Connector complexity:** each `SocialConnector` must opt into `publish?()` and handle platform-specific asset rules.

---

## 5. Functional Requirements
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

### 5.1 Architecture Decision
See ADR Decision.

## 6. User Interaction and Workflows
### 6.1 Primary Actors
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

### 6.2 User Stories
| ID | Epic | Intent | Acceptance Criteria |
|---|---|---|---|
| Story 11.7 | epic-11-adr-0095-to-0100.md | As backend engineer, I want `SocialConnector.publish?()`, scheduled `outbound_activities`, and `POST /v1/outbound/posts`, so that the composer can publish re... | `SocialConnector` exposes optional `publish?()` with `OutboundPost` and returns `platformPostId` and `url`.; `outbound_activities` supports `activity_type='p... |
| Story 11.8 | epic-11-adr-0095-to-0100.md | As `Tenant-User`, I want a composer that lets me publish immediately or schedule for later and pick which pages/accounts to target, so that I can manage outb... | `PolypostComposer` supports `Publish now` and `Schedule for later`.; Users can pick `targetPlatforms` and `assetTargets` (pages, accounts).; Scheduled posts ... |


## 7. Data Requirements
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

## 8. Business Rules and Logic
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

## 9. Interfaces and Integrations
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

- Facebook Pages is the primary v1 `publish?()` target; LinkedIn is the next v1.5 target.
- The Polypost Composer (ADR-0072) and `outbound_activities` (ADR-0073) already exist.
- Connectors already enforce OAuth scope verification and tenant-scoped credentials.
- The UI converts the user's local scheduled time to UTC before sending to the API.

## 10. Non-Functional Considerations
| ID | Requirement | Category | Priority | Acceptance Criteria |
|---|---|---|---|---|
| NFR-001 | All outbound post records are tenant-scoped and protected by RLS | Security | Must | Contract tests verify a tenant cannot read or cancel another tenant's posts |
| NFR-002 | Outbound posts do not exceed platform-specific rate limits | Performance / Reliability | Must | A dedicated `outbound_post` gate tracks calls per `(tenantId, providerId)` and returns `429` when exhausted |
| NFR-003 | Scheduled posts are dispatched within one minute of `scheduled_for` | Performance | Should | Scheduler polls every minute and processes due rows |
| NFR-004 | All scheduling is stored and executed in UTC | Reliability | Must | API rejects or converts non-UTC timestamps; worker uses `timestamptz` |
| NFR-005 | The scheduler is idempotent and safe to retry | Reliability | Should | `SELECT ... FOR UPDATE SKIP LOCKED` or equivalent is used to claim due rows |
| NFR-006 | The UI provides per-platform preview and explicit error messages | Usability | Should | Platform tabs and error states are covered by component tests |

---

## 11. Error Handling and Exceptions
1. **Real outbound engagement:** the composer becomes a full publishing tool, not just a drafting tool.
2. **Scheduling capability:** users can queue posts for the optimal time.
3. **Reuses outbound audit:** publishing, replies, and CRM handoffs all share `outbound_activities`.
4. **Connector complexity:** each `SocialConnector` must opt into `publish?()` and handle platform-specific asset rules.

---

## 12. Assumptions and Dependencies
- Facebook Pages is the primary v1 `publish?()` target; LinkedIn is the next v1.5 target.
- The Polypost Composer (ADR-0072) and `outbound_activities` (ADR-0073) already exist.
- Connectors already enforce OAuth scope verification and tenant-scoped credentials.
- The UI converts the user's local scheduled time to UTC before sending to the API.

## 13. Open Questions / Risks
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-001 | OAuth scope creep on Facebook/LinkedIn write permissions | High | High | Primary-source verify each permission before building; scope-degradation UI prompts reconnection | Backend Lead |
| R-002 | Scheduler misses or double-sends a scheduled post | Medium | High | Use UTC `timestamptz` and `SELECT ... FOR UPDATE SKIP LOCKED`; one-minute poll with idempotent connector calls | Backend Lead |
| R-003 | Users accidentally publish to the wrong page/account | Medium | High | Require explicit `assetTargets`; show per-platform preview and confirmation step | UX / Product |
| R-004 | Connector unavailability causes a backlog of scheduled posts | Medium | Medium | Apply the same retry policy as ADR-0073/0075; surface failures clearly | Backend Lead |
| R-005 | Image/video upload scope is underestimated | Medium | High | Defer to v1.5 and design the `assets` schema to support future media types | Product Owner |
| R-006 | Timezone conversion errors in the UI | Low | Medium | Store and execute only in UTC; UI converts to/from local time and shows the UTC value | Frontend Lead |

---

## 14. Appendix
- ADR: `../../adr/0098-publishing-and-scheduling.md`
- BRD: `../Business-Requirements/BRD-0098-Publishing-And-Scheduling.md`
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md``
- Deep research: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md``
- User stories: see extracted stories above