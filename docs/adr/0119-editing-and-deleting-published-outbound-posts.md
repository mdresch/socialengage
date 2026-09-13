# ADR-0119: Editing and Deleting Published Outbound Posts

**Status:** Accepted (2026-08-28)

**Drafted 2026-08-23.** Extends ADR-0075's outbound post publishing and ADR-0073's `outbound_activities` audit model to support editing and deleting already-published posts and replies. Preserves the append-only audit trail by recording every edit and delete as a separate `outbound_activity_revision` row.

**Source:** Menno request (2026-08-23): *"Could you create the ADR for the editing and deleting of published posts"*

---

## Context

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

## Decision

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

## Consequences

### Positive
- Closes the full engagement loop: users can correct or remove published posts.
- Preserves the audit trail: every mutation is a new row, not an in-place update.
- Builds on the existing `outbound_activities` and `SocialConnector` contracts.

### Negative
- Adds a new table and two new connector methods, increasing surface area.
- Platform support is fragmented; many connectors may return `edit_not_supported` or `delete_not_supported`.
- "Edit" semantics vary by platform (some return the same id, some create a new one), which the child table must capture.

---

## Alternatives Considered

|| Alternative | Disposition |
|---|---|---|
| Add `edited_at` and `deleted_at` directly to `outbound_activities` and overwrite `body` | Rejected. This would lose the audit history of what was originally published and when. |
| Treat an edit as a brand new `outbound_activities` row | Rejected. It fragments the activity history and makes the "revisions" list harder to query. A child `outbound_activity_revisions` table keeps the parent row stable. |
| Support editing only `pending` posts | Rejected. This is simpler but does not satisfy the stated user need to correct already-published posts. |
| Use `POST /v1/outbound/activities/:id/edit` instead of `PATCH` | Rejected. `PATCH` on the activity resource is more idiomatic for a partial update, and `DELETE` is already the natural HTTP verb for deletion. |

---

## Open Questions

- [ ] **[Q-0119-1]** **Which platforms support `edit?()` and `delete?()`?** Primary-source verification is required for each connector before implementation.
- [ ] **[Q-0119-2]** **Should replies (ADR-0073) use the same `outbound_activity_revisions` table?** Mechanically yes; the child table references any `outbound_activities` row, but the per-platform semantics of editing a reply may differ from a top-level post.
- [ ] **[Q-0119-3]** **Should deletes be soft-deleted in `outbound_activities` or hard-removed from lists?** The parent row remains for audit; a `deleted_at` column filters it from default UI lists.
- [ ] **[Q-0119-4]** **Is there a time window after which a platform disallows edit/delete?** This is platform-specific and must be recorded in each per-platform ADR.
- [ ] **[Q-0119-5]** **Should `target_asset_id` be editable?** v1 does not allow retargeting an edit to a different Page/profile.

---

## Related Documents

- ADR-0073: Outbound Reply to Ingested Posts via Platform APIs
- ADR-0075: Outbound Social Post Publishing
- ADR-0072: Cross-Platform Polypost Composer and Multi-Network Preview Engine
- ADR-0071: Human-in-the-Loop Post Enrichment Overrides and Cascading Drawer UI
- ADR-0048: No-Core-Pipeline-Change Verification for New Connector Registration
- ADR-0028: Credential Creation Authority by Ownership Tier
- ADR-0014: Credential Storage Envelope Encryption

---

## Implementation Learnings & Real-World Constraints (Amended 2026-09-07 per ADR-0122)

- **Asymmetric Social Platform Edit/Delete Windows**: Third-party social networks enforce drastically differing post lifecycle rules. While deletion is universally supported, edit windows vary widely (e.g. LinkedIn limits edits to post text within specific windows, whereas X/Twitter edit APIs require paid enterprise tiers).
- **Tombstone Audit Retention**: Soft deletion with `deleted_at` timestamps in `published_posts` is mandatory for enterprise compliance and audit logs, even when the remote outbound post is permanently erased from the social platform via REST API.
- **Operational Trade-offs**: Retaining tombstone rows maintains data lineage and compliance audit trails without allowing stale outbound posts to appear in active tenant content streams.
- **Reference Commits**: `c1ab9b2` (Story 14.2 implementation), `d2aeb80` (telemetry sync).
