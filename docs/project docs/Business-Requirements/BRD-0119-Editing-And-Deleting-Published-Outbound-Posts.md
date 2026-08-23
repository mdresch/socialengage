# Business Requirements Document — Editing and Deleting Published Outbound Posts

## 1. Document Control

|| Field | Value |
||---|---|
|| Document Title | SocialEngage – Editing and Deleting Published Outbound Posts Business Requirements Document |
|| Version | 0.1 |
|| Date | 2026-08-23 |
|| Author(s) | BRD Writer Agent |
|| Approver(s) | Menno, Product Owner / Technical Lead |
|| Status | Draft |

> **Note:** This BRD is based on **ADR-0119, which is currently Proposed (2026-08-23)**. It is a draft for review and may change if the ADR is amended or rejected.

### Revision History

|| Version | Date | Author | Description of Changes |
||---|---|---|---|
|| 0.1 | 2026-08-23 | BRD Writer Agent | Initial draft from ADR-0119, the publishing-and-scheduling feature design, and related user-story references |

---

## 2. Executive Summary

**What problem are we solving?**
Once an outbound post has been dispatched through the `SocialConnector.publish?()` path, users cannot correct a typo, update a link, or remove the post from SocialEngage. They must leave the application and use each platform's native tools, which fragments the workflow and leaves the local `outbound_activities` record out of sync with the live social asset. The Polypost Composer and Post Detail panel already expose "Edit" and "Delete" affordances, but there is no back-end contract behind them.

**Who is affected?**
Tenant-Users who author and publish content, Tenant-Social-Care-Agents who need to fix or retract rapid replies, Tenant-Admins who review and moderate outgoing posts, and Tenant-Brand-Reputation-Managers who must be able to correct or suppress crisis-response content quickly.

**What is the proposed solution at a glance?**
Introduce an `outbound_activity_revisions` child table, optional `SocialConnector.edit?()` and `SocialConnector.delete?()` methods, and REST endpoints `PATCH /v1/outbound/activities/:id`, `DELETE /v1/outbound/activities/:id`, and `GET /v1/outbound/activities/:id/revisions`. Every mutation after the initial publish is stored as a new, immutable revision rather than an in-place overwrite, preserving the full audit trail while keeping the parent `outbound_activities` row stable.

**What business value do we expect?**
A complete engagement loop: users can fix mistakes and remove published posts without switching tools. The audit trail remains append-only, satisfying compliance and forensic needs. The connector framework is extended in a way that does not break existing publishing and reply flows, and unsupported platforms are handled with explicit, actionable errors.

---

## 3. Business Objectives

|| # | Objective | Success Measure |
||---|---|---|
|| 1 | Allow authorized users to edit or delete a published outbound post | A Tenant-User or Tenant-Admin can request an edit or delete and see the result reflected in the activity record |
|| 2 | Preserve an immutable, append-only audit trail for every change | Every edit and delete is a distinct `outbound_activity_revisions` row; original content is always recoverable |
|| 3 | Extend the existing `SocialConnector` and `outbound_activities` contracts without breaking v1 publishing | Existing `publish?()` and `reply?()` flows continue to function; new `edit?()` and `delete?()` methods are optional |
|| 4 | Enforce ownership- and tier-appropriate authorization | Only the original author or a Tenant-Admin can edit or delete; Platform-Admin has no access |
|| 5 | Surface platform support limitations clearly | Users on unsupported connectors receive a normalized `*_not_supported` error and a disabled UI affordance |

---

## 4. Scope

### 4.1 In Scope

- A new tenant-scoped `outbound_activity_revisions` table, with one row per edit or delete request.
- Two new optional connector methods: `SocialConnector.edit?()` and `SocialConnector.delete?()`.
- `PATCH /v1/outbound/activities/:id` to request an edit, creating an `edit` revision.
- `DELETE /v1/outbound/activities/:id` to request a delete, creating a `delete` revision or cancelling a pending post.
- `GET /v1/outbound/activities/:id/revisions` to list all edits and deletes for an activity.
- In-place update of a still-pending post body before it is dispatched.
- Two new audit columns on `outbound_activities`: `edited_at` and `deleted_at`.
- Authorization scoped to the original author or a Tenant-Admin within the same tenant.
- Explicit error codes (`edit_not_supported`, `delete_not_supported`) for connectors that do not implement the new methods.
- UI contract enabling the Polypost Composer and Post Detail panel to add "Edit" and "Delete" actions and a revision history.

### 4.2 Out of Scope

- Primary-source verification of per-platform edit/delete API support (deferred to per-platform ADRs).
- Retargeting an edit to a different `target_asset_id` or asset.
- Bulk edit or delete of multiple activities in a single request.
- Re-upload or replacement of media assets on edit in v1 (text/link-card `payload` is supported; media re-upload is not).
- Hard-deletion of the parent `outbound_activities` row; the parent remains for audit and is filtered by `deleted_at`.
- Support for editing or deleting posts on platforms whose connector does not implement the new methods.
- Time-window or expiration logic for platform-specific edit/delete windows (recorded in per-platform ADRs).

### 4.3 Assumptions

- ADR-0075 (outbound post publishing) and ADR-0073 (outbound replies) are accepted and the `outbound_activities` table exists.
- Connectors may return `501` or `422` with `edit_not_supported` or `delete_not_supported`.
- The caller's Tier-3 credential for the original provider and `target_asset_id` is still valid.
- The Polypost Composer and Post Detail panel from ADR-0072/0071 already expose the relevant affordances.

### 4.4 Constraints

- All data must be tenant-scoped and protected by Postgres Row Level Security (RLS).
- OAuth write scopes must be verified per platform before a connector's `edit?()` or `delete?()` is enabled.
- Edit/delete calls must be rate-gated separately from ingestion to avoid starving polls.
- `platform_admin` has zero access to tenant content, including revisions.
- Edit and delete semantics vary by platform and must be captured without over-generalizing the data model.

---

## 5. Stakeholders

|| Stakeholder | Role / Interest | Impact | Key Needs |
||---|---|---|---|
|| Tenant-User | Primary author of outbound posts | High | Correct typos, update links, remove accidental posts |
|| Tenant-Social-Care-Agent | Queues rapid public replies and DMs | High | Retract or fix replies in real time |
|| Tenant-Admin | Moderates outgoing content | Medium | Edit or delete posts on behalf of the team if needed |
|| Tenant-Brand-Reputation-Manager | Manages crisis-response content | High | Suppress or correct high-visibility posts immediately |
|| Product Owner | Scope and priority owner | High | Clear v1 boundaries and explicit platform support gaps |
|| Backend Engineering | Builds the revision table, endpoints, and connector contract | High | Re-usable append-only audit pattern and optional connector methods |
|| Frontend Engineering | Wires the composer and post-detail actions | High | Clear endpoints, status model, and error codes |

---

## 6. Current State (As-Is)

**Current process:**
1. A Tenant-User publishes or schedules an outbound post through `POST /v1/outbound/posts` (ADR-0075).
2. The post is stored in `outbound_activities` with `status='pending'` or `'sent'`.
3. If the post is sent, the content is now live on the platform but there is no SocialEngage path to change or remove it.
4. The Polypost Composer and Post Detail panel show "Edit" and "Delete" affordances, but they are not backed by a contract.
5. `outbound_activities` has no `edited_at` or `deleted_at` columns and no history of changes after dispatch.

**Pain points:**
- Users must switch to native platform tools to correct or remove published content.
- The local record becomes the "first draft" with no trace of later corrections.
- Content that should be retracted (e.g., a mis-post during a crisis) cannot be addressed quickly from SocialEngage.
- UI affordances promise capabilities that the back end cannot fulfill.

---

## 7. Future State (To-Be)

**New or improved process:**
1. A Tenant-User opens an `outbound_activities` row in the Outbound Activity Log or Post Detail panel.
2. For an owned activity, the user selects "Edit" or "Delete".
3. The UI calls `PATCH /v1/outbound/activities/:id` or `DELETE /v1/outbound/activities/:id`.
4. The backend creates an `outbound_activity_revisions` row with `status='pending'`.
5. If the parent activity is still `pending`, an edit updates the pending body in place and the revision is marked `applied` without a platform call; a delete cancels the pending activity and no revision is created.
6. If the parent activity is `sent`, the connector's `edit?()` or `delete?()` is called.
7. The revision is updated to `applied` (with `external_id` and `external_url`) or `failed` (with `error_code`), and the parent row's `edited_at` or `deleted_at` is set on success.
8. The user can call `GET /v1/outbound/activities/:id/revisions` to view a chronological list of all changes.

**Expected capabilities:**
- Edit the text or payload of a published post where the platform supports it.
- Delete a published post where the platform supports it.
- View a complete, immutable history of edits and delete attempts for each activity.
- Cancel or update a post that has not yet been dispatched.
- Receive a clear, normalized error when a connector does not support the requested operation.

---

## 8. Business Requirements

### 8.1 Functional Requirements

|| ID | Requirement | Priority | Acceptance Criteria | Owner |
||---|---|---|---|---|
|| BR-001 | The system shall record every requested edit as a new `outbound_activity_revisions` row | Must | `PATCH /v1/outbound/activities/:id` creates a revision with `revision_type='edit'` and `status='pending'` | Product Owner |
|| BR-002 | The system shall allow an authorized user to edit a post that is still pending | Must | The pending body is updated in place, the revision is marked `applied`, and no connector call is made | Product Owner |
|| BR-003 | The system shall allow an authorized user to edit a post that has already been sent | Must | The connector's `edit?()` is called and the revision is updated to `applied` or `failed` | Product Owner |
|| BR-004 | The system shall record every requested delete as a new `outbound_activity_revisions` row for sent posts | Must | `DELETE /v1/outbound/activities/:id` creates a revision with `revision_type='delete'` and `status='pending'` for sent posts | Product Owner |
|| BR-005 | The system shall treat a delete on a pending post as a cancellation | Must | The parent row is marked `cancelled` and no revision is created | Product Owner |
|| BR-006 | The system shall list all revisions for an activity in descending chronological order | Must | `GET /v1/outbound/activities/:id/revisions` returns edits and deletes ordered by `created_at DESC` | Product Owner |
|| BR-007 | The system shall return a normalized error when a connector does not support edit or delete | Must | Unsupported connectors return `edit_not_supported` or `delete_not_supported` with an appropriate HTTP status | Product Owner |
|| BR-008 | The system shall restrict edit and delete to the original author or a Tenant-Admin | Must | Calls by other Tenant-Users or Platform-Admins are rejected | Product Owner |
|| BR-009 | The system shall update parent audit columns when a revision is applied | Must | `edited_at` or `deleted_at` on `outbound_activities` is set when the corresponding revision reaches `applied` | Product Owner |
|| BR-010 | The system shall keep the latest non-failed edit revision as the source of truth for current content | Must | UI and API derive the current body from the most recent `applied` edit revision | Product Owner |
|| BR-011 | The system shall not allow retargeting an edit to a different asset | Must | `target_asset_id` is read-only on edit; requests that attempt to change it are rejected | Product Owner |
|| BR-012 | The UI shall expose Edit, Delete, and revision-history actions for owned posts | Should | The Polypost Composer and Post Detail panel show or disable these actions based on connector support and caller ownership | Product Owner |

### 8.2 Non-Functional Requirements

|| ID | Requirement | Category | Priority | Acceptance Criteria |
||---|---|---|---|---|
|| NFR-001 | All revision records are tenant-scoped and protected by RLS | Security | Must | Contract tests verify cross-tenant access is rejected |
|| NFR-002 | Edit and delete calls use a dedicated outbound rate gate | Performance / Reliability | Must | `RequestGate` tracks calls per `(tenantId, providerId)` for outbound edits/deletes |
|| NFR-003 | The revision table is append-only and never overwrites existing rows | Compliance | Must | Audit confirms updates only change `status` and result fields on a revision row, not content history |
|| NFR-004 | The API returns clear, actionable error messages for unsupported or failed operations | Usability | Should | Errors include a normalized code and a human-readable reason |
|| NFR-005 | The revisions list supports pagination for activities with many changes | Scalability | Should | `GET /v1/outbound/activities/:id/revisions` uses cursor pagination when the list may exceed 50 rows |

---

## 9. Business Rules

|| ID | Rule |
||---|---|
|| BRU-001 | Only the original `user_id` who created the `outbound_activities` row, or a `tenant_admin` in the same tenant, may edit or delete the activity. |
|| BRU-002 | `tenant_user` may not edit or delete another user's posts. |
|| BRU-003 | `platform_admin` has no access to tenant `outbound_activities` or their revisions. |
|| BRU-004 | Connectors that do not implement `edit?()` must return the error code `edit_not_supported`. |
|| BRU-005 | Connectors that do not implement `delete?()` must return the error code `delete_not_supported`. |
|| BRU-006 | If the parent activity is still `pending`, an edit updates the pending body in place and the revision is marked `applied` without calling the connector. |
|| BRU-007 | If the parent activity is `pending`, a delete is equivalent to the existing cancellation path and no revision is created. |
|| BRU-008 | If the parent activity is `sent`, the connector's `edit?()` or `delete?()` is called and the revision is updated to `applied` or `failed`. |
|| BRU-009 | `outbound_activities` does not store a `current_body`; the current content is the latest `applied` `edit` revision. |
|| BRU-010 | The parent `outbound_activities.edited_at` and `deleted_at` columns are set only when a revision reaches `applied`. |
|| BRU-011 | `target_asset_id` is not editable in v1. |
|| BRU-012 | The same Tier-3 credential used for the original activity is reused for the edit or delete. |

---

## 10. Data Requirements

|| Data Element | Description | Source | Owner | Sensitivity |
||---|---|---|---|---|
|| `outbound_activity_revisions` child row | One row per edit or delete attempt after initial publish | `PATCH` or `DELETE /v1/outbound/activities/:id` | Backend | Tenant-scoped |
|| `revision_type` | `'edit'` or `'delete'` | User action | Backend | Operational |
|| `body` | New post text for an edit; `null` for a delete | User input or payload | Backend | Tenant-scoped |
|| `payload` | Optional JSONB for link card or media refs on an edit | User input | Backend | Tenant-scoped |
|| `status` | `'pending'` -> `'applied'` / `'failed'` / `'cancelled'` | Backend | Backend | Operational |
|| `error_code` | Normalized failure reason on `'failed'` | Connector or backend validation | Backend | Operational |
|| `external_id` | Platform's returned (new) post/activity id, if an edit returns one | Connector response | Backend | Operational |
|| `external_url` | Deep link after a successful edit or delete | Connector response | Backend | Operational |
|| `outbound_activities.edited_at` | Audit timestamp set when an edit revision is applied | Backend | Backend | Operational |
|| `outbound_activities.deleted_at` | Audit timestamp set when a delete revision is applied | Backend | Backend | Operational |

---

## 11. Reporting and Analytics

|| Report / Metric | Purpose | Audience | Frequency |
||---|---|---|---|
|| Revision history per activity | Audit and customer-service review | Tenant-User / Tenant-Admin | On demand |
|| Edit / delete success and failure counts | Track connector maturity and user friction | Product / Engineering | Weekly |
|| Pending revisions count | Identify stuck or retryable operations | Engineering | Real time |
|| Unsupported-operation errors | Surface which platforms lack edit or delete support | Product / Engineering | Weekly |
|| Time from edit request to applied | Measure connector responsiveness | Engineering | Weekly |

---

## 12. Risks and Mitigations

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
||---|---|---|---|---|---|
|| R-001 | Major platforms (Facebook, Instagram, X) do not support editing through public APIs | High | High | Primary-source verify each platform; return `edit_not_supported` and disable the UI affordance | Backend Lead |
|| R-002 | Edit semantics vary by platform (same id vs. new post id) | High | Medium | Capture `external_id` and `external_url` on each revision; keep parent stable | Backend Lead |
|| R-003 | Users expect deletes to be synchronous, but some platforms process them asynchronously | Medium | Medium | Return `200 OK` or `202 Accepted` explicitly; poll/poll callback pattern left open in design | Backend Lead |
|| R-004 | Platform-specific edit/delete time windows cause user confusion | Medium | Medium | Record time windows in per-platform ADRs and surface `edit_window_expired` codes | Product Owner |
|| R-005 | Revision table grows quickly on high-volume tenants | Medium | Medium | Cursor pagination, tenant-scoped retention policy aligned with ADR-0018 | Backend Lead |
|| R-006 | OAuth scope creep for write/edit/delete permissions | High | High | Verify exact scopes per connector; reuse existing credential envelope from ADR-0014 | Backend Lead |

---

## 13. Dependencies

|| ID | Dependency | Type | Owner | Expected Resolution |
||---|---|---|---|---|
|| D-001 | ADR-0075 Outbound Social Post Publishing | Internal / Backend | Backend Lead | Accepted; defines `outbound_activities` and `SocialConnector.publish?()` |
|| D-002 | ADR-0073 Outbound Reply to Ingested Posts | Internal / Backend | Backend Lead | Accepted; defines the base `outbound_activities` audit model |
|| D-003 | ADR-0072 Cross-Platform Polypost Composer and Multi-Network Preview Engine | Internal / Design | Product Owner | Accepted; provides the authoring surface |
|| D-004 | ADR-0071 Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI | Internal / Design | Product Owner | Accepted; provides the post detail surface |
|| D-005 | ADR-0028 Credential Creation Authority by Ownership Tier | Internal / Backend | Backend Lead | Accepted; determines caller's credential authorization |
|| D-006 | ADR-0014 Credential Storage Envelope Encryption | Internal / Backend | Backend Lead | Accepted; protects the credential used for edit/delete |
|| D-007 | ADR-0048 No-Core-Pipeline-Change Verification for New Connector Registration | Internal / Backend | Backend Lead | Accepted; governs how new connectors opt into `edit?()` / `delete?()` |
|| D-008 | Feature design: `07-publishing-and-scheduling.md` | Internal / Research | Product Owner | Accepted; contextualizes the broader publishing feature |
|| D-009 | Deep research brief: `07-publishing-and-scheduling-deep-research.md` | Internal / Research | Product Owner | Available; identifies v1 scope and platform readiness risks |

---

## 14. Acceptance Criteria

- An authorized user can request an edit of a `sent` post and receive a 201 response with a new `outbound_activity_revisions` row.
- A `sent` post's edit revision reaches `applied` with `external_id` and `external_url` when the connector succeeds, or `failed` with a normalized `error_code` when it does not.
- An edit on a `pending` post updates the pending body and marks the revision `applied` without an external connector call.
- A delete on a `pending` post cancels the activity and sets `status='cancelled'` without creating a revision.
- A delete on a `sent` post creates a `delete` revision and, on success, sets `outbound_activities.deleted_at`.
- `GET /v1/outbound/activities/:id/revisions` returns all edits and deletes for the activity in `created_at` descending order.
- The original author and Tenant-Admins can edit and delete; other Tenant-Users and Platform-Admins cannot.
- Connectors that do not implement `edit?()` or `delete?()` return the error codes `edit_not_supported` or `delete_not_supported`.
- The Polypost Composer and Post Detail panel show Edit and Delete actions only for activities owned by the caller, and disable the action with an explanatory message for unsupported platforms.
- `target_asset_id` cannot be changed by an edit request.

---

## 15. Glossary

|| Term | Definition |
||---|---|
|| `outbound_activity_revisions` | Child table that records every edit or delete attempt after an `outbound_activities` row is created |
|| `revision_type` | Enum-like value of `'edit'` or `'delete'` |
|| `outbound_activities` | Tenant-scoped audit table for all outbound engagement: replies, posts, and CRM handoffs |
|| `edited_at` | Audit column on `outbound_activities` set when an edit revision reaches `applied` |
|| `deleted_at` | Audit column on `outbound_activities` set when a delete revision reaches `applied` |
|| `external_id` | Platform-assigned identifier returned by an edit or delete call |
|| `external_url` | Public or deep-link URL returned by an edit or delete call |
|| `target_asset_id` | The page, account, or board that received the original post |
|| `edit_not_supported` / `delete_not_supported` | Normalized error codes for connectors that do not implement the corresponding method |
|| `SocialConnector.edit?()` | Optional connector method that updates an already-published post on a platform |
|| `SocialConnector.delete?()` | Optional connector method that removes an already-published post from a platform |

---

## 16. Appendices

### Reference documents

- ADR-0119: `docs/adr/0119-editing-and-deleting-published-outbound-posts.md` — source architecture decision (Proposed, 2026-08-23).
- ADR-0075: `docs/adr/0075-outbound-social-post-publishing.md` — base outbound post publishing contract.
- ADR-0073: `docs/adr/0073-outbound-reply-to-ingested-posts.md` — base `outbound_activities` audit model.
- ADR-0072: `docs/adr/0072-cross-platform-polypost-composer-and-multi-network-preview-engine.md` — composer surface.
- ADR-0071: `docs/adr/0071-human-in-the-loop-post-enrichment-overrides-and-cascading-drawer-ui.md` — post detail surface.
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md` — what the broader publishing feature is, user benefits, and implementation notes.
- Deep research brief: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md` — competitive context and platform readiness risks.

### Related user stories

> **Note:** No user stories have been drafted specifically for ADR-0119 yet. The following existing stories identify editing and deleting published posts as currently out of scope, making them the natural implementation targets once ADR-0119 is accepted:

- **Story 2.29 — Facebook Page Post Publishing** (`epic-2-ingestion-connectors-and-rate-limits.md`) — lists "editing or deleting a published post" as explicitly out of scope.
- **Story 2.30 — LinkedIn Post Publishing** (`epic-2-ingestion-connectors-and-rate-limits.md`) — lists "editing or deleting a published post" as explicitly out of scope.
- **Story 3.15 — Outbound Post Publishing Audit Table and `POST /v1/outbound/posts` API** (`epic-3-data-model-storage-and-archival.md`) — establishes the `outbound_activities` table and cancellation behavior that this ADR extends.
- **Story 6.39 — Polypost Composer Real Publish Flow** (`epic-6-tenant-admin-ui.md`) — lists "editing/deleting sent posts" as explicitly out of scope.

---

## 17. Approval

|| Role | Name | Signature | Date |
||---|---|---|---|
|| Business Sponsor | Menno | | |
|| Product Owner | Menno | | |
|| Technical Lead | Menno | | |
|| Other Stakeholder | | | |
