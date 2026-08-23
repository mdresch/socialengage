# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Editing And Deleting Published Outbound Posts |
| Version | 0.1 |
| Date | 2026-08-23 |
| Author(s) | FDD Writer — Batch Agent |
| Reviewer(s) | Product Owner / Technical Lead |
| Status | Draft (ADR status: Proposed (2026-08-23); BRD status: Draft) |
| Related Documents | ADR-0119, BRD-0119, related feature designs, user stories |

---

## 2. Purpose and Scope

### 2.1 Purpose
**Note:** The source ADR is currently **Proposed**. This FDD is a draft for review and may change.

**What problem are we solving?**
Once an outbound post has been dispatched through the `SocialConnector.publish?()` path, users cannot correct a typo, update a link, or remove the post from SocialEngage. They must leave the application and use each platform's native tools, which fragments the workflow and leaves the local `outbound_activities` record out of sync with the live social asset. The Polypost Composer and Post Detail panel already expose "Edit" and "Delete" affordances, but there is no back-end contract behind them.

This FDD translates the accepted architecture and business requirements from ADR-0119 and BRD-0119 into a coherent functional design for implementation.

### 2.2 Scope

- **In scope:** - A new tenant-scoped `outbound_activity_revisions` table, with one row per edit or delete request.
- Two new optional connector methods: `SocialConnector.edit?()` and `SocialConnector.delete?()`.
- `PATCH /v1/outbound/activities/:id` to request an edit, creating an `edit` revision.
- `DELETE /v1/outbound/activities/:id` to request a delete, creating a `delete` revision or cancelling a pending post.
- `GET /v1/outbound/activities/:id/revisions` to list all edits and deletes for an activity.
- In-place update of a still-pending post body before it is dispatched.
- Two new audit columns on `outbound_activities`: `edited_at` and `deleted_at`.
- Authorization scoped to the original author or a Tenant-Admin within the same tenant.
- Explicit error codes (`edit_not_supported`, `delete_not_supported`) for connectors that do not implement the new methods.
- UI contract enabling the Polypost Composer and Post Detail panel to add "Edit" and "Delete" actions and a revision history.
- **Out of scope:** - Primary-source verification of per-platform edit/delete API support (deferred to per-platform ADRs).
- Retargeting an edit to a different `target_asset_id` or asset.
- Bulk edit or delete of multiple activities in a single request.
- Re-upload or replacement of media assets on edit in v1 (text/link-card `payload` is supported; media re-upload is not).
- Hard-deletion of the parent `outbound_activities` row; the parent remains for audit and is filtered by `deleted_at`.
- Support for editing or deleting posts on platforms whose connector does not implement the new methods.
- Time-window or expiration logic for platform-specific edit/delete windows (recorded in per-platform ADRs).
- **Assumptions and constraints:** - ADR-0075 (outbound post publishing) and ADR-0073 (outbound replies) are accepted and the `outbound_activities` table exists.
- Connectors may return `501` or `422` with `edit_not_supported` or `delete_not_supported`.
- The caller's Tier-3 credential for the original provider and `target_asset_id` is still valid.
- The Polypost Composer and Post Detail panel from ADR-0072/0071 already expose the relevant affordances.

### 2.3 Target Audience
Engineers, QA, product owners, UX, and platform operations.

---

## 3. Context and Background

### 1. ADR-0075 deliberately excluded post-edit and post-delete
ADR-0075 (Proposed 2026-08-22) scopes v1 `SocialConnector.publish?()` to immediate text/link-card posts and explicitly lists *"editing or deleting a published post after dispatch"* as out of scope. The `outbound_activities` table introduced by ADR-0073 is append-only, with no columns for `edited_at` or `deleted_at`.

### 2. The Polypost Composer and Post Detail UI will eventually need these actions
ADR-0072's composer and ADR-0071's Post Detail panel both have natural affordances for "Edit" and "Delete". Without a back-end contract, those affordances can only simulate state.

### 3. Platform support is uneven and requires primary-source verification
- **Mastodon** and **Bluesky** generally support editing and deleting posts.
- **Facebook** and **Instagram** historically do not support editing Page/feed posts through their public APIs; deletion may be supported.
- **LinkedIn** and **X/Twitter** support deletion; editing is limited or recent.
- This ADR records the shared contract and defers platform-specific verification to per-platform ADRs.

---

---

## 4. Goals and Objectives

|| # | Objective | Success Measure |
||---|---|---|
|| 1 | Allow authorized users to edit or delete a published outbound post | A Tenant-User or Tenant-Admin can request an edit or delete and see the result reflected in the activity record |
|| 2 | Preserve an immutable, append-only audit trail for every change | Every edit and delete is a distinct `outbound_activity_revisions` row; original content is always recoverable |
|| 3 | Extend the existing `SocialConnector` and `outbound_activities` contracts without breaking v1 publishing | Existing `publish?()` and `reply?()` flows continue to function; new `edit?()` and `delete?()` methods are optional |
|| 4 | Enforce ownership- and tier-appropriate authorization | Only the original author or a Tenant-Admin can edit or delete; Platform-Admin has no access |
|| 5 | Surface platform support limitations clearly | Users on unsupported connectors receive a normalized `*_not_supported` error and a disabled UI affordance |

---

---

## 5. Functional Requirements

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

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

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

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 | | | | |

### 6.3 Workflow Diagrams / Steps

### 1. New `outbound_activity_revisions` table
The existing `outbound_activities` table stays append-only and unchanged in shape. Every mutation after the initial publish is recorded in a new, tenant-scoped child table:

|| Field | Purpose |
|---|---|---|
| `id` | Primary key |
| `tenant_id` | RLS scope |
| `activity_id` | FK-ish reference to the parent `outbound_activities` row (app-enforced, no DB FK) |
| `user_id` | Who initiated the edit or delete |
| `revision_type` | `'edit'` or `'delete'` |
| `body` | New post text for `'edit'`; `null` for `'delete'` |
| `payload` | Optional JSONB for link card / media refs for `'edit'` |
| `status` | `'pending'` → `'applied'` / `'failed'` / `'cancelled'` |
| `error_code` | Normalized failure reason on `'failed'` |
| `external_id` | Provider's returned (new) post/activity id, if edit returns one |
| `external_url` | Deep link after a successful edit |
| `created_at` | Audit timestamp |

`outbound_activities` gains two nullable audit columns: `edited_at` and `deleted_at`, updated only when a revision reaches `'applied'`. It does **not** store a `current_body`; the latest non-failed `'edit'` revision is the source of truth for current content.

### 2. New optional connector methods

```ts
async edit?(
  activity: OutboundActivitySummary,
  body: string,
  payload?: OutboundPostPayload,
  credential: Credential
): Promise<{ externalId?: string; externalUrl?: string }>

async delete?(
  activity: OutboundActivitySummary,
  credential: Credential
): Promise<{ externalId?: string; externalUrl?: string }>
```

- Connectors that do not implement `edit` return `501` / `422` with code `edit_not_supported`.
- Connectors that do not implement `delete` return `501` / `422` with code `delete_not_supported`.
- These are optional methods alongside `SocialConnector.publish?()` and `SocialConnector.reply?()`.

### 3. New REST endpoints

- `PATCH /v1/outbound/activities/:id`
  - Requires `body` (and optional `payload`) in the request.
  - Creates an `outbound_activity_revisions` row with `revision_type='edit'` and `status='pending'`.
  - If the parent activity is still `pending`, the revision updates the pending body in place before dispatch and is marked `applied` without calling the connector (no external post exists yet).
  - If the parent activity is `sent`, the connector's `edit()` is called and the revision is updated to `applied` or `failed`.
  - Returns the created revision with HTTP `201 Created`.

- `DELETE /v1/outbound/activities/:id`
  - If the parent activity is still `pending`, this is equivalent to the existing cancellation path from ADR-0075: the row is marked `cancelled` and no revision is created.
  - If the parent activity is `sent`, an `outbound_activity_revisions` row with `revision_type='delete'` and `status='pending'` is created. The connector's `delete()` is called; the revision is updated to `applied` or `failed`. The parent `outbound_activities.deleted_at` is set on success.
  - Returns `200 OK` or `202 Accepted` depending on whether the delete is synchronous.

- `GET /v1/outbound/activities/:id/revisions`
  - Lists all edits and deletes for the activity in `created_at` descending order.

### 4. Authorization and scope
- Reuse the caller's Tier-3 credential for the original provider and `target_asset_id`.
- The caller must be the same `user_id` who created the original `outbound_activities` row, or a `tenant_admin` with the same tenant. `tenant_user` may not edit/delete another user's posts.
- `platform_admin` has no access, preserving the zero-tenant-content boundary.

### 5. UI contract
- The Polypost Composer (ADR-0072) and Post Detail panel (ADR-0071) may add "Edit" and "Delete" actions on `outbound_activities` rows owned by the caller.
- The UI reads `GET /v1/outbound/activities/:id/revisions` to show a history of changes.
- Unsupported platforms disable the relevant action and surface the connector's `*_not_supported` error.

---

---

## 7. Data Requirements

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

---

## 8. Business Rules and Logic

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

---

## 9. Interfaces and Integrations

### 1. New `outbound_activity_revisions` table
The existing `outbound_activities` table stays append-only and unchanged in shape. Every mutation after the initial publish is recorded in a new, tenant-scoped child table:

|| Field | Purpose |
|---|---|---|
| `id` | Primary key |
| `tenant_id` | RLS scope |
| `activity_id` | FK-ish reference to the parent `outbound_activities` row (app-enforced, no DB FK) |
| `user_id` | Who initiated the edit or delete |
| `revision_type` | `'edit'` or `'delete'` |
| `body` | New post text for `'edit'`; `null` for `'delete'` |
| `payload` | Optional JSONB for link card / media refs for `'edit'` |
| `status` | `'pending'` → `'applied'` / `'failed'` / `'cancelled'` |
| `error_code` | Normalized failure reason on `'failed'` |
| `external_id` | Provider's returned (new) post/activity id, if edit returns one |
| `external_url` | Deep link after a successful edit |
| `created_at` | Audit timestamp |

`outbound_activities` gains two nullable audit columns: `edited_at` and `deleted_at`, updated only when a revision reaches `'applied'`. It does **not** store a `current_body`; the latest non-failed `'edit'` revision is the source of truth for current content.

### 2. New optional connector methods

```ts
async edit?(
  activity: OutboundActivitySummary,
  body: string,
  payload?: OutboundPostPayload,
  credential: Credential
): Promise<{ externalId?: string; externalUrl?: string }>

async delete?(
  activity: OutboundActivitySummary,
  credential: Credential
): Promise<{ externalId?: string; externalUrl?: string }>
```

- Connectors that do not implement `edit` return `501` / `422` with code `edit_not_supported`.
- Connectors that do not implement `delete` return `501` / `422` with code `delete_not_supported`.
- These are optional methods alongside `SocialConnector.publish?()` and `SocialConnector.reply?()`.

### 3. New REST endpoints

- `PATCH /v1/outbound/activities/:id`
  - Requires `body` (and optional `payload`) in the request.
  - Creates an `outbound_activity_revisions` row with `revision_type='edit'` and `status='pending'`.
  - If the parent activity is still `pending`, the revision updates the pending body in place before dispatch and is marked `applied` without calling the connector (no external post exists yet).
  - If the parent activity is `sent`, the connector's `edit()` is called and the revision is updated to `applied` or `failed`.
  - Returns the created revision with HTTP `201 Created`.

- `DELETE /v1/outbound/activities/:id`
  - If the parent activity is still `pending`, this is equivalent to the existing cancellation path from ADR-0075: the row is marked `cancelled` and no revision is created.
  - If the parent activity is `sent`, an `outbound_activity_revisions` row with `revision_type='delete'` and `status='pending'` is created. The connector's `delete()` is called; the revision is updated to `applied` or `failed`. The parent `outbound_activities.deleted_at` is set on success.
  - Returns `200 OK` or `202 Accepted` depending on whether the delete is synchronous.

- `GET /v1/outbound/activities/:id/revisions`
  - Lists all edits and deletes for the activity in `created_at` descending order.

### 4. Authorization and scope
- Reuse the caller's Tier-3 credential for the original provider and `target_asset_id`.
- The caller must be the same `user_id` who created the original `outbound_activities` row, or a `tenant_admin` with the same tenant. `tenant_user` may not edit/delete another user's posts.
- `platform_admin` has no access, preserving the zero-tenant-content boundary.

### 5. UI contract
- The Polypost Composer (ADR-0072) and Post Detail panel (ADR-0071) may add "Edit" and "Delete" actions on `outbound_activities` rows owned by the caller.
- The UI reads `GET /v1/outbound/activities/:id/revisions` to show a history of changes.
- Unsupported platforms disable the relevant action and surface the connector's `*_not_supported` error.

---

---

## 10. Non-Functional Considerations

|| ID | Requirement | Category | Priority | Acceptance Criteria |
||---|---|---|---|---|
|| NFR-001 | All revision records are tenant-scoped and protected by RLS | Security | Must | Contract tests verify cross-tenant access is rejected |
|| NFR-002 | Edit and delete calls use a dedicated outbound rate gate | Performance / Reliability | Must | `RequestGate` tracks calls per `(tenantId, providerId)` for outbound edits/deletes |
|| NFR-003 | The revision table is append-only and never overwrites existing rows | Compliance | Must | Audit confirms updates only change `status` and result fields on a revision row, not content history |
|| NFR-004 | The API returns clear, actionable error messages for unsupported or failed operations | Usability | Should | Errors include a normalized code and a human-readable reason |
|| NFR-005 | The revisions list supports pagination for activities with many changes | Scalability | Should | `GET /v1/outbound/activities/:id/revisions` uses cursor pagination when the list may exceed 50 rows |

---

---

## 11. Error Handling and Exceptions

|| ID | Risk | Likelihood | Impact | Mitigation | Owner |
||---|---|---|---|---|---|
|| R-001 | Major platforms (Facebook, Instagram, X) do not support editing through public APIs | High | High | Primary-source verify each platform; return `edit_not_supported` and disable the UI affordance | Backend Lead |
|| R-002 | Edit semantics vary by platform (same id vs. new post id) | High | Medium | Capture `external_id` and `external_url` on each revision; keep parent stable | Backend Lead |
|| R-003 | Users expect deletes to be synchronous, but some platforms process them asynchronously | Medium | Medium | Return `200 OK` or `202 Accepted` explicitly; poll/poll callback pattern left open in design | Backend Lead |
|| R-004 | Platform-specific edit/delete time windows cause user confusion | Medium | Medium | Record time windows in per-platform ADRs and surface `edit_window_expired` codes | Product Owner |
|| R-005 | Revision table grows quickly on high-volume tenants | Medium | Medium | Cursor pagination, tenant-scoped retention policy aligned with ADR-0018 | Backend Lead |
|| R-006 | OAuth scope creep for write/edit/delete permissions | High | High | Verify exact scopes per connector; reuse existing credential envelope from ADR-0014 | Backend Lead |

---

---

## 12. Assumptions and Dependencies

- ADR-0075 (outbound post publishing) and ADR-0073 (outbound replies) are accepted and the `outbound_activities` table exists.
- Connectors may return `501` or `422` with `edit_not_supported` or `delete_not_supported`.
- The caller's Tier-3 credential for the original provider and `target_asset_id` is still valid.
- The Polypost Composer and Post Detail panel from ADR-0072/0071 already expose the relevant affordances.

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

---

## 13. Open Questions

1. **Which platforms support `edit?()` and `delete?()`?** Primary-source verification is required for each connector before implementation.
2. **Should replies (ADR-0073) use the same `outbound_activity_revisions` table?** Mechanically yes; the child table references any `outbound_activities` row, but the per-platform semantics of editing a reply may differ from a top-level post.
3. **Should deletes be soft-deleted in `outbound_activities` or hard-removed from lists?** The parent row remains for audit; a `deleted_at` column filters it from default UI lists.
4. **Is there a time window after which a platform disallows edit/delete?** This is platform-specific and must be recorded in each per-platform ADR.
5. **Should `target_asset_id` be editable?** v1 does not allow retargeting an edit to a different Page/profile.

---

---

## 14. Appendix

### Reference Documents

- ADR-0119: `docs/adr/0119-editing-and-deleting-published-outbound-posts.md`
- BRD-0119: `docs/project docs/Business-Requirements/BRD-0119-Editing-And-Deleting-Published-Outbound-Posts.md`
- Feature design: `docs/product-research/feature-designs/07-publishing-and-scheduling.md`
- Deep-research report: `docs/product-research/reports/07-publishing-and-scheduling-deep-research.md`

### Missing Sources Noted

- No matching user stories found in `docs/user-stories/epic-*.md` for ADR-0119.

### Revision History

| Version | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-08-23 | FDD Writer — Batch Agent | Initial synthesis from ADR-0119 and BRD-0119. |